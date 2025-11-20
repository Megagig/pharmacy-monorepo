import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Collapse,
  Badge,
  Tooltip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Reply,
  Close,
  Forum,
  Person,
  Schedule,
} from '@mui/icons-material';
import { Message } from '../../stores/types';
import MessageItem from './MessageItem';
import MessageThread from './MessageThread';
import { useCommunicationStore } from '../../stores/communicationStore';
import { formatDistanceToNow } from 'date-fns';

interface ThreadViewProps {
  threadId: string;
  conversationId: string;
  onClose?: () => void;
  compact?: boolean;
  showReplyInput?: boolean;
  maxHeight?: string | number;
}

interface ThreadSummary {
  threadId: string;
  rootMessage: Message;
  replyCount: number;
  participants: string[];
  lastReplyAt?: string;
  unreadCount: number;
}

const ThreadView: React.FC<ThreadViewProps> = ({
  threadId,
  conversationId,
  onClose,
  compact = false,
  showReplyInput = true,
  maxHeight = '600px',
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [threadSummary, setThreadSummary] = useState<ThreadSummary | null>(
    null
  );
  const [threadMessages, setThreadMessages] = useState<{
    rootMessage: Message;
    replies: Message[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage } = useCommunicationStore();

  // Fetch thread summary
  const fetchThreadSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/communication/threads/${threadId}/summary`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch thread summary');
      }

      const result = await response.json();
      setThreadSummary(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  };

  // Fetch thread messages
  const fetchThreadMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/communication/threads/${threadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch thread messages');
      }

      const result = await response.json();
      setThreadMessages(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load thread messages'
      );
    } finally {
      setLoading(false);
    }
  };

  // Load thread data
  useEffect(() => {
    fetchThreadSummary();
    if (expanded) {
      fetchThreadMessages();
    }
  }, [threadId, expanded]);

  // Handle expand/collapse
  const handleToggleExpanded = () => {
    setExpanded(!expanded);
    if (!expanded && !threadMessages) {
      fetchThreadMessages();
    }
  };

  // Handle reply to thread
  const handleReplyToThread = async (
    content: string,
    attachments?: File[],
    mentions?: string[]
  ) => {
    try {
      const response = await fetch(
        `/api/communication/threads/${threadId}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            content: {
              text: content,
              type: 'text',
            },
            mentions,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      // Refresh thread messages
      await fetchThreadMessages();
      await fetchThreadSummary();
    } catch (err) {
      console.error('Failed to reply to thread:', err);
      throw err;
    }
  };

  if (loading && !threadSummary) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error && !threadSummary) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error}
      </Alert>
    );
  }

  if (!threadSummary) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'primary.light',
        borderRadius: 2,
      }}
    >
      {/* Thread Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.50',
          borderBottom: expanded ? 1 : 0,
          borderColor: 'divider',
          cursor: compact ? 'pointer' : 'default',
        }}
        onClick={compact ? handleToggleExpanded : undefined}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Thread Icon */}
          <Forum color="primary" fontSize="small" />

          {/* Thread Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <Typography variant="subtitle2" fontWeight="bold" noWrap>
                Thread
              </Typography>

              {threadSummary.unreadCount > 0 && (
                <Badge
                  badgeContent={threadSummary.unreadCount}
                  color="error"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}
                />
              )}

              {threadSummary.lastReplyAt && (
                <Typography variant="caption" color="text.secondary">
                  Last reply{' '}
                  {formatDistanceToNow(new Date(threadSummary.lastReplyAt), {
                    addSuffix: true,
                  })}
                </Typography>
              )}
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ maxWidth: '100%' }}
            >
              {threadSummary.rootMessage.content.text?.substring(0, 100)}
              {(threadSummary.rootMessage.content.text?.length || 0) > 100
                ? '...'
                : ''}
            </Typography>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Reply fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {threadSummary.replyCount}{' '}
                  {threadSummary.replyCount === 1 ? 'reply' : 'replies'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Person fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {threadSummary.participants.length} participant
                  {threadSummary.participants.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {compact && (
              <Tooltip title={expanded ? 'Collapse thread' : 'Expand thread'}>
                <IconButton size="small" onClick={handleToggleExpanded}>
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Tooltip>
            )}

            {onClose && (
              <Tooltip title="Close thread">
                <IconButton size="small" onClick={onClose}>
                  <Close />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* Thread Content */}
      <Collapse in={expanded}>
        <Box
          sx={{
            maxHeight,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Root Message */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography
              variant="caption"
              color="primary"
              sx={{ mb: 1, display: 'block' }}
            >
              Thread starter
            </Typography>
            <MessageItem
              message={threadSummary.rootMessage}
              showAvatar={true}
              showTimestamp={true}
              compact={false}
              onReply={() => {}} // Disable reply on root message in thread view
            />
          </Box>

          {/* Thread Messages */}
          {threadMessages && (
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              {threadMessages.replies.length > 0 ? (
                <Box sx={{ p: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block', px: 1 }}
                  >
                    Replies ({threadMessages.replies.length})
                  </Typography>
                  <Box
                    sx={{ pl: 2, borderLeft: 2, borderColor: 'primary.light' }}
                  >
                    {threadMessages.replies.map((reply, index) => {
                      const prevReply =
                        index > 0 ? threadMessages.replies[index - 1] : null;
                      const showDateDivider =
                        prevReply &&
                        new Date(reply.createdAt).toDateString() !==
                          new Date(prevReply.createdAt).toDateString();

                      return (
                        <React.Fragment key={reply._id}>
                          {showDateDivider && (
                            <Box sx={{ my: 2 }}>
                              <Divider>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {new Date(
                                    reply.createdAt
                                  ).toLocaleDateString()}
                                </Typography>
                              </Divider>
                            </Box>
                          )}
                          <MessageItem
                            message={reply}
                            showAvatar={
                              !prevReply ||
                              prevReply.senderId !== reply.senderId
                            }
                            showTimestamp={true}
                            compact={true}
                          />
                        </React.Fragment>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 4,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No replies yet. Be the first to reply!
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Reply Input */}
          {showReplyInput && expanded && (
            <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
              <MessageThread
                conversationId={conversationId}
                messages={[]}
                onSendMessage={handleReplyToThread}
                threadId={threadId}
                parentMessage={threadSummary.rootMessage}
                maxHeight="200px"
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ThreadView;
