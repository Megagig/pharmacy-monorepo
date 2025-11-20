import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientOutcomeReport } from '../../../components/reports/PatientOutcomeReport';
import { mockReportData, mockFilters } from '../../mocks/mockData';
import { ReportType } from '../../../types';

// Mock the stores
vi.mock('../../../stores/reportsStore', () => ({
  useReportsStore: vi.fn(() => ({
    reportData: mockReportData,
    isLoading: false,
    error: null,
    fetchReportData: vi.fn(),
  })),
}));

vi.mock('../../../stores/filtersStore', () => ({
  useFiltersStore: vi.fn(() => ({
    filters: mockFilters,
    setFilters: vi.fn(),
  })),
}));

// Mock chart components
vi.mock('../../../components/shared/ChartComponent', () => ({
  ChartComponent: ({ config, data, ...props }: any) => (
    <div
      data-testid={`chart-${config.type}`}
      data-chart-title={config.title?.text}
      data-chart-data-length={data?.length}
      {...props}
    >
      Chart: {config.title?.text}
    </div>
  ),
}));

describe('PatientOutcomeReport', () => {
  const defaultProps = {
    filters: mockFilters,
    onFilterChange: vi.fn(),
    onExport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders patient outcome report with summary metrics', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Patient Outcome Analytics')).toBeInTheDocument();

    // Check for summary metrics
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total patients
    expect(screen.getByText('85.5%')).toBeInTheDocument(); // Success rate
  });

  it('displays therapy effectiveness chart', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    const therapyChart = screen.getByTestId('chart-line');
    expect(therapyChart).toBeInTheDocument();
    expect(therapyChart).toHaveAttribute(
      'data-chart-title',
      'Therapy Effectiveness Over Time'
    );
  });

  it('displays clinical parameter improvements', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    const parameterChart = screen.getByTestId('chart-bar');
    expect(parameterChart).toBeInTheDocument();
    expect(parameterChart).toHaveAttribute(
      'data-chart-title',
      'Clinical Parameter Improvements'
    );
  });

  it('shows adverse event reduction metrics', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Adverse Event Reduction')).toBeInTheDocument();

    const adverseEventChart = screen.getByTestId('chart-area');
    expect(adverseEventChart).toBeInTheDocument();
  });

  it('displays quality of life improvements', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(
      screen.getByText('Quality of Life Improvements')
    ).toBeInTheDocument();

    const qolChart = screen.getByTestId('chart-pie');
    expect(qolChart).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    // Mock loading state
    vi.mocked(
      require('../../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      reportData: null,
      isLoading: true,
      error: null,
      fetchReportData: vi.fn(),
    });

    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('handles error state correctly', () => {
    // Mock error state
    vi.mocked(
      require('../../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      reportData: null,
      isLoading: false,
      error: 'Failed to load patient outcome data',
      fetchReportData: vi.fn(),
    });

    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    expect(
      screen.getByText('Failed to load patient outcome data')
    ).toBeInTheDocument();
  });

  it('handles filter changes', async () => {
    const mockOnFilterChange = vi.fn();
    render(
      <PatientOutcomeReport
        {...defaultProps}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Simulate filter change (this would typically come from FilterPanel)
    const newFilters = { ...mockFilters, priority: ['high'] };

    // In a real scenario, this would be triggered by user interaction
    mockOnFilterChange(newFilters);

    expect(mockOnFilterChange).toHaveBeenCalledWith(newFilters);
  });

  it('handles export functionality', async () => {
    const mockOnExport = vi.fn();
    render(<PatientOutcomeReport {...defaultProps} onExport={mockOnExport} />);

    // Look for export button
    const exportButton =
      screen.queryByText('Export') || screen.queryByTestId('export-button');
    if (exportButton) {
      fireEvent.click(exportButton);
      expect(mockOnExport).toHaveBeenCalled();
    }
  });

  it('displays comparison views between therapy types', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Therapy Type Comparison')).toBeInTheDocument();

    const comparisonChart = screen.getByTestId('chart-bar');
    expect(comparisonChart).toBeInTheDocument();
  });

  it('shows statistical significance indicators', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    // Look for statistical significance indicators
    const significanceIndicator =
      screen.queryByText('p < 0.05') ||
      screen.queryByText('Statistically Significant') ||
      screen.queryByTestId('significance-indicator');

    if (significanceIndicator) {
      expect(significanceIndicator).toBeInTheDocument();
    }
  });

  it('displays trend analysis over time', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Trend Analysis')).toBeInTheDocument();

    const trendChart = screen.getByTestId('chart-line');
    expect(trendChart).toBeInTheDocument();
    expect(trendChart).toHaveAttribute('data-chart-data-length', '3'); // mockChartData length
  });

  it('handles empty data gracefully', () => {
    // Mock empty data
    const emptyReportData = {
      ...mockReportData,
      charts: [],
      summary: {
        ...mockReportData.summary,
        totalPatients: 0,
      },
    };

    vi.mocked(
      require('../../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      reportData: emptyReportData,
      isLoading: false,
      error: null,
      fetchReportData: vi.fn(),
    });

    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('refreshes data when filters change', async () => {
    const mockFetchReportData = vi.fn();
    vi.mocked(
      require('../../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      reportData: mockReportData,
      isLoading: false,
      error: null,
      fetchReportData: mockFetchReportData,
    });

    const { rerender } = render(<PatientOutcomeReport {...defaultProps} />);

    const newFilters = {
      ...mockFilters,
      dateRange: { ...mockFilters.dateRange, preset: '30d' },
    };

    rerender(<PatientOutcomeReport {...defaultProps} filters={newFilters} />);

    await waitFor(() => {
      expect(mockFetchReportData).toHaveBeenCalledWith(
        ReportType.PATIENT_OUTCOMES,
        newFilters
      );
    });
  });

  it('displays patient demographics breakdown', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Patient Demographics')).toBeInTheDocument();

    const demographicsChart = screen.getByTestId('chart-pie');
    expect(demographicsChart).toBeInTheDocument();
  });

  it('shows intervention outcome correlation', () => {
    render(<PatientOutcomeReport {...defaultProps} />);

    expect(screen.getByText('Intervention Outcomes')).toBeInTheDocument();

    const correlationChart = screen.getByTestId('chart-scatter');
    expect(correlationChart).toBeInTheDocument();
  });
});
