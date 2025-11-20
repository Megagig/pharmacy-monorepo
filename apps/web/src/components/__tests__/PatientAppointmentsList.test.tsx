import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import PatientAppointmentsList from '../PatientAppointmentsList';
import { usePatientAppointments, useCancelAppointment } from '../../hooks/useAppointments';
import { Appointment } from '../../stores/appointmentTypes';

// Mock the hooks
vi.mock('../../hooks/useAppointments');

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock appointment dialogs
vi.mock('../appointments/CreateAppointmentDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="create-appointment-dialog">
      {open && (
        <div>
          <span>Create Appointment Dialog</span>
          <button onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  ),
}));

vi.mock('../appointments/RescheduleAppointmentDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="reschedule-appointment-dialog">
      {open && (
        <div>
          <span>Reschedule Appointment Dialog</span>
          <button onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  ),
}));

// Test data
const mockAppointments: Appointment[] = [
  {
    _id: '1',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    assignedTo: 'pharmacist1',
    type: 'mtm_session',
    title: 'MTM Session',
    description: 'Medication therapy management',
    scheduledDate: '2025-10-27',
    scheduledTime: '10:00',
    duration: 45,
    timezone: 'Africa/Lagos',
    status: 'scheduled',
    confirmationStatus: 'pending',
    isRecurring: false,
    isRecurringException: false,
    reminders: [],
    relatedRecords: {},
    createdBy: 'user1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: '2',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    assignedTo: 'pharmacist1',
    type: 'health_check',
    title: 'Health Check',
    description: 'General health screening',
    scheduledDate: '2025-10-25', // Today
    scheduledTime: '14:00',
    duration: 25,
    timezone: 'Africa/Lagos',
    status: 'confirmed',
    confirmationStatus: 'confirmed',
    isRecurring: false,
    isRecurringException: false,
    reminders: [],
    relatedRecords: {},
    createdBy: 'user1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: '3',
    workplaceId: 'workplace1',
    patientId: 'patient1',
    assignedTo: 'pharmacist1',
    type: 'general_followup',
    title: 'Follow-up',
    description: 'General follow-up appointment',
    scheduledDate: '2025-10-20', // Past date
    scheduledTime: '09:00',
    duration: 20,
    timezone: 'Africa/Lagos',
    status: 'completed',
    confirmationStatus: 'confirmed',
    isRecurring: false,
    isRecurringException: false,
    reminders: [],
    relatedRecords: {},
    createdBy: 'user1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockUsePatientAppointments = usePatientAppointments as ReturnType<typeof vi.fn>;
const mockUseCancelAppointment = useCancelAppointment as ReturnType<typeof vi.fn>;

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
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('PatientAppointmentsList', () => {
  const mockCancelMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Default mock implementations
    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: mockAppointments,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseCancelAppointment.mockReturnValue(mockCancelMutation);
  });

  it('renders appointments list correctly', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('MTM Session')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.getByText('General Follow-up')).toBeInTheDocument();
  });

  it('displays upcoming appointments count badge', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    // Should show badge with count of future appointments (2 in our mock data)
    const badge = screen.getByText('2');
    expect(badge).toBeInTheDocument();
  });

  it('shows create appointment button when enabled', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          showCreateButton={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('hides create appointment button when disabled', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          showCreateButton={false}
        />
      </TestWrapper>
    );

    expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
  });

  it('opens create appointment dialog when schedule button is clicked', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const scheduleButton = screen.getByText('Schedule');
    fireEvent.click(scheduleButton);

    await waitFor(() => {
      expect(screen.getByTestId('create-appointment-dialog')).toBeInTheDocument();
      expect(screen.getByText('Create Appointment Dialog')).toBeInTheDocument();
    });
  });

  it('displays appointment status chips correctly', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows appointment duration and time information', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Duration: 45 minutes')).toBeInTheDocument();
    expect(screen.getByText('Duration: 25 minutes')).toBeInTheDocument();
    expect(screen.getByText('Duration: 20 minutes')).toBeInTheDocument();
  });

  it('opens context menu when more options button is clicked', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Reschedule')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('navigates to appointment details when view details is clicked', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      const viewDetailsButton = screen.getByText('View Details');
      fireEvent.click(viewDetailsButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/appointments/1');
  });

  it('opens reschedule dialog when reschedule is clicked', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      const rescheduleButton = screen.getByText('Reschedule');
      fireEvent.click(rescheduleButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('reschedule-appointment-dialog')).toBeInTheDocument();
    });
  });

  it('opens cancel confirmation dialog when cancel is clicked', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Cancel Appointment')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to cancel this appointment?')).toBeInTheDocument();
    });
  });

  it('calls cancel mutation when cancel is confirmed', async () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
    });

    await waitFor(() => {
      const confirmCancelButton = screen.getByText('Cancel Appointment');
      fireEvent.click(confirmCancelButton);
    });

    expect(mockCancelMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: '1',
      cancelData: {
        reason: 'Cancelled by pharmacist',
        notifyPatient: true,
      },
    });
  });

  it('shows loading state', () => {
    mockUsePatientAppointments.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Appointments')).toBeInTheDocument();
    // Should show skeleton loaders
    expect(document.querySelectorAll('.MuiSkeleton-root')).toHaveLength(4); // 3 appointment skeletons + 1 button skeleton
  });

  it('shows error state', () => {
    mockUsePatientAppointments.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load appointments'),
    });

    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getAllByText('Failed to load appointments')[0]).toBeInTheDocument();
  });

  it('shows empty state when no appointments', () => {
    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('No appointments scheduled')).toBeInTheDocument();
    expect(screen.getByText('Schedule the first appointment for this patient')).toBeInTheDocument();
    expect(screen.getByText('Schedule Appointment')).toBeInTheDocument();
  });

  it('calls custom onCreateAppointment callback when provided', () => {
    const mockOnCreateAppointment = vi.fn();

    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          onCreateAppointment={mockOnCreateAppointment}
        />
      </TestWrapper>
    );

    const scheduleButton = screen.getByText('Schedule');
    fireEvent.click(scheduleButton);

    expect(mockOnCreateAppointment).toHaveBeenCalled();
  });

  it('calls custom onViewAppointment callback when provided', async () => {
    const mockOnViewAppointment = vi.fn();

    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          onViewAppointment={mockOnViewAppointment}
        />
      </TestWrapper>
    );

    const moreButtons = screen.getAllByTestId('MoreVertIcon');
    fireEvent.click(moreButtons[0]);

    await waitFor(() => {
      const viewDetailsButton = screen.getByText('View Details');
      fireEvent.click(viewDetailsButton);
    });

    expect(mockOnViewAppointment).toHaveBeenCalledWith('1');
  });

  it('limits appointments display based on maxAppointments prop', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          maxAppointments={2}
        />
      </TestWrapper>
    );

    // Should show "View All Appointments" button when there are more appointments than the limit
    expect(screen.getByText('View All Appointments')).toBeInTheDocument();
  });

  it('hides header when showHeader is false', () => {
    render(
      <TestWrapper>
        <PatientAppointmentsList 
          patientId="patient1" 
          showHeader={false}
        />
      </TestWrapper>
    );

    // Header should not be visible, but appointments should still be shown
    expect(screen.queryByText('Appointments')).not.toBeInTheDocument();
    expect(screen.getByText('MTM Session')).toBeInTheDocument();
  });

  it('highlights overdue appointments', () => {
    const overdueAppointment: Appointment = {
      ...mockAppointments[0],
      _id: '4',
      scheduledDate: '2025-10-20', // Past date
      scheduledTime: '08:00',
      status: 'scheduled', // Still scheduled but past due
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [overdueAppointment, ...mockAppointments],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentsList patientId="patient1" />
      </TestWrapper>
    );

    // The overdue appointment should have different styling (error background)
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveStyle({ backgroundColor: expect.stringContaining('error') });
  });
});