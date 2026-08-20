/**
 * Centralized, immutable constants for confirmation dialog defaults used across the ERP.
 * This ensures consistency and avoids hardcoded values.
 */
export const DIALOG_DEFAULTS = Object.freeze({
  TITLE: 'Confirm Action',
  MESSAGE: 'Are you sure you want to proceed?',
  CONFIRM_TEXT: 'Confirm',
  CANCEL_TEXT: 'Cancel',
  SEVERITY: 'info',
  disableEscapeKeyDown: false,
  disableBackdropClick: false,
});