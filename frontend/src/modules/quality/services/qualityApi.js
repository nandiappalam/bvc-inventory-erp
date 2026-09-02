import api from '../../../services/api';

// Phase 1 scaffold: wrapper methods used by future QC/IQR/COA screens.

const qualityApi = {
  // Create/Save QC master record
  async saveQc({ qcId, payload }) {
    return api('/quality/purchase-lab-testing', { method: 'POST', body: payload });
  },

  async submitQc(payload) {
    return api('/quality/purchase-lab-testing', { method: 'POST', body: payload });
  },

  // Load QC record
  async loadQc(qcId) {
    return api(`/quality/purchase-lab-testing/${qcId}`, { method: 'GET' });
  },

  // Generate IQR/COA
  async generateIqr({ qcId }) {
    return api(`/quality/iqr/generate?qcId=${encodeURIComponent(qcId)}`, { method: 'POST' });
  },

  async generateCoa({ qcId }) {
    return api(`/quality/coa/generate?qcId=${encodeURIComponent(qcId)}`, { method: 'POST' });
  },

  // List/register endpoints (scaffold)
  async listQrRegisters() {
    return api('/quality/registers', { method: 'GET' });
  },
};

export default qualityApi;

