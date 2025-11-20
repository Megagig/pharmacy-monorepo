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
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import ResultsReviewPage from '../ResultsReviewPage';
import * as diagnosticHooks from '../../hooks/useDiagnostics';
import * as stores from '../../../../stores';

// Mock the hooks
vi.mock('../../hooks/useDiagnostics');
vi.mock('../../../../stores');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ requestId: 'test-request-123' }),
  };
});

// Mock components
vi.mock('../../../components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../components', () => ({
  DiagnosticResultsPanel: ({ result, onApprove, onModify, onReject }: any) => (
    <div data-testid="diagnostic-results-panel">
      <div>Diagnoses: {result.diagnoses.length}</div>
      <button onClick={onApprove}>Approve</button>
      <button onClick={() => onModify('test modifications')}>Modify</button>
      <button onClick={() => onReject('test rejection')}>Reject</button>
    </div>
  ),
  PharmacistReviewPanel: ({ result, onApprove, onModify, onReject }: any) => (
    <div data-testid="pharmacist-review-panel">
      <div>Review Status: {result.pharmacistReview?.status || 'pending'}</div>
      <button onClick={onApprove}>Review Approve</button>
      <button onClick={() => onModify('review modifications')}>
        Review Modify
      </button>
      <button onClick={() => onReject('review rejection')}>
        Review Reject
      </button>
    </div>
  ),
  RedFlagAlerts: ({ redFlags }: any) => (
    <div data-testid="red-flag-alerts">
      {redFlags.map((flag: any, index: number) => (
        <div key={index}>
          {flag.flag} - {flag.severity}
        </div>
      ))}
    </div>
  ),
  InteractionAlerts: ({ medications, allergies }: any) => (
    <div data-testid="interaction-alerts">
      <div>Medications: {medications.length}</div>
      <div>Allergies: {allergies.length}</div>
    </div>
  ),
  ConfidenceIndicator: ({ score }: any) => (
    <div data-testid="confidence-indicator">
      Confidence: {Math.round(score * 100)}%
    </div>
  ),
}));

const theme = createTheme();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const mockDiagnosticRequest = {
  _id: 'test-request-123',
  patientId: 'patient-123',
  pharmacistId: 'pharmacist-123',
  workplaceId: 'workplace-123',
  inputSnapshot: {
    symptoms: {
      subjective: ['headache', 'nausea'],
      objective: ['fever'],
      duration: '2 days',
      severity: 'moderate' as const,
      onset: 'acute' as const,
    },
    vitals: {
      heartRate: 80,
      temperature: 38.5,
    },
    currentMedications: [
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'TID' },
    ],
    allergies: ['Penicillin'],
  },
  consentObtained: true,
  consentTimestamp: '2024-01-15T10:00:00Z',
  promptVersion: '1.0',
  status: 'completed' as const,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
};

const mockDiagnosticResult = {
  _id: 'test-result-123',
  requestId: 'test-request-123',
  diagnoses: [
    {
      condition: 'Migraine',
      probability: 0.85,
      reasoning: 'Based on symptoms and presentation',
      severity: 'medium' as const,
      icdCode: 'G43.9',
    },
    {
      condition: 'Tension Headache',
      probability: 0.65,
      reasoning: 'Alternative diagnosis',
      severity: 'low' as const,
    },
  ],
  suggestedTests: [
    {
      testName: 'CBC',
      priority: 'routine' as const,
      reasoning: 'Rule out infection',
      loincCode: '58410-2',
    },
  ],
  medicationSuggestions: [
    {
      drugName: 'Sumatriptan',
      dosage: '50mg',
      frequency: 'PRN',
      duration: 'As needed',
      reasoning: 'For migraine relief',
      safetyNotes: ['Monitor for cardiovascular effects'],
      rxcui: '35636',
    },
  ],
  redFlags: [
    {
      flag: 'Sudden onset severe headache',
      severity: 'high' as const,
      action: 'Consider immediate neurological evaluation',
    },
  ],
  referralRecommendation: {
    recommended: true,
    urgency: 'within_24h' as const,
    specialty: 'Neurology',
    reason: 'Complex headache pattern requiring specialist evaluation',
  },
  aiMetadata: {
    modelId: 'deepseek-v3.1',
    modelVersion: '1.0',
    confidenceScore: 0.85,
    processingTime: 15000,
    tokenUsage: {
      promptTokens: 500,
      completionTokens: 300,
      totalTokens: 800,
    },
    requestId: 'ai-req-123',
  },
  disclaimer: 'AI analysis requires pharmacist review',
  createdAt: '2024-01-15T10:30:00Z',
};

const mockPatients = [
  {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    phoneNumber: '555-0123',
  },
];

describe('ResultsReviewPage', () => {
  const mockNavigate = vi.fn();
  const mockApprove = vi.fn();
  const mockModify = vi.fn();
  const mockReject = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock store hooks
    vi.mocked(stores.usePatients).mockReturnValue({
      patients: mockPatients,
      loading: false,
      error: null,
      selectedPatient: null,
      fetchPatients: vi.fn(),
      selectPatient: vi.fn(),
    } as any);

    // Mock diagnostic hooks
    vi.mocked(diagnosticHooks.useDiagnosticRequest).mockReturnValue({
      data: {
        success: true,
        data: mockDiagnosticRequest,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: mockDiagnosticResult,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    vi.mocked(diagnosticHooks.useApproveDiagnostic).mockReturnValue({
      mutateAsync: mockApprove,
      isPending: false,
      error: null,
    } as any);

    vi.mocked(diagnosticHooks.useModifyDiagnostic).mockReturnValue({
      mutateAsync: mockModify,
      isPending: false,
      error: null,
    } as any);

    vi.mocked(diagnosticHooks.useRejectDiagnostic).mockReturnValue({
      mutateAsync: mockReject,
      isPending: false,
      error: null,
    } as any);

    // Mock react-router-dom
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ requestId: 'test-request-123' }),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders results review page with correct title and patient info', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Diagnostic Results Review')).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Case ID: st-123/)).toBeInTheDocument();
  });

  it('displays case status and review status chips', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Case completed')).toBeInTheDocument();
  });

  it('shows red flags alert when present', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Critical Red Flags Detected')).toBeInTheDocument();
    expect(screen.getByTestId('red-flag-alerts')).toBeInTheDocument();
    expect(
      screen.getByText('Sudden onset severe headache - high')
    ).toBeInTheDocument();
  });

  it('shows referral recommendation alert', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/Referral Recommended/)).toBeInTheDocument();
    expect(
      screen.getByText(/Neurology: Complex headache pattern/)
    ).toBeInTheDocument();
  });

  it('displays tabs for different sections', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(
      screen.getByRole('tab', { name: /analysis results/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /case details/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /interactions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /review history/i })
    ).toBeInTheDocument();
  });

  it('shows action buttons for unreviewed results', async () => {
    // Mock result without review
    const unreviewed = { ...mockDiagnosticResult };
    delete unreviewed.pharmacistReview;

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: unreviewed,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modify/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /approve/i })
    ).toBeInTheDocument();
  });

  it('shows post-approval actions for approved results', async () => {
    const approved = {
      ...mockDiagnosticResult,
      pharmacistReview: {
        status: 'approved' as const,
        reviewedBy: 'pharmacist-123',
        reviewedAt: '2024-01-15T11:00:00Z',
      },
    };

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: approved,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(
      screen.getByRole('button', { name: /create referral/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create intervention/i })
    ).toBeInTheDocument();
  });

  it('handles approve action', async () => {
    const user = userEvent.setup();
    const unreviewed = { ...mockDiagnosticResult };
    delete unreviewed.pharmacistReview;

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: unreviewed,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const approveButton = screen.getByRole('button', { name: /approve/i });
    await user.click(approveButton);

    // Should open confirmation dialog
    expect(screen.getByText('Approve Diagnostic Result')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /approve/i });
    await user.click(confirmButton);

    expect(mockApprove).toHaveBeenCalledWith('test-result-123');
  });

  it('handles modify action with input', async () => {
    const user = userEvent.setup();
    const unreviewed = { ...mockDiagnosticResult };
    delete unreviewed.pharmacistReview;

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: unreviewed,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const modifyButton = screen.getByRole('button', { name: /modify/i });
    await user.click(modifyButton);

    // Should open modification dialog
    expect(screen.getByText('Modify Diagnostic Result')).toBeInTheDocument();

    const textArea = screen.getByLabelText(/modifications/i);
    await user.type(
      textArea,
      'Updated recommendations based on clinical judgment'
    );

    const saveButton = screen.getByRole('button', {
      name: /save modifications/i,
    });
    await user.click(saveButton);

    expect(mockModify).toHaveBeenCalledWith({
      resultId: 'test-result-123',
      modifications: 'Updated recommendations based on clinical judgment',
    });
  });

  it('handles reject action with reason', async () => {
    const user = userEvent.setup();
    const unreviewed = { ...mockDiagnosticResult };
    delete unreviewed.pharmacistReview;

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: unreviewed,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    await user.click(rejectButton);

    // Should open rejection dialog
    expect(screen.getByText('Reject Diagnostic Result')).toBeInTheDocument();

    const textArea = screen.getByLabelText(/rejection reason/i);
    await user.type(textArea, 'Insufficient clinical evidence for diagnosis');

    const confirmButton = screen.getByRole('button', {
      name: /reject result/i,
    });
    await user.click(confirmButton);

    expect(mockReject).toHaveBeenCalledWith({
      resultId: 'test-result-123',
      rejectionReason: 'Insufficient clinical evidence for diagnosis',
    });
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    // Initially shows analysis results
    expect(screen.getByTestId('diagnostic-results-panel')).toBeInTheDocument();

    // Switch to case details
    const caseDetailsTab = screen.getByRole('tab', { name: /case details/i });
    await user.click(caseDetailsTab);

    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(screen.getByText('Case Input Summary')).toBeInTheDocument();

    // Switch to interactions
    const interactionsTab = screen.getByRole('tab', { name: /interactions/i });
    await user.click(interactionsTab);

    expect(screen.getByTestId('interaction-alerts')).toBeInTheDocument();

    // Switch to review history
    const reviewTab = screen.getByRole('tab', { name: /review history/i });
    await user.click(reviewTab);

    expect(screen.getByTestId('pharmacist-review-panel')).toBeInTheDocument();
  });

  it('displays case details correctly', async () => {
    const user = userEvent.setup();
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const caseDetailsTab = screen.getByRole('tab', { name: /case details/i });
    await user.click(caseDetailsTab);

    // Patient information
    expect(screen.getByText('Name: John Doe')).toBeInTheDocument();
    expect(screen.getByText('DOB: 1990-01-01')).toBeInTheDocument();
    expect(screen.getByText('Gender: male')).toBeInTheDocument();

    // Case input summary
    expect(screen.getByText('headache, nausea')).toBeInTheDocument();
    expect(screen.getByText('Duration: 2 days')).toBeInTheDocument();
    expect(screen.getByText('Severity: moderate')).toBeInTheDocument();

    // Current medications
    expect(screen.getByText('Current Medications')).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();

    // Allergies
    expect(screen.getByText('Known Allergies')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
  });

  it('displays AI metadata correctly', async () => {
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText('AI Analysis Metadata')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v3.1 v1.0')).toBeInTheDocument();
    expect(screen.getByText('15000ms')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByTestId('confidence-indicator')).toBeInTheDocument();
  });

  it('handles loading state', async () => {
    vi.mocked(diagnosticHooks.useDiagnosticRequest).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    vi.mocked(diagnosticHooks.useDiagnosticRequest).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(
      screen.getByText(/failed to load diagnostic data/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to dashboard/i })
    ).toBeInTheDocument();
  });

  it('handles processing state', async () => {
    const processingRequest = {
      ...mockDiagnosticRequest,
      status: 'processing' as const,
    };

    vi.mocked(diagnosticHooks.useDiagnosticRequest).mockReturnValue({
      data: {
        success: true,
        data: processingRequest,
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    expect(screen.getByText('AI Analysis in Progress')).toBeInTheDocument();
    expect(
      screen.getByText(/typically takes 10-30 seconds/i)
    ).toBeInTheDocument();
  });

  it('handles back navigation', async () => {
    const user = userEvent.setup();
    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const backButton =
      screen.getByRole('button', { name: /back/i }) ||
      screen.getByLabelText(/back/i);

    if (backButton) {
      await user.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/diagnostics');
    }
  });

  it('handles create intervention navigation', async () => {
    const user = userEvent.setup();
    const approved = {
      ...mockDiagnosticResult,
      pharmacistReview: {
        status: 'approved' as const,
        reviewedBy: 'pharmacist-123',
        reviewedAt: '2024-01-15T11:00:00Z',
      },
    };

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: approved,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const createInterventionButton = screen.getByRole('button', {
      name: /create intervention/i,
    });
    await user.click(createInterventionButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/clinical-interventions/create?diagnosticResultId=test-result-123'
    );
  });

  it('handles referral creation dialog', async () => {
    const user = userEvent.setup();
    const approved = {
      ...mockDiagnosticResult,
      pharmacistReview: {
        status: 'approved' as const,
        reviewedBy: 'pharmacist-123',
        reviewedAt: '2024-01-15T11:00:00Z',
      },
    };

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: approved,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const createReferralButton = screen.getByRole('button', {
      name: /create referral/i,
    });
    await user.click(createReferralButton);

    expect(screen.getByText('Create Referral')).toBeInTheDocument();
    expect(screen.getByLabelText(/specialty/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument();
  });

  it('validates rejection reason input', async () => {
    const user = userEvent.setup();
    const unreviewed = { ...mockDiagnosticResult };
    delete unreviewed.pharmacistReview;

    vi.mocked(diagnosticHooks.useDiagnosticResult).mockReturnValue({
      data: {
        success: true,
        data: unreviewed,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    render(<ResultsReviewPage />, { wrapper: createWrapper() });

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    await user.click(rejectButton);

    // Confirm button should be disabled without reason
    const confirmButton = screen.getByRole('button', {
      name: /reject result/i,
    });
    expect(confirmButton).toBeDisabled();

    // Add reason
    const textArea = screen.getByLabelText(/rejection reason/i);
    await user.type(textArea, 'Test reason');

    // Now should be enabled
    expect(confirmButton).not.toBeDisabled();
  });
});
