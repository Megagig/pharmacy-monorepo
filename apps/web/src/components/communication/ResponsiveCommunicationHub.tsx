import React, { useState, useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { useResponsive, useIsTouchDevice } from '../../hooks/useResponsive';
import { useCommunicationStore } from '../../stores/communicationStore';
import ChatInterface from './ChatInterface';
import MobileChatInterface from './MobileChatInterface';
import ConversationList from './ConversationList';
import { Conversation } from '../../stores/types';

interface ResponsiveCommunicationHubProps {
  initialConversationId?: string;
  patientId?: string;
  height?: string | number;
  onConversationChange?: (conversationId: string | null) => void;
}

const ResponsiveCommunicationHub: React.FC<ResponsiveCommunicationHubProps> = ({
  initialConversationId,
  patientId,
  height = '100vh',
  onConversationChange,
}) => {
  const theme = useTheme();
  const { isMobile, isTablet, isDesktop, screenWidth } = useResponsive();
  const isTouchDevice = useIsTouchDevice();

  const { activeConversation, setActiveConversation, fetchConversations } =
    useCommunicationStore();

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >(initialConversationId);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);



  // Update conversation selection when prop changes (only if initialConversationId is provided)
  useEffect(() => {
    if (initialConversationId && initialConversationId !== selectedConversationId) {
      setSelectedConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []); // Empty dependency array - only run on mount

  // Handle conversation selection
  const handleConversationSelect = React.useCallback((conversation: Conversation) => {
    // Prevent selecting the same conversation multiple times
    if (selectedConversationId === conversation._id) {
      return;
    }

    setSelectedConversationId(conversation._id);
    setActiveConversation(conversation);
    onConversationChange?.(conversation._id);

    // Close sidebar on mobile after selection
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [selectedConversationId, setActiveConversation, onConversationChange, isMobile]);

  // Handle back navigation (mobile)
  const handleBack = () => {
    setSelectedConversationId(undefined);
    setActiveConversation(null);
    onConversationChange?.(null);
    setSidebarOpen(true);
  };

  // Mobile layout
  if (isMobile) {
    return (
      <Box sx={{ height, overflow: 'hidden' }}>
        <MobileChatInterface
          conversationId={selectedConversationId}
          onBack={handleBack}
          onConversationSelect={handleConversationSelect}
        />
      </Box>
    );
  }

  // Tablet layout - side-by-side with collapsible sidebar
  if (isTablet) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Conversation List Sidebar */}
        <Box
          sx={{
            width: sidebarOpen ? 320 : 0,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflow: 'hidden',
            borderRight: sidebarOpen ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          {sidebarOpen && (
            <ConversationList
              onConversationSelect={handleConversationSelect}
              selectedConversationId={selectedConversationId}
              height="100%"
              patientId={patientId}
              compact={true}
            />
          )}
        </Box>

        {/* Main Chat Area */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {selectedConversationId ? (
            <ChatInterface
              conversationId={selectedConversationId}
              patientId={patientId}
              height="100%"
              showParticipants={true}
              showHeader={true}
              onConversationAction={(action, conversationId) => {
                // Handle conversation actions

              }}
            />
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2,
                p: 3,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  fontSize: 64,
                  opacity: 0.3,
                  mb: 2,
                }}
              >
                💬
              </Box>
              <Box>
                <Box sx={{ fontSize: '1.25rem', fontWeight: 600, mb: 1 }}>
                  Select a conversation
                </Box>
                <Box sx={{ color: 'text.secondary' }}>
                  Choose a conversation from the sidebar to start messaging
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Sidebar toggle button for tablet */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: sidebarOpen ? 304 : 16,
            zIndex: theme.zIndex.fab,
            transition: theme.transitions.create('left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }}
        >
          <Box
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 2,
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {sidebarOpen ? '‹' : '›'}
          </Box>
        </Box>
      </Box>
    );
  }

  // Desktop layout - full side-by-side
  return (
    <Box
      sx={{
        height,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Conversation List Sidebar */}
      <Box
        sx={{
          width: 360,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <ConversationList
          onConversationSelect={handleConversationSelect}
          selectedConversationId={selectedConversationId}
          height="100%"
          patientId={patientId}
          compact={false}
        />
      </Box>

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {selectedConversationId ? (
          <ChatInterface
            conversationId={selectedConversationId}
            patientId={patientId}
            height="100%"
            showParticipants={true}
            showHeader={true}
            onConversationAction={(action, conversationId) => {
              // Handle conversation actions

            }}
          />
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 3,
              p: 4,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                fontSize: 96,
                opacity: 0.2,
                mb: 2,
              }}
            >
              💬
            </Box>
            <Box>
              <Box sx={{ fontSize: '1.5rem', fontWeight: 600, mb: 1 }}>
                Welcome to Communication Hub
              </Box>
              <Box sx={{ color: 'text.secondary', maxWidth: 400 }}>
                Select a conversation from the sidebar to start messaging, or
                create a new conversation to begin collaborating with your
                healthcare team.
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ResponsiveCommunicationHub;
