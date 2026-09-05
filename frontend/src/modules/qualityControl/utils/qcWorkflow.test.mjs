import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQcDraftFromContext, buildIqrDraftFromQc } from './qcWorkflow.mjs';

test('buildQcDraftFromContext carries purchase and lot context', () => {
  const draft = buildQcDraftFromContext({
    purchaseId: 7,
    lotNo: 'LOT0008',
    supplier: 'ABC Suppliers',
    item: 'Urad',
    batch: 'B-001',
  });

  assert.equal(draft.purchaseId, 7);
  assert.equal(draft.lotNo, 'LOT0008');
  assert.equal(draft.supplier, 'ABC Suppliers');
  assert.equal(draft.item, 'Urad');
  assert.equal(draft.batch, 'B-001');
});

test('buildIqrDraftFromQc derives an incoming quality draft from QC', () => {
  const draft = buildIqrDraftFromQc({
    qcId: 11,
    purchaseId: 7,
    lotNo: 'LOT0008',
    supplier: 'ABC Suppliers',
    item: 'Urad',
    batch: 'B-001',
  });

  assert.equal(draft.qcId, 11);
  assert.equal(draft.purchaseId, 7);
  assert.equal(draft.lotNo, 'LOT0008');
  assert.equal(draft.status, 'PENDING_APPROVAL');
});
