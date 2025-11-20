import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import MyAppointmentsList from '../MyAppointmentsList';
import * as usePatientPortalHooks from '../../../hooks/usePatientPortal';
import { PatientAppointment } from '../../../services/patientPortalService';

// Mock the hooks
vi.mock('../../../hooks/usePatientPortal');

const mockUseMyAppointments = vi.mocked(usePatientPortalHooks.useMyAppointments);
const mockUseRescheduleAppointment = vi.mocked(usePatientPortalHooks.useRescheduleAppointment);
const mockUseCancelAppointment = vi.mocked(usePatientPortalHooks.useCancelAppointment);
const mockUseAvailableSlots = vi.mocked(usePatientPortalHooks.useAvailableSlots);

// Mock data
const mockUpcomingAppointment: PatientAppointment = {
  _id: '1',
  type: 'mtm_session',
  title: 'Medication Therapy Management',
  description: 'Review current medications and discuss any concerns',
  scheduledDate: '2025-10-30',
  scheduledTime: '10:00',
  duration: 30,
  status: 'scheduled',
  confirmationStatus: 'pending',
  pharmacistName: 'Dr. John Smith',
  locationName: 'Main Pharmacy',
  canReschedule: true,
  canCancel: true,
};

const mockPastAppointment: PatientAppointment = {
  _id: '2',
  type: 'health_check',
  title: 'Health Check',
  description: 'General health assessment',
  scheduledDate: '2025-10-20',
  scheduledTime: '14:00',
  duration: 45,
  status: 'completed',
  confirmationStatus: 'confirmed',
  pharmacistName: 'Dr. Jane Doe',
  locationName: 'Main Pharmacy',
  canReschedule: false,
  canCancel: false,
};

const mockCancelledAppointment: PatientAppointment = {
  _id: '3',
  type: 'vaccination',
  title: 'Vaccination',
  scheduledDate: '2025-10-25',
  scheduledTime: '09:00',
  duration: 15,
  status: 'cancelled',
  confirmationStatus: 'declined',
  pharmacistName: 'Dr. Bob Wilson',
  locationName: 'Main Pharmacy',
  canReschedule: false,
  canCancel: false,
};

const mockAvailableSlots = [
  { time: '09:00', available: true, pharmacistId: 'pharm1', pharmacistName: 'Dr. John Smith' },
  { time: '09:30', available: true, pharmacistId: 'pharm1', pharmacistName: 'Dr. John Smith' },
  { time: '10:00', available: false, pharmacistId: 'pharm1', pharmacistName: 'Dr. John Smith' },
  { time: '10:30', available: true, pharmacistId: 'pharm2', pharmacistName: 'Dr. Jane Doe' },
];

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
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const renderComponent = (props = {}) => {
  const defaultProps = {
    workplaceId: 'workplace1',
    patientId: 'patient1',
    onAppointmentUpdate: vi.fn(),
  };

  return render(
    <TestWrapper>
      <MyAppointmentsList {...defaultProps} {...props} />
    </TestWrapper>
  );
};

describe('MyAppointmentsList', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    mockUseMyAppointments.mockReturnValue({
      data: {
        success: true,
        data: {
          appointments: [mockUpcomingAppointment, mockPastAppointment, mockCancelledAppointment],
          hasMore: false,
        },
        message: 'Success',
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    mockUseAvailableSlots.mockReturnValue({
      data: {
        success: true,
        data: {
          slots: mockAvailableSlots,
          pharmacists: [
            { _id: 'pharm1', name: 'Dr. John Smith' },
            { _id: 'pharm2', name: 'Dr. Jane Doe' },
          ],
        },
        message: 'Success',
        timestamp: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
    } as any);

    mockUseRescheduleAppointment.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'rescheduled' } },
      }),
      isPending: false,
    } as any);

    mockUseCancelAppointment.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'cancelled' } },
      }),
      isPending: false,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with title', () => {
      renderComponent();
      expect(screen.getByText('My Appointments')).toBeInTheDocument();
    });

    it('displays loading state', () => {
      mockUseMyAppointments.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays error state with retry button', () => {
      const mockRefetch = vi.fn();
      mockUseMyAppointments.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load'),
        refetch: mockRefetch,
      } as any);

      renderComponent();
      
      expect(screen.getByText('Failed to load appointments. Please try again.')).toBeInTheDocument();
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('displays summary cards with correct counts', () => {
      renderComponent();
      
      // Should show 1 upcoming (excluding cancelled)
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
      
      // Should show 2 past (completed + cancelled appointments)
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Past')).toBeInTheDocument();
    });

    it('displays tabs with correct counts', () => {
      renderComponent();
      
      expect(screen.getByText('Upcoming (1)')).toBeInTheDocument();
      expect(screen.getByText('Past (2)')).toBeInTheDocument();
    });
  });

  describe('Appointment Display', () => {
    it('displays upcoming appointments correctly', () => {
      renderComponent();
      
      // Should be on upcoming tab by default
      expect(screen.getByText('Medication Therapy Management')).toBeInTheDocument();
      expect(screen.getByText('Dr. John Smith')).toBeInTheDocument();
      expect(screen.getByText('Main Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });

    it('displays past appointments when switching tabs', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Click on Past tab - should show 2 past appointments (completed + cancelled)
      await user.click(screen.getByText('Past (2)'));
      
      // Use getAllByText to handle multiple elements with same text
      expect(screen.getAllByText('Health Check')[0]).toBeInTheDocument();
      expect(screen.getByText('Dr. Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('displays correct status badges', () => {
      renderComponent();
      
      // Check upcoming appointment status
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });

    it('shows action buttons for upcoming appointments', () => {
      renderComponent();
      
      // Should show view, reschedule, and cancel buttons for upcoming appointments
      expect(screen.getByLabelText('View Details')).toBeInTheDocument();
      expect(screen.getByLabelText('Reschedule')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
    });

    it('hides reschedule and cancel buttons for past appointments', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Switch to past tab
      await user.click(screen.getByText('Past (2)'));
      
      // Should only show view details button
      expect(screen.getAllByLabelText('View Details')[0]).toBeInTheDocument();
      expect(screen.queryByLabelText('Reschedule')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('Appointment Details Dialog', () => {
    it('opens details dialog when view button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('View Details'));
      
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    });

    it('closes details dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('View Details'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      await user.click(screen.getByText('Close'));
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Reschedule Functionality', () => {
    it('opens reschedule dialog when reschedule button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Reschedule'));
      
      expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument();
      expect(screen.getByText('New Date')).toBeInTheDocument();
      expect(screen.getByText('Available Time Slots')).toBeInTheDocument();
    });

    it('displays available time slots in reschedule dialog', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Reschedule'));
      
      // Should show available slots
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('09:30')).toBeInTheDocument();
      expect(screen.getByText('10:30')).toBeInTheDocument();
    });

    it('submits reschedule form with correct data', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'rescheduled' } },
      });
      
      mockUseRescheduleAppointment.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      renderComponent();
      
      await user.click(screen.getByLabelText('Reschedule'));
      
      // Select a time slot
      await user.click(screen.getByLabelText('09:00'));
      
      // Fill in reason
      const reasonField = screen.getByLabelText('Reason for Rescheduling');
      await user.type(reasonField, 'Schedule conflict');
      
      // Submit form
      await user.click(screen.getByText('Reschedule'));
      
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          appointmentId: '1',
          rescheduleData: {
            newDate: expect.any(String),
            newTime: '09:00',
            reason: 'Schedule conflict',
            notifyPharmacist: true,
          },
        });
      });
    });

    it('shows validation errors for reschedule form', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Reschedule'));
      
      // Try to submit without selecting time or providing reason
      const rescheduleButton = screen.getByRole('button', { name: /reschedule/i });
      await user.click(rescheduleButton);
      
      expect(screen.getByText('Please select a time slot')).toBeInTheDocument();
      expect(screen.getByText('Please provide a reason for rescheduling')).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('opens cancel dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Cancel'));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to cancel this appointment/i)).toBeInTheDocument();
    });

    it('submits cancel form with correct data', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'cancelled' } },
      });
      
      mockUseCancelAppointment.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      renderComponent();
      
      await user.click(screen.getByLabelText('Cancel'));
      
      // Fill in reason
      const reasonField = screen.getByLabelText('Reason for Cancellation');
      await user.type(reasonField, 'Personal emergency');
      
      // Submit form - use button role to avoid ambiguity
      const cancelButton = screen.getByRole('button', { name: /cancel appointment/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          appointmentId: '1',
          cancelData: {
            reason: 'Personal emergency',
            notifyPharmacist: true,
          },
        });
      });
    });

    it('shows validation error for cancel form without reason', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Cancel'));
      
      // Try to submit without providing reason
      const cancelButton = screen.getByRole('button', { name: /cancel appointment/i });
      await user.click(cancelButton);
      
      expect(screen.getByText('Please provide a reason for cancellation')).toBeInTheDocument();
    });

    it('closes cancel dialog when keep appointment is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Cancel'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      await user.click(screen.getByText('Keep Appointment'));
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('expands appointment details when expand button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('Show More'));
      
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Appointment Type')).toBeInTheDocument();
      expect(screen.getByText('Confirmation Status')).toBeInTheDocument();
    });

    it('collapses appointment details when collapse button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // First expand
      await user.click(screen.getByLabelText('Show More'));
      expect(screen.getByText('Description')).toBeInTheDocument();
      
      // Then collapse - check that button changes back to "Show More"
      await user.click(screen.getByLabelText('Show Less'));
      
      // Check that the button text changed back
      expect(screen.getByLabelText('Show More')).toBeInTheDocument();
      expect(screen.queryByLabelText('Show Less')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state for upcoming appointments', () => {
      mockUseMyAppointments.mockReturnValue({
        data: {
          success: true,
          data: { appointments: [], hasMore: false },
          message: 'Success',
          timestamp: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      
      expect(screen.getByText('No upcoming appointments')).toBeInTheDocument();
      expect(screen.getByText("You don't have any upcoming appointments scheduled.")).toBeInTheDocument();
    });

    it('shows empty state for past appointments', async () => {
      const user = userEvent.setup();
      
      mockUseMyAppointments.mockReturnValue({
        data: {
          success: true,
          data: { appointments: [], hasMore: false },
          message: 'Success',
          timestamp: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderComponent();
      
      await user.click(screen.getByText('Past (0)'));
      
      expect(screen.getByText('No past appointments')).toBeInTheDocument();
      expect(screen.getByText("You don't have any past appointments to show.")).toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('calls onAppointmentUpdate when appointment is rescheduled', async () => {
      const user = userEvent.setup();
      const mockOnAppointmentUpdate = vi.fn();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'rescheduled' } },
      });
      
      mockUseRescheduleAppointment.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      renderComponent({ onAppointmentUpdate: mockOnAppointmentUpdate });
      
      await user.click(screen.getByLabelText('Reschedule'));
      await user.click(screen.getByLabelText('09:00'));
      
      const reasonField = screen.getByLabelText('Reason for Rescheduling');
      await user.type(reasonField, 'Schedule conflict');
      
      await user.click(screen.getByText('Reschedule'));
      
      await waitFor(() => {
        expect(mockOnAppointmentUpdate).toHaveBeenCalledWith({
          ...mockUpcomingAppointment,
          status: 'rescheduled',
        });
      });
    });

    it('calls onAppointmentUpdate when appointment is cancelled', async () => {
      const user = userEvent.setup();
      const mockOnAppointmentUpdate = vi.fn();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: { appointment: { ...mockUpcomingAppointment, status: 'cancelled' } },
      });
      
      mockUseCancelAppointment.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);

      renderComponent({ onAppointmentUpdate: mockOnAppointmentUpdate });
      
      await user.click(screen.getByLabelText('Cancel'));
      
      const reasonField = screen.getByLabelText('Reason for Cancellation');
      await user.type(reasonField, 'Personal emergency');
      
      const cancelButton = screen.getByRole('button', { name: /cancel appointment/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(mockOnAppointmentUpdate).toHaveBeenCalledWith({
          ...mockUpcomingAppointment,
          status: 'cancelled',
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for buttons', () => {
      renderComponent();
      
      expect(screen.getByLabelText('View Details')).toBeInTheDocument();
      expect(screen.getByLabelText('Reschedule')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel')).toBeInTheDocument();
      expect(screen.getByLabelText('Show More')).toBeInTheDocument();
    });

    it('has proper tab navigation', () => {
      renderComponent();
      
      const upcomingTab = screen.getByRole('tab', { name: /upcoming/i });
      const pastTab = screen.getByRole('tab', { name: /past/i });
      
      expect(upcomingTab).toHaveAttribute('aria-selected', 'true');
      expect(pastTab).toHaveAttribute('aria-selected', 'false');
    });

    it('has proper dialog roles and labels', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await user.click(screen.getByLabelText('View Details'));
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
    });
  });

  describe('Responsive Design', () => {
    it('renders correctly on mobile', () => {
      // Mock mobile breakpoint
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 899.95px)'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      renderComponent();
      
      // Component should still render properly
      expect(screen.getByText('My Appointments')).toBeInTheDocument();
    });
  });
});