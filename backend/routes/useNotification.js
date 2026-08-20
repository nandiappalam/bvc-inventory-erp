import { useContext } from 'react';
import { NotificationContext } from '../providers/NotificationProvider';

/**
 * A custom hook to easily access the global notification context.
 * This provides a clean API for triggering notifications from any component
 * wrapped within the NotificationProvider.
 *
 * @returns {NotificationContextType} The notification context value.
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};