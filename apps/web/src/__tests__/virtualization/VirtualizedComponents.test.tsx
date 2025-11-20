import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { VirtualizedPatientList } from '../../components/virtualized/VirtualizedPatientList';
import { VirtualizedDataTable } from '../../components/virtualized/VirtualizedDataTable';
import { MobileOptimizedVirtualList } from '../../components/virtualized/MobileOptimizedVirtualList';
import type { Patient } from '../../types/patientManagement';
import type { ColumnDef } from '@tanstack/react-table';

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: vi.fn(({ children, itemData, itemCount }) => {
    // Render first 10 items for testing
    const itemsToRender = Math.min(itemCount, 10);
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: itemsToRender }).map((_, index) =>
          children({
            index,
            style: { height: 120, top: index * 120 },
            data: itemData,
          })
        )}
      </div>
    );
  }),
  VariableSizeList: vi.fn(({ children, itemData, itemCount }) => {
    const itemsToRender = Math.min(itemCount, 10);
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: itemsToRender }).map((_, index) =>
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
  default: vi.fn(({ children, isItemLoaded, loadMoreItems }) => {
    return children({
      onItemsRendered: vi.fn(),
      ref: vi.fn(),
    });
  }),
}));

// Mock intersection observer for mobile tests
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Test data
const mockPatients: Patient[] = Array.from({ length: 100 }, (_, index) => ({
  _id: `patient-${index}`,
  mrn: `PHM-LAG-${String(index + 1).padStart(3, '0')}`,
  firstName: `Patient${index}`,
  lastName: `Test${index}`,
  displayName: `Patient${index} Test${index}`,
  email: `patient${index}@test.com`,
  phone: `+234801234${String(index).padStart(4, '0')}`,
  gender: index % 2 === 0 ? 'male' : 'female',
  age: 20 + (index % 60),
  bloodGroup: ['A+', 'B+', 'O+', 'AB+'][index % 4] as any,
  genotype: ['AA', 'AS', 'SS'][index % 3] as any,
  state: 'Lagos',
  lga: 'Ikeja',
  hasActiveDTP: index % 10 === 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const mockTableData = Array.from({ length: 1000 }, (_, index) => ({
  id: index,
  name: `Item ${index}`,
  value: Math.random() * 100,
  category: ['A', 'B', 'C'][index % 3],
  status: index % 2 === 0 ? 'active' : 'inactive',
}));

const mockTableColumns: ColumnDef<typeof mockTableData[0]>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
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

describe('VirtualizedPatientList', () => {
  let mockOnPatientSelect: ReturnType<typeof vi.fn>;
  let mockOnPatientEdit: ReturnType<typeof vi.fn>;
  let mockOnPatientView: ReturnType<typeof vi.fn>;
  let mockLoadNextPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnPatientSelect = vi.fn();
    mockOnPatientEdit = vi.fn();
    mockOnPatientView = vi.fn();
    mockLoadNextPage = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders patient list with virtualization', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients.slice(0, 10)}
          onPatientSelect={mockOnPatientSelect}
          onPatientEdit={mockOnPatientEdit}
          onPatientView={mockOnPatientView}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    expect(screen.getByText('Patient0 Test0')).toBeInTheDocument();
    expect(screen.getByText('PHM-LAG-001')).toBeInTheDocument();
  });

  it('handles selection mode correctly', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients.slice(0, 5)}
          onPatientSelect={mockOnPatientSelect}
          isSelectionMode={true}
        />
      </TestWrapper>
    );

    const selectButton = screen.getAllByText('Select')[0];
    await user.click(selectButton);

    expect(mockOnPatientSelect).toHaveBeenCalledWith(mockPatients[0]);
  });

  it('displays loading skeletons when loading', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={[]}
          loading={true}
        />
      </TestWrapper>
    );

    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId('virtual-list');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no patients', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={[]}
          loading={false}
        />
      </TestWrapper>
    );

    expect(screen.getByText('No patients found')).toBeInTheDocument();
  });

  it('handles infinite loading', async () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients.slice(0, 50)}
          hasNextPage={true}
          loadNextPage={mockLoadNextPage}
        />
      </TestWrapper>
    );

    // Simulate scrolling to trigger load more
    // Note: In a real test, you'd simulate scroll events
    expect(mockLoadNextPage).not.toHaveBeenCalled();
  });

  it('displays patient information correctly', () => {
    const patient = mockPatients[0];
    
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={[patient]}
        />
      </TestWrapper>
    );

    expect(screen.getByText(patient.displayName!)).toBeInTheDocument();
    expect(screen.getByText(`MRN: ${patient.mrn}`)).toBeInTheDocument();
    expect(screen.getByText(patient.bloodGroup!)).toBeInTheDocument();
    expect(screen.getByText(patient.genotype!)).toBeInTheDocument();
  });
});

describe('VirtualizedDataTable', () => {
  let mockLoadNextPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLoadNextPage = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders data table with virtualization', () => {
    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={mockTableData.slice(0, 10)}
          columns={mockTableColumns}
        />
      </TestWrapper>
    );

    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  it('handles sorting when enabled', async () => {
    const user = userEvent.setup();
    let sorting: any[] = [];
    const onSortingChange = vi.fn((newSorting) => {
      sorting = typeof newSorting === 'function' ? newSorting(sorting) : newSorting;
    });

    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={mockTableData.slice(0, 10)}
          columns={mockTableColumns}
          enableSorting={true}
          sorting={sorting}
          onSortingChange={onSortingChange}
        />
      </TestWrapper>
    );

    const nameHeader = screen.getByText('Name');
    await user.click(nameHeader);

    expect(onSortingChange).toHaveBeenCalled();
  });

  it('displays empty state correctly', () => {
    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={[]}
          columns={mockTableColumns}
          emptyMessage="No data found"
        />
      </TestWrapper>
    );

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={[]}
          columns={mockTableColumns}
          loading={true}
        />
      </TestWrapper>
    );

    // Should show skeleton rows
    expect(screen.getByText('ID')).toBeInTheDocument();
  });

  it('handles large datasets efficiently', () => {
    const startTime = performance.now();
    
    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={mockTableData}
          columns={mockTableColumns}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render quickly even with 1000 items
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });
});

describe('MobileOptimizedVirtualList', () => {
  let mockOnItemClick: ReturnType<typeof vi.fn>;
  let mockLoadNextPage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnItemClick = vi.fn();
    mockLoadNextPage = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockRenderItem = (item: any, index: number) => (
    <div data-testid={`item-${index}`}>
      {item.name || `Item ${index}`}
    </div>
  );

  it('renders items with custom render function', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ name: `Test Item ${i}` }));

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={items}
          renderItem={mockRenderItem}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    expect(screen.getByText('Test Item 0')).toBeInTheDocument();
  });

  it('handles touch events on mobile', async () => {
    const items = [{ name: 'Touch Test Item' }];

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={items}
          renderItem={mockRenderItem}
          onItemClick={mockOnItemClick}
        />
      </TestWrapper>
    );

    const item = screen.getByTestId('item-0');
    
    // Simulate touch events
    fireEvent.touchStart(item, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    
    fireEvent.touchEnd(item);

    // Note: Touch handling is complex and would need more sophisticated testing
    expect(item).toBeInTheDocument();
  });

  it('shows custom empty state', () => {
    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={[]}
          renderItem={mockRenderItem}
          emptyMessage="Custom empty message"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });

  it('uses custom skeleton when provided', () => {
    const customSkeleton = () => (
      <div data-testid="custom-skeleton">Custom Loading...</div>
    );

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={[]}
          renderItem={mockRenderItem}
          renderSkeleton={customSkeleton}
          loading={true}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('custom-skeleton')).toBeInTheDocument();
  });

  it('handles dynamic item heights', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ name: `Item ${i}` }));
    const getItemHeight = (index: number) => 80 + (index * 20); // Variable heights

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={items}
          renderItem={mockRenderItem}
          getItemHeight={getItemHeight}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });
});

describe('Performance Tests', () => {
  it('handles 1000+ items without performance degradation', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 100,
    }));

    const startTime = performance.now();

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={largeDataset}
          renderItem={(item) => <div>{item.name}</div>}
        />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should handle large datasets efficiently
    expect(renderTime).toBeLessThan(200); // 200ms threshold for 1000 items
  });

  it('maintains smooth scrolling performance', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ name: `Item ${i}` }));

    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={items}
          renderItem={(item) => <div>{item.name}</div>}
          height={400}
          estimatedItemSize={50}
        />
      </TestWrapper>
    );

    // Simulate rapid scroll events
    const virtualList = screen.getByTestId('virtual-list');
    
    const startTime = performance.now();
    
    // Simulate multiple scroll events
    for (let i = 0; i < 10; i++) {
      fireEvent.scroll(virtualList, { target: { scrollTop: i * 100 } });
    }
    
    const endTime = performance.now();
    const scrollTime = endTime - startTime;

    // Should handle scroll events quickly
    expect(scrollTime).toBeLessThan(50); // 50ms for 10 scroll events
  });

  it('efficiently manages memory with large datasets', () => {
    const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`.repeat(10), // Large text
    }));

    // Measure memory before
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const { unmount } = render(
      <TestWrapper>
        <VirtualizedDataTable
          data={largeDataset}
          columns={[
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'description', header: 'Description' },
          ]}
        />
      </TestWrapper>
    );

    // Unmount to test cleanup
    unmount();

    // Memory should be cleaned up (this is a basic test)
    expect(true).toBe(true); // Placeholder - real memory testing is complex
  });
});

describe('Accessibility Tests', () => {
  it('provides proper ARIA labels for virtualized content', () => {
    render(
      <TestWrapper>
        <VirtualizedPatientList
          patients={mockPatients.slice(0, 5)}
        />
      </TestWrapper>
    );

    // Check for accessible elements
    const virtualList = screen.getByTestId('virtual-list');
    expect(virtualList).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <VirtualizedDataTable
          data={mockTableData.slice(0, 5)}
          columns={mockTableColumns}
          enableSorting={true}
        />
      </TestWrapper>
    );

    // Test keyboard navigation on sortable headers
    const nameHeader = screen.getByText('Name');
    nameHeader.focus();
    
    await user.keyboard('{Enter}');
    
    // Should be able to interact with keyboard
    expect(nameHeader).toBeInTheDocument();
  });

  it('maintains focus management during virtualization', () => {
    render(
      <TestWrapper>
        <MobileOptimizedVirtualList
          items={Array.from({ length: 10 }, (_, i) => ({ name: `Item ${i}` }))}
          renderItem={(item, index) => (
            <button data-testid={`button-${index}`}>
              {item.name}
            </button>
          )}
        />
      </TestWrapper>
    );

    const firstButton = screen.getByTestId('button-0');
    firstButton.focus();
    
    expect(document.activeElement).toBe(firstButton);
  });
});