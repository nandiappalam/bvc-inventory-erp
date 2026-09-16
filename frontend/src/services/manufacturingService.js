import { api } from './api';

/**
 * Manufacturing, Lot Genealogy, BOM, Yield & Jobwork API Client
 */
export const manufacturingService = {
  // Lot Genealogy
  async searchLots(query = '') {
    return api(`/lot-genealogy/search?query=${encodeURIComponent(query)}`);
  },

  async getLotDetails(lotNo) {
    return api(`/lot-genealogy/details/${encodeURIComponent(lotNo)}`);
  },

  async getForwardTrace(lotNo) {
    return api(`/lot-genealogy/forward/${encodeURIComponent(lotNo)}`);
  },

  async getBackwardTrace(lotNo) {
    return api(`/lot-genealogy/backward/${encodeURIComponent(lotNo)}`);
  },

  async getRecallReport(lotNo) {
    return api(`/lot-genealogy/recall/${encodeURIComponent(lotNo)}`);
  },

  async performLotSplit(data) {
    return api('/lot-genealogy/split', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async performLotMerge(data) {
    return api('/lot-genealogy/merge', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // BOM & Formula Master
  async getBOMs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/bom${query ? `?${query}` : ''}`);
  },

  async getBOMById(id) {
    return api(`/bom/${id}`);
  },

  async createBOM(data) {
    return api('/bom', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateBOM(id, data) {
    return api(`/bom/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async createBOMVersion(id, data) {
    return api(`/bom/${id}/version`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async calculateRequirements(productOrBomId, quantity = 100) {
    return api(`/bom/calculate/requirements?product=${encodeURIComponent(productOrBomId)}&quantity=${quantity}`);
  },

  async compareStandardVsActual(workOrderId) {
    return api(`/bom/compare/work-order/${workOrderId}`);
  },

  // Production Planning
  async getProductionPlans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/production-planning-mgmt/plans${query ? `?${query}` : ''}`);
  },

  async getProductionPlanById(id) {
    return api(`/production-planning-mgmt/plans/${id}`);
  },

  async createProductionPlan(data) {
    return api('/production-planning-mgmt/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProductionPlan(id, data) {
    return api(`/production-planning-mgmt/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getPlanShortages(id) {
    return api(`/production-planning-mgmt/plans/${id}/shortages`);
  },

  // Yield Intelligence
  async getYieldStats() {
    return api('/yield-intelligence/stats');
  },

  async getYieldBatches(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/yield-intelligence/batches${query ? `?${query}` : ''}`);
  },

  async getYieldTrends() {
    return api('/yield-intelligence/trends');
  },

  async getYieldStandards() {
    return api('/yield-intelligence/standards');
  },

  async saveYieldStandard(data) {
    return api('/yield-intelligence/standards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Jobwork & Contractor Control
  async getJobworkStats() {
    return api('/jobwork-control/stats');
  },

  async getContractors(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/jobwork-control/contractors${query ? `?${query}` : ''}`);
  },

  async saveContractor(data) {
    return api('/jobwork-control/contractors', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getJobworkOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/jobwork-control/orders${query ? `?${query}` : ''}`);
  },

  async getJobworkOrderById(id) {
    return api(`/jobwork-control/orders/${id}`);
  },

  async createJobworkOrder(data) {
    return api('/jobwork-control/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async recordJobworkReceipt(data) {
    return api('/jobwork-control/receipts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getContractorLedger(name) {
    return api(`/jobwork-control/contractors/${encodeURIComponent(name)}/ledger`);
  },

  async getContractorScorecards() {
    return api('/jobwork-control/scorecards');
  }
};

export default manufacturingService;
