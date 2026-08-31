/**
 * Builds a clean query object by filtering out null, undefined, and empty string values.
 * This ensures that API requests only send meaningful parameters.
 *
 * @param {object} params - The raw query parameters object.
 * @returns {object} A new object containing only valid query parameters.
 */
export const buildCleanQuery = (params) => {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value == null) return false; // Catches both null and undefined
      if (typeof value === 'string') return value.trim() !== '';
      return true;
    })
  );
};