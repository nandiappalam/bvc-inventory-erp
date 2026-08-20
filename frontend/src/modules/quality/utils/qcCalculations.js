// qcCalculations.js
// Pure functions for deriving parameter status + overall QC result.

const normalizeStatus = (s) => {
  const v = String(s ?? '').trim().toUpperCase();
  if (!v) return '';
  return v;
};

export function computeOverallFromResults(qcResults = []) {
  const statuses = qcResults.map((r) => normalizeStatus(r?.status));

  const total = statuses.length;
  const pass = statuses.filter((s) => s === 'PASS').length;
  const fail = statuses.filter((s) => s === 'FAIL').length;
  const pending = statuses.filter((s) => !s || s === 'PENDING').length;

  const scoreTotal = Math.max(1, total);
  const overallScore = Math.round((pass / scoreTotal) * 100);

  let overallResult = 'PENDING';
  if (fail > 0 && pass === 0) overallResult = 'REJECTED';
  else if (fail > 0) overallResult = 'HOLD';
  else if (pending > 0) overallResult = 'PENDING';
  else overallResult = 'ACCEPTED';

  let recommendation = 'Pending';
  if (overallResult === 'ACCEPTED') recommendation = 'Accept';
  if (overallResult === 'REJECTED') recommendation = 'Reject';
  if (overallResult === 'HOLD') recommendation = 'Hold';

  return {
    total,
    pass,
    fail,
    pending,
    overallScore,
    overallResult,
    recommendation,
  };
}

export function computeCategoryPassRate(qcResults = [], category) {
  const cat = String(category ?? '').trim().toLowerCase();
  const filtered = qcResults.filter((r) => (r?.category ?? '').toString().toLowerCase() === cat);
  const total = filtered.length;
  if (!total) return 0;

  const passCount = filtered.filter((r) => normalizeStatus(r?.status) === 'PASS').length;
  return Math.round((passCount / total) * 100);
}

