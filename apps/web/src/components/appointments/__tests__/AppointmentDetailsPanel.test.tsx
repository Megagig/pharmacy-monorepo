import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import AppointmentDetailsPanel from '../AppointmentDetailsPanel';
import { Appointment } from '../../../stores/appointmentTypes';
import * as appointmentHooks from '../../../hooks/useAppointments';

// Mock the hooks
vi.mock('../../../hooks/useAppointments', () => ({
  useAppointment: vi.fn(),
  useUpdateAppointmentStatus: vi.fn(),
  useRescheduleAppointment: vi.fn(),
  useCancelAppointment: vi.fn(),
}));

const theme = createTheme();

const mockAppointment: Appointment = {
  _id: 'appointment-1',
  workplaceId: 'workplace-1',
  patientId: 'patient-1',
  assignedTo: 'pharmacist-1',
  type: 'mtm_session',
  title: 'MTM Session',
  description: 'Medication therapy management session',
  scheduledDate: new Date('2025-10-26T10:00:00Z'),
  scheduledTime: '10:00',
  duration: 45,
  timezone: 'Africa/Lagos',
  status: 'scheduled',
  confirmationStatus: 'pending',
  isRecurring: false,
  isRecurringException: false,
  reminders: [
    {
      type: 'email',
      scheduledFor: new Date('2025-10-25T10:00:00Z'),
      sent: true,
      sentAt: new Date('2025-10-25T10:00:00Z'),
      deliveryStatus: 'delivered',
    },
    {
      type: 'sms',
      scheduledFor: new Date('2025-10-26T08:00:00Z'),
      sent: false,
      deliveryStatus: 'pending',
    },
  ],
  relatedRecords: {
    visitId: 'visit-1',
    mtrSessionId: 'mtr-1',
  },
  createdBy: 'user-1',
  isDeleted: false,
  createdAt: new Date('2025-10-20T09:00:00Z'),
  updatedAt: new Date('2025-10-20T09:00:00Z'),
};

const mockPatient = {
  _id: 'patient-1',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+234-123-456-7890',
  email: 'john.doe@example.com',
};

const mockPharmacist = {
  _id: 'pharmacist-1',
  firstName: 'Dr. Jane',
  lastName: 'Smith',
  role: 'Senior Pharmacist',
};

const mockRelatedRecords = {
  visitId: 'visit-1',
  mtrSessionId: 'mtr-1',
};

const mockAppointmentData = {
  data: {
    appointment: mockAppointment,
    patient: mockPatient,
    assignedPharmacist: mockPharmacist,
    relatedRecords: mockRelatedRecords,
  },
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {component}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('AppointmentDetailsPanel', () => {
  const mockUpdateStatus = vi.fn();
  const mockReschedule = vi.fn();
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful hook returns
    vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
      data: mockAppointmentData,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(appointmentHooks.useUpdateAppointmentStatus).mockReturnValue({
      mutateAsync: mockUpdateStatus,
      isPending: false,
    } as any);

    vi.mocked(appointmentHooks.useRescheduleAppointment).mockReturnValue({
      mutateAsync: mockReschedule,
      isPending: false,
    } as any);

    vi.mocked(appointmentHooks.useCancelAppointment).mockReturnValue({
      mutateAsync: mockCancel,
      isPending: false,
    } as any);
  });

  describe('Rendering', () => {
    it('renders appointment details correctly', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      // Check appointment type and status
      expect(screen.getByText('MTM Session')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();

      // Check appointment details
      expect(screen.getByText('Sunday, October 26, 2025')).toBeInTheDocument();
      expect(screen.getByText('10:00 (45 minutes)')).toBeInTheDocument();
      expect(screen.getByText('Medication therapy management session')).toBeInTheDocument();
    });

    it('renders patient information correctly', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('+234-123-456-7890')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('renders assigned pharmacist information correctly', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Senior Pharmacist')).toBeInTheDocument();
    });

    it('renders appointment timeline', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('Appointment Timeline')).toBeInTheDocument();
      expect(screen.getByText('Appointment Created')).toBeInTheDocument();
      expect(screen.getByText('MTM Session scheduled')).toBeInTheDocument();
    });

    it('renders reminder history', async () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      // Click to expand reminders section
      const remindersAccordion = screen.getByText('Reminder History (2)');
      fireEvent.click(remindersAccordion);

      await waitFor(() => {
        expect(screen.getByText('EMAIL')).toBeInTheDocument();
        expect(screen.getByText('SMS')).toBeInTheDocument();
        expect(screen.getByText(/Sent.*delivered/)).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('renders related records', async () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      // Click to expand related records section
      const relatedAccordion = screen.getByText('Related Records');
      fireEvent.click(relatedAccordion);

      await waitFor(() => {
        expect(screen.getByText('Visit Record')).toBeInTheDocument();
        expect(screen.getByText('MTR Session')).toBeInTheDocument();
        expect(screen.getByText('Visit ID: visit-1')).toBeInTheDocument();
        expect(screen.getByText('Session ID: mtr-1')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner when data is loading', () => {
      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows error message when data fails to load', () => {
      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load'),
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('Failed to load appointment details. Please try again.')).toBeInTheDocument();
    });

    it('shows error message when appointment data is missing', () => {
      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: { data: { appointment: null } },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('Failed to load appointment details. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows appropriate action buttons for scheduled appointment', () => {
      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onEdit={vi.fn()}
          onReschedule={vi.fn()}
        />
      );

      expect(screen.getByText('Edit Appointment')).toBeInTheDocument();
      expect(screen.getByText('Reschedule')).toBeInTheDocument();
      expect(screen.getByText('Mark Complete')).toBeInTheDocument();
      expect(screen.getByText('Cancel Appointment')).toBeInTheDocument();
    });

    it('hides reschedule and cancel buttons for completed appointment', () => {
      const completedAppointment = {
        ...mockAppointment,
        status: 'completed' as const,
        completedAt: new Date('2025-10-26T11:00:00Z'),
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: completedAppointment,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onEdit={vi.fn()}
          onReschedule={vi.fn()}
        />
      );

      expect(screen.queryByText('Reschedule')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel Appointment')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
      const mockOnEdit = vi.fn();

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onEdit={mockOnEdit}
        />
      );

      fireEvent.click(screen.getByText('Edit Appointment'));
      expect(mockOnEdit).toHaveBeenCalledWith(mockAppointment);
    });

    it('calls onReschedule when reschedule button is clicked', () => {
      const mockOnReschedule = vi.fn();

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onReschedule={mockOnReschedule}
        />
      );

      fireEvent.click(screen.getByText('Reschedule'));
      expect(mockOnReschedule).toHaveBeenCalledWith(mockAppointment);
    });
  });

  describe('Complete Appointment', () => {
    it('opens complete dialog when mark complete button is clicked', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      fireEvent.click(screen.getByText('Mark Complete'));
      expect(screen.getByText('Complete Appointment')).toBeInTheDocument();
      expect(screen.getByLabelText('Completion Notes')).toBeInTheDocument();
    });

    it('completes appointment with notes', async () => {
      mockUpdateStatus.mockResolvedValue({ data: { appointment: mockAppointment } });

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      // Open complete dialog
      fireEvent.click(screen.getByText('Mark Complete'));

      // Enter notes
      const notesInput = screen.getByLabelText('Completion Notes');
      fireEvent.change(notesInput, { target: { value: 'Appointment completed successfully' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith({
          appointmentId: 'appointment-1',
          statusData: {
            status: 'completed',
            outcome: {
              status: 'successful',
              notes: 'Appointment completed successfully',
              nextActions: [],
              visitCreated: false,
            },
          },
        });
      });
    });

    it('disables complete button when notes are empty', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      fireEvent.click(screen.getByText('Mark Complete'));
      
      const completeButton = screen.getByRole('button', { name: 'Complete' });
      expect(completeButton).toBeDisabled();
    });
  });

  describe('Cancel Appointment', () => {
    it('opens cancel dialog when cancel button is clicked', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      fireEvent.click(screen.getByText('Cancel Appointment'));
      expect(screen.getByRole('heading', { name: 'Cancel Appointment' })).toBeInTheDocument();
      expect(screen.getByLabelText('Cancellation Reason')).toBeInTheDocument();
    });

    it('cancels appointment with reason', async () => {
      mockCancel.mockResolvedValue({ data: { appointment: mockAppointment } });

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      // Open cancel dialog
      fireEvent.click(screen.getByText('Cancel Appointment'));

      // Enter reason
      const reasonInput = screen.getByLabelText('Cancellation Reason');
      fireEvent.change(reasonInput, { target: { value: 'Patient requested cancellation' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: 'Cancel Appointment' }));

      await waitFor(() => {
        expect(mockCancel).toHaveBeenCalledWith({
          appointmentId: 'appointment-1',
          cancelData: {
            reason: 'Patient requested cancellation',
            notifyPatient: true,
          },
        });
      });
    });

    it('disables cancel button when reason is empty', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      fireEvent.click(screen.getByText('Cancel Appointment'));
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel Appointment' });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Status Display', () => {
    it('shows confirmed status chip when appointment is confirmed', () => {
      const confirmedAppointment = {
        ...mockAppointment,
        status: 'confirmed' as const,
        confirmationStatus: 'confirmed' as const,
        confirmedAt: new Date('2025-10-25T15:00:00Z'),
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: confirmedAppointment,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    it('shows correct status colors for different appointment statuses', () => {
      const completedAppointment = {
        ...mockAppointment,
        status: 'completed' as const,
        completedAt: new Date('2025-10-26T11:00:00Z'),
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: completedAppointment,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });
  });

  describe('Accordion Sections', () => {
    it('toggles timeline section', () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      const timelineAccordion = screen.getByText('Appointment Timeline');
      
      // Timeline should be expanded by default
      expect(screen.getByText('Appointment Created')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(timelineAccordion);
      
      // Should still be visible due to accordion behavior
      expect(screen.getByText('Appointment Timeline')).toBeInTheDocument();
    });

    it('expands reminder history section when clicked', async () => {
      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      const remindersAccordion = screen.getByText('Reminder History (2)');
      fireEvent.click(remindersAccordion);

      await waitFor(() => {
        expect(screen.getByText('EMAIL')).toBeInTheDocument();
        expect(screen.getByText('SMS')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Props', () => {
    it('calls onClose when close button is clicked', () => {
      const mockOnClose = vi.fn();

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByTestId('CloseIcon').closest('button');
      fireEvent.click(closeButton!);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onComplete when appointment is completed', async () => {
      const mockOnComplete = vi.fn();
      mockUpdateStatus.mockResolvedValue({ data: { appointment: mockAppointment } });

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onComplete={mockOnComplete}
        />
      );

      // Open complete dialog and complete appointment
      fireEvent.click(screen.getByText('Mark Complete'));
      
      const notesInput = screen.getByLabelText('Completion Notes');
      fireEvent.change(notesInput, { target: { value: 'Completed' } });
      
      fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(mockAppointment);
      });
    });

    it('calls onCancel when appointment is cancelled', async () => {
      const mockOnCancel = vi.fn();
      mockCancel.mockResolvedValue({ data: { appointment: mockAppointment } });

      renderWithProviders(
        <AppointmentDetailsPanel 
          appointmentId="appointment-1"
          onCancel={mockOnCancel}
        />
      );

      // Open cancel dialog and cancel appointment
      fireEvent.click(screen.getByText('Cancel Appointment'));
      
      const reasonInput = screen.getByLabelText('Cancellation Reason');
      fireEvent.change(reasonInput, { target: { value: 'Cancelled' } });
      
      fireEvent.click(screen.getByRole('button', { name: 'Cancel Appointment' }));

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalledWith(mockAppointment);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles appointment without reminders', () => {
      const appointmentWithoutReminders = {
        ...mockAppointment,
        reminders: [],
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: appointmentWithoutReminders,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.queryByText(/Reminder History/)).not.toBeInTheDocument();
    });

    it('handles appointment without related records', () => {
      const appointmentWithoutRelated = {
        ...mockAppointment,
        relatedRecords: {},
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: appointmentWithoutRelated,
            relatedRecords: {},
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.queryByText('Related Records')).not.toBeInTheDocument();
    });

    it('handles appointment without description', () => {
      const appointmentWithoutDescription = {
        ...mockAppointment,
        description: undefined,
      };

      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            appointment: appointmentWithoutDescription,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });

    it('handles missing patient data gracefully', () => {
      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            patient: null,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.queryByText('Patient Information')).not.toBeInTheDocument();
    });

    it('handles missing pharmacist data gracefully', () => {
      vi.mocked(appointmentHooks.useAppointment).mockReturnValue({
        data: {
          data: {
            ...mockAppointmentData.data,
            assignedPharmacist: null,
          },
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(
        <AppointmentDetailsPanel appointmentId="appointment-1" />
      );

      expect(screen.queryByText('Assigned Pharmacist')).not.toBeInTheDocument();
    });
  });
});