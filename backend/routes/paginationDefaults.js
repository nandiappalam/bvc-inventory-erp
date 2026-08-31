/**
 * Centralized, immutable constants for pagination defaults used across the ERP.
 */
export const PAGINATION_DEFAULTS = Object.freeze({
  PAGE: 1,
  PAGE_SIZE: 25,
});

export const INITIAL_PAGINATION = Object.freeze({
  page: PAGINATION_DEFAULTS.PAGE,
  pageSize: PAGINATION_DEFAULTS.PAGE_SIZE,
});

export const INITIAL_SORT = Object.freeze({
  field: 'date',
  direction: 'desc',
});