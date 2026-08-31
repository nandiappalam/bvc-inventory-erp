import { useCallback } from 'react';
import { purchaseApi } from '../services/purchaseApi';

export const usePurchaseActions = ({
  purchaseId,
  form,
  items,
  summary,
  canSave,
  setStatus,
  // notify, // Assuming a global notification hook
}) => {
  const savePurchase = useCallback(async () => {
    if (!canSave) {
      // notify.error('Please fix validation errors before saving.');
      return;
    }

    setStatus(prev => ({ ...prev, saving: true }));
    try {
      const payload = { formData: form, items, totals: summary };
      const result = purchaseId
        ? await purchaseApi.update(purchaseId, payload)
        : await purchaseApi.create(payload);
      // notify.success(result.message);
    } catch (error) {
      // notify.error(error.message);
    } finally {
      setStatus(prev => ({ ...prev, saving: false }));
    }
  }, [purchaseId, form, items, summary, canSave, setStatus]);

  return { savePurchase /*, printPurchase, cancelPurchase */ };
};