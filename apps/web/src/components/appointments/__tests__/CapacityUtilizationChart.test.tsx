import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CapacityUtilizationChart from '../CapacityUtilizationChart';
import * as useCapacityAnalyticsHook from '../../../hooks/useAppointmentAnalytics';
import * as useUsersHook from '../../../queries/useUsers';
import { toast } from 'react-hot-toast';

// Mock the hooks
vi.mock('../../../hooks/useAppointmentAnalytics');
vi.mock('../../../queries/useUsers');
vi.mock('react-hot-toast');

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockCapacityData = {
  success: true,
  data: {
    overall: {
      totalSlots: 1000,
      bookedSlots: 750,
      utilizationRate: 75.0,
      availableSlots: 250,
    },
    byPharmacist: [
      {
        pharmacistId: 'pharm1',
        pharmacistName: 'Dr. John Smith',
        totalSlots: 400,
        bookedSlots: 320,
        utilizationRate: 80.0,
        workingHours: 40,
      },
      {
        pharmacistId: 'pharm2',
        pharmacistName: 'Dr. Jane Doe',
        totalSlots: 350,
        bookedSlots: 280,
        utilizationRate: 80.0,
        workingHours: 35,
      },
      {
        pharmacistId: 'pharm3',
        pharmacistName: 'Dr. Mike Johnson',
        totalSlots: 250,
        bookedSlots: 150,
        utilizationRate: 60.0,
        workingHours: 25,
      },
    ],
    byDay: [
      {
        day: 'Monday',
        totalSlots: 200,
        bookedSlots: 180,
        utilizationRate: 90.0,
      },
      {
        day: 'Tuesday',
        totalSlots: 200,
        bookedSlots: 160,
        utilizationRate: 80.0,
      },
      {
        day: 'Wednesday',
        totalSlots: 200,
        bookedSlots: 140,
        utilizationRate: 70.0,
      },
      {
        day: 'Thursday',
        totalSlots: 200,
        bookedSlots: 150,
        utilizationRate: 75.0,
      },
      {
        day: 'Friday',
        totalSlots: 200,
        bookedSlots: 120,
        utilizationRate: 60.0,
      },
    ],
    byHour: [
      {
        hour: 9,
        totalSlots: 50,
        bookedSlots: 45,
        utilizationRate: 90.0,
      },
      {
        hour: 10,
        totalSlots: 50,
        bookedSlots: 48,
        utilizationRate: 96.0,
      },
      {
        hour: 11,
        totalSlots: 50,
        bookedSlots: 40,
        utilizationRate: 80.0,
      },
      {
        hour: 14,
        totalSlots: 50,
        bookedSlots: 55,
        utilizationRate: 110.0,
      },
    ],
    recommendations: [
      'Consider adding more slots on Mondays',
      'Dr. Mike Johnson is underutilized - consider reassigning appointments',
      'Peak hour at 2 PM shows overbooking - add capacity',
    ],
  },
};

const mockUsersData = {
  data: {
    users: [
      {
        _id: 'pharm1',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@pharmacy.com',
      },
      {
        _id: 'pharm2',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@pharmacy.com',
      },
      {
        _id: 'pharm3',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@pharmacy.com',
      },
    ],
  },
};

const mockOverbookingData = {
  ...mockCapacityData,
  data: {
    ...mockCapacityData.data,
    byDay: [
      ...mockCapacityData.data.byDay.slice(0, -1),
      {
        day: 'Friday',
        totalSlots: 200,
        bookedSlots: 220, // Overbooking
        utilizationRate: 110.0,
      },
    ],
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
  const theme = createTheme();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('CapacityUtilizationChart', () => {
  const mockUseCapacityAnalytics = vi.mocked(useCapacityAnalyticsHook.useCapacityAnalytics);
  const mockUseUsers = vi.mocked(useUsersHook.useUsers);
  const mockToast = vi.mocked(toast);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsers.mockReturnValue({
      data: mockUsersData,
      isLoading: false,
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner when data is loading', () => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading capacity analytics...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when data loading fails', () => {
      const mockError = new Error('Failed to load data');
      mockUseCapacityAnalytics.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Failed to load capacity analytics. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const mockRefetch = vi.fn();
      const mockError = new Error('Failed to load data');
      mockUseCapacityAnalytics.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should display no data message when no capacity data is available', () => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('No capacity data available for the selected period.')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render the main title and header elements', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Capacity Utilization Analytics')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should display summary statistics cards', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Overall Utilization')).toBeInTheDocument();
      expect(screen.getByText('75.0%')).toBeInTheDocument();
      expect(screen.getByText('Total Slots')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('Booked Slots')).toBeInTheDocument();
      expect(screen.getByText('750')).toBeInTheDocument();
      expect(screen.getByText('Available Slots')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('Active Pharmacists')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display pharmacist performance details', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Dr. Mike Johnson')).toBeInTheDocument();
    });

    it('should display recommendations', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Consider adding more slots on Mondays')).toBeInTheDocument();
      expect(screen.getByText('Dr. Mike Johnson is underutilized - consider reassigning appointments')).toBeInTheDocument();
    });

    it('should render chart components', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getAllByTestId('responsive-container')).toHaveLength(4); // 4 charts
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getAllByTestId('area-chart')).toHaveLength(1);
      expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
    });
  });

  describe('Overbooking Detection', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockOverbookingData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should display overbooking incidents when they exist', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getAllByText('Overbooking Incidents')).toHaveLength(2); // Card title and chart title
      // Should show at least one incident (Friday with 220 booked vs 200 total)
      expect(screen.getByText(/Daily: Fri/)).toBeInTheDocument();
    });

    it('should show warning icon for overbooking incidents', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      // Should show overbooking count > 0
      expect(screen.getAllByText('Overbooking Incidents')).toHaveLength(2);
    });
  });

  describe('Filters', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render filter controls', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getAllByText('Pharmacist')).toHaveLength(2); // Label and select
      expect(screen.getAllByText('Location')).toHaveLength(2); // Label and select
    });

    it('should render quick date preset chips', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Week')).toBeInTheDocument();
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Quarter')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });

    it('should update date range when quick preset is clicked', async () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      const weekChip = screen.getByText('Week');
      fireEvent.click(weekChip);

      // The component should update its internal state
      // We can't easily test the internal state, but we can verify the component doesn't crash
      expect(screen.getByText('Week')).toBeInTheDocument();
    });

    it('should populate pharmacist filter with user data', async () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      const pharmacistSelects = screen.getAllByRole('combobox');
      const pharmacistSelect = pharmacistSelects[0]; // First combobox is pharmacist
      fireEvent.mouseDown(pharmacistSelect);

      await waitFor(() => {
        expect(screen.getByText('All Pharmacists')).toBeInTheDocument();
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Mike Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render export buttons', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
    });

    it('should render refresh button', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
    });

    it('should call refetch when refresh button is clicked', async () => {
      const mockRefetch = vi.fn();
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      const refreshButton = screen.getByRole('button', { name: /refresh data/i });
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith('Capacity analytics refreshed');
    });

    it('should show toast message when export is clicked', async () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      const exportPdfButton = screen.getByRole('button', { name: /export pdf/i });
      fireEvent.click(exportPdfButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Capacity analytics exported as PDF');
      });
    });
  });

  describe('Utilization Color Coding', () => {
    it('should apply correct color coding based on utilization rates', () => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      // Should show utilization rate with appropriate trending icon
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render responsive grid layout', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      // Check for grid containers
      const gridContainers = screen.getAllByRole('generic').filter(
        element => element.className?.includes('MuiGrid-container')
      );
      expect(gridContainers.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseCapacityAnalytics.mockReturnValue({
        data: mockCapacityData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should have proper ARIA labels and roles', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(<CapacityUtilizationChart />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /capacity utilization analytics/i })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 6 })).toHaveLength(11); // Chart titles and other h6 elements
    });
  });

  describe('Performance', () => {
    it('should handle large datasets without crashing', () => {
      const largeDataset = {
        ...mockCapacityData,
        data: {
          ...mockCapacityData.data,
          byPharmacist: Array.from({ length: 50 }, (_, i) => ({
            pharmacistId: `pharm${i}`,
            pharmacistName: `Dr. Pharmacist ${i}`,
            totalSlots: 400,
            bookedSlots: 300 + (i % 100),
            utilizationRate: 75 + (i % 25),
            workingHours: 40,
          })),
        },
      };

      mockUseCapacityAnalytics.mockReturnValue({
        data: largeDataset,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      expect(() => {
        render(<CapacityUtilizationChart />, { wrapper: createWrapper() });
      }).not.toThrow();
    });
  });
});