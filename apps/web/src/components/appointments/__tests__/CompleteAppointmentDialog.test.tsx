import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import CompleteAppointmentDialog from '../CompleteAppointmentDialog';
import { Appointment } from '../../../stores/appointmentTypes';
import * as useAppointmentsHook from '../../../hooks/useAppointments';

// Mock the hooks
vi.mock('../../../hooks/useAppointments', () => ({
  useUpdateAppointmentStatus: vi.fn(),
}));

// Mock date-fns format function
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr === 'MMM d, yyyy') return 'Oct 25, 2025';
    return '10:00';
  }),
}));

// Test data
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
  duration: 45,
  timezone: 'Africa/Lagos',
  status: 'in_progress',
  confirmationStatus: 'confirmed',
  isRecurring: false,
  isRecurringException: false,
  reminders: [],
  relatedRecords: {},
  createdBy: 'user-123',
  isDeleted: false,
  createdAt: new Date('2025-10-20T08:00:00Z'),
  updatedAt: new Date('2025-10-20T08:00:00Z'),
};

const mockUpdateStatusMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

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
      {children}
    </QueryClientProvider>
  );
};

describe('CompleteAppointmentDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppointmentsHook.useUpdateAppointmentStatus as any).mockReturnValue(mockUpdateStatusMutation);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
        <CompleteAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );
  };

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      renderComponent();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Complete Appointment' })).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      renderComponent({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not render when appointment is null', () => {
      renderComponent({ appointment: null });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display appointment summary information', () => {
      renderComponent();

      expect(screen.getByText('Appointment Summary')).toBeInTheDocument();
      expect(screen.getByText('Mtm Session')).toBeInTheDocument();
      expect(screen.getByText('Oct 25, 2025 at 10:00')).toBeInTheDocument();
      expect(screen.getByText('45 minutes')).toBeInTheDocument();
      expect(screen.getByText('Medication therapy management session')).toBeInTheDocument();
    });

    it('should display outcome status options', () => {
      renderComponent();

      const outcomeSelect = screen.getByLabelText('Outcome Status');
      expect(outcomeSelect).toBeInTheDocument();

      // Check default selection
      expect(outcomeSelect).toHaveValue('successful');
    });

    it('should display notes textarea', () => {
      renderComponent();

      const notesField = screen.getByLabelText('Notes');
      expect(notesField).toBeInTheDocument();
      expect(notesField).toHaveAttribute('placeholder', expect.stringContaining('Describe what was accomplished'));
    });

    it('should display common next actions', () => {
      renderComponent();

      expect(screen.getByText('Common Actions:')).toBeInTheDocument();
      expect(screen.getByText('Schedule follow-up appointment')).toBeInTheDocument();
      expect(screen.getByText('Monitor medication adherence')).toBeInTheDocument();
      expect(screen.getByText('Contact patient in 1 week')).toBeInTheDocument();
    });

    it('should display create visit checkbox', () => {
      renderComponent();

      const createVisitCheckbox = screen.getByLabelText('Create Visit Record');
      expect(createVisitCheckbox).toBeInTheDocument();
      expect(createVisitCheckbox).not.toBeChecked();
    });
  });

  describe('Form Interactions', () => {
    it('should allow selecting outcome status', async () => {
      const user = userEvent.setup();
      renderComponent();

      const outcomeSelect = screen.getByLabelText('Outcome Status');
      await user.click(outcomeSelect);

      const partiallySuccessfulOption = screen.getByText('Partially Successful');
      await user.click(partiallySuccessfulOption);

      expect(outcomeSelect).toHaveValue('partially_successful');
    });

    it('should show appropriate alert for unsuccessful outcome', async () => {
      const user = userEvent.setup();
      renderComponent();

      const outcomeSelect = screen.getByLabelText('Outcome Status');
      await user.click(outcomeSelect);

      const unsuccessfulOption = screen.getByText('Unsuccessful');
      await user.click(unsuccessfulOption);

      await waitFor(() => {
        expect(screen.getByText(/This appointment was marked as unsuccessful/)).toBeInTheDocument();
      });
    });

    it('should allow entering notes', async () => {
      const user = userEvent.setup();
      renderComponent();

      const notesField = screen.getByLabelText('Notes');
      const testNotes = 'Patient responded well to medication counseling. All questions answered.';

      await user.type(notesField, testNotes);

      expect(notesField).toHaveValue(testNotes);
    });

    it('should allow adding next actions', async () => {
      const user = userEvent.setup();
      renderComponent();

      const followUpAction = screen.getByText('Schedule follow-up appointment');
      await user.click(followUpAction);

      // Should appear in selected actions
      await waitFor(() => {
        expect(screen.getByText('Selected Actions:')).toBeInTheDocument();
      });
      
      // Find the chip in the selected actions section
      const selectedActionsSection = screen.getByText('Selected Actions:').closest('div');
      expect(within(selectedActionsSection!).getByText('Schedule follow-up appointment')).toBeInTheDocument();
    });

    it('should allow removing next actions', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Add an action first
      const followUpAction = screen.getByText('Schedule follow-up appointment');
      await user.click(followUpAction);

      await waitFor(() => {
        expect(screen.getByText('Selected Actions:')).toBeInTheDocument();
      });

      // Find and click the remove button
      const selectedActionsSection = screen.getByText('Selected Actions:').closest('div');
      const removeButton = within(selectedActionsSection!).getByTestId('RemoveIcon');
      await user.click(removeButton);

      // Action should be removed
      await waitFor(() => {
        expect(screen.queryByText('Selected Actions:')).not.toBeInTheDocument();
      });
    });

    it('should allow adding custom next actions', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click add custom action button
      const addCustomButton = screen.getByText('Add Custom Action');
      await user.click(addCustomButton);

      // Enter custom action
      const customActionField = screen.getByLabelText('Custom Action');
      const customAction = 'Review patient insurance coverage';
      await user.type(customActionField, customAction);

      // Click add button
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Should appear in selected actions
      await waitFor(() => {
        expect(screen.getByText('Selected Actions:')).toBeInTheDocument();
      });
      const selectedActionsSection = screen.getByText('Selected Actions:').closest('div');
      expect(within(selectedActionsSection!).getByText(customAction)).toBeInTheDocument();
    });

    it('should allow toggling create visit checkbox', async () => {
      const user = userEvent.setup();
      renderComponent();

      const createVisitCheckbox = screen.getByRole('checkbox', { name: /Create Visit Record/i });
      await user.click(createVisitCheckbox);

      expect(createVisitCheckbox).toBeChecked();
      expect(screen.getByText(/A new visit record will be created/)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty notes', async () => {
      const user = userEvent.setup();
      renderComponent();

      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Completion notes are required')).toBeInTheDocument();
      });
    });

    it('should show validation error for notes too short', async () => {
      const user = userEvent.setup();
      renderComponent();

      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Short');

      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Notes must be at least 10 characters long')).toBeInTheDocument();
      });
    });

    it('should show validation summary when there are errors', async () => {
      const user = userEvent.setup();
      renderComponent();

      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with correct data', async () => {
      const user = userEvent.setup();
      mockUpdateStatusMutation.mutateAsync.mockResolvedValue({
        data: { appointment: { ...mockAppointment, status: 'completed' } }
      });

      renderComponent();

      // Fill form
      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Appointment completed successfully with all objectives met.');

      // Add next action
      const followUpAction = screen.getByText('Schedule follow-up appointment');
      await user.click(followUpAction);

      // Check create visit
      const createVisitCheckbox = screen.getByRole('checkbox', { name: /Create Visit Record/i });
      await user.click(createVisitCheckbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdateStatusMutation.mutateAsync).toHaveBeenCalledWith({
          appointmentId: 'appointment-123',
          statusData: {
            status: 'completed',
            outcome: {
              status: 'successful',
              notes: 'Appointment completed successfully with all objectives met.',
              nextActions: ['Schedule follow-up appointment'],
              visitCreated: true,
            },
          },
        });
      });
    });

    it('should call onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      const completedAppointment = { ...mockAppointment, status: 'completed' as const };
      mockUpdateStatusMutation.mutateAsync.mockResolvedValue({
        data: { appointment: completedAppointment }
      });

      renderComponent();

      // Fill required fields
      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Appointment completed successfully.');

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(completedAppointment);
      });
    });

    it('should close dialog after successful submission', async () => {
      const user = userEvent.setup();
      mockUpdateStatusMutation.mutateAsync.mockResolvedValue({
        data: { appointment: { ...mockAppointment, status: 'completed' } }
      });

      renderComponent();

      // Fill required fields
      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Appointment completed successfully.');

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpdateStatusMutation.mutateAsync.mockRejectedValue(new Error('Network error'));

      renderComponent();

      // Fill required fields
      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Appointment completed successfully.');

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to complete appointment:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should disable submit button during submission', async () => {
      const user = userEvent.setup();
      const pendingMutation = {
        ...mockUpdateStatusMutation,
        isPending: true,
      };
      (useAppointmentsHook.useUpdateAppointmentStatus as any).mockReturnValue(pendingMutation);

      renderComponent();

      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Dialog Controls', () => {
    it('should close dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const closeButton = screen.getByRole('button', { name: '' }); // Close icon button
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is closed', async () => {
      const user = userEvent.setup();
      const { rerender } = renderComponent();

      // Fill some data
      const notesField = screen.getByLabelText('Notes');
      await user.type(notesField, 'Some notes');

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Reopen dialog (simulate)
      rerender(
        <TestWrapper>
          <CompleteAppointmentDialog
            open={true}
            onClose={mockOnClose}
            appointment={mockAppointment}
            onSuccess={mockOnSuccess}
          />
        </TestWrapper>
      );

      // Form should be reset
      const newNotesField = screen.getByLabelText('Notes');
      expect(newNotesField).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Tab through form elements
      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Notes')).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      const user = userEvent.setup();
      renderComponent();

      const submitButton = screen.getByRole('button', { name: 'Complete Appointment' });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByText('Completion notes are required');
        expect(errorMessages[0]).toHaveAttribute('id');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle appointment without description', () => {
      const appointmentWithoutDescription = {
        ...mockAppointment,
        description: undefined,
      };

      renderComponent({ appointment: appointmentWithoutDescription });

      expect(screen.getByText('Appointment Summary')).toBeInTheDocument();
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });

    it('should prevent duplicate next actions', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Add same action twice
      const followUpAction = screen.getByText('Schedule follow-up appointment');
      await user.click(followUpAction);
      await user.click(followUpAction);

      // Should only appear once in selected actions
      const selectedActionsSection = screen.getByText('Selected Actions:').closest('div');
      const actionChips = within(selectedActionsSection!).getAllByText('Schedule follow-up appointment');
      expect(actionChips).toHaveLength(1);
    });

    it('should handle custom action input with Enter key', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click add custom action button
      const addCustomButton = screen.getByText('Add Custom Action');
      await user.click(addCustomButton);

      // Enter custom action and press Enter
      const customActionField = screen.getByLabelText('Custom Action');
      await user.type(customActionField, 'Custom action{enter}');

      // Should appear in selected actions
      await waitFor(() => {
        expect(screen.getByText('Selected Actions:')).toBeInTheDocument();
      });
      const selectedActionsSection = screen.getByText('Selected Actions:').closest('div');
      expect(within(selectedActionsSection!).getByText('Custom action')).toBeInTheDocument();
    });

    it('should not add empty custom actions', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click add custom action button
      const addCustomButton = screen.getByText('Add Custom Action');
      await user.click(addCustomButton);

      // Try to add empty action
      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).toBeDisabled();
    });
  });
});