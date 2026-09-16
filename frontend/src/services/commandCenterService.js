import api from './api.js';

export const commandCenterService = {
  /**
   * Fetches summary metrics across all operational sections.
   * Backend enforces authorization and returns only allowed metrics.
   */
  getSummary: async (financialYear = null) => {
    const params = financialYear ? `?financial_year=${encodeURIComponent(financialYear)}` : '';
    const response = await api(`/command-center/summary${params}`);
    return response;
  }
};

export default commandCenterService;
