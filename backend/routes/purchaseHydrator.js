/**
 * Hydrates the form state from a raw API entity.
 * This function is responsible for mapping server-side DTOs to the client-side form model,
 * including converting date formats, handling nulls, and setting defaults.
 *
 * @param {object} entity - The raw purchase entity from the API.
 * @returns {{values: object, items: Array<object>}} The hydrated form state.
 */
export const hydratePurchase = (entity) => {
  if (!entity) return { values: {}, items: [] };

  // Example: Convert date string to 'YYYY-MM-DD' format if needed
  const formValues = {
    ...entity,
    date: entity.date ? new Date(entity.date).toISOString().slice(0, 10) : '',
  };

  const formItems = entity.items || [];

  return { values: formValues, items: formItems };
};