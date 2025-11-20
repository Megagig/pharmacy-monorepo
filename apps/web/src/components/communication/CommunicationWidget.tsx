import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  Forum as ForumIcon,
  Message as MessageIcon,
  Notifications as NotificationsIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowForwardIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCommunicationStore } from '../../stores/communicationStore';
import { formatDistanceToNow } from 'date-fns';

interface CommunicationWidgetProps {
  variant?: 'overview' | 'recent-messages' | 'notifications';
  height?: number;
  showHeader?: boolean;
}

const CommunicationWidget: React.FC<CommunicationWidgetProps> = ({
  variant = 'overview',
  height = 300,
  showHeader = true,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const {
    conversations,
    notifications,
    unreadCount,
    getRecentMessages,
    loading,
  } = useCommunicationStore();

  const [metrics, setMetrics] = useState({
    totalConversations: 0,
    unreadMessages: 0,
    activeChats: 0,
    pendingQueries: 0,
  });

  useEffect(() => {
    // Calculate metrics from store data
    const activeConversations = conversations.filter(
      (conv) => conv.status === 'active'
    );
    const pendingQueries = conversations.filter(
      (conv) => conv.type === 'patient_query' && conv.status === 'active'
    );

    setMetrics({
      totalConversations: conversations.length,
      unreadMessages: unreadCount,
      activeChats: activeConversations.length,
      pendingQueries: pendingQueries.length,
    });
  }, [conversations, unreadCount]);

  const handleNavigateToHub = () => {
    navigate('/pharmacy/communication');
  };

  const handleNavigateToConversation = (conversationId: string) => {
    navigate(`/pharmacy/communication?conversation=${conversationId}`);
  };

  const renderOverviewWidget = () => (
    <Card
      sx={{
        height,
        background: `linear-gradient(135deg, ${alpha(
          theme.palette.primary.main,
          0.1
        )} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.3s ease',
      }}
    >
      <CardContent
        sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {showHeader && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 32,
                  height: 32,
                }}
              >
                <ForumIcon fontSize="small" />
              </Avatar>
              <Typography variant="h6" fontWeight="bold">
                Communication Hub
              </Typography>
            </Box>
            <Tooltip title="Open Communication Hub">
              <IconButton
                onClick={handleNavigateToHub}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Metrics Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              flex: 1,
            }}
          >
            <motion.div whileHover={{ scale: 1.02 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {loading ? (
                    <Skeleton width={40} />
                  ) : (
                    metrics.totalConversations
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Conversations
                </Typography>
              </Box>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {loading ? <Skeleton width={40} /> : metrics.unreadMessages}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Unread Messages
                </Typography>
              </Box>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  {loading ? <Skeleton width={40} /> : metrics.activeChats}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Chats
                </Typography>
              </Box>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" color="error.main" fontWeight="bold">
                  {loading ? <Skeleton width={40} /> : metrics.pendingQueries}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending Queries
                </Typography>
              </Box>
            </motion.div>
          </Box>

          {/* Quick Actions */}
          <Box display="flex" gap={1} justifyContent="center">
            <Chip
              icon={<MessageIcon />}
              label="New Message"
              onClick={handleNavigateToHub}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: 'white',
                '&:hover': { bgcolor: theme.palette.primary.dark },
              }}
            />
            <Chip
              icon={<NotificationsIcon />}
              label={`${notifications.length} Notifications`}
              onClick={handleNavigateToHub}
              variant="outlined"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderRecentMessagesWidget = () => {
    const recentMessages = getRecentMessages(5);

    return (
      <Card sx={{ height, overflow: 'hidden' }}>
        <CardContent
          sx={{
            p: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {showHeader && (
            <Box
              sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
            >
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="h6" fontWeight="bold">
                  Recent Messages
                </Typography>
                <IconButton onClick={handleNavigateToHub} size="small">
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
            </Box>
          )}

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <List>
                {[...Array(3)].map((_, index) => (
                  <ListItem key={index}>
                    <ListItemAvatar>
                      <Skeleton variant="circular" width={40} height={40} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Skeleton width="60%" />}
                      secondary={<Skeleton width="80%" />}
                    />
                  </ListItem>
                ))}
              </List>
            ) : recentMessages.length > 0 ? (
              <List dense>
                {recentMessages.map((message) => (
                  <ListItem
                    key={message._id}
                    button
                    onClick={() =>
                      handleNavigateToConversation(message.conversationId)
                    }
                    sx={{
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap>
                          {message.content.text || 'File attachment'}
                        </Typography>
                      }
                      secondary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <ScheduleIcon fontSize="inherit" />
                          <Typography variant="caption">
                            {formatDistanceToNow(new Date(message.createdAt), {
                              addSuffix: true,
                            })}
                          </Typography>
                        </Box>
                      }
                    />
                    {message.status === 'sent' && (
                      <Badge color="primary" variant="dot" />
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <ForumIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">
                  No recent messages
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderNotificationsWidget = () => (
    <Card sx={{ height, overflow: 'hidden' }}>
      <CardContent
        sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {showHeader && (
          <Box
            sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight="bold">
                Notifications
              </Typography>
              <Badge
                badgeContent={
                  notifications.filter((n) => n.status === 'unread').length
                }
                color="error"
              >
                <IconButton onClick={handleNavigateToHub} size="small">
                  <NotificationsIcon />
                </IconButton>
              </Badge>
            </Box>
          </Box>
        )}

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <List>
              {[...Array(3)].map((_, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={<Skeleton width="70%" />}
                    secondary={<Skeleton width="50%" />}
                  />
                </ListItem>
              ))}
            </List>
          ) : notifications.length > 0 ? (
            <List dense>
              {notifications.slice(0, 5).map((notification) => (
                <ListItem
                  key={notification._id}
                  sx={{
                    bgcolor:
                      notification.status === 'unread'
                        ? alpha(theme.palette.primary.main, 0.05)
                        : 'transparent',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={
                          notification.status === 'unread' ? 600 : 400
                        }
                      >
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            { addSuffix: true }
                          )}
                        </Typography>
                        <Chip
                          size="small"
                          label={notification.priority}
                          color={
                            notification.priority === 'urgent'
                              ? 'error'
                              : 'default'
                          }
                          sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <NotificationsIcon
                sx={{ fontSize: 48, color: 'text.disabled' }}
              />
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  switch (variant) {
    case 'recent-messages':
      return renderRecentMessagesWidget();
    case 'notifications':
      return renderNotificationsWidget();
    case 'overview':
    default:
      return renderOverviewWidget();
  }
};

export default CommunicationWidget;
