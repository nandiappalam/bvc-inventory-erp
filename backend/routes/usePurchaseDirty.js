import { useMemo } from 'react';
import { deepEqual } from '@/shared/utils';

/**
 * A hook to track if the current form state is different from its original snapshot.
 *
 * @param {object|null} originalSnapshot - The original state snapshot.
 * @param {object} currentSnapshot - The current state snapshot.
 * @returns {boolean} True if the form is dirty.
 */
export const usePurchaseDirty = (originalSnapshot, currentSnapshot) => {
  const dirty = useMemo(() => {
    if (!originalSnapshot) return false;
    return !deepEqual(currentSnapshot, originalSnapshot);
  }, [originalSnapshot, currentSnapshot]);

  return dirty;
};