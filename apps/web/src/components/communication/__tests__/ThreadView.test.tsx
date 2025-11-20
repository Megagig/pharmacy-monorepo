import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ThreadView from '../ThreadView';
import { Message } from '../../../stores/types';

// Mock the communication store
const mockSendMessage = vi.fn();
vi.mock('../../../stores/communicationStore', () => ({
  useCommunicationStore: () => ({
    sendMessage: mockSendMessage,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const mockThreadSummary = {
  threadId: 'thread-123',
  rootMessage: {
    _id: 'msg-123',
    conversationId: 'conv-123',
    senderId: 'user-123',
    content: {
      text: 'This is the root message of the thread',
      type: 'text',
    },
    threadId: 'thread-123',
    parentMessageId: undefined,
    mentions: [],
    reactions: [],
    status: 'sent',
    priority: 'normal',
    readBy: [],
    editHistory: [],
    isDeleted: false,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  } as Message,
  replyCount: 2,
  participants: ['user-123', 'user-456'],
  lastReplyAt: '2024-01-01T10:30:00Z',
  unreadCount: 1,
};

const mockThreadMessages = {
  rootMessage: mockThreadSummary.rootMessage,
  replies: [
    {
      _id: 'msg-456',
      conversationId: 'conv-123',
      senderId: 'user-456',
      content: {
        text: 'First reply to the thread',
        type: 'text',
      },
      threadId: 'thread-123',
      parentMessageId: 'thread-123',
      mentions: [],
      reactions: [],
      status: 'sent',
      priority: 'normal',
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: '2024-01-01T10:15:00Z',
      updatedAt: '2024-01-01T10:15:00Z',
    },
    {
      _id: 'msg-789',
      conversationId: 'conv-123',
      senderId: 'user-123',
      content: {
        text: 'Second reply to the thread',
        type: 'text',
      },
      threadId: 'thread-123',
      parentMessageId: 'thread-123',
      mentions: [],
      reactions: [],
      status: 'sent',
      priority: 'normal',
      readBy: [],
      editHistory: [],
      isDeleted: false,
      createdAt: '2024-01-01T10:30:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
    },
  ] as Message[],
};

describe('ThreadView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
      },
      writable: true,
    });
  });

  it('should render thread summary and expand to show messages', async () => {
    // Mock fetch responses
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadSummary }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadMessages }),
      });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={false}
      />
    );

    // Wait for thread summary to load
    await waitFor(() => {
      expect(screen.getByText('Thread')).toBeInTheDocument();
    });

    // Check thread summary information
    expect(screen.getByText('2 replies')).toBeInTheDocument();
    expect(screen.getByText('2 participants')).toBeInTheDocument();
    expect(screen.getByText(/This is the root message/)).toBeInTheDocument();

    // Check that thread messages are displayed (since compact=false, it should be expanded)
    await waitFor(() => {
      expect(screen.getByText('Thread starter')).toBeInTheDocument();
      expect(screen.getByText('Replies (2)')).toBeInTheDocument();
      expect(screen.getByText('First reply to the thread')).toBeInTheDocument();
      expect(
        screen.getByText('Second reply to the thread')
      ).toBeInTheDocument();
    });
  });

  it('should handle compact mode with expand/collapse', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockThreadSummary }),
    });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Thread')).toBeInTheDocument();
    });

    // In compact mode, thread should be collapsed initially
    expect(screen.queryByText('Thread starter')).not.toBeInTheDocument();

    // Find and click expand button
    const expandButton = screen.getByRole('button', { name: /expand thread/i });
    expect(expandButton).toBeInTheDocument();

    // Mock the thread messages fetch for expansion
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockThreadMessages }),
    });

    fireEvent.click(expandButton);

    // Wait for thread to expand and messages to load
    await waitFor(() => {
      expect(screen.getByText('Thread starter')).toBeInTheDocument();
    });
  });

  it('should display unread count badge', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockThreadSummary }),
    });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Unread count badge
    });
  });

  it('should handle reply to thread', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadSummary }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadMessages }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { _id: 'new-reply' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadMessages }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockThreadSummary }),
      });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={false}
        showReplyInput={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Thread')).toBeInTheDocument();
    });

    // Wait for messages to load
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/reply to thread/i)
      ).toBeInTheDocument();
    });

    // Type a reply
    const replyInput = screen.getByPlaceholderText(/reply to thread/i);
    fireEvent.change(replyInput, { target: { value: 'New thread reply' } });

    // Send the reply
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/communication/threads/thread-123/reply',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
          body: JSON.stringify({
            content: {
              text: 'New thread reply',
              type: 'text',
            },
            mentions: undefined,
          }),
        })
      );
    });
  });

  it('should handle loading and error states', async () => {
    // Mock fetch to reject
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<ThreadView threadId="thread-123" conversationId="conv-123" />);

    // Should show loading initially
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/failed to load thread/i)).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockThreadSummary }),
    });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Thread')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close thread/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show empty state when no replies exist', async () => {
    const emptyThreadMessages = {
      ...mockThreadMessages,
      replies: [],
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { ...mockThreadSummary, replyCount: 0 },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: emptyThreadMessages }),
      });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={false}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('No replies yet. Be the first to reply!')
      ).toBeInTheDocument();
    });
  });

  it('should format relative time correctly', async () => {
    const recentThreadSummary = {
      ...mockThreadSummary,
      lastReplyAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: recentThreadSummary }),
    });

    render(
      <ThreadView
        threadId="thread-123"
        conversationId="conv-123"
        compact={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
    });
  });
});
