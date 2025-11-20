import React, { useState, useEffect } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Paper,
  Tooltip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ReplyIcon from '@mui/icons-material/Reply';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ForumIcon from '@mui/icons-material/Forum';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { Message } from '../../stores/types';
import { formatDistanceToNow, format } from 'date-fns';
import { formatMessageTimestamp } from '../../utils/dateUtils';
import { useResponsive, useIsTouchDevice } from '../../hooks/useResponsive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import MentionDisplay from './MentionDisplay';
import ThreadIndicator from './ThreadIndicator';
import ThreadView from './ThreadView';

interface MessageItemProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isOwn?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onCreateThread?: (messageId: string) => void;
  onViewThread?: (threadId: string) => void;
  compact?: boolean;
  showThreading?: boolean;
  conversationId?: string;
  mobile?: boolean;
  touchOptimized?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({
  message,
  showAvatar = true,
  showTimestamp = true,
  isOwn = false,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onCreateThread,
  onViewThread,
  compact = false,
  showThreading = true,
  conversationId,
  mobile = false,
  touchOptimized = false,
}) => {
  const theme = useTheme();
  const { isMobile, isSmallMobile } = useResponsive();

  // Debug message data (removed for performance)
  const isTouchDevice = useIsTouchDevice();

  // Use mobile mode if explicitly set or detected
  const isMobileMode = mobile || isMobile;
  const isCompactMode = compact || isSmallMobile;
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(message.content.text || '');
  const [showReactions, setShowReactions] = useState(false);
  const [threadSummary, setThreadSummary] = useState<{
    replyCount: number;
    participants: string[];
    lastReplyAt?: string;
    unreadCount: number;
  } | null>(null);
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const menuOpen = Boolean(menuAnchor);
  const messageRef = React.useRef<HTMLDivElement>(null);

  // Touch gestures for mobile interactions
  const { attachGestures } = useTouchGestures({
    onSwipeRight: () => {
      if (isMobileMode && !isOwn) {
        handleReply();
      }
    },
    onSwipeLeft: () => {
      if (isMobileMode && isOwn) {
        handleEdit();
      }
    },
    onLongPress: () => {
      if (isMobileMode) {
        handleMenuClick({ currentTarget: messageRef.current } as unknown);
      }
    },
    onDoubleTap: () => {
      if (isMobileMode) {
        handleReactionClick('👍');
      }
    },
  });

  // Attach gestures to message element
  React.useEffect(() => {
    if (touchOptimized && messageRef.current) {
      attachGestures(messageRef.current);
    }
  }, [touchOptimized, attachGestures]);

  // Fetch thread summary if this message has a thread
  useEffect(() => {
    const fetchThreadSummary = async () => {
      if (!message.threadId || !showThreading) return;

      try {
        setLoadingThread(true);
        const response = await fetch(
          `/api/communication/threads/${message.threadId}/summary`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          setThreadSummary({
            replyCount: result.data.replyCount,
            participants: result.data.participants,
            lastReplyAt: result.data.lastReplyAt,
            unreadCount: result.data.unreadCount,
          });
        }
      } catch (error) {
        console.error('Failed to fetch thread summary:', error);
      } finally {
        setLoadingThread(false);
      }
    };

    fetchThreadSummary();
  }, [message.threadId, showThreading]);

  // Check if this message is the root of a thread
  const isThreadRoot = message.threadId === message._id;
  const hasThread = threadSummary && threadSummary.replyCount > 0;

  // Handle menu actions
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleReply = () => {
    onReply?.(message);
    handleMenuClose();
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete?.(message._id);
    handleMenuClose();
  };

  const handleCreateThread = () => {
    onCreateThread?.(message._id);
    handleMenuClose();
  };

  const handleViewThread = () => {
    if (message.threadId) {
      onViewThread?.(message.threadId);
    }
  };

  const handleEditSave = () => {
    if (editContent.trim() !== message.content.text) {
      onEdit?.(message._id, editContent.trim());
    }
    setEditDialogOpen(false);
  };

  const handleEditCancel = () => {
    setEditContent(message.content.text || '');
    setEditDialogOpen(false);
  };

  // Handle reactions
  const handleReactionClick = (emoji: string) => {
    onReaction?.(message._id, emoji);
    setShowReactions(false);
  };

  // Get message status icon
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <CheckIcon fontSize="small" color="disabled" />;
      case 'delivered':
        return <CheckCircleIcon fontSize="small" color="disabled" />;
      case 'read':
        return <CheckCircleIcon fontSize="small" color="primary" />;
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />;
      default:
        return <ScheduleIcon fontSize="small" color="disabled" />;
    }
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon />;
    }
    return <DescriptionIcon />;
  };

  // Use optimized timestamp formatting
  const formatTimestamp = formatMessageTimestamp;

  // Check if user has reacted with emoji
  const hasUserReacted = (emoji: string) => {
    // TODO: Get current user ID and check reactions
    return false;
  };

  // Group reactions by emoji
  const groupedReactions = message.reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof message.reactions>);

  if (message.isDeleted) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 2,
          opacity: 0.6,
        }}
      >
        {showAvatar && (
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.300' }}>
            <DeleteIcon fontSize="small" />
          </Avatar>
        )}
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          This message was deleted
        </Typography>
        {showTimestamp && (
          <Typography variant="caption" color="text.secondary">
            {formatTimestamp(message.deletedAt || message.createdAt)}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      ref={messageRef}
      sx={{
        display: 'flex',
        gap: isMobileMode ? 0.5 : 1,
        py: isCompactMode ? 0.5 : 1,
        px: isMobileMode ? 0.5 : 1,
        '&:hover': !isMobileMode
          ? {
              bgcolor: 'action.hover',
            }
          : {},
        alignItems: 'flex-start',
        position: 'relative',
        transform: `translateX(${swipeOffset}px)`,
        transition: isSwipeActive ? 'none' : 'transform 0.2s ease',
        // Mobile-specific touch styles
        ...(isMobileMode && {
          minHeight: 48, // Minimum touch target size
          '&:active': {
            bgcolor: 'action.selected',
          },
        }),
      }}
    >
      {/* Avatar */}
      {showAvatar ? (
        <Avatar
          sx={{
            width: isMobileMode ? 28 : 32,
            height: isMobileMode ? 28 : 32,
            fontSize: isMobileMode ? '0.75rem' : '1rem',
          }}
        >
          {/* TODO: Get user initials or avatar */}U
        </Avatar>
      ) : (
        <Box sx={{ width: isMobileMode ? 28 : 32 }} /> // Spacer for alignment
      )}

      {/* Message Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        {showAvatar && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobileMode ? 0.5 : 1,
              mb: 0.5,
              flexWrap: isMobileMode ? 'wrap' : 'nowrap',
            }}
          >
            <Typography
              variant={isMobileMode ? 'body2' : 'subtitle2'}
              fontWeight="bold"
              sx={{ fontSize: isMobileMode ? '0.875rem' : undefined }}
            >
              {message.senderId && typeof message.senderId === 'object' 
                ? `${message.senderId.firstName} ${message.senderId.lastName}`
                : 'Unknown User'
              }
            </Typography>

            {message.priority === 'urgent' && (
              <Chip
                label="Urgent"
                size="small"
                color="error"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            )}

            {showTimestamp && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: isMobileMode ? '0.75rem' : undefined,
                  flexShrink: 0,
                }}
              >
                {formatTimestamp(message.createdAt)}
              </Typography>
            )}

            {message.editHistory.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                (edited)
              </Typography>
            )}
          </Box>
        )}

        {/* Message Content */}
        <Box>
          {/* Text Content with Mentions */}
          {message.content.text && (
            <MentionDisplay
              text={message.content.text}
              mentions={message.mentions}
              variant="body2"
              onMentionClick={(userId) => {
                // TODO: Handle mention click (e.g., show user profile)

              }}
              sx={{
                mb: message.content.attachments?.length ? 1 : 0,
              }}
            />
          )}

          {/* Attachments */}
          {message.content.attachments &&
            message.content.attachments.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {message.content.attachments.map((attachment, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      p: isMobileMode ? 0.75 : 1,
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobileMode ? 0.5 : 1,
                      maxWidth: isMobileMode ? '100%' : 300,
                      cursor: isMobileMode ? 'pointer' : 'default',
                      '&:active': isMobileMode
                        ? {
                            bgcolor: 'action.selected',
                          }
                        : {},
                    }}
                  >
                    {getFileIcon(attachment.mimeType)}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {attachment.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(attachment.fileSize / 1024).toFixed(1)} KB
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() =>
                          window.open(attachment.secureUrl, '_blank')
                        }
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                ))}
              </Box>
            )}

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
              {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                <Chip
                  key={emoji}
                  label={`${emoji} ${reactions.length}`}
                  size="small"
                  variant={hasUserReacted(emoji) ? 'filled' : 'outlined'}
                  onClick={() => handleReactionClick(emoji)}
                  sx={{
                    height: isMobileMode ? 28 : 24,
                    fontSize: isMobileMode ? '0.8rem' : '0.75rem',
                    cursor: 'pointer',
                    minWidth: isMobileMode ? 44 : 'auto', // Minimum touch target
                    '&:hover': !isMobileMode
                      ? {
                          bgcolor: 'action.hover',
                        }
                      : {},
                    '&:active': isMobileMode
                      ? {
                          bgcolor: 'action.selected',
                        }
                      : {},
                  }}
                />
              ))}
            </Box>
          )}

          {/* Thread Indicator */}
          {showThreading && hasThread && isThreadRoot && (
            <ThreadIndicator
              threadId={message.threadId!}
              replyCount={threadSummary.replyCount}
              participants={threadSummary.participants}
              lastReplyAt={threadSummary.lastReplyAt}
              unreadCount={threadSummary.unreadCount}
              expanded={threadExpanded}
              onToggle={() => setThreadExpanded(!threadExpanded)}
              onViewThread={handleViewThread}
              variant="compact"
            />
          )}
        </Box>

        {/* Thread View */}
        {showThreading &&
          hasThread &&
          isThreadRoot &&
          threadExpanded &&
          conversationId && (
            <Box sx={{ mt: 2 }}>
              <ThreadView
                threadId={message.threadId!}
                conversationId={conversationId}
                compact={true}
                showReplyInput={true}
                maxHeight="400px"
              />
            </Box>
          )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {/* Status Icon */}
        {isOwn && (
          <Tooltip title={`Message ${message.status}`}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getStatusIcon()}
            </Box>
          </Tooltip>
        )}

        {/* Quick Actions */}
        <Box
          sx={{
            display: 'flex',
            opacity: isMobileMode ? 1 : 0, // Always visible on mobile
            transition: 'opacity 0.2s',
            '.MuiBox-root:hover &': !isMobileMode
              ? {
                  opacity: 1,
                }
              : {},
          }}
        >
          {!isMobileMode && (
            <>
              <Tooltip title="Reply">
                <IconButton size="small" onClick={handleReply}>
                  <ReplyIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Add reaction">
                <IconButton
                  size="small"
                  onClick={() => setShowReactions(!showReactions)}
                >
                  <EmojiEmotionsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          <IconButton
            size={isMobileMode ? 'medium' : 'small'}
            onClick={handleMenuClick}
            sx={{
              ...(isMobileMode && {
                minWidth: 44,
                minHeight: 44,
              }),
            }}
          >
            <MoreVertIcon fontSize={isMobileMode ? 'medium' : 'small'} />
          </IconButton>
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleReply}>
          <ReplyIcon fontSize="small" sx={{ mr: 1 }} />
          Reply
        </MenuItem>
        {showThreading && !message.threadId && onCreateThread && (
          <MenuItem onClick={handleCreateThread}>
            <ForumIcon fontSize="small" sx={{ mr: 1 }} />
            Start Thread
          </MenuItem>
        )}
        {isOwn && (
          <MenuItem onClick={handleEdit}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {isOwn && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Reaction Picker */}
      {showReactions && (
        <Paper
          sx={{
            position: 'absolute',
            zIndex: 1000,
            p: 2,
            mt: 4,
            ml: -2,
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1, display: 'block' }}
          >
            Healthcare Reactions
          </Typography>
          <Grid container spacing={0.5} sx={{ maxWidth: 200 }}>
            {[
              { emoji: '👍', label: 'Approve' },
              { emoji: '👎', label: 'Disapprove' },
              { emoji: '❤️', label: 'Care' },
              { emoji: '😊', label: 'Happy' },
              { emoji: '😢', label: 'Concern' },
              { emoji: '😮', label: 'Surprised' },
              { emoji: '🤔', label: 'Thinking' },
              { emoji: '✅', label: 'Confirmed' },
              { emoji: '❌', label: 'Declined' },
              { emoji: '⚠️', label: 'Warning' },
              { emoji: '🚨', label: 'Urgent' },
              { emoji: '📋', label: 'Note' },
              { emoji: '💊', label: 'Medication' },
              { emoji: '🩺', label: 'Medical' },
              { emoji: '📊', label: 'Data' },
            ].map(({ emoji, label }) => (
              <Grid item key={emoji}>
                <Tooltip title={label}>
                  <Button
                    size="small"
                    onClick={() => handleReactionClick(emoji)}
                    sx={{
                      minWidth: 'auto',
                      p: 0.5,
                      fontSize: '1.2rem',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    {emoji}
                  </Button>
                </Tooltip>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Edit your message..."
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCancel}>Cancel</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={!editContent.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default MessageItem;
