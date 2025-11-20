import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PatientQueryDashboard from '../PatientQueryDashboard';
import { useCommunicationStore } from '../../../stores/communicationStore';
import { Conversation } from '../../../stores/types';

// Mock the communication store
vi.mock('../../../stores/communicationStore');

// Mock date-fns
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    formatDistanceToNow: vi.fn(() => '2 hours ago'),
    format: vi.fn(() => '2024-01-15'),
    subDays: vi.fn(() => new Date('2024-01-14')),
    startOfDay: vi.fn(() => new Date('2024-01-15T00:00:00')),
    endOfDay: vi.fn(() => new Date('2024-01-15T23:59:59')),
  };
});

// Mock NewConversationModal
vi.mock('../NewConversationModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="new-conversation-modal">
      {open && (
        <div>
          <span>New Conversation Modal</span>
          <button onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  ),
}));

// Mock QueryCard
vi.mock('../QueryCard', () => ({
  default: ({
    query,
    selected,
    onSelect,
    onClick,
    onAction,
  }: {
    query: Conversation;
    selected: boolean;
    onSelect: (selected: boolean) => void;
    onClick: () => void;
    onAction: (action: string, queryId: string) => void;
  }) => (
    <div data-testid={`query-card-${query._id}`}>
      <span>{query.title || 'Patient Query'}</span>
      <span>{query.status}</span>
      <span>{query.priority}</span>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        data-testid={`query-checkbox-${query._id}`}
      />
      <button onClick={onClick} data-testid={`query-click-${query._id}`}>
        View Query
      </button>
      <button
        onClick={() => onAction('resolve', query._id)}
        data-testid={`query-resolve-${query._id}`}
      >
        Resolve
      </button>
    </div>
  ),
}));

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
);

// Mock data
const mockConversations: Conversation[] = [
  {
    _id: 'query-1',
    title: 'Medication Side Effects Question',
    type: 'patient_query',
    participants: [
      {
        userId: 'patient-1',
        role: 'patient',
        joinedAt: '2024-01-15T10:00:00Z',
        permissions: [],
      },
      {
        userId: 'pharmacist-1',
        role: 'pharmacist',
        joinedAt: '2024-01-15T10:00:00Z',
        permissions: [],
      },
    ],
    patientId: 'patient-1',
    caseId: 'case-123',
    status: 'active',
    priority: 'high',
    tags: ['medication', 'side-effects'],
    lastMessageAt: '2024-01-15T12:00:00Z',
    createdBy: 'patient-1',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
      clinicalContext: {
        diagnosis: 'Hypertension',
        medications: ['med-1', 'med-2'],
      },
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T12:00:00Z',
  },
  {
    _id: 'query-2',
    title: 'Prescription Refill Request',
    type: 'patient_query',
    participants: [
      {
        userId: 'patient-2',
        role: 'patient',
        joinedAt: '2024-01-14T14:00:00Z',
        permissions: [],
      },
      {
        userId: 'doctor-1',
        role: 'doctor',
        joinedAt: '2024-01-14T14:00:00Z',
        permissions: [],
      },
    ],
    patientId: 'patient-2',
    status: 'resolved',
    priority: 'normal',
    tags: ['prescription', 'refill'],
    lastMessageAt: '2024-01-14T16:00:00Z',
    createdBy: 'patient-2',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
    },
    createdAt: '2024-01-14T14:00:00Z',
    updatedAt: '2024-01-14T16:00:00Z',
  },
  {
    _id: 'query-3',
    title: 'Urgent Drug Interaction Alert',
    type: 'patient_query',
    participants: [
      {
        userId: 'patient-3',
        role: 'patient',
        joinedAt: '2024-01-15T08:00:00Z',
        permissions: [],
      },
      {
        userId: 'pharmacist-2',
        role: 'pharmacist',
        joinedAt: '2024-01-15T08:00:00Z',
        permissions: [],
      },
      {
        userId: 'doctor-2',
        role: 'doctor',
        joinedAt: '2024-01-15T08:30:00Z',
        permissions: [],
      },
    ],
    patientId: 'patient-3',
    status: 'active',
    priority: 'urgent',
    tags: ['drug-interaction', 'urgent'],
    lastMessageAt: '2024-01-15T11:00:00Z',
    createdBy: 'pharmacist-2',
    workplaceId: 'workplace-1',
    metadata: {
      isEncrypted: true,
      clinicalContext: {
        diagnosis: 'Multiple conditions',
        medications: ['med-3', 'med-4', 'med-5'],
      },
    },
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
];

const mockStoreState = {
  conversations: mockConversations,
  conversationFilters: {
    search: '',
    sortBy: 'lastMessageAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
  },
  loading: {
    fetchConversations: false,
  },
  errors: {
    fetchConversations: null,
  },
  fetchConversations: vi.fn(),
  setConversationFilters: vi.fn(),
  clearConversationFilters: vi.fn(),
  resolveConversation: vi.fn(),
  archiveConversation: vi.fn(),
  updateConversation: vi.fn(),
};

describe('PatientQueryDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCommunicationStore as any).mockReturnValue(mockStoreState);
  });

  it('renders dashboard with analytics cards', () => {
    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Patient Query Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Queries')).toBeInTheDocument();
    expect(screen.getByText('Open Queries')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Avg Response')).toBeInTheDocument();
  });

  it('displays correct analytics numbers', () => {
    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    // Check analytics cards exist
    expect(screen.getByText('Total Queries')).toBeInTheDocument();
    expect(screen.getByText('Open Queries')).toBeInTheDocument();

    // Find analytics cards by their parent structure
    const totalQueriesCard = screen
      .getByText('Total Queries')
      .closest('.MuiCardContent-root');
    expect(within(totalQueriesCard!).getByText('3')).toBeInTheDocument();

    const openQueriesCard = screen
      .getByText('Open Queries')
      .closest('.MuiCardContent-root');
    expect(within(openQueriesCard!).getByText('2')).toBeInTheDocument();

    // Find resolved card in analytics section (not tabs)
    const resolvedCards = screen.getAllByText('Resolved');
    const resolvedAnalyticsCard = resolvedCards
      .find((el) => el.closest('.MuiCardContent-root'))
      ?.closest('.MuiCardContent-root');
    expect(within(resolvedAnalyticsCard!).getByText('1')).toBeInTheDocument();

    const urgentCard = screen
      .getByText('Urgent')
      .closest('.MuiCardContent-root');
    expect(within(urgentCard!).getByText('1')).toBeInTheDocument();
  });

  it('renders tabs with correct counts', () => {
    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('All Queries')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    // Find tab resolved (not analytics card)
    const tabs = screen.getByRole('tablist');
    expect(within(tabs).getByText('Resolved')).toBeInTheDocument();
    expect(within(tabs).getByText('Archived')).toBeInTheDocument();
  });

  it('displays query cards for all queries by default', () => {
    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByTestId('query-card-query-1')).toBeInTheDocument();
    expect(screen.getByTestId('query-card-query-2')).toBeInTheDocument();
    expect(screen.getByTestId('query-card-query-3')).toBeInTheDocument();
  });

  it('filters queries by search term', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search queries...');
    await user.type(searchInput, 'medication');

    // Should show only queries with "medication" in title or tags
    expect(screen.getByTestId('query-card-query-1')).toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-3')).not.toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    // Click on "Open" tab
    const tabs = screen.getByRole('tablist');
    const openTab = within(tabs).getByText('Open');
    await user.click(openTab);

    // Should show only active queries
    expect(screen.getByTestId('query-card-query-1')).toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('query-card-query-3')).toBeInTheDocument();

    // Click on "Resolved" tab
    const resolvedTab = within(tabs).getByText('Resolved');
    await user.click(resolvedTab);

    // Should show only resolved queries
    expect(screen.queryByTestId('query-card-query-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('query-card-query-2')).toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-3')).not.toBeInTheDocument();
  });

  it('handles query selection for bulk actions', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    // Select first query
    const checkbox1 = screen.getByTestId('query-checkbox-query-1');
    await user.click(checkbox1);

    // Should show bulk actions
    expect(screen.getByText('1 queries selected')).toBeInTheDocument();
    expect(screen.getByText('Resolve Selected')).toBeInTheDocument();
    expect(screen.getByText('Archive Selected')).toBeInTheDocument();

    // Select second query
    const checkbox3 = screen.getByTestId('query-checkbox-query-3');
    await user.click(checkbox3);

    expect(screen.getByText('2 queries selected')).toBeInTheDocument();
  });

  it('performs bulk resolve action', async () => {
    const user = userEvent.setup();
    const mockResolveConversation = vi.fn().mockResolvedValue(true);
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      resolveConversation: mockResolveConversation,
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    // Select queries
    await user.click(screen.getByTestId('query-checkbox-query-1'));
    await user.click(screen.getByTestId('query-checkbox-query-3'));

    // Click bulk resolve
    const resolveButton = screen.getByText('Resolve Selected');
    await user.click(resolveButton);

    await waitFor(() => {
      expect(mockResolveConversation).toHaveBeenCalledWith('query-1');
      expect(mockResolveConversation).toHaveBeenCalledWith('query-3');
    });
  });

  it('opens new query modal when clicking New Query button', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    const newQueryButton = screen.getByText('New Query');
    await user.click(newQueryButton);

    expect(screen.getByTestId('new-conversation-modal')).toBeInTheDocument();
    expect(screen.getByText('New Conversation Modal')).toBeInTheDocument();
  });

  it('calls onQuerySelect when query is clicked', async () => {
    const user = userEvent.setup();
    const mockOnQuerySelect = vi.fn();

    render(
      <TestWrapper>
        <PatientQueryDashboard onQuerySelect={mockOnQuerySelect} />
      </TestWrapper>
    );

    const queryButton = screen.getByTestId('query-click-query-1');
    await user.click(queryButton);

    expect(mockOnQuerySelect).toHaveBeenCalledWith(mockConversations[0]);
  });

  it('calls onCreateQuery when provided', async () => {
    const user = userEvent.setup();
    const mockOnCreateQuery = vi.fn();

    render(
      <TestWrapper>
        <PatientQueryDashboard onCreateQuery={mockOnCreateQuery} />
      </TestWrapper>
    );

    const newQueryButton = screen.getByText('New Query');
    await user.click(newQueryButton);

    expect(mockOnCreateQuery).toHaveBeenCalled();
  });

  it('handles query actions from QueryCard', async () => {
    const user = userEvent.setup();
    const mockResolveConversation = vi.fn().mockResolvedValue(true);
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      resolveConversation: mockResolveConversation,
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    const resolveButton = screen.getByTestId('query-resolve-query-1');
    await user.click(resolveButton);

    await waitFor(() => {
      expect(mockResolveConversation).toHaveBeenCalledWith('query-1');
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    const mockFetchConversations = vi.fn();
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      fetchConversations: mockFetchConversations,
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    const refreshButton = screen.getByLabelText('Refresh');
    await user.click(refreshButton);

    expect(mockFetchConversations).toHaveBeenCalledWith({
      type: 'patient_query',
      sortBy: 'lastMessageAt',
      sortOrder: 'desc',
    });
  });

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    const mockClearConversationFilters = vi.fn();
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      clearConversationFilters: mockClearConversationFilters,
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    // Set some filters first
    const searchInput = screen.getByPlaceholderText('Search queries...');
    await user.type(searchInput, 'test');

    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);

    expect(mockClearConversationFilters).toHaveBeenCalled();
    expect(searchInput).toHaveValue('');
  });

  it('filters by patient ID when provided', () => {
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      conversations: mockConversations,
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard patientId="patient-1" />
      </TestWrapper>
    );

    // Should only show queries for patient-1
    expect(screen.getByTestId('query-card-query-1')).toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-card-query-3')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      loading: {
        fetchConversations: true,
      },
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useCommunicationStore as any).mockReturnValue({
      ...mockStoreState,
      errors: {
        fetchConversations: 'Failed to load queries',
      },
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load queries')).toBeInTheDocument();
  });

  it('shows empty state when no queries found', () => {
    (useCommunicationStore as unknown).mockReturnValue({
      ...mockStoreState,
      conversations: [],
    });

    render(
      <TestWrapper>
        <PatientQueryDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('No queries found')).toBeInTheDocument();
    expect(
      screen.getByText('No patient queries match your current filters.')
    ).toBeInTheDocument();
    expect(screen.getByText('Create First Query')).toBeInTheDocument();
  });

  it('hides analytics when showAnalytics is false', () => {
    render(
      <TestWrapper>
        <PatientQueryDashboard showAnalytics={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Total Queries')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Queries')).not.toBeInTheDocument();
  });

  it('applies custom height', () => {
    const { container } = render(
      <TestWrapper>
        <PatientQueryDashboard height="800px" />
      </TestWrapper>
    );

    const dashboardContainer = container.firstChild as HTMLElement;
    expect(dashboardContainer).toHaveStyle({ height: '800px' });
  });
});
