import { ApiError, ERROR_CODES } from './errors';
import {
  API_BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_HEADERS,
  DEFAULT_FETCH_OPTIONS,
} from './requestConfig';

/**
 * Builds the request headers, allowing for future extension with authentication tokens.
 * @param {object} options - Contains custom headers and the request body.
 * @returns {object} The final headers object.
 */
const buildHeaders = (options = {}) => {
  const headers = {
    ...DEFAULT_HEADERS,
    ...options.headers,
  };

  // If body is FormData, the browser sets the Content-Type header automatically
  // with the correct boundary. Deleting our default 'application/json' is crucial.
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  // Future: Add Authorization header here
  // const token = getAuthToken();
  // if (token) {
  //   headers['Authorization'] = `Bearer ${token}`;
  // }
  return headers;
};

/**
 * A reusable helper to parse the response body based on its Content-Type.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} The parsed body (object, text, or null).
 */
const parseBody = async (response) => {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    const text = await response.text();
    if (!text) {
      return null; // Handle empty body for 200/201 responses
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      // Throw a specific error for malformed JSON
      throw new ApiError(
        'Invalid JSON response from server',
        response.status,
        text,
        ERROR_CODES.UNKNOWN_ERROR,
        { cause: e }
      );
    }
  }

  if (contentType) {
    return response.text();
  }

  // For 204 No Content or responses without a content-type header
  return null;
};

/**
 * Extracts a human-readable error message from various API response formats.
 * @param {any} body - The response body.
 * @returns {string|null} The extracted message or null.
 */
const extractMessage = (body) => {
  if (!body) return null;
  if (typeof body === 'string') return body;
  return (
    body.message ??
    body.error ??
    body.title ??
    null
  );
};

export const STATUS_CODE_MAP = Object.freeze({
  400: ERROR_CODES.BAD_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  422: ERROR_CODES.UNPROCESSABLE_ENTITY,
  429: ERROR_CODES.TOO_MANY_REQUESTS,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
});

/**
 * A centralized fetch wrapper for all API communication.
 * @param {string} url - The URL path, relative to the API_BASE_URL.
 * @param {RequestInit & { timeout?: number }} options - The options for the fetch request.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response.
 * @throws {ApiError} Throws an ApiError for all network and HTTP errors.
 */
const request = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  try {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        ...DEFAULT_FETCH_OPTIONS,
        headers: buildHeaders(options),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out', 0, null, ERROR_CODES.TIMEOUT_ERROR);
      }
      // Preserve original error for easier debugging
      throw new ApiError(err.message || 'Network Error', 0, null, ERROR_CODES.NETWORK_ERROR, { cause: err });
    }

    const body = await parseBody(response);

    if (!response.ok) {
      const errorMessage = extractMessage(body) || `HTTP error! status: ${response.status}`;
      const errorCode = STATUS_CODE_MAP[response.status] || ERROR_CODES.SERVER_ERROR;
      throw new ApiError(errorMessage, response.status, body, errorCode);
    }

    return body;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Helper to create a request configuration with a JSON body.
 * @param {'POST' | 'PUT' | 'PATCH'} method - The HTTP method.
 * @param {any} body - The request body.
 * @param {RequestInit} options - Additional fetch options.
 * @returns {object} The complete request options object.
 */
const withBody = (method, body, options) => ({
  ...options,
  method,
  // Do not stringify FormData, the browser handles it.
  body: body instanceof FormData ? body : JSON.stringify(body),
});

export const apiClient = {
  /**
   * Performs a GET request.
   * @param {string} url - The URL path.
   * @param {RequestInit} [options] - Optional fetch options.
   * @returns {Promise<any>}
   */
  get: (url, options) => request(url, { ...options, method: 'GET' }),

  /**
   * Performs a POST request.
   * @param {string} url - The URL path.
   * @param {any} body - The request body.
   * @param {RequestInit} [options] - Optional fetch options.
   * @returns {Promise<any>}
   */
  post: (url, body, options) => request(url, withBody('POST', body, options)),

  /**
   * Performs a PUT request.
   * @param {string} url - The URL path.
   * @param {any} body - The request body.
   * @param {RequestInit} [options] - Optional fetch options.
   * @returns {Promise<any>}
   */
  put: (url, body, options) => request(url, withBody('PUT', body, options)),

  /**
   * Performs a PATCH request.
   * @param {string} url - The URL path.
   * @param {any} body - The request body.
   * @param {RequestInit} [options] - Optional fetch options.
   * @returns {Promise<any>}
   */
  patch: (url, body, options) => request(url, withBody('PATCH', body, options)),

  /**
   * Performs a DELETE request.
   * @param {string} url - The URL path.
   * @param {RequestInit} [options] - Optional fetch options.
   * @returns {Promise<any>}
   */
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
  request,
};
export { request };