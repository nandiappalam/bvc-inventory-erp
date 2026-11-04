const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32)) {
  throw new Error('JWT_SECRET must be configured with at least 32 bytes in production.');
}

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function parseCompanyId(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function getRequestedCompanyId(req) {
  const value = req.headers['x-company-id'] || req.headers['x-tenant-id']
    || (req.query && (req.query.company_id || req.query.companyId))
    || (req.body && (req.body.company_id || req.body.companyId));
  return parseCompanyId(value);
}

function isPublicApiRequest(req) {
  if (req.method === 'OPTIONS') return true;
  const path = (req.path || '').replace(/\/+$/, '') || '/';
  return (req.method === 'POST' && path === '/api/auth/login')
    || (req.method === 'GET' && ['/api/companies', '/api/companies/list', '/api/health'].includes(path));
}

async function getAuthorizedUser(userId, companyId) {
  const parsedUserId = parseCompanyId(userId);
  const parsedCompanyId = parseCompanyId(companyId);
  if (!parsedUserId || !parsedCompanyId) return null;

  const result = await db.master.query(
    `SELECT u.id, u.username, u.role, u.company_id
       FROM users u
       JOIN companies c
         ON c.id = ?
        AND LOWER(TRIM(COALESCE(c.status, 'Active'))) = 'active'
      WHERE u.id = ?
        AND LOWER(TRIM(COALESCE(u.status, 'Active'))) = 'active'
        AND (
          u.company_id = ?
          OR EXISTS (
            SELECT 1
              FROM user_company_access a
             WHERE a.user_id = u.id AND a.company_id = ?
          )
        )
      LIMIT 1`,
    [parsedCompanyId, parsedUserId, parsedCompanyId, parsedCompanyId]
  );
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function hasCompanyAccess(userId, companyId) {
  return Boolean(await getAuthorizedUser(userId, companyId));
}

function sendUnauthorized(res) {
  return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
}

function sendForbidden(res, companyId) {
  return res.status(403).json({
    success: false,
    message: `Access denied. You do not have permission to access Company ${companyId}.`,
    code: 'TENANT_FORBIDDEN'
  });
}

function companyContextMiddleware(req, res, next) {
  if (!req.originalUrl || !req.originalUrl.startsWith('/api/')) return next();

  if (isPublicApiRequest(req)) {
    req.companyId = 1;
    req.companySchema = 'company_1';
    req.companyDb = db.forCompany(1);
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '') : null;

  if (!token) {
    return sendUnauthorized(res);
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return sendUnauthorized(res);
  }

  const tokenCompanyId = parseCompanyId(user.companyId || user.company_id);
  const requestedCompanyId = getRequestedCompanyId(req);
  if (Number.isNaN(requestedCompanyId)) {
    return res.status(400).json({ success: false, message: 'Invalid company ID', code: 'INVALID_COMPANY_ID' });
  }
  if (!tokenCompanyId || !parseCompanyId(user.id)) return sendUnauthorized(res);

  const companyId = requestedCompanyId || tokenCompanyId;
  return getAuthorizedUser(user.id, companyId).then((authorizedUser) => {
    if (!authorizedUser) return sendForbidden(res, companyId);

    req.user = {
      ...user,
      username: authorizedUser.username,
      role: authorizedUser.role,
      companyId,
      company_id: companyId,
    };
    req.companyId = companyId;
    req.companySchema = `company_${companyId}`;
    req.companyDb = db.forCompany(companyId);

    const context = { companyId, companySchema: req.companySchema, userId: req.user.id, user: req.user };
    if (db.asyncLocalStorage) {
      return db.asyncLocalStorage.run(context, next);
    }
    return next();
  }).catch((error) => {
    console.error('[SECURITY] Failed to validate company access:', error.message);
    if (!res.headersSent) {
      res.status(503).json({ success: false, message: 'Company authorization is temporarily unavailable', code: 'AUTHORIZATION_UNAVAILABLE' });
    }
  });
}

function tenantMiddleware(req, res, next) {
  const companyId = parseCompanyId(req.companyId);
  const userCompanyId = parseCompanyId(req.user && (req.user.companyId || req.user.company_id));
  if (!req.user || !companyId || !userCompanyId) return sendUnauthorized(res);
  if (companyId !== userCompanyId) return sendForbidden(res, companyId);
  return next();
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '') : null;
  if (!token) return sendUnauthorized(res);

  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (!user || !parseCompanyId(user.id) || !parseCompanyId(user.companyId || user.company_id)) {
      return sendUnauthorized(res);
    }
    const authorizedUser = req.user;
    req.user = authorizedUser
      ? {
        ...user,
        username: authorizedUser.username,
        role: authorizedUser.role,
        companyId: authorizedUser.companyId,
        company_id: authorizedUser.company_id,
      }
      : user;
    return next();
  } catch (error) {
    return sendUnauthorized(res);
  }
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = {
  companyContextMiddleware,
  tenantMiddleware,
  authenticateToken,
  authMiddleware: authenticateToken,
  generateToken,
  hasCompanyAccess,
  getAuthorizedUser,
  JWT_SECRET,
};
