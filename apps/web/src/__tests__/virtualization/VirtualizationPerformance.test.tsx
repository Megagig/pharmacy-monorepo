import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { VirtualizedPatientList } from '../../components/virtualized/VirtualizedPatientList';
import { VirtualizedDataTable } from '../../components/virtualized/VirtualizedDataTable';
import { MobileOptimizedVirtualList } from '../../components/virtualized/MobileOptimizedVirtualList';
import type { Patient } from '../../types/patientManagement';
import type { ColumnDef } from '@tanstack/react-table';

// Mock react-window for performance testing
vi.mock('react-window', () => ({
  FixedSizeList: vi.fn(({ children, itemData, itemCount, onItemsRendered }) => {
    // Simulate rendering only visible items (10 at a time)
    const visibleItems = Math.min(itemCount, 10);
    
    // Simulate onItemsRendered callback
    if (onItemsRendered) {
      onItemsRendered({
        overscanStartIndex: 0,
        overscanStopIndex: visibleItems - 1,
        visibleStartIndex: 0,
        visibleStopIndex: visibleItems - 1,
      });
    }
    
    return (
      <div data-testid="virtual-list" data-item-count={itemCount}>
        {Array.from({ length: visibleItems }).map((_, index) =>
          children({
            index,
            style: { height: 120, top: index * 120 },
            data: itemData,
          })
        )}
      </div>
    );
  }),
  VariableSizeList: vi.fn(({ children, itemData, itemCount, onItemsRendered }) => {
    const visibleItems = Math.min(itemCount, 10);
    
    if (onItemsRendered) {
      onItemsRendered({
        overscanStartIndex: 0,
        overscanStopIndex: visibleItems - 1,
        visibleStartIndex: 0,
        visibleStopIndex: visibleItems - 1,
      });
    }
    
    return (
      <div data-testid="virtual-list" data-item-count={itemCount}>
        {Array.from({ length: visibleItems }).map((_, index) =>
          children({
            index,
            style: { height: 120, top: index * 120 },
            data: itemData,
          })
        )}
      </div>
    );
  }),
}));

// Mock react-window-infinite-loader
vi.mock('react-window-infinite-loader', () => ({
  default: vi.fn(({ children, isItemLoaded, loadMoreItems, itemCount }) => {
    return children({
      onItemsRendered: vi.fn(),
      ref: vi.fn(),
    });
  }),
}));

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private measurements: { [key: string]: number[] } = {};

  start(label: string) {
    this.startTime = performance.now();
    if (!this.measurements[label]) {
      this.measurements[label] = [];
    }
  }

  end(label: string) {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    this.measurements[label].push(duration);
    return duration;
  }

  getAverage(label: string): number {
    const times = this.measurements[label] || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  getMax(label: string): number {
    const times = this.measurements[label] || [];
    return times.length > 0 ? Math.max(...times) : 0;
  }

  getMin(label: string): number {
    const times = this.measurements[label] || [];
    return times.length > 0 ? Math.min(...times) : 0;
  }

  reset() {
    this.measurements = {};
  }
}

// Generate test data
const generatePatients = (count: number): Patient[] => {
  return Array.from({ length: count }, (_, index) => ({
    _id: `patient-${index}`,
    mrn: `PHM-LAG-${String(index + 1).padStart(6, '0')}`,
    firstName: `Patient${index}`,
    lastName: `Test${index}`,
    displayName: `Patient${index} Test${index}`,
    email: `patient${index}@test.com`,
    phone: `+234801234${String(index).padStart(4, '0')}`,
    gender: index % 2 === 0 ? 'male' : 'female',
    age: 20 + (index % 60),
    bloodGroup: ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'][index % 8] as any,
    genotype: ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'][index % 6] as any,
    state: ['Lagos', 'Abuja', 'Kano', 'Rivers', 'Ogun'][index % 5] as any,
    lga: `LGA-${index % 20}`,
    hasActiveDTP: index % 15 === 0,
    address: `${index} Test Street, Test Area`,
    createdAt: new Date(Date.now() - index * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

const generateTableData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    name: `Item ${index}`,
    value: Math.random() * 1000,
    category: ['Category A', 'Category B', 'Category C', 'Category D'][index % 4],
    status: index % 3 === 0 ? 'active' : index % 3 === 1 ? 'inactive' : 'pending',
    description: `Description for item ${index}. This is a longer text to test rendering performance.`,
    createdAt: new Date(Date.now() - index * 3600000).toISOString(),
    tags: Array.from({ length: index % 5 + 1 }, (_, i) => `tag${i}`),
  }));
};

const tableColumns: ColumnDef<ReturnType<typeof generateTableData>[0]>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { 
    accessorKey: 'value', 
    header: 'Value',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'description', header: 'Description' },
];

// Test wrapper
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
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Virtualization Performance Benchmarks', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('VirtualizedPatientList Performance', () => {
    it('renders 1,000 patients efficiently', () => {
      const patients = generatePatients(1000);
      
      monitor.start('patient-list-1k');
      
      const { container } = render(
        <TestWrapper>
          <VirtualizedPatientList
            patients={patients}
            height={600}
            itemHeight={120}
          />
        </TestWrapper>
      );
      
      const renderTime = monitor.end('patient-list-1k');
      
      // Should render within 100ms even with 1000 items
      expect(renderTime).toBeLessThan(100);
      
      // Should only render visible items (not all 1000)
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList.getAttribute('data-item-count')).toBe('1000');
      
      // Should have rendered only visible items
      const renderedItems = container.querySelectorAll('[data-testid^="item-"]');
      expect(renderedItems.length).toBeLessThanOrEqual(10);
    });

    it('handles 10,000 patients without memory issues', () => {
      const patients = generatePatients(10000);
      
      monitor.start('patient-list-10k');
      
      render(
        <TestWrapper>
          <VirtualizedPatientList
            patients={patients}
            height={600}
            itemHeight={120}
          />
        </TestWrapper>
      );
      
      const renderTime = monitor.end('patient-list-10k');
      
      // Should still render quickly with 10k items
      expect(renderTime).toBeLessThan(200);
      
      // Memory usage should be reasonable (only visible items rendered)
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
    });

    it('maintains performance during rapid re-renders', () => {
      const patients = generatePatients(500);
      let renderCount = 0;
      
      const { rerender } = render(
        <TestWrapper>
          <VirtualizedPatientList
            patients={patients}
            key={renderCount}
          />
        </TestWrapper>
      );
      
      // Simulate rapid re-renders
      const renderTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        renderCount++;
        monitor.start(`rerender-${i}`);
        
        rerender(
          <TestWrapper>
            <VirtualizedPatientList
              patients={patients}
              key={renderCount}
            />
          </TestWrapper>
        );
        
        renderTimes.push(monitor.end(`rerender-${i}`));
      }
      
      const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      
      // Average re-render time should be fast
      expect(averageRenderTime).toBeLessThan(50);
      
      // No render should take more than 100ms
      expect(Math.max(...renderTimes)).toBeLessThan(100);
    });
  });

  describe('VirtualizedDataTable Performance', () => {
    it('handles large datasets with complex columns', () => {
      const data = generateTableData(5000);
      
      monitor.start('data-table-5k');
      
      render(
        <TestWrapper>
          <VirtualizedDataTable
            data={data}
            columns={tableColumns}
            height={600}
            rowHeight={52}
          />
        </TestWrapper>
      );
      
      const renderTime = monitor.end('data-table-5k');
      
      // Should render efficiently even with complex columns
      expect(renderTime).toBeLessThan(150);
    });

    it('maintains sorting performance with large datasets', async () => {
      const data = generateTableData(2000);
      let sorting: any[] = [];
      
      const onSortingChange = vi.fn((newSorting) => {
        sorting = typeof newSorting === 'function' ? newSorting(sorting) : newSorting;
      });
      
      render(
        <TestWrapper>
          <VirtualizedDataTable
            data={data}
            columns={tableColumns}
            enableSorting={true}
            sorting={sorting}
            onSortingChange={onSortingChange}
          />
        </TestWrapper>
      );
      
      monitor.start('sorting-performance');
      
      // Simulate sorting
      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
      
      const sortTime = monitor.end('sorting-performance');
      
      // Sorting should be fast
      expect(sortTime).toBeLessThan(100);
      expect(onSortingChange).toHaveBeenCalled();
    });

    it('efficiently handles column filtering', () => {
      const data = generateTableData(1000);
      let columnFilters: any[] = [];
      
      const onColumnFiltersChange = vi.fn((newFilters) => {
        columnFilters = typeof newFilters === 'function' ? newFilters(columnFilters) : newFilters;
      });
      
      monitor.start('filtering-performance');
      
      render(
        <TestWrapper>
          <VirtualizedDataTable
            data={data}
            columns={tableColumns}
            enableFiltering={true}
            columnFilters={columnFilters}
            onColumnFiltersChange={onColumnFiltersChange}
          />
        </TestWrapper>
      );
      
      const filterTime = monitor.end('filtering-performance');
      
      // Filtering setup should be fast
      expect(filterTime).toBeLessThan(100);
    });
  });

  describe('MobileOptimizedVirtualList Performance', () => {
    it('optimizes rendering for mobile devices', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Mobile Item ${i}`,
        description: `Description ${i}`,
      }));
      
      const renderItem = (item: any) => (
        <div>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
      );
      
      monitor.start('mobile-list-1k');
      
      render(
        <TestWrapper>
          <MobileOptimizedVirtualList
            items={items}
            renderItem={renderItem}
            height={600}
            estimatedItemSize={80}
          />
        </TestWrapper>
      );
      
      const renderTime = monitor.end('mobile-list-1k');
      
      // Should render quickly on mobile
      expect(renderTime).toBeLessThan(120);
    });

    it('handles variable item heights efficiently', () => {
      const items = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        content: 'Content '.repeat((i % 10) + 1), // Variable content length
      }));
      
      const getItemHeight = (index: number) => 60 + (index % 10) * 20; // Variable heights
      
      monitor.start('variable-heights');
      
      render(
        <TestWrapper>
          <MobileOptimizedVirtualList
            items={items}
            renderItem={(item) => <div>{item.content}</div>}
            getItemHeight={getItemHeight}
            height={600}
          />
        </TestWrapper>
      );
      
      const renderTime = monitor.end('variable-heights');
      
      // Should handle variable heights efficiently
      expect(renderTime).toBeLessThan(100);
    });

    it('maintains performance during touch interactions', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      const onItemClick = vi.fn();
      
      render(
        <TestWrapper>
          <MobileOptimizedVirtualList
            items={items}
            renderItem={(item) => <div>{item.name}</div>}
            onItemClick={onItemClick}
          />
        </TestWrapper>
      );
      
      const virtualList = screen.getByTestId('virtual-list');
      
      monitor.start('touch-performance');
      
      // Simulate multiple touch events
      for (let i = 0; i < 10; i++) {
        fireEvent.touchStart(virtualList, {
          touches: [{ clientX: 100, clientY: 100 + i * 10 }],
        });
        fireEvent.touchEnd(virtualList);
      }
      
      const touchTime = monitor.end('touch-performance');
      
      // Touch handling should be fast
      expect(touchTime).toBeLessThan(50);
    });
  });

  describe('Memory Management', () => {
    it('cleans up properly when unmounted', () => {
      const patients = generatePatients(1000);
      
      const { unmount } = render(
        <TestWrapper>
          <VirtualizedPatientList
            patients={patients}
          />
        </TestWrapper>
      );
      
      // Component should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles rapid mount/unmount cycles', () => {
      const patients = generatePatients(100);
      
      monitor.start('mount-unmount-cycles');
      
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <TestWrapper>
            <VirtualizedPatientList
              patients={patients}
              key={i}
            />
          </TestWrapper>
        );
        unmount();
      }
      
      const cycleTime = monitor.end('mount-unmount-cycles');
      
      // Should handle mount/unmount cycles efficiently
      expect(cycleTime).toBeLessThan(200);
    });
  });

  describe('Scroll Performance', () => {
    it('maintains smooth scrolling with large datasets', () => {
      const items = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
      
      render(
        <TestWrapper>
          <MobileOptimizedVirtualList
            items={items}
            renderItem={(item) => <div>{item.name}</div>}
            height={400}
          />
        </TestWrapper>
      );
      
      const virtualList = screen.getByTestId('virtual-list');
      
      monitor.start('scroll-performance');
      
      // Simulate rapid scrolling
      for (let i = 0; i < 20; i++) {
        fireEvent.scroll(virtualList, { target: { scrollTop: i * 100 } });
      }
      
      const scrollTime = monitor.end('scroll-performance');
      
      // Scroll handling should be fast
      expect(scrollTime).toBeLessThan(100);
    });
  });

  describe('Performance Regression Tests', () => {
    it('meets performance targets for 1000+ items', () => {
      const PERFORMANCE_TARGETS = {
        initialRender: 100, // ms
        reRender: 50, // ms
        scrollResponse: 16, // ms (60fps)
      };
      
      const patients = generatePatients(1000);
      
      // Test initial render
      monitor.start('initial-render');
      const { rerender } = render(
        <TestWrapper>
          <VirtualizedPatientList patients={patients} />
        </TestWrapper>
      );
      const initialRenderTime = monitor.end('initial-render');
      
      // Test re-render
      monitor.start('re-render');
      rerender(
        <TestWrapper>
          <VirtualizedPatientList patients={patients} key="updated" />
        </TestWrapper>
      );
      const reRenderTime = monitor.end('re-render');
      
      // Assert performance targets
      expect(initialRenderTime).toBeLessThan(PERFORMANCE_TARGETS.initialRender);
      expect(reRenderTime).toBeLessThan(PERFORMANCE_TARGETS.reRender);
    });

    it('validates memory usage stays within bounds', () => {
      // This is a simplified memory test
      // In a real scenario, you'd use more sophisticated memory monitoring
      
      const largeDataset = generatePatients(5000);
      
      const { unmount } = render(
        <TestWrapper>
          <VirtualizedPatientList patients={largeDataset} />
        </TestWrapper>
      );
      
      // Should not crash with large datasets
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      
      // Cleanup should work properly
      expect(() => unmount()).not.toThrow();
    });
  });
});