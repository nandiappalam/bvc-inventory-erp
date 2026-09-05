import { useMemo } from 'react';

/**
 * A pure validation function. It takes state and returns validation results.
 * It does NOT have side effects or modify state directly.
 * @param {object} values
 * @param {Array<object>} items
 * @returns {{errors: object, warnings: object, isValid: boolean}}
 */
export const validatePurchase = (values, items) => {
  const errors = {};
  const warnings = {};
  // if (!values.supplier) errors.supplier = 'Supplier is required.';
  // if (items.length === 0) warnings.items = 'At least one item is recommended.';
  const isValid = Object.keys(errors).length === 0;
  return { errors, warnings, isValid };
};

/**
 * A hook that memoizes the validation result for the purchase form.
 * It uses a pure validation function to compute the validation state.
 *
 * @param {object} values - The current form header data.
 * @param {Array<object>} items - The current list of purchase items.
 * @returns {{
 *   validation: { errors: object, warnings: object, isValid: boolean, hasErrors: boolean, hasWarnings: boolean }
 * }}
 */
export const usePurchaseValidation = (values, items) => {
  const validationResult = useMemo(() => validatePurchase(values, items), [values, items]);

  return {
    validation: {
      ...validationResult,
      hasErrors: Object.keys(validationResult.errors).length > 0,
      hasWarnings: Object.keys(validationResult.warnings).length > 0,
    }
  };
};