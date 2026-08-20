const db = require('../config/database');

async function getTableColumns(tableName) {
  try {
    const result = await db.query(`PRAGMA table_info(${tableName})`);
    return new Set((result.rows || []).map((row) => row.name));
  } catch (error) {
    return new Set();
  }
}

async function ensureLedgerTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledgermaster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);
  } catch (error) {
    console.warn('Ledger master table setup skipped:', error.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER,
        ledger_name TEXT NOT NULL,
        date DATE NOT NULL,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        reference_id INTEGER,
        reference_type TEXT,
        particulars TEXT,
        voucher_id INTEGER,
        transaction_id INTEGER,
        transaction_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
      )
    `);
  } catch (error) {
    console.warn('Ledger entries table setup skipped:', error.message);
  }

  try {
    const columns = await getTableColumns('ledger_entries');
    if (!columns.has('reference_type')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN reference_type TEXT');
    }
    if (!columns.has('voucher_id')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN voucher_id INTEGER');
    }
    if (!columns.has('transaction_id')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN transaction_id INTEGER');
    }
    if (!columns.has('transaction_type')) {
      await db.run('ALTER TABLE ledger_entries ADD COLUMN transaction_type TEXT');
    }
  } catch (error) {
    console.warn('Ledger entries column migration skipped:', error.message);
  }
}

async function resolveLedgerId(ledgerName) {
  if (!ledgerName) return null;

  try {
    await ensureLedgerTables();
    const existing = await db.query('SELECT id FROM ledgermaster WHERE name = ? LIMIT 1', [ledgerName]);
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const columns = await getTableColumns('ledgermaster');
    let insertSql = 'INSERT INTO ledgermaster (name) VALUES (?)';
    let insertParams = [ledgerName];

    if (columns.has('print_name') && columns.has('status')) {
      insertSql = 'INSERT INTO ledgermaster (name, print_name, status) VALUES (?, ?, ?)';
      insertParams = [ledgerName, ledgerName, 'Active'];
    } else if (columns.has('print_name')) {
      insertSql = 'INSERT INTO ledgermaster (name, print_name) VALUES (?, ?)';
      insertParams = [ledgerName, ledgerName];
    } else if (columns.has('status')) {
      insertSql = 'INSERT INTO ledgermaster (name, status) VALUES (?, ?)';
      insertParams = [ledgerName, 'Active'];
    }

    const insertResult = await db.run(insertSql, insertParams);
    return insertResult.lastInsertRowid;
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('UNIQUE constraint failed') || message.includes('already exists')) {
      const fallback = await db.query('SELECT id FROM ledgermaster WHERE name = ? LIMIT 1', [ledgerName]);
      return fallback.rows[0]?.id || null;
    }
    console.warn('Ledger lookup skipped:', error.message);
    return null;
  }
}

async function createEntry({
  ledgerName,
  date,
  voucherType,
  voucherNo,
  debit = 0,
  credit = 0,
  referenceId = null,
  referenceType = null,
  particulars = '',
  voucherId = null,
  transactionId = null,
  transactionType = null,
}) {
  await ensureLedgerTables();
  const ledgerId = await resolveLedgerId(ledgerName);

  await db.run(`
    INSERT INTO ledger_entries (
      ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
      reference_id, reference_type, particulars, voucher_id, transaction_id, transaction_type
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    ledgerId,
    ledgerName,
    date,
    voucherType,
    voucherNo,
    debit,
    credit,
    referenceId,
    referenceType,
    particulars,
    voucherId,
    transactionId,
    transactionType,
  ]);

  return true;
}

async function deleteEntriesByReference(referenceId, referenceType = null) {
  await ensureLedgerTables();
  if (referenceType) {
    await db.run('DELETE FROM ledger_entries WHERE reference_id = ? AND reference_type = ?', [referenceId, referenceType]);
  } else {
    await db.run('DELETE FROM ledger_entries WHERE reference_id = ?', [referenceId]);
  }
  return true;
}

async function getEntriesByReference(referenceId, referenceType = null) {
  await ensureLedgerTables();
  if (referenceType) {
    const result = await db.query('SELECT * FROM ledger_entries WHERE reference_id = ? AND reference_type = ? ORDER BY id ASC', [referenceId, referenceType]);
    return result.rows;
  }
  const result = await db.query('SELECT * FROM ledger_entries WHERE reference_id = ? ORDER BY id ASC', [referenceId]);
  return result.rows;
}

async function getEntriesByVoucher(voucherId) {
  await ensureLedgerTables();
  const result = await db.query('SELECT * FROM ledger_entries WHERE voucher_id = ? ORDER BY id ASC', [voucherId]);
  return result.rows;
}

module.exports = {
  ensureLedgerTables,
  resolveLedgerId,
  createEntry,
  deleteEntriesByReference,
  getEntriesByReference,
  getEntriesByVoucher,
};
