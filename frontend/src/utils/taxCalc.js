/**
 * Tax Calculation Utilities for ERP Entry Pages
 * Centralized logic for Indian GST compliant calculation
 */

import {
  calculateLineTax,
  calculateInvoiceTax,
  round2,
  isInterState,
  normalizeStateCode,
  STATE_CODE_MAP,
  INDIAN_STATES,
  TAX_CLASSIFICATIONS,
  TRANSACTION_TAX_MODES
} from '../services/taxService';

export {
  calculateLineTax,
  calculateInvoiceTax,
  round2,
  isInterState,
  normalizeStateCode,
  STATE_CODE_MAP,
  INDIAN_STATES,
  TAX_CLASSIFICATIONS,
  TRANSACTION_TAX_MODES
};

/**
 * Calculate tax for SINGLE ROW (Legacy-compatible wrapper)
 */
export const calculateRow = (row, taxType, taxRate, partyState, companyState) => {
  const calc = calculateLineTax({
    qty: row.qty,
    rate: row.rate,
    discPercent: row.disc || row.disc_pct || row.discPercent || row.disc_perc || 0,
    discAmount: row.disc_amount || row.discAmount,
    taxType: row.tax_type || row.taxType || 'Taxable',
    taxMode: taxType || row.tax_mode || row.taxMode || 'Exclusive',
    gstRate: row.tax || row.tax_rate || row.taxPercent || row.tax_perc || taxRate || 0,
    hsnCode: row.hsn_code || row.hsnCode || '',
    companyState: companyState || 'Tamil Nadu',
    partyState: partyState || 'Tamil Nadu'
  });

  return {
    ...calc,
    baseAmount: calc.grossAmount,
    discountAmount: calc.discAmount,
    taxableAmount: calc.taxableAmount,
    taxAmount: calc.totalTax,
    totalAmount: calc.totalAmount,
    grandTotal: calc.grandTotal
  };
};

/**
 * Calculate totals for ALL ROWS (Legacy-compatible wrapper)
 */
export const calculateTotals = (rows, taxType, taxRate, partyState, companyState, deductions = []) => {
  const invoice = calculateInvoiceTax({
    items: rows,
    taxMode: taxType,
    defaultTaxType: 'Taxable',
    companyState: companyState || 'Tamil Nadu',
    partyState: partyState || 'Tamil Nadu',
    deductions: deductions
  });

  const isWithoutTax = String(taxType || '').toLowerCase().includes('without');
  const rates = (invoice.rateSummaries || []).map(r => parseFloat(r.gstRate)).filter(r => !isNaN(r) && r > 0);
  const primaryRate = rates.length > 0 ? rates[0] : (parseFloat(taxRate) || 0);

  let taxPercentDisplay = '0% (Exempt)';
  if (isWithoutTax) {
    taxPercentDisplay = '0% (Without Tax)';
  } else if (invoice.rateSummaries && invoice.rateSummaries.length > 0) {
    taxPercentDisplay = invoice.rateSummaries.map(rs => {
      const r = parseFloat(rs.gstRate || 0);
      const half = (r / 2).toFixed(1).replace(/\.0$/, '');
      return invoice.isInterState ? `${r}% (IGST ${r}%)` : `${r}% (${half}% + ${half}%)`;
    }).join(', ');
  } else if (primaryRate > 0) {
    const half = (primaryRate / 2).toFixed(1).replace(/\.0$/, '');
    taxPercentDisplay = invoice.isInterState ? `${primaryRate}% (IGST ${primaryRate}%)` : `${primaryRate}% (${half}% + ${half}%)`;
  }

  const explicitDiscPercents = (rows || [])
    .map(r => parseFloat(r.disc ?? r.disc_percent ?? r.disc_perc ?? 0))
    .filter(d => !isNaN(d) && d > 0);
  const primaryDiscPercent = explicitDiscPercents.length > 0
    ? explicitDiscPercents[0]
    : (invoice.grossAmount > 0 ? Number(((invoice.discAmount / invoice.grossAmount) * 100).toFixed(2)) : 0);

  return {
    ...invoice,
    grossAmount: invoice.grossAmount,
    baseAmount: invoice.grossAmount,
    discAmount: invoice.discAmount,
    discountAmount: invoice.discAmount,
    discPercent: primaryDiscPercent,
    taxableAmount: invoice.taxableAmount,
    billAmount: invoice.taxableAmount,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.netAmount,
    netAmount: invoice.netAmount,
    deductionAmount: invoice.deductionAmount,
    grandTotal: invoice.grandTotal,
    cgstAmount: invoice.cgstAmount,
    sgstAmount: invoice.sgstAmount,
    igstAmount: invoice.igstAmount,
    primaryTaxRate: primaryRate,
    tax_percent: primaryRate,
    taxPercentDisplay
  };
};
