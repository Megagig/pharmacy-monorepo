import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import MessageThread from '../MessageThread';
import { useSocketConnection } from '../../../hooks/useSocket';
import { socketService } from '../../../services/socketService';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
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
import { it } from 'date-fns/locale';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { expect } from '@playwright/test';
import { it } from 'date-fns/locale';

// Mock the hooks and services
vi.mock('../../../hooks/useSocket');
vi.mock('../../../services/socketService');

// Mock child components
vi.mock('../MessageItem', () => ({
  default: ({ message, onReply }: any) => (
    <div data-testid={`message-${message._id}`}>
      <span>{message.content.text}</span>
      <button onClick={() => onReply(message)}>Reply</button>
    </div>
  ),
}));

const mockUseSocketConnection = vi.mocked(useSocketConnection);
const mockSocketService = vi.mocked(socketService);

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('MessageThread', () => {
  const mockMessages = [
    {
      _id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: {
        text: 'First message',
        type: 'text' as const,
      },
      mentions: [],
      reactions: [],
      status: 'read' as const,
      priority: 'normal' as const,
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    {
      _id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-2',
      content: {
        text: 'Second message',
        type: 'text' as const,
      },
      mentions: [],
      reactions: [],
      status: 'read' as const,
      priority: 'normal' as const,
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: '2024-01-02T10:00:00Z',
      updatedAt: '2024-01-02T10:00:00Z',
    },
  ];

  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
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

    mockSocketService.startTyping = vi.fn();
    mockSocketService.stopTyping = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders messages correctly', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('shows date divider between messages from different days', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    // Should show date divider between messages from different days
    expect(screen.getByText('1/2/2024')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(
      screen.getByText('No messages yet. Start the conversation!')
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error message', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSendMessage}
        error="Failed to load messages"
      />
    );

    expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
  });

  it('handles message input and sending', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');

    // Type a message
    await user.type(input, 'Hello world');
    expect(input).toHaveValue('Hello world');

    // Send button should be enabled
    const sendButton = screen.getByTestId('SendIcon').closest('button');
    expect(sendButton).not.toBeDisabled();

    // Click send
    if (sendButton) {
      await user.click(sendButton);
    }

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      'Hello world',
      undefined,
      undefined,
      undefined
    );

    // Input should be cleared after sending
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('handles Enter key to send message', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');

    await user.type(input, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      'Hello world',
      undefined,
      undefined,
      undefined
    );
  });

  it('handles Shift+Enter for new line', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');

    await user.type(input, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Line 2');

    expect(input).toHaveValue('Line 1\nLine 2');
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('handles typing indicators', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');

    // Start typing
    await user.type(input, 'Hello');

    expect(mockSocketService.startTyping).toHaveBeenCalledWith('conv-1');

    // Clear input should stop typing
    await user.clear(input);

    expect(mockSocketService.stopTyping).toHaveBeenCalledWith('conv-1');
  });

  it('handles file attachments', async () => {
    const user = userEvent.setup();
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    // Mock file input
    const hiddenInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate file selection
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(hiddenInput);

    // File should appear in preview
    expect(screen.getByText('test.txt')).toBeInTheDocument();

    // Send message with attachment
    const sendButton = screen.getByTestId('SendIcon').closest('button');
    if (sendButton) {
      await user.click(sendButton);
    }

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      '',
      [file],
      undefined,
      undefined
    );
  });

  it('removes file attachments', async () => {
    const user = userEvent.setup();
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    // Add file
    const hiddenInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(hiddenInput);

    expect(screen.getByText('test.txt')).toBeInTheDocument();

    // Remove file
    const removeButton = screen.getByRole('button', { name: '×' });
    await user.click(removeButton);

    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
  });

  it('disables input when disconnected', () => {
    mockUseSocketConnection.mockReturnValue({
      isConnected: false,
      connectionStatus: 'disconnected' as const,
      connectionInfo: {
        status: 'disconnected' as const,
        reconnectAttempts: 0,
        joinedConversations: [],
      },
    });

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByTestId('SendIcon').closest('button');

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
    expect(
      screen.getByText(
        /Offline - Messages will be sent when connection is restored/
      )
    ).toBeInTheDocument();
  });

  it('shows thread header when in thread mode', () => {
    const parentMessage = mockMessages[0];

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={mockMessages}
        onSendMessage={mockOnSendMessage}
        threadId="thread-1"
        parentMessage={parentMessage}
      />
    );

    expect(screen.getByText('Thread')).toBeInTheDocument();
    expect(screen.getByText(/Replying to: First message/)).toBeInTheDocument();
  });

  it('filters messages by thread ID', () => {
    const threadMessages = [
      { ...mockMessages[0], threadId: 'thread-1' },
      { ...mockMessages[1] }, // No threadId
    ];

    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={threadMessages}
        onSendMessage={mockOnSendMessage}
        threadId="thread-1"
      />
    );

    // Should only show the message with matching threadId
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.queryByTestId('message-msg-2')).not.toBeInTheDocument();
  });

  it('shows different placeholder for thread replies', () => {
    renderWithTheme(
      <MessageThread
        conversationId="conv-1"
        messages={[]}
        onSendMessage={mockOnSendMessage}
        threadId="thread-1"
      />
    );

    expect(
      screen.getByPlaceholderText('Reply to thread...')
    ).toBeInTheDocument();
    expect(screen.getByText('No replies yet')).toBeInTheDocument();
  });
});
