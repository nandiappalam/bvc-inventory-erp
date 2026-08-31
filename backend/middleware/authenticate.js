/**
 * BVC Inventory ERP — Centralized Authentication Middleware
 *
 * Every protected API must use this middleware.
 * It reads the JWT from the Authorization header, validates it,
 * and sets req.user and req.company.
 *
 * Company context is NEVER trusted from the frontend.
 */
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// const JWT_SECRET = process.env.JWT_SECRET || 'bvc-development-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
/**
 * Authentication middleware.
 * Verifies JWT token and sets req.user and req.company.
 *
 * @param {Object} options
 * @param {boolean} options.optional - If true, don't reject unauthenticated requests (just set req.user = null)
 */
function authenticateRequest(options = {}) {
  const { optional = false } = options;

  return async (req, res, next) => {
    try {
      const authorization = req.get('Authorization') || '';

      if (!authorization.startsWith('Bearer ')) {
        if (optional) {
          req.user = null;
          req.company = null;
          return next();
        }
        return res.status(401).json({
          success: false,
          errorCode: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required.',
        });
      }

      const token = authorization.slice(7);

      let claims;
      try {
        claims = jwt.verify(token, JWT_SECRET);
      } catch (jwtError) {
        if (optional) {
          req.user = null;
          req.company = null;
          return next();
        }
        return res.status(401).json({
          success: false,
          errorCode: 'INVALID_SESSION',
          message: 'Your session is invalid or expired. Please log in again.',
        });
      }

      // Look up the user in the database to verify they still exist and are active
      const userResult = await db.query(
        'SELECT id, username, role, status, company_id FROM users WHERE id = ?',
        [claims.userId]
      );

      if (!userResult.rows || userResult.rows.length === 0) {
        if (optional) {
          req.user = null;
          req.company = null;
          return next();
        }
        return res.status(401).json({
          success: false,
          errorCode: 'INVALID_SESSION',
          message: 'Your session is invalid or expired. Please log in again.',
        });
      }

      const user = userResult.rows[0];

      if (user.status && user.status.toLowerCase() === 'inactive') {
        return res.status(403).json({
          success: false,
          errorCode: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive. Please contact your administrator.',
        });
      }

      // Look up the company to verify it's active
      const companyResult = await db.query(
        'SELECT id, name, company_code, status FROM companies WHERE id = ? AND LOWER(COALESCE(status, \'active\')) = \'active\'',
        [claims.companyId]
      );

      if (!companyResult.rows || companyResult.rows.length === 0) {
        if (optional) {
          req.user = null;
          req.company = null;
          return next();
        }
        return res.status(403).json({
          success: false,
          errorCode: 'COMPANY_ACCESS_DENIED',
          message: 'You do not have access to this company.',
        });
      }

      const company = companyResult.rows[0];

      // Verify the user belongs to the company in the token
      if (user.company_id !== company.id) {
        if (optional) {
          req.user = null;
          req.company = null;
          return next();
        }
        return res.status(403).json({
          success: false,
          errorCode: 'COMPANY_ACCESS_DENIED',
          message: 'You do not have access to this company.',
        });
      }

      // Set authenticated user and company context
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };

      req.company = {
        id: company.id,
        name: company.name,
        code: company.company_code,
      };

      // Company ID comes from the authenticated session, NOT from the frontend
      req.companyId = company.id;

      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      if (optional) {
        req.user = null;
        req.company = null;
        return next();
      }
      return res.status(500).json({
        success: false,
        errorCode: 'AUTH_ERROR',
        message: 'An error occurred during authentication.',
      });
    }
  };
}

module.exports = authenticateRequest;
