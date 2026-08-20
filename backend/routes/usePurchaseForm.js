import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPurchaseSnapshot, buildPurchasePayload, hydratePurchase } from '../utils';
import { usePurchaseItems } from './usePurchaseItems';
import { usePurchaseSummary } from './usePurchaseSummary';
import { usePurchaseValidation } from './usePurchaseValidation';
import { usePurchaseLoader } from './usePurchaseLoader';
import { usePurchaseSaver } from './usePurchaseSaver';
import { usePurchaseDirty } from './usePurchaseDirty';

/**
 * Orchestrates the state and logic for the Purchase create/edit form by composing
 * single-responsibility hooks.
 * @param {string|number|null} purchaseId - The ID of the purchase to load for editing, or null for new.
 * @param {boolean} [readonly=false] - If true, the form is in a read-only state.
 * @returns {{
 *   readonly: boolean,
 *   mode: 'create' | 'edit',
 *   values: object, // Form header values
 *   items: Array<object>, // Form line items
 *   summary: object, // Calculated totals
 *   validation: object, // Validation state { errors, warnings, hasErrors, ... }
 *   dirty: boolean, // True if form has been modified
 *   hasUnsavedChanges: boolean, // Alias for dirty, for semantic clarity in UI
 *   isLoading: boolean, // True when loading existing record
 *   isSubmitting: boolean, // True during save operation
 *   isLoaded: boolean, // True once initial data is loaded
 *   canSave: boolean, // Derived flag to enable/disable save button
 *   canReset: boolean, // Derived flag to enable/disable reset button
 *   updateField: (name: string, value: any) => void, // Update a single header field
 *   updateValues: (updater: object | ((prev: object) => object)) => void, // Update multiple header fields
 *   addItem: () => void, // Add a new line item
 *   updateItem: (id: string|number, field: string, value: any) => void, // Update a field in a line item
 *   deleteItem: (id: string|number) => void, // Delete a line item
 *   reload: () => Promise<void>,
 *   save: () => Promise<object>,
 *   restoreOriginal: () => void, // Resets form to its last saved state
 * }}
 */
export const usePurchaseForm = (purchaseId = null, readonly = false) => {
  const [values, setValues] = useState({});
  const { items, setItems, addItem, updateItem, deleteItem } = usePurchaseItems([]);
  const summary = usePurchaseSummary(items, values);

  const originalDataRef = useRef(null);

  // --- Child Hooks for Decomposed Responsibilities ---
  const { initialize, isLoading } = usePurchaseLoader(purchaseId);
  const { save, isSubmitting, resetSave } = usePurchaseSaver(purchaseId);
  const { validation } = usePurchaseValidation(values, items);
  const currentSnapshot = useMemo(() => createPurchaseSnapshot({ values, items }), [values, items]);
  const dirty = usePurchaseDirty(originalDataRef.current, currentSnapshot);

  // --- Internal State Management ---
  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    setValues(snapshot.values);
    setItems(snapshot.items);
    originalDataRef.current = snapshot;
  }, [setItems]);

  // --- Public Actions ---
  const reload = useCallback(async () => {
    try {
      // Use an intermediate variable for easier debugging, as recommended.
      const hydratedData = await initialize();
      const snapshot = createPurchaseSnapshot({
        values: hydratedData.values,
        items: hydratedData.items,
      });
      applySnapshot(snapshot);
    } catch (err) {
      // Errors are re-thrown by useAsync and can be handled by the UI layer.
      // We catch here to prevent unhandled promise rejection warnings in the console.
    }
  }, [initialize, applySnapshot]);

  const updateField = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const updateValues = useCallback((newValues) => {
    setValues((prev) => (typeof newValues === 'function' ? newValues(prev) : { ...prev, ...newValues }));
  }, []);

  const save = useCallback(async () => {
    if (!validation.isValid) {
      throw new Error('Validation failed. Please check the form.');
    }
    try {
      const payload = buildPurchasePayload(values, items, summary);
      const savedEntity = await save(payload);
      // After save, re-hydrate and create a new "original" snapshot
      const { values: hydratedValues, items: hydratedItems } = hydratePurchase(savedEntity); // Ensure consistency
      applySnapshot(createPurchaseSnapshot({ values: hydratedValues, items: hydratedItems }));
      resetSave();
      return savedEntity;
    } catch (err) {
      throw err;
    }
  }, [validation.isValid, values, items, summary, save, applySnapshot, resetSave]);

  const restoreOriginal = useCallback(() => {
    if (originalDataRef.current) {
      applySnapshot(originalDataRef.current);
      resetSave();
    }
  }, [applySnapshot, resetSave]);

  // --- Initial Load Effect ---
  useEffect(() => {
    reload();
  }, [reload]);

  // --- Derived State ---
  const mode = purchaseId ? 'edit' : 'create';
  const isLoaded = !isLoading && originalDataRef.current !== null;
  const canReset = dirty && !isSubmitting;
  const canSave = !readonly && dirty && isLoaded && !isSubmitting && !isLoading && validation.isValid;

  return {
    // State
    readonly,
    mode,
    values,
    items,
    summary,
    validation,
    dirty,
    hasUnsavedChanges: dirty,
    
    // Async Status
    isLoading,
    isSubmitting,
    isLoaded,

    // Derived Flags
    canSave,
    canReset,
    
    // Actions
    updateField,
    updateValues,
    addItem,
    updateItem,
    deleteItem,
    reload,
    save,
    restoreOriginal,
  };
};