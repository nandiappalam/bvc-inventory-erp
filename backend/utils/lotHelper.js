const db = require('../config/database');

/**
 * Ensures the lot_sequence table exists in the current database context.
 */
async function ensureLotSequenceTable() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS lot_sequence (
        id INTEGER PRIMARY KEY,
        last_lot_no INTEGER NOT NULL
      )
    `);
    await db.run(`
      INSERT OR IGNORE INTO lot_sequence (id, last_lot_no)
      VALUES (1, 0)
    `);
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Helper to scan all lot columns across all ERP tables and find the absolute maximum numeric lot number.
 * Compatible with PostgreSQL (Render/Cloud) and SQLite (Local).
 */
async function getAbsoluteMaxLotNumber() {
  await ensureLotSequenceTable();

  let maxNum = 0;
  const tables = [
    { name: 'stock_lots', col: 'lot_no' },
    { name: 'purchase_items', col: 'lot_no' },
    { name: 'grain_input_items', col: 'lot_no' },
    { name: 'grain_output_items', col: 'lot_no' },
    { name: 'grain_wastage_items', col: 'lot_no' },
    { name: 'flour_out_items', col: 'lot_no' },
    { name: 'flour_out_return_items', col: 'lot_no' },
    { name: 'purchase_return_items', col: 'lot_no' },
    { name: 'packing_items', col: 'lot_no' },
    { name: 'open_items', col: 'lot_no' },
    { name: 'item_transfers', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const res = await db.query(`SELECT ${t.col} AS lot_no FROM ${t.name} WHERE ${t.col} IS NOT NULL AND ${t.col} != ''`);
      if (res && res.rows && res.rows.length > 0) {
        for (const row of res.rows) {
          const val = String(row.lot_no || '').trim();
          if (!val) continue;
          // Match standard LOT0001, LOT-0001, LOT_1, or any pure numeric string
          const match = val.match(/LOT[-_]?(\d+)/i) || val.match(/^(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    } catch (e) {
      // Table might not exist yet or column missing - gracefully continue
    }
  }

  // Also inspect lot_sequence table
  try {
    const seqRes = await db.query(`SELECT last_lot_no FROM lot_sequence WHERE id = 1`);
    if (seqRes && seqRes.rows && seqRes.rows.length > 0) {
      const seqVal = parseInt(seqRes.rows[0].last_lot_no, 10);
      if (!isNaN(seqVal) && seqVal > maxNum) {
        maxNum = seqVal;
      }
    }
  } catch (e) {}

  return maxNum;
}

/**
 * Preview the next LOT number without incrementing lot_sequence (read-only).
 */
async function previewNextLotNumber() {
  const maxNum = await getAbsoluteMaxLotNumber();
  const nextNum = maxNum + 1;
  return `LOT${String(nextNum).padStart(4, '0')}`;
}

/**
 * Reserve and consume the next LOT number (increments sequence).
 */
async function reserveNextLotNumber() {
  await ensureLotSequenceTable();
  const maxNum = await getAbsoluteMaxLotNumber();
  const nextNum = maxNum + 1;

  try {
    await db.run(
      `UPDATE lot_sequence SET last_lot_no = ? WHERE id = 1`,
      [nextNum]
    );
  } catch (e) {}

  return `LOT${String(nextNum).padStart(4, '0')}`;
}

/**
 * Helper to scan wastage lot columns and return max WST lot number.
 */
async function getAbsoluteMaxWastageLotNumber() {
  let maxNum = 0;
  const tables = [
    { name: 'grain_wastage_items', col: 'lot_no' },
    { name: 'stock_lots', col: 'lot_no' }
  ];

  for (const t of tables) {
    try {
      const res = await db.query(`SELECT ${t.col} AS lot_no FROM ${t.name} WHERE ${t.col} IS NOT NULL AND ${t.col} != ''`);
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
 * Preview next wastage lot number.
 */
async function previewNextWastageLotNumber() {
  const maxNum = await getAbsoluteMaxWastageLotNumber();
  const nextNum = maxNum + 1;
  return `WST${String(nextNum).padStart(4, '0')}`;
}

module.exports = {
  ensureLotSequenceTable,
  getAbsoluteMaxLotNumber,
  previewNextLotNumber,
  reserveNextLotNumber,
  getAbsoluteMaxWastageLotNumber,
  previewNextWastageLotNumber
};
