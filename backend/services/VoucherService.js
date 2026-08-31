const db = require('../config/database');
const { createEntry, deleteEntriesByReference, getEntriesByVoucher, resolveLedgerId } = require('./LedgerService');

async function getTableColumns(tableName) {
  try {
    const result = await db.query(`PRAGMA table_info(${tableName})`);
    return new Set((result.rows || []).map((row) => row.name));
  } catch (error) {
    return new Set();
  }
}

async function ensureVoucherTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_type TEXT NOT NULL,
        voucher_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        reference_no TEXT,
        narration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.warn('Voucher table setup skipped:', error.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS voucher_entry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        ledger_id INTEGER,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE
      )
    `);
  } catch (error) {
    console.warn('Voucher entry table setup skipped:', error.message);
  }

  try {
    const columns = await getTableColumns('voucher_entry');
    if (!columns.has('ledger_name')) {
      await db.run('CREATE INDEX IF NOT EXISTS idx_voucher_entry_voucher_id ON voucher_entry(voucher_id)');
    }
  } catch (error) {
    console.warn('Voucher index setup skipped:', error.message);
  }
}

async function generateVoucherNumber(voucherType) {
  await ensureVoucherTables();
  const normalized = String(voucherType || '').toUpperCase();
  const prefixMap = {
    PURCHASE: 'PUR',
    SALES: 'SAL',
    ADVANCE: 'ADV',
    PAYMENT: 'PAY',
    RECEIPT: 'REC',
    JOURNAL: 'JNL',
    CONTRA: 'CON',
  };
  const prefix = prefixMap[normalized] || normalized || 'VOC';

  const result = await db.query('SELECT voucher_no FROM voucher WHERE voucher_type = ? ORDER BY id DESC LIMIT 1', [normalized === 'PURCHASE' ? 'Purchase' : voucherType]);
  if (result.rows.length > 0) {
    const voucherNo = String(result.rows[0].voucher_no || '');
    const match = voucherNo.match(new RegExp(`${prefix}(\\d+)$`, 'i'));
    const lastNo = match ? parseInt(match[1], 10) : 0;
    return `${prefix}${String(lastNo + 1).padStart(5, '0')}`;
  }
  return `${prefix}00001`;
}

async function createVoucher({
  voucherType,
  voucherNo,
  date,
  referenceNo,
  narration,
  entries = [],
}) {
  await ensureVoucherTables();
  const voucherNumber = voucherNo || await generateVoucherNumber(voucherType);
  const voucherResult = await db.run(
    'INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration) VALUES (?, ?, ?, ?, ?)',
    [voucherType, voucherNumber, date, referenceNo, narration]
  );
  const voucherId = voucherResult.lastInsertRowid;

  for (const entry of entries) {
    const columns = await getTableColumns('voucher_entry');
    const ledgerName = entry.ledgerName || entry.ledger_name;
    const resolvedLedgerId = entry.ledgerId ?? (ledgerName ? await resolveLedgerId(ledgerName) : 0);
    const safeLedgerId = resolvedLedgerId ?? 0;

    if (columns.has('ledger_name')) {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [voucherId, entry.type || 'Ledger', safeLedgerId, ledgerName || '', entry.debit || 0, entry.credit || 0, entry.remarks || '']
      );
    } else {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [voucherId, entry.type || 'Ledger', safeLedgerId, entry.debit || 0, entry.credit || 0, entry.remarks || '']
      );
    }

    if (ledgerName) {
      await createEntry({
        ledgerName,
        date,
        voucherType,
        voucherNo: voucherNumber,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        referenceId: entry.referenceId || referenceNo,
        referenceType: entry.referenceType || 'transaction',
        particulars: entry.particulars || entry.remarks || '',
        voucherId,
        transactionId: entry.transactionId || referenceNo,
        transactionType: entry.transactionType || 'transaction',
      });
    }
  }

  return { voucherId, voucherNo: voucherNumber, voucherType };
}

async function createPurchaseVoucher({
  purchaseId,
  supplier,
  date,
  invNo,
  baseAmount = 0,
  taxAmount = 0,
  discAmount = 0,
  netAmount = 0,
  narration = '',
}) {
  const voucherNo = await generateVoucherNumber('Purchase');
  const entries = [];
  const particulars = `Purchase Inv: ${invNo || purchaseId}`;

  if (supplier) {
    entries.push({
      ledgerName: supplier,
      debit: 0,
      credit: Number(netAmount || 0),
      remarks: particulars,
      referenceId: purchaseId,
      referenceType: 'purchase',
      transactionId: purchaseId,
      transactionType: 'purchase',
    });
  }

  if (Number(baseAmount || 0) > 0) {
    entries.push({
      ledgerName: 'Purchase Account',
      debit: Number(baseAmount || 0),
      credit: 0,
      remarks: particulars,
      referenceId: purchaseId,
      referenceType: 'purchase',
      transactionId: purchaseId,
      transactionType: 'purchase',
    });
  }

  if (Number(taxAmount || 0) > 0) {
    entries.push({
      ledgerName: 'Input Tax',
      debit: Number(taxAmount || 0),
      credit: 0,
      remarks: `Tax on ${particulars}`,
      referenceId: purchaseId,
      referenceType: 'purchase',
      transactionId: purchaseId,
      transactionType: 'purchase',
    });
  }

  if (Number(discAmount || 0) > 0) {
    entries.push({
      ledgerName: 'Discount Received',
      debit: 0,
      credit: Number(discAmount || 0),
      remarks: `Discount on ${particulars}`,
      referenceId: purchaseId,
      referenceType: 'purchase',
      transactionId: purchaseId,
      transactionType: 'purchase',
    });
  }

  return createVoucher({
    voucherType: 'Purchase',
    voucherNo,
    date,
    referenceNo: String(purchaseId || ''),
    narration: narration || `Purchase ${invNo || purchaseId}`,
    entries,
  });
}

async function deleteVoucherChain(referenceNo, voucherType = 'Purchase') {
  await ensureVoucherTables();
  const vouchers = await db.query('SELECT id, voucher_no FROM voucher WHERE reference_no = ? AND voucher_type = ? ORDER BY id DESC', [String(referenceNo), voucherType]);

  for (const voucher of vouchers.rows || []) {
    await db.run('DELETE FROM voucher_entry WHERE voucher_id = ?', [voucher.id]);
    await deleteEntriesByReference(referenceNo, 'purchase');
    await db.run('DELETE FROM voucher WHERE id = ?', [voucher.id]);
  }

  return true;
}

async function getVoucherEntries(voucherId) {
  await ensureVoucherTables();
  const result = await db.query('SELECT * FROM voucher_entry WHERE voucher_id = ? ORDER BY id ASC', [voucherId]);
  return result.rows;
}

module.exports = {
  ensureVoucherTables,
  generateVoucherNumber,
  createVoucher,
  createPurchaseVoucher,
  deleteVoucherChain,
  getVoucherEntries,
  getEntriesByVoucher,
};
