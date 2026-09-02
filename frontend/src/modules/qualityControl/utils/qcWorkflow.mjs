export const buildQcDraftFromContext = (context = {}) => ({
  purchaseId: context.purchaseId || '',
  lotNo: context.lotNo || '',
  supplier: context.supplier || '',
  item: context.item || '',
  batch: context.batch || '',
  inspectorName: context.inspectorName || '',
  inspectionDate: context.inspectionDate || new Date().toISOString().slice(0, 10),
  status: context.status || 'PASS',
  remarks: context.remarks || '',
  parameters: Array.isArray(context.parameters) ? context.parameters : [
    { parameter: 'Moisture', expected: '', actual: '', result: 'PASS', remarks: '' },
    { parameter: 'Foreign Matter', expected: '', actual: '', result: 'PASS', remarks: '' },
  ],
});

export const buildIqrDraftFromQc = (context = {}) => ({
  qcId: context.qcId || '',
  purchaseId: context.purchaseId || '',
  lotNo: context.lotNo || '',
  supplier: context.supplier || '',
  item: context.item || '',
  batch: context.batch || '',
  reportNo: context.reportNo || '',
  status: context.status || 'PENDING_APPROVAL',
  remarks: context.remarks || '',
});
