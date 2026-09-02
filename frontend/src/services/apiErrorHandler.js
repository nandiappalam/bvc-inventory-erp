/**
 * Frontend API Error Handler & Normalizer
 * Extracts diagnostic IDs, friendly messages, and retryability
 */

export function parseApiError(error) {
  if (!error) {
    return {
      message: 'An unknown error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      status: 500,
      diagnosticId: null,
      retryable: false,
    };
  }

  // Network / Offline error
  if (!navigator.onLine || error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
    return {
      message: 'Network connection lost. Please check your internet connection or server status.',
      code: 'NETWORK_ERROR',
      status: 0,
      diagnosticId: null,
      retryable: true,
    };
  }

  const response = error.response;
  if (!response) {
    return {
      message: error.message || 'Unable to connect to the server.',
      code: 'CONNECTION_ERROR',
      status: 0,
      diagnosticId: null,
      retryable: true,
    };
  }

  const status = response.status;
  const data = response.data || {};
  const serverError = data.error || {};

  const diagnosticId = serverError.diagnosticId || data.diagnosticId || null;
  const code = serverError.code || data.code || `HTTP_${status}`;
  const retryable = serverError.retryable || [502, 503, 504].includes(status);

  let message = serverError.message || data.message;

  if (!message) {
    switch (status) {
      case 400:
        message = 'Invalid request data. Please check the entered fields.';
        break;
      case 401:
        message = 'Your session has expired. Please log in again.';
        break;
      case 403:
        message = 'You do not have permission to perform this action.';
        break;
      case 404:
        message = 'The requested record or resource was not found.';
        break;
      case 409:
        message = 'A record with this information already exists.';
        break;
      case 422:
        message = 'Validation failed for the submitted values.';
        break;
      case 502:
      case 503:
      case 504:
        message = 'The server or database is temporarily unavailable. Please retry in a moment.';
        break;
      default:
        message = 'An unexpected server error occurred. Please try again.';
        break;
    }
  }

  return {
    message,
    code,
    status,
    diagnosticId,
    retryable,
    details: serverError.details || null,
  };
}
