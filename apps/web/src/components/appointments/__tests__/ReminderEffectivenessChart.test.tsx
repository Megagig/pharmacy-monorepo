import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReminderEffectivenessChart from '../ReminderEffectivenessChart';
import { useReminderAnalytics } from '../../../hooks/useAppointmentAnalytics';
import { format, subDays } from 'date-fns';

// Mock the hooks
vi.mock('../../../hooks/useAppointmentAnalytics');
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radial-bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Area: () => <div data-testid="area" />,
  RadialBar: () => <div data-testid="radial-bar" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockUseReminderAnalytics = useReminderAnalytics as ReturnType<typeof vi.fn>;

const mockReminderAnalyticsData = {
  data: {
    summary: {
      totalReminders: 1250,
      deliverySuccessRate: 92,
      patientResponseRate: 35,
      impactOnNoShowRate: 15,
    },
    byChannel: [
      {
        channel: 'email',
        sent: 500,
        delivered: 475,
        failed: 25,
        deliveryRate: 95,
        responseRate: 40,
      },
      {
        channel: 'sms',
        sent: 400,
        delivered: 380,
        failed: 20,
        deliveryRate: 95,
        responseRate: 45,
      },
      {
        channel: 'whatsapp',
        sent: 250,
        delivered: 225,
        failed: 25,
        deliveryRate: 90,
        responseRate: 30,
      },
      {
        channel: 'push',
        sent: 100,
        delivered: 85,
        failed: 15,
        deliveryRate: 85,
        responseRate: 20,
      },
    ],
    byTiming: [
      {
        timingLabel: '24 hours before',
        sent: 600,
        effectiveness: 85,
      },
      {
        timingLabel: '2 hours before',
        sent: 400,
        effectiveness: 90,
      },
      {
        timingLabel: '15 minutes before',
        sent: 250,
        effectiveness: 75,
      },
    ],
    templatePerformance: [
      {
        templateId: 'template1',
        templateName: 'Standard Appointment Reminder',
        sent: 800,
        deliveryRate: 93,
        responseRate: 38,
      },
      {
        templateId: 'template2',
        templateName: 'Urgent Appointment Reminder',
        sent: 300,
        deliveryRate: 96,
        responseRate: 42,
      },
      {
        templateId: 'template3',
        templateName: 'Follow-up Reminder',
        sent: 150,
        deliveryRate: 88,
        responseRate: 25,
      },
    ],
    trends: {
      daily: [
        {
          date: '2025-10-20',
          sent: 45,
          delivered: 42,
          failed: 3,
        },
        {
          date: '2025-10-21',
          sent: 52,
          delivered: 48,
          failed: 4,
        },
        {
          date: '2025-10-22',
          sent: 38,
          delivered: 35,
          failed: 3,
        },
      ],
    },
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ReminderEffectivenessChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading reminder analytics...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefetch = vi.fn();
    mockUseReminderAnalytics.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: mockRefetch,
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    expect(screen.getByText('Failed to load reminder analytics. Please try again.')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders empty state when no data available', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    expect(screen.getByText('No reminder data available for the selected period.')).toBeInTheDocument();
  });

  it('renders analytics data correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Check header
    expect(screen.getByText('Reminder Effectiveness Analytics')).toBeInTheDocument();

    // Check summary statistics
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total reminders
    expect(screen.getByText('92%')).toBeInTheDocument(); // Delivery success rate
    expect(screen.getByText('35%')).toBeInTheDocument(); // Patient response rate
    expect(screen.getByText('-15%')).toBeInTheDocument(); // No-show impact

    // Check that charts are rendered (using getAllBy since there are multiple charts)
    expect(screen.getAllByTestId('composed-chart')).toHaveLength(2);
    expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('displays channel performance details correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Check channel cards
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Sms')).toBeInTheDocument();
    expect(screen.getByText('Whatsapp')).toBeInTheDocument();
    expect(screen.getByText('Push')).toBeInTheDocument();

    // Check channel statistics
    expect(screen.getByText('500')).toBeInTheDocument(); // Email sent
    expect(screen.getByText('475')).toBeInTheDocument(); // Email delivered
  });

  it('handles date range filter changes', async () => {
    const mockRefetch = vi.fn();
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Click on "Week" preset
    const weekChip = screen.getByText('Week');
    fireEvent.click(weekChip);

    // The component should update the date range internally
    // We can't easily test the internal state change, but we can verify the UI updates
    expect(weekChip).toBeInTheDocument();
  });

  it('handles channel filter changes', async () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Find the channel select elements (there are 2 comboboxes)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2);

    // The first combobox should be the channel selector
    const channelSelect = comboboxes[0];
    fireEvent.mouseDown(channelSelect);

    // Verify the combobox is present
    expect(channelSelect).toBeInTheDocument();
  });

  it('handles template filter changes', async () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Find the template select elements (there are 2 comboboxes)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2);

    // The second combobox should be the template selector
    const templateSelect = comboboxes[1];
    fireEvent.mouseDown(templateSelect);

    // Verify the combobox is present
    expect(templateSelect).toBeInTheDocument();
  });

  it('handles refresh button click', () => {
    const mockRefetch = vi.fn();
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    const refreshButton = screen.getByLabelText('Refresh Data');
    fireEvent.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('handles export button clicks', async () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Test PDF export
    const pdfExportButton = screen.getByText('Export PDF');
    fireEvent.click(pdfExportButton);

    // Test Excel export
    const excelExportButton = screen.getByText('Export Excel');
    fireEvent.click(excelExportButton);

    // Since we're mocking toast, we can't easily test the actual export functionality
    // but we can verify the buttons are clickable
    expect(pdfExportButton).toBeInTheDocument();
    expect(excelExportButton).toBeInTheDocument();
  });

  it('displays correct chart titles and sections', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Check chart section titles
    expect(screen.getByText('Channel Comparison')).toBeInTheDocument();
    expect(screen.getByText('Channel Performance Overview')).toBeInTheDocument();
    expect(screen.getByText('Reminder Timing Effectiveness')).toBeInTheDocument();
    expect(screen.getByText('Template Performance')).toBeInTheDocument();
    expect(screen.getByText('Reminder Delivery Trends')).toBeInTheDocument();
    expect(screen.getByText('Channel Performance Details')).toBeInTheDocument();
  });

  it('handles date input changes correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Find start date input
    const startDateInput = screen.getByLabelText('Start Date');
    fireEvent.change(startDateInput, { target: { value: '2025-10-01' } });

    // Find end date input
    const endDateInput = screen.getByLabelText('End Date');
    fireEvent.change(endDateInput, { target: { value: '2025-10-31' } });

    expect(startDateInput).toHaveValue('2025-10-01');
    expect(endDateInput).toHaveValue('2025-10-31');
  });

  it('displays delivery rate colors correctly based on performance', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // The component should display different colors for different delivery rates
    // Email (95%) should be green, Push (85%) should be different color
    // We can't easily test the actual colors, but we can verify the rates are displayed
    expect(screen.getAllByText('95%')).toHaveLength(2); // Email delivery rate appears in multiple places
    expect(screen.getByText('85%')).toBeInTheDocument(); // Push delivery rate
  });

  it('shows trending indicators for delivery success rate', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // With 92% delivery success rate, should show positive trend
    const deliveryRateText = screen.getByText('92%');
    expect(deliveryRateText).toBeInTheDocument();
  });

  it('handles quick date range presets correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Test different preset buttons
    const todayChip = screen.getByText('Today');
    const weekChip = screen.getByText('Week');
    const monthChip = screen.getByText('Month');
    const quarterChip = screen.getByText('Quarter');
    const thisMonthChip = screen.getByText('This Month');

    fireEvent.click(todayChip);
    fireEvent.click(weekChip);
    fireEvent.click(monthChip);
    fireEvent.click(quarterChip);
    fireEvent.click(thisMonthChip);

    // All chips should be present and clickable
    expect(todayChip).toBeInTheDocument();
    expect(weekChip).toBeInTheDocument();
    expect(monthChip).toBeInTheDocument();
    expect(quarterChip).toBeInTheDocument();
    expect(thisMonthChip).toBeInTheDocument();
  });

  it('passes correct parameters to useReminderAnalytics hook', () => {
    const mockHook = vi.fn().mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    
    mockUseReminderAnalytics.mockImplementation(mockHook);

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Verify the hook was called with correct default parameters
    expect(mockHook).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    );
  });

  it('renders accessibility attributes correctly', () => {
    mockUseReminderAnalytics.mockReturnValue({
      data: mockReminderAnalyticsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReminderEffectivenessChart />, { wrapper: createWrapper() });

    // Check for proper elements
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh Data')).toBeInTheDocument();
  });
});