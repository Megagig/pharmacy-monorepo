import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import { usePatientMessages } from '../../hooks/usePatientMessages';
import MessageThread from '../../components/patient-portal/MessageThread';

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

const PatientMessages: React.FC = () => {
  const { user } = usePatientAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);

  const {
    conversations,
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refreshConversations,
    isConnected,
    typingUsers
  } = usePatientMessages(user?.id); // Pass patient ID to the hook

  // Filter conversations based on search query
  const filteredConversations = conversations?.filter(conversation =>
    conversation.pharmacistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    // Mark messages as read when conversation is selected
    markAsRead(conversationId);
  };

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!selectedConversationId) return;

    try {
      await sendMessage(selectedConversationId, content, attachments);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshConversations();
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  };

  const handleStartNewConversation = async () => {
    if (!user?.id || !newMessageContent.trim()) return;

    setCreatingConversation(true);
    try {
      // Create a new patient query conversation
      const response = await fetch(`/api/communication/patients/${user.id}/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: newMessageContent,
          title: 'Patient Query',
          priority: 'normal',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh conversations to show the new one
        await refreshConversations();
        // Select the new conversation
        if (result.data?.conversation?._id) {
          setSelectedConversationId(result.data.conversation._id);
        }
        // Close dialog and reset
        setNewMessageDialogOpen(false);
        setNewMessageContent('');
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setCreatingConversation(false);
    }
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Please log in to access your messages.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4, height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Messages
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Secure communication with your pharmacist
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewMessageDialogOpen(true)}
            size="small"
          >
            New Message
          </Button>
          <Chip
            icon={<MessageIcon />}
            label={isConnected ? 'Connected' : 'Connecting...'}
            color={isConnected ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
          <IconButton
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh conversations"
          >
            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 'calc(100vh - 240px)', display: 'flex' }}>
        {/* Conversations List */}
        <Box sx={{ width: 350, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && !conversations ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredConversations.length > 0 ? (
              <List sx={{ p: 0 }}>
                {filteredConversations.map((conversation) => (
                  <ListItem
                    key={conversation.id}
                    component="button"
                    selected={selectedConversationId === conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    sx={{
                      borderBottom: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Badge
                        badgeContent={conversation.unreadCount}
                        color="primary"
                        invisible={conversation.unreadCount === 0}
                      >
                        <Avatar
                          src={conversation.pharmacistAvatar}
                          sx={{ bgcolor: 'primary.main' }}
                        >
                          {conversation.pharmacistAvatar ? null : <PersonIcon />}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: conversation.unreadCount > 0 ? 'bold' : 'normal',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '180px'
                            }}
                          >
                            {conversation.pharmacistName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {conversation.lastMessage ? new Date(conversation.lastMessage.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            }) : ''}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: conversation.unreadCount > 0 ? 'medium' : 'normal',
                          }}
                        >
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <MessageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No conversations found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {searchQuery ? 'Try adjusting your search terms' : 'Start a conversation with your pharmacist'}
                </Typography>
                {!searchQuery && (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setNewMessageDialogOpen(true)}
                    size="small"
                  >
                    New Message
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* Message Thread */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              currentUserId={user.id}
              onSendMessage={handleSendMessage}
              typingUsers={typingUsers}
              loading={loading}
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                textAlign: 'center'
              }}
            >
              <MessageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>
                Select a conversation
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Choose a conversation from the list to start messaging
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* New Message Dialog */}
      <Dialog
        open={newMessageDialogOpen}
        onClose={() => !creatingConversation && setNewMessageDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Start a New Conversation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send a message to your pharmacist. They will be notified and can respond to your query.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            label="Your Message"
            placeholder="Type your question or message here..."
            value={newMessageContent}
            onChange={(e) => setNewMessageContent(e.target.value)}
            disabled={creatingConversation}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setNewMessageDialogOpen(false)}
            disabled={creatingConversation}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartNewConversation}
            variant="contained"
            disabled={!newMessageContent.trim() || creatingConversation}
            startIcon={creatingConversation ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creatingConversation ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PatientMessages;