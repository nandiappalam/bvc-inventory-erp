import { api } from '../utils/api';

/**
 * Standard Indian State Code mapping
 */
export const STATE_CODE_MAP = {
  'tamil nadu': '33',
  'tamilnadu': '33',
  'tn': '33',
  'karnataka': '29',
  'ka': '29',
  'kerala': '32',
  'kl': '32',
  'andhra pradesh': '37',
  'ap': '37',
  'telangana': '36',
  'ts': '36',
  'maharashtra': '27',
  'mh': '27',
  'delhi': '07',
  'dl': '07',
  'gujarat': '24',
  'gj': '24',
  'west bengal': '19',
  'wb': '19',
  'rajasthan': '08',
  'rj': '08',
  'madhya pradesh': '23',
  'mp': '23',
  'uttar pradesh': '09',
  'up': '09',
  'punjab': '03',
  'pb': '03',
  'haryana': '06',
  'hr': '06',
  'bihar': '10',
  'br': '10',
  'odisha': '21',
  'orissa': '21',
  'assam': '18'
};

export const INDIAN_STATES = [
  { code: '33', name: 'Tamil Nadu' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '36', name: 'Telangana' },
  { code: '27', name: 'Maharashtra' },
  { code: '24', name: 'Gujarat' },
  { code: '07', name: 'Delhi' },
  { code: '19', name: 'West Bengal' },
  { code: '08', name: 'Rajasthan' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '06', name: 'Haryana' },
  { code: '10', name: 'Bihar' },
  { code: '21', name: 'Odisha' },
  { code: '18', name: 'Assam' },
  { code: '97', name: 'Other Territory / SEZ' }
];

export const TAX_CLASSIFICATIONS = [
  { value: 'Taxable', label: 'Taxable (Standard GST applied)' },
  { value: 'Exempt', label: 'Exempt (0% GST exempted by notification)' },
  { value: 'Nil Rated', label: 'Nil Rated (0% GST under tariff)' },
  { value: 'Zero Rated', label: 'Zero Rated (Exports / SEZ supplies 0%)' },
  { value: 'Non-GST', label: 'Non-GST (Outside purview of GST Act)' }
];

export const TRANSACTION_TAX_MODES = [
  { value: 'Exclusive', label: 'Tax Exclusive (Tax added to base rate)' },
  { value: 'Inclusive', label: 'Tax Inclusive (Tax included in item rate)' },
  { value: 'Without Tax', label: 'Without Tax (No GST calculated / Internal movement)' }
];

export function normalizeStateCode(stateNameOrCode) {
  if (!stateNameOrCode) return '33';
  const str = String(stateNameOrCode).trim().toLowerCase();
  if (/^\d{2}$/.test(str)) return str;
  return STATE_CODE_MAP[str] || '33';
}

export function isInterState(companyState, partyState, companyStateCode, partyStateCode) {
  const cCode = companyStateCode || normalizeStateCode(companyState);
  const pCode = partyStateCode || normalizeStateCode(partyState);
  return String(cCode).trim() !== String(pCode).trim();
}

export function round2(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate single line tax breakdown
 */
export function calculateLineTax(params = {}) {
  const qty = Math.max(0, parseFloat(params.qty) || 0);
  const rate = Math.max(0, parseFloat(params.rate) || 0);
  const grossAmount = round2(qty * rate);

  let discPercent = parseFloat(params.discPercent || params.disc_percent || params.disc || 0) || 0;
  let discAmount = params.discAmount !== undefined && params.discAmount !== null && params.discAmount !== ''
    ? parseFloat(params.discAmount)
    : round2(grossAmount * (discPercent / 100));

  if (discAmount > grossAmount) discAmount = grossAmount;
  discAmount = round2(discAmount);

  const amountAfterDiscount = round2(grossAmount - discAmount);

  const rawMode = String(params.taxMode || params.tax_mode || params.taxType || 'Exclusive').trim();
  const isWithoutTax = rawMode.toLowerCase() === 'without tax' || 
                       rawMode.toLowerCase() === 'withouttax' || 
                       rawMode.toUpperCase() === 'WITHOUT_TAX' ||
                       rawMode.toLowerCase() === 'no tax' ||
                       rawMode.toLowerCase() === 'none';

  const isInclusive = !isWithoutTax && (rawMode.toLowerCase() === 'inclusive' || String(params.calcType).toLowerCase() === 'inclusive');

  let taxType = String(params.taxType || params.tax_type || 'Taxable').trim();
  if (!['Taxable', 'Exempt', 'Nil Rated', 'Zero Rated', 'Non-GST'].includes(taxType)) {
    if (taxType.toLowerCase() === 'exempt') taxType = 'Exempt';
    else if (taxType.toLowerCase().includes('nil')) taxType = 'Nil Rated';
    else if (taxType.toLowerCase().includes('zero')) taxType = 'Zero Rated';
    else if (taxType.toLowerCase().includes('non-gst') || taxType.toLowerCase().includes('nongst')) taxType = 'Non-GST';
    else taxType = 'Taxable';
  }

  const interState = isInterState(
    params.companyState, 
    params.partyState, 
    params.companyStateCode, 
    params.partyStateCode
  );

  const hsnCode = String(params.hsnCode || params.hsn_code || '').trim();

  // 1. Without Tax mode: strictly 0 tax
  if (isWithoutTax) {
    return {
      hsnCode,
      taxType,
      taxMode: 'Without Tax',
      isInterState: interState,
      grossAmount,
      discPercent,
      discAmount,
      taxableAmount: amountAfterDiscount,
      gstRate: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      cessRate: 0,
      cessAmount: 0,
      taxAmount: 0,
      totalTax: 0,
      totalAmount: amountAfterDiscount,
      grandTotal: amountAfterDiscount
    };
  }

  // 2. Non-taxable classifications: strictly 0 tax
  if (taxType !== 'Taxable') {
    return {
      hsnCode,
      taxType,
      taxMode: isInclusive ? 'Inclusive' : 'Exclusive',
      isInterState: interState,
      grossAmount,
      discPercent,
      discAmount,
      taxableAmount: amountAfterDiscount,
      gstRate: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      cessRate: 0,
      cessAmount: 0,
      taxAmount: 0,
      totalTax: 0,
      totalAmount: amountAfterDiscount,
      grandTotal: amountAfterDiscount
    };
  }

  // 3. Taxable
  const nominalGstRate = Math.max(0, parseFloat(params.gstRate || params.gst_rate || params.taxRate || params.tax_rate || params.tax_percent || 0));
  const nominalCessRate = Math.max(0, parseFloat(params.cessRate || params.cess_rate || 0));

  let taxableAmount = 0;
  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;
  let cessRate = nominalCessRate;
  let cessAmount = 0;
  let totalTax = 0;
  let totalAmount = 0;

  if (interState) {
    igstRate = nominalGstRate;
    cgstRate = 0;
    sgstRate = 0;
  } else {
    cgstRate = round2(nominalGstRate / 2);
    sgstRate = round2(nominalGstRate / 2);
    igstRate = 0;
  }

  if (isInclusive) {
    const totalTaxRate = nominalGstRate + nominalCessRate;
    totalAmount = amountAfterDiscount;
    taxableAmount = round2(totalAmount / (1 + totalTaxRate / 100));
    totalTax = round2(totalAmount - taxableAmount);

    if (interState) {
      igstAmount = totalTax;
    } else {
      cgstAmount = round2(totalTax / 2);
      sgstAmount = round2(totalTax - cgstAmount);
    }
  } else {
    taxableAmount = amountAfterDiscount;

    if (interState) {
      igstAmount = round2((taxableAmount * igstRate) / 100);
      cgstAmount = 0;
      sgstAmount = 0;
    } else {
      cgstAmount = round2((taxableAmount * cgstRate) / 100);
      sgstAmount = round2((taxableAmount * sgstRate) / 100);
      igstAmount = 0;
    }

    if (cessRate > 0) {
      cessAmount = round2((taxableAmount * cessRate) / 100);
    }

    totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
    totalAmount = round2(taxableAmount + totalTax);
  }

  return {
    hsnCode,
    taxType: 'Taxable',
    taxMode: isInclusive ? 'Inclusive' : 'Exclusive',
    isInterState: interState,
    grossAmount,
    discPercent,
    discAmount,
    taxableAmount,
    gstRate: nominalGstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    cessRate,
    cessAmount,
    taxAmount: totalTax,
    totalTax,
    totalAmount,
    grandTotal: totalAmount
  };
}

/**
 * Calculate complete invoice totals
 */
export function calculateInvoiceTax(invoiceData = {}) {
  const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
  const taxMode = invoiceData.taxMode || invoiceData.tax_mode || invoiceData.taxType || 'Exclusive';
  const companyState = invoiceData.companyState || invoiceData.company_state || 'Tamil Nadu';
  const partyState = invoiceData.partyState || invoiceData.party_state || invoiceData.supplier_state || invoiceData.customer_state || 'Tamil Nadu';
  const companyStateCode = invoiceData.companyStateCode || invoiceData.company_state_code || normalizeStateCode(companyState);
  const partyStateCode = invoiceData.partyStateCode || invoiceData.party_state_code || normalizeStateCode(partyState);

  const interState = isInterState(companyState, partyState, companyStateCode, partyStateCode);

  let totalQty = 0;
  let totalWeight = 0;
  let totalGrossAmount = 0;
  let totalDiscountAmount = 0;
  let totalTaxableAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let totalCessAmount = 0;
  let totalTaxAmount = 0;
  let baseNetAmount = 0;

  const rateSummaryMap = {};
  const hsnSummaryMap = {};
  const taxTypeSummaryMap = {
    'Taxable': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 },
    'Exempt': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 },
    'Nil Rated': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 },
    'Zero Rated': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 },
    'Non-GST': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 },
    'Without Tax': { count: 0, taxableValue: 0, taxAmount: 0, total: 0 }
  };

  const processedItems = items.map((rawItem, idx) => {
    const itemQty = parseFloat(rawItem.qty) || 0;
    const itemWt = parseFloat(rawItem.weight || rawItem.per_unit_weight || rawItem.per_unit_wt || 0) || 0;
    const lineTotalWt = parseFloat(rawItem.total_wt || rawItem.total_weight) || (itemQty * itemWt);

    totalQty += itemQty;
    totalWeight += lineTotalWt;

    const lineCalc = calculateLineTax({
      qty: itemQty,
      rate: parseFloat(rawItem.rate) || 0,
      discPercent: rawItem.disc_percent ?? rawItem.disc_perc ?? rawItem.discPercent ?? rawItem.disc,
      discAmount: rawItem.disc_amount ?? rawItem.discAmount,
      taxType: rawItem.tax_type || rawItem.taxType || invoiceData.defaultTaxType || 'Taxable',
      taxMode: rawItem.tax_mode || rawItem.taxMode || taxMode,
      gstRate: rawItem.gst_rate ?? rawItem.tax_rate ?? rawItem.tax_percent ?? rawItem.tax_perc ?? rawItem.tax ?? rawItem.taxRate,
      cessRate: rawItem.cess_rate ?? rawItem.cessRate ?? 0,
      hsnCode: rawItem.hsn_code || rawItem.hsnCode || '',
      companyState,
      partyState,
      companyStateCode,
      partyStateCode
    });

    totalGrossAmount += lineCalc.grossAmount;
    totalDiscountAmount += lineCalc.discAmount;
    totalTaxableAmount += lineCalc.taxableAmount;
    totalCgstAmount += lineCalc.cgstAmount;
    totalSgstAmount += lineCalc.sgstAmount;
    totalIgstAmount += lineCalc.igstAmount;
    totalCessAmount += lineCalc.cessAmount;
    totalTaxAmount += lineCalc.totalTax;
    baseNetAmount += lineCalc.totalAmount;

    // Rate summary
    const rateKey = `${lineCalc.taxType}_${lineCalc.gstRate}%`;
    if (!rateSummaryMap[rateKey]) {
      rateSummaryMap[rateKey] = {
        taxType: lineCalc.taxType,
        gstRate: lineCalc.gstRate,
        cgstRate: lineCalc.cgstRate,
        sgstRate: lineCalc.sgstRate,
        igstRate: lineCalc.igstRate,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        totalAmount: 0
      };
    }
    rateSummaryMap[rateKey].taxableAmount = round2(rateSummaryMap[rateKey].taxableAmount + lineCalc.taxableAmount);
    rateSummaryMap[rateKey].cgstAmount = round2(rateSummaryMap[rateKey].cgstAmount + lineCalc.cgstAmount);
    rateSummaryMap[rateKey].sgstAmount = round2(rateSummaryMap[rateKey].sgstAmount + lineCalc.sgstAmount);
    rateSummaryMap[rateKey].igstAmount = round2(rateSummaryMap[rateKey].igstAmount + lineCalc.igstAmount);
    rateSummaryMap[rateKey].cessAmount = round2(rateSummaryMap[rateKey].cessAmount + lineCalc.cessAmount);
    rateSummaryMap[rateKey].totalTax = round2(rateSummaryMap[rateKey].totalTax + lineCalc.totalTax);
    rateSummaryMap[rateKey].totalAmount = round2(rateSummaryMap[rateKey].totalAmount + lineCalc.totalAmount);

    // HSN summary
    const hsnKey = lineCalc.hsnCode || 'NO-HSN';
    if (!hsnSummaryMap[hsnKey]) {
      hsnSummaryMap[hsnKey] = {
        hsnCode: lineCalc.hsnCode,
        taxType: lineCalc.taxType,
        gstRate: lineCalc.gstRate,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: 0
      };
    }
    hsnSummaryMap[hsnKey].taxableAmount = round2(hsnSummaryMap[hsnKey].taxableAmount + lineCalc.taxableAmount);
    hsnSummaryMap[hsnKey].cgstAmount = round2(hsnSummaryMap[hsnKey].cgstAmount + lineCalc.cgstAmount);
    hsnSummaryMap[hsnKey].sgstAmount = round2(hsnSummaryMap[hsnKey].sgstAmount + lineCalc.sgstAmount);
    hsnSummaryMap[hsnKey].igstAmount = round2(hsnSummaryMap[hsnKey].igstAmount + lineCalc.igstAmount);
    hsnSummaryMap[hsnKey].totalTax = round2(hsnSummaryMap[hsnKey].totalTax + lineCalc.totalTax);
    hsnSummaryMap[hsnKey].totalAmount = round2(hsnSummaryMap[hsnKey].totalAmount + lineCalc.totalAmount);

    // Tax classification summary
    const classificationKey = lineCalc.taxMode === 'Without Tax' ? 'Without Tax' : lineCalc.taxType;
    if (taxTypeSummaryMap[classificationKey]) {
      taxTypeSummaryMap[classificationKey].count += 1;
      taxTypeSummaryMap[classificationKey].taxableValue = round2(taxTypeSummaryMap[classificationKey].taxableValue + lineCalc.taxableAmount);
      taxTypeSummaryMap[classificationKey].taxAmount = round2(taxTypeSummaryMap[classificationKey].taxAmount + lineCalc.totalTax);
      taxTypeSummaryMap[classificationKey].total = round2(taxTypeSummaryMap[classificationKey].total + lineCalc.totalAmount);
    }

    return {
      ...rawItem,
      ...lineCalc,
      s_no: idx + 1,
      qty: itemQty,
      weight: itemWt,
      total_wt: lineTotalWt,
      total_weight: lineTotalWt,
      amount: lineCalc.taxableAmount,
      net_line_total: lineCalc.totalAmount
    };
  });

  // Calculate deductions/additions
  let netDeductionAmount = 0;
  const deductions = Array.isArray(invoiceData.deductions) ? invoiceData.deductions : [];
  deductions.forEach(d => {
    const amt = parseFloat(d.amount) || 0;
    const isAdd = String(d.type || '').toUpperCase() === 'ADD' || 
                  String(d.type || '').toUpperCase() === '+' || 
                  String(d.type || '').toUpperCase() === 'ADDITION';
    if (isAdd) {
      netDeductionAmount -= amt;
    } else {
      netDeductionAmount += amt;
    }
  });

  totalGrossAmount = round2(totalGrossAmount);
  totalDiscountAmount = round2(totalDiscountAmount);
  totalTaxableAmount = round2(totalTaxableAmount);
  totalCgstAmount = round2(totalCgstAmount);
  totalSgstAmount = round2(totalSgstAmount);
  totalIgstAmount = round2(totalIgstAmount);
  totalCessAmount = round2(totalCessAmount);
  totalTaxAmount = round2(totalTaxAmount);
  baseNetAmount = round2(baseNetAmount);

  const grandTotal = round2(baseNetAmount - netDeductionAmount);

  return {
    isInterState: interState,
    companyState,
    partyState,
    companyStateCode,
    partyStateCode,
    taxMode,
    totalQty: round2(totalQty),
    totalWeight: round2(totalWeight),
    grossAmount: totalGrossAmount,
    baseAmount: totalGrossAmount,
    discAmount: totalDiscountAmount,
    discountAmount: totalDiscountAmount,
    taxableAmount: totalTaxableAmount,
    billAmount: totalTaxableAmount,
    cgstAmount: totalCgstAmount,
    sgstAmount: totalSgstAmount,
    igstAmount: totalIgstAmount,
    cessAmount: totalCessAmount,
    taxAmount: totalTaxAmount,
    netAmount: baseNetAmount,
    deductionAmount: round2(netDeductionAmount),
    grandTotal,
    items: processedItems,
    rateSummaries: Object.values(rateSummaryMap),
    hsnSummaries: Object.values(hsnSummaryMap),
    taxTypeSummaries: taxTypeSummaryMap
  };
}

// API Methods
export async function getTaxes(params = {}) {
  const query = new URLSearchParams(params).toString();
  return api(`/taxes${query ? `?${query}` : ''}`, { method: 'GET' });
}

export async function getTaxById(id) {
  return api(`/taxes/${id}`, { method: 'GET' });
}

export async function createTax(data) {
  return api('/taxes', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTax(id, data) {
  return api(`/taxes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTax(id) {
  return api(`/taxes/${id}`, { method: 'DELETE' });
}

export async function toggleTaxStatus(id, activate = true) {
  return api(`/taxes/${id}/${activate ? 'activate' : 'deactivate'}`, { method: 'POST' });
}

export async function resolveItemTax(itemId) {
  return api(`/taxes/resolve/item/${itemId}`, { method: 'GET' });
}

export async function getGSTSummaryReport(params = {}) {
  const query = new URLSearchParams(params).toString();
  return api(`/taxes/reports/gst-summary${query ? `?${query}` : ''}`, { method: 'GET' });
}
