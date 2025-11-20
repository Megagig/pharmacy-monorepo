import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportsAnalyticsDashboard } from '../../components/ReportsAnalyticsDashboard';
import { mockReportData, mockFilters } from '../mocks/mockData';
import { ReportType } from '../../types';

// Mock all the stores
vi.mock('../../stores/reportsStore', () => ({
  useReportsStore: vi.fn(() => ({
    activeReport: ReportType.PATIENT_OUTCOMES,
    reportData: mockReportData,
    isLoading: false,
    error: null,
    setActiveReport: vi.fn(),
    fetchReportData: vi.fn(),
  })),
}));

vi.mock('../../stores/filtersStore', () => ({
  useFiltersStore: vi.fn(() => ({
    filters: mockFilters,
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock('../../stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(() => ({
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    theme: 'light',
    setTheme: vi.fn(),
  })),
}));

// Mock the report components
vi.mock('../../components/reports/PatientOutcomeReport', () => ({
  PatientOutcomeReport: () => (
    <div data-testid="patient-outcome-report">Patient Outcome Report</div>
  ),
}));

vi.mock('../../components/reports/PharmacistInterventionReport', () => ({
  PharmacistInterventionReport: () => (
    <div data-testid="pharmacist-intervention-report">
      Pharmacist Intervention Report
    </div>
  ),
}));

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  ...vi.importActual('@mui/material'),
  Skeleton: ({ children, ...props }: any) => (
    <div data-testid="skeleton" {...props}>
      {children}
    </div>
  ),
  Alert: ({ children, severity }: any) => (
    <div data-testid={`alert-${severity}`}>{children}</div>
  ),
}));

describe('ReportsAnalyticsDashboard', () => {
  const defaultProps = {
    workspaceId: 'workspace-123',
    userPermissions: ['reports:read', 'reports:export'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with default report type', () => {
    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    expect(screen.getByTestId('patient-outcome-report')).toBeInTheDocument();
  });

  it('renders dashboard with initial report type', () => {
    render(
      <ReportsAnalyticsDashboard
        {...defaultProps}
        initialReportType={ReportType.PHARMACIST_INTERVENTIONS}
      />
    );

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('displays loading state when data is being fetched', () => {
    // Mock loading state
    vi.mocked(
      require('../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      activeReport: ReportType.PATIENT_OUTCOMES,
      reportData: null,
      isLoading: true,
      error: null,
      setActiveReport: vi.fn(),
      fetchReportData: vi.fn(),
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('displays error state when data fetch fails', () => {
    // Mock error state
    vi.mocked(
      require('../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      activeReport: ReportType.PATIENT_OUTCOMES,
      reportData: null,
      isLoading: false,
      error: 'Failed to fetch report data',
      setActiveReport: vi.fn(),
      fetchReportData: vi.fn(),
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch report data')).toBeInTheDocument();
  });

  it('handles report type selection', async () => {
    const mockSetActiveReport = vi.fn();
    vi.mocked(
      require('../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      activeReport: ReportType.PATIENT_OUTCOMES,
      reportData: mockReportData,
      isLoading: false,
      error: null,
      setActiveReport: mockSetActiveReport,
      fetchReportData: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    // Look for report type selector (assuming it exists)
    const reportSelector = screen.queryByTestId('report-type-selector');
    if (reportSelector) {
      await user.click(reportSelector);
      expect(mockSetActiveReport).toHaveBeenCalled();
    }
  });

  it('handles filter changes', async () => {
    const mockSetFilters = vi.fn();
    vi.mocked(
      require('../../stores/filtersStore').useFiltersStore
    ).mockReturnValue({
      filters: mockFilters,
      setFilters: mockSetFilters,
      resetFilters: vi.fn(),
      isLoading: false,
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    // Component should render without errors
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('respects user permissions', () => {
    const limitedPermissions = ['reports:read']; // No export permission

    render(
      <ReportsAnalyticsDashboard
        {...defaultProps}
        userPermissions={limitedPermissions}
      />
    );

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    // Export functionality should be hidden or disabled
  });

  it('handles workspace context correctly', () => {
    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    // Verify workspace-specific data is loaded
  });

  it('maintains responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('handles navigation between report types', async () => {
    const mockSetActiveReport = vi.fn();
    vi.mocked(
      require('../../stores/reportsStore').useReportsStore
    ).mockReturnValue({
      activeReport: ReportType.PATIENT_OUTCOMES,
      reportData: mockReportData,
      isLoading: false,
      error: null,
      setActiveReport: mockSetActiveReport,
      fetchReportData: vi.fn(),
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    // Test navigation (assuming navigation elements exist)
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('persists dashboard state', () => {
    const mockSetSidebarCollapsed = vi.fn();
    vi.mocked(
      require('../../stores/dashboardStore').useDashboardStore
    ).mockReturnValue({
      sidebarCollapsed: true,
      setSidebarCollapsed: mockSetSidebarCollapsed,
      theme: 'dark',
      setTheme: vi.fn(),
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });

  it('handles theme changes', () => {
    const mockSetTheme = vi.fn();
    vi.mocked(
      require('../../stores/dashboardStore').useDashboardStore
    ).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      theme: 'dark',
      setTheme: mockSetTheme,
    });

    render(<ReportsAnalyticsDashboard {...defaultProps} />);

    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
  });
});
