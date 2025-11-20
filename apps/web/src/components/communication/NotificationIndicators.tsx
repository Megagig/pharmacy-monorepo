import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Badge,
  IconButton,
  Tooltip,
  Slide,
  Avatar,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Circle as DotIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useCommunicationStore } from '../../stores/communicationStore';
import { CommunicationNotification } from '../../stores/types';

interface NotificationIndicatorsProps {
  showBadge?: boolean;
  showToast?: boolean;
  showPulse?: boolean;
  maxToastNotifications?: number;
  toastDuration?: number;
  onNotificationClick?: (notification: CommunicationNotification) => void;
}

interface ToastNotification extends CommunicationNotification {
  toastId: string;
  showToast: boolean;
}

const NotificationIndicators: React.FC<NotificationIndicatorsProps> = ({
  showBadge = true,
  showToast = true,
  showPulse = true,
  maxToastNotifications = 3,
  toastDuration = 5000,
  onNotificationClick,
}) => {
  const { notifications, unreadCount } = useCommunicationStore();
  const [toastNotifications, setToastNotifications] = useState<
    ToastNotification[]
  >([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle new notifications for toast display
  useEffect(() => {
    const newUnreadNotifications = notifications.filter(
      (n) => n.status === 'unread'
    );

    // Find truly new notifications (not already in toast queue)
    const existingToastIds = toastNotifications.map((t) => t._id);
    const newNotifications = newUnreadNotifications.filter(
      (n) =>
        !existingToastIds.includes(n._id) &&
        ['urgent', 'high'].includes(n.priority) // Only show toast for high priority
    );

    if (newNotifications.length > 0 && showToast) {
      const newToasts: ToastNotification[] = newNotifications
        .slice(0, maxToastNotifications)
        .map((notification) => ({
          ...notification,
          toastId: `toast-${notification._id}-${Date.now()}`,
          showToast: true,
        }));

      setToastNotifications((prev) => [...prev, ...newToasts]);

      // Auto-remove toasts after duration
      newToasts.forEach((toast) => {
        setTimeout(() => {
          setToastNotifications((prev) =>
            prev.map((t) =>
              t.toastId === toast.toastId ? { ...t, showToast: false } : t
            )
          );

          // Remove from array after fade out
          setTimeout(() => {
            setToastNotifications((prev) =>
              prev.filter((t) => t.toastId !== toast.toastId)
            );
          }, 300);
        }, toastDuration);
      });
    }
  }, [
    notifications,
    showToast,
    maxToastNotifications,
    toastDuration,
    toastNotifications,
  ]);

  // Animate badge when unread count changes
  useEffect(() => {
    if (unreadCount > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  // Handle toast notification click
  const handleToastClick = useCallback(
    (notification: ToastNotification) => {
      if (onNotificationClick) {
        onNotificationClick(notification);
      }

      // Remove the toast
      setToastNotifications((prev) =>
        prev.filter((t) => t.toastId !== notification.toastId)
      );
    },
    [onNotificationClick]
  );

  // Handle toast dismiss
  const handleToastDismiss = useCallback((toastId: string) => {
    setToastNotifications((prev) =>
      prev.map((t) => (t.toastId === toastId ? { ...t, showToast: false } : t))
    );

    setTimeout(() => {
      setToastNotifications((prev) =>
        prev.filter((t) => t.toastId !== toastId)
      );
    }, 300);
  }, []);

  // Get notification icon based on state
  const getNotificationIcon = () => {
    if (unreadCount === 0) {
      return <NotificationsIcon />;
    }

    const hasUrgent = notifications.some(
      (n) =>
        n.status === 'unread' && ['urgent', 'critical'].includes(n.priority)
    );

    return hasUrgent ? <NotificationsActiveIcon /> : <NotificationsIcon />;
  };

  // Get priority color for toast
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'info';
    }
  };

  // Get notification type icon
  const getTypeIcon = (type: string) => {
    return <DotIcon sx={{ fontSize: 12 }} />;
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Main notification badge */}
      {showBadge && (
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              animation:
                isAnimating && showPulse ? 'pulse 0.6s ease-in-out' : 'none',
              '@keyframes pulse': {
                '0%': {
                  transform: 'scale(1)',
                },
                '50%': {
                  transform: 'scale(1.2)',
                },
                '100%': {
                  transform: 'scale(1)',
                },
              },
            },
          }}
        >
          <Tooltip title={`${unreadCount} unread notifications`}>
            <IconButton
              color={unreadCount > 0 ? 'primary' : 'default'}
              sx={{
                color: unreadCount > 0 ? 'primary.main' : 'text.secondary',
                animation:
                  unreadCount > 0 && showPulse
                    ? 'glow 2s ease-in-out infinite alternate'
                    : 'none',
                '@keyframes glow': {
                  '0%': {
                    boxShadow: '0 0 5px rgba(25, 118, 210, 0.3)',
                  },
                  '100%': {
                    boxShadow: '0 0 20px rgba(25, 118, 210, 0.6)',
                  },
                },
              }}
            >
              {getNotificationIcon()}
            </IconButton>
          </Tooltip>
        </Badge>
      )}

      {/* Urgent notification pulse indicator */}
      {showPulse &&
        notifications.some(
          (n) =>
            n.status === 'unread' && ['urgent', 'critical'].includes(n.priority)
        ) && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'error.main',
              animation: 'urgentPulse 1s ease-in-out infinite',
              '@keyframes urgentPulse': {
                '0%, 100%': {
                  opacity: 1,
                  transform: 'scale(1)',
                },
                '50%': {
                  opacity: 0.5,
                  transform: 'scale(1.5)',
                },
              },
            }}
          />
        )}

      {/* Toast notifications */}
      {showToast && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 16,
            zIndex: 1400,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxWidth: 400,
          }}
        >
          {toastNotifications.map((notification, index) => (
            <Slide
              key={notification.toastId}
              direction="left"
              in={notification.showToast}
              timeout={300}
              style={{
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <Paper
                elevation={6}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderLeft: 4,
                  borderLeftColor: `${getPriorityColor(
                    notification.priority
                  )}.main`,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                onClick={() => handleToastClick(notification)}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: `${getPriorityColor(
                        notification.priority
                      )}.light`,
                    }}
                  >
                    {getTypeIcon(notification.type)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notification.title}
                      </Typography>

                      <Chip
                        label={notification.priority}
                        size="small"
                        color={getPriorityColor(notification.priority) as any}
                        sx={{ height: 16, fontSize: '0.6rem' }}
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {notification.content}
                    </Typography>
                  </Box>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToastDismiss(notification.toastId);
                    }}
                    sx={{ mt: -0.5, mr: -0.5 }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Paper>
            </Slide>
          ))}
        </Box>
      )}

      {/* Connection status indicator */}
      <Box
        sx={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: 'success.main',
          border: 2,
          borderColor: 'background.paper',
          display: unreadCount > 0 ? 'block' : 'none',
        }}
      />
    </Box>
  );
};

export default NotificationIndicators;
