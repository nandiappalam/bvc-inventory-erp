const VALID_TRANSITIONS = {
  DRAFT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['QC_PENDING', 'POSTED', 'CANCELLED'],
  QC_PENDING: ['QC_RUNNING', 'CANCELLED'],
  QC_RUNNING: ['QC_PASS', 'QC_FAIL', 'CANCELLED'],
  QC_PASS: ['APPROVED', 'POSTED', 'CANCELLED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  POSTED: ['CONSUMED', 'CANCELLED'],
  CONSUMED: [],
  CANCELLED: [],
};

function validateTransition(fromState, toState) {
  const allowed = VALID_TRANSITIONS[String(fromState || 'DRAFT')] || [];
  if (!allowed.includes(toState)) {
    throw new Error(`Illegal workflow transition: ${fromState} -> ${toState}`);
  }
  return true;
}

module.exports = {
  validateTransition,
};
