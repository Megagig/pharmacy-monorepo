import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import MessageInput from './MessageInput';
import FileAttachment from './FileAttachment';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface Conversation {
  id: string;
  pharmacistId: string;
  pharmacistName: string;
  pharmacistAvatar?: string;
  lastMessage: {
    content: string;
    timestamp: string;
    senderId: string;
    isRead: boolean;
  };
  unreadCount: number;
  status: 'active' | 'archived';
  createdAt: string;
}

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  typingUsers: string[];
  loading: boolean;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  typingUsers,
  loading
}) => {
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Filter messages for current conversation
  const conversationMessages = messages.filter(
    message => message.conversationId === conversation.id
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    setSending(true);
    try {
      await onSendMessage(content, attachments);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 168) { // Less than a week
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const isPharmacistTyping = typingUsers.includes(conversation.pharmacistId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={conversation.pharmacistAvatar}
            sx={{ bgcolor: 'primary.main' }}
          >
            {conversation.pharmacistAvatar ? null : <PersonIcon />}
          </Avatar>
          <Box>
            <Typography variant="h6" component="h2">
              {conversation.pharmacistName}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<CircleIcon sx={{ fontSize: '8px !important' }} />}
                label="Online"
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
              <Typography variant="caption" color="text.secondary">
                Pharmacist
              </Typography>
            </Box>
          </Box>
        </Box>

        <Tooltip title="Conversation options">
          <IconButton size="small">
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages Container */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'grey.50'
        }}
      >
        {loading && conversationMessages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : conversationMessages.length > 0 ? (
          <>
            {conversationMessages.map((message, index) => {
              const isCurrentUser = message.senderId === currentUserId;
              const showAvatar = !isCurrentUser && (
                index === 0 || 
                conversationMessages[index - 1].senderId !== message.senderId
              );

              return (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 1,
                    mb: 1
                  }}
                >
                  {!isCurrentUser && (
                    <Avatar
                      src={conversation.pharmacistAvatar}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.main',
                        visibility: showAvatar ? 'visible' : 'hidden'
                      }}
                    >
                      {conversation.pharmacistAvatar ? null : <PersonIcon />}
                    </Avatar>
                  )}

                  <Box
                    sx={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isCurrentUser ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        bgcolor: isCurrentUser ? 'primary.main' : 'background.paper',
                        color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
                        borderRadius: 2,
                        borderTopLeftRadius: !isCurrentUser && showAvatar ? 1 : 2,
                        borderTopRightRadius: isCurrentUser ? 1 : 2,
                        wordBreak: 'break-word'
                      }}
                    >
                      <Typography variant="body2">
                        {message.content}
                      </Typography>

                      {/* File Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {message.attachments.map((attachment) => (
                            <FileAttachment
                              key={attachment.id}
                              attachment={attachment}
                              variant="message"
                            />
                          ))}
                        </Box>
                      )}
                    </Paper>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, px: 1 }}
                    >
                      {formatMessageTime(message.timestamp)}
                      {isCurrentUser && (
                        <span style={{ marginLeft: 4 }}>
                          {message.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </Typography>
                  </Box>
                </Box>
              );
            })}

            {/* Typing Indicator */}
            {isPharmacistTyping && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1,
                  mb: 1
                }}
              >
                <Avatar
                  src={conversation.pharmacistAvatar}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main'
                  }}
                >
                  {conversation.pharmacistAvatar ? null : <PersonIcon />}
                </Avatar>

                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    borderTopLeftRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'text.secondary',
                        animation: 'typing 1.4s infinite ease-in-out',
                        animationDelay: '0s'
                      }}
                    />
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'text.secondary',
                        animation: 'typing 1.4s infinite ease-in-out',
                        animationDelay: '0.2s'
                      }}
                    />
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'text.secondary',
                        animation: 'typing 1.4s infinite ease-in-out',
                        animationDelay: '0.4s'
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {conversation.pharmacistName} is typing...
                  </Typography>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No messages yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start the conversation by sending a message below
            </Typography>
          </Box>
        )}
      </Box>

      {/* Message Input */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={sending}
          loading={sending}
          placeholder={`Message ${conversation.pharmacistName}...`}
        />
      </Box>

      {/* Typing Animation Styles */}
      <style>
        {`
          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.4;
            }
            30% {
              transform: translateY(-10px);
              opacity: 1;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default MessageThread;