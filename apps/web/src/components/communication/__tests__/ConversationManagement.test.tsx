import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConversationList from '../ConversationList';
import ConversationItem from '../ConversationItem';
import NewConversationModal from '../NewConversationModal';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { usePatients } from '../../../queries/usePatients';
import { Conversation } from '../../../stores/types';

// Mock the communication store
vi.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = vi.mocked(useCommunicationStore);

// Mock the patients query
vi.mock('../../../queries/usePatients');
const mockUsePatients = vi.mocked(usePatients);

// Mock the debounce hook
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

// Mock date-fns
vi.mock('date-fns', () => ({
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
  tags: ['medication-review'],
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
  conversations: [mockConversation],
  conversationFilters: {
    search: '',
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
  },
  conversationPagination: {
    page: 1,
    limit: 20,
    total: 1,
    pages: 1,
  },
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
    ],
  },
  loading: {},
  errors: {},
  fetchConversations: vi.fn(),
  setConversationFilters: vi.fn(),
  clearConversationFilters: vi.fn(),
  archiveConversation: vi.fn(),
  resolveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  createConversation: vi.fn(),
};

const mockPatients = [
  {
    _id: 'patient-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@email.com',
    phone: '123-456-7890',
    dateOfBirth: '1990-01-01',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('ConversationList', () => {
  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(mockStore as any);
    vi.clearAllMocks();
  });

  it('renders conversation list correctly', () => {
    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Patient Query - John Doe')).toBeInTheDocument();
  });

  it('displays search input', () => {
    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search conversations...');
    expect(searchInput).toBeInTheDocument();
  });

  it('handles search input changes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search conversations...');
    await user.type(searchInput, 'John');

    expect(mockStore.setConversationFilters).toHaveBeenCalledWith({
      search: 'John',
      page: 1,
    });
  });

  it('displays filter and sort buttons', () => {
    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(screen.getByLabelText('Filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
  });

  it('calls onConversationSelect when conversation is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();

    render(
      <TestWrapper>
        <ConversationList onConversationSelect={mockOnSelect} />
      </TestWrapper>
    );

    const conversationItem = screen.getByText('Patient Query - John Doe');
    await user.click(conversationItem);

    expect(mockOnSelect).toHaveBeenCalledWith(mockConversation);
  });
});

describe('ConversationItem', () => {
  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(mockStore as any);
    vi.clearAllMocks();
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

  it('calls onClick when conversation is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();

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
});

describe('NewConversationModal', () => {
  beforeEach(() => {
    mockUseCommunicationStore.mockReturnValue(mockStore as any);
    mockUsePatients.mockReturnValue({
      data: mockPatients,
      isLoading: false,
      error: null,
    } as any);
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <TestWrapper>
        <NewConversationModal open={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.getByText('New Conversation')).toBeInTheDocument();
    expect(screen.getByText('Type & Details')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(
      <TestWrapper>
        <NewConversationModal open={false} onClose={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.queryByText('New Conversation')).not.toBeInTheDocument();
  });

  it('displays stepper with correct steps', () => {
    render(
      <TestWrapper>
        <NewConversationModal open={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.getByText('Type & Details')).toBeInTheDocument();
    expect(screen.getByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('allows entering conversation title', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <NewConversationModal open={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    const titleInput = screen.getByLabelText('Conversation Title (Optional)');
    await user.type(titleInput, 'Test Conversation');

    expect(titleInput).toHaveValue('Test Conversation');
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(
      <TestWrapper>
        <NewConversationModal open={true} onClose={mockOnClose} />
      </TestWrapper>
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
