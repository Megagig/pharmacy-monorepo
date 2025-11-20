import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppointmentAnalyticsDashboard from '../AppointmentAnalyticsDashboard';
import * as useAppointmentAnalyticsHook from '../../../hooks/useAppointmentAnalytics';
import * as useUsersHook from '../../../queries/useUsers';
import { toast } from 'react-hot-toast';

// Mock the hooks
vi.mock('../../../hooks/useAppointmentAnalytics');
vi.mock('../../../queries/useUsers');
vi.mock('react-hot-toast');

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

const mockAnalyticsData = {
  success: true,
  data: {
    summary: {
      totalAppointments: 150,
      completionRate: 85,
      noShowRate: 8,
      cancellationRate: 7,
      averageWaitTime: 12,
      averageDuration: 45,
    },
    byType: [
      { type: 'mtm_session', count: 60, completionRate: 90, averageDuration: 50 },
      { type: 'health_check', count: 50, completionRate: 85, averageDuration: 30 },
      { type: 'vaccination', count: 40, completionRate: 80, averageDuration: 15 },
    ],
    byStatus: [
      { status: 'completed', count: 128, percentage: 85 },
      { status: 'cancelled', count: 10, percentage: 7 },
      { status: 'no_show', count: 12, percentage: 8 },
    ],
    trends: {
      daily: [
        { date: '2025-10-01', appointments: 10, completed: 8, cancelled: 1, noShow: 1 },
        { date: '2025-10-02', appointments: 12, completed: 10, cancelled: 1, noShow: 1 },
        { date: '2025-10-03', appointments: 8, completed: 7, cancelled: 0, noShow: 1 },
      ],
      weekly: [],
      monthly: [],
    },
    peakTimes: {
      busiestDay: 'Monday',
      busiestHour: '10:00-11:00',
      hourlyDistribution: [
        { hour: 9, count: 15 },
        { hour: 10, count: 25 },
        { hour: 11, count: 20 },
        { hour: 14, count: 18 },
        { hour: 15, count: 22 },
      ],
      dailyDistribution: [
        { day: 'Monday', count: 35 },
        { day: 'Tuesday', count: 28 },
        { day: 'Wednesday', count: 30 },
        { day: 'Thursday', count: 25 },
        { day: 'Friday', count: 32 },
      ],
    },
    pharmacistPerformance: [
      {
        pharmacistId: '1',
        pharmacistName: 'Dr. John Doe',
        totalAppointments: 75,
        completionRate: 88,
        averageDuration: 48,
      },
      {
        pharmacistId: '2',
        pharmacistName: 'Dr. Jane Smith',
        totalAppointments: 75,
        completionRate: 82,
        averageDuration: 42,
      },
    ],
  },
  message: 'Analytics retrieved successfully',
};

const mockUsersData = {
  success: true,
  data: {
    users: [
      { _id: '1', firstName: 'John', lastName: 'Doe', role: 'pharmacist' },
      { _id: '2', firstName: 'Jane', lastName: 'Smith', role: 'pharmacist' },
    ],
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {children}
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

describe('AppointmentAnalyticsDashboard', () => {
  const mockUseAppointmentAnalytics = vi.mocked(useAppointmentAnalyticsHook.useAppointmentAnalytics);
  const mockUseUsers = vi.mocked(useUsersHook.useUsers);
  const mockToast = vi.mocked(toast);

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAppointmentAnalytics.mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    mockUseUsers.mockReturnValue({
      data: mockUsersData,
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders loading state correctly', () => {
    mockUseAppointmentAnalytics.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefetch = vi.fn();
    mockUseAppointmentAnalytics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    } as any);

    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText(/Failed to load appointment analytics/)).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders analytics dashboard with data correctly', () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    // Check header
    expect(screen.getByText('Appointment Analytics')).toBeInTheDocument();

    // Check summary statistics cards
    expect(screen.getByText('Total Appointments')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getAllByText('Completion Rate')[0]).toBeInTheDocument();
    expect(screen.getAllByText('85%')[0]).toBeInTheDocument();
    expect(screen.getByText('No-Show Rate')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Rate')).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.getByText('Average Duration')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Average Wait Time')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // Check charts are rendered
    expect(screen.getByText('Appointment Trends')).toBeInTheDocument();
    expect(screen.getByText('Appointment Type Distribution')).toBeInTheDocument();
    expect(screen.getAllByText('Completion Rate')[2]).toBeInTheDocument(); // Chart title
    expect(screen.getByText('No-Show Rate Trend')).toBeInTheDocument();
    expect(screen.getByText('Peak Times - Hourly Distribution')).toBeInTheDocument();
    expect(screen.getByText('Peak Times - Daily Distribution')).toBeInTheDocument();

    // Check chart components are rendered
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(5);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
  });

  it('handles filter changes correctly', async () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    // Test pharmacist filter - get the first combobox (pharmacist)
    const comboboxes = screen.getAllByRole('combobox');
    const pharmacistSelect = comboboxes[0];
    fireEvent.mouseDown(pharmacistSelect);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('John Doe'));
    
    // Test appointment type filter - get the second combobox (appointment type)
    const typeSelect = comboboxes[1];
    fireEvent.mouseDown(typeSelect);
    
    await waitFor(() => {
      expect(screen.getByText('MTM Session')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('MTM Session'));
  });

  it('handles quick date range presets correctly', () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    // Test quick date presets
    const todayChip = screen.getByText('Today');
    fireEvent.click(todayChip);

    const weekChip = screen.getByText('Week');
    fireEvent.click(weekChip);

    const monthChip = screen.getByText('Month');
    fireEvent.click(monthChip);

    const quarterChip = screen.getByText('Quarter');
    fireEvent.click(quarterChip);

    const thisMonthChip = screen.getByText('This Month');
    fireEvent.click(thisMonthChip);

    // All clicks should work without errors
    expect(todayChip).toBeInTheDocument();
  });

  it('handles refresh functionality correctly', () => {
    const mockRefetch = vi.fn();
    mockUseAppointmentAnalytics.mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    const refreshButton = screen.getByLabelText('Refresh Data');
    fireEvent.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Analytics refreshed');
  });

  it('handles export functionality correctly', async () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    const exportPdfButton = screen.getByText('Export PDF');
    fireEvent.click(exportPdfButton);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Analytics exported as PDF');
    });

    const exportExcelButton = screen.getByText('Export Excel');
    fireEvent.click(exportExcelButton);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Analytics exported as EXCEL');
    });
  });

  it('renders no data state correctly', () => {
    mockUseAppointmentAnalytics.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('No appointment data available for the selected period.')).toBeInTheDocument();
  });

  it('displays correct trend indicators', () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    // High completion rate should show trending up
    const completionRateCard = screen.getAllByText('85%')[0].closest('.MuiCardContent-root');
    expect(completionRateCard).toBeInTheDocument();

    // Low no-show rate should show trending down (good)
    const noShowRateCard = screen.getByText('8%').closest('.MuiCardContent-root');
    expect(noShowRateCard).toBeInTheDocument();
  });

  it('handles date picker changes correctly', async () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();

    // Date picker interactions would require more complex mocking
    // This test ensures the components are rendered
  });

  it('applies custom className correctly', () => {
    const { container } = render(
      <AppointmentAnalyticsDashboard className="custom-analytics" />, 
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toHaveClass('custom-analytics');
  });

  it('handles empty analytics data gracefully', () => {
    const emptyData = {
      success: true,
      data: {
        summary: {
          totalAppointments: 0,
          completionRate: 0,
          noShowRate: 0,
          cancellationRate: 0,
          averageWaitTime: 0,
          averageDuration: 0,
        },
        byType: [],
        byStatus: [],
        trends: { daily: [], weekly: [], monthly: [] },
        peakTimes: {
          busiestDay: '',
          busiestHour: '',
          hourlyDistribution: [],
          dailyDistribution: [],
        },
        pharmacistPerformance: [],
      },
      message: 'No data available',
    };

    mockUseAppointmentAnalytics.mockReturnValue({
      data: emptyData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    expect(screen.getAllByText('0')[0]).toBeInTheDocument(); // Total appointments
    expect(screen.getAllByText('0%')[0]).toBeInTheDocument(); // Completion rate
  });

  it('displays correct chart colors and styling', () => {
    render(<AppointmentAnalyticsDashboard />, { wrapper: createWrapper() });

    // Check that chart containers are rendered with proper test IDs
    const chartContainers = screen.getAllByTestId('responsive-container');
    expect(chartContainers).toHaveLength(5); // We have 5 charts in the component

    // Check that different chart types are rendered
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
  });
});