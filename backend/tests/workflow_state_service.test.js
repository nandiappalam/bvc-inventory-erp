const test = require('node:test');
const assert = require('node:assert/strict');
const { upsertState, appendHistory, getState, getHistory } = require('../services/WorkflowStateService');

test('WorkflowStateService persists workflow state and history', async () => {
  const entityType = 'rm_lot';
  const entityId = 99999;

  await upsertState({
    entityType,
    entityId,
    workflowState: 'RECEIVED',
    status: 'QC_PENDING',
    metadata: { lotNo: 'LOT9999' },
  });

  await appendHistory({
    entityType,
    entityId,
    fromState: 'DRAFT',
    toState: 'RECEIVED',
    action: 'RECEIPT_SAVED',
    remarks: 'Receipt persisted',
  });

  const state = await getState({ entityType, entityId });
  const history = await getHistory({ entityType, entityId });

  assert.equal(state?.workflow_state, 'RECEIVED');
  assert.equal(state?.status, 'QC_PENDING');
  assert.equal(history.length > 0, true);
  assert.equal(history[0]?.action, 'RECEIPT_SAVED');
});
