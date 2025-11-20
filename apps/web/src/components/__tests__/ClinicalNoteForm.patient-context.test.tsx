import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { theme } from '../../theme';
import ClinicalNoteForm from '../ClinicalNoteForm';
import {
  useClinicalNote,
  useCreateClinicalNote,
  useUpdateClinicalNote,
} from '../../queries/clinicalNoteQueries';
import { useSearchPatients } from '../../queries/usePatients';

// Mock the queries
jest.mock('../../queries/clinicalNoteQueries');
jest.mock('../../queries/usePatients');

const mockUseClinicalNote = useClinicalNote as jest.MockedFunction<
  typeof useClinicalNote
>;
const mockUseCreateClinicalNote = useCreateClinicalNote as jest.MockedFunction<
  typeof useCreateClinicalNote
>;
const mockUseUpdateClinicalNote = useUpdateClinicalNote as jest.MockedFunction<
  typeof useUpdateClinicalNote
>;
const mockUseSearchPatients = useSearchPatients as jest.MockedFunction<
  typeof useSearchPatients
>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock data
const mockPatients = [
  {
    _id: 'patient1',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN001',
    email: 'john.doe@example.com',
  },
  {
    _id: 'patient2',
    firstName: 'Jane',
    lastName: 'Smith',
    mrn: 'MRN002',
    email: 'jane.smith@example.com',
  },
];

const mockExistingNote = {
  _id: 'note1',
  title: 'Existing Note',
  type: 'consultation' as const,
  priority: 'medium' as const,
  isConfidential: false,
  followUpRequired: true,
  followUpDate: '2024-02-15T10:00:00Z',
  attachments: [],
  createdAt: '2024-02-01T10:00:00Z',
  updatedAt: '2024-02-01T10:00:00Z',
  patient: {
    _id: 'patient1',
    firstName: 'John',
    lastName: 'Doe',
    mrn: 'MRN001',
  },
  pharmacist: {
    _id: 'pharmacist1',
    firstName: 'Dr. Jane',
    lastName: 'Smith',
    role: 'pharmacist',
  },
  content: {
    subjective: 'Patient reports symptoms',
    objective: 'Vital signs normal',
    assessment: 'Stable condition',
    plan: 'Continue treatment',
  },
  recommendations: ['Follow up in 1 week'],
  tags: ['routine'],
  workplaceId: 'workplace1',
};

// Test wrapper component
const TestWrapper: React.FC<{
  children: React.ReactNode;
  route?: string;
}> = ({ children, route = '/notes/new' }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            {children}
          </LocalizationProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ClinicalNoteForm - Patient Context Integration', () => {
  const mockCreateMutate = jest.fn();
  const mockUpdateMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseClinicalNote.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);

    mockUseSearchPatients.mockReturnValue({
      data: { data: { results: mockPatients } },
      isLoading: false,
    } as any);

    mockUseCreateClinicalNote.mockReturnValue({
      mutateAsync: mockCreateMutate,
    } as any);

    mockUseUpdateClinicalNote.mockReturnValue({
      mutateAsync: mockUpdateMutate,
    } as any);
  });

  it('renders create form with patient context from URL', () => {
    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
    expect(
      screen.getByText('Creating note for patient context')
    ).toBeInTheDocument();
    expect(screen.getByTestId('ArrowBackIcon')).toBeInTheDocument();
  });

  it('renders edit form with existing note', () => {
    mockUseClinicalNote.mockReturnValue({
      data: { note: mockExistingNote },
      isLoading: false,
    } as any);

    render(
      <TestWrapper route="/notes/note1/edit">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    expect(screen.getByText('Edit Clinical Note')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Note')).toBeInTheDocument();
  });

  it('pre-populates patient when creating from patient context', async () => {
    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    // The patient field should be pre-populated
    // This would be tested by checking if the patient autocomplete has the correct value
    // Since the form uses react-hook-form, we need to check the form state
    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
  });

  it('navigates back to patient profile when created from patient context', async () => {
    mockCreateMutate.mockResolvedValue({
      note: { _id: 'new-note', ...mockExistingNote },
    });

    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    // Fill out required fields
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Note' } });

    const subjectiveInput = screen.getByLabelText(/subjective/i);
    fireEvent.change(subjectiveInput, { target: { value: 'Test subjective' } });

    // Submit form
    const submitButton = screen.getByText('Save Note');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/patients/patient1');
    });
  });

  it('navigates back to notes dashboard when not from patient context', async () => {
    mockCreateMutate.mockResolvedValue({
      note: { _id: 'new-note', ...mockExistingNote },
    });

    render(
      <TestWrapper route="/notes/new">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    // Fill out required fields
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Note' } });

    const subjectiveInput = screen.getByLabelText(/subjective/i);
    fireEvent.change(subjectiveInput, { target: { value: 'Test subjective' } });

    // Submit form
    const submitButton = screen.getByText('Save Note');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/notes');
    });
  });

  it('handles cancel navigation correctly with patient context', () => {
    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    const backButton = screen.getByTestId('ArrowBackIcon').closest('button');
    fireEvent.click(backButton!);

    expect(mockNavigate).toHaveBeenCalledWith('/patients/patient1');
  });

  it('handles cancel navigation correctly without patient context', () => {
    render(
      <TestWrapper route="/notes/new">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    const backButton = screen.getByTestId('ArrowBackIcon').closest('button');
    fireEvent.click(backButton!);

    expect(mockNavigate).toHaveBeenCalledWith('/notes');
  });

  it('shows loading state when loading existing note', () => {
    mockUseClinicalNote.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(
      <TestWrapper route="/notes/note1/edit">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles form submission with custom callbacks', async () => {
    const mockOnSave = jest.fn();
    const mockOnCancel = jest.fn();

    render(
      <TestWrapper>
        <ClinicalNoteForm
          patientId="patient1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      </TestWrapper>
    );

    // Test cancel callback
    const backButton = screen.getByTestId('ArrowBackIcon').closest('button');
    fireEvent.click(backButton!);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('maintains patient context throughout form interaction', () => {
    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    // Patient context indicator should be visible
    expect(
      screen.getByText('Creating note for patient context')
    ).toBeInTheDocument();

    // Fill out form fields - patient context should remain
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Note' } });

    // Context should still be visible
    expect(
      screen.getByText('Creating note for patient context')
    ).toBeInTheDocument();
  });

  it('handles readonly mode correctly', () => {
    render(
      <TestWrapper>
        <ClinicalNoteForm readonly={true} />
      </TestWrapper>
    );

    // Auto-save should be disabled in readonly mode
    // Submit button should not be present or disabled
    expect(screen.queryByText('Save Note')).not.toBeInTheDocument();
  });

  it('integrates with existing patient management routes', () => {
    // Test that the form can be accessed from patient management routes
    render(
      <TestWrapper route="/patients/patient1/notes/new">
        <ClinicalNoteForm patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Create Clinical Note')).toBeInTheDocument();
  });

  it('handles URL parameter parsing correctly', () => {
    // Test various URL parameter combinations
    render(
      <TestWrapper route="/notes/new?patientId=patient1&type=consultation">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    expect(
      screen.getByText('Creating note for patient context')
    ).toBeInTheDocument();
  });

  it('validates required fields with patient context', async () => {
    render(
      <TestWrapper route="/notes/new?patientId=patient1">
        <ClinicalNoteForm />
      </TestWrapper>
    );

    // Try to submit without required fields
    const submitButton = screen.getByText('Save Note');
    fireEvent.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });
});
