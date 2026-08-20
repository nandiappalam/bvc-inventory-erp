const db = require('../config/database');

async function ensureRecycleBinTable() {
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
    `);
  } catch (error) {
    console.warn('Recycle bin table setup skipped:', error.message);
  }
}

async function saveToRecycleBin({ moduleName, recordId, title, recordData, deletedBy = 'admin' }) {
  try {
    await ensureRecycleBinTable();
    const dataStr = typeof recordData === 'string' ? recordData : JSON.stringify(recordData);
    await db.run(
      'INSERT INTO recycle_bin (module_name, record_id, title, record_data, deleted_by) VALUES (?, ?, ?, ?, ?)',
      [moduleName, String(recordId || ''), String(title || 'Deleted Record'), dataStr, deletedBy || 'admin']
    );
    return true;
  } catch (error) {
    console.error('Error saving to recycle bin:', error);
    return false;
  }
}

async function getRecycleBinItems() {
  await ensureRecycleBinTable();
  const result = await db.query('SELECT * FROM recycle_bin ORDER BY id DESC');
  return result.rows || [];
}

async function deletePermanently(id) {
  await ensureRecycleBinTable();
  await db.run('DELETE FROM recycle_bin WHERE id = ?', [id]);
  return true;
}

async function emptyRecycleBin() {
  await ensureRecycleBinTable();
  await db.run('DELETE FROM recycle_bin');
  return true;
}

async function restoreFromRecycleBin(id) {
  await ensureRecycleBinTable();
  const res = await db.query('SELECT * FROM recycle_bin WHERE id = ?', [id]);
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
    // 1. Restore main table record
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => record[col]);

    const primaryKeyCol = columns.includes('id') ? 'id' : columns[0];
    const existing = await db.query(`SELECT * FROM ${tableName} WHERE ${primaryKeyCol} = ?`, [record[primaryKeyCol]]);

    if (!existing.rows || existing.rows.length === 0) {
      const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      await db.run(insertSql, values);
    }

    // 2. Restore sub-records if any
    if (Array.isArray(subRecords)) {
      for (const sub of subRecords) {
        if (sub.tableName && Array.isArray(sub.records)) {
          for (const subRec of sub.records) {
            const subCols = Object.keys(subRec);
            const subPlaceholders = subCols.map(() => '?').join(', ');
            const subValues = subCols.map(col => subRec[col]);

            const subPk = subCols.includes('id') ? 'id' : subCols[0];
            const subExist = await db.query(`SELECT * FROM ${sub.tableName} WHERE ${subPk} = ?`, [subRec[subPk]]);

            if (!subExist.rows || subExist.rows.length === 0) {
              const subInsertSql = `INSERT INTO ${sub.tableName} (${subCols.join(', ')}) VALUES (${subPlaceholders})`;
              await db.run(subInsertSql, subValues);
            }
          }
        }
      }
    }
  }

  // Delete item from recycle bin
  await db.run('DELETE FROM recycle_bin WHERE id = ?', [id]);
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
