import { useContext } from 'react';
import { ConfirmDialogContext } from '../providers/ConfirmDialogProvider';

/**
 * A custom hook to easily access the global confirmation dialog context.
 * This provides a clean, promise-based API for showing confirmation dialogs.
 *
 * @returns {(options: object) => Promise<boolean>} The confirm function.
 */
export const useConfirm = () => {
  const context = useContext(ConfirmDialogContext);
  if (context === undefined) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
};