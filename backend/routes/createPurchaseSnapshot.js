/**
 * Creates a consistent, comparable snapshot of the purchase form state.
 * This is used for dirty tracking. In a real app, it would perform
 * deeper normalization (e.g., sorting arrays, standardizing number formats).
 *
 * @param {object} options - An object containing the state to snapshot.
 * @param {Array<object>} options.items - The form items.
 * @returns {{values: object, items: Array<object>}} A normalized snapshot.
 */
export const createPurchaseSnapshot = ({ values, items }) => {
  // For now, this is a simple structure. It can be expanded to normalize dates,
  // numbers, and sort item arrays to make comparison more robust.
  return { values, items };
};