/**
 * BVC Inventory ERP - Custom Test Assertions
 */

import { expect } from '@playwright/test';

export function assertValidApiResponse(data: any, expectedType: 'array' | 'object' = 'object') {
  expect(data).toBeDefined();
  if (expectedType === 'array') {
    expect(Array.isArray(data) || Array.isArray(data.rows) || Array.isArray(data.data) || Array.isArray(data.items)).toBeTruthy();
  } else {
    expect(typeof data).toBe('object');
  }
}

export function assertGstCalculation(item: {
  qty: number;
  rate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
  grandTotal: number;
}) {
  expect(item.taxableAmount).toBeCloseTo(item.qty * item.rate, 2);
  expect(item.totalTax).toBeCloseTo(item.cgstAmount + item.sgstAmount, 2);
  expect(item.grandTotal).toBeCloseTo(item.taxableAmount + item.totalTax, 2);
}
