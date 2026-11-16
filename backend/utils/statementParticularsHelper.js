// backend/utils/statementParticularsHelper.js
// Builds invoice-first Particulars & Transaction Details for Ledger Statements

function extractInvoiceNoFromText(text) {
  if (!text) return null;
  const s = String(text);
  // Match "Purchase Invoice #5361", "Purchase invoice #111", "Inv #111", "Invoice #1290", "Ref: 5361", "for #111"
  const m = s.match(/(?:purchase\s+invoice|invoice|inv|bill|ref(?:erence)?)\s*[:#-]?\s*#?\s*([A-Za-z0-9/-]+)/i)
    || s.match(/#([A-Za-z0-9/-]+)/);
  if (m && m[1]) {
    const token = m[1].trim();
    if (token && !['purchase', 'invoice', 'voucher', 'payment', 'receipt'].includes(token.toLowerCase())) {
      return token;
    }
  }
  return null;
}

function cleanCounterpartyText(text) {
  return String(text || '').trim();
}

/**
 * Enriches a raw ledger_entries / voucher_entry joined row with prominent Purchase/Sales Invoice No particulars
 */
function enrichStatementRow(row) {
  const vType = String(row.voucher_type || 'Journal').trim();
  const vTypeLower = vType.toLowerCase();
  const vNo = String(row.voucher_no || '-').trim();
  const vNoUpper = vNo.toUpperCase();

  const debit = Number(row.debit || 0);
  const credit = Number(row.credit || 0);

  const counterparty = cleanCounterpartyText(row.counterparty_summary);
  const rawParticulars = cleanCounterpartyText(row.raw_particulars || row.particulars);
  const narration = cleanCounterpartyText(row.voucher_narration || row.narration);
  const entryRemarks = cleanCounterpartyText(row.entry_remarks || row.remarks);
  const voucherRefNo = cleanCounterpartyText(row.voucher_reference_no || row.reference_no);

  const joinedPurchaseId = row.joined_purchase_id || (String(row.reference_type || '').toLowerCase() === 'purchase' ? row.reference_id : null) || null;
  const purchaseInvNo = cleanCounterpartyText(row.purchase_inv_no) || (row.purchase_s_no ? String(row.purchase_s_no) : '');
  const salesInvNo = row.sales_s_no ? String(row.sales_s_no) : '';

  const isPurchase =
    vTypeLower.includes('purchase') ||
    vNoUpper.startsWith('PUR') ||
    String(row.voucher_source_module || '').toLowerCase() === 'purchase' ||
    String(row.reference_type || '').toLowerCase() === 'purchase' ||
    Boolean(joinedPurchaseId);

  const isSales =
    vTypeLower.includes('sales') ||
    vNoUpper.startsWith('SAL') ||
    String(row.voucher_source_module || '').toLowerCase() === 'sales' ||
    String(row.reference_type || '').toLowerCase() === 'sales';

  const isPayment = vTypeLower.includes('payment') || vNoUpper.startsWith('PAY');
  const isReceipt = vTypeLower.includes('receipt') || vNoUpper.startsWith('REC');
  const isDebitNote = vTypeLower.includes('debit note') || vTypeLower.includes('purchase return');
  const isCreditNote = vTypeLower.includes('credit note') || vTypeLower.includes('sales return');

  // Resolve primary Invoice / Ref number
  let invoiceNo = '';
  if (purchaseInvNo) {
    invoiceNo = purchaseInvNo;
  } else if (salesInvNo) {
    invoiceNo = salesInvNo;
  } else {
    invoiceNo =
      extractInvoiceNoFromText(narration) ||
      extractInvoiceNoFromText(entryRemarks) ||
      extractInvoiceNoFromText(rawParticulars) ||
      voucherRefNo ||
      '';
  }

  const combinedTextLower = `${counterparty} ${rawParticulars} ${entryRemarks} ${narration}`.toLowerCase();
  const isDeductionLine =
    combinedTextLower.includes('deduction') ||
    combinedTextLower.includes('recovery') ||
    combinedTextLower.includes('claim') ||
    (isPurchase && debit > 0 && credit === 0 && !String(row.ledger_name || '').toLowerCase().includes('purchase') && !String(row.ledger_name || '').toLowerCase().includes('gst') && !String(row.ledger_name || '').toLowerCase().includes('transport') && !String(row.ledger_name || '').toLowerCase().includes('loadman'));

  const isTransportLine =
    combinedTextLower.includes('transport charges') ||
    combinedTextLower.includes('freight');

  const isLoadmanLine =
    combinedTextLower.includes('loading/unloading') ||
    combinedTextLower.includes('loading charges') ||
    combinedTextLower.includes('unloading') ||
    combinedTextLower.includes('loadman');

  let primaryParticulars = '';
  if (isPurchase) {
    const invLabel = invoiceNo ? `Purchase Invoice #${invoiceNo}` : `Purchase (${vNo})`;
    if (isDeductionLine) {
      // Extract real deduction reason like (TCP) while ignoring counterparty tags like (+3 more)
      const reasonSource = `${entryRemarks} ${rawParticulars}`;
      const reasonMatch = reasonSource.match(/deduction(?:\s+recovery)?\s*\(([^)]+)\)/i);
      const rawTag = reasonMatch && reasonMatch[1] ? reasonMatch[1].trim() : '';
      const reasonTag = rawTag && !/^\+\d+\s+more$/i.test(rawTag) ? ` (${rawTag})` : '';
      primaryParticulars = `${invLabel} — Deduction Adjustment${reasonTag}`;
    } else if (isTransportLine) {
      primaryParticulars = `${invLabel} — Transport / Freight Charges`;
    } else if (isLoadmanLine) {
      primaryParticulars = `${invLabel} — Loadman / Unloading Charges`;
    } else if (String(row.ledger_name || '').toLowerCase().includes('cgst')) {
      primaryParticulars = `${invLabel} — Input CGST`;
    } else if (String(row.ledger_name || '').toLowerCase().includes('sgst')) {
      primaryParticulars = `${invLabel} — Input SGST`;
    } else if (String(row.ledger_name || '').toLowerCase().includes('igst')) {
      primaryParticulars = `${invLabel} — Input IGST`;
    } else if (String(row.ledger_name || '').toLowerCase() === 'purchase account') {
      primaryParticulars = `${invLabel} — Purchase Account`;
    } else {
      primaryParticulars = invLabel;
    }
  } else if (isPayment) {
    const invPart = invoiceNo ? `Against Purchase Inv #${invoiceNo}` : (voucherRefNo ? `Ref #${voucherRefNo}` : '');
    const viaPart = counterparty || entryRemarks || '';
    if (invPart && viaPart) {
      primaryParticulars = `Payment ${invPart} (${viaPart})`;
    } else if (invPart) {
      primaryParticulars = `Payment ${invPart}`;
    } else {
      primaryParticulars = counterparty || rawParticulars || `Payment (${vNo})`;
    }
  } else if (isReceipt) {
    const invPart = invoiceNo ? `Against Inv #${invoiceNo}` : (voucherRefNo ? `Ref #${voucherRefNo}` : '');
    const viaPart = counterparty || entryRemarks || '';
    if (invPart && viaPart) {
      primaryParticulars = `Receipt ${invPart} (${viaPart})`;
    } else if (invPart) {
      primaryParticulars = `Receipt ${invPart}`;
    } else {
      primaryParticulars = counterparty || rawParticulars || `Receipt (${vNo})`;
    }
  } else if (isSales) {
    primaryParticulars = invoiceNo ? `Sales Invoice #${invoiceNo}` : (counterparty || rawParticulars || `Sales (${vNo})`);
  } else if (isDebitNote) {
    primaryParticulars = invoiceNo ? `Debit Note — Purchase Inv #${invoiceNo}` : (rawParticulars || counterparty || `Debit Note (${vNo})`);
  } else if (isCreditNote) {
    primaryParticulars = invoiceNo ? `Credit Note — Inv #${invoiceNo}` : (rawParticulars || counterparty || `Credit Note (${vNo})`);
  } else {
    primaryParticulars = invoiceNo
      ? `${vType} — Ref #${invoiceNo}${counterparty ? ` (${counterparty})` : ''}`
      : (rawParticulars || counterparty || `${vType} #${vNo}`);
  }

  // Build concise, non-repetitive note / subtext
  const subParts = [];
  if (counterparty && !primaryParticulars.includes(counterparty)) {
    subParts.push(counterparty);
  }
  const detailNote = entryRemarks || narration || '';
  if (detailNote && detailNote.toLowerCase() !== primaryParticulars.toLowerCase() && detailNote.toLowerCase() !== `purchase invoice #${invoiceNo}`.toLowerCase()) {
    subParts.push(detailNote);
  }
  if (row.purchase_vehicle_no) {
    subParts.push(`Vehicle: ${row.purchase_vehicle_no}`);
  }

  return {
    particulars: primaryParticulars,
    inv_no: invoiceNo || null,
    invoice_no: invoiceNo || null,
    purchase_id: joinedPurchaseId ? Number(joinedPurchaseId) : null,
    counterparty_summary: counterparty || '',
    narration: narration || '',
    remarks: entryRemarks || '',
    reference_no: voucherRefNo || '',
    subtext: subParts.join(' • ')
  };
}

module.exports = {
  extractInvoiceNoFromText,
  enrichStatementRow
};
