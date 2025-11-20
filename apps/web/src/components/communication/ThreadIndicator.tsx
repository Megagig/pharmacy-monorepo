import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Forum,
  Reply,
  ExpandMore,
  ExpandLess,
  Person,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface ThreadIndicatorProps {
  threadId: string;
  replyCount: number;
  participants: string[];
  lastReplyAt?: string;
  unreadCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
  onViewThread?: () => void;
  variant?: 'compact' | 'detailed';
}

const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
  threadId,
  replyCount,
  participants,
  lastReplyAt,
  unreadCount = 0,
  expanded = false,
  onToggle,
  onViewThread,
  variant = 'compact',
}) => {
  if (replyCount === 0) {
    return null;
  }

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onViewThread) {
      onViewThread();
    }
  };

  const handleToggleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  if (variant === 'compact') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: 1,
          p: 1,
          bgcolor: 'primary.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.light',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'primary.100',
          },
        }}
        onClick={handleClick}
      >
        <Forum color="primary" fontSize="small" />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="primary" fontWeight="bold">
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </Typography>

            {unreadCount > 0 && (
              <Badge
                badgeContent={unreadCount}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.6rem',
                    minWidth: '16px',
                    height: '16px',
                  },
                }}
              />
            )}
          </Box>

          {lastReplyAt && (
            <Typography variant="caption" color="text.secondary">
              Last reply{' '}
              {formatDistanceToNow(new Date(lastReplyAt), { addSuffix: true })}
            </Typography>
          )}
        </Box>

        {onToggle && (
          <Tooltip title={expanded ? 'Collapse thread' : 'Expand thread'}>
            <IconButton size="small" onClick={handleToggleClick}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Detailed variant
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mt: 1,
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: onViewThread ? 'pointer' : 'default',
        '&:hover': onViewThread
          ? {
              bgcolor: 'action.hover',
            }
          : {},
      }}
      onClick={onViewThread ? handleClick : undefined}
    >
      <Forum color="primary" />

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
          <Typography variant="subtitle2" color="primary" fontWeight="bold">
            Thread Discussion
          </Typography>

          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} new`}
              size="small"
              color="error"
              variant="filled"
              sx={{ height: 20, fontSize: '0.75rem' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Reply fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Person fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {participants.length} participant
              {participants.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {lastReplyAt && (
            <Typography variant="body2" color="text.secondary">
              Last reply{' '}
              {formatDistanceToNow(new Date(lastReplyAt), { addSuffix: true })}
            </Typography>
          )}
        </Box>
      </Box>

      {onToggle && (
        <Tooltip title={expanded ? 'Collapse thread' : 'Expand thread'}>
          <IconButton onClick={handleToggleClick}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default ThreadIndicator;
