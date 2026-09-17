import { api } from './api';

/**
 * Factory Production Planning + Queue + Demand + Material Availability Service
 */
export const factoryProductionPlanningService = {
  // 1. Dashboard summary
  async getDashboardSummary() {
    return api('/factory-production-planning/dashboard-summary');
  },

  // 2. Production Queue
  async getQueue(params = {}) {
    const query = new URLSearchParams(params).toString();
    return api(`/factory-production-planning/queue${query ? `?${query}` : ''}`);
  },

  async addToQueue(data) {
    return api('/factory-production-planning/queue', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 3. Customer Demand & Forecast
  async getCustomerDemand() {
    return api('/factory-production-planning/customer-demand');
  },

  async approveMTS(forecastId, plannerName = 'Plant Manager') {
    return api('/factory-production-planning/approve-mts', {
      method: 'POST',
      body: JSON.stringify({ forecastId, plannerName })
    });
  },

  // 4. Material Availability & ATP
  async getMaterialAvailability(productName = '') {
    return api(`/factory-production-planning/material-availability?productName=${encodeURIComponent(productName)}`);
  },

  // 5. Work Centers & Units
  async getUnits() {
    return api('/factory-production-planning/units');
  },

  // 6. Advance State Machine & Next Queued Job
  async advanceJob(queueId, action, payload = {}) {
    return api('/factory-production-planning/advance-job', {
      method: 'POST',
      body: JSON.stringify({ queueId, action, payload })
    });
  },

  // 7. Cleaning Orders
  async getCleaningOrders() {
    return api('/factory-production-planning/cleaning-orders');
  },

  // 8. Output records
  async getOutputs() {
    return api('/factory-production-planning/outputs');
  },

  // 9. Traceability Graph
  async getTraceability(key = 'PO-2026-0045') {
    return api(`/factory-production-planning/traceability?key=${encodeURIComponent(key)}`);
  }
};
