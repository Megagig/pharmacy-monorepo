import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import MTRReportsDashboard from '../MTRReportsDashboard';
import * as mtrQueries from '../../queries/useMTRQueries';

// Mock the MTR queries
jest.mock('../../queries/useMTRQueries');

const mockMTRQueries = mtrQueries as jest.Mocked<typeof mtrQueries>;

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {component}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('MTRReportsDashboard', () => {
  beforeEach(() => {
    // Mock all the query hooks
    mockMTRQueries.useMTRSummaryReport.mockReturnValue({
      data: {
        data: {
          summary: {
            totalReviews: 100,
            completedReviews: 85,
            inProgressReviews: 10,
            cancelledReviews: 3,
            onHoldReviews: 2,
            completionRate: 85.0,
            avgCompletionTime: 4.2,
            totalProblemsResolved: 150,
            totalMedicationsOptimized: 200,
            adherenceImprovedCount: 75,
            adverseEventsReducedCount: 25,
            totalCostSavings: 15000,
          },
          distributions: {
            reviewType: [
              { _id: 'initial', count: 60 },
              { _id: 'follow_up', count: 30 },
              { _id: 'annual', count: 10 },
            ],
            priority: [
              { _id: 'routine', count: 70 },
              { _id: 'urgent', count: 25 },
              { _id: 'high_risk', count: 5 },
            ],
          },
          trends: {
            monthly: [
              {
                _id: { year: 2024, month: 1 },
                totalReviews: 25,
                completedReviews: 20,
                avgCompletionTime: 4.0,
              },
              {
                _id: { year: 2024, month: 2 },
                totalReviews: 30,
                completedReviews: 28,
                avgCompletionTime: 3.8,
              },
            ],
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown);

    mockMTRQueries.useInterventionEffectivenessReport.mockReturnValue({
      data: {
        data: {
          summary: {
            totalInterventions: 250,
            acceptedInterventions: 200,
            rejectedInterventions: 30,
            modifiedInterventions: 15,
            pendingInterventions: 5,
            overallAcceptanceRate: 80.0,
          },
          effectiveness: {
            byType: [
              {
                _id: 'recommendation',
                totalInterventions: 100,
                acceptedInterventions: 85,
                acceptanceRate: 85.0,
              },
              {
                _id: 'counseling',
                totalInterventions: 80,
                acceptedInterventions: 70,
                acceptanceRate: 87.5,
              },
            ],
            byCategory: [
              {
                _id: 'medication_change',
                totalInterventions: 120,
                acceptedInterventions: 100,
                acceptanceRate: 83.3,
              },
              {
                _id: 'adherence_support',
                totalInterventions: 90,
                acceptedInterventions: 75,
                acceptanceRate: 83.3,
              },
            ],
          },
          pharmacistPerformance: [
            {
              _id: '1',
              pharmacistName: 'Dr. Smith',
              totalInterventions: 50,
              acceptedInterventions: 45,
              acceptanceRate: 90.0,
            },
            {
              _id: '2',
              pharmacistName: 'Dr. Johnson',
              totalInterventions: 40,
              acceptedInterventions: 32,
              acceptanceRate: 80.0,
            },
          ],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown);

    mockMTRQueries.usePharmacistPerformanceReport.mockReturnValue({
      data: {
        data: {
          pharmacistPerformance: [
            {
              _id: '1',
              pharmacistName: 'Dr. Smith',
              totalReviews: 25,
              completedReviews: 23,
              completionRate: 92.0,
              avgCompletionTime: 3.5,
              totalProblemsIdentified: 40,
              totalProblemsResolved: 38,
              problemResolutionRate: 95.0,
              totalMedicationsOptimized: 50,
              totalCostSavings: 8000,
              totalInterventions: 50,
              acceptedInterventions: 45,
              interventionAcceptanceRate: 90.0,
              efficiencyScore: 88.0,
              qualityScore: 91.5,
            },
          ],
          summary: {
            totalPharmacists: 5,
            avgQualityScore: 85.2,
            topPerformer: {
              pharmacistName: 'Dr. Smith',
              qualityScore: 91.5,
            },
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown);

    mockMTRQueries.useQualityAssuranceReport.mockReturnValue({
      data: {
        data: {
          completionTimeAnalysis: [
            {
              _id: 'routine',
              avgCompletionTime: 5.2,
              minCompletionTime: 2.0,
              maxCompletionTime: 10.0,
              count: 70,
            },
            {
              _id: 'urgent',
              avgCompletionTime: 2.8,
              minCompletionTime: 1.0,
              maxCompletionTime: 5.0,
              count: 25,
            },
          ],
          problemPatterns: [
            {
              _id: { category: 'safety', severity: 'major' },
              count: 45,
              resolvedCount: 40,
              resolutionRate: 88.9,
            },
            {
              _id: { category: 'effectiveness', severity: 'moderate' },
              count: 35,
              resolvedCount: 32,
              resolutionRate: 91.4,
            },
          ],
          followUpCompliance: {
            totalFollowUps: 120,
            completedFollowUps: 100,
            missedFollowUps: 15,
            rescheduledFollowUps: 5,
            complianceRate: 83.3,
          },
          documentationQuality: {
            totalReviews: 100,
            reviewsWithCompletePlans: 95,
            reviewsWithMedications: 98,
            reviewsWithProblems: 92,
            planCompletionRate: 95.0,
            medicationDocumentationRate: 98.0,
            problemIdentificationRate: 92.0,
          },
          qualityMetrics: {
            avgPlanCompletionRate: 95.0,
            avgFollowUpCompliance: 83.3,
            avgProblemResolutionRate: 90.2,
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown);

    mockMTRQueries.useOutcomeMetricsReport.mockReturnValue({
      data: {
        data: {
          summary: {
            totalReviews: 100,
            totalProblemsResolved: 150,
            totalMedicationsOptimized: 200,
            adherenceImprovedCount: 75,
            adverseEventsReducedCount: 25,
            qualityOfLifeImprovedCount: 60,
            clinicalParametersImprovedCount: 45,
            totalCostSavings: 15000,
            avgProblemsPerReview: 1.5,
            avgMedicationsPerReview: 2.0,
            adherenceImprovementRate: 75.0,
            adverseEventReductionRate: 25.0,
          },
          outcomesByType: [
            {
              _id: 'initial',
              totalReviews: 60,
              avgProblemsResolved: 1.8,
              avgMedicationsOptimized: 2.2,
              adherenceImprovedRate: 80.0,
              avgCostSavings: 180,
            },
            {
              _id: 'follow_up',
              totalReviews: 30,
              avgProblemsResolved: 1.0,
              avgMedicationsOptimized: 1.5,
              adherenceImprovedRate: 65.0,
              avgCostSavings: 120,
            },
          ],
          trends: {
            monthly: [
              {
                _id: { year: 2024, month: 1 },
                totalReviews: 25,
                totalProblemsResolved: 35,
                totalMedicationsOptimized: 50,
                totalCostSavings: 3500,
              },
              {
                _id: { year: 2024, month: 2 },
                totalReviews: 30,
                totalProblemsResolved: 45,
                totalMedicationsOptimized: 60,
                totalCostSavings: 4200,
              },
            ],
          },
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dashboard title', () => {
    renderWithProviders(<MTRReportsDashboard />);

    expect(screen.getByText('MTR Reports & Analytics')).toBeInTheDocument();
  });

  it('renders all report tabs', () => {
    renderWithProviders(<MTRReportsDashboard />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Interventions')).toBeInTheDocument();
    expect(screen.getByText('Pharmacists')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Outcomes')).toBeInTheDocument();
  });

  it('displays summary report data', async () => {
    renderWithProviders(<MTRReportsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // Total Reviews
      expect(screen.getByText('85.0%')).toBeInTheDocument(); // Completion Rate
      expect(screen.getByText('4.2 days')).toBeInTheDocument(); // Avg Completion Time
      expect(screen.getByText('150')).toBeInTheDocument(); // Problems Resolved
    });
  });

  it('shows filter controls', () => {
    renderWithProviders(<MTRReportsDashboard />);

    expect(screen.getByText('Report Filters')).toBeInTheDocument();
    expect(screen.getByText('Show Filters')).toBeInTheDocument();
  });

  it('displays export and refresh buttons', () => {
    renderWithProviders(<MTRReportsDashboard />);

    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /refresh/i })
    ).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockMTRQueries.useMTRSummaryReport.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    } as unknown);

    renderWithProviders(<MTRReportsDashboard />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', () => {
    mockMTRQueries.useMTRSummaryReport.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'Failed to load data' },
      refetch: jest.fn(),
    } as unknown);

    renderWithProviders(<MTRReportsDashboard />);

    expect(
      screen.getByText(/Failed to load summary report/)
    ).toBeInTheDocument();
  });
});
