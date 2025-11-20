import React, { useState, useCallback } from 'react';
import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Typography,
  Box,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  Collapse,
} from '@mui/material';
import {
  Message as MessageIcon,
  AlternateEmail as MentionIcon,
  MedicalServices as ClinicalIcon,
  Warning as AlertIcon,
  GroupAdd as InviteIcon,
  AttachFile as FileIcon,
  Assignment as InterventionIcon,
  Help as QueryIcon,
  PriorityHigh as UrgentIcon,
  Notifications as SystemIcon,
  MoreVert as MoreIcon,
  Close as DismissIcon,
  OpenInNew as OpenIcon,
  Schedule as ScheduleIcon,
  CheckCircle as ReadIcon,
  RadioButtonUnchecked as UnreadIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { CommunicationNotification } from '../../stores/types';
import { useCommunicationStore } from '../../stores/communicationStore';

interface NotificationItemProps {
  notification: CommunicationNotification;
  onClick?: () => void;
  onDismiss?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  onDismiss,
  showActions = true,
  compact = false,
}) => {
  const { markNotificationAsRead } = useCommunicationStore();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Get notification icon based on type
  const getNotificationIcon = useCallback(() => {
    const iconProps = {
      sx: {
        color:
          notification.status === 'unread' ? 'primary.main' : 'text.secondary',
        fontSize: compact ? 20 : 24,
      },
    };

    switch (notification.type) {
      case 'new_message':
        return <MessageIcon {...iconProps} />;
      case 'mention':
        return <MentionIcon {...iconProps} />;
      case 'therapy_update':
        return <ClinicalIcon {...iconProps} />;
      case 'clinical_alert':
        return <AlertIcon {...iconProps} />;
      case 'conversation_invite':
        return <InviteIcon {...iconProps} />;
      case 'file_shared':
        return <FileIcon {...iconProps} />;
      case 'intervention_assigned':
        return <InterventionIcon {...iconProps} />;
      case 'patient_query':
        return <QueryIcon {...iconProps} />;
      case 'urgent_message':
        return <UrgentIcon {...iconProps} />;
      case 'system_notification':
        return <SystemIcon {...iconProps} />;
      default:
        return <MessageIcon {...iconProps} />;
    }
  }, [notification.type, notification.status, compact]);

  // Get priority color
  const getPriorityColor = useCallback(() => {
    switch (notification.priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  }, [notification.priority]);

  // Get notification type label
  const getTypeLabel = useCallback(() => {
    switch (notification.type) {
      case 'new_message':
        return 'New Message';
      case 'mention':
        return 'Mention';
      case 'therapy_update':
        return 'Therapy Update';
      case 'clinical_alert':
        return 'Clinical Alert';
      case 'conversation_invite':
        return 'Conversation Invite';
      case 'file_shared':
        return 'File Shared';
      case 'intervention_assigned':
        return 'Intervention Assigned';
      case 'patient_query':
        return 'Patient Query';
      case 'urgent_message':
        return 'Urgent Message';
      case 'system_notification':
        return 'System Notification';
      default:
        return 'Notification';
    }
  }, [notification.type]);

  // Format timestamp
  const formatTimestamp = useCallback(() => {
    try {
      return formatDistanceToNow(new Date(notification.createdAt), {
        addSuffix: true,
      });
    } catch {
      return 'Unknown time';
    }
  }, [notification.createdAt]);

  // Handle notification click
  const handleClick = useCallback(() => {
    if (notification.status === 'unread') {
      markNotificationAsRead(notification._id);
    }

    if (onClick) {
      onClick();
    } else if (notification.data.actionUrl) {
      // Navigate to action URL
      window.location.href = notification.data.actionUrl;
    }
  }, [notification, markNotificationAsRead, onClick]);

  // Handle mark as read/unread
  const handleToggleRead = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (notification.status === 'unread') {
        markNotificationAsRead(notification._id);
      }
      // Note: We don't have markAsUnread in the store, but could be added
    },
    [notification, markNotificationAsRead]
  );

  // Handle dismiss
  const handleDismiss = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (onDismiss) {
        onDismiss();
      }
      setMenuAnchorEl(null);
    },
    [onDismiss]
  );

  // Handle menu actions
  const handleMenuClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  // Handle expand/collapse
  const handleToggleExpand = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setExpanded(!expanded);
    },
    [expanded]
  );

  // Check if notification is scheduled
  const isScheduled =
    notification.scheduledFor &&
    new Date(notification.scheduledFor) > new Date();

  return (
    <>
      <ListItem
        button
        onClick={handleClick}
        sx={{
          backgroundColor:
            notification.status === 'unread' ? 'action.hover' : 'transparent',
          borderLeft: notification.status === 'unread' ? 3 : 0,
          borderLeftColor:
            notification.status === 'unread' ? 'primary.main' : 'transparent',
          py: compact ? 1 : 1.5,
          '&:hover': {
            backgroundColor: 'action.selected',
          },
        }}
      >
        <ListItemAvatar>
          <Avatar
            sx={{
              bgcolor:
                notification.status === 'unread' ? 'primary.light' : 'grey.300',
              width: compact ? 32 : 40,
              height: compact ? 32 : 40,
            }}
          >
            {getNotificationIcon()}
          </Avatar>
        </ListItemAvatar>

        <ListItemText
          primary={
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography
                variant={compact ? 'body2' : 'subtitle2'}
                sx={{
                  fontWeight: notification.status === 'unread' ? 600 : 400,
                  flex: 1,
                }}
                noWrap
              >
                {notification.title}
              </Typography>

              {notification.priority !== 'normal' && (
                <Chip
                  label={notification.priority}
                  size="small"
                  color={getPriorityColor() as any}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}

              {isScheduled && (
                <Tooltip title="Scheduled notification">
                  <ScheduleIcon
                    sx={{ fontSize: 16, color: 'text.secondary' }}
                  />
                </Tooltip>
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: expanded ? 'none' : compact ? 1 : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  mb: 0.5,
                }}
              >
                {notification.content}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={getTypeLabel()}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp()}
                  </Typography>
                </Box>

                {notification.content.length > 100 && (
                  <Button
                    size="small"
                    onClick={handleToggleExpand}
                    startIcon={expanded ? <CollapseIcon /> : <ExpandIcon />}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    {expanded ? 'Less' : 'More'}
                  </Button>
                )}
              </Box>
            </Box>
          }
        />

        {showActions && (
          <ListItemSecondaryAction>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip
                title={
                  notification.status === 'unread'
                    ? 'Mark as read'
                    : 'Mark as unread'
                }
              >
                <IconButton size="small" onClick={handleToggleRead}>
                  {notification.status === 'unread' ? (
                    <UnreadIcon />
                  ) : (
                    <ReadIcon />
                  )}
                </IconButton>
              </Tooltip>

              {notification.data.actionUrl && (
                <Tooltip title="Open">
                  <IconButton size="small" onClick={handleClick}>
                    <OpenIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="More actions">
                <IconButton size="small" onClick={handleMenuClick}>
                  <MoreIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </ListItemSecondaryAction>
        )}
      </ListItem>

      {/* Expanded content */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 3, pb: 2, backgroundColor: 'grey.50' }}>
          {notification.data.conversationId && (
            <Typography variant="caption" display="block" gutterBottom>
              Conversation ID: {notification.data.conversationId}
            </Typography>
          )}

          {notification.data.patientId && (
            <Typography variant="caption" display="block" gutterBottom>
              Patient ID: {notification.data.patientId}
            </Typography>
          )}

          {notification.data.senderId && (
            <Typography variant="caption" display="block" gutterBottom>
              From: {notification.data.senderId}
            </Typography>
          )}

          {notification.scheduledFor && (
            <Typography variant="caption" display="block" gutterBottom>
              Scheduled for:{' '}
              {new Date(notification.scheduledFor).toLocaleString()}
            </Typography>
          )}

          {notification.readAt && (
            <Typography variant="caption" display="block" gutterBottom>
              Read at: {new Date(notification.readAt).toLocaleString()}
            </Typography>
          )}
        </Box>
      </Collapse>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleToggleRead}>
          {notification.status === 'unread' ? (
            <>
              <ReadIcon sx={{ mr: 1 }} />
              Mark as read
            </>
          ) : (
            <>
              <UnreadIcon sx={{ mr: 1 }} />
              Mark as unread
            </>
          )}
        </MenuItem>

        {notification.data.actionUrl && (
          <MenuItem onClick={handleClick}>
            <OpenIcon sx={{ mr: 1 }} />
            Open
          </MenuItem>
        )}

        <MenuItem onClick={handleDismiss}>
          <DismissIcon sx={{ mr: 1 }} />
          Dismiss
        </MenuItem>
      </Menu>
    </>
  );
};

export default NotificationItem;
