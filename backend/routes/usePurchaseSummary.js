import { useMemo } from 'react';
import { calculatePurchaseSummary } from '../utils/purchaseMath';

/**
 * A pure calculation hook that derives the purchase summary.
 * It takes items and header data as inputs and returns a memoized summary object.
 * This avoids creating a separate state for the summary.
 * @param {Array<object>} items - The array of purchase items.
 * @param {object} values - The form header values (for tax, currency, etc.).
 * @returns {Object} The calculated summary.
 */
export const usePurchaseSummary = (items, values) => {
  const summary = useMemo(() => {
    return calculatePurchaseSummary(items, values);
  }, [items, values]);

  return summary;
};