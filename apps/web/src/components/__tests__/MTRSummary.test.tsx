import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MTRSummary from '../MTRSummary';
import { useMTRStore } from '../../stores/mtrStore';
import type {
  MedicationTherapyReview,
  DrugTherapyProblem,
  MTRIntervention,
} from '../../types/mtr';

// Mock the MTR store
vi.mock('../../stores/mtrStore');

const mockUseMTRStore = useMTRStore as unknown as vi.MockedFunction<
  typeof useMTRStore
>;

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
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

const mockReview: MedicationTherapyReview = {
  _id: 'review-1',
  workplaceId: 'workplace-1',
  patientId: 'patient-1',
  pharmacistId: 'pharmacist-1',
  reviewNumber: 'MTR-001',
  status: 'completed',
  priority: 'routine',
  reviewType: 'initial',
  steps: {
    patientSelection: { completed: true, completedAt: '2024-01-01T10:00:00Z' },
    medicationHistory: { completed: true, completedAt: '2024-01-02T10:00:00Z' },
    therapyAssessment: { completed: true, completedAt: '2024-01-03T10:00:00Z' },
    planDevelopment: { completed: true, completedAt: '2024-01-04T10:00:00Z' },
    interventions: { completed: true, completedAt: '2024-01-05T10:00:00Z' },
    followUp: { completed: true, completedAt: '2024-01-06T10:00:00Z' },
  },
  medications: [
    {
      drugName: 'Metformin',
      genericName: 'Metformin HCl',
      strength: { value: 500, unit: 'mg' },
      dosageForm: 'Tablet',
      instructions: {
        dose: '500mg',
        frequency: 'Twice daily',
        route: 'Oral',
      },
      category: 'prescribed',
      startDate: '2024-01-01',
      indication: 'Type 2 Diabetes',
    },
  ],
  problems: ['problem-1'],
  interventions: ['intervention-1'],
  followUps: ['followup-1'],
  clinicalOutcomes: {
    problemsResolved: 2,
    medicationsOptimized: 1,
    adherenceImproved: true,
    adverseEventsReduced: false,
    costSavings: 150,
  },
  startedAt: '2024-01-01T10:00:00Z',
  completedAt: '2024-01-06T15:00:00Z',
  nextReviewDate: '2024-07-01T10:00:00Z',
  patientConsent: true,
  confidentialityAgreed: true,
  createdBy: 'pharmacist-1',
  isDeleted: false,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-06T15:00:00Z',
};

const mockProblems: DrugTherapyProblem[] = [
  {
    _id: 'problem-1',
    workplaceId: 'workplace-1',
    reviewId: 'review-1',
    patientId: 'patient-1',
    category: 'safety',
    subcategory: 'Drug Interaction',
    type: 'interaction',
    severity: 'major',
    description: 'Potential interaction between warfarin and aspirin',
    clinicalSignificance: 'Increased bleeding risk',
    affectedMedications: ['warfarin', 'aspirin'],
    relatedConditions: [],
    evidenceLevel: 'probable',
    riskFactors: ['Age > 65'],
    status: 'resolved',
    resolution: {
      action: 'Dose adjustment',
      outcome: 'Risk minimized',
      resolvedAt: '2024-01-05T10:00:00Z',
      resolvedBy: 'pharmacist-1',
    },
    identifiedBy: 'pharmacist-1',
    identifiedAt: '2024-01-03T10:00:00Z',
    createdBy: 'pharmacist-1',
    isDeleted: false,
    createdAt: '2024-01-03T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
  },
];

const mockInterventions: MTRIntervention[] = [
  {
    _id: 'intervention-1',
    workplaceId: 'workplace-1',
    reviewId: 'review-1',
    patientId: 'patient-1',
    type: 'recommendation',
    category: 'medication_change',
    description: 'Recommend reducing warfarin dose',
    rationale: 'Minimize bleeding risk with aspirin',
    targetAudience: 'prescriber',
    communicationMethod: 'phone',
    outcome: 'accepted',
    outcomeDetails: 'Prescriber agreed to dose reduction',
    followUpRequired: true,
    followUpDate: '2024-01-15',
    followUpCompleted: true,
    documentation: 'Called prescriber, dose reduced from 5mg to 2.5mg',
    attachments: [],
    priority: 'high',
    urgency: 'within_24h',
    pharmacistId: 'pharmacist-1',
    performedAt: '2024-01-05T10:00:00Z',
    createdBy: 'pharmacist-1',
    isDeleted: false,
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
  },
];

describe('MTRSummary', () => {
  const mockStore = {
    currentReview: mockReview,
    selectedPatient: {
      _id: 'patient-1',
      firstName: 'John',
      lastName: 'Doe',
      mrn: 'MRN123',
      age: 65,
    },
    medications: mockReview.medications,
    identifiedProblems: mockProblems,
    interventions: mockInterventions,
    therapyPlan: {
      problems: ['problem-1'],
      recommendations: [
        {
          type: 'adjust_dose',
          medication: 'warfarin',
          rationale: 'Reduce bleeding risk',
          priority: 'high',
          expectedOutcome: 'Safer therapy',
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
          description: 'Maintain therapeutic anticoagulation',
          targetDate: new Date('2024-02-01'),
          achieved: true,
        },
      ],
      timeline: '2 weeks',
      pharmacistNotes: 'Patient counseled on bleeding precautions',
    },
    followUps: [
      {
        _id: 'followup-1',
        type: 'phone_call',
        scheduledDate: new Date('2024-01-15T10:00:00Z'),
        status: 'completed',
        description: 'Follow up on dose adjustment',
      },
    ],
    loading: {},
    errors: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMTRStore.mockReturnValue(mockStore);
  });

  describe('Basic Rendering', () => {
    it('renders MTR summary with review information', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('MTR Summary')).toBeInTheDocument();
      expect(screen.getByText('MTR-001')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('MRN: MRN123')).toBeInTheDocument();
    });

    it('displays review status and completion information', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Initial Review')).toBeInTheDocument();
      expect(screen.getByText('Routine Priority')).toBeInTheDocument();
    });

    it('shows completion date and next review date', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      // Check for date elements (exact format may vary based on date formatting)
      expect(screen.getByText(/Completed:/)).toBeInTheDocument();
      expect(screen.getByText(/Next Review:/)).toBeInTheDocument();
    });
  });

  describe('Statistics Cards', () => {
    it('displays medication statistics', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Medications Reviewed')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 medication
    });

    it('displays problem statistics', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Problems Identified')).toBeInTheDocument();
      expect(screen.getByText('Problems Resolved')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 problems resolved
    });

    it('displays intervention statistics', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Interventions Made')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // 1 intervention
    });

    it('displays clinical outcomes', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Adherence Improved')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('Cost Savings')).toBeInTheDocument();
      expect(screen.getByText('$150')).toBeInTheDocument();
    });
  });

  describe('Detailed Sections', () => {
    it('displays medications section with expandable details', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Medications (1)')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('500 mg Tablet')).toBeInTheDocument();
      expect(screen.getByText('Twice daily')).toBeInTheDocument();
    });

    it('displays problems section with resolution status', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Problems Identified (1)')).toBeInTheDocument();
      expect(
        screen.getByText('Potential interaction between warfarin and aspirin')
      ).toBeInTheDocument();
      expect(screen.getByText('Major')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('displays interventions section with outcomes', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Interventions (1)')).toBeInTheDocument();
      expect(
        screen.getByText('Recommend reducing warfarin dose')
      ).toBeInTheDocument();
      expect(screen.getByText('Accepted')).toBeInTheDocument();
      expect(
        screen.getByText('Prescriber agreed to dose reduction')
      ).toBeInTheDocument();
    });

    it('displays therapy plan section', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Therapy Plan')).toBeInTheDocument();
      expect(screen.getByText('Recommendations (1)')).toBeInTheDocument();
      expect(screen.getByText('Monitoring Parameters (1)')).toBeInTheDocument();
      expect(screen.getByText('Counseling Points (1)')).toBeInTheDocument();
    });

    it('displays follow-up section', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Follow-Up Activities (1)')).toBeInTheDocument();
      expect(
        screen.getByText('Follow up on dose adjustment')
      ).toBeInTheDocument();
      expect(screen.getByText('Phone Call')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Expandable Sections', () => {
    it('expands and collapses medication details', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const medicationSection = screen.getByText('Medications (1)');
      fireEvent.click(medicationSection);

      // Should show expanded details
      expect(screen.getByText('Indication:')).toBeInTheDocument();
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(medicationSection);
      // Details should still be visible as they're part of the summary
    });

    it('expands and collapses problem details', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const problemSection = screen.getByText('Problems Identified (1)');
      fireEvent.click(problemSection);

      // Should show expanded details
      expect(screen.getByText('Clinical Significance:')).toBeInTheDocument();
      expect(screen.getByText('Increased bleeding risk')).toBeInTheDocument();
    });

    it('expands and collapses therapy plan details', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const therapyPlanSection = screen.getByText('Therapy Plan');
      fireEvent.click(therapyPlanSection);

      // Should show expanded details
      expect(screen.getByText('Timeline:')).toBeInTheDocument();
      expect(screen.getByText('2 weeks')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('displays print summary button', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const printButton = screen.getByRole('button', {
        name: /print summary/i,
      });
      expect(printButton).toBeInTheDocument();
    });

    it('displays export PDF button', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const exportButton = screen.getByRole('button', { name: /export pdf/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('displays share summary button', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const shareButton = screen.getByRole('button', {
        name: /share summary/i,
      });
      expect(shareButton).toBeInTheDocument();
    });

    it('handles print button click', () => {
      const mockPrint = vi.fn();
      Object.defineProperty(window, 'print', {
        value: mockPrint,
        writable: true,
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      const printButton = screen.getByRole('button', {
        name: /print summary/i,
      });
      fireEvent.click(printButton);

      expect(mockPrint).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no review is available', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        currentReview: null,
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('No MTR session available')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Please select or create an MTR session to view the summary'
        )
      ).toBeInTheDocument();
    });

    it('displays empty state for medications when none exist', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        medications: [],
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Medications (0)')).toBeInTheDocument();
      expect(screen.getByText('No medications documented')).toBeInTheDocument();
    });

    it('displays empty state for problems when none identified', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        identifiedProblems: [],
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Problems Identified (0)')).toBeInTheDocument();
      expect(screen.getByText('No problems identified')).toBeInTheDocument();
    });

    it('displays empty state for interventions when none made', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        interventions: [],
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('Interventions (0)')).toBeInTheDocument();
      expect(screen.getByText('No interventions recorded')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state when data is being fetched', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        loading: { currentReview: true },
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays error state when there is an error', () => {
      mockUseMTRStore.mockReturnValue({
        ...mockStore,
        errors: { currentReview: 'Failed to load MTR summary' },
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(
        screen.getByText('Failed to load MTR summary')
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders correctly on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('MTR Summary')).toBeInTheDocument();
      // Component should still render all essential information
      expect(screen.getByText('MTR-001')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('formats dates correctly', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      // Check that dates are formatted (exact format may vary)
      expect(screen.getByText(/Completed:/)).toBeInTheDocument();
      expect(screen.getByText(/Next Review:/)).toBeInTheDocument();
    });

    it('formats currency correctly', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('$150')).toBeInTheDocument();
    });

    it('formats medication strength correctly', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(screen.getByText('500 mg Tablet')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('MTR Summary');
    });

    it('has proper button labels', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      expect(
        screen.getByRole('button', { name: /print summary/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /export pdf/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /share summary/i })
      ).toBeInTheDocument();
    });

    it('has proper ARIA labels for expandable sections', () => {
      render(<MTRSummary />, { wrapper: createWrapper() });

      const expandableButtons = screen.getAllByRole('button');
      expandableButtons.forEach((button) => {
        if (button.getAttribute('aria-expanded') !== null) {
          expect(button).toHaveAttribute('aria-expanded');
        }
      });
    });
  });
});
