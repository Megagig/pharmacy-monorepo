import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  IconButton,
  Button,
  Chip,
  Avatar,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { chatbotApi } from '../../services/api/chatbotApi';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
}

interface ChatbotWidgetProps {
  userId?: string;
  workplaceId?: string;
  onEscalate?: (consultationRequest: any) => void;
}

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  userId,
  workplaceId,
  onEscalate,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => uuidv4());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      // Send initial greeting
      handleSendMessage('Hello');
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text) return;

    setInputValue('');
    setError(null);

    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setLoading(true);

    try {
      const response = await chatbotApi.sendMessage({
        sessionId,
        message: text,
        userId,
        workplaceId,
      });

      // Add bot response
      const botMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date(),
        suggestedActions: response.data.suggestedActions,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async (action: any) => {
    if (action.type === 'consultation' || action.type === 'escalate') {
      try {
        const response = await chatbotApi.escalate(
          sessionId,
          action.data?.priority === 'urgent' ? 'Urgent assistance needed' : 'Request for consultation'
        );

        // Add confirmation message
        const confirmMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, confirmMessage]);

        if (onEscalate) {
          onEscalate(response.data.consultationRequest);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to escalate. Please try again.');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = async () => {
    setOpen(false);
    // Optionally clear session
    // await chatbotApi.clearSession(sessionId);
  };

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="chat"
        onClick={() => setOpen(!open)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </Fab>

      {/* Chat Widget */}
      <Collapse in={open}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            width: 380,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.dark' }}>
                <BotIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  Pharmacy Assistant
                </Typography>
                <Typography variant="caption">
                  Ask me anything!
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={handleClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: 'grey.50',
            }}
          >
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                    gap: 1,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: message.role === 'user' ? 'primary.main' : 'grey.400',
                    }}
                  >
                    {message.role === 'user' ? <PersonIcon fontSize="small" /> : <BotIcon fontSize="small" />}
                  </Avatar>
                  <Box>
                    <Paper
                      sx={{
                        p: 1.5,
                        bgcolor: message.role === 'user' ? 'primary.main' : 'white',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body2">{message.content}</Typography>
                    </Paper>

                    {/* Suggested Actions */}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {message.suggestedActions.map((action, index) => (
                          <Chip
                            key={index}
                            label={action.label}
                            size="small"
                            onClick={() => handleActionClick(action)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.400' }}>
                    <BotIcon fontSize="small" />
                  </Avatar>
                  <Paper sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Typing...
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{ p: 2, bgcolor: 'white', borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <IconButton
                color="primary"
                onClick={() => handleSendMessage()}
                disabled={loading || !inputValue.trim()}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
};

export default ChatbotWidget;
