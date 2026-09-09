const db = require('../config/database');

/**
 * Resolves active company ID from argument, AsyncLocalStorage store, or fallback 1.
 */
function resolveCompanyId(companyId = null) {
  if (companyId !== null && companyId !== undefined && !isNaN(parseInt(companyId, 10))) {
    return parseInt(companyId, 10);
  }
  const store = db.asyncLocalStorage ? db.asyncLocalStorage.getStore() : null;
  if (store && store.companyId) {
    return parseInt(store.companyId, 10);
  }
  return 1;
}

/**
 * Ensures the lot_sequence table exists in the company's database schema.
 */
async function ensureLotSequenceTable(companyId = null) {
  const cId = resolveCompanyId(companyId);
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence (
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL DEFAULT 0
      )
    `, [], cId);
    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `, [], cId);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Scans all lot columns across all tables in the specified company to find the absolute highest numeric lot number.
 * Compatible with PostgreSQL (Render/Cloud) and SQLite (Local).
 */
async function getAbsoluteMaxLotNumber(companyId = null) {
  const cId = resolveCompanyId(companyId);
  await ensureLotSequenceTable(cId);

  let maxNum = 0;

  // 1. Inspect lot_sequence table first
  try {
    const seqRes = await db.query(
      `SELECT last_lot_no FROM lot_sequence WHERE id = 1`,
      [],
      cId
    );
    if (seqRes && seqRes.rows && seqRes.rows.length > 0) {
      const seqVal = parseInt(seqRes.rows[0].last_lot_no, 10);
      if (!isNaN(seqVal) && seqVal > maxNum) {
        maxNum = seqVal;
      }
    }
  } catch (e) {}

  // 2. Scan all company transaction & inventory tables that store lots
  const tables = [
    { name: 'stock_lots', col: 'lot_no' },
    { name: 'purchase_items', col: 'lot_no' },
    { name: 'stock', col: 'lot_no' },
    { name: 'grain_input_items', col: 'lot_no' },
    { name: 'grain_output_items', col: 'lot_no' },
    { name: 'grain_wastage_items', col: 'lot_no' },
    { name: 'flour_out_items', col: 'lot_no' },
    { name: 'flour_out_return_items', col: 'lot_no' },
    { name: 'purchase_return_items', col: 'lot_no' },
    { name: 'packing_items', col: 'lot_no' },
    { name: 'open_items', col: 'lot_no' },
    { name: 'item_transfers', col: 'lot_no' },
    { name: 'sales_items', col: 'lot_no' },
    { name: 'work_order_items', col: 'lot_no' },
    { name: 'work_order_items', col: 'fg_lot_no' },
    { name: 'work_order_outputs', col: 'fg_lot_no' },
    { name: 'papad_in', col: 'lot_no' },
    { name: 'vehicle_movements', col: 'lot_no' },
    { name: 'quotations', col: 'lot_no' },
    { name: 'sales_export_order_items', col: 'lot_no' },
    { name: 'stock_adjustment_items', col: 'lot_no' },
    { name: 'weight_conversion_items', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const res = await db.query(
        `SELECT DISTINCT ${t.col} AS lot_no FROM ${t.name} WHERE ${t.col} IS NOT NULL AND ${t.col} != ''`,
        [],
        cId
      );
      if (res && res.rows && res.rows.length > 0) {
        for (const row of res.rows) {
          const val = String(row.lot_no || '').trim();
          if (!val) continue;
          // Match LOT0001, LOT-0001, LOT_1, LOT123, or pure numeric string
          const match = val.match(/^LOT[-_]?(\d+)$/i) || val.match(/LOT[-_]?(\d+)/i) || val.match(/^(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    } catch (e) {
      // Table or column might not exist yet - gracefully continue
    }
  }

  // 3. Keep lot_sequence aligned with maxNum if higher
  if (maxNum > 0) {
    try {
      await db.run(
        `UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1 AND last_lot_no < ?`,
        [maxNum, maxNum],
        cId
      );
    } catch (e) {}
  }

  return maxNum;
}

/**
 * Preview the next LOT number for the company without incrementing lot_sequence (read-only).
 */
async function previewNextLotNumber(companyId = null) {
  const cId = resolveCompanyId(companyId);
  const maxNum = await getAbsoluteMaxLotNumber(cId);
  const nextNum = maxNum + 1;
  return `LOT${String(nextNum).padStart(4, '0')}`;
}

/**
 * Reserve and consume the next LOT number (thread-safe, company-isolated).
 * In PostgreSQL, uses transaction locking on lot_sequence to prevent concurrent collisions.
 * In SQLite, uses transaction serialization.
 */
async function reserveNextLotNumber(companyId = null) {
  const cId = resolveCompanyId(companyId);
  await ensureLotSequenceTable(cId);

  let conn = null;
  try {
    conn = await db.getConnection(cId);
    if (conn && typeof conn.beginTransaction === 'function') {
      await conn.beginTransaction();

      let currentSeq = 0;
      try {
        const seqRes = await conn.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1 FOR UPDATE`);
        if (seqRes && seqRes.rows && seqRes.rows.length > 0) {
          currentSeq = parseInt(seqRes.rows[0].last_lot_no, 10) || 0;
        }
      } catch (lockErr) {
        // SQLite doesn't support FOR UPDATE; transaction itself provides database-level lock
        const seqRes = await conn.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1`);
        if (seqRes && seqRes.rows && seqRes.rows.length > 0) {
          currentSeq = parseInt(seqRes.rows[0].last_lot_no, 10) || 0;
        }
      }

      // Check max across tables in case lot_sequence was lower than existing lots
      const maxExisting = await getAbsoluteMaxLotNumber(cId);
      const baseNum = Math.max(currentSeq, maxExisting);
      const nextNum = baseNum + 1;

      await conn.run(
        `UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1`,
        [nextNum]
      );

      await conn.commit();
      return `LOT${String(nextNum).padStart(4, '0')}`;
    }
  } catch (err) {
    if (conn && typeof conn.rollback === 'function') {
      try { await conn.rollback(); } catch (rbErr) {}
    }
  } finally {
    if (conn && typeof conn.release === 'function') {
      try { conn.release(); } catch (relErr) {}
    }
  }

  // Fallback if transaction fails
  const maxExisting = await getAbsoluteMaxLotNumber(cId);
  const nextNum = maxExisting + 1;
  try {
    await db.run(
      `UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1`,
      [nextNum],
      cId
    );
  } catch (e) {}
  return `LOT${String(nextNum).padStart(4, '0')}`;
}

/**
 * Records an existing or generated lot number into lot_sequence so that future numbers stay ahead.
 */
async function recordLotNumber(lotNo, companyId = null) {
  if (!lotNo) return;
  const cId = resolveCompanyId(companyId);
  const match = String(lotNo).match(/^LOT[-_]?(\d+)$/i) || String(lotNo).match(/LOT[-_]?(\d+)/i) || String(lotNo).match(/^(\d+)$/);
  if (!match) return;
  const num = parseInt(match[1], 10);
  if (isNaN(num) || num <= 0) return;

  await ensureLotSequenceTable(cId);
  try {
    await db.run(
      `UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1 AND last_lot_no < ?`,
      [num, num],
      cId
    );
  } catch (e) {}
}

/**
 * Helper to scan wastage lot columns and return max WST lot number for the current company.
 */
async function getAbsoluteMaxWastageLotNumber(companyId = null) {
  const cId = resolveCompanyId(companyId);
  let maxNum = 0;
  const tables = [
    { name: 'grain_wastage_items', col: 'lot_no' },
    { name: 'stock_lots', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const res = await db.query(
        `SELECT DISTINCT ${t.col} AS lot_no FROM ${t.name} WHERE ${t.col} IS NOT NULL AND ${t.col} != ''`,
        [],
        cId
      );
      if (res && res.rows) {
        for (const row of res.rows) {
          const val = String(row.lot_no || '').trim();
          const match = val.match(/WST[-_]?(?:LOT)?(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    } catch (e) {}
  }

  return maxNum;
}

/**
 * Preview next wastage lot number for the company.
 */
async function previewNextWastageLotNumber(companyId = null) {
  const cId = resolveCompanyId(companyId);
  const maxNum = await getAbsoluteMaxWastageLotNumber(cId);
  const nextNum = maxNum + 1;
  return `WST${String(nextNum).padStart(4, '0')}`;
}

module.exports = {
  ensureLotSequenceTable,
  getAbsoluteMaxLotNumber,
  previewNextLotNumber,
  reserveNextLotNumber,
  recordLotNumber,
  getAbsoluteMaxWastageLotNumber,
  previewNextWastageLotNumber
};
