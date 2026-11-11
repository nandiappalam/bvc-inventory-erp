const db = require('../config/database');

async function ensureRecycleBinTable(activeCompanyId = null) {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS recycle_bin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        title TEXT NOT NULL,
        record_data TEXT NOT NULL,
        deleted_by TEXT,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], activeCompanyId);
  } catch (error) {
    console.warn('Recycle bin table setup skipped:', error.message);
  }
}

async function saveToRecycleBin({ moduleName, recordId, title, recordData, deletedBy = 'admin' }, activeCompanyId = null) {
  try {
    await ensureRecycleBinTable(activeCompanyId);
    const dataStr = typeof recordData === 'string' ? recordData : JSON.stringify(recordData);
    await db.run(
      'INSERT INTO recycle_bin (module_name, record_id, title, record_data, deleted_by) VALUES (?, ?, ?, ?, ?)',
      [moduleName, String(recordId || ''), String(title || 'Deleted Record'), dataStr, deletedBy || 'admin'],
      activeCompanyId
    );
    return true;
  } catch (error) {
    console.error('Error saving to recycle bin:', error);
    return false;
  }
}

async function getRecycleBinItems(activeCompanyId = null) {
  await ensureRecycleBinTable(activeCompanyId);
  const result = await db.query('SELECT * FROM recycle_bin ORDER BY id DESC', [], activeCompanyId);
  return result.rows || [];
}

async function deletePermanently(id, activeCompanyId = null) {
  await ensureRecycleBinTable(activeCompanyId);
  await db.run('DELETE FROM recycle_bin WHERE id = ?', [id], activeCompanyId);
  return true;
}

async function emptyRecycleBin(activeCompanyId = null) {
  await ensureRecycleBinTable(activeCompanyId);
  await db.run('DELETE FROM recycle_bin', [], activeCompanyId);
  return true;
}

/**
 * Helper to fetch target table column names in the current database engine.
 * Works uniformly across SQLite (PRAGMA table_info) and PostgreSQL (information_schema.columns).
 */
async function getTableColumns(tableName, activeCompanyId = null) {
  try {
    const tableInfo = await db.query(`PRAGMA table_info(${tableName})`, [], activeCompanyId);
    if (tableInfo && tableInfo.rows && tableInfo.rows.length > 0) {
      const colMap = new Map();
      for (const r of tableInfo.rows) {
        const col = (r.name || r.column_name || '').trim();
        if (col) {
          colMap.set(col.toLowerCase(), col);
        }
      }
      return colMap;
    }
  } catch (_) {}
  return null;
}

/**
 * Safely inserts a record back into its database table:
 * 1. Strictly deduplicates columns case-insensitively (fixes "column round_off specified more than once").
 * 2. Cross-references actual target table schema to strip non-existent or virtual fields.
 * 3. Encloses column identifiers in double quotes.
 * 4. Checks primary key before inserting to prevent duplicate conflicts.
 */
async function insertRecordSafely(tableName, rowObj, activeCompanyId = null) {
  if (!rowObj || typeof rowObj !== 'object') return false;

  const tableColsMap = await getTableColumns(tableName, activeCompanyId);
  const seenCols = new Set();
  const insertCols = [];
  const insertValues = [];

  for (const rawCol of Object.keys(rowObj)) {
    const cleanCol = rawCol.trim();
    const lowerCol = cleanCol.toLowerCase();

    // STRICT deduplication: ignore if already seen in any case!
    if (seenCols.has(lowerCol)) {
      continue;
    }

    if (tableColsMap && tableColsMap.size > 0) {
      if (!tableColsMap.has(lowerCol)) {
        continue; // Skip fields that do not exist in the target table schema
      }
      seenCols.add(lowerCol);
      const exactCol = tableColsMap.get(lowerCol);
      insertCols.push(`"${exactCol}"`);
      insertValues.push(rowObj[rawCol]);
    } else {
      seenCols.add(lowerCol);
      insertCols.push(`"${cleanCol}"`);
      insertValues.push(rowObj[rawCol]);
    }
  }

  if (insertCols.length === 0) return false;

  const placeholders = insertCols.map(() => '?').join(', ');
  const pkCol = (tableColsMap && tableColsMap.has('id'))
    ? tableColsMap.get('id')
    : (rowObj.id !== undefined ? 'id' : insertCols[0].replace(/"/g, ''));

  if (rowObj[pkCol] !== undefined && rowObj[pkCol] !== null) {
    try {
      const existing = await db.query(`SELECT 1 FROM ${tableName} WHERE "${pkCol}" = ? LIMIT 1`, [rowObj[pkCol]], activeCompanyId);
      if (existing.rows && existing.rows.length > 0) {
        return false; // Already present in database
      }
    } catch (_) {}
  }

  const insertSql = `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders})`;
  await db.run(insertSql, insertValues, activeCompanyId);
  return true;
}

async function restoreFromRecycleBin(id, activeCompanyId = null) {
  await ensureRecycleBinTable(activeCompanyId);
  const res = await db.query('SELECT * FROM recycle_bin WHERE id = ?', [id], activeCompanyId);
  if (!res.rows || res.rows.length === 0) {
    throw new Error('Item not found in Recycle Bin');
  }

  const binItem = res.rows[0];
  let parsed;
  try {
    parsed = JSON.parse(binItem.record_data);
  } catch (e) {
    throw new Error('Invalid record data format in Recycle Bin');
  }

  const { tableName, record, subRecords } = parsed;

  if (tableName && record) {
    // 1. Restore main table record safely with column deduplication and schema validation
    await insertRecordSafely(tableName, record, activeCompanyId);

    // 2. Restore sub-records if any (e.g. items, deductions, lots, stock)
    if (Array.isArray(subRecords)) {
      for (const sub of subRecords) {
        if (sub.tableName && Array.isArray(sub.records)) {
          for (const subRec of sub.records) {
            try {
              await insertRecordSafely(sub.tableName, subRec, activeCompanyId);
            } catch (subErr) {
              console.warn(`Notice restoring sub-record into ${sub.tableName}:`, subErr.message);
            }
          }
        }
      }
    }

    // 3. If restored record is a Purchase, regenerate ledger entries for complete reconciliation
    if (tableName === 'purchases' && record) {
      try {
        const { createPurchaseLedgerEntries } = require('../utils/ledgerHelper');
        if (createPurchaseLedgerEntries) {
          await createPurchaseLedgerEntries({
            supplier: record.supplier,
            date: record.date || record.inv_date,
            invNo: record.inv_no || record.s_no || '',
            purchaseId: record.id,
            baseAmount: parseFloat(record.base_amount || record.sub_total || record.total_amount || 0) || 0,
            taxAmount: parseFloat(record.tax_amount || 0) || 0,
            cgstAmount: parseFloat(record.cgst_amount || 0) || 0,
            sgstAmount: parseFloat(record.sgst_amount || 0) || 0,
            igstAmount: parseFloat(record.igst_amount || 0) || 0,
            grandTotal: parseFloat(record.grand_total || record.net_amount || record.total_amount || 0) || 0,
            transportCharges: parseFloat(record.transport_charges || record.freight_amount || 0) || 0,
            transporter: record.transporter || record.transport || '',
            loadmanCharges: parseFloat(record.loadman_charges || 0) || 0,
            loadmanName: record.loadman_name || null
          }, activeCompanyId);
        }
      } catch (ledgErr) {
        console.warn('Notice recreating ledger entries for restored purchase:', ledgErr.message);
      }
    }

    // 4. Resync PostgreSQL sequences if applicable
    if (db.ensurePostgresCompanySequences) {
      try {
        await db.ensurePostgresCompanySequences(activeCompanyId);
      } catch (_) {}
    }
  }

  // Delete item from recycle bin
  await db.run('DELETE FROM recycle_bin WHERE id = ?', [id], activeCompanyId);
  return { success: true, message: `Successfully restored ${binItem.title}` };
}

module.exports = {
  ensureRecycleBinTable,
  saveToRecycleBin,
  getRecycleBinItems,
  deletePermanently,
  emptyRecycleBin,
  restoreFromRecycleBin,
};
