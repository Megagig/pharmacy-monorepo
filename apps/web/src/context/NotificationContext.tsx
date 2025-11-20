import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the notification type
export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  timestamp: Date;
  read: boolean;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => {
    const id = `notification-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove notification after duration (default: 5000ms)
    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        markNotificationAsRead,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};
