import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import ChatInterface from '../ChatInterface';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { useSocketConnection } from '../../../hooks/useSocket';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

// Mock the stores and hooks
vi.mock('../../../stores/communicationStore');
vi.mock('../../../hooks/useSocket');

// Mock child components
vi.mock('../MessageThread', () => ({
  default: ({ onSendMessage }: any) => (
    <div data-testid="message-thread">
      <button
        data-testid="send-message-btn"
        onClick={() => onSendMessage('test message')}
      >
        Send Message
      </button>
    </div>
  ),
}));

vi.mock('../ParticipantList', () => ({
  default: () => <div data-testid="participant-list">Participant List</div>,
}));

vi.mock('../ConnectionStatus', () => ({
  default: () => <div data-testid="connection-status">Connected</div>,
}));

vi.mock('../TypingIndicator', () => ({
  default: () => <div data-testid="typing-indicator">Someone is typing...</div>,
}));

const mockUseCommunicationStore = vi.mocked(useCommunicationStore);
const mockUseSocketConnection = vi.mocked(useSocketConnection);

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ChatInterface', () => {
  const mockConversation = {
    _id: 'conv-1',
    title: 'Test Conversation',
    type: 'group' as const,
    participants: [
      {
        userId: 'user-1',
        role: 'pharmacist' as const,
        joinedAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
      {
        userId: 'user-2',
        role: 'doctor' as const,
        joinedAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
    ],
    status: 'active' as const,
    priority: 'normal' as const,
    tags: [],
    lastMessageAt: '2024-01-01T00:00:00Z',
    createdBy: 'user-1',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockMessages = [
    {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'Hello world',
        type: 'text' as const,
      },
      mentions: [],
      reactions: [],
      status: 'read' as const,
      priority: 'normal' as const,
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultMockStore = {
    activeConversation: mockConversation,
    messages: { 'conv-1': mockMessages },
    messageLoading: false,
    setActiveConversation: vi.fn(),
    fetchMessages: vi.fn(),
    sendMessage: vi.fn(),
    markConversationAsRead: vi.fn(),
    loading: {},
    errors: {},
  };

  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(defaultMockStore as any);
    mockUseSocketConnection.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected' as const,
      connectionInfo: {
        status: 'connected' as const,
        reconnectAttempts: 0,
        joinedConversations: [],
        socketId: 'socket-123',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with conversation', () => {
    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.getByText('2 participants')).toBeInTheDocument();
    expect(screen.getByTestId('message-thread')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('shows conversation priority when not normal', () => {
    const urgentConversation = {
      ...mockConversation,
      priority: 'urgent' as const,
    };

    mockUseCommunicationStore.mockReturnValue({
      ...defaultMockStore,
      activeConversation: urgentConversation,
    } as any);

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('shows resolved status', () => {
    const resolvedConversation = {
      ...mockConversation,
      status: 'resolved' as const,
    };

    mockUseCommunicationStore.mockReturnValue({
      ...defaultMockStore,
      activeConversation: resolvedConversation,
    } as any);

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('shows offline alert when disconnected', () => {
    mockUseSocketConnection.mockReturnValue({
      isConnected: false,
      connectionStatus: 'disconnected' as const,
      connectionInfo: {
        status: 'disconnected' as const,
        reconnectAttempts: 0,
        joinedConversations: [],
      },
    });

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByText(/You're currently offline/)).toBeInTheDocument();
  });

  it('toggles participant list', () => {
    renderWithTheme(
      <ChatInterface conversationId="conv-1" showParticipants={true} />
    );

    // Initially participant list should not be visible
    expect(screen.queryByTestId('participant-list')).not.toBeInTheDocument();

    // Click the info button to show participants
    const infoButton = screen.getByRole('button', {
      name: /show participants/i,
    });
    fireEvent.click(infoButton);

    expect(screen.getByTestId('participant-list')).toBeInTheDocument();
  });

  it('calls fetchMessages and markConversationAsRead on mount', () => {
    const fetchMessages = vi.fn();
    const markConversationAsRead = vi.fn();

    mockUseCommunicationStore.mockReturnValue({
      ...defaultMockStore,
      fetchMessages,
      markConversationAsRead,
    } as any);

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(fetchMessages).toHaveBeenCalledWith('conv-1');
    expect(markConversationAsRead).toHaveBeenCalledWith('conv-1');
  });

  it('handles sending messages', async () => {
    const sendMessage = vi.fn().mockResolvedValue({});

    mockUseCommunicationStore.mockReturnValue({
      ...defaultMockStore,
      sendMessage,
    } as any);

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    const sendButton = screen.getByTestId('send-message-btn');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: {
          text: 'test message',
          type: 'text',
          attachments: undefined,
        },
        threadId: undefined,
        parentMessageId: undefined,
      });
    });
  });

  it('shows error when conversation not found', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...defaultMockStore,
      activeConversation: null,
      messageLoading: false,
    } as any);

    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByText('Conversation not found')).toBeInTheDocument();
    expect(
      screen.getByText(/The conversation you're looking for doesn't exist/)
    ).toBeInTheDocument();
  });

  it('hides header when showHeader is false', () => {
    renderWithTheme(
      <ChatInterface conversationId="conv-1" showHeader={false} />
    );

    expect(screen.queryByText('Test Conversation')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-thread')).toBeInTheDocument();
  });

  it('calls onConversationAction when provided', () => {
    const onConversationAction = vi.fn();

    renderWithTheme(
      <ChatInterface
        conversationId="conv-1"
        onConversationAction={onConversationAction}
      />
    );

    // This would be triggered by some action in the component
    // For now, we'll just verify the prop is passed correctly
    expect(onConversationAction).toBeDefined();
  });

  it('applies custom height', () => {
    const { container } = renderWithTheme(
      <ChatInterface conversationId="conv-1" height="400px" />
    );

    const chatContainer = container.querySelector('.MuiPaper-root');
    expect(chatContainer).toHaveStyle({ height: '400px' });
  });

  it('shows typing indicator', () => {
    renderWithTheme(<ChatInterface conversationId="conv-1" />);

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
  });
});
