/**
 * Centralized, immutable endpoint constants for the Purchase module API.
 * This avoids hardcoded strings in the service layer.
 */
export const PURCHASE_API = Object.freeze({
  BASE: '/purchases',
  ENDPOINTS: Object.freeze({
    LIST: 'purchase-list',
    NEXT_NUMBER: 'next-sno',
    VALIDATE: 'validate',
    ATTACHMENTS: 'attachments',
    APPROVE: 'approve',
    REOPEN: 'reopen',
    CANCEL: 'cancel',
  }),
});