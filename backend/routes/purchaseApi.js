import { apiClient } from '@/shared/api';
import { PURCHASE_API } from './purchaseEndpoints'; // Assuming relative path

/**
 * A service layer for all Purchase module API interactions.
 * It uses the shared apiClient and contains no business logic or React code.
 */
export const purchaseApi = {
  // =================================================================
  // CRUD Endpoints
  // =================================================================

  /**
   * Fetches a paginated or complete list of purchases.
   * @param {object} [params] - Optional params for pagination, filtering, and sorting.
   * @param {number} [params.page] - The page number.
   * @param {number} [params.pageSize] - The number of items per page.
   * @param {string} [params.search] - A search term.
   * @param {string} [params.supplier] - Filter by supplier ID.
   * @param {string} [params.status] - Filter by purchase status.
   * @returns {Promise<any>} A promise that resolves to the list of purchases.
   */
  getPurchaseList(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${PURCHASE_API.BASE}/${PURCHASE_API.ENDPOINTS.LIST}?${query}`
      : `${PURCHASE_API.BASE}/${PURCHASE_API.ENDPOINTS.LIST}`;
    return apiClient.get(url);
  },

  /**
   * Fetches a single purchase by its ID.
   * @param {string|number} id The ID of the purchase to fetch.
   * @returns {Promise<any>} A promise that resolves to the purchase data.
   */
  getPurchase(id) {
    return apiClient.get(`${PURCHASE_API.BASE}/${id}`);
  },

  /**
   * Creates a new purchase.
   * @param {object} payload The purchase data to create.
   * @returns {Promise<any>} A promise that resolves to the newly created purchase data.
   */
  createPurchase(payload) {
    return apiClient.post(PURCHASE_API.BASE, payload);
  },

  /**
   * Updates an existing purchase.
   * @param {string|number} id The ID of the purchase to update.
   * @param {object} payload The updated purchase data.
   * @returns {Promise<any>} A promise that resolves to the updated purchase data.
   */
  updatePurchase(id, payload) {
    return apiClient.put(`${PURCHASE_API.BASE}/${id}`, payload);
  },

  /**
   * Deletes a purchase by its ID.
   * @param {string|number} id The ID of the purchase to delete.
   * @returns {Promise<null>} A promise that resolves on successful deletion.
   */
  deletePurchase(id) {
    return apiClient.delete(`${PURCHASE_API.BASE}/${id}`);
  },

  // =================================================================
  // Workflow Endpoints
  // =================================================================

  /**
   * Approves a purchase. (Placeholder)
   * @param {string|number} id The ID of the purchase to approve.
   * @returns {Promise<any>}
   */
  approvePurchase(id) {
    return apiClient.post(`${PURCHASE_API.BASE}/${id}/${PURCHASE_API.ENDPOINTS.APPROVE}`);
  },

  /**
   * Cancels a purchase. (Placeholder)
   * @param {string|number} id The ID of the purchase to cancel.
   * @returns {Promise<any>}
   */
  cancelPurchase(id) {
    return apiClient.post(`${PURCHASE_API.BASE}/${id}/${PURCHASE_API.ENDPOINTS.CANCEL}`);
  },

  /**
   * Reopens a closed or canceled purchase. (Placeholder)
   * @param {string|number} id The ID of the purchase to reopen.
   * @returns {Promise<any>}
   */
  reopenPurchase(id) {
    return apiClient.post(`${PURCHASE_API.BASE}/${id}/${PURCHASE_API.ENDPOINTS.REOPEN}`);
  },

  // =================================================================
  // Utility & Validation Endpoints
  // =================================================================

  /**
   * Fetches the next available serial number for a new purchase.
   * @returns {Promise<{next_sno: number}>} A promise that resolves to the next serial number.
   */
  generatePurchaseNumber() {
    return apiClient.get(`${PURCHASE_API.BASE}/${PURCHASE_API.ENDPOINTS.NEXT_NUMBER}`);
  },

  /**
   * Performs backend validation for a purchase payload. (Placeholder)
   * @param {object} payload The purchase data to validate.
   * @returns {Promise<{valid: boolean, errors: object}>}
   */
  validatePurchase(payload) {
    return apiClient.post(`${PURCHASE_API.BASE}/${PURCHASE_API.ENDPOINTS.VALIDATE}`, payload);
  },

  // =================================================================
  // Attachment Endpoints
  // =================================================================

  /**
   * Uploads an attachment for a purchase. (Placeholder)
   * @param {string|number} id The ID of the purchase.
   * @param {File} file The file to upload.
   * @returns {Promise<any>}
   */
  uploadAttachment(id, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`${PURCHASE_API.BASE}/${id}/${PURCHASE_API.ENDPOINTS.ATTACHMENTS}`, formData);
  },

  /**
   * Deletes an attachment from a purchase. (Placeholder)
   * @param {string|number} id The ID of the purchase.
   * @param {string|number} attachmentId The ID of the attachment to delete.
   * @returns {Promise<null>}
   */
  deleteAttachment(id, attachmentId) {
    return apiClient.delete(`${PURCHASE_API.BASE}/${id}/${PURCHASE_API.ENDPOINTS.ATTACHMENTS}/${attachmentId}`);
  },
};