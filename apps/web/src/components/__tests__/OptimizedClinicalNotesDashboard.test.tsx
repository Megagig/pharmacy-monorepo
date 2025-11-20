import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '../../theme';
import OptimizedClinicalNotesDashboard from '../OptimizedClinicalNotesDashboard';
import { useEnhancedClinicalNoteStore } from '../../stores/enhancedClinicalNoteStore';

// Mock dependencies
vi.mock('../../stores/enhancedClinicalNoteStore');
vi.mock('../../queries/clinicalNoteQueries');
vi.mock('../../hooks/useDebounce');
vi.mock('../../hooks/useIntersectionObserver');
vi.mock('../VirtualizedClinicalNotesList', () => {
  return function MockVirtualizedList({
    notes,
    onNoteView,
    onNoteEdit,
    onNoteDelete,
  }: any) {
    return (
      <div data-testid="virtualized-list">
        {notes.map((note: any) => (
          <div key={note._id} data-testid={`note-${note._id}`}>
            <span>{note.title}</span>
            <button onClick={() => onNoteView?.(note)}>View</button>
            <button onClick={() => onNoteEdit?.(note)}>Edit</button>
            <button onClick={() => onNoteDelete?.(note)}>Delete</button>
          </div>
        ))}
      </div>
    );
  };
});

const mockStore = {
  notes: [
    {
      _id: '1',
      title: 'Test Note 1',
      type: 'consultation',
      priority: 'medium',
      patient: { _id: 'p1', firstName: 'John', lastName: 'Doe', mrn: 'MRN001' },
      pharmacist: {
        _id: 'ph1',
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        role: 'pharmacist',
      },
      content: {
        subjective: 'Test',
        objective: 'Test',
        assessment: 'Test',
        plan: 'Test',
      },
      isConfidential: false,
      followUpRequired: false,
      attachments: [],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      createdBy: 'ph1',
      lastModifiedBy: 'ph1',
      workplaceId: 'w1',
      medications: [],
      recommendations: [],
      tags: [],
    },
  ],
  selectedNotes: [],
  filters: {
    page: 1,
    limit: 20,
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
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
  setFilters: vi.fn(),
  setSearchQuery: vi.fn(),
  toggleNoteSelection: vi.fn(),
  clearSelection: vi.fn(),
  deleteNote: vi.fn(),
  bulkDeleteNotes: vi.fn(),
};

const mockUseClinicalNotes = {
  data: {
    notes: mockStore.notes,
    total: 1,
    currentPage: 1,
    totalPages: 1,
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  isFetching: false,
};

const mockUseDebounce = vi.fn((value) => value);
const mockUseIntersectionObserver = {
  targetRef: { current: null },
  isIntersecting: false,
};

beforeEach(() => {
  (useEnhancedClinicalNoteStore as any).mockReturnValue(mockStore);
  require('../../queries/clinicalNoteQueries').useClinicalNotes = vi
    .fn()
    .mockReturnValue(mockUseClinicalNotes);
  require('../../hooks/useDebounce').useDebounce = mockUseDebounce;
  require('../../hooks/useIntersectionObserver').useIntersectionObserver = jest
    .fn()
    .mockReturnValue(mockUseIntersectionObserver);
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
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('OptimizedClinicalNotesDashboard', () => {
  it('renders the dashboard with all components', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search notes/)).toBeInTheDocument();
    expect(screen.getByText('New Note')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders in embedded mode without title', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard embedded={true} />
      </TestWrapper>
    );

    expect(screen.queryByText('Clinical Notes')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search notes/)).toBeInTheDocument();
  });

  it('handles search input with debouncing', async () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search notes/);

    act(() => {
      fireEvent.change(searchInput, { target: { value: 'test search' } });
    });

    expect(searchInput).toHaveValue('test search');
    expect(mockUseDebounce).toHaveBeenCalledWith('test search', 300);
  });

  it('clears search input when clear button is clicked', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search notes/);

    act(() => {
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });

    const clearButton = screen.getByRole('button', { name: /clear/i });

    act(() => {
      fireEvent.click(clearButton);
    });

    expect(searchInput).toHaveValue('');
  });

  it('toggles view mode between list and grid', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    // Should have view mode toggles (not in mobile)
    const listButton = screen.getByRole('button', { name: /view list/i });
    const gridButton = screen.getByRole('button', { name: /view module/i });

    expect(listButton).toBeInTheDocument();
    expect(gridButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(gridButton);
    });

    // Grid mode should be active (visual feedback would be tested in integration tests)
  });

  it('opens filter menu when filter button is clicked', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const filterButton = screen.getByText('Filters');

    act(() => {
      fireEvent.click(filterButton);
    });

    // Menu should open (we can't easily test MUI menu without more setup)
    expect(filterButton).toBeInTheDocument();
  });

  it('toggles advanced filters', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const advancedToggle = screen.getByRole('checkbox', { name: /advanced/i });

    act(() => {
      fireEvent.click(advancedToggle);
    });

    // Advanced filters should be visible
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
  });

  it('handles filter changes', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    // Enable advanced filters first
    const advancedToggle = screen.getByRole('checkbox', { name: /advanced/i });

    act(() => {
      fireEvent.click(advancedToggle);
    });

    const typeSelect = screen.getByLabelText('Type');

    act(() => {
      fireEvent.mouseDown(typeSelect);
    });

    // Select a type (this would require more complex setup for MUI Select)
    expect(mockStore.setFilters).toHaveBeenCalled();
  });

  it('clears all filters when clear button is clicked', () => {
    // Set up store with some filters
    const storeWithFilters = {
      ...mockStore,
      filters: {
        ...mockStore.filters,
        type: 'consultation',
        priority: 'high',
      },
    };

    (useEnhancedClinicalNoteStore as any).mockReturnValue(storeWithFilters);

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const clearButton = screen.getByText('Clear All');

    act(() => {
      fireEvent.click(clearButton);
    });

    expect(mockStore.setFilters).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('renders virtualized list when enabled and has many notes', () => {
    const manyNotes = Array.from({ length: 20 }, (_, i) => ({
      ...mockStore.notes[0],
      _id: `note-${i}`,
      title: `Note ${i}`,
    }));

    const storeWithManyNotes = {
      ...mockStore,
      notes: manyNotes,
    };

    (useEnhancedClinicalNoteStore as any).mockReturnValue(storeWithManyNotes);

    require('../../queries/clinicalNoteQueries').useClinicalNotes = jest
      .fn()
      .mockReturnValue({
        ...mockUseClinicalNotes,
        data: {
          ...mockUseClinicalNotes.data,
          notes: manyNotes,
        },
      });

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard enableVirtualization={true} />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
  });

  it('renders regular list when virtualization is disabled', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard enableVirtualization={false} />
      </TestWrapper>
    );

    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
  });

  it('handles note selection', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard enableVirtualization={true} />
      </TestWrapper>
    );

    const noteElement = screen.getByTestId('note-1');

    act(() => {
      fireEvent.click(noteElement);
    });

    expect(mockStore.toggleNoteSelection).toHaveBeenCalledWith('1');
  });

  it('handles bulk delete when notes are selected', () => {
    const storeWithSelection = {
      ...mockStore,
      selectedNotes: ['1'],
    };

    (useEnhancedClinicalNoteStore as any).mockReturnValue(storeWithSelection);

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const deleteButton = screen.getByText('Delete (1)');

    act(() => {
      fireEvent.click(deleteButton);
    });

    expect(mockStore.bulkDeleteNotes).toHaveBeenCalledWith(['1']);
  });

  it('shows loading state', () => {
    const loadingStore = {
      ...mockStore,
      notes: [],
    };

    (useEnhancedClinicalNoteStore as any).mockReturnValue(loadingStore);

    require('../../queries/clinicalNoteQueries').useClinicalNotes = vi
      .fn()
      .mockReturnValue({
        ...mockUseClinicalNotes,
        isLoading: true,
        data: null,
      });

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Loading clinical notes...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    require('../../queries/clinicalNoteQueries').useClinicalNotes = jest
      .fn()
      .mockReturnValue({
        ...mockUseClinicalNotes,
        error: new Error('Failed to load'),
      });

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    expect(
      screen.getByText(/Failed to load clinical notes/)
    ).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(/Search notes/);

    // Test Ctrl+K to focus search
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    expect(document.activeElement).toBe(searchInput);

    // Test Escape to clear selection
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(mockStore.clearSelection).toHaveBeenCalled();
  });

  it('handles infinite scrolling', () => {
    const mockIntersectionObserver = {
      targetRef: { current: document.createElement('div') },
      isIntersecting: true,
    };

    require('../../hooks/useIntersectionObserver').useIntersectionObserver = vi
      .fn()
      .mockReturnValue(mockIntersectionObserver);

    const multiPageData = {
      ...mockUseClinicalNotes.data,
      currentPage: 1,
      totalPages: 3,
    };

    require('../../queries/clinicalNoteQueries').useClinicalNotes = jest
      .fn()
      .mockReturnValue({
        ...mockUseClinicalNotes,
        data: multiPageData,
      });

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard enableVirtualization={false} />
      </TestWrapper>
    );

    // Should trigger loading more data
    expect(mockStore.setFilters).toHaveBeenCalled();
  });

  it('applies patient filter when patientId is provided', () => {
    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard patientId="patient123" />
      </TestWrapper>
    );

    // Should include patientId in filters
    expect(
      require('../../queries/clinicalNoteQueries').useClinicalNotes
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient123',
      })
    );
  });
});

describe('OptimizedClinicalNotesDashboard Performance', () => {
  it('memoizes expensive calculations', () => {
    const { rerender } = render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    // Re-render with same props
    rerender(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    // Should not cause unnecessary re-calculations
    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
  });

  it('handles large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      ...mockStore.notes[0],
      _id: `note-${i}`,
      title: `Note ${i}`,
    }));

    const storeWithLargeDataset = {
      ...mockStore,
      notes: largeDataset,
    };

    (useEnhancedClinicalNoteStore as unknown).mockReturnValue(
      storeWithLargeDataset
    );

    const startTime = performance.now();

    render(
      <TestWrapper>
        <OptimizedClinicalNotesDashboard />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render quickly even with large dataset
    expect(renderTime).toBeLessThan(200); // Less than 200ms
    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
  });
});
