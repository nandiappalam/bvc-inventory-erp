/**
 * Centralized, immutable error codes for the shared apiClient.
 * This file contains constants only and no logic.
 */
export const ERROR_CODES = Object.freeze({
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  BAD_REQUEST: 'BAD_REQUEST', // 400
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT', // 409
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY', // 422
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS', // 429
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE', // 503
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

/**
 * A custom error class for handling API-specific errors.
 * This allows for better type checking and consistent error objects.
 */
export class ApiError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code.
   * @param {any} body - The parsed response body.
   * @param {string} code - A machine-readable error code from ERROR_CODES.
   * @param {ErrorOptions} [options] - Options for the Error constructor, e.g., `{ cause: originalError }`.
   */
  constructor(message, status, body, code = ERROR_CODES.UNKNOWN_ERROR, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}