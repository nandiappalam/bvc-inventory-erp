import React, { useState, createContext, useMemo, useCallback, useEffect } from 'react';
import Notification from '../components/Notification';
import { NOTIFICATION_TYPES } from '../constants/notificationTypes';
import { NOTIFICATION_DEFAULTS } from '../constants/notificationDefaults';

/**
 * @typedef {object} NotificationContextType
 * @property {(options: object) => void} notify - Generic notification function.
 * @property {(message: string, options?: object) => void} showSuccess - Shows a success notification.
 * @property {(message: string, options?: object) => void} showError - Shows an error notification.
 * @property {(message: string, options?: object) => void} showWarning - Shows a warning notification.
 * @property {(message: string, options?: object) => void} showInfo - Shows an info notification.
 */

/**
 * @type {React.Context<NotificationContextType|undefined>}
 * @internal
 */
export const NotificationContext = createContext(undefined); // Not exported to the public API

/**
 * A global provider for handling notifications (snackbars/toasts) across the ERP.
 * It manages the state and exposes a context to trigger notifications from any component.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The child components to render.
 * @returns {React.ReactElement}
 */
export const NotificationProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);

  useEffect(() => {
    if (queue.length > 0 && !currentNotification) {
      const [nextNotification, ...rest] = queue;
      setCurrentNotification(nextNotification);
      setQueue(rest);
    }
  }, [queue, currentNotification]);

  const processNextInQueue = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const notify = useCallback((options = {}) => {
    const newNotification = {
      id: crypto.randomUUID(),
      ...options,
    };
    setQueue((prevQueue) => [...prevQueue, newNotification]);
  }, []);

  const contextValue = useMemo(
    () => ({
      notify,
      showSuccess: (message, options) => notify({ severity: NOTIFICATION_TYPES.SUCCESS, message, ...options }),
      showError: (message, options) => notify({ severity: NOTIFICATION_TYPES.ERROR, message, ...options }),
      showWarning: (message, options) => notify({ severity: NOTIFICATION_TYPES.WARNING, message, ...options }),
      showInfo: (message, options) => notify({ severity: NOTIFICATION_TYPES.INFO, message, ...options }),
    }),
    [notify]
  );

  const notificationProps = {
    open: !!currentNotification,
    title: currentNotification?.title,
    message: currentNotification?.message,
    severity: currentNotification?.severity,
    anchorOrigin: currentNotification?.anchorOrigin || NOTIFICATION_DEFAULTS.ANCHOR_ORIGIN,
    duration:
      currentNotification?.autoHide === false
        ? null
        : currentNotification?.duration || NOTIFICATION_DEFAULTS.DURATION,
    onClose: processNextInQueue,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {currentNotification && (
        <Notification {...notificationProps} />
      )}
    </NotificationContext.Provider>
  );
};