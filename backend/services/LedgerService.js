const db = require('../config/database');
const AccountingEngine = require('./AccountingEngine');

async function ensureLedgerTables() {
  const cId = AccountingEngine.getActiveCompanyId();
  await AccountingEngine.ensureAccountingSchema(db.forCompany(cId));
}

async function resolveLedgerId(ledgerName, ledgerType = null, companyId = null) {
  if (!ledgerName || typeof ledgerName !== 'string' || !ledgerName.trim()) {
    throw new Error('Ledger name is required to resolve ledger ID.');
  }
  const resolved = await AccountingEngine.resolveOrCreateLedger({
    companyId: companyId || AccountingEngine.getActiveCompanyId(),
    name: ledgerName.trim(),
    ledgerType,
  });
  return resolved.id;
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
  companyId = null,
}) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await ensureLedgerTables();
  const safeLedgerName = String(ledgerName || '').trim();
  if (!safeLedgerName) {
    throw new Error('Ledger name is required for createEntry.');
  }
  const ledgerId = await resolveLedgerId(safeLedgerName, null, cId);

  await db.forCompany(cId).run(`
    INSERT INTO ledger_entries (
      company_id, ledger_id, ledger_name, date, voucher_type, voucher_no, debit, credit,
      reference_id, reference_type, particulars, counterparty_summary, voucher_id, transaction_id, transaction_type
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cId,
    ledgerId,
    safeLedgerName,
    AccountingEngine.normalizeDateIso(date),
    voucherType || 'General',
    voucherNo || '',
    AccountingEngine.round2(debit || 0),
    AccountingEngine.round2(credit || 0),
    referenceId,
    referenceType,
    particulars,
    particulars,
    voucherId,
    transactionId,
    transactionType,
  ]);

  return true;
}

async function deleteEntriesByReference(referenceId, referenceType = null, companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await ensureLedgerTables();
  if (!referenceType) {
    throw new Error('deleteEntriesByReference requires an explicit referenceType for module isolation.');
  }
  await db.forCompany(cId).run(
    `DELETE FROM ledger_entries WHERE reference_id = ? AND LOWER(COALESCE(reference_type, '')) = LOWER(?)`,
    [referenceId, String(referenceType).trim()]
  );
  return true;
}

async function getEntriesByReference(referenceId, referenceType = null, companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await ensureLedgerTables();
  if (referenceType) {
    const result = await db.forCompany(cId).query(
      'SELECT * FROM ledger_entries WHERE reference_id = ? AND LOWER(COALESCE(reference_type, \'\')) = LOWER(?) ORDER BY id ASC',
      [referenceId, String(referenceType).trim()]
    );
    return result.rows;
  }
  const result = await db.forCompany(cId).query('SELECT * FROM ledger_entries WHERE reference_id = ? ORDER BY id ASC', [referenceId]);
  return result.rows;
}

async function getEntriesByVoucher(voucherId, companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await ensureLedgerTables();
  const result = await db.forCompany(cId).query('SELECT * FROM ledger_entries WHERE voucher_id = ? ORDER BY id ASC', [voucherId]);
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
