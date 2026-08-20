import { useCallback } from 'react';
import { useAsync } from '@/shared/hooks';
import { purchaseApi } from '@/purchase/services';
import { hydratePurchase } from '../utils';

/**
 * Manages the data-loading and initialization for the purchase form.
 *
 * @param {string|number|null} purchaseId - The ID of the purchase to load.
 * @returns {{
 *  initialize: () => Promise<object>,
 *  isLoading: boolean
 * }}
 */
export const usePurchaseLoader = (purchaseId) => {
  const {
    execute: fetchPurchase,
    loading: isLoadingRecord,
  } = useAsync(purchaseApi.getPurchase);

  const {
    execute: initializeNewPurchase,
    loading: isInitializing,
  } = useAsync(purchaseApi.generatePurchaseNumber);

  const initialize = useCallback(async () => {
    let rawData;
    if (purchaseId) {
      rawData = await fetchPurchase(purchaseId);
    } else {
      const { next_sno } = await initializeNewPurchase();
      rawData = { s_no: next_sno, date: new Date() }; // Default new record
    }
    const hydratedData = hydratePurchase(rawData);
    return hydratedData;
  }, [purchaseId, fetchPurchase, initializeNewPurchase]);

  const isLoading = isLoadingRecord || isInitializing;

  return { initialize, isLoading };
};