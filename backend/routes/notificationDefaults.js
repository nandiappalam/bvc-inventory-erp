/**
 * Centralized, immutable constants for notification defaults used across the ERP.
 * This ensures consistency and avoids hardcoded values.
 */
export const NOTIFICATION_DEFAULTS = Object.freeze({
  DURATION: 6000,
  ANCHOR_ORIGIN: {
    vertical: 'bottom',
    horizontal: 'right',
  },
  AUTO_HIDE: true,
});