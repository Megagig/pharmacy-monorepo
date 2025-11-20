import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConversationList from '../ConversationList';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { Conversation } from '../../../stores/types';

// Mock the communication store
jest.mock('../../../stores/communicationStore');
const mockUseCommunicationStore = useCommunicationStore as jest.MockedFunction<
  typeof useCommunicationStore
>;

// Mock the debounce hook
jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 minutes ago',
}));

const mockConversations: Conversation[] = [
  {
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
  },
  {
    _id: 'conv-2',
    title: 'Group Discussion',
    type: 'group',
    participants: [
      {
        userId: 'user-2',
        role: 'pharmacist',
        joinedAt: '2024-01-01T00:00:00Z',
        permissions: ['read', 'write'],
      },
      {
        userId: 'user-3',
        role: 'doctor',
        joinedAt: '2024-01-01T00:00:00Z',
        permissions: ['read', 'write'],
      },
    ],
    status: 'active',
    priority: 'high',
    tags: ['therapy-consultation'],
    lastMessageAt: '2024-01-01T11:00:00Z',
    createdBy: 'user-2',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T11:00:00Z',
  },
];

const mockStore = {
  conversations: mockConversations,
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
    total: 2,
    pages: 1,
  },
  loading: {},
  errors: {},
  fetchConversations: jest.fn(),
  setConversationFilters: jest.fn(),
  clearConversationFilters: jest.fn(),
  archiveConversation: jest.fn(),
  resolveConversation: jest.fn(),
  deleteConversation: jest.fn(),
};

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
    jest.clearAllMocks();
  });

  it('renders conversation list correctly', () => {
    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Patient Query - John Doe')).toBeInTheDocument();
    expect(screen.getByText('Group Discussion')).toBeInTheDocument();
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

  it('opens filter menu when filter button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const filterButton = screen.getByLabelText('Filter');
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText('All Types')).toBeInTheDocument();
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
      expect(screen.getByText('All Priorities')).toBeInTheDocument();
    });
  });

  it('opens sort menu when sort button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const sortButton = screen.getByLabelText('Sort');
    await user.click(sortButton);

    await waitFor(() => {
      expect(screen.getByText('Latest Activity')).toBeInTheDocument();
      expect(screen.getByText('Newest First')).toBeInTheDocument();
      expect(screen.getByText('Oldest First')).toBeInTheDocument();
    });
  });

  it('calls onConversationSelect when conversation is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();

    render(
      <TestWrapper>
        <ConversationList onConversationSelect={mockOnSelect} />
      </TestWrapper>
    );

    const conversationItem = screen.getByText('Patient Query - John Doe');
    await user.click(conversationItem);

    expect(mockOnSelect).toHaveBeenCalledWith(mockConversations[0]);
  });

  it('displays new conversation button when showNewButton is true', () => {
    render(
      <TestWrapper>
        <ConversationList showNewButton={true} />
      </TestWrapper>
    );

    const newButton = screen.getByRole('button', { name: /add/i });
    expect(newButton).toBeInTheDocument();
  });

  it('does not display new conversation button when showNewButton is false', () => {
    render(
      <TestWrapper>
        <ConversationList showNewButton={false} />
      </TestWrapper>
    );

    const newButton = screen.queryByRole('button', { name: /add/i });
    expect(newButton).not.toBeInTheDocument();
  });

  it('displays loading skeleton when loading', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      loading: { fetchConversations: true },
    } as any);

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    // Check for skeleton elements
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays error message when there is an error', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      errors: { fetchConversations: 'Failed to load conversations' },
    } as any);

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(
      screen.getByText('Failed to load conversations')
    ).toBeInTheDocument();
  });

  it('displays empty state when no conversations', () => {
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      conversations: [],
    } as any);

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(screen.getByText('No conversations found')).toBeInTheDocument();
    expect(
      screen.getByText('Start a new conversation to get started')
    ).toBeInTheDocument();
  });

  it('displays pagination info', () => {
    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    expect(
      screen.getByText('Showing 2 of 2 conversations')
    ).toBeInTheDocument();
  });

  it('handles refresh button click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const refreshButton = screen.getByLabelText('Refresh');
    await user.click(refreshButton);

    expect(mockStore.fetchConversations).toHaveBeenCalled();
  });

  it('applies patient filter when patientId is provided', () => {
    render(
      <TestWrapper>
        <ConversationList patientId="patient-1" />
      </TestWrapper>
    );

    expect(mockStore.setConversationFilters).toHaveBeenCalledWith({
      patientId: 'patient-1',
      page: 1,
    });
  });

  it('renders in compact mode', () => {
    render(
      <TestWrapper>
        <ConversationList compact={true} />
      </TestWrapper>
    );

    // In compact mode, the header should not be visible
    expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
  });

  it('clears filters when clear all is clicked', async () => {
    const user = userEvent.setup();

    // Set up store with active filters
    mockUseCommunicationStore.mockReturnValue({
      ...mockStore,
      conversationFilters: {
        ...mockStore.conversationFilters,
        type: 'group',
        status: 'active',
      },
    } as any);

    render(
      <TestWrapper>
        <ConversationList />
      </TestWrapper>
    );

    const filterButton = screen.getByLabelText('Filter');
    await user.click(filterButton);

    await waitFor(() => {
      const clearButton = screen.getByText('Clear All Filters');
      user.click(clearButton);
    });

    expect(mockStore.clearConversationFilters).toHaveBeenCalled();
  });
});
