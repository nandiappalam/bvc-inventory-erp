import React from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';

/**
 * A pure presentational component for displaying notifications (toasts/snackbars).
 * It is controlled entirely by its props and has no in ternal state or logic.
 *
 * @param {object} props
 * @param {boolean} [props.open=false] - Whether the notification is visible.
 * @param {string} [props.title] - The optional title for the notification.
 * @param {string} [props.message] - The message to display.
 * @param {'success'|'error'|'warning'|'info'} [props.severity='info'] - The type of notification.
 * @param {number|null} [props.duration=6000] - Auto-hide duration. `null` for non-auto-hiding.
 * @param {function} [props.onClose] - Callback function to handle close events.
 * @param {object} [props.anchorOrigin] - The position of the snackbar.
 * @returns {React.ReactElement}
 */
const Notification = ({ open = false, title, message, severity = 'info', duration = 6000, onClose, anchorOrigin }) => {
  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    onClose();
  };

  return (
    <Snackbar open={open} autoHideDuration={duration} onClose={handleClose} anchorOrigin={anchorOrigin}>
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }} variant="filled">
        {title && <AlertTitle>{title}</AlertTitle>}
        {message || ''}
      </Alert>
    </Snackbar>
  );
};

export default Notification;