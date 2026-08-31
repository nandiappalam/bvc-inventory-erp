/**
 * Central Error Handler Middleware for Express
 * Catches all route and uncaught errors, classifies them, generates diagnostic ID, and returns safe JSON response
 */

const { classifyError } = require('../utils/errorClassifier');
const errorLogger = require('../services/ErrorLoggerService');

function globalErrorHandler(err, req, res, next) {
  // If response headers already sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  const classification = classifyError(err);
  const diagnosticId = errorLogger.generateDiagnosticId();

  // Extract request context safely
  const context = {
    diagnosticId,
    errorType: classification.type,
    statusCode: classification.status,
    route: req.originalUrl || req.url,
    method: req.method,
    companyId: req.companyId || (req.user && req.user.company_id) || 'global',
    userId: req.user ? req.user.id : 'anonymous',
  };

  // Log diagnostic error
  errorLogger.logError(err, context);

  // Return safe, user-friendly JSON response
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(classification.status).json({
    success: false,
    error: {
      code: classification.type,
      message: classification.userMessage,
      diagnosticId,
      retryable: classification.retryable,
      details: isDev ? err.message : undefined,
    },
  });
}

module.exports = {
  globalErrorHandler,
};
