import React, { useState } from 'react';
import {
  Box,
  ListItemButton,
  Avatar,
  Typography,
  Chip,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  AvatarGroup,
} from '@mui/material';
import {
  MoreVert,
  Group,
  Person,
  QuestionAnswer,
  Archive,
  CheckCircle,
  Delete,
  Unarchive,
  PriorityHigh,
  Schedule,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '../../stores/types';
import { useCommunicationStore } from '../../stores/communicationStore';
// Removed useThrottle import as it was causing click issues

interface ConversationItemProps {
  conversation: Conversation;
  selected?: boolean;
  onClick?: () => void;
  onAction?: (action: string, conversationId: string) => void;
  compact?: boolean;
}

const ConversationItem: React.FC<ConversationItemProps> = React.memo(({
  conversation,
  selected = false,
  onClick,
  onAction,
  compact = false,
}) => {
  const { messages } = useCommunicationStore();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // Get conversation messages to calculate unread count
  const conversationMessages = messages[conversation._id] || [];
  const unreadCount = conversationMessages.filter(
    (msg) => msg.status !== 'read'
  ).length;

  // Get conversation type icon
  const getTypeIcon = () => {
    switch (conversation.type) {
      case 'group':
        return <Group fontSize="small" />;
      case 'patient_query':
        return <QuestionAnswer fontSize="small" />;
      default:
        return <Person fontSize="small" />;
    }
  };

  // Get conversation status color
  const getStatusColor = () => {
    switch (conversation.status) {
      case 'resolved':
        return 'success.main';
      case 'archived':
        return 'text.disabled';
      default:
        return 'text.primary';
    }
  };

  // Get priority color
  const getPriorityColor = () => {
    switch (conversation.priority) {
      case 'urgent':
        return 'error.main';
      case 'high':
        return 'warning.main';
      case 'low':
        return 'info.main';
      default:
        return 'text.secondary';
    }
  };

  // Format last message time
  const formatLastMessageTime = () => {
    try {
      return formatDistanceToNow(new Date(conversation.lastMessageAt), {
        addSuffix: true,
      });
    } catch {
      return 'Unknown';
    }
  };

  // Get conversation title
  const getConversationTitle = () => {
    if (conversation.title) {
      return conversation.title;
    }

    // Generate title based on type and participants
    switch (conversation.type) {
      case 'patient_query':
        return 'Patient Query';
      case 'group':
        return `Group Chat (${conversation.participants.length})`;
      default:
        return 'Direct Message';
    }
  };

  // Get conversation subtitle
  const getConversationSubtitle = () => {
    const participantRoles = conversation.participants
      .map((p) => p.role)
      .filter((role, index, arr) => arr.indexOf(role) === index);

    return participantRoles.join(', ');
  };

  // Handle menu actions
  const handleMenuAction = (action: string) => {
    setMenuAnchor(null);
    onAction?.(action, conversation._id);
  };

  // Handle menu click
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  // Handle conversation click
  const handleConversationClick = (event: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  // Get available actions based on conversation status
  const getAvailableActions = () => {
    const actions = [];

    if (conversation.status === 'active') {
      actions.push(
        {
          key: 'archive',
          label: 'Archive',
          icon: <Archive fontSize="small" />,
        },
        {
          key: 'resolve',
          label: 'Mark as Resolved',
          icon: <CheckCircle fontSize="small" />,
        }
      );
    }

    if (conversation.status === 'archived') {
      actions.push({
        key: 'unarchive',
        label: 'Unarchive',
        icon: <Unarchive fontSize="small" />,
      });
    }

    actions.push({
      key: 'delete',
      label: 'Delete',
      icon: <Delete fontSize="small" />,
      danger: true,
    });

    return actions;
  };

  const availableActions = getAvailableActions();

  return (
    <>
      <ListItemButton
        selected={selected}
        onClick={handleConversationClick}
        sx={{
          width: '100%',
          p: compact ? 1 : 2,
          borderRadius: 1,
          mb: 0.5,
          '&.Mui-selected': {
            bgcolor: 'primary.light',
            '&:hover': {
              bgcolor: 'primary.light',
            },
          },
        }}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}
        >
          {/* Avatar/Icon */}
          <Box sx={{ position: 'relative' }}>
            {conversation.type === 'group' ? (
              <AvatarGroup
                max={2}
                sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
              >
                {conversation.participants
                  .slice(0, 2)
                  .map((participant, index) => (
                    <Avatar
                      key={participant.userId}
                      sx={{ bgcolor: 'primary.main' }}
                    >
                      {participant.role.charAt(0).toUpperCase()}
                    </Avatar>
                  ))}
              </AvatarGroup>
            ) : (
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                {getTypeIcon()}
              </Avatar>
            )}

            {/* Priority indicator */}
            {conversation.priority === 'urgent' && (
              <PriorityHigh
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  color: 'error.main',
                  fontSize: 16,
                }}
              />
            )}
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Title and Status */}
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography
                variant={compact ? 'body2' : 'subtitle2'}
                noWrap
                sx={{
                  flex: 1,
                  fontWeight: unreadCount > 0 ? 'bold' : 'normal',
                  color: getStatusColor(),
                }}
              >
                {getConversationTitle()}
              </Typography>

              {/* Status indicators */}
              {conversation.status === 'resolved' && (
                <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
              )}
              {conversation.status === 'archived' && (
                <Archive sx={{ fontSize: 16, color: 'text.disabled' }} />
              )}
            </Box>

            {/* Subtitle and metadata */}
            {!compact && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ flex: 1 }}
                >
                  {getConversationSubtitle()}
                </Typography>

                {conversation.priority !== 'normal' && (
                  <Chip
                    label={conversation.priority}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.625rem',
                      bgcolor: getPriorityColor(),
                      color: 'white',
                    }}
                  />
                )}
              </Box>
            )}

            {/* Tags */}
            {!compact && conversation.tags && conversation.tags.length > 0 && (
              <Box
                sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}
              >
                {conversation.tags.slice(0, 2).map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ height: 16, fontSize: '0.625rem' }}
                  />
                ))}
                {conversation.tags.length > 2 && (
                  <Typography variant="caption" color="text.secondary">
                    +{conversation.tags.length - 2} more
                  </Typography>
                )}
              </Box>
            )}

            {/* Last message time */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatLastMessageTime()}
              </Typography>
            </Box>
          </Box>

          {/* Right side indicators */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Unread count */}
            {unreadCount > 0 && (
              <Badge
                badgeContent={unreadCount}
                color="primary"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.625rem',
                    height: 16,
                    minWidth: 16,
                  },
                }}
              />
            )}

            {/* Menu button */}
            <Tooltip title="More options">
              <IconButton
                size="small"
                onClick={handleMenuClick}
                sx={{ opacity: selected ? 1 : 0.7 }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </ListItemButton>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
      >
        {availableActions.map((action) => (
          <MenuItem
            key={action.key}
            onClick={() => handleMenuAction(action.key)}
            sx={{
              color: action.danger ? 'error.main' : 'inherit',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {action.icon}
              {action.label}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
});

export default ConversationItem;
