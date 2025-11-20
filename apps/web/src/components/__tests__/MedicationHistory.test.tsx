import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi } from 'vitest';
import MedicationHistory from '../MedicationHistory';
import { useMTRStore } from '../../stores/mtrStore';

// Mock the MTR store
vi.mock('../../stores/mtrStore');

// Mock the medication service
vi.mock('../../services/medicationService', () => ({
  medicationService: {
    getMedicationsByPatient: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
  },
}));

const mockUseMTRStore = useMTRStore as unknown as vi.MockedFunction<
  typeof useMTRStore
>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {children}
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

describe('MedicationHistory Component', () => {
  const mockProps = {
    patientId: 'test-patient-id',
    onMedicationsUpdate: vi.fn(),
  };

  const mockStoreState = {
    medications: [],
    addMedication: vi.fn(),
    updateMedication: vi.fn(),
    removeMedication: vi.fn(),
    importMedications: vi.fn(),
    validateMedications: vi.fn().mockReturnValue([]),
    loading: {},
    errors: {},
    setLoading: vi.fn(),
    setError: vi.fn(),
    selectedPatient: {
      _id: 'test-patient-id',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN123',
      age: 45,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMTRStore.mockReturnValue(mockStoreState);
  });

  it('renders medication history component', () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(
      screen.getByText('Medication History Collection')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Document all medications including prescribed, over-the-counter, herbal, and supplements'
      )
    ).toBeInTheDocument();
  });

  it('displays patient information', () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('Patient: John Doe')).toBeInTheDocument();
    expect(screen.getByText('MRN: MRN123 • Age: 45')).toBeInTheDocument();
  });

  it('shows medication category tabs', () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(screen.getAllByText('Prescribed Medications')).toHaveLength(2); // Tab and section header
    expect(screen.getByText('Over-the-Counter')).toBeInTheDocument();
    expect(screen.getByText('Herbal/Traditional')).toBeInTheDocument();
    expect(screen.getByText('Supplements/Vitamins')).toBeInTheDocument();
  });

  it('opens medication modal when add button is clicked', async () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    const addButton = screen.getByRole('button', { name: /add medication/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Medication')).toBeInTheDocument();
    });
  });

  it('displays empty state when no medications are added', () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(
      screen.getByText('No Prescribed Medications Added')
    ).toBeInTheDocument();
    // Multiple buttons with similar text exist, so just check for the empty state message
  });

  it('calls onMedicationsUpdate when medications change', () => {
    const mockMedications = [
      {
        id: '1',
        drugName: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: { value: 500, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '1 tablet',
          frequency: 'Twice daily',
          route: 'Oral',
        },
        category: 'prescribed' as const,
        startDate: new Date(),
        indication: 'Pain relief',
      },
    ];

    mockUseMTRStore.mockReturnValue({
      ...mockStoreState,
      medications: mockMedications,
    });

    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(mockProps.onMedicationsUpdate).toHaveBeenCalledWith(mockMedications);
  });

  it('shows validation errors when present', () => {
    mockUseMTRStore.mockReturnValue({
      ...mockStoreState,
      validateMedications: vi.fn().mockReturnValue(['Drug name is required']),
    });

    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(
      screen.getByText('Please fix the following issues:')
    ).toBeInTheDocument();
    expect(screen.getByText('• Drug name is required')).toBeInTheDocument();
  });

  it('shows duplicate warnings when duplicates are detected', () => {
    const duplicateMedications = [
      {
        id: '1',
        drugName: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: { value: 500, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '1 tablet',
          frequency: 'Twice daily',
          route: 'Oral',
        },
        category: 'prescribed' as const,
        startDate: new Date(),
        indication: 'Pain relief',
      },
      {
        id: '2',
        drugName: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: { value: 1000, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '1 tablet',
          frequency: 'Once daily',
          route: 'Oral',
        },
        category: 'otc' as const,
        startDate: new Date(),
        indication: 'Headache',
      },
    ];

    mockUseMTRStore.mockReturnValue({
      ...mockStoreState,
      medications: duplicateMedications,
    });

    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('Potential Issues Detected:')).toBeInTheDocument();
    expect(
      screen.getByText('• Duplicate medication detected: Paracetamol')
    ).toBeInTheDocument();
  });

  it('calls import medications when import button is clicked', async () => {
    render(<MedicationHistory {...mockProps} />, { wrapper: createWrapper() });

    const importButton = screen.getByRole('button', {
      name: /import from records/i,
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockStoreState.importMedications).toHaveBeenCalledWith(
        'test-patient-id'
      );
    });
  });

  it('disables continue button when validation fails', () => {
    mockUseMTRStore.mockReturnValue({
      ...mockStoreState,
      validateMedications: vi.fn().mockReturnValue(['Validation error']),
    });

    const mockOnNext = vi.fn();
    render(<MedicationHistory {...mockProps} onNext={mockOnNext} />, {
      wrapper: createWrapper(),
    });

    const continueButton = screen.getByRole('button', {
      name: /continue to assessment/i,
    });
    expect(continueButton).toBeDisabled();
  });

  it('enables continue button when medications are valid', () => {
    const validMedications = [
      {
        id: '1',
        drugName: 'Paracetamol',
        genericName: 'Acetaminophen',
        strength: { value: 500, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '1 tablet',
          frequency: 'Twice daily',
          route: 'Oral',
        },
        category: 'prescribed' as const,
        startDate: new Date(),
        indication: 'Pain relief',
      },
    ];

    mockUseMTRStore.mockReturnValue({
      ...mockStoreState,
      medications: validMedications,
      validateMedications: vi.fn().mockReturnValue([]),
    });

    const mockOnNext = vi.fn();
    render(<MedicationHistory {...mockProps} onNext={mockOnNext} />, {
      wrapper: createWrapper(),
    });

    const continueButton = screen.getByRole('button', {
      name: /continue to assessment/i,
    });
    expect(continueButton).not.toBeDisabled();
  });
});
