import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LabResultViewer from '../LabResultViewer';
import { useLabStore } from '../../store/labStore';
import type { LabResult } from '../../types';

// Mock the lab store
jest.mock('../../store/labStore');
const mockUseLabStore = useLabStore as jest.MockedFunction<typeof useLabStore>;

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

const theme = createTheme();

const mockResults: LabResult[] = [
  {
    _id: 'result-1',
    orderId: 'order-1',
    patientId: 'patient-123',
    workplaceId: 'workplace-1',
    testCode: 'CBC',
    testName: 'Complete Blood Count',
    value: '12.5',
    unit: 'g/dL',
    referenceRange: {
      low: 12.0,
      high: 16.0,
    },
    interpretation: 'normal',
    flags: ['N'],
    source: 'manual',
    performedAt: '2024-01-15T10:00:00Z',
    recordedAt: '2024-01-15T11:00:00Z',
    recordedBy: 'user-1',
    loincCode: '58410-2',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
  {
    _id: 'result-2',
    orderId: 'order-1',
    patientId: 'patient-123',
    workplaceId: 'workplace-1',
    testCode: 'CBC',
    testName: 'Complete Blood Count',
    value: '11.8',
    unit: 'g/dL',
    referenceRange: {
      low: 12.0,
      high: 16.0,
    },
    interpretation: 'low',
    flags: ['L'],
    source: 'manual',
    performedAt: '2024-01-10T10:00:00Z',
    recordedAt: '2024-01-10T11:00:00Z',
    recordedBy: 'user-1',
    loincCode: '58410-2',
    createdAt: '2024-01-10T11:00:00Z',
    updatedAt: '2024-01-10T11:00:00Z',
  },
  {
    _id: 'result-3',
    patientId: 'patient-123',
    workplaceId: 'workplace-1',
    testCode: 'GLUCOSE',
    testName: 'Glucose',
    value: '250',
    unit: 'mg/dL',
    referenceRange: {
      low: 70,
      high: 100,
    },
    interpretation: 'critical',
    flags: ['HH'],
    source: 'manual',
    performedAt: '2024-01-15T10:00:00Z',
    recordedAt: '2024-01-15T11:00:00Z',
    recordedBy: 'user-1',
    loincCode: '2345-7',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
  {
    _id: 'result-4',
    patientId: 'patient-123',
    workplaceId: 'workplace-1',
    testCode: 'TSH',
    testName: 'Thyroid Stimulating Hormone',
    value: 'positive',
    referenceRange: {
      text: 'negative',
    },
    interpretation: 'abnormal',
    flags: ['A'],
    source: 'manual',
    performedAt: '2024-01-12T10:00:00Z',
    recordedAt: '2024-01-12T11:00:00Z',
    recordedBy: 'user-1',
    loincCode: '3016-3',
    createdAt: '2024-01-12T11:00:00Z',
    updatedAt: '2024-01-12T11:00:00Z',
  },
];

const mockTrendData = {
  testCode: 'CBC',
  testName: 'Complete Blood Count',
  unit: 'g/dL',
  referenceRange: {
    low: 12.0,
    high: 16.0,
  },
  results: [
    {
      value: '11.8',
      numericValue: 11.8,
      interpretation: 'low',
      performedAt: '2024-01-10T10:00:00Z',
      flags: ['L'],
    },
    {
      value: '12.5',
      numericValue: 12.5,
      interpretation: 'normal',
      performedAt: '2024-01-15T10:00:00Z',
      flags: ['N'],
    },
  ],
  trend: 'improving' as const,
  summary: {
    latestValue: '12.5',
    latestInterpretation: 'normal',
    changeFromPrevious: 0.7,
    abnormalCount: 1,
    totalCount: 2,
  },
};

const defaultStoreState = {
  getTrendData: jest.fn().mockReturnValue(mockTrendData),
  fetchTrends: jest.fn(),
  loading: {
    fetchTrends: false,
  },
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('LabResultViewer', () => {
  const mockOnResultClick = jest.fn();
  const defaultProps = {
    results: mockResults,
    onResultClick: mockOnResultClick,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLabStore.mockReturnValue(defaultStoreState as any);
  });

  describe('Rendering', () => {
    it('renders the viewer with all required elements', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getByText('Laboratory Results (4)')).toBeInTheDocument();
      expect(
        screen.getByText(
          'View and analyze laboratory test results with trend analysis'
        )
      ).toBeInTheDocument();
    });

    it('displays summary statistics correctly', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getByText('3')).toBeInTheDocument(); // Different Tests
      expect(screen.getByText('1')).toBeInTheDocument(); // Critical Results
      expect(screen.getByText('3')).toBeInTheDocument(); // Abnormal Results (low + critical + abnormal)
      expect(screen.getByText('1')).toBeInTheDocument(); // Normal Results
    });

    it('groups results by test code', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
      expect(screen.getByText('Glucose')).toBeInTheDocument();
      expect(
        screen.getByText('Thyroid Stimulating Hormone')
      ).toBeInTheDocument();
    });

    it('displays latest result for each test', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // CBC latest result should be 12.5 g/dL (normal)
      expect(screen.getByText('12.5 g/dL')).toBeInTheDocument();

      // Glucose result should be 250 mg/dL (critical)
      expect(screen.getByText('250 mg/dL')).toBeInTheDocument();

      // TSH result should be positive (abnormal)
      expect(screen.getByText('positive')).toBeInTheDocument();
    });

    it('shows interpretation chips for each result', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('Abnormal')).toBeInTheDocument();
    });

    it('displays trend chips when multiple results exist', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // CBC has 2 results, so should show trend
      expect(screen.getByText('Improving')).toBeInTheDocument();
    });

    it('shows empty state when no results provided', () => {
      renderWithProviders(<LabResultViewer results={[]} />);

      expect(
        screen.getByText('No lab results available for this patient.')
      ).toBeInTheDocument();
    });
  });

  describe('Result Expansion', () => {
    it('expands result details when expand button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Value')).toBeInTheDocument();
        expect(screen.getByText('Reference Range')).toBeInTheDocument();
        expect(screen.getByText('Interpretation')).toBeInTheDocument();
        expect(screen.getByText('Flags')).toBeInTheDocument();
      });
    });

    it('collapses result details when collapse button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // First expand
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
      });

      // Then collapse
      const collapseButton = screen.getByRole('button', {
        name: /hide details/i,
      });
      await user.click(collapseButton);

      await waitFor(() => {
        expect(screen.queryByText('Date')).not.toBeInTheDocument();
      });
    });

    it('displays detailed result information in expanded view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        // Should show both CBC results
        expect(screen.getByText('12.5 g/dL')).toBeInTheDocument();
        expect(screen.getByText('11.8 g/dL')).toBeInTheDocument();

        // Should show reference ranges
        expect(screen.getByText('12 - 16 g/dL')).toBeInTheDocument();

        // Should show flags
        expect(screen.getByText('N')).toBeInTheDocument();
        expect(screen.getByText('L')).toBeInTheDocument();
      });
    });
  });

  describe('Trend Analysis', () => {
    it('shows trend analysis button for tests with multiple results', () => {
      renderWithProviders(
        <LabResultViewer {...defaultProps} showTrends={true} />
      );

      const trendButtons = screen.getAllByRole('button', {
        name: /show trend analysis/i,
      });
      expect(trendButtons.length).toBeGreaterThan(0);
    });

    it('does not show trend analysis when showTrends is false', () => {
      renderWithProviders(
        <LabResultViewer {...defaultProps} showTrends={false} />
      );

      expect(
        screen.queryByRole('button', { name: /show trend analysis/i })
      ).not.toBeInTheDocument();
    });

    it('fetches trend data when trend button is clicked', async () => {
      const user = userEvent.setup();
      const mockFetchTrends = jest.fn();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        fetchTrends: mockFetchTrends,
      } as any);

      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // First expand the CBC results
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      // Then click trend analysis
      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      expect(mockFetchTrends).toHaveBeenCalledWith('patient-123', 'CBC');
    });

    it('displays trend chart when trend data is available', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Expand CBC results
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      // Click trend analysis
      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      await waitFor(() => {
        expect(
          screen.getByText('Trend Analysis - Complete Blood Count')
        ).toBeInTheDocument();
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      });
    });

    it('displays trend summary information', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Expand and show trend
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      await waitFor(() => {
        expect(screen.getByText('Latest Value')).toBeInTheDocument();
        expect(screen.getByText('12.5 g/dL')).toBeInTheDocument();
        expect(screen.getByText('Abnormal Results')).toBeInTheDocument();
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });
    });

    it('shows insufficient data message when not enough trend data', async () => {
      const user = userEvent.setup();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        getTrendData: jest.fn().mockReturnValue({
          ...mockTrendData,
          results: [mockTrendData.results[0]], // Only one result
        }),
      } as any);

      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Expand and show trend
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Insufficient data for trend analysis. At least 2 results are needed.'
          )
        ).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching trend data', async () => {
      const user = userEvent.setup();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        loading: {
          fetchTrends: true,
        },
      } as any);

      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Expand and show trend
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      expect(screen.getByText('Loading trend data...')).toBeInTheDocument();
    });
  });

  describe('Result Interaction', () => {
    it('calls onResultClick when result view button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Expand results first
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', {
          name: /view details/i,
        });
        expect(viewButtons.length).toBeGreaterThan(0);
      });

      const viewButton = screen.getAllByRole('button', {
        name: /view details/i,
      })[0];
      await user.click(viewButton);

      expect(mockOnResultClick).toHaveBeenCalledWith(mockResults[0]);
    });

    it('does not show view buttons when onResultClick is not provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer results={mockResults} />);

      // Expand results first
      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /view details/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Reference Range Display', () => {
    it('displays numeric reference ranges correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('12 - 16 g/dL')).toBeInTheDocument();
      });
    });

    it('displays text reference ranges correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Find and expand TSH results (which has text reference range)
      const expandButtons = screen.getAllByRole('button', {
        name: /show details/i,
      });

      // TSH should be the third test (index 2)
      await user.click(expandButtons[2]);

      await waitFor(() => {
        expect(screen.getByText('negative')).toBeInTheDocument();
      });
    });

    it('handles missing reference ranges gracefully', () => {
      const resultsWithoutRange = [
        {
          ...mockResults[0],
          referenceRange: {},
        },
      ];

      renderWithProviders(<LabResultViewer results={resultsWithoutRange} />);

      // Should not crash and should display the result
      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    });
  });

  describe('Critical Results Alert', () => {
    it('shows critical results alert when critical results exist', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getByText('Critical Results Detected')).toBeInTheDocument();
      expect(
        screen.getByText('1 result(s) require immediate clinical attention.')
      ).toBeInTheDocument();
    });

    it('does not show critical results alert when no critical results exist', () => {
      const nonCriticalResults = mockResults.filter(
        (r) => r.interpretation !== 'critical'
      );
      renderWithProviders(<LabResultViewer results={nonCriticalResults} />);

      expect(
        screen.queryByText('Critical Results Detected')
      ).not.toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats dates correctly in the results table', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      await waitFor(() => {
        // Should show formatted dates (exact format depends on locale)
        expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
        expect(screen.getByText(/1\/10\/2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      expect(screen.getAllByRole('button')).toHaveLength(6); // 3 expand buttons + 3 trend buttons
      expect(screen.getByText('Laboratory Results (4)')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LabResultViewer {...defaultProps} />);

      // Tab to first expand button
      await user.tab();
      const firstExpandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      expect(firstExpandButton).toHaveFocus();

      // Press Enter to expand
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles empty results gracefully', () => {
      renderWithProviders(<LabResultViewer results={[]} />);

      expect(
        screen.getByText('No lab results available for this patient.')
      ).toBeInTheDocument();
    });

    it('handles malformed result data gracefully', () => {
      const malformedResults = [
        {
          ...mockResults[0],
          value: null as any,
          referenceRange: null as any,
        },
      ];

      renderWithProviders(<LabResultViewer results={malformedResults} />);

      // Should not crash
      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    });

    it('handles trend data loading errors gracefully', async () => {
      const user = userEvent.setup();
      mockUseLabStore.mockReturnValue({
        ...defaultStoreState,
        getTrendData: jest.fn().mockReturnValue(null),
      } as any);

      renderWithProviders(<LabResultViewer {...defaultProps} />);

      const expandButton = screen.getAllByRole('button', {
        name: /show details/i,
      })[0];
      await user.click(expandButton);

      const trendButton = screen.getByRole('button', {
        name: /show trend analysis/i,
      });
      await user.click(trendButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Insufficient data for trend analysis. At least 2 results are needed.'
          )
        ).toBeInTheDocument();
      });
    });
  });
});
