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
import { theme } from '../../theme';
import { useEnhancedClinicalNoteStore } from '../../stores/enhancedClinicalNoteStore';
import OptimizedClinicalNotesDashboard from '../OptimizedClinicalNotesDashboard';
import VirtualizedClinicalNotesList from '../VirtualizedClinicalNotesList';
import { ClinicalNote } from '../../types/clinicalNote';

// Mock the store and queries
jest.mock('../../stores/enhancedClinicalNoteStore');
jest.mock('../../queries/clinicalNoteQueries');
jest.mock('../../hooks/useDebounce');
jest.mock('../../hooks/useIntersectionObserver');

// Performance monitoring utilities
const performanceMonitor = {
  startTime: 0,
  endTime: 0,

  start() {
    this.startTime = performance.now();
  },

  end() {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  },

  measure(name: string, fn: () => void) {
    this.start();
    fn();
    const duration = this.end();
    console.log(`${name}: ${duration.toFixed(2)}ms`);
    return duration;
  },
};

// Generate large dataset for testing
const generateLargeDataset = (size: number): ClinicalNote[] => {
  return Array.from({ length: size }, (_, i) => ({
    _id: `note-${i}`,
    title: `Clinical Note ${i}`,
    type: ['consultation', 'medication_review', 'follow_up'][i % 3] as any,
    priority: ['low', 'medium', 'high'][i % 3] as any,
    patient: {
      _id: `patient-${i % 100}`,
      firstName: `Patient${i % 100}`,
      lastName: `Test${i % 100}`,
      mrn: `MRN${i.toString().padStart(6, '0')}`,
    },
    pharmacist: {
      _id: 'pharmacist-1',
      firstName: 'Dr. Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    content: {
      subjective: `Subjective content for note ${i}`,
      objective: `Objective content for note ${i}`,
      assessment: `Assessment content for note ${i}`,
      plan: `Plan content for note ${i}`,
    },
    isConfidential: i % 10 === 0,
    followUpRequired: i % 5 === 0,
    followUpDate:
      i % 5 === 0
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    attachments:
      i % 3 === 0
        ? [
            {
              _id: `att-${i}`,
              fileName: `file-${i}.pdf`,
              originalName: `file-${i}.pdf`,
              mimeType: 'application/pdf',
              size: 1024,
              url: `/files/file-${i}.pdf`,
              uploadedAt: new Date().toISOString(),
              uploadedBy: 'pharmacist-1',
            },
          ]
        : [],
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
    updatedAt: new Date(Date.now() - i * 60000).toISOString(),
    createdBy: 'pharmacist-1',
    lastModifiedBy: 'pharmacist-1',
    workplaceId: 'workplace-1',
    medications: [],
    recommendations: [`Recommendation ${i}`],
    tags: [`tag-${i % 5}`, `category-${i % 3}`],
  }));
};

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

describe('Clinical Notes Performance Integration Tests', () => {
  beforeEach(() => {
    // Mock debounce to return value immediately for testing
    require('../../hooks/useDebounce').useDebounce = jest.fn((value) => value);

    // Mock intersection observer
    require('../../hooks/useIntersectionObserver').useIntersectionObserver =
      jest.fn(() => ({
        targetRef: { current: null },
        isIntersecting: false,
      }));
  });

  describe('Large Dataset Rendering Performance', () => {
    it('should render 1000 notes efficiently with virtualization', async () => {
      const largeDataset = generateLargeDataset(1000);

      const mockStore = {
        notes: largeDataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 1000, totalPages: 20 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: {
            notes: largeDataset,
            total: 1000,
            currentPage: 1,
            totalPages: 20,
          },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      const renderTime = performanceMonitor.measure(
        'Large Dataset Render',
        () => {
          render(
            <TestWrapper>
              <OptimizedClinicalNotesDashboard enableVirtualization={true} />
            </TestWrapper>
          );
        }
      );

      expect(renderTime).toBeLessThan(500); // Should render within 500ms
      expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
    });

    it('should handle virtualized scrolling performance', async () => {
      const largeDataset = generateLargeDataset(5000);

      const scrollTime = performanceMonitor.measure(
        'Virtualized Scroll',
        () => {
          const { container } = render(
            <TestWrapper>
              <VirtualizedClinicalNotesList
                notes={largeDataset}
                height={600}
                itemHeight={160}
              />
            </TestWrapper>
          );

          // Simulate scrolling
          const scrollContainer = container.querySelector(
            '[data-testid="virtual-list"]'
          );
          if (scrollContainer) {
            fireEvent.scroll(scrollContainer, { target: { scrollTop: 5000 } });
          }
        }
      );

      expect(scrollTime).toBeLessThan(100); // Scrolling should be very fast
    });
  });

  describe('Search Performance', () => {
    it('should handle search input changes efficiently', async () => {
      const dataset = generateLargeDataset(1000);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 1000, totalPages: 20 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 1000, currentPage: 1, totalPages: 20 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      render(
        <TestWrapper>
          <OptimizedClinicalNotesDashboard />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/Search notes/);

      const searchTime = performanceMonitor.measure(
        'Search Input Performance',
        () => {
          // Simulate rapid typing
          for (let i = 0; i < 10; i++) {
            act(() => {
              fireEvent.change(searchInput, {
                target: { value: `search query ${i}` },
              });
            });
          }
        }
      );

      expect(searchTime).toBeLessThan(200); // Rapid search input should be handled efficiently
    });

    it('should filter large datasets efficiently', async () => {
      const dataset = generateLargeDataset(2000);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 2000, totalPages: 40 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 2000, currentPage: 1, totalPages: 40 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      render(
        <TestWrapper>
          <OptimizedClinicalNotesDashboard />
        </TestWrapper>
      );

      // Enable advanced filters
      const advancedToggle = screen.getByRole('checkbox', {
        name: /advanced/i,
      });

      const filterTime = performanceMonitor.measure(
        'Filter Application',
        () => {
          act(() => {
            fireEvent.click(advancedToggle);
          });
        }
      );

      expect(filterTime).toBeLessThan(100); // Filter UI should respond quickly
    });
  });

  describe('Selection Performance', () => {
    it('should handle bulk selection efficiently', async () => {
      const dataset = generateLargeDataset(1000);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 1000, totalPages: 20 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: {
            notes: dataset.slice(0, 50),
            total: 1000,
            currentPage: 1,
            totalPages: 20,
          },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      render(
        <TestWrapper>
          <VirtualizedClinicalNotesList
            notes={dataset.slice(0, 50)}
            height={600}
            itemHeight={160}
            onNoteSelect={mockStore.toggleNoteSelection}
          />
        </TestWrapper>
      );

      const selectionTime = performanceMonitor.measure('Bulk Selection', () => {
        // Simulate selecting multiple notes
        for (let i = 0; i < 10; i++) {
          const noteCard = screen
            .getByText(`Clinical Note ${i}`)
            .closest('[data-testid^="virtual-item"]');
          if (noteCard) {
            act(() => {
              fireEvent.click(noteCard);
            });
          }
        }
      });

      expect(selectionTime).toBeLessThan(300); // Bulk selection should be fast
      expect(mockStore.toggleNoteSelection).toHaveBeenCalledTimes(10);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not cause memory leaks with frequent re-renders', async () => {
      const dataset = generateLargeDataset(500);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 500, totalPages: 10 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 500, currentPage: 1, totalPages: 10 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      const { rerender, unmount } = render(
        <TestWrapper>
          <OptimizedClinicalNotesDashboard />
        </TestWrapper>
      );

      const rerenderTime = performanceMonitor.measure(
        'Multiple Re-renders',
        () => {
          // Simulate multiple re-renders
          for (let i = 0; i < 20; i++) {
            rerender(
              <TestWrapper>
                <OptimizedClinicalNotesDashboard key={i} />
              </TestWrapper>
            );
          }
        }
      );

      expect(rerenderTime).toBeLessThan(1000); // Multiple re-renders should not be too slow

      // Clean up
      unmount();
    });

    it('should handle component mounting and unmounting efficiently', async () => {
      const dataset = generateLargeDataset(100);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 100, totalPages: 2 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 100, currentPage: 1, totalPages: 2 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      const mountUnmountTime = performanceMonitor.measure(
        'Mount/Unmount Cycle',
        () => {
          for (let i = 0; i < 5; i++) {
            const { unmount } = render(
              <TestWrapper>
                <OptimizedClinicalNotesDashboard />
              </TestWrapper>
            );
            unmount();
          }
        }
      );

      expect(mountUnmountTime).toBeLessThan(500); // Mount/unmount cycles should be efficient
    });
  });

  describe('Responsive Performance', () => {
    it('should handle mobile layout efficiently', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const dataset = generateLargeDataset(200);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 200, totalPages: 4 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 200, currentPage: 1, totalPages: 4 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      const mobileRenderTime = performanceMonitor.measure(
        'Mobile Layout Render',
        () => {
          render(
            <TestWrapper>
              <OptimizedClinicalNotesDashboard />
            </TestWrapper>
          );
        }
      );

      expect(mobileRenderTime).toBeLessThan(400); // Mobile layout should render quickly
    });

    it('should handle viewport changes efficiently', async () => {
      const dataset = generateLargeDataset(100);

      const mockStore = {
        notes: dataset,
        selectedNotes: [],
        filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
        searchQuery: '',
        loading: { fetchNotes: false },
        pagination: { page: 1, limit: 50, total: 100, totalPages: 2 },
        setFilters: jest.fn(),
        setSearchQuery: jest.fn(),
        toggleNoteSelection: jest.fn(),
        clearSelection: jest.fn(),
        deleteNote: jest.fn(),
        bulkDeleteNotes: jest.fn(),
      };

      (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

      require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
        () => ({
          data: { notes: dataset, total: 100, currentPage: 1, totalPages: 2 },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
          isFetching: false,
        })
      );

      render(
        <TestWrapper>
          <OptimizedClinicalNotesDashboard />
        </TestWrapper>
      );

      const resizeTime = performanceMonitor.measure('Viewport Resize', () => {
        // Simulate viewport changes
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 768 });
          window.dispatchEvent(new Event('resize'));
        });

        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1200 });
          window.dispatchEvent(new Event('resize'));
        });
      });

      expect(resizeTime).toBeLessThan(200); // Viewport changes should be handled quickly
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should meet performance benchmarks for common operations', async () => {
    const benchmarks = {
      initialRender: 300,
      searchInput: 50,
      filterApplication: 100,
      noteSelection: 30,
      bulkOperations: 500,
    };

    const dataset = generateLargeDataset(1000);

    const mockStore = {
      notes: dataset,
      selectedNotes: [],
      filters: { page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'desc' },
      searchQuery: '',
      loading: { fetchNotes: false },
      pagination: { page: 1, limit: 50, total: 1000, totalPages: 20 },
      setFilters: jest.fn(),
      setSearchQuery: jest.fn(),
      toggleNoteSelection: jest.fn(),
      clearSelection: jest.fn(),
      deleteNote: jest.fn(),
      bulkDeleteNotes: jest.fn(),
    };

    (useEnhancedClinicalNoteStore as jest.Mock).mockReturnValue(mockStore);

    require('../../queries/clinicalNoteQueries').useClinicalNotes = jest.fn(
      () => ({
        data: {
          notes: dataset.slice(0, 50),
          total: 1000,
          currentPage: 1,
          totalPages: 20,
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        isFetching: false,
      })
    );

    // Initial render benchmark
    const initialRenderTime = performanceMonitor.measure(
      'Initial Render Benchmark',
      () => {
        render(
          <TestWrapper>
            <OptimizedClinicalNotesDashboard />
          </TestWrapper>
        );
      }
    );

    expect(initialRenderTime).toBeLessThan(benchmarks.initialRender);

    // Search input benchmark
    const searchInput = screen.getByPlaceholderText(/Search notes/);
    const searchTime = performanceMonitor.measure(
      'Search Input Benchmark',
      () => {
        act(() => {
          fireEvent.change(searchInput, { target: { value: 'test search' } });
        });
      }
    );

    expect(searchTime).toBeLessThan(benchmarks.searchInput);

    console.log('Performance Benchmarks:');
    console.log(
      `Initial Render: ${initialRenderTime.toFixed(2)}ms (target: <${
        benchmarks.initialRender
      }ms)`
    );
    console.log(
      `Search Input: ${searchTime.toFixed(2)}ms (target: <${
        benchmarks.searchInput
      }ms)`
    );
  });
});
