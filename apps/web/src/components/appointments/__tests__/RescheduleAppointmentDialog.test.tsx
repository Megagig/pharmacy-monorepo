import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import RescheduleAppointmentDialog from '../RescheduleAppointmentDialog';
import { Appointment } from '../../../stores/appointmentTypes';
import * as appointmentHooks from '../../../hooks/useAppointments';

// Mock the hooks
vi.mock('../../../hooks/useAppointments');

// Test wrapper component
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

// Mock appointment data
const mockAppointment: Appointment = {
  _id: 'appointment-123',
  workplaceId: 'workplace-123',
  patientId: 'patient-123',
  assignedTo: 'pharmacist-123',
  type: 'mtm_session',
  title: 'MTM Session',
  description: 'Medication therapy management session',
  scheduledDate: new Date('2025-10-25T10:00:00Z'),
  scheduledTime: '10:00',
  duration: 30,
  timezone: 'Africa/Lagos',
  status: 'scheduled',
  confirmationStatus: 'pending',
  isRecurring: false,
  isRecurringException: false,
  reminders: [],
  relatedRecords: {},
  createdBy: 'user-123',
  isDeleted: false,
  createdAt: new Date('2025-10-20T08:00:00Z'),
  updatedAt: new Date('2025-10-20T08:00:00Z'),
};

// Mock available slots data
const mockAvailableSlots = {
  data: {
    slots: [
      { time: '09:00', available: true, pharmacistId: 'pharmacist-123' },
      { time: '09:30', available: true, pharmacistId: 'pharmacist-123' },
      { time: '10:00', available: false, pharmacistId: 'pharmacist-123' },
      { time: '10:30', available: true, pharmacistId: 'pharmacist-123' },
      { time: '11:00', available: true, pharmacistId: 'pharmacist-123' },
    ],
    pharmacists: [],
  },
};

describe('RescheduleAppointmentDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockRescheduleAppointment = vi.fn();
  const mockUseAvailableSlots = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock hooks
    (appointmentHooks.useRescheduleAppointment as any).mockReturnValue({
      mutateAsync: mockRescheduleAppointment,
      isLoading: false,
      error: null,
    });

    mockUseAvailableSlots.mockReturnValue({
      data: mockAvailableSlots,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (appointmentHooks.useAvailableSlots as any).mockImplementation(mockUseAvailableSlots);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      open: true,
      onClose: mockOnClose,
      appointment: mockAppointment,
      onSuccess: mockOnSuccess,
      ...props,
    };

    return render(
      <TestWrapper>
        <RescheduleAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );
  };

  describe('Basic Rendering', () => {
    it('should render dialog when open', () => {
      renderComponent();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      renderComponent({ open: false });
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display current appointment details', () => {
      renderComponent();
      
      expect(screen.getByText('Current Appointment Details')).toBeInTheDocument();
      expect(screen.getByText('Mtm Session')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
    });

    it('should display appointment description when available', () => {
      renderComponent();
      
      expect(screen.getByText('Medication therapy management session')).toBeInTheDocument();
    });
  });

  describe('Form Elements', () => {
    it('should render reason textarea', () => {
      renderComponent();
      
      expect(screen.getByLabelText('Reason')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Please provide a reason for rescheduling/)).toBeInTheDocument();
    });

    it('should render patient notification toggle', () => {
      renderComponent();
      
      expect(screen.getByText('Notify Patient')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should have notification toggle enabled by default', () => {
      renderComponent();
      
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();
    });
  });

  describe('Form Validation', () => {
    it('should require reason for rescheduling', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Reason for rescheduling is required')).toBeInTheDocument();
      });
    });

    it('should require minimum length for reason', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const reasonField = screen.getByLabelText('Reason');
      await user.type(reasonField, 'abc');
      
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Reason must be at least 5 characters long')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call reschedule mutation with correct data', async () => {
      const user = userEvent.setup();
      mockRescheduleAppointment.mockResolvedValue({
        data: { appointment: { ...mockAppointment, scheduledTime: '09:00' } }
      });
      
      renderComponent();
      
      // Fill in the form
      const reasonField = screen.getByLabelText('Reason');
      await user.type(reasonField, 'Patient requested different time');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockRescheduleAppointment).toHaveBeenCalledWith({
          appointmentId: 'appointment-123',
          rescheduleData: expect.objectContaining({
            reason: 'Patient requested different time',
            notifyPatient: true,
          }),
        });
      });
    });

    it('should call onSuccess callback after successful reschedule', async () => {
      const user = userEvent.setup();
      const updatedAppointment = { ...mockAppointment, scheduledTime: '09:00' };
      mockRescheduleAppointment.mockResolvedValue({
        data: { appointment: updatedAppointment }
      });
      
      renderComponent();
      
      // Fill in the form
      const reasonField = screen.getByLabelText('Reason');
      await user.type(reasonField, 'Patient requested different time');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(updatedAppointment);
      });
    });

    it('should close dialog after successful reschedule', async () => {
      const user = userEvent.setup();
      mockRescheduleAppointment.mockResolvedValue({
        data: { appointment: mockAppointment }
      });
      
      renderComponent();
      
      // Fill in the form
      const reasonField = screen.getByLabelText('Reason');
      await user.type(reasonField, 'Patient requested different time');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should disable submit button when form is invalid', () => {
      renderComponent();
      
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Dialog Actions', () => {
    it('should close dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Patient Notification', () => {
    it('should show notification info when toggle is enabled', () => {
      renderComponent();
      
      expect(screen.getByText(/The patient will be notified via their preferred communication channel/)).toBeInTheDocument();
    });

    it('should allow toggling patient notification', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeChecked();
      
      await user.click(toggle);
      
      expect(toggle).not.toBeChecked();
    });
  });

  describe('Error Handling', () => {
    it('should handle reschedule mutation error', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockRescheduleAppointment.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      // Fill in the form
      const reasonField = screen.getByLabelText('Reason');
      await user.type(reasonField, 'Patient requested different time');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /reschedule appointment/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to reschedule appointment:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      renderComponent();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have proper button roles', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reschedule appointment/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null appointment gracefully', () => {
      renderComponent({ appointment: null });
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should reset form when dialog opens', () => {
      const { rerender } = renderComponent({ open: false });
      
      rerender(
        <TestWrapper>
          <RescheduleAppointmentDialog
            open={true}
            onClose={mockOnClose}
            appointment={mockAppointment}
            onSuccess={mockOnSuccess}
          />
        </TestWrapper>
      );
      
      // Form should be reset with appointment data
      expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Reason field should be empty
    });
  });
});