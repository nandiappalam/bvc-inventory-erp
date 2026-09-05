/**
 * Error Logger Service for BVC Inventory ERP
 * Centralizes diagnostic logging, unique diagnostic ID generation, and recent error audits
 */

const crypto = require('crypto');

class ErrorLoggerService {
  constructor() {
    // Keep an in-memory ring buffer of the last 100 errors for admin diagnostic inspection
    this.maxBufferSize = 100;
    this.errorBuffer = [];
  }

  generateDiagnosticId() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `ERR-${today}-${rand}`;
  }

  logError(err, context = {}) {
    const diagnosticId = context.diagnosticId || this.generateDiagnosticId();
    const timestamp = new Date().toISOString();
    const severity = context.severity || (err.status >= 500 ? 'ERROR' : 'WARNING');

    const errorRecord = {
      diagnosticId,
      timestamp,
      severity,
      errorType: context.errorType || 'INTERNAL_ERROR',
      statusCode: context.statusCode || 500,
      message: err.message || 'Unknown error',
      route: context.route || 'N/A',
      method: context.method || 'N/A',
      companyId: context.companyId || 'global',
      userId: context.userId || 'anonymous',
      databaseEngine: context.databaseEngine || (process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };

    // Store in ring buffer
    this.errorBuffer.unshift(errorRecord);
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.pop();
    }

    // Output formatted server console log
    console.error(
      `[${severity}] [${diagnosticId}] route=${errorRecord.method} ${errorRecord.route} ` +
      `companyId=${errorRecord.companyId} userId=${errorRecord.userId} ` +
      `type=${errorRecord.errorType} msg="${errorRecord.message}"`
    );

    return diagnosticId;
  }

  getRecentErrors(limit = 50) {
    return this.errorBuffer.slice(0, Math.min(limit, this.maxBufferSize));
  }

  clearErrors() {
    this.errorBuffer = [];
  }
}

module.exports = new ErrorLoggerService();
