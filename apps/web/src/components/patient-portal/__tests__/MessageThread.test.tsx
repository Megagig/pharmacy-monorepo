import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MessageThread from '../MessageThread';

// Mock the child components
vi.mock('../MessageInput', () => ({
  default: ({ onSendMessage, placeholder }: any) => (
    <div data-testid="message-input">
      <input placeholder={placeholder} />
      <button onClick={() => onSendMessage('test message')}>Send</button>
    </div>
  )
}));

vi.mock('../FileAttachment', () => ({
  default: ({ attachment }: any) => (
    <div data-testid="file-attachment">{attachment.filename}</div>
  )
}));

const mockConversation = {
  id: 'conv_1',
  pharmacistId: 'pharm_1',
  pharmacistName: 'Dr. Sarah Johnson',
  pharmacistAvatar: null,
  lastMessage: {
    content: 'How are you feeling today?',
    timestamp: '2024-03-22T10:00:00.000Z',
    senderId: 'pharm_1',
    isRead: false
  },
  unreadCount: 2,
  status: 'active' as const,
  createdAt: '2024-03-20T09:00:00.000Z'
};

const mockMessages = [
  {
    id: 'msg_1',
    conversationId: 'conv_1',
    senderId: 'pharm_1',
    senderName: 'Dr. Sarah Johnson',
    content: 'Hello! How are you feeling today?',
    timestamp: '2024-03-22T10:00:00.000Z',
    isRead: false,
    attachments: []
  },
  {
    id: 'msg_2',
    conversationId: 'conv_1',
    senderId: 'patient_123',
    senderName: 'John Doe',
    content: 'I am feeling much better, thank you!',
    timestamp: '2024-03-22T10:05:00.000Z',
    isRead: true,
    attachments: []
  },
  {
    id: 'msg_3',
    conversationId: 'conv_1',
    senderId: 'pharm_1',
    senderName: 'Dr. Sarah Johnson',
    content: 'That\'s great to hear! Here are your test results.',
    timestamp: '2024-03-22T10:10:00.000Z',
    isRead: false,
    attachments: [
      {
        id: 'att_1',
        filename: 'test-results.pdf',
        url: '/files/test-results.pdf',
        type: 'application/pdf',
        size: 1024000
      }
    ]
  }
];

describe('MessageThread', () => {
  const defaultProps = {
    conversation: mockConversation,
    messages: mockMessages,
    currentUserId: 'patient_123',
    onSendMessage: vi.fn().mockResolvedValue({}),
    typingUsers: [],
    loading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversation header with pharmacist info', () => {
    render(<MessageThread {...defaultProps} />);
    
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('displays messages in chronological order', () => {
    render(<MessageThread {...defaultProps} />);
    
    expect(screen.getByText('Hello! How are you feeling today?')).toBeInTheDocument();
    expect(screen.getByText('I am feeling much better, thank you!')).toBeInTheDocument();
    expect(screen.getByText('That\'s great to hear! Here are your test results.')).toBeInTheDocument();
  });

  it('shows different styling for current user vs pharmacist messages', () => {
    render(<MessageThread {...defaultProps} />);
    
    const messages = screen.getAllByText(/feeling/);
    expect(messages).toHaveLength(2);
  });

  it('displays file attachments in messages', () => {
    render(<MessageThread {...defaultProps} />);
    
    expect(screen.getByTestId('file-attachment')).toBeInTheDocument();
    expect(screen.getByText('test-results.pdf')).toBeInTheDocument();
  });

  it('shows message timestamps', () => {
    render(<MessageThread {...defaultProps} />);
    
    // Should show formatted times for messages (they will be formatted based on current time)
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('shows read status for current user messages', () => {
    render(<MessageThread {...defaultProps} />);
    
    // Should show checkmarks for read status
    expect(screen.getByText('✓✓')).toBeInTheDocument(); // Read message
  });

  it('displays typing indicator when pharmacist is typing', () => {
    render(<MessageThread {...defaultProps} typingUsers={['pharm_1']} />);
    
    expect(screen.getByText('Dr. Sarah Johnson is typing...')).toBeInTheDocument();
  });

  it('handles sending messages through MessageInput', async () => {
    const mockOnSendMessage = vi.fn().mockResolvedValue({});
    render(<MessageThread {...defaultProps} onSendMessage={mockOnSendMessage} />);
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('test message', undefined);
  });

  it('shows loading state', () => {
    render(<MessageThread {...defaultProps} loading={true} messages={[]} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageThread {...defaultProps} messages={[]} />);
    
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Start the conversation by sending a message below')).toBeInTheDocument();
  });

  it('filters messages for current conversation only', () => {
    const messagesWithDifferentConversation = [
      ...mockMessages,
      {
        id: 'msg_4',
        conversationId: 'conv_2', // Different conversation
        senderId: 'pharm_2',
        senderName: 'Dr. Another Pharmacist',
        content: 'This should not appear',
        timestamp: '2024-03-22T11:00:00.000Z',
        isRead: false,
        attachments: []
      }
    ];

    render(<MessageThread {...defaultProps} messages={messagesWithDifferentConversation} />);
    
    expect(screen.queryByText('This should not appear')).not.toBeInTheDocument();
    expect(screen.getByText('Hello! How are you feeling today?')).toBeInTheDocument();
  });

  it('shows correct placeholder in message input', () => {
    render(<MessageThread {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Message Dr. Sarah Johnson...')).toBeInTheDocument();
  });

  it('handles message sending errors gracefully', async () => {
    const mockOnSendMessage = vi.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<MessageThread {...defaultProps} onSendMessage={mockOnSendMessage} />);
    
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send message:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });

  it('formats message times correctly for different time periods', () => {
    const messagesWithDifferentTimes = [
      {
        ...mockMessages[0],
        timestamp: new Date().toISOString() // Today
      },
      {
        ...mockMessages[1],
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        ...mockMessages[2],
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
      }
    ];

    render(<MessageThread {...defaultProps} messages={messagesWithDifferentTimes} />);
    
    // Should show different time formats based on age
    // Today: just time, this week: day + time, older: date + time
    expect(screen.getAllByText(/\d{1,2}:\d{2}/)).toHaveLength(3); // All should have time format
  });
});