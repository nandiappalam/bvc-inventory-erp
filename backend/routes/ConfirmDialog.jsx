import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from '@mui/material';

/**
 * A pure presentational component for displaying a confirmation dialog.
 * It is controlled entirely by its props.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the dialog is visible.
 * @param {string} props.title - The dialog title.
 * @param {string} props.message - The dialog message/content.
 * @param {string} props.confirmText - The text for the confirmation button.
 * @param {string} props.cancelText - The text for the cancellation button.
 * @param {function} props.onConfirm - Callback for when the confirm button is clicked.
 * @param {function} props.onCancel - Callback for when the cancel button is clicked.
 * @param {'error'|'warning'|'info'|'success'} [props.severity='info'] - Determines the color of the confirm button.
 * @param {'primary'|'secondary'|'success'|'error'|'info'|'warning'} [props.confirmColor] - Overrides the color of the confirm button.
 * @param {boolean} [props.loading=false] - If true, disables dialog buttons.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|false} [props.maxWidth='sm'] - The max width of the dialog.
 * @param {boolean} [props.fullWidth=false] - If true, the dialog stretches to the maxWidth.
 * @param {boolean} [props.disableEscapeKeyDown=false] - If true, the `escape` key will not close the dialog.
 * @param {boolean} [props.disableBackdropClick=false] - If true, clicking the backdrop will not close the dialog.
 * @returns {React.ReactElement}
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  severity = 'info',
  confirmColor,
  loading = false,
  maxWidth = 'sm',
  fullWidth = false,
  disableEscapeKeyDown = false,
  disableBackdropClick = false,
}) => {
  const finalConfirmColor = confirmColor || (severity === 'info' ? 'primary' : severity);

  const handleDialogClose = (_, reason) => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={disableEscapeKeyDown}
      aria-labelledby="confirm-dialog-title"
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading} variant="outlined">{cancelText}</Button>
        <Button onClick={onConfirm} color={finalConfirmColor} autoFocus disabled={loading} variant="contained">
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;