import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'Confirm Deletion',
    message: 'Are you sure you want to delete this record? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmColor: 'error',
    loading: false
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;

      const config = typeof options === 'string'
        ? { message: options }
        : (options || {});

      setDialogState({
        isOpen: true,
        title: config.title || 'Confirm Deletion',
        message: config.message || 'Are you sure you want to delete this record? This action cannot be undone.',
        confirmText: config.confirmText || 'Delete',
        cancelText: config.cancelText || 'Cancel',
        confirmColor: config.confirmColor || 'error',
        loading: false,
        onConfirmCallback: config.onConfirm
      });
    });
  }, []);

  useEffect(() => {
    window.__appConfirm = confirm;
    return () => {
      if (window.__appConfirm === confirm) {
        window.__appConfirm = null;
      }
    };
  }, [confirm]);

  const handleClose = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialogState.onConfirmCallback) {
      try {
        setDialogState(prev => ({ ...prev, loading: true }));
        await dialogState.onConfirmCallback();
      } catch (err) {
        console.error('Error during confirmed action:', err);
      }
    }
    setDialogState(prev => ({ ...prev, isOpen: false, loading: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, [dialogState.onConfirmCallback]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={dialogState.isOpen}
        onClose={dialogState.loading ? undefined : handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            p: 1,
            zIndex: 999999
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
          color: dialogState.confirmColor === 'error' ? '#dc2626' : '#1e3a8a'
        }}>
          {dialogState.confirmColor === 'error' ? (
            <DeleteForeverRoundedIcon sx={{ fontSize: 30, color: '#dc2626' }} />
          ) : (
            <WarningAmberRoundedIcon sx={{ fontSize: 30, color: '#f59e0b' }} />
          )}
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            {dialogState.title}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 2 }}>
          <DialogContentText sx={{ color: '#475569', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
            {dialogState.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={dialogState.loading}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {dialogState.cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={dialogState.loading}
            variant="contained"
            color={dialogState.confirmColor}
            autoFocus
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: dialogState.confirmColor === 'error' ? '#dc2626' : undefined,
              '&:hover': {
                bgcolor: dialogState.confirmColor === 'error' ? '#b91c1c' : undefined
              }
            }}
          >
            {dialogState.loading ? 'Deleting...' : dialogState.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    return async (options) => {
      const msg = typeof options === 'string' ? options : (options?.message || 'Confirm delete?');
      return window.confirm(msg);
    };
  }
  return context;
}

export default ConfirmContext;
