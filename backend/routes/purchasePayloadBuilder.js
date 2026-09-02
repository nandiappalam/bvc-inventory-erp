/**
 * Builds the payload for creating or updating a purchase,
 * transforming the form state into the format expected by the API.
 *
 * @param {object} values - The form header values.
 * @param {Array<object>} items - The form items.
 * @param {object} summary - The calculated summary.
 * @returns {object} The final payload for the API.
 */
export const buildPurchasePayload = (values, items, summary) => {
  // In a real app, this would perform more complex mapping and normalization.
  return { formData: values, items, totals: summary };
};