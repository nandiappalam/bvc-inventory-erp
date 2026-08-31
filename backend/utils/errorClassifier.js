/**
 * Error Classifier for BVC Inventory ERP
 * Categorizes errors to determine recovery strategy and user message
 */

const ErrorType = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  TRANSIENT_DATABASE_ERROR: 'TRANSIENT_DATABASE_ERROR',
  DATABASE_SCHEMA_ERROR: 'DATABASE_SCHEMA_ERROR',
  DATABASE_CORRUPTION_ERROR: 'DATABASE_CORRUPTION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

function classifyError(err) {
  if (!err) {
    return {
      type: ErrorType.INTERNAL_ERROR,
      status: 500,
      retryable: false,
      userMessage: 'An unexpected error occurred.',
    };
  }

  const message = (err.message || '').toLowerCase();
  const code = (err.code || '').toString();

  // 1. Validation Errors
  if (
    err.name === 'ValidationError' ||
    message.includes('required') ||
    message.includes('invalid input') ||
    message.includes('invalid format') ||
    message.includes('must be') ||
    code === '22P02' // Postgres invalid text representation
  ) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      status: 400,
      retryable: false,
      userMessage: err.userMessage || err.message || 'The provided data is invalid.',
    };
  }

  // 2. Authentication & JWT Errors
  if (
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError' ||
    message.includes('jwt') ||
    message.includes('token expired') ||
    message.includes('invalid token') ||
    message.includes('unauthorized') ||
    message.includes('not authenticated')
  ) {
    return {
      type: ErrorType.AUTHENTICATION_ERROR,
      status: 401,
      retryable: false,
      userMessage: 'Your session has expired or is invalid. Please log in again.',
    };
  }

  // 3. Authorization & Permissions
  if (
    message.includes('forbidden') ||
    message.includes('access denied') ||
    message.includes('permission denied') ||
    message.includes('unauthorized company access')
  ) {
    return {
      type: ErrorType.AUTHORIZATION_ERROR,
      status: 403,
      retryable: false,
      userMessage: 'You do not have permission to access this resource or company.',
    };
  }

  // 4. Duplicate / Unique Constraint Violations
  if (
    code === '23505' || // Postgres unique violation
    message.includes('unique constraint') ||
    message.includes('sqlite_constraint_unique') ||
    message.includes('already exists')
  ) {
    return {
      type: ErrorType.CONFLICT_ERROR,
      status: 409,
      retryable: false,
      userMessage: 'A record with this identifier already exists. Please verify your data.',
    };
  }

  // 5. Foreign Key Violations
  if (
    code === '23503' || // Postgres foreign key violation
    message.includes('foreign key constraint') ||
    message.includes('sqlite_constraint_foreignkey')
  ) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      status: 400,
      retryable: false,
      userMessage: 'A referenced record (such as item, supplier, or account) does not exist.',
    };
  }

  // 6. Not Found
  if (
    message.includes('not found') ||
    message.includes('does not exist')
  ) {
    return {
      type: ErrorType.NOT_FOUND_ERROR,
      status: 404,
      retryable: false,
      userMessage: err.userMessage || 'The requested record was not found.',
    };
  }

  // 7. Transient Database Failures (Eligible for Automatic Retry)
  if (
    code === '40001' || // Serialization failure
    code === '40P01' || // Deadlock detected
    code === '08000' || // Connection exception
    code === '08003' || // Connection does not exist
    code === '08006' || // Connection failure
    code === '57P01' || // Admin shutdown
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('sqlite_busy') ||
    message.includes('sqlite_locked') ||
    message.includes('connection terminated') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable')
  ) {
    return {
      type: ErrorType.TRANSIENT_DATABASE_ERROR,
      status: 503,
      retryable: true,
      userMessage: 'Database is momentarily busy. The system will safely retry.',
    };
  }

  // 8. Postgres Schema / Table Missing
  if (code === '42P01' || message.includes('no such table')) {
    return {
      type: ErrorType.DATABASE_SCHEMA_ERROR,
      status: 500,
      retryable: false,
      userMessage: 'Database schema configuration mismatch. Please run pending migrations.',
    };
  }

  // 9. SQLite Corruption
  if (message.includes('sqlite_corrupt') || message.includes('database disk image is malformed')) {
    return {
      type: ErrorType.DATABASE_CORRUPTION_ERROR,
      status: 500,
      retryable: false,
      userMessage: 'Database integrity warning detected. Please contact the administrator.',
    };
  }

  // Default Internal Error
  return {
    type: ErrorType.INTERNAL_ERROR,
    status: err.status || 500,
    retryable: false,
    userMessage: 'An internal application error occurred. Please try again.',
  };
}

module.exports = {
  ErrorType,
  classifyError,
};
