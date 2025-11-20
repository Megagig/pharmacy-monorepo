import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import InterventionsDashboard from '../InterventionsDashboard';
import { useMTRStore } from '../../stores/mtrStore';
import { MTRIntervention, MedicationTherapyReview } from '../../types/mtr';

// Mock the MTR store
vi.mock('../../stores/mtrStore');

const mockUseMTRStore = useMTRStore as jest.MockedFunction<typeof useMTRStore>;

// Mock data
const mockInterventions: MTRIntervention[] = [
  {
    _id: '1',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'recommendation',
    category: 'medication_change',
    description: 'Recommend reducing dosage of medication X',
    rationale: 'Patient experiencing side effects',
    targetAudience: 'prescriber',
    communicationMethod: 'phone',
    outcome: 'pending',
    outcomeDetails: '',
    followUpRequired: true,
    followUpDate: '2024-01-15',
    followUpCompleted: false,
    documentation: 'Detailed documentation here',
    attachments: [],
    priority: 'high',
    urgency: 'within_24h',
    pharmacistId: 'pharmacist1',
    performedAt: '2024-01-10T10:00:00Z',
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
  {
    _id: '2',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'counseling',
    category: 'adherence_support',
    description: 'Counseled patient on medication adherence',
    rationale: 'Patient missing doses frequently',
    targetAudience: 'patient',
    communicationMethod: 'in_person',
    outcome: 'accepted',
    outcomeDetails: 'Patient agreed to use pill organizer',
    followUpRequired: false,
    followUpCompleted: false,
    documentation: 'Patient education provided',
    attachments: [],
    priority: 'medium',
    urgency: 'routine',
    pharmacistId: 'pharmacist1',
    performedAt: '2024-01-08T14:30:00Z',
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: '2024-01-08T14:30:00Z',
    updatedAt: '2024-01-08T14:30:00Z',
  },
  {
    _id: '3',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'monitoring',
    category: 'monitoring_plan',
    description: 'Monitor blood pressure weekly',
    rationale: 'New antihypertensive medication started',
    targetAudience: 'patient',
    communicationMethod: 'written',
    outcome: 'modified',
    outcomeDetails: 'Patient will monitor twice weekly instead',
    followUpRequired: true,
    followUpDate: '2024-01-20',
    followUpCompleted: false,
    documentation: 'Monitoring instructions provided',
    attachments: [],
    priority: 'medium',
    urgency: 'within_week',
    pharmacistId: 'pharmacist1',
    performedAt: '2024-01-05T09:15:00Z',
    createdBy: 'pharmacist1',
    isDeleted: false,
    createdAt: '2024-01-05T09:15:00Z',
    updatedAt: '2024-01-05T09:15:00Z',
  },
];

const mockCurrentReview: MedicationTherapyReview = {
  _id: 'review1',
  workplaceId: 'workplace1',
  patientId: 'patient1',
  pharmacistId: 'pharmacist1',
  reviewNumber: 'MTR-001',
  status: 'in_progress',
  priority: 'routine',
  reviewType: 'initial',
  steps: {
    patientSelection: { completed: true, completedAt: '2024-01-01T10:00:00Z' },
    medicationHistory: { completed: true, completedAt: '2024-01-02T10:00:00Z' },
    therapyAssessment: { completed: true, completedAt: '2024-01-03T10:00:00Z' },
    planDevelopment: { completed: true, completedAt: '2024-01-04T10:00:00Z' },
    interventions: { completed: false },
    followUp: { completed: false },
  },
  medications: [],
  problems: [],
  interventions: ['1', '2', '3'],
  followUps: [],
  clinicalOutcomes: {
    problemsResolved: 0,
    medicationsOptimized: 0,
    adherenceImproved: false,
    adverseEventsReduced: false,
  },
  startedAt: '2024-01-01T10:00:00Z',
  patientConsent: true,
  confidentialityAgreed: true,
  createdBy: 'pharmacist1',
  isDeleted: false,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-10T10:00:00Z',
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const theme = createTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('InterventionsDashboard', () => {
  const mockRecordIntervention = vi.fn();
  const mockUpdateIntervention = vi.fn();
  const mockMarkInterventionComplete = vi.fn();
  const mockOnInterventionRecorded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseMTRStore.mockReturnValue({
      interventions: mockInterventions,
      currentReview: mockCurrentReview,
      therapyPlan: null,
      recordIntervention: mockRecordIntervention,
      updateIntervention: mockUpdateIntervention,
      markInterventionComplete: mockMarkInterventionComplete,
      loading: {},
      errors: {},
    });
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      reviewId: 'review1',
      onInterventionRecorded: mockOnInterventionRecorded,
    };

    return render(
      <TestWrapper>
        <InterventionsDashboard {...defaultProps} {...props} />
      </TestWrapper>
    );
  };

  describe('Component Rendering', () => {
    it('renders the dashboard with correct title', () => {
      renderComponent();
      expect(screen.getByText('Interventions Dashboard')).toBeInTheDocument();
    });

    it('displays statistics cards with correct values', () => {
      renderComponent();

      // Check statistics
      expect(screen.getByText('3')).toBeInTheDocument(); // Total
      expect(screen.getByText('1')).toBeInTheDocument(); // Pending
      expect(screen.getByText('2')).toBeInTheDocument(); // Follow-up required
      expect(screen.getByText('33%')).toBeInTheDocument(); // Success rate (1 accepted out of 3)
    });

    it('renders the Record Intervention button', () => {
      renderComponent();
      expect(
        screen.getByRole('button', { name: /record intervention/i })
      ).toBeInTheDocument();
    });

    it('displays tabs for different views', () => {
      renderComponent();
      expect(
        screen.getByRole('tab', { name: /timeline view/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /progress tracking/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /analytics/i })
      ).toBeInTheDocument();
    });
  });

  describe('Timeline View', () => {
    it('displays interventions in timeline format', () => {
      renderComponent();

      // Check that interventions are displayed
      expect(
        screen.getByText('Recommend reducing dosage of medication X')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Counseled patient on medication adherence')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Monitor blood pressure weekly')
      ).toBeInTheDocument();
    });

    it('shows intervention details correctly', () => {
      renderComponent();

      // Check intervention details
      expect(
        screen.getByText('Patient experiencing side effects')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Patient missing doses frequently')
      ).toBeInTheDocument();
      expect(
        screen.getByText('New antihypertensive medication started')
      ).toBeInTheDocument();
    });

    it('displays outcome chips with correct colors', () => {
      renderComponent();

      // Check outcome chips
      const pendingChips = screen.getAllByText('pending');
      const acceptedChips = screen.getAllByText('accepted');
      const modifiedChips = screen.getAllByText('modified');

      expect(pendingChips.length).toBeGreaterThan(0);
      expect(acceptedChips.length).toBeGreaterThan(0);
      expect(modifiedChips.length).toBeGreaterThan(0);
    });

    it('shows action buttons for pending interventions', () => {
      renderComponent();

      // Should show action buttons for pending intervention
      expect(
        screen.getByRole('button', { name: /mark accepted/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /mark modified/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /mark rejected/i })
      ).toBeInTheDocument();
    });

    it('displays follow-up alerts correctly', () => {
      renderComponent();

      // Check follow-up alerts
      const followUpAlerts = screen.getAllByText(/follow-up/i);
      expect(followUpAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Filters and Options', () => {
    it('renders filter accordion', async () => {
      renderComponent();

      const filtersButton = screen.getByText('Filters & Options');
      expect(filtersButton).toBeInTheDocument();

      // Expand filters
      await userEvent.click(filtersButton);

      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Outcome')).toBeInTheDocument();
      expect(screen.getByLabelText('Show Completed')).toBeInTheDocument();
    });

    it('filters interventions by type', async () => {
      renderComponent();

      // Expand filters
      const filtersButton = screen.getByText('Filters & Options');
      await userEvent.click(filtersButton);

      // Select recommendation type
      const typeSelect = screen.getByLabelText('Type');
      await userEvent.click(typeSelect);
      await userEvent.click(screen.getByText('Recommendation'));

      // Should only show recommendation interventions
      expect(
        screen.getByText('Recommend reducing dosage of medication X')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Counseled patient on medication adherence')
      ).not.toBeInTheDocument();
    });

    it('toggles show completed filter', async () => {
      renderComponent();

      // Expand filters
      const filtersButton = screen.getByText('Filters & Options');
      await userEvent.click(filtersButton);

      // Toggle show completed
      const showCompletedSwitch = screen.getByLabelText('Show Completed');
      await userEvent.click(showCompletedSwitch);

      // Should show all interventions including completed ones
      expect(
        screen.getByText('Counseled patient on medication adherence')
      ).toBeInTheDocument();
    });
  });

  describe('Intervention Recording Dialog', () => {
    it('opens dialog when Record Intervention button is clicked', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      expect(screen.getByText('Record New Intervention')).toBeInTheDocument();
    });

    it('renders all form fields in the dialog', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Check form fields
      expect(screen.getByLabelText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Target Audience')).toBeInTheDocument();
      expect(screen.getByLabelText('Communication Method')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Rationale')).toBeInTheDocument();
      expect(screen.getByLabelText('Priority')).toBeInTheDocument();
      expect(screen.getByLabelText('Urgency')).toBeInTheDocument();
      expect(screen.getByLabelText('Follow-up Required')).toBeInTheDocument();
      expect(screen.getByLabelText('Documentation')).toBeInTheDocument();
    });

    it('validates required fields before submission', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('enables submission when required fields are filled', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Fill required fields
      const descriptionField = screen.getByLabelText('Description');
      const rationaleField = screen.getByLabelText('Rationale');

      await userEvent.type(descriptionField, 'Test intervention description');
      await userEvent.type(rationaleField, 'Test rationale');

      const submitButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      expect(submitButton).not.toBeDisabled();
    });

    it('calls recordIntervention when form is submitted', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Fill required fields
      const descriptionField = screen.getByLabelText('Description');
      const rationaleField = screen.getByLabelText('Rationale');

      await userEvent.type(descriptionField, 'Test intervention description');
      await userEvent.type(rationaleField, 'Test rationale');

      const submitButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(submitButton);

      expect(mockRecordIntervention).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test intervention description',
          rationale: 'Test rationale',
        })
      );
    });

    it('shows follow-up date field when follow-up is required', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Toggle follow-up required
      const followUpSwitch = screen.getByLabelText('Follow-up Required');
      await userEvent.click(followUpSwitch);

      expect(screen.getByLabelText('Follow-up Date')).toBeInTheDocument();
    });
  });

  describe('Intervention Actions', () => {
    it('marks intervention as accepted when Mark Accepted is clicked', async () => {
      renderComponent();

      const acceptButton = screen.getByRole('button', {
        name: /mark accepted/i,
      });
      await userEvent.click(acceptButton);

      expect(mockMarkInterventionComplete).toHaveBeenCalledWith(
        '1',
        'accepted'
      );
    });

    it('marks intervention as modified when Mark Modified is clicked', async () => {
      renderComponent();

      const modifyButton = screen.getByRole('button', {
        name: /mark modified/i,
      });
      await userEvent.click(modifyButton);

      expect(mockMarkInterventionComplete).toHaveBeenCalledWith(
        '1',
        'modified'
      );
    });

    it('marks intervention as rejected when Mark Rejected is clicked', async () => {
      renderComponent();

      const rejectButton = screen.getByRole('button', {
        name: /mark rejected/i,
      });
      await userEvent.click(rejectButton);

      expect(mockMarkInterventionComplete).toHaveBeenCalledWith(
        '1',
        'rejected'
      );
    });

    it('opens edit dialog when edit button is clicked', async () => {
      renderComponent();

      const editButtons = screen.getAllByLabelText('Edit Intervention');
      await userEvent.click(editButtons[0]);

      expect(screen.getByText('Edit Intervention')).toBeInTheDocument();
    });
  });

  describe('Progress Tracking Tab', () => {
    it('switches to progress tracking tab', async () => {
      renderComponent();

      const progressTab = screen.getByRole('tab', {
        name: /progress tracking/i,
      });
      await userEvent.click(progressTab);

      expect(screen.getByText('Follow-up Required')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('displays interventions requiring follow-up', async () => {
      renderComponent();

      const progressTab = screen.getByRole('tab', {
        name: /progress tracking/i,
      });
      await userEvent.click(progressTab);

      // Should show interventions with follow-up required
      expect(
        screen.getByText('Recommend reducing dosage of medication X')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Monitor blood pressure weekly')
      ).toBeInTheDocument();
    });
  });

  describe('Analytics Tab', () => {
    it('switches to analytics tab', async () => {
      renderComponent();

      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await userEvent.click(analyticsTab);

      expect(screen.getByText('Intervention Types')).toBeInTheDocument();
      expect(screen.getByText('Outcome Distribution')).toBeInTheDocument();
    });

    it('displays intervention type distribution', async () => {
      renderComponent();

      const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
      await userEvent.click(analyticsTab);

      // Should show different intervention types
      expect(screen.getByText('recommendation')).toBeInTheDocument();
      expect(screen.getByText('counseling')).toBeInTheDocument();
      expect(screen.getByText('monitoring')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('displays empty state when no interventions exist', () => {
      mockUseMTRStore.mockReturnValue({
        interventions: [],
        currentReview: mockCurrentReview,
        therapyPlan: null,
        recordIntervention: mockRecordIntervention,
        updateIntervention: mockUpdateIntervention,
        markInterventionComplete: mockMarkInterventionComplete,
        loading: {},
        errors: {},
      });

      renderComponent();

      expect(
        screen.getByText('No interventions recorded yet')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Start by recording your first intervention for this MTR session'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /record first intervention/i })
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when there is an error', () => {
      mockUseMTRStore.mockReturnValue({
        interventions: mockInterventions,
        currentReview: mockCurrentReview,
        therapyPlan: null,
        recordIntervention: mockRecordIntervention,
        updateIntervention: mockUpdateIntervention,
        markInterventionComplete: mockMarkInterventionComplete,
        loading: {},
        errors: {
          recordIntervention: 'Failed to record intervention',
        },
      });

      renderComponent();

      expect(
        screen.getByText('Failed to record intervention')
      ).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('disables record button when loading', () => {
      mockUseMTRStore.mockReturnValue({
        interventions: mockInterventions,
        currentReview: mockCurrentReview,
        therapyPlan: null,
        recordIntervention: mockRecordIntervention,
        updateIntervention: mockUpdateIntervention,
        markInterventionComplete: mockMarkInterventionComplete,
        loading: {
          recordIntervention: true,
        },
        errors: {},
      });

      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      expect(recordButton).toBeDisabled();
    });
  });

  describe('Communication Templates', () => {
    it('auto-populates description when category and audience change', async () => {
      renderComponent();

      const recordButton = screen.getByRole('button', {
        name: /record intervention/i,
      });
      await userEvent.click(recordButton);

      // Change category to adherence_support
      const categorySelect = screen.getByLabelText('Category');
      await userEvent.click(categorySelect);
      await userEvent.click(screen.getByText('Adherence Support'));

      // Change target audience to patient
      const audienceSelect = screen.getByLabelText('Target Audience');
      await userEvent.click(audienceSelect);
      await userEvent.click(screen.getByText('Patient'));

      // Description should be auto-populated with template
      const descriptionField = screen.getByLabelText('Description');
      expect(descriptionField).toHaveValue(
        expect.stringContaining('adherence')
      );
    });
  });
});
