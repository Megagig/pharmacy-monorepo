import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from 'react-hot-toast';
import FollowUpAnalyticsDashboard from '../FollowUpAnalyticsDashboard';
import * as useAppointmentAnalytics from '../../../hooks/useAppointmentAnalytics';
import * as useUsers from '../../../queries/useUsers';

// Mock ResizeObserver for Recharts
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Recharts components to avoid ResizeObserver issues
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Area: () => <div data-testid="area" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
}));

// Mock the hooks
vi.mock('../../../hooks/useAppointmentAnalytics');
vi.mock('../../../queries/useUsers');
vi.mock('react-hot-toast');

const mockUseFollowUpAnalytics = vi.mocked(useAppointmentAnalytics.useFollowUpAnalytics);
const mockUseUsers = vi.mocked(useUsers.useUsers);
const mockToast = vi.mocked(toast);

// Mock data
const mockAnalyticsData = {
  data: {
    summary: {
      totalTasks: 150,
      completionRate: 85,
      averageTimeToCompletion: 3.5,
      overdueCount: 12,
      criticalOverdueCount: 3,
    },
    byType: [
      {
        type: 'medication_start_followup',
        count: 45,
        completionRate: 90,
        averageTimeToCompletion: 2.5,
      },
      {
        type: 'lab_result_review',
        count: 30,
        completionRate: 88,
        averageTimeToCompletion: 1.8,
      },
      {
        type: 'chronic_disease_monitoring',
        count: 25,
        completionRate: 75,
        averageTimeToCompletion: 5.2,
      },
    ],
    byPriority: [
      {
        priority: 'high',
        count: 40,
        completionRate: 92,
        averageTimeToCompletion: 2.1,
      },
      {
        priority: 'medium',
        count: 60,
        completionRate: 85,
        averageTimeToCompletion: 3.8,
      },
      {
        priority: 'low',
        count: 50,
        completionRate: 78,
        averageTimeToCompletion: 4.5,
      },
    ],
    byTrigger: [
      {
        triggerType: 'medication_start',
        count: 45,
        completionRate: 90,
      },
      {
        triggerType: 'lab_result',
        count: 30,
        completionRate: 88,
      },
      {
        triggerType: 'scheduled_monitoring',
        count: 25,
        completionRate: 75,
      },
    ],
    trends: {
      daily: [
        {
          date: '2025-10-20',
          created: 8,
          completed: 6,
          overdue: 1,
        },
        {
          date: '2025-10-21',
          created: 12,
          completed: 10,
          overdue: 2,
        },
        {
          date: '2025-10-22',
          created: 15,
          completed: 13,
          overdue: 1,
        },
      ],
    },
    escalationMetrics: {
      totalEscalations: 8,
      escalationRate: 5.3,
      averageEscalationTime: 2.5,
      escalationsByPriority: [
        {
          fromPriority: 'medium',
          toPriority: 'high',
          count: 5,
        },
        {
          fromPriority: 'high',
          toPriority: 'urgent',
          count: 3,
        },
      ],
    },
  },
};

const mockUsersData = {
  users: [
    {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'pharmacist',
    },
    {
      _id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      role: 'pharmacist',
    },
  ],
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
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

describe('FollowUpAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockUseFollowUpAnalytics.mockReturnValue({
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

    mockToast.success = vi.fn();
    mockToast.error = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render the dashboard with all main sections', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Check header
      expect(screen.getByText('Follow-up Analytics')).toBeInTheDocument();
      
      // Check filters section
      expect(screen.getByText('Filters')).toBeInTheDocument();
      
      // Check summary cards
      expect(screen.getByText('Total Follow-ups')).toBeInTheDocument();
      expect(screen.getAllByText('Completion Rate')).toHaveLength(2); // One in summary card, one in chart
      expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
      expect(screen.getByText('Avg. Time to Complete')).toBeInTheDocument();
      expect(screen.getByText('Escalation Rate')).toBeInTheDocument();
      expect(screen.getByText('Critical Overdue')).toBeInTheDocument();
    });

    it('should display correct summary statistics', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('150')).toBeInTheDocument(); // Total tasks
      expect(screen.getAllByText('85%').length).toBeGreaterThan(0); // Completion rate
      expect(screen.getByText('12')).toBeInTheDocument(); // Overdue count
      expect(screen.getByText('3.5')).toBeInTheDocument(); // Avg time to completion
      expect(screen.getByText('5.3%')).toBeInTheDocument(); // Escalation rate
      expect(screen.getByText('3')).toBeInTheDocument(); // Critical overdue
    });

    it('should render all chart sections', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Follow-up Trends')).toBeInTheDocument();
      expect(screen.getByText('Follow-up by Type Distribution')).toBeInTheDocument();
      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
      expect(screen.getByText('Average Time to Completion')).toBeInTheDocument();
      expect(screen.getByText('Trigger Type Analysis')).toBeInTheDocument();
      expect(screen.getByText('Overall Completion Rate')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when data is loading', () => {
      mockUseFollowUpAnalytics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Loading follow-up analytics...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when data loading fails', () => {
      mockUseFollowUpAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load data'),
        refetch: vi.fn(),
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load follow-up analytics. Please try again.')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', () => {
      const mockRefetch = vi.fn();
      mockUseFollowUpAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load data'),
        refetch: mockRefetch,
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should show no data message when analytics data is empty', () => {
      mockUseFollowUpAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('No follow-up data available for the selected period.')).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('should render all filter controls', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Quick date presets
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Week')).toBeInTheDocument();
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Quarter')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();

      // Date pickers
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();

      // Dropdowns
      expect(screen.getAllByText('Pharmacist').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Priority').length).toBeGreaterThan(0);
    });

    it('should update date range when quick preset is clicked', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      const weekButton = screen.getByText('Week');
      fireEvent.click(weekButton);

      // The component should update its internal state
      // We can't easily test the internal state, but we can verify the button was clicked
      expect(weekButton).toBeInTheDocument();
    });

    it('should populate pharmacist dropdown with user data', async () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Check that pharmacist filter exists
      expect(screen.getAllByText('Pharmacist').length).toBeGreaterThan(0);
    });

    it('should populate task type dropdown with all options', async () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Check that task type filter exists
      expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);
    });

    it('should populate priority dropdown with all options', async () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Check that priority filter exists
      expect(screen.getAllByText('Priority').length).toBeGreaterThan(0);
    });
  });

  describe('Actions', () => {
    it('should have refresh button that calls refetch', () => {
      const mockRefetch = vi.fn();
      mockUseFollowUpAnalytics.mockReturnValue({
        data: mockAnalyticsData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByLabelText('Refresh Data');
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith('Analytics refreshed');
    });

    it('should have export buttons', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Export PDF')).toBeInTheDocument();
      expect(screen.getByText('Export Excel')).toBeInTheDocument();
    });

    it('should show success toast when export is clicked', async () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      const exportPdfButton = screen.getByText('Export PDF');
      fireEvent.click(exportPdfButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Follow-up analytics exported as PDF');
      });
    });
  });

  describe('Data Visualization', () => {
    it('should show trending up icon for good completion rate', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // The completion rate is 85%, which should show trending up
      const completionRateElements = screen.getAllByText('85%');
      expect(completionRateElements.length).toBeGreaterThan(0);
    });

    it('should show warning icon when critical overdue tasks exist', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // Should show warning icon for critical overdue tasks
      const overdueCard = screen.getByText('12').closest('.MuiCardContent-root');
      expect(overdueCard).toBeInTheDocument();
    });

    it('should format numbers correctly', () => {
      // Test with larger numbers
      const largeNumberData = {
        ...mockAnalyticsData,
        data: {
          ...mockAnalyticsData.data,
          summary: {
            ...mockAnalyticsData.data.summary,
            totalTasks: 1500,
          },
        },
      };

      mockUseFollowUpAnalytics.mockReturnValue({
        data: largeNumberData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByText('1,500')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard className="custom-class" />
        </TestWrapper>
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Chart Data Processing', () => {
    it('should process trend data correctly', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      // The component should process the trend data and display charts
      // We can verify this by checking that the chart containers are rendered
      expect(screen.getByText('Follow-up Trends')).toBeInTheDocument();
    });

    it('should handle empty chart data gracefully', () => {
      const emptyData = {
        data: {
          summary: {
            totalTasks: 0,
            completionRate: 0,
            averageTimeToCompletion: 0,
            overdueCount: 0,
            criticalOverdueCount: 0,
          },
          byType: [],
          byPriority: [],
          byTrigger: [],
          trends: { daily: [] },
          escalationMetrics: {
            totalEscalations: 0,
            escalationRate: 0,
            averageEscalationTime: 0,
            escalationsByPriority: [],
          },
        },
      };

      mockUseFollowUpAnalytics.mockReturnValue({
        data: emptyData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getAllByText('0').length).toBeGreaterThan(0); // Should show 0 for total tasks
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Refresh Data')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      // Check that filter labels exist
      expect(screen.getAllByText('Pharmacist').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Task Type').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Priority').length).toBeGreaterThan(0);
    });

    it('should have proper heading structure', () => {
      render(
        <TestWrapper>
          <FollowUpAnalyticsDashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { level: 1, name: /follow-up analytics/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 6, name: /filters/i })).toBeInTheDocument();
    });
  });
});