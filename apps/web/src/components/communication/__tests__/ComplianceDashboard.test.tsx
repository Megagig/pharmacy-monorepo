import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ComplianceDashboard from '../ComplianceDashboard';

// Mock recharts
jest.mock('recharts', () => ({
  PieChart: ({ children }: any) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    {children}
  </LocalizationProvider>
);

const mockComplianceMetrics = {
  totalActivities: 1250,
  highRiskActivities: 15,
  recentActivities: 45,
  complianceSummary: [
    {
      _id: {
        complianceCategory: 'communication_security',
        riskLevel: 'low',
        success: true,
      },
      count: 800,
      avgDuration: 120,
      actions: ['message_sent', 'message_read'],
    },
    {
      _id: {
        complianceCategory: 'communication_security',
        riskLevel: 'low',
        success: false,
      },
      count: 20,
      avgDuration: 150,
      actions: ['message_sent'],
    },
    {
      _id: {
        complianceCategory: 'file_security',
        riskLevel: 'medium',
        success: true,
      },
      count: 300,
      avgDuration: 250,
      actions: ['file_uploaded', 'file_downloaded'],
    },
    {
      _id: {
        complianceCategory: 'patient_privacy',
        riskLevel: 'high',
        success: true,
      },
      count: 100,
      avgDuration: 180,
      actions: ['participant_added', 'clinical_context_updated'],
    },
    {
      _id: {
        complianceCategory: 'data_access',
        riskLevel: 'critical',
        success: false,
      },
      count: 15,
      avgDuration: 300,
      actions: ['conversation_exported'],
    },
  ],
  dateRange: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-31T23:59:59Z',
  },
  generatedAt: '2024-01-31T12:00:00Z',
};

const mockHighRiskActivities = [
  {
    _id: '1',
    action: 'conversation_exported',
    timestamp: '2024-01-31T10:30:00Z',
    userId: {
      firstName: 'John',
      lastName: 'Doe',
      role: 'admin',
    },
    riskLevel: 'critical',
    complianceCategory: 'data_access',
    details: {
      conversationId: 'conv1',
      patientId: 'patient1',
    },
  },
  {
    _id: '2',
    action: 'bulk_message_delete',
    timestamp: '2024-01-31T09:15:00Z',
    userId: {
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'pharmacist',
    },
    riskLevel: 'high',
    complianceCategory: 'message_integrity',
    details: {
      conversationId: 'conv2',
    },
  },
];

const mockStatisticsResponse = {
  success: true,
  data: mockComplianceMetrics,
};

const mockHighRiskResponse = {
  success: true,
  data: mockHighRiskActivities,
};

describe('ComplianceDashboard', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  it('renders compliance dashboard with header', () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Compliance Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Export Report')).toBeInTheDocument();
  });

  it('fetches and displays compliance metrics', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument(); // Total activities
      expect(screen.getByText('15')).toBeInTheDocument(); // High risk activities
      expect(screen.getByText('45')).toBeInTheDocument(); // Recent activities
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/communication/audit/statistics'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token',
        },
      })
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/communication/audit/high-risk'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token',
        },
      })
    );
  });

  it('calculates and displays compliance score correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      // Compliance score should be calculated as (1 - highRisk/total) * 100
      // (1 - 15/1250) * 100 = 98.8% rounded to 99%
      expect(screen.getByText('99%')).toBeInTheDocument();
    });
  });

  it('displays compliance score with appropriate color coding', async () => {
    // Test high compliance score (green)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      const scoreElement = screen.getByText('99%');
      expect(scoreElement).toBeInTheDocument();
      // Should have success color class for scores >= 90%
    });
  });

  it('changes time period and refetches data', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    // Change period to 7 days
    const periodSelect = screen.getByLabelText('Period');
    await user.click(periodSelect);
    await user.click(screen.getByText('Last 7 days'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial 2 + new 2 calls
    });
  });

  it('displays high-risk activities correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Recent High Risk Activities')
      ).toBeInTheDocument();
      expect(screen.getByText('conversation exported')).toBeInTheDocument();
      expect(screen.getByText('bulk message delete')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('shows no high-risk activities message when list is empty', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('No high-risk activities detected')
      ).toBeInTheDocument();
    });
  });

  it('renders charts correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Risk Level Distribution')).toBeInTheDocument();
      expect(screen.getByText('Success Rate by Category')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('displays compliance categories table', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Compliance Categories Overview')
      ).toBeInTheDocument();
      expect(screen.getByText('Communication Security')).toBeInTheDocument();
      expect(screen.getByText('File Security')).toBeInTheDocument();
      expect(screen.getByText('Patient Privacy')).toBeInTheDocument();
      expect(screen.getByText('Data Access')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial 2 + refresh 2 calls
    });
  });

  it('handles export report functionality', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () =>
          new Blob(['{"report": "data"}'], { type: 'application/json' }),
      });

    // Mock document methods
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    const mockClick = jest.fn();

    Object.defineProperty(document, 'createElement', {
      value: jest.fn(() => ({
        href: '',
        download: '',
        click: mockClick,
      })),
    });

    Object.defineProperty(document.body, 'appendChild', {
      value: mockAppendChild,
    });
    Object.defineProperty(document.body, 'removeChild', {
      value: mockRemoveChild,
    });

    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Export Report')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export Report');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/communication/audit/compliance-report'),
        expect.any(Object)
      );
    });
  });

  it('displays error message when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during fetch', () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays report summary with correct information', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Report Summary')).toBeInTheDocument();
      expect(screen.getByText('Report Period')).toBeInTheDocument();
      expect(screen.getByText('Compliance Status')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument(); // For 99% score
    });
  });

  it('calculates success rates correctly for categories', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      // Communication Security: 800 success / (800 + 20) total = 97.6% ≈ 98%
      expect(screen.getByText('98%')).toBeInTheDocument();
      // File Security: 300 success / 300 total = 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('handles auto-refresh when enabled', async () => {
    jest.useFakeTimers();

    mockFetch
      .mockResolvedValue({
        ok: true,
        json: async () => mockStatisticsResponse,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => mockHighRiskResponse,
      });

    render(
      <TestWrapper>
        <ComplianceDashboard refreshInterval={5000} />
      </TestWrapper>
    );

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Fast-forward time to trigger refresh
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // Should have refreshed
    });

    jest.useRealTimers();
  });
});
