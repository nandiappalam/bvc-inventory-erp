/**
 * BVC Inventory ERP — Request ID Middleware
 *
 * Assigns a unique request ID to every incoming request.
 * The ID is available as req.requestId and in the X-Request-ID response header.
 * Used for tracing errors in logs.
 */
const crypto = require('crypto');

function requestId(req, res, next) {
  // Use existing request ID from header, or generate a new one
  const id = req.get('X-Request-ID') || `REQ-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestId;
