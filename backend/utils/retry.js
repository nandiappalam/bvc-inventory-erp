/**
 * Safe Retry Utility with Exponential Backoff
 * Used strictly for idempotent or transient database operations
 */

const { classifyError, ErrorType } = require('./errorClassifier');

/**
 * Execute an async operation with automatic retry on transient errors
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Configuration options
 * @returns {Promise<any>}
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 200; // ms
  const factor = options.factor || 2;
  const operationName = options.name || 'DatabaseOperation';

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      const classification = classifyError(err);

      // Only retry if error is classified as transient
      if (!classification.retryable || attempt >= maxRetries) {
        throw err;
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), 2000);
      console.warn(`[Retry Warning] ${operationName} failed with transient error (${err.message || classification.type}). Retrying attempt ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  withRetry,
};
