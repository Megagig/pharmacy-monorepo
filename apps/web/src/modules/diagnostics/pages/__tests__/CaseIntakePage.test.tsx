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

import CaseIntakePage from '../CaseIntakePage';
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
    useParams: () => ({}),
  };
});

// Mock components
vi.mock('../../../components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('../../components', () => ({
  SymptomInput: ({ value, onChange }: any) => (
    <div data-testid="symptom-input">
      <input
        data-testid="symptom-subjective"
        value={value.subjective.join(',')}
        onChange={(e) =>
          onChange({
            ...value,
            subjective: e.target.value.split(',').filter(Boolean),
          })
        }
      />
      <input
        data-testid="symptom-duration"
        value={value.duration}
        onChange={(e) => onChange({ ...value, duration: e.target.value })}
      />
    </div>
  ),
  VitalSignsInput: ({ value, onChange }: any) => (
    <div data-testid="vitals-input">
      <input
        data-testid="vitals-heartrate"
        type="number"
        value={value?.heartRate || ''}
        onChange={(e) =>
          onChange({ ...value, heartRate: Number(e.target.value) })
        }
      />
    </div>
  ),
  MedicationHistoryInput: ({ value, onChange }: any) => (
    <div data-testid="medication-input">
      <button
        data-testid="add-medication"
        onClick={() =>
          onChange([
            ...(value || []),
            { name: 'Test Med', dosage: '10mg', frequency: 'daily' },
          ])
        }
      >
        Add Medication
      </button>
    </div>
  ),
  AllergyInput: ({ value, onChange }: any) => (
    <div data-testid="allergy-input">
      <button
        data-testid="add-allergy"
        onClick={() => onChange([...(value || []), 'Test Allergy'])}
      >
        Add Allergy
      </button>
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

const mockPatients = [
  {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    phoneNumber: '555-0123',
  },
  {
    _id: 'patient-456',
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: '1985-05-15',
    gender: 'female',
    phoneNumber: '555-0456',
  },
];

describe('CaseIntakePage', () => {
  const mockNavigate = vi.fn();
  const mockCreateRequest = vi.fn();
  const mockSetActiveStep = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

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
    vi.mocked(diagnosticHooks.useCreateDiagnosticRequest).mockReturnValue({
      mutateAsync: mockCreateRequest,
      isPending: false,
      error: null,
    } as any);

    // Mock diagnostic store
    const mockStore = {
      setActiveStep: mockSetActiveStep,
    };

    vi.doMock('../../store/diagnosticStore', () => ({
      useDiagnosticStore: () => mockStore,
    }));

    // Mock react-router-dom
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({}),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders case intake page with correct title', async () => {
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    expect(screen.getByText('New Diagnostic Case')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Step-by-step patient assessment and AI diagnostic analysis'
      )
    ).toBeInTheDocument();
  });

  it('displays stepper with all steps', async () => {
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    expect(screen.getByText('Symptom Assessment')).toBeInTheDocument();
    expect(screen.getByText('Vital Signs & History')).toBeInTheDocument();
    expect(screen.getByText('Review & Consent')).toBeInTheDocument();
  });

  it('shows patient selection step initially', async () => {
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    expect(screen.getByText('Select Patient')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('allows patient selection and navigation to next step', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Select a patient
    const patientCard =
      screen.getByText('John Doe').closest('div[role="button"]') ||
      screen.getByText('John Doe').closest('.MuiCard-root');

    if (patientCard) {
      await user.click(patientCard);
    }

    // Should show selected state
    await waitFor(() => {
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    // Navigate to next step
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();
    await user.click(nextButton);

    // Should show symptom assessment step
    expect(screen.getByText('Symptom Assessment')).toBeInTheDocument();
  });

  it('validates required fields before allowing navigation', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Try to navigate without selecting patient
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    // Select patient
    const patientCard =
      screen.getByText('John Doe').closest('div[role="button"]') ||
      screen.getByText('John Doe').closest('.MuiCard-root');

    if (patientCard) {
      await user.click(patientCard);
    }

    // Now next should be enabled
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('handles symptom input in step 2', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to step 2
    const patientCard =
      screen.getByText('John Doe').closest('div[role="button"]') ||
      screen.getByText('John Doe').closest('.MuiCard-root');

    if (patientCard) {
      await user.click(patientCard);
    }

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Should show symptom input
    expect(screen.getByTestId('symptom-input')).toBeInTheDocument();

    // Add symptoms
    const symptomInput = screen.getByTestId('symptom-subjective');
    await user.type(symptomInput, 'headache,nausea');

    const durationInput = screen.getByTestId('symptom-duration');
    await user.type(durationInput, '2 days');

    // Should enable next button
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('handles vital signs and medical history in step 3', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to step 3
    await navigateToStep(user, 3);

    expect(
      screen.getByText('Vital Signs & Medical History')
    ).toBeInTheDocument();
    expect(screen.getByTestId('vitals-input')).toBeInTheDocument();
    expect(screen.getByTestId('medication-input')).toBeInTheDocument();
    expect(screen.getByTestId('allergy-input')).toBeInTheDocument();

    // Add vital signs
    const heartRateInput = screen.getByTestId('vitals-heartrate');
    await user.type(heartRateInput, '80');

    // Add medication
    const addMedButton = screen.getByTestId('add-medication');
    await user.click(addMedButton);

    // Add allergy
    const addAllergyButton = screen.getByTestId('add-allergy');
    await user.click(addAllergyButton);
  });

  it('shows review and consent step', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to final step
    await navigateToStep(user, 4);

    expect(screen.getByText('Review & Submit')).toBeInTheDocument();
    expect(screen.getByText('Case Summary')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /submit for analysis/i })
    ).toBeInTheDocument();
  });

  it('opens consent dialog when submitting', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to final step and submit
    await navigateToStep(user, 4);

    const submitButton = screen.getByRole('button', {
      name: /submit for analysis/i,
    });
    await user.click(submitButton);

    // Should open consent dialog
    expect(
      screen.getByText('AI Diagnostic Analysis Consent')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/patient has been informed about the use of AI/i)
    ).toBeInTheDocument();
  });

  it('handles consent and form submission', async () => {
    const user = userEvent.setup();
    const mockResult = { _id: 'new-request-123' };
    mockCreateRequest.mockResolvedValue(mockResult);

    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to final step and submit
    await navigateToStep(user, 4);

    const submitButton = screen.getByRole('button', {
      name: /submit for analysis/i,
    });
    await user.click(submitButton);

    // Give consent
    const consentCheckbox = screen.getByRole('checkbox');
    await user.click(consentCheckbox);

    const proceedButton = screen.getByRole('button', {
      name: /proceed with analysis/i,
    });
    await user.click(proceedButton);

    // Should call create request
    await waitFor(() => {
      expect(mockCreateRequest).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        '/diagnostics/case/new-request-123'
      );
    });
  });

  it('handles back navigation between steps', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate forward
    await navigateToStep(user, 2);

    // Navigate back
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Should be back to patient selection
    expect(screen.getByText('Select Patient')).toBeInTheDocument();
  });

  it('handles draft saving functionality', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Navigate to step 2 and add data
    await navigateToStep(user, 2);

    const symptomInput = screen.getByTestId('symptom-subjective');
    await user.type(symptomInput, 'headache');

    // Click save draft
    const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
    await user.click(saveDraftButton);

    // Should save to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'diagnostic-draft',
      expect.stringContaining('headache')
    );
  });

  it('handles draft clearing', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    expect(localStorage.removeItem).toHaveBeenCalledWith('diagnostic-draft');
  });

  it('loads draft data on mount', async () => {
    const draftData = {
      patientId: 'patient-123',
      symptoms: {
        subjective: ['headache'],
        objective: [],
        duration: '1 day',
        severity: 'mild',
        onset: 'acute',
      },
    };

    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(draftData));

    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Should load draft data
    expect(localStorage.getItem).toHaveBeenCalledWith('diagnostic-draft');
  });

  it('handles cancel navigation', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    const backButton =
      screen.getByRole('button', { name: /arrow/i }) ||
      screen.getByLabelText(/back/i);

    if (backButton) {
      await user.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/diagnostics');
    }
  });

  it('displays loading state during submission', async () => {
    const user = userEvent.setup();
    vi.mocked(diagnosticHooks.useCreateDiagnosticRequest).mockReturnValue({
      mutateAsync: mockCreateRequest,
      isPending: true,
      error: null,
    } as any);

    render(<CaseIntakePage />, { wrapper: createWrapper() });

    await navigateToStep(user, 4);

    const submitButton = screen.getByRole('button', { name: /processing/i });
    expect(submitButton).toBeDisabled();
  });

  it('handles form validation errors', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    // Try to navigate to step 2 without selecting patient
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    // Navigate to step 2 after selecting patient
    await navigateToStep(user, 2);

    // Try to navigate without adding symptoms
    expect(nextButton).toBeDisabled();
  });

  it('displays patient information in later steps', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    await navigateToStep(user, 2);

    // Should show selected patient info
    expect(screen.getByText('Patient: John Doe')).toBeInTheDocument();
  });

  it('handles consent dialog cancellation', async () => {
    const user = userEvent.setup();
    render(<CaseIntakePage />, { wrapper: createWrapper() });

    await navigateToStep(user, 4);

    const submitButton = screen.getByRole('button', {
      name: /submit for analysis/i,
    });
    await user.click(submitButton);

    // Cancel consent dialog
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should close dialog without submitting
    expect(
      screen.queryByText('AI Diagnostic Analysis Consent')
    ).not.toBeInTheDocument();
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  // Helper function to navigate to a specific step
  async function navigateToStep(user: any, targetStep: number) {
    // Step 1: Select patient
    if (targetStep > 1) {
      const patientCard =
        screen.getByText('John Doe').closest('div[role="button"]') ||
        screen.getByText('John Doe').closest('.MuiCard-root');

      if (patientCard) {
        await user.click(patientCard);
      }

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
    }

    // Step 2: Add symptoms
    if (targetStep > 2) {
      const symptomInput = screen.getByTestId('symptom-subjective');
      await user.type(symptomInput, 'headache');

      const durationInput = screen.getByTestId('symptom-duration');
      await user.type(durationInput, '2 days');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
    }

    // Step 3: Optional step
    if (targetStep > 3) {
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
    }
  }
});
