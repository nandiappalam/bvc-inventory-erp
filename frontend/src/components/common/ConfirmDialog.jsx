import React from 'react';
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

export default function ConfirmDialog({
  open,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this record? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  confirmColor = "error",
  loading = false,
  onConfirm,
  onClose
}) {
  return (
    <Dialog
      open={Boolean(open)}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, color: confirmColor === 'error' ? '#dc2626' : '#1e3a8a' }}>
        {confirmColor === 'error' ? (
          <DeleteForeverRoundedIcon sx={{ fontSize: 28, color: '#dc2626' }} />
        ) : (
          <WarningAmberRoundedIcon sx={{ fontSize: 28, color: '#f59e0b' }} />
        )}
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 2 }}>
        <DialogContentText sx={{ color: '#475569', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
          color="inherit"
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
          autoFocus
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: confirmColor === 'error' ? '#dc2626' : undefined,
            '&:hover': {
              bgcolor: confirmColor === 'error' ? '#b91c1c' : undefined
            }
          }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
