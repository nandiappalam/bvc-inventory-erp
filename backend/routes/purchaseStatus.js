/**
 * Centralized status constants for the Purchase module.
 * This avoids magic strings and ensures consistency across the application.
 */

export const PURCHASE_STATUS = Object.freeze({
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

export const QC_STATUS = Object.freeze({
  PENDING: 'QC_PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  HOLD: 'HOLD',
});