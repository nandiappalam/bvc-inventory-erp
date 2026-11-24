/**
 * Ledger Entry Helper Module
 * Authoritative double-entry wrapper delegating all numbering, validation,
 * ledger resolution, idempotent posting, and scoped deletion to AccountingEngine.
 */

const db = require('../config/database');
const AccountingEngine = require('../services/AccountingEngine');
const LedgerService = require('../services/LedgerService');

const { toPaise, fromPaise, round2 } = AccountingEngine;

function sanitizeDate(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === 'null' || s === 'undefined') return null;
  return AccountingEngine.normalizeDateIso(s);
}

async function ensureVoucherTables(companyId = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await AccountingEngine.ensureAccountingSchema(db.forCompany(cId));
}

async function getNextVoucherNumber(prefix, companyId = null, date = null) {
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const raw = String(prefix || 'Journal').trim();
  const upper = raw.toUpperCase();
  const map = {
    PUR: 'Purchase',
    PURCHASE: 'Purchase',
    SAL: 'Sales',
    SALES: 'Sales',
    DN: 'Debit Note',
    PR: 'Debit Note',
    'DEBIT NOTE': 'Debit Note',
    'PURCHASE RETURN': 'Debit Note',
    PURCHASE_RETURN: 'Debit Note',
    CN: 'Credit Note',
    SR: 'Credit Note',
    'CREDIT NOTE': 'Credit Note',
    'SALES RETURN': 'Credit Note',
    SALES_RETURN: 'Credit Note',
    ADV: 'Advance',
    ADVANCE: 'Advance',
    PAY: 'Payment',
    PAYMENT: 'Payment',
    REC: 'Receipt',
    RECEIPT: 'Receipt',
    CON: 'Contra',
    CONTRA: 'Contra',
    JNL: 'Journal',
    JOURNAL: 'Journal',
    OPC: 'Operational Charge',
    CSB: 'Cold Storage Bill',
  };
  const voucherType = map[upper] || raw;
  return AccountingEngine.nextVoucherNumber({ companyId: cId, voucherType, date });
}

async function getPartyName(partyVal, preferredType = null, companyId = null) {
  if (partyVal === null || partyVal === undefined || partyVal === '') return null;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const runner = db.forCompany(cId);

  if (!isNaN(partyVal) && /^\d+$/.test(String(partyVal).trim())) {
    const id = parseInt(String(partyVal).trim(), 10);
    const type = preferredType ? preferredType.toLowerCase() : null;

    const lookups = [];
    if (type === 'supplier') {
      lookups.push({ sql: 'SELECT COALESCE(NULLIF(TRIM(print_name), \'\'), name) AS resolved FROM supplier_master WHERE id = ?', params: [id] });
    } else if (type === 'customer') {
      lookups.push({ sql: 'SELECT COALESCE(NULLIF(TRIM(print_name), \'\'), name) AS resolved FROM customer_master WHERE id = ?', params: [id] });
    } else if (type === 'papad_company' || type === 'papad company') {
      lookups.push({ sql: 'SELECT name AS resolved FROM papad_company_master WHERE id = ?', params: [id] });
    } else if (type === 'flour_mill' || type === 'flour mill') {
      lookups.push({ sql: 'SELECT flourmill AS resolved FROM flour_mill_master WHERE id = ?', params: [id] });
    } else if (type === 'transporter' || type === 'transport') {
      lookups.push({ sql: 'SELECT COALESCE(NULLIF(TRIM(print_name), \'\'), name) AS resolved FROM transport_master WHERE id = ?', params: [id] });
    } else if (type === 'worker' || type === 'loadman') {
      lookups.push({ sql: 'SELECT name AS resolved FROM person_master WHERE id = ?', params: [id] });
      lookups.push({ sql: 'SELECT name AS resolved FROM operational_parties WHERE id = ?', params: [id] });
    }

    // Fallback cascade if preferred type omitted or not found
    lookups.push(
      { sql: 'SELECT COALESCE(NULLIF(TRIM(print_name), \'\'), name) AS resolved FROM supplier_master WHERE id = ?', params: [id] },
      { sql: 'SELECT COALESCE(NULLIF(TRIM(print_name), \'\'), name) AS resolved FROM customer_master WHERE id = ?', params: [id] },
      { sql: 'SELECT name AS resolved FROM papad_company_master WHERE id = ?', params: [id] },
      { sql: 'SELECT flourmill AS resolved FROM flour_mill_master WHERE id = ?', params: [id] }
    );

    for (const q of lookups) {
      try {
        const res = await runner.query(q.sql, q.params);
        if (res.rows && res.rows[0]?.resolved) {
          return String(res.rows[0].resolved).trim();
        }
      } catch (_) {}
    }
  }
  return String(partyVal).trim();
}

async function resolveLedgerId(ledgerName, ledgerType = null, companyId = null) {
  if (!ledgerName || !String(ledgerName).trim()) {
    throw new Error('Ledger name is required to resolve ledger ID.');
  }
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const resolved = await AccountingEngine.resolveOrCreateLedger({
    companyId: cId,
    name: String(ledgerName).trim(),
    ledgerType,
  });
  return resolved.id;
}

async function createLedgerEntry(params = {}) {
  return LedgerService.createEntry(params);
}

/**
 * Compute balanced double-entry lines for Purchase and post atomically via AccountingEngine.
 */
async function createPurchaseVoucherChain(purchaseData) {
  const cId = AccountingEngine.getActiveCompanyId(purchaseData.companyId);
  const {
    conn = null,
    supplier,
    date,
    invNo,
    purchaseId,
    baseAmount = 0,
    taxAmount = 0,
    discAmount = 0,
    netAmount = 0,
    narration = '',
    deductions = [],
    roundOff = 0,
    vatAmount = 0,
    mamoolAmount = 0,
    weightCashAmount = 0,
    otherAdditionalCharges = 0,
    otherDeductions = 0,
    existingVoucherNo: passedVoucherNo = null,
  } = purchaseData;

  const resolvedSupplier = await getPartyName(supplier, 'supplier', cId);
  if (!resolvedSupplier) {
    throw new Error('Purchase voucher requires a valid Supplier ledger.');
  }

  const voucherDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invLabel = invNo || purchaseId;

  let cgstPaise = toPaise(purchaseData.cgstAmount || 0);
  let sgstPaise = toPaise(purchaseData.sgstAmount || 0);
  let igstPaise = toPaise(purchaseData.igstAmount || 0);
  const totalTaxPaise = toPaise(taxAmount || 0);
  if (cgstPaise === 0 && sgstPaise === 0 && igstPaise === 0 && totalTaxPaise > 0) {
    if (purchaseData.isInterstate || purchaseData.isInterState) {
      igstPaise = totalTaxPaise;
    } else {
      cgstPaise = Math.round(totalTaxPaise / 2);
      sgstPaise = totalTaxPaise - cgstPaise;
    }
  }
  const effectiveTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const vatPaise = toPaise(vatAmount || 0);
  const discPaise = toPaise(discAmount || 0);

  let basePaise = toPaise(baseAmount || 0);
  if (basePaise === 0 && toPaise(netAmount) > 0) {
    basePaise = Math.max(0, toPaise(netAmount) - effectiveTaxPaise - vatPaise + discPaise);
  }

  const transportPaise = toPaise(purchaseData.transportCharges || purchaseData.freightAmount || purchaseData.transport_charges || 0);
  const rawTransporter = purchaseData.transporter || purchaseData.transporterName || purchaseData.transport || '';
  const transporterName = await getPartyName(rawTransporter, 'transporter', cId);
  const transportPayableType = String(purchaseData.transportPayableType || purchaseData.transport_payable_type || 'SEPARATE').toUpperCase();

  const loadmanPaise = toPaise(purchaseData.loadmanCharges || purchaseData.loadman_charges || 0);
  const rawLoadman = purchaseData.loadmanName || purchaseData.loadman_name || '';
  const loadmanName = await getPartyName(rawLoadman, 'worker', cId);
  const loadmanPayableType = String(purchaseData.loadmanPayableType || purchaseData.loadman_payable_type || 'SEPARATE').toUpperCase();

  const mamoolPaise = toPaise(mamoolAmount);
  const weightCashPaise = toPaise(weightCashAmount);
  const otherAddPaise = toPaise(otherAdditionalCharges);
  const otherDedPaise = toPaise(otherDeductions);
  let roundOffPaise = toPaise(roundOff);

  const lines = [];
  const baseRemarks = `Purchase #${invLabel} - ${resolvedSupplier}`;

  if (basePaise > 0) {
    lines.push({
      ledgerName: 'Purchase Account',
      ledgerType: 'Expense',
      debit: fromPaise(basePaise),
      credit: 0,
      remarks: baseRemarks,
      particulars: `To ${resolvedSupplier} (Purchase #${invLabel})`,
    });
  }

  if (cgstPaise > 0) {
    lines.push({ ledgerName: 'Input CGST', ledgerType: 'Tax', debit: fromPaise(cgstPaise), credit: 0, remarks: `CGST on Purchase #${invLabel}` });
  }
  if (sgstPaise > 0) {
    lines.push({ ledgerName: 'Input SGST', ledgerType: 'Tax', debit: fromPaise(sgstPaise), credit: 0, remarks: `SGST on Purchase #${invLabel}` });
  }
  if (igstPaise > 0) {
    lines.push({ ledgerName: 'Input IGST', ledgerType: 'Tax', debit: fromPaise(igstPaise), credit: 0, remarks: `IGST on Purchase #${invLabel}` });
  }
  if (vatPaise > 0) {
    lines.push({ ledgerName: 'Input VAT', ledgerType: 'Tax', debit: fromPaise(vatPaise), credit: 0, remarks: `VAT on Purchase #${invLabel}` });
  }
  if (discPaise > 0) {
    lines.push({ ledgerName: 'Discount Received', ledgerType: 'Income', debit: 0, credit: fromPaise(discPaise), remarks: `Discount on Purchase #${invLabel}` });
  }

  // Deductions & Additional Charges
  let addChargesToSupplierPaise = 0;
  let lessDeductionsFromSupplierPaise = 0;

  if (Array.isArray(deductions)) {
    for (const d of deductions) {
      const dPaise = toPaise(d.amount || 0);
      if (dPaise <= 0) continue;
      const dName = d.deduction_name || d.name || 'Quality/Shortage Deduction';
      const isLess = !d.type || String(d.type).toUpperCase() === 'LESS';
      if (isLess) {
        lessDeductionsFromSupplierPaise += dPaise;
        lines.push({
          ledgerName: d.account_head || 'Purchase Deduction Recovery',
          ledgerType: 'Income',
          debit: 0,
          credit: fromPaise(dPaise),
          remarks: `Deduction recovery (${dName}) on #${invLabel}`,
        });
      } else {
        addChargesToSupplierPaise += dPaise;
        lines.push({
          ledgerName: dName,
          ledgerType: 'Expense',
          debit: fromPaise(dPaise),
          credit: 0,
          remarks: `${dName} on #${invLabel}`,
        });
      }
    }
  }

  if (mamoolPaise > 0) {
    lessDeductionsFromSupplierPaise += mamoolPaise;
    lines.push({ ledgerName: 'Mamool Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(mamoolPaise), remarks: `Mamool on #${invLabel}` });
  }
  if (weightCashPaise > 0) {
    lessDeductionsFromSupplierPaise += weightCashPaise;
    lines.push({ ledgerName: 'Weight Cash Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(weightCashPaise), remarks: `Weight cash on #${invLabel}` });
  }
  if (otherDedPaise > 0) {
    lessDeductionsFromSupplierPaise += otherDedPaise;
    lines.push({ ledgerName: 'Purchase Deduction Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(otherDedPaise), remarks: `Other deductions on #${invLabel}` });
  }
  if (otherAddPaise > 0) {
    addChargesToSupplierPaise += otherAddPaise;
    lines.push({ ledgerName: 'Other Purchase Charges', ledgerType: 'Expense', debit: fromPaise(otherAddPaise), credit: 0, remarks: `Other charges on #${invLabel}` });
  }

  // Transport Charges
  if (transportPaise > 0) {
    lines.push({ ledgerName: 'Transport Charges', ledgerType: 'Expense', debit: fromPaise(transportPaise), credit: 0, remarks: `Transport charges for #${invLabel}` });
    if (transportPayableType === 'SUPPLIER_INVOICE') {
      addChargesToSupplierPaise += transportPaise;
    } else {
      lines.push({
        ledgerName: transporterName || 'Transporter Payable',
        ledgerType: 'Transporter',
        debit: 0,
        credit: fromPaise(transportPaise),
        remarks: `Transport charges payable for #${invLabel}`,
      });
    }
  }

  // Loadman Charges
  if (loadmanPaise > 0) {
    lines.push({ ledgerName: 'Loadman Charges', ledgerType: 'Expense', debit: fromPaise(loadmanPaise), credit: 0, remarks: `Loading/unloading charges for #${invLabel}` });
    if (loadmanPayableType === 'SUPPLIER_INVOICE') {
      addChargesToSupplierPaise += loadmanPaise;
    } else {
      lines.push({
        ledgerName: loadmanName || 'Loadman Payable',
        ledgerType: 'Worker',
        debit: 0,
        credit: fromPaise(loadmanPaise),
        remarks: `Loading charges payable for #${invLabel}`,
      });
    }
  }

  const grossBeforeDedPaise = basePaise + effectiveTaxPaise + vatPaise - discPaise + addChargesToSupplierPaise;
  const netPayableToSupplierPaise = Math.max(0, grossBeforeDedPaise - lessDeductionsFromSupplierPaise + roundOffPaise);

  // If roundOff wasn't explicitly passed, check if netAmount has sub-rupee rounding difference against netPayableToSupplierPaise
  if (roundOffPaise === 0 && toPaise(netAmount) > 0) {
    const netAmtPaise = toPaise(netAmount);
    const diff = netAmtPaise - netPayableToSupplierPaise;
    if (diff !== 0 && Math.abs(diff) <= 100 && lessDeductionsFromSupplierPaise === 0) {
      roundOffPaise = diff;
    }
  }

  if (roundOffPaise > 0) {
    lines.push({ ledgerName: 'Round Off', ledgerType: 'Expense', debit: fromPaise(roundOffPaise), credit: 0, remarks: `Round off on #${invLabel}` });
  } else if (roundOffPaise < 0) {
    lines.push({ ledgerName: 'Round Off', ledgerType: 'Income', debit: 0, credit: fromPaise(-roundOffPaise), remarks: `Round off on #${invLabel}` });
  }

  if (grossBeforeDedPaise > 0 || roundOffPaise !== 0) {
    // Post gross invoice credit + explicit deduction debit if deductions exist so audit trail shows full bill and deduction, OR net supplier credit
    if (lessDeductionsFromSupplierPaise > 0 && grossBeforeDedPaise > 0) {
      lines.push({
        ledgerName: resolvedSupplier,
        ledgerType: 'Supplier',
        debit: 0,
        credit: fromPaise(Math.max(0, grossBeforeDedPaise + roundOffPaise)),
        remarks: `Purchase invoice #${invLabel}`,
      });
      lines.push({
        ledgerName: resolvedSupplier,
        ledgerType: 'Supplier',
        debit: fromPaise(lessDeductionsFromSupplierPaise),
        credit: 0,
        remarks: `Deduction adjustment on Purchase #${invLabel}`,
      });
    } else if (netPayableToSupplierPaise > 0) {
      lines.push({
        ledgerName: resolvedSupplier,
        ledgerType: 'Supplier',
        debit: 0,
        credit: fromPaise(Math.max(0, grossBeforeDedPaise + roundOffPaise)),
        remarks: `Purchase invoice #${invLabel}`,
      });
    }
  }

  const taggedLines = lines.map((l) => ({
    ...l,
    referenceId: purchaseId,
    referenceType: 'purchase',
    transactionId: purchaseId,
    transactionType: 'purchase',
  }));

  return AccountingEngine.postVoucher({
    conn,
    companyId: cId,
    voucherType: 'Purchase',
    prefix: 'PUR',
    existingVoucherNo: passedVoucherNo || null,
    date: voucherDate,
    referenceNo: String(purchaseId || invNo || ''),
    narration: narration || `Purchase Invoice #${invLabel}`,
    sourceModule: 'purchase',
    sourceId: purchaseId ? Number(purchaseId) : null,
    postingKey: purchaseId ? `purchase:${purchaseId}` : null,
    lines: taggedLines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createPurchaseLedgerEntries(purchaseData) {
  return createPurchaseVoucherChain(purchaseData);
}

async function createSalesVoucherChain(salesData) {
  const cId = AccountingEngine.getActiveCompanyId(salesData.companyId);
  const {
    conn = null,
    customer,
    date,
    invNo,
    salesId,
    totalAmount = 0,
    taxAmount = 0,
    discAmount = 0,
    baseAmount = 0,
    freightRecoveryAmount = 0,
    loadingChargesRecoverable = 0,
    otherCharges = 0,
    tcsAmount = 0,
    deductions = [],
    roundOff = 0,
    narration = '',
    existingVoucherNo: passedVoucherNo = null,
  } = salesData;

  const resolvedCustomer = await getPartyName(customer, 'customer', cId);
  if (!resolvedCustomer) {
    throw new Error('Sales voucher requires a valid Customer ledger.');
  }

  const voucherDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invLabel = invNo || salesId;

  let cgstPaise = toPaise(salesData.cgstAmount || 0);
  let sgstPaise = toPaise(salesData.sgstAmount || 0);
  let igstPaise = toPaise(salesData.igstAmount || 0);
  const totalTaxPaise = toPaise(taxAmount || 0);
  if (cgstPaise === 0 && sgstPaise === 0 && igstPaise === 0 && totalTaxPaise > 0) {
    if (salesData.isInterstate || salesData.isInterState) {
      igstPaise = totalTaxPaise;
    } else {
      cgstPaise = Math.round(totalTaxPaise / 2);
      sgstPaise = totalTaxPaise - cgstPaise;
    }
  }
  const effectiveTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const discPaise = toPaise(discAmount || 0);
  const freightRecPaise = Math.max(0, toPaise(freightRecoveryAmount || 0));
  const loadingRecPaise = Math.max(0, toPaise(loadingChargesRecoverable || 0));
  const otherChargesPaise = Math.max(0, toPaise(otherCharges || 0));
  const tcsPaise = Math.max(0, toPaise(tcsAmount || 0));

  let basePaise = toPaise(baseAmount || 0);
  if (basePaise === 0 && toPaise(totalAmount) > 0) {
    basePaise = Math.max(0, toPaise(totalAmount) - effectiveTaxPaise - freightRecPaise - loadingRecPaise - otherChargesPaise - tcsPaise + discPaise);
  }

  let lessDedPaise = 0;
  let addDedPaise = 0;
  const lines = [];

  if (basePaise > 0) {
    lines.push({ ledgerName: 'Sales Account', ledgerType: 'Income', debit: 0, credit: fromPaise(basePaise), remarks: `Sales Invoice #${invLabel}` });
  }
  if (cgstPaise > 0) {
    lines.push({ ledgerName: 'Output CGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(cgstPaise), remarks: `CGST on Sales #${invLabel}` });
  }
  if (sgstPaise > 0) {
    lines.push({ ledgerName: 'Output SGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(sgstPaise), remarks: `SGST on Sales #${invLabel}` });
  }
  if (igstPaise > 0) {
    lines.push({ ledgerName: 'Output IGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(igstPaise), remarks: `IGST on Sales #${invLabel}` });
  }
  if (freightRecPaise > 0) {
    lines.push({ ledgerName: 'Freight Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(freightRecPaise), remarks: `Freight charges recovered on Sales #${invLabel}` });
  }
  if (loadingRecPaise > 0) {
    lines.push({ ledgerName: 'Loading & Unloading Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(loadingRecPaise), remarks: `Loading charges on Sales #${invLabel}` });
  }
  if (otherChargesPaise > 0) {
    lines.push({ ledgerName: 'Other Sales Charges', ledgerType: 'Income', debit: 0, credit: fromPaise(otherChargesPaise), remarks: `Other charges on Sales #${invLabel}` });
  }
  if (tcsPaise > 0) {
    lines.push({ ledgerName: 'TCS Payable', ledgerType: 'Tax', debit: 0, credit: fromPaise(tcsPaise), remarks: `TCS on Sales #${invLabel}` });
  }
  if (discPaise > 0) {
    lines.push({ ledgerName: 'Discount Allowed', ledgerType: 'Expense', debit: fromPaise(discPaise), credit: 0, remarks: `Discount on Sales #${invLabel}` });
  }

  if (Array.isArray(deductions)) {
    for (const d of deductions) {
      const dPaise = toPaise(d.amount || d.deduction_amount || 0);
      if (dPaise <= 0) continue;
      const dName = d.deduction_name || d.name || d.deduction || 'Sales Deduction';
      const isLess = d.type === undefined || String(d.type).toUpperCase() === 'LESS';
      if (isLess) {
        lessDedPaise += dPaise;
        lines.push({ ledgerName: dName, ledgerType: 'Expense', debit: fromPaise(dPaise), credit: 0, remarks: `${dName} on Sales #${invLabel}` });
      } else {
        addDedPaise += dPaise;
        lines.push({ ledgerName: dName, ledgerType: 'Income', debit: 0, credit: fromPaise(dPaise), remarks: `${dName} on Sales #${invLabel}` });
      }
    }
  }

  const netReceivablePaise = basePaise + effectiveTaxPaise + freightRecPaise + loadingRecPaise + otherChargesPaise + tcsPaise - discPaise - lessDedPaise + addDedPaise;
  let roundOffPaise = toPaise(roundOff);
  if (roundOffPaise === 0 && toPaise(totalAmount) > 0) {
    const diff = toPaise(totalAmount) - netReceivablePaise;
    if (diff !== 0 && Math.abs(diff) <= 100) {
      roundOffPaise = diff;
    }
  }
  if (roundOffPaise > 0) {
    lines.push({ ledgerName: 'Round Off', ledgerType: 'Income', debit: 0, credit: fromPaise(roundOffPaise), remarks: `Round off on Sales #${invLabel}` });
  } else if (roundOffPaise < 0) {
    lines.push({ ledgerName: 'Round Off', ledgerType: 'Expense', debit: fromPaise(-roundOffPaise), credit: 0, remarks: `Round off on Sales #${invLabel}` });
  }

  const customerDrPaise = Math.max(0, netReceivablePaise + roundOffPaise);
  if (customerDrPaise > 0) {
    lines.unshift({
      ledgerName: resolvedCustomer,
      ledgerType: 'Customer',
      debit: fromPaise(customerDrPaise),
      credit: 0,
      remarks: `Sales Invoice #${invLabel}`,
    });
  }

  const taggedLines = lines.map((l) => ({
    ...l,
    referenceId: salesId,
    referenceType: 'sales',
    transactionId: salesId,
    transactionType: 'sales',
  }));

  return AccountingEngine.postVoucher({
    conn,
    companyId: cId,
    voucherType: 'Sales',
    prefix: 'SAL',
    existingVoucherNo: passedVoucherNo || null,
    date: voucherDate,
    referenceNo: String(salesId || invNo || ''),
    narration: narration || `Sales Invoice #${invLabel}`,
    sourceModule: 'sales',
    sourceId: salesId ? Number(salesId) : null,
    postingKey: salesId ? `sales:${salesId}` : null,
    lines: taggedLines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createSalesLedgerEntries(salesData) {
  return createSalesVoucherChain(salesData);
}

/**
 * Separate Receipt Voucher for payments received against a Sales Invoice.
 * Never merges receipt into the Sales Invoice voucher so Receivable & Cash/Bank stay clean.
 */
async function createSalesReceiptVoucher(receiptData) {
  const cId = AccountingEngine.getActiveCompanyId(receiptData.companyId);
  const {
    conn = null,
    customer,
    date,
    paymentDate,
    invNo,
    salesId,
    receivedAmount = 0,
    paymentMode = 'Cash',
    bankAccountName = '',
    transactionRef = '',
    existingVoucherNo = null,
  } = receiptData;

  const amtPaise = toPaise(receivedAmount);
  if (amtPaise <= 0) {
    await AccountingEngine.deleteVoucherBySource({
      conn,
      companyId: cId,
      sourceModule: 'sales_receipt',
      sourceId: Number(salesId),
    });
    return null;
  }

  const resolvedCustomer = await getPartyName(customer, 'customer', cId);
  if (!resolvedCustomer) {
    throw new Error('Sales Receipt voucher requires a valid Customer ledger.');
  }

  const modeLower = String(paymentMode || 'Cash').trim().toLowerCase();
  const isCash = modeLower === 'cash';
  const settlementLedger = isCash ? 'Cash in Hand' : (String(bankAccountName || '').trim() || 'Bank Account');
  const amtVal = fromPaise(amtPaise);
  const vDate = sanitizeDate(paymentDate || date) || new Date().toISOString().slice(0, 10);
  const invLabel = invNo || salesId;
  const refNote = transactionRef ? ` (Ref: ${transactionRef})` : '';
  const remarkText = `Receipt against Sales Invoice #${invLabel} via ${paymentMode}${refNote}`;

  const lines = [
    {
      ledgerName: settlementLedger,
      groupName: isCash ? 'Cash-in-hand' : 'Bank Accounts',
      debit: amtVal,
      credit: 0,
      remarks: remarkText,
      referenceId: salesId,
      referenceType: 'sales_receipt',
      transactionId: salesId,
      transactionType: 'sales_receipt',
    },
    {
      ledgerName: resolvedCustomer,
      ledgerType: 'Customer',
      debit: 0,
      credit: amtVal,
      remarks: remarkText,
      referenceId: salesId,
      referenceType: 'sales_receipt',
      transactionId: salesId,
      transactionType: 'sales_receipt',
    },
  ];

  return AccountingEngine.postVoucher({
    conn,
    companyId: cId,
    voucherType: 'Receipt',
    prefix: 'REC',
    existingVoucherNo: existingVoucherNo || null,
    date: vDate,
    referenceNo: String(salesId || invLabel),
    narration: remarkText,
    sourceModule: 'sales_receipt',
    sourceId: Number(salesId),
    postingKey: `sales_receipt:${salesId}`,
    lines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

/**
 * Separate Freight Outward Voucher when Seller pays freight (Paid By = Seller).
 */
async function createSalesFreightVoucher(freightData) {
  const cId = AccountingEngine.getActiveCompanyId(freightData.companyId);
  const {
    conn = null,
    salesId,
    invNo,
    date,
    freightAmount = 0,
    freightPaidBy = 'Buyer',
    freightPaymentStatus = 'Pending',
    transporter = '',
    vehicleNo = '',
    existingVoucherNo = null,
  } = freightData;

  const amtPaise = toPaise(freightAmount);
  if (amtPaise <= 0 || String(freightPaidBy || '').toLowerCase() !== 'seller') {
    await AccountingEngine.deleteVoucherBySource({
      conn,
      companyId: cId,
      sourceModule: 'sales_freight',
      sourceId: Number(salesId),
    });
    return null;
  }

  const resolvedTransporter = await getPartyName(transporter, 'transporter', cId);
  const isPaid = String(freightPaymentStatus || '').toLowerCase() === 'paid';
  const creditLedger = isPaid ? 'Cash in Hand' : (resolvedTransporter || 'Transporter Payable');
  const amtVal = fromPaise(amtPaise);
  const vDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invLabel = invNo || salesId;
  const remarkText = `Freight outward for Sales #${invLabel}${vehicleNo ? ` (${vehicleNo})` : ''}`;

  const lines = [
    {
      ledgerName: 'Freight Outward',
      ledgerType: 'Expense',
      debit: amtVal,
      credit: 0,
      remarks: remarkText,
      referenceId: salesId,
      referenceType: 'sales_freight',
      transactionId: salesId,
      transactionType: 'sales_freight',
    },
    {
      ledgerName: creditLedger,
      groupName: isPaid ? 'Cash-in-hand' : 'Sundry Creditors',
      ledgerType: isPaid ? 'Asset' : 'Transporter',
      debit: 0,
      credit: amtVal,
      remarks: remarkText,
      referenceId: salesId,
      referenceType: 'sales_freight',
      transactionId: salesId,
      transactionType: 'sales_freight',
    },
  ];

  return AccountingEngine.postVoucher({
    conn,
    companyId: cId,
    voucherType: 'Journal',
    prefix: 'JNL',
    existingVoucherNo: existingVoucherNo || null,
    date: vDate,
    referenceNo: String(salesId || invLabel),
    narration: remarkText,
    sourceModule: 'sales_freight',
    sourceId: Number(salesId),
    postingKey: `sales_freight:${salesId}`,
    lines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createAdvanceLedgerEntries(advanceData) {
  const cId = AccountingEngine.getActiveCompanyId(advanceData.companyId);
  const {
    papadCompany,
    date,
    sNo,
    advanceId,
    amount = 0,
    drCr = 'Dr',
    payMode = 'Cash',
    remarks = '',
  } = advanceData;

  const amtPaise = toPaise(amount);
  if (amtPaise <= 0) {
    throw new Error('Advance amount must be greater than zero.');
  }

  const resolvedParty = await getPartyName(papadCompany, 'papad_company', cId);
  if (!resolvedParty) {
    throw new Error('Advance entry requires a valid party.');
  }

  const payLower = String(payMode || '').trim().toLowerCase();
  const isBank = payLower.includes('bank') || payLower.includes('neft') || payLower.includes('rtgs') || payLower.includes('imps') || payLower.includes('upi') || payLower.includes('cheque');
  const settlementLedger = isBank ? 'Bank Account' : 'Cash in Hand';
  const voucherDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const isPartyDebit = String(drCr || 'Dr').trim().toUpperCase() !== 'CR';
  const amtVal = fromPaise(amtPaise);

  const lines = [
    {
      ledgerName: resolvedParty,
      ledgerType: 'Customer',
      debit: isPartyDebit ? amtVal : 0,
      credit: isPartyDebit ? 0 : amtVal,
      remarks: remarks || `Advance ${isPartyDebit ? 'given to' : 'received from'} ${resolvedParty} (Ref: ${sNo || advanceId})`,
      referenceId: advanceId,
      referenceType: 'advance',
      transactionId: advanceId,
      transactionType: 'advance',
    },
    {
      ledgerName: settlementLedger,
      groupName: isBank ? 'Bank Accounts' : 'Cash-in-hand',
      debit: isPartyDebit ? 0 : amtVal,
      credit: isPartyDebit ? amtVal : 0,
      remarks: remarks || `Advance settlement via ${payMode || 'Cash'} (Ref: ${sNo || advanceId})`,
      referenceId: advanceId,
      referenceType: 'advance',
      transactionId: advanceId,
      transactionType: 'advance',
    },
  ];

  return AccountingEngine.postVoucher({
    companyId: cId,
    voucherType: 'Advance',
    prefix: 'ADV',
    date: voucherDate,
    referenceNo: String(advanceId || sNo || ''),
    narration: remarks || `Advance Ref #${sNo || advanceId} - ${resolvedParty}`,
    sourceModule: 'advance',
    sourceId: advanceId ? Number(advanceId) : null,
    postingKey: advanceId ? `advance:${advanceId}` : null,
    lines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createPurchaseReturnVoucherChain(returnData) {
  const cId = AccountingEngine.getActiveCompanyId(returnData.companyId);
  const {
    supplier,
    date,
    returnInvNo,
    sNo,
    purchaseReturnId,
    baseAmount = 0,
    taxAmount = 0,
    discAmount = 0,
    netAmount = 0,
    grandTotal = 0,
    autoWages = 0,
    vat = 0,
    deductions = [],
    narration = '',
  } = returnData;

  const effectiveId = purchaseReturnId || returnData.id;
  const resolvedSupplier = await getPartyName(supplier, 'supplier', cId);
  if (!resolvedSupplier) {
    throw new Error('Purchase Return requires a valid Supplier.');
  }

  const voucherDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invoiceRef = returnInvNo || sNo || effectiveId || '';

  const cgstPaise = toPaise(returnData.cgstAmount || 0);
  const sgstPaise = toPaise(returnData.sgstAmount || 0);
  const igstPaise = toPaise(returnData.igstAmount || 0);
  const taxPaise = toPaise(taxAmount || 0);
  const vatPaise = toPaise(vat || 0);
  const discPaise = toPaise(discAmount || 0);
  const wagesPaise = toPaise(autoWages || 0);

  let effectiveTaxPaise = cgstPaise + sgstPaise + igstPaise;
  let autoCgst = cgstPaise;
  let autoSgst = sgstPaise;
  let autoIgst = igstPaise;
  if (effectiveTaxPaise === 0 && taxPaise > 0) {
    if (returnData.isInterstate) {
      autoIgst = taxPaise;
    } else {
      autoCgst = Math.round(taxPaise / 2);
      autoSgst = taxPaise - autoCgst;
    }
    effectiveTaxPaise = autoCgst + autoSgst + autoIgst;
  }

  let basePaise = toPaise(baseAmount || 0);
  const grandTotalPaise = toPaise(grandTotal || netAmount || 0);
  if (basePaise === 0 && grandTotalPaise > 0) {
    basePaise = Math.max(0, grandTotalPaise - effectiveTaxPaise - vatPaise + discPaise);
  }

  const lines = [];
  if (basePaise > 0) {
    lines.push({ ledgerName: 'Purchase Return Account', ledgerType: 'Expense', debit: 0, credit: fromPaise(basePaise), remarks: `Purchase Return / Debit Note #${invoiceRef}` });
  }
  if (autoCgst > 0) {
    lines.push({ ledgerName: 'Input CGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(autoCgst), remarks: `CGST Reversal #${invoiceRef}` });
  }
  if (autoSgst > 0) {
    lines.push({ ledgerName: 'Input SGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(autoSgst), remarks: `SGST Reversal #${invoiceRef}` });
  }
  if (autoIgst > 0) {
    lines.push({ ledgerName: 'Input IGST', ledgerType: 'Tax', debit: 0, credit: fromPaise(autoIgst), remarks: `IGST Reversal #${invoiceRef}` });
  }
  if (vatPaise > 0) {
    lines.push({ ledgerName: 'Input VAT', ledgerType: 'Tax', debit: 0, credit: fromPaise(vatPaise), remarks: `VAT Reversal #${invoiceRef}` });
  }
  if (discPaise > 0) {
    lines.push({ ledgerName: 'Discount Received', ledgerType: 'Income', debit: fromPaise(discPaise), credit: 0, remarks: `Discount Reversal #${invoiceRef}` });
  }
  if (wagesPaise > 0) {
    lines.push({ ledgerName: 'Auto Wages Recovery', ledgerType: 'Income', debit: 0, credit: fromPaise(wagesPaise), remarks: `Auto wages #${invoiceRef}` });
  }

  let dedNetPaise = 0;
  if (Array.isArray(deductions)) {
    for (const d of deductions) {
      const dPaise = toPaise(d.amount || 0);
      if (dPaise <= 0) continue;
      const dName = d.deduction_name || d.name || 'Purchase Return Deduction';
      const isLess = !d.type || String(d.type).toUpperCase() === 'LESS';
      if (isLess) {
        dedNetPaise -= dPaise;
        lines.push({ ledgerName: dName, ledgerType: 'Expense', debit: fromPaise(dPaise), credit: 0, remarks: `${dName} #${invoiceRef}` });
      } else {
        dedNetPaise += dPaise;
        lines.push({ ledgerName: dName, ledgerType: 'Income', debit: 0, credit: fromPaise(dPaise), remarks: `${dName} #${invoiceRef}` });
      }
    }
  }

  const supplierDebitPaise = Math.max(0, basePaise + effectiveTaxPaise + vatPaise + wagesPaise - discPaise + dedNetPaise);
  if (supplierDebitPaise > 0) {
    lines.unshift({
      ledgerName: resolvedSupplier,
      ledgerType: 'Supplier',
      debit: fromPaise(supplierDebitPaise),
      credit: 0,
      remarks: `Debit Note #${invoiceRef}`,
    });
  }

  const taggedLines = lines.map((l) => ({
    ...l,
    referenceId: effectiveId,
    referenceType: 'purchase_return',
    transactionId: effectiveId,
    transactionType: 'purchase_return',
  }));

  return AccountingEngine.postVoucher({
    companyId: cId,
    voucherType: 'Debit Note',
    prefix: 'DN',
    date: voucherDate,
    referenceNo: String(effectiveId || invoiceRef),
    narration: narration || `Debit Note / Purchase Return #${invoiceRef} to ${resolvedSupplier}`,
    sourceModule: 'purchase_return',
    sourceId: effectiveId ? Number(effectiveId) : null,
    postingKey: effectiveId ? `purchase_return:${effectiveId}` : null,
    lines: taggedLines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createSalesReturnVoucherChain(returnData) {
  const cId = AccountingEngine.getActiveCompanyId(returnData.companyId);
  const {
    customer,
    date,
    returnInvNo,
    sNo,
    salesReturnId,
    totalAmount = 0,
    baseAmount = 0,
    taxAmount = 0,
    cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0,
    deductionAmount = 0,
    narration = '',
  } = returnData;

  const effectiveId = salesReturnId || returnData.id;
  const resolvedCustomer = await getPartyName(customer, 'customer', cId);
  if (!resolvedCustomer) {
    throw new Error('Sales Return requires a valid Customer.');
  }

  const voucherDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invoiceRef = returnInvNo || sNo || effectiveId || 'SRT';

  let cgstPaise = toPaise(cgstAmount || 0);
  let sgstPaise = toPaise(sgstAmount || 0);
  let igstPaise = toPaise(igstAmount || 0);
  const taxPaise = toPaise(taxAmount || 0);
  if (cgstPaise === 0 && sgstPaise === 0 && igstPaise === 0 && taxPaise > 0) {
    if (returnData.isInterstate) {
      igstPaise = taxPaise;
    } else {
      cgstPaise = Math.round(taxPaise / 2);
      sgstPaise = taxPaise - cgstPaise;
    }
  }
  const effectiveTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const dedPaise = toPaise(deductionAmount || 0);
  const totalValPaise = Math.abs(toPaise(totalAmount || 0));
  let basePaise = Math.abs(toPaise(baseAmount || 0));
  if (basePaise === 0 && totalValPaise > 0) {
    basePaise = Math.max(0, totalValPaise - effectiveTaxPaise + dedPaise);
  }
  if (totalValPaise <= 0 && basePaise <= 0) return null;

  const lines = [];
  if (basePaise > 0) {
    lines.push({ ledgerName: 'Sales Return Account', ledgerType: 'Income', debit: fromPaise(basePaise), credit: 0, remarks: `Sales Return / Credit Note #${invoiceRef}` });
  }
  if (cgstPaise > 0) {
    lines.push({ ledgerName: 'Output CGST', ledgerType: 'Tax', debit: fromPaise(cgstPaise), credit: 0, remarks: `CGST Reversal #${invoiceRef}` });
  }
  if (sgstPaise > 0) {
    lines.push({ ledgerName: 'Output SGST', ledgerType: 'Tax', debit: fromPaise(sgstPaise), credit: 0, remarks: `SGST Reversal #${invoiceRef}` });
  }
  if (igstPaise > 0) {
    lines.push({ ledgerName: 'Output IGST', ledgerType: 'Tax', debit: fromPaise(igstPaise), credit: 0, remarks: `IGST Reversal #${invoiceRef}` });
  }
  if (dedPaise > 0) {
    lines.push({ ledgerName: 'Sales Return Deductions', ledgerType: 'Income', debit: 0, credit: fromPaise(dedPaise), remarks: `Deduction on Sales Return #${invoiceRef}` });
  }

  const customerCreditPaise = Math.max(0, basePaise + effectiveTaxPaise - dedPaise);
  if (customerCreditPaise > 0) {
    lines.unshift({
      ledgerName: resolvedCustomer,
      ledgerType: 'Customer',
      debit: 0,
      credit: fromPaise(customerCreditPaise),
      remarks: `Credit Note #${invoiceRef}`,
    });
  }

  const taggedLines = lines.map((l) => ({
    ...l,
    referenceId: effectiveId,
    referenceType: 'sales_return',
    transactionId: effectiveId,
    transactionType: 'sales_return',
  }));

  return AccountingEngine.postVoucher({
    companyId: cId,
    voucherType: 'Credit Note',
    prefix: 'CN',
    existingVoucherNo: returnData.existingVoucherNo || null,
    date: voucherDate,
    referenceNo: String(effectiveId || invoiceRef),
    narration: narration || `Credit Note / Sales Return #${invoiceRef} for ${resolvedCustomer}`,
    sourceModule: 'sales_return',
    sourceId: effectiveId ? Number(effectiveId) : null,
    postingKey: effectiveId ? `sales_return:${effectiveId}` : null,
    lines: taggedLines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function createSalesReturnRefundVoucher(refundData) {
  const cId = AccountingEngine.getActiveCompanyId(refundData.companyId);
  const {
    customer,
    date,
    returnInvNo,
    salesReturnId,
    refundAmount = 0,
    refundMode = 'Bank',
    bankAccountName = '',
    refundRefNo = '',
    existingVoucherNo = null,
    narration = '',
  } = refundData;

  const amtPaise = toPaise(refundAmount);
  if (!salesReturnId || amtPaise <= 0) {
    if (salesReturnId) {
      await AccountingEngine.deleteVoucherBySource({
        companyId: cId,
        sourceModule: 'sales_return_refund',
        sourceId: Number(salesReturnId),
        voucherTypes: ['Payment', 'PAY'],
      });
    }
    return null;
  }

  const resolvedCustomer = await getPartyName(customer, 'customer', cId);
  if (!resolvedCustomer) {
    throw new Error('Sales Return Refund requires a valid Customer ledger.');
  }

  const modeLower = String(refundMode || 'Cash').trim().toLowerCase();
  const isCash = modeLower === 'cash';
  const payoutLedger = isCash ? 'Cash in Hand' : (String(bankAccountName || '').trim() || 'Bank Account');
  const amtVal = fromPaise(amtPaise);
  const vDate = sanitizeDate(date) || new Date().toISOString().slice(0, 10);
  const invLabel = returnInvNo || salesReturnId;
  const refNote = refundRefNo ? ` (Ref: ${refundRefNo})` : '';
  const remarkText = narration || `Refund to ${resolvedCustomer} for Sales Return #${invLabel} via ${refundMode}${refNote}`;

  const lines = [
    {
      ledgerName: resolvedCustomer,
      ledgerType: 'Customer',
      debit: amtVal,
      credit: 0,
      remarks: remarkText,
      referenceId: salesReturnId,
      referenceType: 'sales_return_refund',
      transactionId: salesReturnId,
      transactionType: 'sales_return_refund',
    },
    {
      ledgerName: payoutLedger,
      groupName: isCash ? 'Cash-in-hand' : 'Bank Accounts',
      debit: 0,
      credit: amtVal,
      remarks: remarkText,
      referenceId: salesReturnId,
      referenceType: 'sales_return_refund',
      transactionId: salesReturnId,
      transactionType: 'sales_return_refund',
    },
  ];

  return AccountingEngine.postVoucher({
    companyId: cId,
    voucherType: 'Payment',
    prefix: 'PAY',
    existingVoucherNo: existingVoucherNo || null,
    date: vDate,
    referenceNo: String(salesReturnId || invLabel),
    narration: remarkText,
    sourceModule: 'sales_return_refund',
    sourceId: Number(salesReturnId),
    postingKey: `sales_return_refund:${salesReturnId}`,
    lines,
    allowUpdate: true,
    preserveVoucherNoOnUpdate: true,
  });
}

async function deletePurchaseVoucherChain(referenceId, companyId = null) {
  if (!referenceId) return true;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: 'purchase',
    sourceId: /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null,
    voucherTypes: ['Purchase', 'PUR'],
    referenceNo: String(referenceId),
  });
  return true;
}

async function deleteSalesVoucherChain(referenceId, companyId = null) {
  if (!referenceId) return true;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const srcId = /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null;
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: 'sales',
    sourceId: srcId,
    voucherTypes: ['Sales', 'SAL'],
    referenceNo: String(referenceId),
  });
  if (srcId) {
    await AccountingEngine.deleteVoucherBySource({
      companyId: cId,
      sourceModule: 'sales_receipt',
      sourceId: srcId,
      voucherTypes: ['Receipt', 'REC'],
    });
    await AccountingEngine.deleteVoucherBySource({
      companyId: cId,
      sourceModule: 'sales_freight',
      sourceId: srcId,
      voucherTypes: ['Journal', 'JNL'],
    });
  }
  return true;
}

async function deleteAdvanceVoucherChain(referenceId, companyId = null) {
  if (!referenceId) return true;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: 'advance',
    sourceId: /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null,
    voucherTypes: ['Advance', 'ADV'],
    referenceNo: String(referenceId),
  });
  return true;
}

async function deletePurchaseReturnVoucherChain(referenceId, companyId = null) {
  if (!referenceId) return true;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: 'purchase_return',
    sourceId: /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null,
    voucherTypes: ['Debit Note', 'Purchase Return', 'DN'],
    referenceNo: String(referenceId),
  });
  return true;
}

async function deleteSalesReturnVoucherChain(referenceId, companyId = null) {
  if (!referenceId) return true;
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  const srcId = /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null;
  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: 'sales_return',
    sourceId: srcId,
    voucherTypes: ['Credit Note', 'Sales Return', 'CN'],
    referenceNo: String(referenceId),
  });
  if (srcId) {
    await AccountingEngine.deleteVoucherBySource({
      companyId: cId,
      sourceModule: 'sales_return_refund',
      sourceId: srcId,
      voucherTypes: ['Payment', 'PAY'],
    });
  }
  return true;
}

/**
 * Strictly module-scoped ledger deletion.
 * Requires an explicit sourceModule / voucherType to prevent cross-module record collisions.
 */
async function deleteLedgerEntries(referenceId, sourceModule = null, companyId = null) {
  if (!referenceId) return true;
  const mod = String(sourceModule || '').trim().toLowerCase();
  if (!mod) {
    throw new Error('deleteLedgerEntries requires explicit sourceModule (purchase, sales, advance, purchase_return, sales_return) to prevent cross-module deletion.');
  }
  const cId = AccountingEngine.getActiveCompanyId(companyId);
  if (mod === 'purchase' || mod === 'pur') return deletePurchaseVoucherChain(referenceId, cId);
  if (mod === 'sales' || mod === 'sale' || mod === 'sal') return deleteSalesVoucherChain(referenceId, cId);
  if (mod === 'advance' || mod === 'adv') return deleteAdvanceVoucherChain(referenceId, cId);
  if (mod === 'purchase_return' || mod === 'purchase return' || mod === 'debit note' || mod === 'dn') return deletePurchaseReturnVoucherChain(referenceId, cId);
  if (mod === 'sales_return' || mod === 'sales return' || mod === 'credit note' || mod === 'cn') return deleteSalesReturnVoucherChain(referenceId, cId);

  await AccountingEngine.deleteVoucherBySource({
    companyId: cId,
    sourceModule: mod,
    sourceId: /^\d+$/.test(String(referenceId)) ? Number(referenceId) : null,
    referenceNo: String(referenceId),
  });
  return true;
}

module.exports = {
  sanitizeDate,
  getPartyName,
  getNextVoucherNumber,
  createLedgerEntry,
  createPurchaseLedgerEntries,
  createPurchaseVoucherChain,
  createPurchaseReturnVoucherChain,
  createSalesReturnVoucherChain,
  createSalesReturnRefundVoucher,
  createSalesVoucherChain,
  createSalesLedgerEntries,
  createSalesReceiptVoucher,
  createSalesFreightVoucher,
  createAdvanceLedgerEntries,
  deleteLedgerEntries,
  deletePurchaseVoucherChain,
  deleteSalesVoucherChain,
  deleteAdvanceVoucherChain,
  deletePurchaseReturnVoucherChain,
  deleteSalesReturnVoucherChain,
  resolveLedgerId,
  ensureVoucherTables,
};
