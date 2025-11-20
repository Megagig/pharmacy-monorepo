import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConversationItem from '../ConversationItem';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { Conversation } from '../../../stores/types';

// Mock the communication store
jest.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as jest.MockedFunction<
  typeof useCommunicationStore
>;

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 minutes ago',
}));

const mockConversation: Conversation = {
  _id: 'conv-1',
  title: 'Patient Query - John Doe',
  type: 'patient_query',
  participants: [
    {
      userId: 'user-1',
      role: 'patient',
      joinedAt: '2024-01-01T00:00:00Z',
      permissions: ['read', 'write'],
    },
    {
      userId: 'user-2',
      role: 'pharmacist',
      joinedAt: '2024-01-01T00:00:00Z',
      permissions: ['read', 'write', 'manage_medications'],
    },
  ],
  patientId: 'patient-1',
  status: 'active',
  priority: 'normal',
  tags: ['medication-review', 'follow-up'],
  lastMessageAt: '2024-01-01T12:00:00Z',
  createdBy: 'user-1',
  workplaceId: 'workplace-1',
  metadata: {
    isEncrypted: true,
    encryptionKeyId: 'key-1',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T12:00:00Z',
};

const mockStore = {
  messages: {
    'conv-1': [
      {
        _id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: { text: 'Hello', type: 'text' },
        status: 'sent',
        priority: 'normal',
        mentions: [],
        reactions: [],
        readBy: [],
        editHistory: [],
        isDeleted: false,
        createdAt: '2024-01-01T12:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
      },
      {
        _id: 'msg-2',
        conversationId: 'conv-1',
        senderId: 'user-2',
        content: { text: 'Hi there', type: 'text' },
        status: 'read',
        priority: 'normal',
        mentions: [],
        reactions: [],
        readBy: [],
        editHistory: [],
        isDeleted: false,
        createdAt: '2024-01-01T12:01:00Z',
        updatedAt: '2024-01-01T12:01:00Z',
      },
    ],
  },
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('ConversationItem', () => {
  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(mockStore as any);
    jest.clearAllMocks();
  });

  it('renders conversation item correctly', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} />
      </TestWrapper>
    );

    expect(screen.getByText('Patient Query - John Doe')).toBeInTheDocument();
    expect(screen.getByText('patient, pharmacist')).toBeInTheDocument();
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
  });

  it('displays conversation type icon correctly', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} />
      </TestWrapper>
    );

    // Check for patient query icon (QuestionAnswer)
    const icon = screen.getByTestId('QuestionAnswerIcon');
    expect(icon).toBeInTheDocument();
  });

  it('displays group conversation correctly', () => {
    const groupConversation = {
      ...mockConversation,
      type: 'group' as const,
      title: 'Group Discussion',
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={groupConversation} />
      </TestWrapper>
    );

    expect(screen.getByText('Group Discussion')).toBeInTheDocument();
  });

  it('displays priority indicator for urgent conversations', () => {
    const urgentConversation = {
      ...mockConversation,
      priority: 'urgent' as const,
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={urgentConversation} />
      </TestWrapper>
    );

    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} />
      </TestWrapper>
    );

    // One unread message (msg-1 has status 'sent', not 'read')
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('displays tags when not in compact mode', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} compact={false} />
      </TestWrapper>
    );

    expect(screen.getByText('medication-review')).toBeInTheDocument();
    expect(screen.getByText('follow-up')).toBeInTheDocument();
  });

  it('does not display tags in compact mode', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} compact={true} />
      </TestWrapper>
    );

    expect(screen.queryByText('medication-review')).not.toBeInTheDocument();
    expect(screen.queryByText('follow-up')).not.toBeInTheDocument();
  });

  it('displays status indicators for resolved conversations', () => {
    const resolvedConversation = {
      ...mockConversation,
      status: 'resolved' as const,
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={resolvedConversation} />
      </TestWrapper>
    );

    const checkIcon = screen.getByTestId('CheckCircleIcon');
    expect(checkIcon).toBeInTheDocument();
  });

  it('displays status indicators for archived conversations', () => {
    const archivedConversation = {
      ...mockConversation,
      status: 'archived' as const,
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={archivedConversation} />
      </TestWrapper>
    );

    const archiveIcon = screen.getByTestId('ArchiveIcon');
    expect(archiveIcon).toBeInTheDocument();
  });

  it('calls onClick when conversation is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = jest.fn();

    render(
      <TestWrapper>
        <ConversationItem
          conversation={mockConversation}
          onClick={mockOnClick}
        />
      </TestWrapper>
    );

    const conversationButton = screen.getByRole('button');
    await user.click(conversationButton);

    expect(mockOnClick).toHaveBeenCalled();
  });

  it('opens action menu when more options button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} />
      </TestWrapper>
    );

    const moreButton = screen.getByLabelText('More options');
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Archive')).toBeInTheDocument();
      expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('calls onAction when menu action is selected', async () => {
    const user = userEvent.setup();
    const mockOnAction = jest.fn();

    render(
      <TestWrapper>
        <ConversationItem
          conversation={mockConversation}
          onAction={mockOnAction}
        />
      </TestWrapper>
    );

    const moreButton = screen.getByLabelText('More options');
    await user.click(moreButton);

    await waitFor(async () => {
      const archiveButton = screen.getByText('Archive');
      await user.click(archiveButton);
    });

    expect(mockOnAction).toHaveBeenCalledWith('archive', 'conv-1');
  });

  it('displays different actions for archived conversations', async () => {
    const user = userEvent.setup();
    const archivedConversation = {
      ...mockConversation,
      status: 'archived' as const,
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={archivedConversation} />
      </TestWrapper>
    );

    const moreButton = screen.getByLabelText('More options');
    await user.click(moreButton);

    await waitFor(() => {
      expect(screen.getByText('Unarchive')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.queryByText('Archive')).not.toBeInTheDocument();
    });
  });

  it('applies selected styling when selected prop is true', () => {
    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} selected={true} />
      </TestWrapper>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('Mui-selected');
  });

  it('generates appropriate title for conversations without title', () => {
    const conversationWithoutTitle = {
      ...mockConversation,
      title: undefined,
      type: 'direct' as const,
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={conversationWithoutTitle} />
      </TestWrapper>
    );

    expect(screen.getByText('Direct Message')).toBeInTheDocument();
  });

  it('displays participant count for group conversations', () => {
    const groupConversation = {
      ...mockConversation,
      type: 'group' as const,
      title: undefined,
      participants: [
        ...mockConversation.participants,
        {
          userId: 'user-3',
          role: 'doctor' as const,
          joinedAt: '2024-01-01T00:00:00Z',
          permissions: ['read', 'write'],
        },
      ],
    };

    render(
      <TestWrapper>
        <ConversationItem conversation={groupConversation} />
      </TestWrapper>
    );

    expect(screen.getByText('Group Chat (3)')).toBeInTheDocument();
  });

  it('handles conversations with no unread messages', () => {
    // Mock store with all messages read
    mockUseCommunicationStore.mockReturnValue({
      messages: {
        'conv-1': [
          {
            _id: 'msg-1',
            conversationId: 'conv-1',
            senderId: 'user-1',
            content: { text: 'Hello', type: 'text' },
            status: 'read',
            priority: 'normal',
            mentions: [],
            reactions: [],
            readBy: [],
            editHistory: [],
            isDeleted: false,
            createdAt: '2024-01-01T12:00:00Z',
            updatedAt: '2024-01-01T12:00:00Z',
          },
        ],
      },
    } as any);

    render(
      <TestWrapper>
        <ConversationItem conversation={mockConversation} />
      </TestWrapper>
    );

    // Should not display unread badge
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('truncates long tag lists', () => {
    const conversationWithManyTags = {
      ...mockConversation,
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    };

    render(
      <TestWrapper>
        <ConversationItem
          conversation={conversationWithManyTags}
          compact={false}
        />
      </TestWrapper>
    );

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });
});
