/**
 * BVC Inventory ERP — Company Context Middleware
 *
 * Company context MUST come from the authenticated database user.
 * NEVER trust company_id from:
 *   - req.body
 *   - req.query
 *   - req.params
 *   - localStorage
 *   - frontend state
 */

function companyContext(req, res, next) {
  // authenticate.js must have already established the company.
  if (
    req.companyId === undefined ||
    req.companyId === null ||
    req.companyId === ''
  ) {
    return res.status(401).json({
      success: false,
      errorCode: 'COMPANY_CONTEXT_REQUIRED',
      message: 'Authenticated company context is required.',
    });
  }

  // Make sure company ID is also consistent with authenticated user.
  if (
    req.user &&
    req.user.company_id !== undefined &&
    req.user.company_id !== null &&
    String(req.companyId) !== String(req.user.company_id)
  ) {
    console.error(
      '🚨 COMPANY CONTEXT MISMATCH:',
      {
        requestCompanyId: req.companyId,
        userCompanyId: req.user.company_id,
        userId: req.user.id,
        requestId: req.requestId,
      }
    );

    return res.status(403).json({
      success: false,
      errorCode: 'COMPANY_CONTEXT_MISMATCH',
      message: 'Invalid company context.',
    });
  }

  return next();
}

module.exports = companyContext;