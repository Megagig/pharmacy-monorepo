import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AnalyticsReports from '../AnalyticsReports';
import * as useSaasSettingsModule from '../../../queries/useSaasSettings';

// Mock the useSaasSettings hook
const mockUseSaasSettings = {
  getSubscriptionAnalytics: jest.fn(),
  getPharmacyUsageReports: jest.fn(),
  getClinicalOutcomesReport: jest.fn(),
  exportReport: jest.fn(),
  scheduleReport: jest.fn(),
};

jest.mock('../../../queries/useSaasSettings', () => ({
  useSaasSettings: () => mockUseSaasSettings,
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM yyyy') return 'Jan 2024';
    if (formatStr === 'MMM dd, yyyy') return 'Jan 01, 2024';
    if (formatStr === 'yyyy-MM-dd') return '2024-01-01';
    return 'Jan 01, 2024';
  }),
  subDays: jest.fn((date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000)),
  startOfMonth: jest.fn((date) => new Date(date.getFullYear(), date.getMonth(), 1)),
  endOfMonth: jest.fn((date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockSubscriptionAnalytics = {
  mrr: 50000,
  arr: 600000,
  ltv: 2400,
  cac: 150,
  churnRate: 0.05,
  upgradeRate: 0.08,
  downgradeRate: 0.02,
  planDistribution: [
    {
      planName: 'Professional',
      count: 150,
      percentage: 60,
      revenue: 30000,
    },
    {
      planName: 'Enterprise',
      count: 100,
      percentage: 40,
      revenue: 20000,
    },
  ],
  revenueByPlan: [
    {
      planName: 'Professional',
      revenue: 30000,
      growth: 0.15,
    },
    {
      planName: 'Enterprise',
      revenue: 20000,
      growth: 0.08,
    },
  ],
  growthTrend: [
    {
      month: 'Jan 2024',
      mrr: 45000,
      subscribers: 200,
      churn: 0.04,
    },
  ],
};

const mockPharmacyReports = [
  {
    pharmacyId: 'pharmacy1',
    pharmacyName: 'Central Pharmacy',
    subscriptionPlan: 'Professional',
    prescriptionsProcessed: 1250,
    diagnosticsPerformed: 85,
    patientsManaged: 450,
    activeUsers: 12,
    lastActivity: '2024-01-01T12:00:00Z',
    clinicalOutcomes: {
      interventions: 25,
      adherenceImprovement: 15.5,
      costSavings: 5000,
    },
  },
  {
    pharmacyId: 'pharmacy2',
    pharmacyName: 'Downtown Pharmacy',
    subscriptionPlan: 'Enterprise',
    prescriptionsProcessed: 2100,
    diagnosticsPerformed: 150,
    patientsManaged: 780,
    activeUsers: 18,
    lastActivity: '2024-01-01T10:30:00Z',
    clinicalOutcomes: {
      interventions: 42,
      adherenceImprovement: 18.2,
      costSavings: 8500,
    },
  },
];

describe('AnalyticsReports Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseSaasSettings.getSubscriptionAnalytics.mockResolvedValue({
      success: true,
      data: mockSubscriptionAnalytics,
    });

    mockUseSaasSettings.getPharmacyUsageReports.mockResolvedValue({
      success: true,
      data: {
        reports: mockPharmacyReports,
      },
    });

    mockUseSaasSettings.getClinicalOutcomesReport.mockResolvedValue({
      success: true,
      data: {
        totalInterventions: 67,
        averageAdherenceImprovement: 16.85,
        totalCostSavings: 13500,
      },
    });
  });

  describe('Component Rendering', () => {
    it('renders analytics reports header', async () => {
      renderWithProviders(<AnalyticsReports />);

      expect(screen.getByText('Analytics & Reports')).toBeInTheDocument();
      expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('renders tab navigation', async () => {
      renderWithProviders(<AnalyticsReports />);

      expect(screen.getByText('Subscription Analytics')).toBeInTheDocument();
      expect(screen.getByText('Pharmacy Usage')).toBeInTheDocument();
      expect(screen.getByText('Clinical Outcomes')).toBeInTheDocument();
    });

    it('loads subscription analytics by default', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(mockUseSaasSettings.getSubscriptionAnalytics).toHaveBeenCalledWith({
          timeRange: '30d',
        });
      });
    });
  });

  describe('Subscription Analytics Tab', () => {
    it('displays subscription metrics cards', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(screen.getByText('Monthly Recurring Revenue')).toBeInTheDocument();
        expect(screen.getByText('Annual Recurring Revenue')).toBeInTheDocument();
        expect(screen.getByText('Churn Rate')).toBeInTheDocument();
        expect(screen.getByText('Customer LTV')).toBeInTheDocument();
      });

      // Check if values are displayed (formatted)
      expect(screen.getByText(/\$50,000/)).toBeInTheDocument(); // MRR
      expect(screen.getByText(/\$600,000/)).toBeInTheDocument(); // ARR
    });

    it('displays plan distribution table', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(screen.getByText('Subscription Plan Distribution')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Subscribers')).toBeInTheDocument();
      expect(screen.getByText('Percentage')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('displays revenue growth by plan', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(screen.getByText('Revenue Growth by Plan')).toBeInTheDocument();
      });
    });

    it('handles time range changes', async () => {
      renderWithProviders(<AnalyticsReports />);

      const timeRangeSelect = screen.getByLabelText('Time Range');
      fireEvent.mouseDown(timeRangeSelect);
      
      const sevenDaysOption = screen.getByText('Last 7 days');
      fireEvent.click(sevenDaysOption);

      await waitFor(() => {
        expect(mockUseSaasSettings.getSubscriptionAnalytics).toHaveBeenCalledWith({
          timeRange: '7d',
        });
      });
    });
  });

  describe('Pharmacy Usage Tab', () => {
    it('switches to pharmacy usage tab and loads data', async () => {
      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(mockUseSaasSettings.getPharmacyUsageReports).toHaveBeenCalledWith({
          timeRange: '30d',
        });
      });
    });

    it('displays pharmacy usage table', async () => {
      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(screen.getByText('Central Pharmacy')).toBeInTheDocument();
        expect(screen.getByText('Downtown Pharmacy')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Prescriptions')).toBeInTheDocument();
      expect(screen.getByText('Diagnostics')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('Interventions')).toBeInTheDocument();
    });

    it('displays pharmacy data correctly', async () => {
      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(screen.getByText('1,250')).toBeInTheDocument(); // Prescriptions
        expect(screen.getByText('85')).toBeInTheDocument(); // Diagnostics
        expect(screen.getByText('450')).toBeInTheDocument(); // Patients
        expect(screen.getByText('12')).toBeInTheDocument(); // Active Users
        expect(screen.getByText('25')).toBeInTheDocument(); // Interventions
      });
    });

    it('handles empty pharmacy data', async () => {
      mockUseSaasSettings.getPharmacyUsageReports.mockResolvedValue({
        success: true,
        data: { reports: [] },
      });

      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(screen.getByText('No pharmacy usage data available')).toBeInTheDocument();
      });
    });
  });

  describe('Clinical Outcomes Tab', () => {
    it('switches to clinical outcomes tab', async () => {
      renderWithProviders(<AnalyticsReports />);

      const clinicalTab = screen.getByText('Clinical Outcomes');
      fireEvent.click(clinicalTab);

      await waitFor(() => {
        expect(screen.getByText('Clinical Outcomes & Impact')).toBeInTheDocument();
      });
    });

    it('displays clinical outcomes metrics', async () => {
      renderWithProviders(<AnalyticsReports />);

      const clinicalTab = screen.getByText('Clinical Outcomes');
      fireEvent.click(clinicalTab);

      await waitFor(() => {
        expect(screen.getByText('Total Interventions')).toBeInTheDocument();
        expect(screen.getByText('Adherence Improvement')).toBeInTheDocument();
        expect(screen.getByText('Cost Savings')).toBeInTheDocument();
      });

      // Check calculated values
      expect(screen.getByText('67')).toBeInTheDocument(); // Total interventions
    });
  });

  describe('Export Functionality', () => {
    it('opens export dialog', async () => {
      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Analytics Report')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Format')).toBeInTheDocument();
      expect(screen.getByLabelText('Report Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('handles export format selection', async () => {
      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Format')).toBeInTheDocument();
      });

      const formatSelect = screen.getByLabelText('Format');
      fireEvent.mouseDown(formatSelect);
      
      expect(screen.getByText('PDF Report')).toBeInTheDocument();
      expect(screen.getByText('CSV Data')).toBeInTheDocument();
      expect(screen.getByText('Excel Workbook')).toBeInTheDocument();
    });

    it('handles export report type selection', async () => {
      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Report Type')).toBeInTheDocument();
      });

      const reportTypeSelect = screen.getByLabelText('Report Type');
      fireEvent.mouseDown(reportTypeSelect);
      
      expect(screen.getByText('Subscription Analytics')).toBeInTheDocument();
      expect(screen.getByText('Pharmacy Usage')).toBeInTheDocument();
      expect(screen.getByText('Clinical Outcomes')).toBeInTheDocument();
      expect(screen.getByText('Financial Summary')).toBeInTheDocument();
    });

    it('handles successful export', async () => {
      const mockBlob = new Blob(['test data'], { type: 'application/pdf' });
      mockUseSaasSettings.exportReport.mockResolvedValue({
        success: true,
        data: mockBlob,
      });

      // Mock URL.createObjectURL and related methods
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      // Mock document methods
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      document.createElement = jest.fn(() => mockLink as any);
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });

      const exportReportButton = screen.getByText('Export Report');
      fireEvent.click(exportReportButton);

      await waitFor(() => {
        expect(mockUseSaasSettings.exportReport).toHaveBeenCalled();
      });
    });

    it('handles export error', async () => {
      mockUseSaasSettings.exportReport.mockRejectedValue(new Error('Export failed'));

      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });

      const exportReportButton = screen.getByText('Export Report');
      fireEvent.click(exportReportButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to export report')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error when subscription analytics fail to load', async () => {
      mockUseSaasSettings.getSubscriptionAnalytics.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      });
    });

    it('displays error when pharmacy reports fail to load', async () => {
      mockUseSaasSettings.getPharmacyUsageReports.mockRejectedValue(new Error('Load failed'));

      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching data', async () => {
      mockUseSaasSettings.getSubscriptionAnalytics.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderWithProviders(<AnalyticsReports />);

      // Should show loading initially
      expect(mockUseSaasSettings.getSubscriptionAnalytics).toHaveBeenCalled();
    });

    it('shows exporting state during export', async () => {
      mockUseSaasSettings.exportReport.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: new Blob() }), 100))
      );

      renderWithProviders(<AnalyticsReports />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export Report')).toBeInTheDocument();
      });

      const exportReportButton = screen.getByText('Export Report');
      fireEvent.click(exportReportButton);

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('formats currency values correctly', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        // Check if currency formatting is applied
        expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
        expect(screen.getByText(/\$600,000/)).toBeInTheDocument();
      });
    });

    it('formats percentage values correctly', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        // Check if percentage formatting is applied
        expect(screen.getByText(/5\.0%/)).toBeInTheDocument(); // Churn rate
      });
    });

    it('formats large numbers with commas', async () => {
      renderWithProviders(<AnalyticsReports />);

      const pharmacyTab = screen.getByText('Pharmacy Usage');
      fireEvent.click(pharmacyTab);

      await waitFor(() => {
        expect(screen.getByText('1,250')).toBeInTheDocument();
        expect(screen.getByText('2,100')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<AnalyticsReports />);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      expect(tabs[0]).toHaveAttribute('aria-controls', 'analytics-tabpanel-0');
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<AnalyticsReports />);

      const firstTab = screen.getAllByRole('tab')[0];
      firstTab.focus();
      expect(document.activeElement).toBe(firstTab);
    });
  });
});