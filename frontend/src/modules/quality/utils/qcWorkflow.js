// qcWorkflow.js
// Builds a UI-friendly QC draft from route/purchase context.

export function buildQcDraftFromContext({
  purchaseId,
  lotNo,
  supplier,
  item,
  batch,
  productKey,
} = {}) {
  return {
    purchaseId: purchaseId ?? '',
    lotNo: lotNo ?? '',
    supplier: supplier ?? '',
    item: item ?? '',
    batch: batch ?? '',
    productKey: productKey ?? item ?? '',

    // Header-level placeholders
    qcId: '',
    analyst: '',
    status: 'PENDING',

    remarks: '',

    // Results placeholders (empty arrays in Phase 1)
    qcResults: [],
  };
}

