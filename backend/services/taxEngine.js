/**
 * Centralized Indian GST / Tax Engine for BVC ERP
 * Handles:
 * 1. Tax Classification (Taxable, Exempt, Nil Rated, Zero Rated, Non-GST)
 * 2. Transaction Tax Mode (Normal/Exclusive/Inclusive vs Without Tax)
 * 3. State-based Determination (Intra-State: CGST + SGST vs Inter-State: IGST)
 * 4. Multi-item rate calculation (5%, 12%, 18%, 28%, 0%)
 * 5. Pre-discount vs Post-discount taxable base
 * 6. Line item snapshots & invoice tax aggregation
 */

// Helper to round to 2 decimal places with mathematical precision
function round2(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Indian State Codes standard map (fallback if state code not provided)
const STATE_CODE_MAP = {
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
  'or': '21',
  'assam': '18',
  'as': '18'
};

/**
 * Normalize state to state code
 */
function normalizeStateCode(stateNameOrCode) {
  if (!stateNameOrCode) return '33'; // Default to Tamil Nadu
  const str = String(stateNameOrCode).trim().toLowerCase();
  if (/^\d{2}$/.test(str)) {
    return str;
  }
  return STATE_CODE_MAP[str] || '33';
}

/**
 * Determine if transaction is Inter-State (IGST) or Intra-State (CGST + SGST)
 */
function isInterStateTransaction(companyState, partyState, companyStateCode, partyStateCode) {
  const cCode = companyStateCode || normalizeStateCode(companyState);
  const pCode = partyStateCode || normalizeStateCode(partyState);
  return String(cCode).trim() !== String(pCode).trim();
}

/**
 * Calculate tax for a SINGLE LINE ITEM
 * 
 * @param {Object} params
 * @param {number} params.qty
 * @param {number} params.rate
 * @param {number} [params.discPercent=0]
 * @param {number} [params.discAmount]
 * @param {string} [params.taxType='Taxable'] - 'Taxable' | 'Exempt' | 'Nil Rated' | 'Zero Rated' | 'Non-GST'
 * @param {string} [params.taxMode='Exclusive'] - 'Exclusive' | 'Inclusive' | 'Without Tax' | 'WITHOUT_TAX' | 'Normal'
 * @param {number} [params.gstRate=0] - Configured GST Rate % (e.g. 5, 12, 18)
 * @param {number} [params.cessRate=0] - Optional CESS Rate %
 * @param {string} [params.hsnCode='']
 * @param {string} [params.companyState='Tamil Nadu']
 * @param {string} [params.partyState='Tamil Nadu']
 * @param {string} [params.companyStateCode='33']
 * @param {string} [params.partyStateCode='33']
 * @returns {Object} Line tax breakdown
 */
function calculateLineTax(params = {}) {
  const qty = Math.max(0, parseFloat(params.qty) || 0);
  const rate = Math.max(0, parseFloat(params.rate) || 0);
  const grossAmount = round2(qty * rate);

  // Discount handling (discount before tax)
  let discPercent = parseFloat(params.discPercent || params.disc_percent || params.disc || 0) || 0;
  let discAmount = params.discAmount !== undefined && params.discAmount !== null && params.discAmount !== ''
    ? parseFloat(params.discAmount)
    : round2(grossAmount * (discPercent / 100));
  
  if (discAmount > grossAmount) discAmount = grossAmount;
  discAmount = round2(discAmount);

  const amountAfterDiscount = round2(grossAmount - discAmount);

  // Normalize Tax Mode & Tax Type
  const rawMode = String(params.taxMode || params.tax_mode || params.taxTypeMode || 'Exclusive').trim();
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

  // Inter-state determination
  const isInterState = isInterStateTransaction(
    params.companyState, 
    params.partyState, 
    params.companyStateCode, 
    params.partyStateCode
  );

  const hsnCode = String(params.hsnCode || params.hsn_code || '').trim();

  // BASELINE CASE 1: WITHOUT TAX
  // If Tax Mode is Without Tax, ALL tax must be strictly 0, regardless of Item Master / Tax Master
  if (isWithoutTax) {
    return {
      hsnCode,
      taxType,
      taxMode: 'Without Tax',
      isInterState,
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

  // BASELINE CASE 2: NON-TAXABLE CLASSIFICATIONS (Exempt, Nil Rated, Zero Rated, Non-GST)
  if (taxType !== 'Taxable') {
    return {
      hsnCode,
      taxType,
      taxMode: isInclusive ? 'Inclusive' : 'Exclusive',
      isInterState,
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

  // BASELINE CASE 3: TAXABLE
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

  if (isInterState) {
    igstRate = nominalGstRate;
    cgstRate = 0;
    sgstRate = 0;
  } else {
    cgstRate = round2(nominalGstRate / 2);
    sgstRate = round2(nominalGstRate / 2);
    igstRate = 0;
  }

  if (isInclusive) {
    // Reverse calculation for tax inclusive
    const totalTaxRate = nominalGstRate + nominalCessRate;
    totalAmount = amountAfterDiscount;
    taxableAmount = round2(totalAmount / (1 + totalTaxRate / 100));
    totalTax = round2(totalAmount - taxableAmount);

    if (isInterState) {
      igstAmount = totalTax;
    } else {
      cgstAmount = round2(totalTax / 2);
      sgstAmount = round2(totalTax - cgstAmount); // Avoid rounding mismatch
    }
  } else {
    // Standard Tax Exclusive calculation
    taxableAmount = amountAfterDiscount;

    if (isInterState) {
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
    isInterState,
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
 * Calculate complete invoice totals with multi-item tax breakdown and tax summary
 * 
 * @param {Object} invoiceData
 * @param {Array} invoiceData.items - Array of item objects
 * @param {string} [invoiceData.taxMode='Exclusive'] - 'Exclusive' | 'Inclusive' | 'Without Tax'
 * @param {string} [invoiceData.companyState='Tamil Nadu']
 * @param {string} [invoiceData.partyState='Tamil Nadu']
 * @param {string} [invoiceData.companyStateCode='33']
 * @param {string} [invoiceData.partyStateCode='33']
 * @param {Array} [invoiceData.deductions=[]] - Optional additional deductions / additions
 * @returns {Object} Complete invoice summary with line snapshots and tax summaries
 */
function calculateInvoiceTax(invoiceData = {}) {
  const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
  const taxMode = invoiceData.taxMode || invoiceData.tax_mode || invoiceData.taxType || 'Exclusive';
  const companyState = invoiceData.companyState || invoiceData.company_state || 'Tamil Nadu';
  const partyState = invoiceData.partyState || invoiceData.party_state || invoiceData.supplier_state || invoiceData.customer_state || 'Tamil Nadu';
  const companyStateCode = invoiceData.companyStateCode || invoiceData.company_state_code || normalizeStateCode(companyState);
  const partyStateCode = invoiceData.partyStateCode || invoiceData.party_state_code || normalizeStateCode(partyState);

  const isInterState = isInterStateTransaction(companyState, partyState, companyStateCode, partyStateCode);

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

  // Rate-wise and HSN-wise tax summary grouping maps
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

    // Rate summary aggregation
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

    // HSN summary aggregation
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

    // Tax Type summary aggregation
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
      amount: lineCalc.taxableAmount, // Canonical taxable base
      net_line_total: lineCalc.totalAmount
    };
  });

  // Calculate deductions/additions if present
  let netDeductionAmount = 0;
  const deductions = Array.isArray(invoiceData.deductions) ? invoiceData.deductions : [];
  deductions.forEach(d => {
    const amt = parseFloat(d.amount) || 0;
    const isAdd = String(d.type || '').toUpperCase() === 'ADD' || 
                  String(d.type || '').toUpperCase() === '+' || 
                  String(d.type || '').toUpperCase() === 'ADDITION';
    if (isAdd) {
      netDeductionAmount -= amt; // Negative deduction = addition to net amount
    } else {
      netDeductionAmount += amt; // Positive deduction = subtracted from net amount
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
    isInterState,
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

module.exports = {
  round2,
  STATE_CODE_MAP,
  normalizeStateCode,
  isInterStateTransaction,
  calculateLineTax,
  calculateInvoiceTax
};
