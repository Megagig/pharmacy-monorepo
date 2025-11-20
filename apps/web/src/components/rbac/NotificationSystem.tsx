import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Tooltip,
  Slide,
  Fade,
} from '@mui/material';
import {
  Close as CloseIcon,
  Security as SecurityIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { useWebSocket } from '../../services/websocketService';
import { useAuth } from '../../hooks/useAuth';
import type { PermissionChangeNotification } from '../../types/rbac';

interface NotificationItem {
  id: string;
  type:
    | 'permission_change'
    | 'role_change'
    | 'conflict_warning'
    | 'system_update';
  title: string;
  message: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  timestamp: string;
  data?: any;
  read: boolean;
  persistent?: boolean;
}

interface NotificationSystemProps {
  maxNotifications?: number;
  autoHideDuration?: number;
  showInAppNotifications?: boolean;
}

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  autoHideDuration = 6000,
  showInAppNotifications = true,
}) => {
  const { user } = useAuth();

  // Disable WebSocket functionality completely to prevent connection attempts
  const status = 'disabled';
  const subscribe = () => () => {}; // No-op function
  const connect = () => Promise.resolve();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeSnackbars, setActiveSnackbars] = useState<Set<string>>(
    new Set()
  );
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // WebSocket connection disabled - no connection attempts
  useEffect(() => {
    // WebSocket functionality is disabled to prevent connection errors
    // Real-time notifications are not available
  }, []);

  // Subscribe to permission change notifications
  useEffect(() => {
    const unsubscribePermissionChanges = subscribe(
      'permission_change',
      (message) => {
        const notification = message.data as PermissionChangeNotification;
        handlePermissionChangeNotification(notification);
      }
    );

    const unsubscribeRoleChanges = subscribe('role_change', (message) => {
      handleRoleChangeNotification(message.data);
    });

    const unsubscribeBulkOperations = subscribe('bulk_operation', (message) => {
      handleBulkOperationNotification(message.data);
    });

    return () => {
      unsubscribePermissionChanges();
      unsubscribeRoleChanges();
      unsubscribeBulkOperations();
    };
  }, [subscribe]);

  // Update unread count
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const handlePermissionChangeNotification = useCallback(
    (notification: PermissionChangeNotification) => {
      // Only show notifications for changes affecting current user
      if (
        notification.userId !== user?.id &&
        !notification.affectedUsers?.includes(user?.id || '')
      ) {
        return;
      }

      let title = '';
      let message = '';
      let severity: 'success' | 'warning' | 'error' | 'info' = 'info';

      switch (notification.type) {
        case 'role_assigned':
          title = 'Role Assigned';
          message = `You have been assigned the role "${notification.roleName}"`;
          severity = 'success';
          break;
        case 'role_revoked':
          title = 'Role Revoked';
          message = `Your role "${notification.roleName}" has been revoked`;
          severity = 'warning';
          break;
        case 'permission_granted':
          title = 'Permission Granted';
          message = `You have been granted the permission "${notification.permission}"`;
          severity = 'success';
          break;
        case 'permission_denied':
          title = 'Permission Revoked';
          message = `Your permission "${notification.permission}" has been revoked`;
          severity = 'error';
          break;
        case 'role_updated':
          title = 'Role Updated';
          message = `The role "${notification.roleName}" has been updated. Your permissions may have changed.`;
          severity = 'info';
          break;
      }

      addNotification({
        type: 'permission_change',
        title,
        message,
        severity,
        data: notification,
        persistent: severity === 'error',
      });
    },
    [user?.id]
  );

  const handleRoleChangeNotification = useCallback((data: any) => {
    addNotification({
      type: 'role_change',
      title: 'Role System Update',
      message: data.message || 'Role definitions have been updated',
      severity: 'info',
      data,
    });
  }, []);

  const handleBulkOperationNotification = useCallback(
    (data: unknown) => {
      if (data.affectedUsers?.includes(user?.id)) {
        addNotification({
          type: 'system_update',
          title: 'Bulk Permission Update',
          message: `Your permissions have been updated as part of a bulk operation`,
          severity: 'info',
          data,
          persistent: true,
        });
      }
    },
    [user?.id]
  );

  const addNotification = useCallback(
    (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
      const newNotification: NotificationItem = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        // Keep only the most recent notifications
        return updated.slice(0, maxNotifications * 2);
      });

      // Show snackbar if enabled
      if (showInAppNotifications) {
        setActiveSnackbars((prev) => new Set([...prev, newNotification.id]));
      }

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.type,
        });
      }
    },
    [maxNotifications, showInAppNotifications]
  );

  const handleSnackbarClose = useCallback((notificationId: string) => {
    setActiveSnackbars((prev) => {
      const updated = new Set(prev);
      updated.delete(notificationId);
      return updated;
    });
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback(
    (notificationId: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      handleSnackbarClose(notificationId);
    },
    [handleSnackbarClose]
  );

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setActiveSnackbars(new Set());
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'permission_change':
        return <SecurityIcon />;
      case 'role_change':
        return <GroupIcon />;
      case 'conflict_warning':
        return <WarningIcon />;
      case 'system_update':
        return <InfoIcon />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getSeverityIcon = (severity: NotificationItem['severity']) => {
    switch (severity) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <>
      {/* Notification Bell Icon */}
      <Tooltip title="Notifications">
        <IconButton
          onClick={() => setNotificationDialogOpen(true)}
          color="inherit"
        >
          <Badge badgeContent={unreadCount} color="error">
            {unreadCount > 0 ? (
              <NotificationsActiveIcon />
            ) : (
              <NotificationsIcon />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Active Snackbars */}
      {Array.from(activeSnackbars).map((notificationId, index) => {
        const notification = notifications.find((n) => n.id === notificationId);
        if (!notification) return null;

        return (
          <Snackbar
            key={notificationId}
            open={true}
            autoHideDuration={notification.persistent ? null : autoHideDuration}
            onClose={() => handleSnackbarClose(notificationId)}
            TransitionComponent={SlideTransition}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{
              mt: index * 8, // Stack multiple snackbars
            }}
          >
            <Alert
              severity={notification.severity}
              onClose={() => handleSnackbarClose(notificationId)}
              action={
                <IconButton
                  size="small"
                  onClick={() => {
                    markAsRead(notificationId);
                    handleSnackbarClose(notificationId);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              <AlertTitle>{notification.title}</AlertTitle>
              {notification.message}
            </Alert>
          </Snackbar>
        );
      })}

      {/* Notification History Dialog */}
      <Dialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6">Notifications</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {unreadCount > 0 && (
                <Button size="small" onClick={markAllAsRead}>
                  Mark All Read
                </Button>
              )}
              <Button
                size="small"
                onClick={clearAllNotifications}
                color="error"
              >
                Clear All
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="body1" color="textSecondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            <List>
              {notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    backgroundColor: notification.read
                      ? 'transparent'
                      : 'action.hover',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    {getSeverityIcon(notification.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Typography variant="subtitle2">
                          {notification.title}
                        </Typography>
                        <Chip
                          label={notification.type.replace('_', ' ')}
                          size="small"
                          variant="outlined"
                        />
                        {!notification.read && (
                          <Chip label="New" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(notification.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <IconButton
                    size="small"
                    onClick={() => clearNotification(notification.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={requestNotificationPermission} variant="outlined">
            Enable Browser Notifications
          </Button>
          <Button onClick={() => setNotificationDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connection Status Indicator */}
      {status !== 'connected' && (
        <Snackbar
          open={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert severity="warning">
            Real-time updates{' '}
            {status === 'connecting' ? 'connecting...' : 'disconnected'}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default NotificationSystem;
