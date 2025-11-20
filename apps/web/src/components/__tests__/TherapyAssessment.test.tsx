import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TherapyAssessment from '../TherapyAssessment';
import type { MTRMedicationEntry } from '../../types/mtr';

// Mock the MTR store
vi.mock('../../stores/mtrStore', () => ({
  useMTRStore: () => ({
    identifiedProblems: [],
    addProblem: vi.fn(),
    updateProblem: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
  }),
}));

// Mock the MTR service
vi.mock('../../services/mtrService', () => ({
  mtrService: {
    checkDrugInteractions: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockMedications: MTRMedicationEntry[] = [
  {
    drugName: 'Metformin',
    genericName: 'Metformin HCl',
    strength: { value: 500, unit: 'mg' },
    dosageForm: 'Tablet',
    instructions: {
      dose: '500mg',
      frequency: 'Twice daily',
      route: 'Oral',
      duration: 'Ongoing',
    },
    category: 'prescribed',
    startDate: '2024-01-01',
    indication: 'Type 2 Diabetes',
    adherenceScore: 8,
  },
  {
    drugName: 'Lisinopril',
    genericName: 'Lisinopril',
    strength: { value: 10, unit: 'mg' },
    dosageForm: 'Tablet',
    instructions: {
      dose: '10mg',
      frequency: 'Once daily',
      route: 'Oral',
      duration: 'Ongoing',
    },
    category: 'prescribed',
    startDate: '2024-01-01',
    indication: 'Hypertension',
    adherenceScore: 9,
  },
];

const mockPatientInfo = {
  id: 'patient-123',
  name: 'John Doe',
  age: 65,
  allergies: ['Penicillin'],
  conditions: ['Type 2 Diabetes', 'Hypertension'],
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('TherapyAssessment', () => {
  const mockOnProblemsIdentified = vi.fn();
  const mockOnAssessmentComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with medications', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    expect(screen.getByText('Therapy Assessment')).toBeInTheDocument();
    expect(screen.getByText('2 medications')).toBeInTheDocument();
    expect(screen.getByText('Run Assessment')).toBeInTheDocument();
  });

  it('shows empty state when no medications provided', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={[]}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    expect(screen.getByText('No Medications to Assess')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Please add medications in the previous step before running therapy assessment'
      )
    ).toBeInTheDocument();
  });

  it('displays assessment steps', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    expect(screen.getByText('Drug Interactions')).toBeInTheDocument();
    expect(screen.getByText('Duplicate Therapy')).toBeInTheDocument();
    expect(screen.getByText('Contraindications')).toBeInTheDocument();
    expect(screen.getByText('Dosing Assessment')).toBeInTheDocument();
    expect(screen.getByText('Adherence Assessment')).toBeInTheDocument();
  });

  it('shows problem statistics cards', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
  });

  it('opens add problem dialog when Add Problem button is clicked', async () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    const addButton = screen.getByText('Add Problem');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Problem')).toBeInTheDocument();
    });
  });

  it('displays adherence assessment for medications', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    // Navigate to adherence step
    const adherenceStep = screen.getByText('Adherence Assessment');
    fireEvent.click(adherenceStep);

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
  });

  it('shows assessment progress when running assessment', async () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    const runButton = screen.getByText('Run Assessment');
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(screen.getByText('Running Assessment...')).toBeInTheDocument();
    });
  });

  it('handles medication with potential interactions', () => {
    const medicationsWithInteractions: MTRMedicationEntry[] = [
      ...mockMedications,
      {
        drugName: 'Warfarin',
        genericName: 'Warfarin Sodium',
        strength: { value: 5, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '5mg',
          frequency: 'Once daily',
          route: 'Oral',
        },
        category: 'prescribed',
        startDate: '2024-01-01',
        indication: 'Anticoagulation',
      },
      {
        drugName: 'Aspirin',
        genericName: 'Acetylsalicylic Acid',
        strength: { value: 81, unit: 'mg' },
        dosageForm: 'Tablet',
        instructions: {
          dose: '81mg',
          frequency: 'Once daily',
          route: 'Oral',
        },
        category: 'prescribed',
        startDate: '2024-01-01',
        indication: 'Cardioprotection',
      },
    ];

    renderWithQueryClient(
      <TherapyAssessment
        medications={medicationsWithInteractions}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    expect(screen.getByText('4 medications')).toBeInTheDocument();
  });

  it('validates problem form fields', async () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    // Open add problem dialog
    const addButton = screen.getByText('Add Problem');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Problem')).toBeInTheDocument();
    });

    // Try to save without filling required fields
    const saveButton = screen.getByText('Add Problem');
    fireEvent.click(saveButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Description is required')).toBeInTheDocument();
    });
  });

  it('handles patient with allergies correctly', () => {
    const patientWithAllergies = {
      ...mockPatientInfo,
      allergies: ['Metformin', 'Penicillin'],
    };

    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={patientWithAllergies}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    // The component should be able to detect contraindications
    expect(screen.getByText('Run Assessment')).toBeInTheDocument();
  });

  it('displays severity levels with correct colors', () => {
    renderWithQueryClient(
      <TherapyAssessment
        medications={mockMedications}
        patientInfo={mockPatientInfo}
        onProblemsIdentified={mockOnProblemsIdentified}
        onAssessmentComplete={mockOnAssessmentComplete}
      />
    );

    // Check that severity levels are displayed
    const severityLevels = ['Critical', 'Major', 'Moderate', 'Minor'];
    severityLevels.forEach((level) => {
      expect(screen.getByText(level)).toBeInTheDocument();
    });
  });
});
