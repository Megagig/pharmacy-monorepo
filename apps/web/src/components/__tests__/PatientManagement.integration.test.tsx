import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import PatientManagement from '../PatientManagement';
import { usePatient } from '../../queries/usePatients';
import { usePatientNotes } from '../../queries/clinicalNoteQueries';
import { useRBAC } from '../../hooks/useRBAC';

// Mock the queries and hooks
jest.mock('../../queries/usePatients');
jest.mock('../../queries/clinicalNoteQueries');
jest.mock('../../hooks/useRBAC');

const mockUsePatient = usePatient as jest.MockedFunction<typeof usePatient>;
const mockUsePatientNotes = usePatientNotes as jest.MockedFunction<
  typeof usePatientNotes
>;
const mockUseRBAC = useRBAC as jest.MockedFunction<typeof useRBAC>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock data
const mockPatient = {
  _id: 'patient1',
  firstName: 'John',
  lastName: 'Doe',
  mrn: 'MRN001',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  gender: 'Male',
  age: 45,
  dob: '1979-01-15',
  bloodGroup: 'O+',
  genotype: 'AA',
  state: 'Lagos',
  lga: 'Ikeja',
  hasActiveDTP: false,
};

const mockNotes = [
  {
    _id: 'note1',
    title: 'Initial Consultation',
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
      subjective: 'Patient reports feeling better',
      objective: 'Vital signs stable',
      assessment: 'Improving condition',
      plan: 'Continue current medication',
    },
    recommendations: ['Monitor blood pressure'],
    tags: ['hypertension'],
    workplaceId: 'workplace1',
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; route?: string }> = ({
  children,
  route = '/patients/patient1',
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PatientManagement - Clinical Notes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRBAC.mockReturnValue(undefined);

    mockUsePatient.mockReturnValue({
      data: { patient: mockPatient },
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    mockUsePatientNotes.mockReturnValue({
      data: { notes: mockNotes, total: 1 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders patient management with clinical notes tab', () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Check patient header
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('MRN: MRN001')).toBeInTheDocument();

    // Check tabs including Clinical Notes
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clinical Notes')).toBeInTheDocument();
    expect(screen.getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText('Medications')).toBeInTheDocument();
  });

  it('switches to clinical notes tab and displays notes', async () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Click on Clinical Notes tab
    const clinicalNotesTab = screen.getByText('Clinical Notes');
    fireEvent.click(clinicalNotesTab);

    // Wait for tab content to load
    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Check that the clinical notes widget is displayed
    expect(screen.getByText('New Note')).toBeInTheDocument();
  });

  it('navigates to create note with patient context', async () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Switch to Clinical Notes tab
    const clinicalNotesTab = screen.getByText('Clinical Notes');
    fireEvent.click(clinicalNotesTab);

    await waitFor(() => {
      expect(screen.getByText('New Note')).toBeInTheDocument();
    });

    // Click create note button
    const createButton = screen.getByText('New Note');
    fireEvent.click(createButton);

    // Should navigate to create note with patient context
    expect(mockNavigate).toHaveBeenCalledWith('/notes/new?patientId=patient1');
  });

  it('navigates to note detail when viewing note', async () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Switch to Clinical Notes tab
    const clinicalNotesTab = screen.getByText('Clinical Notes');
    fireEvent.click(clinicalNotesTab);

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Click view note button
    const viewButtons = screen.getAllByTestId('VisibilityIcon');
    fireEvent.click(viewButtons[0]);

    // Should navigate to note detail
    expect(mockNavigate).toHaveBeenCalledWith('/notes/note1');
  });

  it('navigates to note edit when editing note', async () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Switch to Clinical Notes tab
    const clinicalNotesTab = screen.getByText('Clinical Notes');
    fireEvent.click(clinicalNotesTab);

    await waitFor(() => {
      expect(screen.getByText('Initial Consultation')).toBeInTheDocument();
    });

    // Click edit note button
    const editButtons = screen.getAllByTestId('EditIcon');
    fireEvent.click(editButtons[0]);

    // Should navigate to note edit
    expect(mockNavigate).toHaveBeenCalledWith('/notes/note1/edit');
  });

  it('maintains patient context throughout navigation', () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Patient information should be visible in header
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('MRN: MRN001')).toBeInTheDocument();

    // Switch between tabs - patient context should remain
    const allergiesTab = screen.getByText('Allergies');
    fireEvent.click(allergiesTab);

    // Patient header should still be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Switch back to Clinical Notes
    const clinicalNotesTab = screen.getByText('Clinical Notes');
    fireEvent.click(clinicalNotesTab);

    // Patient context should still be maintained
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('handles patient loading state', () => {
    mockUsePatient.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Should show loading skeletons
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('handles patient error state', () => {
    const mockError = new Error('Patient not found');
    mockUsePatient.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: mockError,
    } as any);

    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load patient')).toBeInTheDocument();
    expect(screen.getByText('Patient not found')).toBeInTheDocument();
    expect(screen.getByText('Back to Patients')).toBeInTheDocument();
  });

  it('handles patient not found state', () => {
    mockUsePatient.mockReturnValue({
      data: { patient: null },
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    expect(screen.getByText('Patient not found')).toBeInTheDocument();
    expect(
      screen.getByText('The requested patient could not be found.')
    ).toBeInTheDocument();
  });

  it('navigates back to patients list', () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    const backButton = screen.getByTestId('ArrowBackIcon').closest('button');
    fireEvent.click(backButton!);

    expect(mockNavigate).toHaveBeenCalledWith('/patients');
  });

  it('navigates to edit patient', () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    const editButton = screen.getByText('Edit Patient');
    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith('/patients/patient1/edit');
  });

  it('displays patient indicators correctly', () => {
    // Test with patient having active DTPs and sickle cell
    const patientWithConditions = {
      ...mockPatient,
      hasActiveDTP: true,
      genotype: 'SS',
    };

    mockUsePatient.mockReturnValue({
      data: { patient: patientWithConditions },
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    expect(screen.getByText('Active DTPs')).toBeInTheDocument();
    expect(screen.getByText('Sickle Cell - SS')).toBeInTheDocument();
  });

  it('integrates with existing patient dashboard components', () => {
    render(
      <TestWrapper>
        <PatientManagement />
      </TestWrapper>
    );

    // Should be on Dashboard tab by default
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Should show patient dashboard content (this would include the clinical notes widget)
    // The PatientDashboard component should render with the clinical notes widget
    // This is tested indirectly through the tab system
  });
});
