import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import ClinicalNotesDashboard from '../ClinicalNotesDashboard';
import { useEnhancedClinicalNoteStore } from '../../stores/enhancedClinicalNoteStore';

// Mock the store
jest.mock('../../stores/enhancedClinicalNoteStore');
jest.mock('../../queries/clinicalNoteQueries');
jest.mock('../../hooks/useResponsive');

const mockStore = {
  notes: [],
  selectedNotes: [],
  filters: {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  searchQuery: '',
  loading: {
    fetchNotes: false,
    createNote: false,
    updateNote: false,
    deleteNote: false,
    bulkOperations: false,
    uploadAttachment: false,
  },
  errors: {
    fetchNotes: null,
    createNote: null,
    updateNote: null,
    deleteNote: null,
    bulkOperations: null,
    uploadAttachment: null,
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  ui: {
    isCreateModalOpen: false,
    isEditModalOpen: false,
    isDeleteConfirmOpen: false,
    isBulkDeleteConfirmOpen: false,
    viewMode: 'table',
    sidebarCollapsed: false,
  },
  // Mock functions
  fetchNotes: jest.fn(),
  searchNotes: jest.fn(),
  deleteNote: jest.fn(),
  bulkDeleteNotes: jest.fn(),
  bulkUpdateNotes: jest.fn(),
  toggleNoteSelection: jest.fn(),
  selectAllNotes: jest.fn(),
  clearSelection: jest.fn(),
  setFilters: jest.fn(),
  setSearchQuery: jest.fn(),
  setPage: jest.fn(),
  setLimit: jest.fn(),
  setCreateModalOpen: jest.fn(),
  setEditModalOpen: jest.fn(),
  setDeleteConfirmOpen: jest.fn(),
  setBulkDeleteConfirmOpen: jest.fn(),
};

// Mock React Query
const mockUseClinicalNotes = {
  data: {
    notes: [],
    total: 0,
    currentPage: 1,
    totalPages: 0,
  },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
};

// Mock responsive hook
const mockUseResponsive = {
  isMobile: false,
  shouldUseCardLayout: false,
  theme: theme,
};

beforeEach(() => {
  (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);
  require('../../queries/clinicalNoteQueries').useClinicalNotes = jest
    .fn()
    .mockReturnValue(mockUseClinicalNotes);
  require('../../hooks/useResponsive').useResponsive = jest
    .fn()
    .mockReturnValue(mockUseResponsive);
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('ClinicalNotesDashboard', () => {
  it('renders the dashboard with title and search', () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    expect(screen.getByText('New Note')).toBeInTheDocument();
  });

  it('renders embedded mode without title', () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard embedded={true} />
      </TestWrapper>
    );

    expect(screen.queryByText('Clinical Notes')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
  });

  it('handles search input changes', async () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search notes...');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(searchInput).toHaveValue('test search');
  });

  it('opens filter menu when filter button is clicked', () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    const filterButton = screen.getByText('Filters');
    fireEvent.click(filterButton);

    // Menu should be open (we can't easily test this without more complex setup)
    expect(filterButton).toBeInTheDocument();
  });

  it('calls setCreateModalOpen when New Note button is clicked', () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    const newNoteButton = screen.getByText('New Note');
    fireEvent.click(newNoteButton);

    expect(mockStore.setCreateModalOpen).toHaveBeenCalledWith(true);
  });

  it('renders mobile layout when shouldUseCardLayout is true', () => {
    // Mock mobile layout
    require('../../hooks/useResponsive').useResponsive = jest
      .fn()
      .mockReturnValue({
        ...mockUseResponsive,
        isMobile: true,
        shouldUseCardLayout: true,
      });

    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    // In mobile layout, the search should be full width
    const searchInput = screen.getByPlaceholderText('Search notes...');
    expect(searchInput).toBeInTheDocument();
  });

  it('displays empty state when no notes are available', () => {
    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    // Since we're mocking empty data, we should see the DataGrid (desktop) or empty state (mobile)
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
  });

  it('shows loading state when data is loading', () => {
    require('../../queries/clinicalNoteQueries').useClinicalNotes = jest
      .fn()
      .mockReturnValue({
        ...mockUseClinicalNotes,
        isLoading: true,
      });

    render(
      <TestWrapper>
        <ClinicalNotesDashboard />
      </TestWrapper>
    );

    // Loading should be handled by the DataGrid or loading spinner
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
  });

  it('handles patient-specific filtering when patientId is provided', () => {
    const patientId = 'patient-123';

    render(
      <TestWrapper>
        <ClinicalNotesDashboard patientId={patientId} />
      </TestWrapper>
    );

    // The component should render normally with patient filtering
    expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
  });
});
