/**
 * Notification Hook
 * Simple notification system using Material-UI Snackbar
 */

import React, { useState, useCallback } from 'react';

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export interface NotificationState {
  open: boolean;
  message: string;
  severity: NotificationSeverity;
}

export interface UseNotificationReturn {
  notification: NotificationState;
  showNotification: (message: string, severity?: NotificationSeverity) => void;
  hideNotification: () => void;
}

export const useNotification = (): UseNotificationReturn => {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showNotification = useCallback((message: string, severity: NotificationSeverity = 'info') => {
    setNotification({
      open: true,
      message,
      severity,
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({
      ...prev,
      open: false,
    }));
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
};

export default useNotification;