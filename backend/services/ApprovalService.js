async function approve({ entityType, entityId, approvedBy, note = '' }) {
  return {
    entityType,
    entityId,
    status: 'APPROVED',
    approvedBy,
    note,
  };
}

async function reject({ entityType, entityId, rejectedBy, note = '' }) {
  return {
    entityType,
    entityId,
    status: 'REJECTED',
    rejectedBy,
    note,
  };
}

module.exports = {
  approve,
  reject,
};
