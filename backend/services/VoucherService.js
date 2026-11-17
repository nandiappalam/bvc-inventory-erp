const db = require('../config/database');
const AccountingEngine = require('./AccountingEngine');
const { getEntriesByVoucher } = require('./LedgerService');

async function ensureVoucherTables() {
  const cId = AccountingEngine.getActiveCompanyId();
  await AccountingEngine.ensureAccountingSchema(db.forCompany(cId));
}

async function generateVoucherNumber(voucherType, companyId = null, date = null) {
  return AccountingEngine.nextVoucherNumber({
    companyId: AccountingEngine.getActiveCompanyId(companyId),
    voucherType: voucherType || 'Journal',
    date,
  });
}

async function createVoucher(params = {}) {
  const companyId = AccountingEngine.getActiveCompanyId(params.companyId || params.company_id);
  const voucherType = params.voucherType || params.voucher_type || 'Journal';
  const date = params.date || params.voucher_date || new Date().toISOString().split('T')[0];
  const referenceNo = params.referenceNo || params.reference_no || '';
  const narration = params.narration || '';
  const entries = params.entries || [];
  const sourceModule = params.sourceModule || params.source_module || null;
  const sourceId = params.sourceId ?? params.source_id ?? null;
  const postingKey = params.postingKey || params.posting_key || null;

  const lines = entries.map((entry) => ({
    ledgerId: entry.ledgerId ?? entry.ledger_id ?? null,
    ledgerName: entry.ledgerName || entry.ledger_name || null,
    groupName: entry.groupName || entry.group_name || null,
    ledgerType: entry.ledgerType || entry.ledger_type || null,
    debit: entry.debit ?? entry.debit_amount ?? 0,
    credit: entry.credit ?? entry.credit_amount ?? 0,
    remarks: entry.remarks || entry.narration || '',
    particulars: entry.particulars || entry.remarks || entry.narration || '',
    referenceId: entry.referenceId ?? entry.reference_id ?? sourceId ?? (referenceNo || null),
    referenceType: entry.referenceType || entry.reference_type || sourceModule || String(voucherType).toLowerCase(),
    transactionId: entry.transactionId ?? entry.transaction_id ?? sourceId ?? (referenceNo || null),
    transactionType: entry.transactionType || entry.transaction_type || sourceModule || String(voucherType).toLowerCase(),
  }));

  return AccountingEngine.postVoucher({
    companyId,
    voucherType,
    prefix: params.prefix || null,
    existingVoucherNo: params.voucherNo || params.voucher_no || null,
    date,
    referenceNo,
    narration,
    sourceModule: sourceModule || AccountingEngine.normalizeVoucherType(voucherType).toLowerCase().replace(/\s+/g, '_'),
    sourceId: sourceId ?? (/^\d+$/.test(String(referenceNo)) ? Number(referenceNo) : null),
    postingKey,
    lines,
    allowUpdate: Boolean(params.allowUpdate),
    status: params.status || 'Approved',
  });
}

async function createPurchaseVoucher({
  companyId = null,
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
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const lines = [];
  const particulars = `Purchase Inv: ${invNo || purchaseId}`;

  if (supplier && Number(netAmount || 0) > 0) {
    lines.push({
      ledgerName: supplier,
      ledgerType: 'Supplier',
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
    lines.push({
      ledgerName: 'Purchase Account',
      ledgerType: 'Expense',
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
    lines.push({
      ledgerName: 'Input Tax',
      ledgerType: 'Tax',
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
    lines.push({
      ledgerName: 'Discount Received',
      ledgerType: 'Income',
      debit: 0,
      credit: Number(discAmount || 0),
      remarks: `Discount on ${particulars}`,
      referenceId: purchaseId,
      referenceType: 'purchase',
      transactionId: purchaseId,
      transactionType: 'purchase',
    });
  }

  return AccountingEngine.postVoucher({
    companyId: cId,
    voucherType: 'Purchase',
    prefix: 'PUR',
    date,
    referenceNo: String(purchaseId || ''),
    narration: narration || `Purchase ${invNo || purchaseId}`,
    sourceModule: 'purchase',
    sourceId: Number(purchaseId),
    postingKey: `purchase:${purchaseId}`,
    lines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function deleteVoucherChain(referenceNo, voucherType = 'Purchase', companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const canonical = AccountingEngine.normalizeVoucherType(voucherType);
  const sourceMod = canonical.toLowerCase().replace(/\s+/g, '_');
  const idNum = /^\d+$/.test(String(referenceNo)) ? Number(referenceNo) : null;
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: sourceMod,
    sourceId: idNum,
    voucherTypes: [voucherType, canonical],
    referenceNo: String(referenceNo),
  });
  return true;
}

async function getVoucherEntries(voucherId, companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await ensureVoucherTables();
  const result = await db.forCompany(cId).query('SELECT * FROM voucher_entry WHERE voucher_id = ? ORDER BY id ASC', [voucherId]);
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
