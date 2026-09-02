/**
 * Centralized, immutable configuration for the shared apiClient.
 * This file contains configuration only and no logic.
 */

/**
 * The base URL for all API requests.
 */
export const API_BASE_URL = '/api';

/**
 * The default request timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 15000;

/**
 * Default headers sent with every JSON request.
 */
export const DEFAULT_HEADERS = Object.freeze({
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/**
 * Default options for the native fetch API.
 */
export const DEFAULT_FETCH_OPTIONS = Object.freeze({
  credentials: 'same-origin',
  // Future options like mode, cache, redirect can be added here
});

/**
 * An aggregate object containing all request configurations for convenient import.
 */
export const REQUEST_CONFIG = Object.freeze({
  API_BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_HEADERS,
  DEFAULT_FETCH_OPTIONS,
});