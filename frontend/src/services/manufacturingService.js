/**
 * Manufacturing, Lot Genealogy, BOM, Yield & Jobwork API Client
 */

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const manufacturingService = {
  // Lot Genealogy
  async searchLots(query = '') {
    const res = await fetch(`/api/lot-genealogy/search?query=${encodeURIComponent(query)}`, { credentials: 'include' });
    return res.json();
  },

  async getLotDetails(lotNo) {
    const res = await fetch(`/api/lot-genealogy/details/${encodeURIComponent(lotNo)}`, { credentials: 'include' });
    return res.json();
  },

  async getForwardTrace(lotNo) {
    const res = await fetch(`/api/lot-genealogy/forward/${encodeURIComponent(lotNo)}`, { credentials: 'include' });
    return res.json();
  },

  async getBackwardTrace(lotNo) {
    const res = await fetch(`/api/lot-genealogy/backward/${encodeURIComponent(lotNo)}`, { credentials: 'include' });
    return res.json();
  },

  async getRecallReport(lotNo) {
    const res = await fetch(`/api/lot-genealogy/recall/${encodeURIComponent(lotNo)}`, { credentials: 'include' });
    return res.json();
  },

  async performLotSplit(data) {
    const res = await fetch('/api/lot-genealogy/split', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async performLotMerge(data) {
    const res = await fetch('/api/lot-genealogy/merge', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // BOM & Formula Master
  async getBOMs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/bom${query ? `?${query}` : ''}`, { credentials: 'include' });
    return res.json();
  },

  async getBOMById(id) {
    const res = await fetch(`/api/bom/${id}`, { credentials: 'include' });
    return res.json();
  },

  async createBOM(data) {
    const res = await fetch('/api/bom', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateBOM(id, data) {
    const res = await fetch(`/api/bom/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async createBOMVersion(id, data) {
    const res = await fetch(`/api/bom/${id}/version`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async calculateRequirements(productOrBomId, quantity = 100) {
    const res = await fetch(`/api/bom/calculate/requirements?product=${encodeURIComponent(productOrBomId)}&quantity=${quantity}`, { credentials: 'include' });
    return res.json();
  },

  async compareStandardVsActual(workOrderId) {
    const res = await fetch(`/api/bom/compare/work-order/${workOrderId}`, { credentials: 'include' });
    return res.json();
  },

  // Production Planning
  async getProductionPlans(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/production-planning-mgmt/plans${query ? `?${query}` : ''}`, { credentials: 'include' });
    return res.json();
  },

  async getProductionPlanById(id) {
    const res = await fetch(`/api/production-planning-mgmt/plans/${id}`, { credentials: 'include' });
    return res.json();
  },

  async createProductionPlan(data) {
    const res = await fetch('/api/production-planning-mgmt/plans', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateProductionPlan(id, data) {
    const res = await fetch(`/api/production-planning-mgmt/plans/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getPlanShortages(id) {
    const res = await fetch(`/api/production-planning-mgmt/plans/${id}/shortages`, { credentials: 'include' });
    return res.json();
  },

  // Yield Intelligence
  async getYieldStats() {
    const res = await fetch('/api/yield-intelligence/stats', { credentials: 'include' });
    return res.json();
  },

  async getYieldBatches(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/yield-intelligence/batches${query ? `?${query}` : ''}`, { credentials: 'include' });
    return res.json();
  },

  async getYieldTrends() {
    const res = await fetch('/api/yield-intelligence/trends', { credentials: 'include' });
    return res.json();
  },

  async getYieldStandards() {
    const res = await fetch('/api/yield-intelligence/standards', { credentials: 'include' });
    return res.json();
  },

  async saveYieldStandard(data) {
    const res = await fetch('/api/yield-intelligence/standards', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Jobwork & Contractor Control
  async getJobworkStats() {
    const res = await fetch('/api/jobwork-control/stats', { credentials: 'include' });
    return res.json();
  },

  async getContractors(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/jobwork-control/contractors${query ? `?${query}` : ''}`, { credentials: 'include' });
    return res.json();
  },

  async saveContractor(data) {
    const res = await fetch('/api/jobwork-control/contractors', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getJobworkOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/jobwork-control/orders${query ? `?${query}` : ''}`, { credentials: 'include' });
    return res.json();
  },

  async getJobworkOrderById(id) {
    const res = await fetch(`/api/jobwork-control/orders/${id}`, { credentials: 'include' });
    return res.json();
  },

  async createJobworkOrder(data) {
    const res = await fetch('/api/jobwork-control/orders', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async recordJobworkReceipt(data) {
    const res = await fetch('/api/jobwork-control/receipts', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getContractorLedger(name) {
    const res = await fetch(`/api/jobwork-control/contractors/${encodeURIComponent(name)}/ledger`, { credentials: 'include' });
    return res.json();
  },

  async getContractorScorecards() {
    const res = await fetch('/api/jobwork-control/scorecards', { credentials: 'include' });
    return res.json();
  }
};

export default manufacturingService;
