import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PatientMessages from '../PatientMessages';
import { usePatientAuth } from '../../../hooks/usePatientAuth';
import { usePatientMessages } from '../../../hooks/usePatientMessages';

// Mock the hooks
vi.mock('../../../hooks/usePatientAuth');
vi.mock('../../../hooks/usePatientMessages');
vi.mock('../../../components/patient-portal/MessageThread', () => ({
  default: ({ conversation, onSendMessage }: any) => (
    <div data-testid="message-thread">
      <div>Conversation with {conversation.pharmacistName}</div>
      <button onClick={() => onSendMessage('test message')}>Send Test Message</button>
    </div>
  )
}));

const mockUsePatientAuth = usePatientAuth as any;
const mockUsePatientMessages = usePatientMessages as any;

const mockUser = {
  id: 'patient_123',
  email: 'patient@example.com',
  firstName: 'John',
  lastName: 'Doe',
  workspaceId: 'workspace_1',
  status: 'active'
};

const mockConversations = [
  {
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
    status: 'active',
    createdAt: '2024-03-20T09:00:00.000Z'
  },
  {
    id: 'conv_2',
    pharmacistId: 'pharm_2',
    pharmacistName: 'Dr. Michael Brown',
    pharmacistAvatar: null,
    lastMessage: {
      content: 'Your lab results look good',
      timestamp: '2024-03-21T15:30:00.000Z',
      senderId: 'pharm_2',
      isRead: true
    },
    unreadCount: 0,
    status: 'active',
    createdAt: '2024-03-19T14:00:00.000Z'
  }
];

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
  }
];

describe('PatientMessages', () => {
  beforeEach(() => {
    mockUsePatientAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true
    });

    mockUsePatientMessages.mockReturnValue({
      conversations: mockConversations,
      messages: mockMessages,
      loading: false,
      error: null,
      sendMessage: vi.fn().mockResolvedValue({}),
      markAsRead: vi.fn(),
      refreshConversations: vi.fn().mockResolvedValue({}),
      isConnected: true,
      typingUsers: []
    });
  });

  it('renders messages page with conversations list', () => {
    render(<PatientMessages />);
    
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Secure communication with your pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('Dr. Michael Brown')).toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(<PatientMessages />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays unread message count', () => {
    render(<PatientMessages />);
    
    // Should show badge with unread count for first conversation
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('filters conversations based on search query', async () => {
    render(<PatientMessages />);
    
    const searchInput = screen.getByPlaceholderText('Search conversations...');
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });
    
    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Dr. Michael Brown')).not.toBeInTheDocument();
    });
  });

  it('selects conversation and shows message thread', async () => {
    const mockMarkAsRead = vi.fn();
    mockUsePatientMessages.mockReturnValue({
      conversations: mockConversations,
      messages: mockMessages,
      loading: false,
      error: null,
      sendMessage: vi.fn().mockResolvedValue({}),
      markAsRead: mockMarkAsRead,
      refreshConversations: vi.fn().mockResolvedValue({}),
      isConnected: true,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    // Click on first conversation
    fireEvent.click(screen.getByText('Dr. Sarah Johnson'));
    
    await waitFor(() => {
      expect(screen.getByTestId('message-thread')).toBeInTheDocument();
      expect(screen.getByText('Conversation with Dr. Sarah Johnson')).toBeInTheDocument();
      expect(mockMarkAsRead).toHaveBeenCalledWith('conv_1');
    });
  });

  it('handles sending messages', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({});
    mockUsePatientMessages.mockReturnValue({
      conversations: mockConversations,
      messages: mockMessages,
      loading: false,
      error: null,
      sendMessage: mockSendMessage,
      markAsRead: vi.fn(),
      refreshConversations: vi.fn().mockResolvedValue({}),
      isConnected: true,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    // Select conversation first
    fireEvent.click(screen.getByText('Dr. Sarah Johnson'));
    
    await waitFor(() => {
      const sendButton = screen.getByText('Send Test Message');
      fireEvent.click(sendButton);
    });
    
    expect(mockSendMessage).toHaveBeenCalledWith('conv_1', 'test message', undefined);
  });

  it('handles refresh conversations', async () => {
    const mockRefreshConversations = vi.fn().mockResolvedValue({});
    mockUsePatientMessages.mockReturnValue({
      conversations: mockConversations,
      messages: mockMessages,
      loading: false,
      error: null,
      sendMessage: vi.fn().mockResolvedValue({}),
      markAsRead: vi.fn(),
      refreshConversations: mockRefreshConversations,
      isConnected: true,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    const refreshButton = screen.getByTitle('Refresh conversations');
    fireEvent.click(refreshButton);
    
    expect(mockRefreshConversations).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockUsePatientMessages.mockReturnValue({
      conversations: null,
      messages: [],
      loading: true,
      error: null,
      sendMessage: vi.fn(),
      markAsRead: vi.fn(),
      refreshConversations: vi.fn(),
      isConnected: false,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    expect(screen.getAllByRole('progressbar')).toHaveLength(2); // One in refresh button, one in conversations list
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUsePatientMessages.mockReturnValue({
      conversations: [],
      messages: [],
      loading: false,
      error: 'Failed to load conversations',
      sendMessage: vi.fn(),
      markAsRead: vi.fn(),
      refreshConversations: vi.fn(),
      isConnected: false,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    expect(screen.getByText('Failed to load conversations')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', () => {
    mockUsePatientMessages.mockReturnValue({
      conversations: [],
      messages: [],
      loading: false,
      error: null,
      sendMessage: vi.fn(),
      markAsRead: vi.fn(),
      refreshConversations: vi.fn(),
      isConnected: true,
      typingUsers: []
    });

    render(<PatientMessages />);
    
    expect(screen.getByText('No conversations found')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation with your pharmacist')).toBeInTheDocument();
  });

  it('shows login required message when user not authenticated', () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false
    });

    render(<PatientMessages />);
    
    expect(screen.getByText('Please log in to access your messages.')).toBeInTheDocument();
  });

  it('shows select conversation message when no conversation selected', () => {
    render(<PatientMessages />);
    
    expect(screen.getByText('Select a conversation')).toBeInTheDocument();
    expect(screen.getByText('Choose a conversation from the list to start messaging')).toBeInTheDocument();
  });
});