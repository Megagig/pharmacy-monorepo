import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PlanDevelopment from '../PlanDevelopment';
import type { DrugTherapyProblem, TherapyPlan } from '../../types/mtr';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { it } from 'date-fns/locale';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the MTR store
vi.mock('../../stores/mtrStore', () => ({
  useMTRStore: () => ({
    therapyPlan: null,
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    loading: {},
    errors: {},
  }),
}));

// Mock date picker components
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({
    label,
    ...props
  }: {
    label: string;
    [key: string]: unknown;
  }) => <input data-testid={`date-picker-${label}`} {...props} />,
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: vi.fn(),
}));

const mockProblems: DrugTherapyProblem[] = [
  {
    _id: 'problem1',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    category: 'safety',
    subcategory: 'Drug Interaction',
    type: 'interaction',
    severity: 'major',
    description: 'Potential interaction between warfarin and aspirin',
    clinicalSignificance: 'Monitor for increased bleeding risk',
    affectedMedications: ['warfarin', 'aspirin'],
    relatedConditions: [],
    evidenceLevel: 'probable',
    riskFactors: ['Multiple medications'],
    status: 'identified',
    identifiedBy: 'pharmacist1',
    identifiedAt: '2024-01-01T00:00:00Z',
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    _id: 'problem2',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    category: 'effectiveness',
    subcategory: 'Subtherapeutic Dose',
    type: 'doseTooLow',
    severity: 'moderate',
    description: 'Metformin dose may be too low',
    clinicalSignificance: 'May not achieve therapeutic effect',
    affectedMedications: ['metformin'],
    relatedConditions: [],
    evidenceLevel: 'possible',
    riskFactors: ['Low dose'],
    status: 'identified',
    identifiedBy: 'pharmacist1',
    identifiedAt: '2024-01-01T00:00:00Z',
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const renderWithProviders = (component: React.ReactElement) => {
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

describe('PlanDevelopment Component', () => {
  const mockOnPlanCreated = vi.fn();
  const mockOnPlanUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing when problems are provided', () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    expect(screen.getByText('Plan Development')).toBeInTheDocument();
    expect(screen.getByText('2 problems')).toBeInTheDocument();
  });

  it('shows empty state when no problems are provided', () => {
    renderWithProviders(
      <PlanDevelopment problems={[]} onPlanCreated={mockOnPlanCreated} />
    );

    expect(screen.getByText('No Problems Identified')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Please complete the therapy assessment step to identify problems before developing a plan'
      )
    ).toBeInTheDocument();
  });

  it('displays problems organized by severity', () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Check that problems are displayed
    expect(
      screen.getByText('Potential interaction between warfarin and aspirin')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Metformin dose may be too low')
    ).toBeInTheDocument();
  });

  it('allows navigation between tabs', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Check initial tab
    expect(screen.getByText('Problems & Recommendations')).toBeInTheDocument();

    // Click on monitoring tab
    fireEvent.click(screen.getByText('Monitoring Plan'));
    await waitFor(() => {
      expect(screen.getByText('Monitoring Parameters')).toBeInTheDocument();
    });

    // Click on goals tab
    fireEvent.click(screen.getByText('Goals & Counseling'));
    await waitFor(() => {
      expect(screen.getByText('Therapy Goals')).toBeInTheDocument();
      expect(screen.getByText('Patient Counseling Points')).toBeInTheDocument();
    });

    // Click on summary tab
    fireEvent.click(screen.getByText('Summary & Notes'));
    await waitFor(() => {
      expect(screen.getByText('Pharmacist Notes')).toBeInTheDocument();
      expect(screen.getByText('Plan Summary')).toBeInTheDocument();
    });
  });

  it('opens recommendation dialog when add recommendation is clicked', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /add recommendation/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens monitoring dialog when add parameter is clicked', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Navigate to monitoring tab
    fireEvent.click(screen.getByText('Monitoring Plan'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Parameter'));
    });

    await waitFor(() => {
      expect(screen.getByText('Add Monitoring Parameter')).toBeInTheDocument();
    });
  });

  it('opens goal dialog when add goal is clicked', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Navigate to goals tab
    fireEvent.click(screen.getByText('Goals & Counseling'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Goal'));
    });

    await waitFor(() => {
      expect(screen.getByText('Add Therapy Goal')).toBeInTheDocument();
    });
  });

  it('allows adding counseling points from templates', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Navigate to goals tab
    fireEvent.click(screen.getByText('Goals & Counseling'));

    await waitFor(() => {
      // Click on a counseling template chip
      const templateChips = screen.getAllByText(
        'Medication administration instructions'
      );
      fireEvent.click(templateChips[0]); // Click the first one (template chip)
    });

    await waitFor(() => {
      // Check that the counseling point was added (should appear twice now - template and added point)
      const counselingPoints = screen.getAllByText(
        'Medication administration instructions'
      );
      expect(counselingPoints.length).toBeGreaterThan(1);
    });
  });

  it('shows plan completeness percentage', () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    expect(screen.getByText(/Plan Completeness:/)).toBeInTheDocument();
  });

  it('disables save button when plan is not dirty', () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    const saveButton = screen.getByText('Save Plan');
    expect(saveButton).toBeDisabled();
  });

  it('renders with existing plan data', () => {
    const existingPlan: TherapyPlan = {
      problems: ['problem1'],
      recommendations: [
        {
          type: 'monitor',
          medication: 'warfarin',
          rationale: 'Monitor for bleeding',
          priority: 'high',
          expectedOutcome: 'Reduced bleeding risk',
        },
      ],
      monitoringPlan: [
        {
          parameter: 'INR',
          frequency: 'Weekly',
          targetValue: '2-3',
          notes: 'Monitor closely',
        },
      ],
      counselingPoints: ['Monitor for bleeding signs'],
      goals: [
        {
          description: 'Maintain therapeutic INR',
          targetDate: new Date('2024-02-01'),
          achieved: false,
        },
      ],
      timeline: 'Implement over 2 weeks',
      pharmacistNotes: 'Patient education provided',
    };

    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
        onPlanUpdated={mockOnPlanUpdated}
        existingPlan={existingPlan}
      />
    );

    expect(screen.getByText('Update Plan')).toBeInTheDocument();
  });
});

describe('PlanDevelopment Dialogs', () => {
  const mockOnPlanCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recommendation dialog validates required fields', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    fireEvent.click(screen.getByText('Add Recommendation'));

    await waitFor(() => {
      // Try to save without filling required fields
      fireEvent.click(screen.getByText('Save Recommendation'));
    });

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Rationale is required')).toBeInTheDocument();
      expect(
        screen.getByText('Expected outcome is required')
      ).toBeInTheDocument();
    });
  });

  it('monitoring dialog validates required fields', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Navigate to monitoring tab
    fireEvent.click(screen.getByText('Monitoring Plan'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Parameter'));
    });

    await waitFor(() => {
      // Try to save without filling required fields
      fireEvent.click(screen.getByText('Save Parameter'));
    });

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Parameter is required')).toBeInTheDocument();
      expect(screen.getByText('Frequency is required')).toBeInTheDocument();
    });
  });

  it('goal dialog validates required fields', async () => {
    renderWithProviders(
      <PlanDevelopment
        problems={mockProblems}
        onPlanCreated={mockOnPlanCreated}
      />
    );

    // Navigate to goals tab
    fireEvent.click(screen.getByText('Goals & Counseling'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Goal'));
    });

    await waitFor(() => {
      // Try to save without filling required fields
      fireEvent.click(screen.getByText('Save Goal'));
    });

    // Should show validation errors
    await waitFor(() => {
      expect(
        screen.getByText('Goal description is required')
      ).toBeInTheDocument();
    });
  });
});
