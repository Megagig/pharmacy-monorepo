import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { Send, AttachFile, EmojiEmotions, Reply } from '@mui/icons-material';
import { Message } from '../../stores/types';
import MessageItem from './MessageItem';
import MentionInput from './MentionInput';
import TemplateSelector from './TemplateSelector';
import { useSocketConnection } from '../../hooks/useSocket';
import { socketService } from '../../services/socketService';
import { parseDate, generateSafeKey } from '../../utils/dateUtils';

interface MessageThreadProps {
  conversationId: string;
  messages: Message[];
  onSendMessage: (
    content: string,
    attachments?: File[],
    threadId?: string,
    parentMessageId?: string,
    mentions?: string[]
  ) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  threadId?: string;
  parentMessage?: Message;
  maxHeight?: string | number;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  conversationId,
  messages,
  onSendMessage,
  loading = false,
  error = null,
  threadId,
  parentMessage,
  maxHeight = '100%',
}) => {
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { isConnected } = useSocketConnection();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle typing indicators
  const handleTypingStart = () => {
    if (!isTyping && isConnected) {
      setIsTyping(true);
      socketService.startTyping(conversationId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      socketService.stopTyping(conversationId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle message input changes
  const handleMessageChange = (value: string, newMentions: string[]) => {
    setMessageText(value);
    setMentions(newMentions);

    // Check for "/" command to trigger template selector
    if (value === '/') {
      setShowTemplateSelector(true);
      setMessageText(''); // Clear the "/" character
      return;
    }

    if (value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  // Handle template selection
  const handleTemplateSelect = (renderedContent: string) => {
    setMessageText(renderedContent);
    setShowTemplateSelector(false);
    messageInputRef.current?.focus();
  };

  // Handle sending message
  const handleSend = async () => {
    if ((!messageText.trim() && attachments.length === 0) || sending) {
      return;
    }

    setSending(true);
    handleTypingStop();

    try {
      await onSendMessage(
        messageText,
        attachments.length > 0 ? attachments : undefined,
        threadId,
        parentMessage?._id,
        mentions.length > 0 ? mentions : undefined
      );

      // Clear input after successful send
      setMessageText('');
      setAttachments([]);
      setMentions([]);
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle key press in message input
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // Handle file attachment
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments((prev) => [...prev, ...files]);

    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle reply to message
  const handleReplyToMessage = (message: Message) => {
    // Focus input and add reply context
    messageInputRef.current?.focus();
    // TODO: Implement reply functionality with parent message reference
  };

  // Handle thread creation
  const handleCreateThread = async (messageId: string) => {
    try {
      const response = await fetch(
        `/api/communication/messages/${messageId}/thread`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create thread');
      }

      const result = await response.json();

      // Refresh messages to show the new thread
      // This would typically be handled by the parent component
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  };

  // Handle thread view
  const handleViewThread = (threadId: string) => {
    // This would typically open a thread view modal or navigate to thread

  };

  // Filter messages for this thread
  const threadMessages = threadId
    ? messages.filter((msg) => msg.threadId === threadId)
    : messages.filter((msg) => !msg.threadId);

  return (
    <Box
      sx={{
        height: maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Thread Header (if this is a thread) */}
      {threadId && parentMessage && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Thread
          </Typography>
          <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'primary.main' }}>
            <Typography variant="body2" color="text.secondary">
              Replying to: {parentMessage.content.text?.substring(0, 100)}
              {(parentMessage.content.text?.length || 0) > 100 ? '...' : ''}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      )}

      {/* Messages Container */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {loading && threadMessages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : threadMessages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {threadId
                ? 'No replies yet'
                : 'No messages yet. Start the conversation!'}
            </Typography>
          </Box>
        ) : (
          threadMessages.map((message, index) => {
            const prevMessage = index > 0 ? threadMessages[index - 1] : null;

            // Use imported parseDate function

            const showDateDivider = (() => {
              if (!prevMessage) return false;

              const messageDate = parseDate(message.createdAt);
              const prevDate = parseDate(prevMessage.createdAt);

              if (!messageDate || !prevDate || isNaN(messageDate.getTime()) || isNaN(prevDate.getTime())) {
                return false;
              }

              return messageDate.toDateString() !== prevDate.toDateString();
            })();

            // Generate safe key for React - use index and timestamp as fallback
            const messageKey = message._id && typeof message._id === 'string' && message._id.length > 0
              ? message._id 
              : `message-${conversationId}-${index}-${message.createdAt || Date.now()}`;

            return (
              <React.Fragment key={messageKey}>
                {showDateDivider && (
                  <Box sx={{ my: 2 }}>
                    <Divider>
                      <Typography variant="caption" color="text.secondary">
                        {(() => {
                          const messageDate = parseDate(message.createdAt);
                          return messageDate && !isNaN(messageDate.getTime())
                            ? messageDate.toLocaleDateString()
                            : 'Invalid date';
                        })()}
                      </Typography>
                    </Divider>
                  </Box>
                )}
                {(() => {
                  try {
                    return (
                      <MessageItem
                        message={message}
                        showAvatar={
                          !prevMessage || prevMessage.senderId !== message.senderId
                        }
                        showTimestamp={true}
                        onReply={() => handleReplyToMessage(message)}
                        onEdit={(messageId, newContent) => {
                          // TODO: Implement message editing

                        }}
                        onDelete={(messageId) => {
                          // TODO: Implement message deletion

                        }}
                        onReaction={(messageId, emoji) => {
                          // TODO: Implement message reactions

                        }}
                        onCreateThread={handleCreateThread}
                        onViewThread={handleViewThread}
                        showThreading={!threadId} // Don't show threading inside a thread
                        conversationId={conversationId}
                      />
                    );
                  } catch (error) {
                    console.error('Error rendering message:', message._id, error);
                    return (
                      <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, my: 1 }}>
                        <Typography variant="body2" color="error">
                          Failed to load message
                        </Typography>
                      </Box>
                    );
                  }
                })()}
              </React.Fragment>
            );
          })
        )}
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <Box sx={{ mb: 1 }}>
            {attachments.map((file, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{
                  p: 1,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2" noWrap>
                  {file.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => removeAttachment(index)}
                >
                  ×
                </IconButton>
              </Paper>
            ))}
          </Box>
        )}

        {/* Input Row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Attach File Button */}
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <AttachFile />
          </IconButton>

          {/* Message Input with Mentions */}
          <MentionInput
            value={messageText}
            onChange={handleMessageChange}
            onKeyPress={handleKeyPress}
            placeholder={threadId ? 'Reply to thread...' : 'Type a message...'}
            disabled={sending}
            multiline
            maxRows={4}
            conversationId={conversationId}
            autoFocus={false}
          />

          {/* Emoji Button */}
          <IconButton size="small" disabled={sending}>
            <EmojiEmotions />
          </IconButton>

          {/* Send Button */}
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={
              (!messageText.trim() && attachments.length === 0) ||
              sending
            }
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled',
              },
            }}
          >
            {sending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Send />
            )}
          </IconButton>
        </Box>

        {/* Connection Status */}
        {!isConnected && (
          <Typography
            variant="caption"
            color="warning.main"
            sx={{ mt: 1, display: 'block' }}
          >
            Offline - Messages will be sent when connection is restored
          </Typography>
        )}

        {/* Template Hint */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          Tip: Type "/" to use message templates
        </Typography>
      </Box>

      {/* Template Selector Dialog */}
      <TemplateSelector
        open={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
      />
    </Box>
  );
};

export default MessageThread;
