import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PatientSelection from '../PatientSelection';
import type { Patient } from '../../types/patientManagement';

// Mock the MTR store
vi.mock('../../stores/mtrStore', () => ({
  useMTRStore: () => ({
    loading: {},
    errors: {},
    setLoading: vi.fn(),
    setError: vi.fn(),
    currentReview: null,
    createReview: vi.fn(),
  }),
}));

// Mock the patient queries
vi.mock('../../queries/usePatients', () => ({
  useSearchPatients: vi.fn(() => ({
    data: { data: { results: [] } },
    isLoading: false,
    error: null,
  })),
  useCreatePatient: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

const mockPatient: Patient = {
  _id: '1',
  pharmacyId: 'pharmacy1',
  firstName: 'John',
  lastName: 'Doe',
  mrn: 'PHM-LAG-001',
  age: 30,
  gender: 'male',
  phone: '+2348123456789',
  email: 'john.doe@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {children}
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

describe('PatientSelection Component', () => {
  const mockOnPatientSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with search functionality', () => {
    render(
      <TestWrapper>
        <PatientSelection onPatientSelect={mockOnPatientSelect} />
      </TestWrapper>
    );

    expect(screen.getByText('Patient Selection')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by name, MRN, or phone number...')
    ).toBeInTheDocument();
    expect(screen.getByText('New Patient')).toBeInTheDocument();
  });

  it('displays selected patient when provided', () => {
    render(
      <TestWrapper>
        <PatientSelection
          onPatientSelect={mockOnPatientSelect}
          selectedPatient={mockPatient}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Selected Patient')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/MRN: PHM-LAG-001/)).toBeInTheDocument();
  });

  it('opens new patient modal when clicking New Patient button', async () => {
    render(
      <TestWrapper>
        <PatientSelection onPatientSelect={mockOnPatientSelect} />
      </TestWrapper>
    );

    const newPatientButton = screen.getByText('New Patient');
    fireEvent.click(newPatientButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Patient')).toBeInTheDocument();
    });
  });

  it('allows searching for patients', async () => {
    render(
      <TestWrapper>
        <PatientSelection onPatientSelect={mockOnPatientSelect} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by name, MRN, or phone number...'
    );
    fireEvent.change(searchInput, { target: { value: 'John' } });

    expect(searchInput).toHaveValue('John');
  });

  it('validates required fields in new patient form', async () => {
    render(
      <TestWrapper>
        <PatientSelection onPatientSelect={mockOnPatientSelect} />
      </TestWrapper>
    );

    // Open modal
    fireEvent.click(screen.getByText('New Patient'));

    await waitFor(() => {
      expect(screen.getByText('Create New Patient')).toBeInTheDocument();
    });

    // Check that required fields are marked as required
    const firstNameInput = screen.getByLabelText(/First Name/);
    const lastNameInput = screen.getByLabelText(/Last Name/);

    expect(firstNameInput).toBeRequired();
    expect(lastNameInput).toBeRequired();
  });

  it('shows continue button when patient is selected and onNext is provided', () => {
    const mockOnNext = vi.fn();

    render(
      <TestWrapper>
        <PatientSelection
          onPatientSelect={mockOnPatientSelect}
          selectedPatient={mockPatient}
          onNext={mockOnNext}
        />
      </TestWrapper>
    );

    const continueButton = screen.getByText('Continue');
    expect(continueButton).toBeInTheDocument();

    fireEvent.click(continueButton);
    expect(mockOnNext).toHaveBeenCalled();
  });
});
