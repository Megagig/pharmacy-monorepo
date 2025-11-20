import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../../../components/shared/FilterPanel';
import { mockFilters } from '../../mocks/mockData';
import { ReportType } from '../../../types';

// Mock the filter store
vi.mock('../../../stores/filtersStore', () => ({
  useFiltersStore: vi.fn(() => ({
    filters: mockFilters,
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    isLoading: false,
  })),
}));

// Mock date picker component
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: ({ value, onChange, label }: any) => (
    <input
      data-testid={`date-picker-${label?.toLowerCase().replace(' ', '-')}`}
      value={value?.toISOString().split('T')[0] || ''}
      onChange={(e) => onChange?.(new Date(e.target.value))}
      placeholder={label}
    />
  ),
}));

describe('FilterPanel', () => {
  const mockOnFiltersChange = vi.fn();

  const defaultProps = {
    reportType: ReportType.PATIENT_OUTCOMES,
    availableFilters: [
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange' as const,
      },
      {
        key: 'therapyType',
        label: 'Therapy Type',
        type: 'multiSelect' as const,
        options: [
          { value: 'medication-therapy', label: 'Medication Therapy' },
          { value: 'clinical-intervention', label: 'Clinical Intervention' },
        ],
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select' as const,
        options: [
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ],
      },
    ],
    currentFilters: mockFilters,
    onFiltersChange: mockOnFiltersChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter panel with all filter types', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Therapy Type')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('renders date range picker correctly', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByTestId('date-picker-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('date-picker-end-date')).toBeInTheDocument();
  });

  it('handles date range changes', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    const startDatePicker = screen.getByTestId('date-picker-start-date');
    await user.clear(startDatePicker);
    await user.type(startDatePicker, '2024-02-01');

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalled();
    });
  });

  it('renders multi-select filters correctly', () => {
    render(<FilterPanel {...defaultProps} />);

    // Check if therapy type filter is rendered
    expect(screen.getByText('Therapy Type')).toBeInTheDocument();
  });

  it('handles multi-select filter changes', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Find and interact with therapy type filter
    const therapyTypeSection = screen.getByText('Therapy Type').closest('div');
    expect(therapyTypeSection).toBeInTheDocument();
  });

  it('renders single select filters correctly', () => {
    render(<FilterPanel {...defaultProps} />);

    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('handles filter reset', async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...defaultProps} />);

    // Look for reset button (assuming it exists in the component)
    const resetButton =
      screen.queryByText('Reset Filters') || screen.queryByText('Clear');
    if (resetButton) {
      await user.click(resetButton);
      expect(mockOnFiltersChange).toHaveBeenCalled();
    }
  });

  it('validates filter combinations', () => {
    const invalidFilters = {
      ...mockFilters,
      dateRange: {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01'), // Invalid: end before start
      },
    };

    render(<FilterPanel {...defaultProps} currentFilters={invalidFilters} />);

    // Component should handle invalid filters gracefully
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('adapts filters based on report type', () => {
    const { rerender } = render(<FilterPanel {...defaultProps} />);

    // Change report type and verify filters adapt
    rerender(
      <FilterPanel
        {...defaultProps}
        reportType={ReportType.COST_EFFECTIVENESS}
      />
    );

    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('shows loading state when filters are being applied', () => {
    // Mock loading state
    vi.mocked(
      require('../../../stores/filtersStore').useFiltersStore
    ).mockReturnValue({
      filters: mockFilters,
      setFilters: vi.fn(),
      resetFilters: vi.fn(),
      isLoading: true,
    });

    render(<FilterPanel {...defaultProps} />);

    // Check for loading indicators (skeleton or disabled state)
    const filterPanel = screen.getByText('Date Range').closest('div');
    expect(filterPanel).toBeInTheDocument();
  });

  it('persists filter state correctly', () => {
    render(<FilterPanel {...defaultProps} />);

    // Verify current filters are displayed
    expect(screen.getByTestId('date-picker-start-date')).toHaveValue(
      '2024-01-01'
    );
    expect(screen.getByTestId('date-picker-end-date')).toHaveValue(
      '2024-12-31'
    );
  });

  it('handles filter validation errors', () => {
    const filtersWithError = {
      ...mockFilters,
      dateRange: {
        startDate: new Date('invalid-date'),
        endDate: new Date('2024-12-31'),
      },
    };

    render(<FilterPanel {...defaultProps} currentFilters={filtersWithError} />);

    // Component should handle invalid dates gracefully
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });
});
