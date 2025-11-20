import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import FollowUpScheduler from '../FollowUpScheduler';
import { useMTRStore } from '../../stores/mtrStore';
import { useUIStore } from '../../stores';
import type { MTRFollowUp, MTRIntervention } from '../../types/mtr';

// Mock the stores
vi.mock('../../stores/mtrStore');
vi.mock('../../stores');

// Mock date-fns functions
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'January 1, 2024 at 10:00 AM'),
  isAfter: vi.fn(() => false),
  isBefore: vi.fn(() => false),
  addDays: vi.fn(
    (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  ),
  differenceInDays: vi.fn(() => 5),
}));

const mockMTRStore = {
  followUps: [] as MTRFollowUp[],
  scheduleFollowUp: vi.fn(),
  updateFollowUp: vi.fn(),
  completeFollowUp: vi.fn(),
  rescheduleFollowUp: vi.fn(),
  loading: {},
  errors: {},
};

const mockUIStore = {
  addNotification: vi.fn(),
};

const mockFollowUps: MTRFollowUp[] = [
  {
    _id: '1',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'phone_call',
    priority: 'high',
    description: 'Follow up on medication adherence',
    objectives: ['Check adherence', 'Assess side effects'],
    scheduledDate: '2024-01-15T10:00:00Z',
    estimatedDuration: 30,
    assignedTo: 'Dr. Smith',
    status: 'scheduled',
    relatedInterventions: [],
    createdBy: 'user1',
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    _id: '2',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'appointment',
    priority: 'medium',
    description: 'In-person consultation',
    objectives: ['Review therapy plan'],
    scheduledDate: '2024-01-10T14:00:00Z',
    estimatedDuration: 60,
    assignedTo: 'Dr. Johnson',
    status: 'completed',
    completedAt: '2024-01-10T14:30:00Z',
    outcome: {
      status: 'successful',
      notes: 'Patient showed good adherence',
      nextActions: ['Continue current therapy'],
      adherenceImproved: true,
      problemsResolved: ['Adherence issue'],
      newProblemsIdentified: [],
    },
    relatedInterventions: [],
    createdBy: 'user1',
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
  },
];

const mockInterventions: MTRIntervention[] = [
  {
    _id: 'int1',
    workplaceId: 'workplace1',
    reviewId: 'review1',
    patientId: 'patient1',
    type: 'recommendation',
    category: 'medication_change',
    description: 'Recommend dose adjustment',
    rationale: 'Patient experiencing side effects',
    targetAudience: 'prescriber',
    communicationMethod: 'phone',
    outcome: 'pending',
    outcomeDetails: '',
    followUpRequired: true,
    followUpCompleted: false,
    documentation: 'Called prescriber about dose adjustment',
    attachments: [],
    priority: 'high',
    urgency: 'within_24h',
    pharmacistId: 'pharm1',
    performedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user1',
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
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {component}
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

describe('FollowUpScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMTRStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockMTRStore
    );
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockUIStore
    );
  });

  const defaultProps = {
    reviewId: 'review1',
    interventions: mockInterventions,
  };

  describe('Basic Rendering', () => {
    it('renders the component with header and schedule button', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      expect(screen.getByText('Follow-Up Scheduler')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /schedule follow-up/i })
      ).toBeInTheDocument();
    });

    it('renders summary cards', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('renders tabs for different follow-up categories', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /overdue/i })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /upcoming/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /all scheduled/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /completed/i })
      ).toBeInTheDocument();
    });

    it('shows empty state when no follow-ups exist', () => {
      mockMTRStore.followUps = [];
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      expect(screen.getByText('No overdue follow-ups')).toBeInTheDocument();
    });
  });

  describe('Follow-Up Creation Dialog', () => {
    it('opens dialog when schedule button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      expect(screen.getByText('Schedule New Follow-Up')).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('validates required fields before submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /^schedule$/i }));

      await waitFor(() => {
        expect(mockUIStore.addNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Description is required',
            type: 'error',
          })
        );
      });
    });

    it('creates follow-up with valid data', async () => {
      const user = userEvent.setup();
      mockMTRStore.scheduleFollowUp.mockResolvedValue(undefined);
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      // Fill in required fields
      await user.type(screen.getByLabelText(/description/i), 'Test follow-up');
      await user.type(screen.getByLabelText(/assigned to/i), 'Dr. Test');

      await user.click(screen.getByRole('button', { name: /^schedule$/i }));

      await waitFor(() => {
        expect(mockMTRStore.scheduleFollowUp).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test follow-up',
            assignedTo: 'Dr. Test',
          })
        );
      });
    });

    it('handles objectives management correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      // Add an objective
      await user.click(screen.getByRole('button', { name: /add objective/i }));
      const objectiveInput = screen.getByPlaceholderText('Objective 1');
      await user.type(objectiveInput, 'Test objective');

      expect(objectiveInput).toHaveValue('Test objective');
    });
  });

  describe('Follow-Up Display with Data', () => {
    beforeEach(() => {
      mockMTRStore.followUps = mockFollowUps;
    });

    it('displays follow-up cards when data is present', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      // Switch to "All Scheduled" tab to see scheduled follow-ups
      fireEvent.click(screen.getByRole('tab', { name: /all scheduled/i }));

      expect(
        screen.getByText('Follow up on medication adherence')
      ).toBeInTheDocument();
    });

    it('displays follow-up information correctly', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      // Switch to "All Scheduled" tab
      fireEvent.click(screen.getByRole('tab', { name: /all scheduled/i }));

      expect(
        screen.getByText('Follow up on medication adherence')
      ).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      expect(screen.getByText('Assigned to: Dr. Smith')).toBeInTheDocument();
    });

    it('displays completed follow-ups in completed tab', () => {
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      // Switch to completed tab
      fireEvent.click(screen.getByRole('tab', { name: /completed/i }));

      expect(screen.getByText('In-person consultation')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs correctly', async () => {
      const user = userEvent.setup();
      mockMTRStore.followUps = mockFollowUps;
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      // Click on completed tab
      await user.click(screen.getByRole('tab', { name: /completed/i }));

      // Should show completed follow-ups
      expect(screen.getByText('In-person consultation')).toBeInTheDocument();

      // Click on all scheduled tab
      await user.click(screen.getByRole('tab', { name: /all scheduled/i }));

      // Should show scheduled follow-ups
      expect(
        screen.getByText('Follow up on medication adherence')
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error messages when operations fail', async () => {
      const user = userEvent.setup();
      mockMTRStore.scheduleFollowUp.mockRejectedValue(
        new Error('Network error')
      );
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      // Fill required fields
      await user.type(screen.getByLabelText(/description/i), 'Test follow-up');
      await user.type(screen.getByLabelText(/assigned to/i), 'Dr. Test');

      await user.click(screen.getByRole('button', { name: /^schedule$/i }));

      await waitFor(() => {
        expect(mockUIStore.addNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Network error',
            type: 'error',
          })
        );
      });
    });

    it('shows error alert when there are store errors', () => {
      mockMTRStore.errors = {
        scheduleFollowUp: 'Failed to schedule follow-up',
      };
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      expect(
        screen.getByText('Failed to schedule follow-up')
      ).toBeInTheDocument();
    });

    it('disables buttons during loading states', () => {
      mockMTRStore.loading = { scheduleFollowUp: true };
      renderWithProviders(<FollowUpScheduler {...defaultProps} />);

      const scheduleButton = screen.getByRole('button', {
        name: /schedule follow-up/i,
      });
      expect(scheduleButton).toBeDisabled();
    });
  });

  describe('Callbacks', () => {
    it('calls onFollowUpScheduled when follow-up is created', async () => {
      const user = userEvent.setup();
      const onFollowUpScheduled = vi.fn();
      mockMTRStore.scheduleFollowUp.mockResolvedValue(undefined);

      renderWithProviders(
        <FollowUpScheduler
          {...defaultProps}
          onFollowUpScheduled={onFollowUpScheduled}
        />
      );

      await user.click(
        screen.getByRole('button', { name: /schedule follow-up/i })
      );

      await user.type(screen.getByLabelText(/description/i), 'Test follow-up');
      await user.type(screen.getByLabelText(/assigned to/i), 'Dr. Test');

      await user.click(screen.getByRole('button', { name: /^schedule$/i }));

      await waitFor(() => {
        expect(onFollowUpScheduled).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test follow-up',
            assignedTo: 'Dr. Test',
          })
        );
      });
    });
  });

  describe('Component Integration', () => {
    it('renders without crashing with minimal props', () => {
      renderWithProviders(
        <FollowUpScheduler reviewId="test-review" interventions={[]} />
      );

      expect(screen.getByText('Follow-Up Scheduler')).toBeInTheDocument();
    });

    it('handles empty interventions array', () => {
      renderWithProviders(
        <FollowUpScheduler reviewId="test-review" interventions={[]} />
      );

      expect(
        screen.getByRole('button', { name: /schedule follow-up/i })
      ).toBeInTheDocument();
    });
  });
});
