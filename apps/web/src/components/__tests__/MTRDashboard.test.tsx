import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '../../theme';
import MTRDashboard from '../MTRDashboard';
import { useMTRStore } from '../../stores/mtrStore';

// Mock the MTR store
vi.mock('../../stores/mtrStore');
const mockUseMTRStore = useMTRStore as ReturnType<typeof vi.fn>;

// Mock the step components
vi.mock('../PatientSelection', () => ({
  default: ({ onNext }: { onNext: () => void }) => (
    <div data-testid="patient-selection">
      <h3>Patient Selection</h3>
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('../MedicationHistory', () => ({
  default: ({
    onNext,
    onBack,
  }: {
    onNext: () => void;
    onBack?: () => void;
  }) => (
    <div data-testid="medication-history">
      <h3>Medication History</h3>
      {onBack && <button onClick={onBack}>Back</button>}
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('../TherapyAssessment', () => ({
  default: ({
    onNext,
    onBack,
  }: {
    onNext: () => void;
    onBack?: () => void;
  }) => (
    <div data-testid="therapy-assessment">
      <h3>Therapy Assessment</h3>
      {onBack && <button onClick={onBack}>Back</button>}
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('../PlanDevelopment', () => ({
  default: ({
    onNext,
    onBack,
  }: {
    onNext: () => void;
    onBack?: () => void;
  }) => (
    <div data-testid="plan-development">
      <h3>Plan Development</h3>
      {onBack && <button onClick={onBack}>Back</button>}
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('../InterventionsDashboard', () => ({
  default: ({
    onNext,
    onBack,
  }: {
    onNext: () => void;
    onBack?: () => void;
  }) => (
    <div data-testid="interventions-dashboard">
      <h3>Interventions Dashboard</h3>
      {onBack && <button onClick={onBack}>Back</button>}
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('../FollowUpScheduler', () => ({
  default: ({ onBack }: { onBack?: () => void }) => (
    <div data-testid="follow-up-scheduler">
      <h3>Follow-Up Scheduler</h3>
      {onBack && <button onClick={onBack}>Back</button>}
      <button>Complete Review</button>
    </div>
  ),
}));

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('MTRDashboard', () => {
  const mockStore = {
    currentReview: {
      _id: 'test-review-id',
      reviewNumber: 'MTR-001',
      status: 'in_progress' as const,
      steps: {
        patientSelection: { completed: false },
        medicationHistory: { completed: false },
        therapyAssessment: { completed: false },
        planDevelopment: { completed: false },
        interventions: { completed: false },
        followUp: { completed: false },
      },
    },
    currentStep: 0,
    selectedPatient: {
      _id: 'test-patient-id',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN001',
    },
    loading: {},
    errors: {},
    goToStep: vi.fn(),
    completeStep: vi.fn(),
    saveReview: vi.fn(),
    completeReview: vi.fn(),
    cancelReview: vi.fn(),
    createReview: vi.fn(),
    loadReview: vi.fn(),
    getCompletionPercentage: vi.fn(() => 16.67),
    canCompleteReview: vi.fn(() => false),
    validateStep: vi.fn(() => []),
    getCurrentStepName: vi.fn(() => 'Patient Selection'),
    getNextStep: vi.fn(() => 0),
    clearErrors: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMTRStore.mockReturnValue(mockStore);
  });

  it('renders MTR dashboard with stepper', () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
    expect(screen.getByText('MTR-001 • Patient Selection')).toBeInTheDocument();
    expect(
      screen.getByText('Patient: John Doe (MRN: MRN001)')
    ).toBeInTheDocument();
  });

  it('displays all step labels in stepper', () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    expect(screen.getByText('Medication History')).toBeInTheDocument();
    expect(screen.getByText('Therapy Assessment')).toBeInTheDocument();
    expect(screen.getByText('Plan Development')).toBeInTheDocument();
    expect(screen.getByText('Interventions')).toBeInTheDocument();
    expect(screen.getByText('Follow-Up')).toBeInTheDocument();
  });

  it('renders current step component', () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(screen.getByTestId('patient-selection')).toBeInTheDocument();
    expect(screen.queryByTestId('medication-history')).not.toBeInTheDocument();
  });

  it('shows completion percentage', () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(screen.getByText('17% Complete')).toBeInTheDocument();
  });

  it('handles save functionality', async () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockStore.saveReview).toHaveBeenCalled();
    });
  });

  it('disables back button on first step', () => {
    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeDisabled();
  });

  it('shows loading state when creating review', () => {
    mockUseMTRStore.mockReturnValue({
      ...mockStore,
      loading: { createReview: true },
      currentReview: null,
    });

    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(screen.getByText('Creating MTR session...')).toBeInTheDocument();
  });

  it('shows no review state when no current review', () => {
    mockUseMTRStore.mockReturnValue({
      ...mockStore,
      currentReview: null,
    });

    render(<MTRDashboard />, { wrapper: createTestWrapper() });

    expect(
      screen.getByText(
        'No MTR session found. Please select a patient to begin.'
      )
    ).toBeInTheDocument();
  });
});
