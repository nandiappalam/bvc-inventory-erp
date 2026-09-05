import React, { useState, createContext, useMemo, useCallback, useEffect } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { DIALOG_DEFAULTS } from '../constants/dialogDefaults';

/**
 * @type {React.Context<((options: object) => Promise<boolean>)|undefined>}
 * @internal
 */
const ConfirmDialogContext = createContext(undefined); // Not exported

/**
 * A global provider for handling promise-based confirmation dialogs across the ERP.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The child components to render.
 * @returns {React.ReactElement}
 */
export const ConfirmDialogProvider = ({ children }) => {
  const [dialogQueue, setDialogQueue] = useState([]);
  const [currentDialog, setCurrentDialog] = useState(null);

  useEffect(() => {
    if (dialogQueue.length > 0 && !currentDialog) {
      const [nextDialog, ...rest] = dialogQueue;
      setCurrentDialog(nextDialog);
      setDialogQueue(rest);
    }
  }, [dialogQueue, currentDialog]);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve, reject) => {
      const newDialogRequest = {
        id: crypto.randomUUID(),
        options: { ...DIALOG_DEFAULTS, ...options },
        resolve,
        reject, // For future use (e.g., programmatic closing)
      };
      setDialogQueue((prev) => [...prev, newDialogRequest]);
    });
  }, []);

  const handleClose = useCallback((confirmed) => {
    // Prevent multiple calls and race conditions
    if (!currentDialog) return;
    const dialogToResolve = currentDialog;
    setCurrentDialog(null); // Immediately mark as closed
    dialogToResolve.resolve(confirmed);
  }, [currentDialog]);

  const dialogProps = currentDialog
    ? {
        open: true,
        title: currentDialog.options.title,
        message: currentDialog.options.message,
        confirmText: currentDialog.options.confirmText,
        cancelText: currentDialog.options.cancelText,
        severity: currentDialog.options.severity,
        confirmColor: currentDialog.options.confirmColor,
        loading: currentDialog.options.loading,
        maxWidth: currentDialog.options.maxWidth,
        fullWidth: currentDialog.options.fullWidth,
        disableEscapeKeyDown: currentDialog.options.disableEscapeKeyDown,
        disableBackdropClick: currentDialog.options.disableBackdropClick,
        onConfirm: () => handleClose(true),
        onCancel: () => handleClose(false),
      }
    : { open: false };

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <ConfirmDialog {...dialogProps} />
    </ConfirmDialogContext.Provider>
  );
};