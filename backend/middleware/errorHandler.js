/**
 * BVC Inventory ERP — Centralized Error Handler
 *
 * Handles all error types and returns standardized JSON responses.
 * Never returns raw stack traces to production users.
 */

// Custom error classes for structured error handling
class AppError extends Error {
  constructor(message, statusCode, errorCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message || 'Validation failed', 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_REQUIRED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'COMPANY_ACCESS_DENIED');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'RECORD_NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'DUPLICATE_RECORD');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database error') {
    super(message, 503, 'DATABASE_ERROR');
  }
}

/**
 * Centralized error handling middleware.
 * Must be registered LAST (after all routes).
 */
function errorHandler(err, req, res, next) {
  // If response already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || 'unknown';

  // Log the error with structured information
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    route: req.route ? req.route.path : req.path,
    userId: req.user ? req.user.id : null,
    companyId: req.companyId || null,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    message: err.message,
  };

  // Log to console (in production, use a proper logging service)
  if (err.statusCode >= 500) {
    console.error('🔥 ERROR:', JSON.stringify(logEntry), err.stack);
  } else {
    console.warn('⚠️ ERROR:', JSON.stringify(logEntry));
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build response
  const response = {
    success: false,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Internal Server Error',
    requestId,
  };

  // Add details for validation errors
  if (err.details) {
    response.details = err.details;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  errorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
};
