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

  return {
    ...invoice,
    baseAmount: invoice.grossAmount,
    discAmount: invoice.discAmount,
    taxableAmount: invoice.taxableAmount,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.netAmount,
    netAmount: invoice.netAmount,
    deductionAmount: invoice.deductionAmount,
    grandTotal: invoice.grandTotal
  };
};
