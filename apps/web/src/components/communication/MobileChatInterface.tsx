import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  SwipeableDrawer,
  Fab,
  Badge,
  Slide,
  useScrollTrigger,
  Backdrop,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material';
import {
  ArrowBack,
  Info,
  Call,
  VideoCall,
  MoreVert,
  Add,
  Search,
  Notifications,
  Archive,
  Settings,
  Close,
} from '@mui/icons-material';
import { useCommunicationStore } from '../../stores/communicationStore';
import {
  useResponsive,
  useIsTouchDevice,
  useOrientation,
  useSafeAreaInsets,
} from '../../hooks/useResponsive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import MessageThread from './MessageThread';
import ConversationList from './ConversationList';
import ParticipantList from './ParticipantList';
import NotificationCenter from './NotificationCenter';
import MobileFileUpload from './MobileFileUpload';
import MobileMessageInput from './MobileMessageInput';
import { Conversation, Message } from '../../stores/types';

interface MobileChatInterfaceProps {
  conversationId?: string;
  onBack?: () => void;
  onConversationSelect?: (conversation: Conversation) => void;
}

interface HideOnScrollProps {
  children: React.ReactElement;
}

const HideOnScroll: React.FC<HideOnScrollProps> = ({ children }) => {
  const trigger = useScrollTrigger();
  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
};

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  conversationId,
  onBack,
  onConversationSelect,
}) => {
  const {
    activeConversation,
    conversations,
    messages,
    notifications,
    unreadCount,
    setActiveConversation,
    fetchMessages,
    sendMessage,
    markConversationAsRead,
  } = useCommunicationStore();

  const { isMobile, isSmallMobile, screenHeight } = useResponsive();
  const isTouchDevice = useIsTouchDevice();
  const orientation = useOrientation();
  const safeAreaInsets = useSafeAreaInsets();

  // Local state
  const [conversationListOpen, setConversationListOpen] = useState(
    !conversationId
  );
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get conversation messages
  const conversationMessages = conversationId
    ? messages[conversationId] || []
    : [];

  // Get current conversation
  const conversation = conversationId
    ? activeConversation?._id === conversationId
      ? activeConversation
      : conversations.find((c) => c._id === conversationId)
    : null;

  // Handle keyboard visibility on mobile
  useEffect(() => {
    if (!isTouchDevice) return;

    const handleResize = () => {
      const viewportHeight =
        window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDifference = windowHeight - viewportHeight;

      // Keyboard is likely open if viewport is significantly smaller
      if (heightDifference > 150) {
        setKeyboardHeight(heightDifference);
      } else {
        setKeyboardHeight(0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () =>
        window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isTouchDevice]);

  // Touch gestures for navigation
  const { attachGestures } = useTouchGestures({
    onSwipeRight: () => {
      if (conversationId && !conversationListOpen) {
        setConversationListOpen(true);
      }
    },
    onSwipeLeft: () => {
      if (conversationListOpen) {
        setConversationListOpen(false);
      }
    },
    onSwipeDown: () => {
      // Pull to refresh conversations
      if (
        conversationListOpen &&
        messagesContainerRef.current?.scrollTop === 0
      ) {
        // Implement pull to refresh
      }
    },
  });

  // Attach gestures to main container
  useEffect(() => {
    if (messagesContainerRef.current) {
      attachGestures(messagesContainerRef.current);
    }
  }, [attachGestures]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
      markConversationAsRead(conversationId);
      setConversationListOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Handle conversation selection
  const handleConversationSelect = (conv: Conversation) => {
    setActiveConversation(conv);
    onConversationSelect?.(conv);
    setConversationListOpen(false);
  };

  // Handle back navigation
  const handleBack = () => {
    if (conversationId) {
      setActiveConversation(null);
      onBack?.();
      setConversationListOpen(true);
    }
  };

  // Handle sending messages
  const handleSendMessage = async (
    content: string,
    attachments?: File[],
    threadId?: string,
    parentMessageId?: string,
    mentions?: string[]
  ) => {
    if (
      !conversationId ||
      (!content.trim() && (!attachments || attachments.length === 0))
    ) {
      return;
    }

    const messageData = {
      conversationId,
      content: {
        text: content.trim(),
        type: 'text' as const,
        attachments,
      },
      threadId,
      parentMessageId,
      mentions,
    };

    await sendMessage(messageData);
  };

  // Speed dial actions
  const speedDialActions = [
    {
      icon: <Add />,
      name: 'New Conversation',
      onClick: () => {
        setSpeedDialOpen(false);
        // Open new conversation modal
      },
    },
    {
      icon: <Search />,
      name: 'Search',
      onClick: () => {
        setSpeedDialOpen(false);
        // Open search interface
      },
    },
    {
      icon: <Archive />,
      name: 'Archived',
      onClick: () => {
        setSpeedDialOpen(false);
        // Show archived conversations
      },
    },
  ];

  // Calculate safe heights
  const appBarHeight = 56;
  const bottomInputHeight = 60;
  const availableHeight =
    screenHeight -
    appBarHeight -
    bottomInputHeight -
    safeAreaInsets.top -
    safeAreaInsets.bottom -
    keyboardHeight;

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingTop: `${safeAreaInsets.top}px`,
        paddingBottom: `${safeAreaInsets.bottom}px`,
      }}
    >
      {/* App Bar */}
      <HideOnScroll>
        <AppBar
          position="fixed"
          sx={{
            top: safeAreaInsets.top,
            zIndex: (theme) => theme.zIndex.appBar,
          }}
        >
          <Toolbar variant="dense">
            {conversationId ? (
              <>
                <IconButton
                  edge="start"
                  color="inherit"
                  onClick={handleBack}
                  sx={{ mr: 1 }}
                >
                  <ArrowBack />
                </IconButton>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {conversation?.title || 'Conversation'}
                  </Typography>
                  {conversation && (
                    <Typography
                      variant="caption"
                      color="inherit"
                      sx={{ opacity: 0.7 }}
                    >
                      {conversation.participants.length} participant
                      {conversation.participants.length !== 1 ? 's' : ''}
                      {conversation.status !== 'active' &&
                        ` • ${conversation.status}`}
                    </Typography>
                  )}
                </Box>

                <IconButton
                  color="inherit"
                  onClick={() => setParticipantsOpen(true)}
                >
                  <Info />
                </IconButton>

                <IconButton color="inherit">
                  <MoreVert />
                </IconButton>
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ flex: 1 }}>
                  Messages
                </Typography>

                <IconButton
                  color="inherit"
                  onClick={() => setNotificationsOpen(true)}
                >
                  <Badge badgeContent={unreadCount} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>

                <IconButton color="inherit">
                  <Search />
                </IconButton>
              </>
            )}
          </Toolbar>
        </AppBar>
      </HideOnScroll>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          mt: `${appBarHeight}px`,
          overflow: 'hidden',
        }}
      >
        {conversationId && conversation ? (
          <>
            {/* Messages Area */}
            <Box
              ref={messagesContainerRef}
              sx={{
                flex: 1,
                overflow: 'hidden',
                height: `${availableHeight}px`,
              }}
            >
              <MessageThread
                conversationId={conversationId}
                messages={conversationMessages}
                onSendMessage={handleSendMessage}
                mobile={true}
                touchOptimized={isTouchDevice}
                compact={isSmallMobile}
              />
            </Box>

            {/* Mobile Message Input */}
            <Box
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                backgroundColor: 'background.paper',
                pb: keyboardHeight > 0 ? `${keyboardHeight}px` : 0,
                transition: 'padding-bottom 0.2s ease',
              }}
            >
              <MobileMessageInput
                conversationId={conversationId}
                onSendMessage={handleSendMessage}
                onTypingStart={() => setIsTyping(true)}
                onTypingStop={() => setIsTyping(false)}
                disabled={conversation.status !== 'active'}
                ref={inputRef}
              />
            </Box>
          </>
        ) : (
          /* Conversation List */
          <ConversationList
            onConversationSelect={handleConversationSelect}
            selectedConversationId={conversationId}
            height="100%"
            compact={isSmallMobile}
            showNewButton={false}
          />
        )}
      </Box>

      {/* Conversation List Drawer */}
      <SwipeableDrawer
        anchor="left"
        open={conversationListOpen && !!conversationId}
        onClose={() => setConversationListOpen(false)}
        onOpen={() => setConversationListOpen(true)}
        swipeAreaWidth={20}
        disableSwipeToOpen={false}
        sx={{
          '& .MuiDrawer-paper': {
            width: '85%',
            maxWidth: 320,
            paddingTop: `${safeAreaInsets.top + appBarHeight}px`,
            paddingBottom: `${safeAreaInsets.bottom}px`,
          },
        }}
      >
        <ConversationList
          onConversationSelect={handleConversationSelect}
          selectedConversationId={conversationId}
          height="100%"
          compact={true}
          showNewButton={false}
        />
      </SwipeableDrawer>

      {/* Participants Drawer */}
      <Drawer
        anchor="right"
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '85%',
            maxWidth: 320,
            paddingTop: `${safeAreaInsets.top + appBarHeight}px`,
            paddingBottom: `${safeAreaInsets.bottom}px`,
          },
        }}
      >
        {conversation && (
          <ParticipantList
            conversation={conversation}
            onAddParticipant={(userId, role) => {
              // TODO: Implement add participant

            }}
            onRemoveParticipant={(userId) => {
              // TODO: Implement remove participant

            }}
            mobile={true}
          />
        )}
      </Drawer>

      {/* Notifications Drawer */}
      <Drawer
        anchor="right"
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '90%',
            maxWidth: 400,
            paddingTop: `${safeAreaInsets.top + appBarHeight}px`,
            paddingBottom: `${safeAreaInsets.bottom}px`,
          },
        }}
      >
        <NotificationCenter
          notifications={notifications}
          onNotificationClick={(notification) => {
            // Handle notification click
            setNotificationsOpen(false);
          }}
          mobile={true}
        />
      </Drawer>

      {/* Speed Dial for Actions */}
      {!conversationId && (
        <SpeedDial
          ariaLabel="Communication actions"
          sx={{
            position: 'fixed',
            bottom: 16 + safeAreaInsets.bottom,
            right: 16,
          }}
          icon={<SpeedDialIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
        >
          {speedDialActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.onClick}
            />
          ))}
        </SpeedDial>
      )}

      {/* Backdrop for drawers */}
      <Backdrop
        open={conversationListOpen || participantsOpen || notificationsOpen}
        onClick={() => {
          setConversationListOpen(false);
          setParticipantsOpen(false);
          setNotificationsOpen(false);
        }}
        sx={{ zIndex: (theme) => theme.zIndex.drawer - 1 }}
      />
    </Box>
  );
};

export default MobileChatInterface;
