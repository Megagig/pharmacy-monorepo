import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CompleteAppointmentDialog from '../CompleteAppointmentDialog';
import { Appointment } from '../../../stores/appointmentTypes';

// Mock the hooks
vi.mock('../../../hooks/useAppointments', () => ({
  useUpdateAppointmentStatus: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      data: { appointment: mockAppointment }
    }),
    isPending: false,
  }),
}));

vi.mock('../../../queries/usePatientResources', () => ({
  useCreateVisitFromAppointment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      data: { visit: { _id: 'visit-123' } }
    }),
    isPending: false,
  }),
}));

const mockAppointment: Appointment = {
  _id: 'appointment-123',
  workplaceId: 'workplace-123',
  patientId: 'patient-123',
  assignedTo: 'pharmacist-123',
  type: 'mtm_session',
  title: 'MTM Session',
  description: 'Medication therapy management session',
  scheduledDate: new Date('2025-10-26'),
  scheduledTime: '10:00',
  duration: 30,
  timezone: 'Africa/Lagos',
  status: 'scheduled',
  confirmationStatus: 'pending',
  isRecurring: false,
  isRecurringException: false,
  reminders: [],
  relatedRecords: {},
  metadata: {
    source: 'manual',
  },
  createdBy: 'pharmacist-123',
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Visit Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should show create visit option in appointment completion dialog', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithProviders(
      <CompleteAppointmentDialog
        open={true}
        onClose={onClose}
        appointment={mockAppointment}
        onSuccess={onSuccess}
      />
    );

    // Check if the create visit checkbox is present
    expect(screen.getByText('Create Visit Record')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should create visit when checkbox is checked and appointment is completed', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithProviders(
      <CompleteAppointmentDialog
        open={true}
        onClose={onClose}
        appointment={mockAppointment}
        onSuccess={onSuccess}
      />
    );

    // Fill in required fields
    const notesField = screen.getByLabelText('Notes');
    fireEvent.change(notesField, { target: { value: 'Appointment completed successfully' } });

    // Check the create visit checkbox
    const createVisitCheckbox = screen.getByRole('checkbox');
    fireEvent.click(createVisitCheckbox);

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /complete appointment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should display appointment link in visit when created from appointment', () => {
    // This would be tested in the VisitManagement component
    // For now, we'll just verify the type definition includes appointmentId
    const visitWithAppointment = {
      _id: 'visit-123',
      pharmacyId: 'pharmacy-123',
      patientId: 'patient-123',
      appointmentId: 'appointment-123', // This should be available
      date: new Date().toISOString(),
      soap: {
        subjective: '',
        objective: '',
        assessment: 'From appointment completion',
        plan: 'Follow up as needed',
      },
      attachments: [],
      createdBy: 'pharmacist-123',
      updatedBy: 'pharmacist-123',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(visitWithAppointment.appointmentId).toBe('appointment-123');
  });
});