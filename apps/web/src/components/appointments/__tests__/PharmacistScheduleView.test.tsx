import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PharmacistScheduleView from '../PharmacistScheduleView';
import * as scheduleHooks from '../../../hooks/usePharmacistSchedule';
import * as appointmentHooks from '../../../hooks/useAppointments';
import * as notificationHooks from '../../../hooks/useNotification';

// Mock the hooks
vi.mock('../../../hooks/usePharmacistSchedule');
vi.mock('../../../hooks/useAppointments');
vi.mock('../../../hooks/useNotification');

const mockScheduleHooks = scheduleHooks as any;
const mockAppointmentHooks = appointmentHooks as any;
const mockNotificationHooks = notificationHooks as any;

// Mock data
const mockScheduleData = {
  data: {
    schedule: {
      _id: 'schedule-1',
      workplaceId: 'workplace-1',
      pharmacistId: 'pharmacist-1',
      workingHours: [
        {
          dayOfWeek: 1, // Monday
          isWorkingDay: true,
          shifts: [
            {
              startTime: '09:00',
              endTime: '17:00',
              breakStart: '12:00',
              breakEnd: '13:00',
            },
          ],
        },
        {
          dayOfWeek: 2, // Tuesday
          isWorkingDay: true,
          shifts: [
            {
              startTime: '09:00',
              endTime: '17:00',
            },
          ],
        },
        {
          dayOfWeek: 0, // Sunday
          isWorkingDay: false,
          shifts: [],
        },
      ],
      timeOff: [
        {
          _id: 'timeoff-1',
          startDate: '2025-11-01',
          endDate: '2025-11-05',
          reason: 'Vacation',
          type: 'vacation',
          status: 'pending',
        },
        {
          _id: 'timeoff-2',
          startDate: '2025-12-20',
          endDate: '2025-12-25',
          reason: 'Holiday break',
          type: 'vacation',
          status: 'approved',
        },
      ],
      appointmentPreferences: {
        maxAppointmentsPerDay: 10,
        maxConcurrentAppointments: 1,
        appointmentTypes: ['mtm_session', 'health_check', 'vaccination'],
        defaultDuration: 30,
        bufferBetweenAppointments: 5,
      },
      capacityStats: {
        totalSlotsAvailable: 100,
        slotsBooked: 75,
        utilizationRate: 75,
        lastCalculatedAt: '2025-10-27T10:00:00Z',
      },
      isActive: true,
      effectiveFrom: '2025-01-01',
      pharmacist: {
        _id: 'pharmacist-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-10-27T10:00:00Z',
    },
    upcomingTimeOff: [
      {
        _id: 'timeoff-1',
        startDate: '2025-11-01',
        endDate: '2025-11-05',
        reason: 'Vacation',
        type: 'vacation',
        status: 'pending',
      },
    ],
    utilizationRate: 75,
  },
};

const mockUpcomingAppointments = {
  data: {
    appointments: [
      {
        _id: 'appointment-1',
        type: 'mtm_session',
        title: 'MTM Session with Patient A',
        scheduledDate: '2025-10-28',
        scheduledTime: '10:00',
        duration: 30,
        status: 'confirmed',
        description: 'Medication therapy management session',
      },
      {
        _id: 'appointment-2',
        type: 'health_check',
        title: 'Health Check for Patient B',
        scheduledDate: '2025-10-29',
        scheduledTime: '14:00',
        duration: 45,
        status: 'scheduled',
        description: 'Annual health check',
      },
    ],
    summary: {
      thisWeek: 5,
      today: 2,
      tomorrow: 1,
    },
  },
};

const mockCapacityData = {
  data: {
    overall: {
      totalSlots: 100,
      bookedSlots: 75,
      utilizationRate: 75,
    },
    byPharmacist: [
      {
        pharmacistId: 'pharmacist-1',
        pharmacistName: 'John Doe',
        totalSlots: 100,
        bookedSlots: 75,
        utilizationRate: 75,
      },
    ],
    byDay: [
      {
        date: '2025-10-28',
        dayName: 'Monday',
        totalSlots: 20,
        bookedSlots: 15,
        utilizationRate: 75,
      },
      {
        date: '2025-10-29',
        dayName: 'Tuesday',
        totalSlots: 20,
        bookedSlots: 18,
        utilizationRate: 90,
      },
    ],
    recommendations: [
      'Consider adding more slots on Tuesdays',
      'Overall utilization is good',
    ],
  },
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
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {children}
      </LocalizationProvider>
    </QueryClientProvider>
  );
};

describe('PharmacistScheduleView', () => {
  const mockShowNotification = vi.fn();
  const mockUpdateSchedule = vi.fn();
  const mockRequestTimeOff = vi.fn();
  const mockUpdateTimeOffStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock notification hook
    mockNotificationHooks.useNotification.mockReturnValue({
      showNotification: mockShowNotification,
    });

    // Mock schedule hooks
    mockScheduleHooks.usePharmacistSchedule.mockReturnValue({
      data: mockScheduleData,
      isLoading: false,
      error: null,
    });

    mockScheduleHooks.useUpdatePharmacistSchedule.mockReturnValue({
      mutateAsync: mockUpdateSchedule,
      isPending: false,
    });

    mockScheduleHooks.useRequestTimeOff.mockReturnValue({
      mutateAsync: mockRequestTimeOff,
      isPending: false,
    });

    mockScheduleHooks.useUpdateTimeOffStatus.mockReturnValue({
      mutateAsync: mockUpdateTimeOffStatus,
      isPending: false,
    });

    mockScheduleHooks.useCapacityReport.mockReturnValue({
      data: mockCapacityData,
      isLoading: false,
    });

    // Mock appointment hooks
    mockAppointmentHooks.useUpcomingAppointments.mockReturnValue({
      data: mockUpcomingAppointments,
      isLoading: false,
    });
  });

  it('renders pharmacist schedule view with basic information', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Check header
    expect(screen.getByText("John Doe's Schedule")).toBeInTheDocument();

    // Check summary cards
    expect(screen.getByText('2')).toBeInTheDocument(); // Working days
    expect(screen.getByText('Working Days/Week')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument(); // Utilization rate
    expect(screen.getByText('5')).toBeInTheDocument(); // Appointments this week

    // Check tabs
    expect(screen.getByText('Working Hours')).toBeInTheDocument();
    expect(screen.getByText('Time Off')).toBeInTheDocument();
    expect(screen.getByText('Capacity')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Appointments')).toBeInTheDocument();
  });

  it('displays working hours correctly', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Check working hours for Monday
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getAllByText('09:00 - 17:00')).toHaveLength(2); // Monday and Tuesday
    expect(screen.getByText('Break: 12:00 - 13:00')).toBeInTheDocument();

    // Check working hours for Tuesday
    expect(screen.getByText('Tuesday')).toBeInTheDocument();

    // Check non-working day
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Not working')).toBeInTheDocument();
  });

  it('displays appointment preferences', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Check appointment preferences
    expect(screen.getByText('Max Appointments/Day')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Default Duration')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('Buffer Between Appointments')).toBeInTheDocument();
    expect(screen.getByText('5 minutes')).toBeInTheDocument();

    // Check appointment types
    expect(screen.getByText('mtm session')).toBeInTheDocument();
    expect(screen.getByText('health check')).toBeInTheDocument();
    expect(screen.getByText('vaccination')).toBeInTheDocument();
  });

  it('displays time off requests in time off tab', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Click on Time Off tab
    await user.click(screen.getByText('Time Off'));

    // Check time off requests
    expect(screen.getByText('Nov 01 - Nov 05, 2025')).toBeInTheDocument();
    expect(screen.getByText('Type: vacation')).toBeInTheDocument();
    expect(screen.getByText('Reason: Vacation')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('displays capacity metrics in capacity tab', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Click on Capacity tab
    await user.click(screen.getByText('Capacity'));

    // Check capacity metrics
    expect(screen.getByText('Capacity Utilization (This Week)')).toBeInTheDocument();
    expect(screen.getAllByText('75%')).toHaveLength(3); // Summary card + capacity tab + daily breakdown
    expect(screen.getByText('75')).toBeInTheDocument(); // Booked slots
    expect(screen.getByText('25')).toBeInTheDocument(); // Available slots (100-75)

    // Check daily breakdown
    expect(screen.getByText('Daily Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
    expect(screen.getByText('15/20 slots')).toBeInTheDocument();
    expect(screen.getByText('18/20 slots')).toBeInTheDocument();

    // Check recommendations
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Consider adding more slots on Tuesdays')).toBeInTheDocument();
    expect(screen.getByText('Overall utilization is good')).toBeInTheDocument();
  });

  it('displays upcoming appointments in appointments tab', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Click on Upcoming Appointments tab
    await user.click(screen.getByText('Upcoming Appointments'));

    // Check upcoming appointments
    expect(screen.getByText('mtm session - MTM Session with Patient A')).toBeInTheDocument();
    expect(screen.getByText('Oct 28, 2025 at 10:00')).toBeInTheDocument();
    expect(screen.getByText('Duration: 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('Medication therapy management session')).toBeInTheDocument();

    expect(screen.getByText('health check - Health Check for Patient B')).toBeInTheDocument();
    expect(screen.getByText('Oct 29, 2025 at 14:00')).toBeInTheDocument();
    expect(screen.getByText('Duration: 45 minutes')).toBeInTheDocument();
  });

  it('shows edit buttons when canEdit is true', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Request Time Off')).toBeInTheDocument();
    expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
  });

  it('hides edit buttons when canEdit is false', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Request Time Off')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Schedule')).not.toBeInTheDocument();
  });

  it('opens time off request dialog when request time off button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={true} />
      </TestWrapper>
    );

    // Click Request Time Off button (use the first one in the header)
    const requestButtons = screen.getAllByText('Request Time Off');
    await user.click(requestButtons[0]);

    // Check if dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    expect(screen.getAllByText('Type')).toHaveLength(2); // Label and span
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });

  it('submits time off request successfully', async () => {
    const user = userEvent.setup();
    mockRequestTimeOff.mockResolvedValue({
      data: {
        timeOff: { _id: 'new-timeoff', status: 'pending' },
        affectedAppointments: [],
      },
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={true} />
      </TestWrapper>
    );

    // Open time off dialog
    await user.click(screen.getByText('Request Time Off'));

    // Fill form
    await user.type(screen.getByLabelText('Reason'), 'Need time off for personal reasons');

    // Submit form
    await user.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(mockRequestTimeOff).toHaveBeenCalledWith({
        pharmacistId: 'pharmacist-1',
        timeOffData: expect.objectContaining({
          reason: 'Need time off for personal reasons',
          type: 'vacation',
        }),
      });
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Time-off request submitted successfully',
      'success'
    );
  });

  it('handles time off approval', async () => {
    const user = userEvent.setup();
    mockUpdateTimeOffStatus.mockResolvedValue({
      data: { timeOff: { _id: 'timeoff-1', status: 'approved' } },
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={true} />
      </TestWrapper>
    );

    // Go to Time Off tab
    await user.click(screen.getByText('Time Off'));

    // Find and click approve button
    const approveButton = screen.getByLabelText('Approve');
    await user.click(approveButton);

    await waitFor(() => {
      expect(mockUpdateTimeOffStatus).toHaveBeenCalledWith({
        pharmacistId: 'pharmacist-1',
        timeOffId: 'timeoff-1',
        status: 'approved',
      });
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Time-off request approved successfully',
      'success'
    );
  });

  it('handles time off rejection', async () => {
    const user = userEvent.setup();
    mockUpdateTimeOffStatus.mockResolvedValue({
      data: { timeOff: { _id: 'timeoff-1', status: 'rejected' } },
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" canEdit={true} />
      </TestWrapper>
    );

    // Go to Time Off tab
    await user.click(screen.getByText('Time Off'));

    // Find and click reject button
    const rejectButton = screen.getByLabelText('Reject');
    await user.click(rejectButton);

    await waitFor(() => {
      expect(mockUpdateTimeOffStatus).toHaveBeenCalledWith({
        pharmacistId: 'pharmacist-1',
        timeOffId: 'timeoff-1',
        status: 'rejected',
      });
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Time-off request rejected successfully',
      'success'
    );
  });

  it('shows loading state', () => {
    mockScheduleHooks.usePharmacistSchedule.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockScheduleHooks.usePharmacistSchedule.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load pharmacist schedule. Please try again.')).toBeInTheDocument();
  });

  it('shows no schedule message when schedule is null', () => {
    mockScheduleHooks.usePharmacistSchedule.mockReturnValue({
      data: { data: { schedule: null } },
      isLoading: false,
      error: null,
    });

    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    expect(screen.getByText('No schedule found for this pharmacist.')).toBeInTheDocument();
  });

  it('hides capacity metrics when showCapacityMetrics is false', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView 
          pharmacistId="pharmacist-1" 
          showCapacityMetrics={false}
        />
      </TestWrapper>
    );

    // Capacity tab should still be visible but capacity report hook should not be called
    expect(screen.getByText('Capacity')).toBeInTheDocument();
    expect(mockScheduleHooks.useCapacityReport).toHaveBeenCalledWith(
      expect.any(Object),
      false // enabled should be false
    );
  });

  it('calculates working hours summary correctly', () => {
    render(
      <TestWrapper>
        <PharmacistScheduleView pharmacistId="pharmacist-1" />
      </TestWrapper>
    );

    // Should show 2 working days (Monday and Tuesday)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Working Days/Week')).toBeInTheDocument();

    // Should calculate total hours correctly (7 hours Monday + 8 hours Tuesday = 15 hours)
    // Monday: 09:00-17:00 with 12:00-13:00 break = 7 hours
    // Tuesday: 09:00-17:00 = 8 hours
    // Total: 15 hours
    expect(screen.getByText('15h')).toBeInTheDocument();
    expect(screen.getByText('Total Hours/Week')).toBeInTheDocument();
  });
});