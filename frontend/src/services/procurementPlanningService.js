import api from './api.js';

export const procurementPlanningService = {
  /**
   * Fetches high-level planning metrics (Total items, Shortages, Open POs, Excess, Value)
   */
  getSummary: async (horizon = '30d') => {
    const response = await api(`/procurement-planning/summary?horizon=${encodeURIComponent(horizon)}`);
    return response;
  },

  /**
   * Fetches planning matrix of items (Supply, Demand, Projected Stock, Shortages, Recommendations)
   */
  getItems: async (horizon = '30d', search = '', filter = 'all') => {
    const params = new URLSearchParams({
      horizon,
      search,
      filter
    });
    const response = await api(`/procurement-planning/items?${params.toString()}`);
    return response;
  },

  /**
   * Fetches full transaction breakdown for a single item
   */
  getItemDetails: async (itemName, horizon = '30d') => {
    const response = await api(`/procurement-planning/items/${encodeURIComponent(itemName)}?horizon=${encodeURIComponent(horizon)}`);
    return response;
  },

  /**
   * Generates purchase suggestions for management review
   */
  getSuggestions: async (horizon = '30d') => {
    const response = await api(`/procurement-planning/suggestions?horizon=${encodeURIComponent(horizon)}`);
    return response;
  },

  /**
   * Creates a Purchase Request in the existing PR system from selected suggestions
   */
  createPR: async (items, remarks = '') => {
    const response = await api(`/procurement-planning/create-pr`, {
      method: 'POST',
      body: JSON.stringify({ items, remarks })
    });
    return response;
  }
};

export default procurementPlanningService;
