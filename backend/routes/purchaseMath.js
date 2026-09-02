/**
 * Calculates the total summary for a list of purchase items.
 * @param {Array} items - The array of purchase items.
 * @returns {Object} A summary object with all calculated totals.
 */
export const calculatePurchaseSummary = (items = []) => {
  const summary = items.reduce(
    (acc, item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const baseAmount = qty * rate;
      const discAmount = Number(item.disc_amount) || 0;
      const taxAmount = Number(item.tax_amount) || 0;

      acc.totalQty += qty;
      acc.totalWeight += Number(item.total_weight) || 0;
      acc.netAmount += baseAmount - discAmount;
      acc.discAmount += discAmount;
      acc.taxAmount += taxAmount;
      return acc;
    },
    { totalQty: 0, totalWeight: 0, netAmount: 0, discAmount: 0, taxAmount: 0 }
  );

  summary.grandTotal = summary.netAmount + summary.taxAmount;
  return summary;
};