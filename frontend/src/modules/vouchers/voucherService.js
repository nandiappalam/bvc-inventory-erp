// frontend/src/modules/vouchers/voucherService.js
// Voucher-specific API wrapper

import api from '../../services/api.js';

export const voucherAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return api(`/vouchers?${params}`);
  },
  get: (id) => api(`/vouchers/${id}`),
  create: (data) => api('vouchers', { method: 'POST', body: data }),
  update: (id, data) => api(`vouchers/${id}`, { method: 'PUT', body: data }),
  previewVoucherNo: (data) => api('vouchers/preview-no', { method: 'POST', body: data }),
  delete: (id) => api(`vouchers/${id}`, { method: 'DELETE' }),
  getLedgers: () => api('vouchers/ledgers'),
  getLedgerGroups: () => api('/ledgergroupmaster')
};

export default voucherAPI;

