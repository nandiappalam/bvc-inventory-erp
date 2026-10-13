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
  const prefix = prefixMap[normalized] || 'VOC';

  const countResult = await db.query('SELECT COUNT(*) as cnt FROM voucher');
  let nextNum = (countResult.rows?.[0]?.cnt || 0) + 1;

  while (true) {
    const candidate = `${prefix}${String(nextNum).padStart(5, '0')}`;
    const check = await db.query('SELECT id FROM voucher WHERE voucher_no = ? LIMIT 1', [candidate]);
    if (!check.rows || check.rows.length === 0) {
      return candidate;
    }
    nextNum++;
  }
}

async function createVoucher(params = {}) {
  await ensureVoucherTables();
  const voucherType = params.voucherType || params.voucher_type || 'Journal';
  const voucherNo = params.voucherNo || params.voucher_no || await generateVoucherNumber(voucherType);
  const date = params.date || params.voucher_date || new Date().toISOString().split('T')[0];
  const referenceNo = params.referenceNo || params.reference_no || '';
  const narration = params.narration || '';
  const entries = params.entries || [];

  const voucherNumber = voucherNo;
  const voucherResult = await db.run(
    'INSERT INTO voucher (voucher_type, voucher_no, date, reference_no, narration) VALUES (?, ?, ?, ?, ?)',
    [voucherType, voucherNumber, date, referenceNo, narration]
  );
  const voucherId = voucherResult.lastInsertRowid;

  for (const entry of entries) {
    const columns = await getTableColumns('voucher_entry');
    const debitVal = Number(entry.debit ?? entry.debit_amount ?? 0);
    const creditVal = Number(entry.credit ?? entry.credit_amount ?? 0);
    const remarksVal = entry.remarks || entry.narration || '';

    let ledgerName = entry.ledgerName || entry.ledger_name;
    const resolvedLedgerId = entry.ledgerId ?? entry.ledger_id ?? (ledgerName ? await resolveLedgerId(ledgerName) : 0);
    const safeLedgerId = resolvedLedgerId ?? 0;

    if (!ledgerName && safeLedgerId > 0) {
      try {
        const lmRes = await db.query('SELECT name FROM ledgermaster WHERE id = ?', [safeLedgerId]);
        if (lmRes.rows && lmRes.rows.length > 0) ledgerName = lmRes.rows[0].name;
      } catch (e) {}
    }
    if (!ledgerName) ledgerName = 'General Ledger';

    if (columns.has('ledger_name')) {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, ledger_name, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [voucherId, entry.type || (debitVal > 0 ? 'Dr' : 'Cr'), safeLedgerId, ledgerName, debitVal, creditVal, remarksVal]
      );
    } else {
      await db.run(
        'INSERT INTO voucher_entry (voucher_id, type, ledger_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?, ?)',
        [voucherId, entry.type || (debitVal > 0 ? 'Dr' : 'Cr'), safeLedgerId, debitVal, creditVal, remarksVal]
      );
    }

    await createEntry({
      ledgerName,
      date,
      voucherType,
      voucherNo: voucherNumber,
      debit: debitVal,
      credit: creditVal,
      referenceId: entry.referenceId || referenceNo,
      referenceType: entry.referenceType || 'transaction',
      particulars: entry.particulars || remarksVal,
      voucherId,
      transactionId: entry.transactionId || referenceNo,
      transactionType: entry.transactionType || 'transaction',
    });
  }

  return { id: voucherId, voucherId, voucherNo: voucherNumber, voucher_no: voucherNumber, voucherType };
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
