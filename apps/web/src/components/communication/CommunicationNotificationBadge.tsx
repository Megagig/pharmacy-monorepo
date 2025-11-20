import React, { useEffect, useState } from 'react';
import {
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Forum as ForumIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCommunicationStore } from '../../stores/communicationStore';
import { formatDistanceToNow } from 'date-fns';

interface CommunicationNotificationBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showPreview?: boolean;
  maxPreviewItems?: number;
}

const CommunicationNotificationBadge: React.FC<
  CommunicationNotificationBadgeProps
> = ({ size = 'medium', showPreview = true, maxPreviewItems = 5 }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const {
    unreadCount,
    notifications,
    getRecentMessages,
    markNotificationAsRead,
  } = useCommunicationStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    // Combine recent messages and notifications for preview
    const recentMessages = getRecentMessages(3);
    const recentNotifications = notifications
      .filter((n) => n.status === 'unread')
      .slice(0, 2)
      .map((n) => ({ ...n, type: 'notification' }));

    const combined = [
      ...recentMessages.map((m) => ({ ...m, type: 'message' })),
      ...recentNotifications,
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, maxPreviewItems);

    setRecentActivity(combined);
  }, [notifications, getRecentMessages, maxPreviewItems]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showPreview && (unreadCount > 0 || recentActivity.length > 0)) {
      setAnchorEl(event.currentTarget);
    } else {
      navigate('/pharmacy/communication');
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/pharmacy/communication');
  };

  const handleItemClick = (item: any) => {
    if (item.type === 'notification') {
      markNotificationAsRead(item._id);
      if (item.data?.conversationId) {
        navigate(
          `/pharmacy/communication?conversation=${item.data.conversationId}`
        );
      } else {
        navigate('/pharmacy/communication');
      }
    } else if (item.type === 'message') {
      navigate(`/pharmacy/communication?conversation=${item.conversationId}`);
    }
    handleClose();
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 'small';
      case 'large':
        return 'large';
      default:
        return 'medium';
    }
  };

  const getBadgeColor = () => {
    if (unreadCount === 0) return 'default';
    if (unreadCount > 10) return 'error';
    if (unreadCount > 5) return 'warning';
    return 'primary';
  };

  const renderPreviewItem = (item: any, index: number) => {
    const isNotification = item.type === 'notification';
    const isMessage = item.type === 'message';

    return (
      <ListItem
        key={`${item.type}-${item._id}-${index}`}
        button
        onClick={() => handleItemClick(item)}
        sx={{
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.05),
          },
        }}
      >
        <ListItemAvatar>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: isNotification
                ? theme.palette.warning.main
                : theme.palette.primary.main,
            }}
          >
            {isNotification ? (
              <NotificationsIcon fontSize="small" />
            ) : (
              <MessageIcon fontSize="small" />
            )}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Typography variant="body2" noWrap>
              {isNotification
                ? item.title
                : item.content?.text || 'File attachment'}
            </Typography>
          }
          secondary={
            <Box display="flex" alignItems="center" gap={1}>
              <ScheduleIcon fontSize="inherit" />
              <Typography variant="caption">
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                })}
              </Typography>
              {isNotification && item.priority === 'urgent' && (
                <Typography
                  variant="caption"
                  sx={{
                    bgcolor: theme.palette.error.main,
                    color: 'white',
                    px: 0.5,
                    borderRadius: 0.5,
                    fontSize: '0.6rem',
                  }}
                >
                  URGENT
                </Typography>
              )}
            </Box>
          }
        />
      </ListItem>
    );
  };

  return (
    <>
      <Tooltip title="Communication Hub">
        <IconButton
          size={getIconSize() as any}
          color="inherit"
          onClick={handleClick}
          sx={{
            position: 'relative',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color={getBadgeColor() as any}
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: size === 'small' ? '0.6rem' : '0.75rem',
                minWidth: size === 'small' ? 16 : 20,
                height: size === 'small' ? 16 : 20,
                animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'scale(1.1)',
                    opacity: 0.8,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              },
            }}
          >
            <ForumIcon fontSize={getIconSize() as any} />
          </Badge>
        </IconButton>
      </Tooltip>

      {showPreview && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              width: 350,
              maxHeight: 400,
              mt: 1,
              boxShadow: theme.shadows[8],
            },
          }}
        >
          <Box
            sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            <Typography variant="h6" fontWeight="bold">
              Communication Hub
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {unreadCount > 0
                ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </Typography>
          </Box>

          {recentActivity.length > 0 ? (
            <>
              <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
                {recentActivity.map((item, index) =>
                  renderPreviewItem(item, index)
                )}
              </List>
              <Divider />
              <Box sx={{ p: 1 }}>
                <Button
                  fullWidth
                  variant="text"
                  onClick={handleViewAll}
                  sx={{ textTransform: 'none' }}
                >
                  View All in Communication Hub
                </Button>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <ForumIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">
                No recent activity
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleViewAll}
                sx={{ mt: 1 }}
              >
                Open Communication Hub
              </Button>
            </Box>
          )}
        </Menu>
      )}
    </>
  );
};

export default CommunicationNotificationBadge;
