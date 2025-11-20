import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { addDays, subDays, format } from 'date-fns';

import PatientAppointmentAlerts from '../PatientAppointmentAlerts';
import { usePatientAppointments } from '../../hooks/useAppointments';
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

const mockUsePatientAppointments = usePatientAppointments as ReturnType<typeof vi.fn>;

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

describe('PatientAppointmentAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('does not render when loading', () => {
    mockUsePatientAppointments.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { container } = render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when there is an error', () => {
    mockUsePatientAppointments.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
    });

    const { container } = render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render when there are no alerts', () => {
    const appointments: Appointment[] = [
      {
        _id: '1',
        workplaceId: 'workplace1',
        patientId: 'patient1',
        assignedTo: 'pharmacist1',
        type: 'mtm_session',
        title: 'MTM Session',
        description: 'Future appointment',
        scheduledDate: addDays(new Date(), 7), // Future date
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
    ];

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { container } = render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows overdue appointment alert', () => {
    const overdueAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'mtm_session',
      title: 'MTM Session',
      description: 'Overdue appointment',
      scheduledDate: subDays(new Date(), 2), // 2 days ago
      scheduledTime: '10:00',
      duration: 45,
      timezone: 'Africa/Lagos',
      status: 'scheduled', // Still scheduled but overdue
      confirmationStatus: 'pending',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      relatedRecords: {},
      createdBy: 'user1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [overdueAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Appointment Alerts')).toBeInTheDocument();
    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.getByText(/mtm session appointment was scheduled.*days ago/i)).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows today appointment alert', () => {
    const todayAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'health_check',
      title: 'Health Check',
      description: 'Today appointment',
      scheduledDate: new Date(), // Today
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
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [todayAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Appointment Today')).toBeInTheDocument();
    expect(screen.getByText('health check appointment at 14:00')).toBeInTheDocument();
  });

  it('shows tomorrow appointment alert', () => {
    const tomorrowAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'vaccination',
      title: 'Vaccination',
      description: 'Tomorrow appointment',
      scheduledDate: addDays(new Date(), 1), // Tomorrow
      scheduledTime: '09:00',
      duration: 15,
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
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [tomorrowAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Appointment Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('vaccination appointment at 09:00')).toBeInTheDocument();
  });

  it('shows missed appointment alert', () => {
    const missedAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'chronic_disease_review',
      title: 'Chronic Disease Review',
      description: 'Missed appointment',
      scheduledDate: subDays(new Date(), 5),
      scheduledTime: '11:00',
      duration: 30,
      timezone: 'Africa/Lagos',
      status: 'no_show',
      confirmationStatus: 'confirmed',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      relatedRecords: {},
      createdBy: 'user1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [missedAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Missed Appointment')).toBeInTheDocument();
    expect(screen.getByText(/Patient missed chronic disease review appointment on/i)).toBeInTheDocument();
    expect(screen.getByText('Reschedule')).toBeInTheDocument();
  });

  it('shows no recent appointments alert', () => {
    const oldAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'general_followup',
      title: 'Follow-up',
      description: 'Old completed appointment',
      scheduledDate: subDays(new Date(), 120), // 4 months ago
      scheduledTime: '10:00',
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
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [oldAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('No Recent Appointments')).toBeInTheDocument();
    expect(screen.getByText(/Last appointment was 120 days ago/i)).toBeInTheDocument();
    expect(screen.getByText('Schedule Appointment')).toBeInTheDocument();
  });

  it('shows no appointments alert for new patient', () => {
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
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('No Appointments Scheduled')).toBeInTheDocument();
    expect(screen.getByText('This patient has no appointment history. Consider scheduling an initial consultation.')).toBeInTheDocument();
    expect(screen.getByText('Schedule First Appointment')).toBeInTheDocument();
  });

  it('shows follow-up needed alert', () => {
    const completedAppointmentWithFollowUp: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'mtm_session',
      title: 'MTM Session',
      description: 'Completed appointment needing follow-up',
      scheduledDate: subDays(new Date(), 10), // 10 days ago
      scheduledTime: '10:00',
      duration: 45,
      timezone: 'Africa/Lagos',
      status: 'completed',
      confirmationStatus: 'confirmed',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      relatedRecords: {},
      outcome: {
        status: 'successful',
        notes: 'Patient responded well',
        nextActions: ['Schedule follow-up in 2 weeks', 'Monitor blood pressure'],
        visitCreated: false,
      },
      createdBy: 'user1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [completedAppointmentWithFollowUp],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('Follow-up Needed')).toBeInTheDocument();
    expect(screen.getByText(/Follow-up required from mtm session appointment/i)).toBeInTheDocument();
    expect(screen.getByText('Schedule Follow-up')).toBeInTheDocument();
  });

  it('displays alert count badge', () => {
    const appointments: Appointment[] = [
      {
        _id: '1',
        workplaceId: 'workplace1',
        patientId: 'patient1',
        assignedTo: 'pharmacist1',
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date(), // Today
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
        scheduledDate: addDays(new Date(), 1), // Tomorrow
        scheduledTime: '14:00',
        duration: 25,
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
    ];

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Alert count badge
  });

  it('calls onViewAppointment callback when view details is clicked', () => {
    const mockOnViewAppointment = vi.fn();
    const todayAppointment: Appointment = {
      _id: '1',
      workplaceId: 'workplace1',
      patientId: 'patient1',
      assignedTo: 'pharmacist1',
      type: 'health_check',
      title: 'Health Check',
      scheduledDate: new Date(),
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
    };

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments: [todayAppointment],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts 
          patientId="patient1" 
          onViewAppointment={mockOnViewAppointment}
        />
      </TestWrapper>
    );

    const viewDetailsButton = screen.getByText('View Details');
    fireEvent.click(viewDetailsButton);

    expect(mockOnViewAppointment).toHaveBeenCalledWith('1');
  });

  it('calls onCreateAppointment callback when schedule button is clicked', () => {
    const mockOnCreateAppointment = vi.fn();

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
        <PatientAppointmentAlerts 
          patientId="patient1" 
          onCreateAppointment={mockOnCreateAppointment}
        />
      </TestWrapper>
    );

    const scheduleButton = screen.getByText('Schedule First Appointment');
    fireEvent.click(scheduleButton);

    expect(mockOnCreateAppointment).toHaveBeenCalled();
  });

  it('navigates to appointment creation when no callback provided', () => {
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
        <PatientAppointmentAlerts patientId="patient1" />
      </TestWrapper>
    );

    const scheduleButton = screen.getByText('Schedule First Appointment');
    fireEvent.click(scheduleButton);

    expect(mockNavigate).toHaveBeenCalledWith('/appointments/create?patientId=patient1');
  });

  it('limits alerts based on maxAlerts prop', () => {
    const appointments: Appointment[] = [
      // Create 6 appointments that would generate alerts
      ...Array.from({ length: 6 }, (_, i) => ({
        _id: `${i + 1}`,
        workplaceId: 'workplace1',
        patientId: 'patient1',
        assignedTo: 'pharmacist1',
        type: 'mtm_session' as const,
        title: 'MTM Session',
        scheduledDate: addDays(new Date(), i), // Different dates to generate different alerts
        scheduledTime: '10:00',
        duration: 45,
        timezone: 'Africa/Lagos',
        status: 'scheduled' as const,
        confirmationStatus: 'pending' as const,
        isRecurring: false,
        isRecurringException: false,
        reminders: [],
        relatedRecords: {},
        createdBy: 'user1',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ];

    mockUsePatientAppointments.mockReturnValue({
      data: {
        data: {
          appointments,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PatientAppointmentAlerts patientId="patient1" maxAlerts={3} />
      </TestWrapper>
    );

    // Should show badge with 3 (limited by maxAlerts)
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});