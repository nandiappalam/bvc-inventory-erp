import { useAsync } from '@/shared/hooks';
import { purchaseApi } from '@/purchase/services';

/**
 * Manages the save operation for the purchase form.
 *
 * @param {string|number|null} purchaseId - The ID of the purchase to save.
 * @returns {{
 *  save: (payload: object) => Promise<object>,
 *  isSubmitting: boolean,
 *  resetSave: () => void
 * }}
 */
export const usePurchaseSaver = (purchaseId) => {
  const {
    execute: persist,
    loading: isSubmitting,
    reset: resetSave,
  } = useAsync(async (payload) => {
    return purchaseId
      ? purchaseApi.updatePurchase(purchaseId, payload)
      : purchaseApi.createPurchase(payload);
  });

  return { save: persist, isSubmitting, resetSave };
};