import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  Alert,
  AlertTitle,
  Stack,
  Slide,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: Date;
}

export interface NotificationContextType {
  notifications: Notification[];
  showNotification: (
    notification: Omit<Notification, 'id' | 'timestamp'>
  ) => void;
  showSuccess: (
    message: string,
    title?: string,
    options?: Partial<Notification>
  ) => void;
  showError: (
    message: string,
    title?: string,
    options?: Partial<Notification>
  ) => void;
  showWarning: (
    message: string,
    title?: string,
    options?: Partial<Notification>
  ) => void;
  showInfo: (
    message: string,
    title?: string,
    options?: Partial<Notification>
  ) => void;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
  defaultDuration = 6000,
  position = { vertical: 'top', horizontal: 'right' },
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  const showNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const newNotification: Notification = {
        ...notification,
        id: generateId(),
        timestamp: new Date(),
        duration: notification.duration ?? defaultDuration,
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        // Limit number of notifications
        return updated.slice(0, maxNotifications);
      });

      // Auto-hide non-persistent notifications
      if (!notification.persistent && newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          hideNotification(newNotification.id);
        }, newNotification.duration);
      }
    },
    [defaultDuration, generateId, maxNotifications]
  );

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      showNotification({
        type: 'success',
        title,
        message,
        ...options,
      });
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      showNotification({
        type: 'error',
        title,
        message,
        duration: 8000, // Longer duration for errors
        ...options,
      });
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      showNotification({
        type: 'warning',
        title,
        message,
        duration: 7000,
        ...options,
      });
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      showNotification({
        type: 'info',
        title,
        message,
        ...options,
      });
    },
    [showNotification]
  );

  const contextValue: NotificationContextType = {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onClose={hideNotification}
        position={position}
      />
    </NotificationContext.Provider>
  );
};

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
  position: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
  position,
}) => {
  const getTransitionDirection = () => {
    if (position.horizontal === 'left') return 'right';
    if (position.horizontal === 'right') return 'left';
    return position.vertical === 'top' ? 'down' : 'up';
  };

  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        zIndex: 1400,
        ...(position.vertical === 'top' ? { top: 24 } : { bottom: 24 }),
        ...(position.horizontal === 'left' && { left: 24 }),
        ...(position.horizontal === 'center' && {
          left: '50%',
          transform: 'translateX(-50%)',
        }),
        ...(position.horizontal === 'right' && { right: 24 }),
        minWidth: 320,
        maxWidth: 500,
      }}
    >
      {notifications.map((notification, index) => (
        <Slide
          key={notification.id}
          direction={getTransitionDirection()}
          in={true}
          timeout={300}
          style={{
            transitionDelay: `${index * 100}ms`,
          }}
        >
          <div>
            <NotificationItem
              notification={notification}
              onClose={() => onClose(notification.id)}
            />
          </div>
        </Slide>
      ))}
    </Stack>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClose,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <SuccessIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return null;
    }
  };

  const handleActionClick = () => {
    if (notification.action) {
      notification.action.onClick();
      onClose();
    }
  };

  return (
    <Alert
      severity={notification.type}
      icon={getIcon()}
      action={
        <Stack direction="row" spacing={1} alignItems="center">
          {notification.action && (
            <IconButton
              size="small"
              color="inherit"
              onClick={handleActionClick}
              sx={{ fontSize: '0.875rem' }}
            >
              {notification.action.label}
            </IconButton>
          )}
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
      sx={{
        width: '100%',
        boxShadow: 3,
        '& .MuiAlert-message': {
          flex: 1,
        },
      }}
    >
      {notification.title && <AlertTitle>{notification.title}</AlertTitle>}
      {typeof notification.message === 'string' 
        ? notification.message 
        : typeof notification.message === 'object' && notification.message !== null
        ? JSON.stringify(notification.message)
        : String(notification.message || '')
      }
    </Alert>
  );
};

/**
 * Hook to show standardized operation notifications
 */
export const useOperationNotifications = () => {
  const { showSuccess, showError, showWarning } = useNotifications();

  const notifySuccess = useCallback(
    (operation: string, resource?: string) => {
      const message = resource
        ? `${resource} ${operation} successfully`
        : `${operation} completed successfully`;
      showSuccess(message);
    },
    [showSuccess]
  );

  const notifyError = useCallback(
    (operation: string, error?: NotificationError, resource?: string) => {
      const baseMessage = resource
        ? `Failed to ${operation.toLowerCase()} ${resource}`
        : `${operation} failed`;

      const errorMessage =
        error?.message || error?.response?.data?.message || error;
      const message = errorMessage
        ? `${baseMessage}: ${errorMessage}`
        : baseMessage;

      showError(message, 'Operation Failed');
    },
    [showError]
  );

  const notifyValidationError = useCallback(
    (errors: string | string[]) => {
      const message = Array.isArray(errors) ? errors.join(', ') : errors;
      showWarning(message, 'Validation Error');
    },
    [showWarning]
  );

  return {
    notifySuccess,
    notifyError,
    notifyValidationError,
  };
};

/**
 * Hook for CRUD operation notifications
 */
export const useCRUDNotifications = () => {
  const { notifySuccess, notifyError } = useOperationNotifications();

  return {
    created: (resource: string) => notifySuccess('Created', resource),
    updated: (resource: string) => notifySuccess('Updated', resource),
    deleted: (resource: string) => notifySuccess('Deleted', resource),
    createFailed: (resource: string, error?: NotificationError) =>
      notifyError('Create', error, resource),
    updateFailed: (resource: string, error?: NotificationError) =>
      notifyError('Update', error, resource),
    deleteFailed: (resource: string, error?: NotificationError) =>
      notifyError('Delete', error, resource),
    loadFailed: (resource: string, error?: NotificationError) =>
      notifyError('Load', error, resource),
  };
};

export default NotificationProvider;
