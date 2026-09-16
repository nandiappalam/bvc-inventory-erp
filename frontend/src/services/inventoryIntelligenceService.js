import api from './api.js';

export const inventoryIntelligenceService = {
  /**
   * Fetches overall inventory summary (Physical, Available, Reserved, Quarantine, In Transit, Open PO Incoming)
   */
  getSummary: async () => {
    const response = await api('/inventory-intelligence/summary');
    return response;
  },

  /**
   * Fetches stock health status counts and indicators
   */
  getStockHealth: async () => {
    const response = await api('/inventory-intelligence/stock-health');
    return response;
  },

  /**
   * Fetches multi-bucket aging data (0-30, 31-60, 61-90, 91-180, 180+ days)
   */
  getAging: async (view = 'item') => {
    const response = await api(`/inventory-intelligence/aging?view=${encodeURIComponent(view)}`);
    return response;
  },

  /**
   * Fetches dead stock items (no movement for X days)
   */
  getDeadStock: async (days = 120) => {
    const response = await api(`/inventory-intelligence/dead-stock?days=${encodeURIComponent(days)}`);
    return response;
  },

  /**
   * Fetches slow-moving stock items (no movement > 60 days)
   */
  getSlowMoving: async () => {
    const response = await api('/inventory-intelligence/slow-moving');
    return response;
  },

  /**
   * Fetches excess stock items (current stock > reorder level * 2.2)
   */
  getExcessStock: async () => {
    const response = await api('/inventory-intelligence/excess-stock');
    return response;
  },

  /**
   * Fetches lot detail for lot traceability & QC audit drilldown
   */
  getLotDetails: async (lotNo) => {
    const response = await api(`/inventory-intelligence/lots/${encodeURIComponent(lotNo)}`);
    return response;
  }
};

export default inventoryIntelligenceService;
