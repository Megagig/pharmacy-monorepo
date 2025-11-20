import { describe, it, expect, beforeEach } from 'vitest';
import { useAppointmentStore } from '../appointmentStore';
import type { Appointment, AppointmentStatus, AppointmentType } from '../appointmentTypes';

describe('AppointmentStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppointmentStore.setState({
      appointments: [],
      selectedAppointment: null,
      selectedDate: new Date('2025-10-25'),
      selectedView: 'week',
      filters: {
        search: '',
        sortBy: 'scheduledDate',
        sortOrder: 'asc',
        page: 1,
        limit: 50,
      },
      availableSlots: [],
      summary: null,
      loading: {},
      errors: {},
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        pages: 0,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAppointmentStore.getState();

      expect(state.appointments).toEqual([]);
      expect(state.selectedAppointment).toBeNull();
      expect(state.selectedView).toBe('week');
      expect(state.filters.sortBy).toBe('scheduledDate');
      expect(state.filters.sortOrder).toBe('asc');
      expect(state.loading).toEqual({});
      expect(state.errors).toEqual({});
    });
  });

  describe('Calendar View Actions', () => {
    it('should set selected date', () => {
      const { setSelectedDate } = useAppointmentStore.getState();
      const newDate = new Date('2025-11-01');

      setSelectedDate(newDate);

      const state = useAppointmentStore.getState();
      expect(state.selectedDate).toEqual(newDate);
    });

    it('should set selected view', () => {
      const { setSelectedView } = useAppointmentStore.getState();

      setSelectedView('day');
      expect(useAppointmentStore.getState().selectedView).toBe('day');

      setSelectedView('month');
      expect(useAppointmentStore.getState().selectedView).toBe('month');
    });

    it('should navigate date forward in day view', () => {
      const { setSelectedView, navigateDate } = useAppointmentStore.getState();
      const startDate = new Date('2025-10-25');

      useAppointmentStore.setState({ selectedDate: startDate });
      setSelectedView('day');
      navigateDate('next');

      const state = useAppointmentStore.getState();
      const expectedDate = new Date('2025-10-26');
      expect(state.selectedDate.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should navigate date backward in week view', () => {
      const { setSelectedView, navigateDate } = useAppointmentStore.getState();
      const startDate = new Date('2025-10-25');

      useAppointmentStore.setState({ selectedDate: startDate });
      setSelectedView('week');
      navigateDate('prev');

      const state = useAppointmentStore.getState();
      const expectedDate = new Date('2025-10-18');
      expect(state.selectedDate.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should navigate date forward in month view', () => {
      const { setSelectedView, navigateDate } = useAppointmentStore.getState();
      const startDate = new Date('2025-10-25');

      useAppointmentStore.setState({ selectedDate: startDate });
      setSelectedView('month');
      navigateDate('next');

      const state = useAppointmentStore.getState();
      expect(state.selectedDate.getMonth()).toBe(10); // November (0-indexed)
    });

    it('should go to today', () => {
      const { goToToday } = useAppointmentStore.getState();
      const futureDate = new Date('2026-01-01');

      useAppointmentStore.setState({ selectedDate: futureDate });
      goToToday();

      const state = useAppointmentStore.getState();
      const today = new Date();
      expect(state.selectedDate.toDateString()).toBe(today.toDateString());
    });
  });

  describe('Selection Actions', () => {
    const mockAppointment: Appointment = {
      _id: 'appt-1',
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type: 'mtm_session',
      title: 'MTM Session',
      scheduledDate: new Date('2025-10-25'),
      scheduledTime: '10:00',
      duration: 30,
      timezone: 'Africa/Lagos',
      status: 'scheduled',
      confirmationStatus: 'pending',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should select an appointment', () => {
      const { selectAppointment } = useAppointmentStore.getState();

      selectAppointment(mockAppointment);

      const state = useAppointmentStore.getState();
      expect(state.selectedAppointment).toEqual(mockAppointment);
    });

    it('should clear appointment selection', () => {
      const { selectAppointment } = useAppointmentStore.getState();

      selectAppointment(mockAppointment);
      selectAppointment(null);

      const state = useAppointmentStore.getState();
      expect(state.selectedAppointment).toBeNull();
    });
  });

  describe('Filter Actions', () => {
    it('should set filters', () => {
      const { setFilters } = useAppointmentStore.getState();

      setFilters({ search: 'John Doe', status: 'scheduled' });

      const state = useAppointmentStore.getState();
      expect(state.filters.search).toBe('John Doe');
      expect(state.filters.status).toBe('scheduled');
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters } = useAppointmentStore.getState();

      setFilters({ search: 'test', status: 'completed' });
      clearFilters();

      const state = useAppointmentStore.getState();
      expect(state.filters.search).toBe('');
      expect(state.filters.status).toBeUndefined();
    });

    it('should filter by status', () => {
      const { filterByStatus } = useAppointmentStore.getState();

      filterByStatus('confirmed');

      const state = useAppointmentStore.getState();
      expect(state.filters.status).toBe('confirmed');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by type', () => {
      const { filterByType } = useAppointmentStore.getState();

      filterByType('health_check');

      const state = useAppointmentStore.getState();
      expect(state.filters.type).toBe('health_check');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by pharmacist', () => {
      const { filterByPharmacist } = useAppointmentStore.getState();

      filterByPharmacist('pharmacist-123');

      const state = useAppointmentStore.getState();
      expect(state.filters.assignedTo).toBe('pharmacist-123');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by patient', () => {
      const { filterByPatient } = useAppointmentStore.getState();

      filterByPatient('patient-456');

      const state = useAppointmentStore.getState();
      expect(state.filters.patientId).toBe('patient-456');
      expect(state.filters.page).toBe(1);
    });

    it('should filter by date range', () => {
      const { filterByDateRange } = useAppointmentStore.getState();
      const startDate = new Date('2025-10-01');
      const endDate = new Date('2025-10-31');

      filterByDateRange(startDate, endDate);

      const state = useAppointmentStore.getState();
      expect(state.filters.startDate).toEqual(startDate);
      expect(state.filters.endDate).toEqual(endDate);
      expect(state.filters.page).toBe(1);
    });
  });

  describe('Pagination Actions', () => {
    it('should set page', () => {
      const { setPage } = useAppointmentStore.getState();

      setPage(3);

      const state = useAppointmentStore.getState();
      expect(state.filters.page).toBe(3);
    });

    it('should set limit and reset page', () => {
      const { setLimit } = useAppointmentStore.getState();

      useAppointmentStore.setState({ filters: { ...useAppointmentStore.getState().filters, page: 5 } });
      setLimit(100);

      const state = useAppointmentStore.getState();
      expect(state.filters.limit).toBe(100);
      expect(state.filters.page).toBe(1);
    });
  });

  describe('Local State Management', () => {
    const mockAppointment: Appointment = {
      _id: 'appt-1',
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type: 'mtm_session',
      title: 'MTM Session',
      scheduledDate: new Date('2025-10-25'),
      scheduledTime: '10:00',
      duration: 30,
      timezone: 'Africa/Lagos',
      status: 'scheduled',
      confirmationStatus: 'pending',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should add appointment to state', () => {
      const { addAppointmentToState } = useAppointmentStore.getState();

      addAppointmentToState(mockAppointment);

      const state = useAppointmentStore.getState();
      expect(state.appointments).toHaveLength(1);
      expect(state.appointments[0]).toEqual(mockAppointment);
      expect(state.pagination.total).toBe(1);
    });

    it('should update appointment in state', () => {
      const { addAppointmentToState, updateAppointmentInState } = useAppointmentStore.getState();

      addAppointmentToState(mockAppointment);
      updateAppointmentInState('appt-1', { status: 'confirmed' });

      const state = useAppointmentStore.getState();
      expect(state.appointments[0].status).toBe('confirmed');
    });

    it('should update selected appointment when updating in state', () => {
      const { addAppointmentToState, selectAppointment, updateAppointmentInState } =
        useAppointmentStore.getState();

      addAppointmentToState(mockAppointment);
      selectAppointment(mockAppointment);
      updateAppointmentInState('appt-1', { status: 'confirmed' });

      const state = useAppointmentStore.getState();
      expect(state.selectedAppointment?.status).toBe('confirmed');
    });

    it('should remove appointment from state', () => {
      const { addAppointmentToState, removeAppointmentFromState } = useAppointmentStore.getState();

      addAppointmentToState(mockAppointment);
      removeAppointmentFromState('appt-1');

      const state = useAppointmentStore.getState();
      expect(state.appointments).toHaveLength(0);
      expect(state.pagination.total).toBe(0);
    });

    it('should clear selected appointment when removing it', () => {
      const { addAppointmentToState, selectAppointment, removeAppointmentFromState } =
        useAppointmentStore.getState();

      addAppointmentToState(mockAppointment);
      selectAppointment(mockAppointment);
      removeAppointmentFromState('appt-1');

      const state = useAppointmentStore.getState();
      expect(state.selectedAppointment).toBeNull();
    });

    it('should set appointments', () => {
      const { setAppointments } = useAppointmentStore.getState();
      const appointments = [mockAppointment, { ...mockAppointment, _id: 'appt-2' }];

      setAppointments(appointments);

      const state = useAppointmentStore.getState();
      expect(state.appointments).toHaveLength(2);
    });
  });

  describe('Computed Getters', () => {
    const createMockAppointment = (
      id: string,
      date: Date,
      status: AppointmentStatus = 'scheduled',
      type: AppointmentType = 'mtm_session'
    ): Appointment => ({
      _id: id,
      workplaceId: 'workplace-1',
      patientId: 'patient-1',
      assignedTo: 'pharmacist-1',
      type,
      title: 'Appointment',
      scheduledDate: date,
      scheduledTime: '10:00',
      duration: 30,
      timezone: 'Africa/Lagos',
      status,
      confirmationStatus: 'pending',
      isRecurring: false,
      isRecurringException: false,
      reminders: [],
      createdBy: 'user-1',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should get appointments by date', () => {
      const { setAppointments, getAppointmentsByDate } = useAppointmentStore.getState();
      const targetDate = new Date('2025-10-25');

      const appointments = [
        createMockAppointment('appt-1', new Date('2025-10-25')),
        createMockAppointment('appt-2', new Date('2025-10-26')),
        createMockAppointment('appt-3', new Date('2025-10-25')),
      ];

      setAppointments(appointments);

      const result = getAppointmentsByDate(targetDate);
      expect(result).toHaveLength(2);
      expect(result.map((a) => a._id)).toEqual(['appt-1', 'appt-3']);
    });

    it('should get appointments by date range', () => {
      const { setAppointments, getAppointmentsByDateRange } = useAppointmentStore.getState();

      const appointments = [
        createMockAppointment('appt-1', new Date('2025-10-20')),
        createMockAppointment('appt-2', new Date('2025-10-25')),
        createMockAppointment('appt-3', new Date('2025-10-30')),
        createMockAppointment('appt-4', new Date('2025-11-05')),
      ];

      setAppointments(appointments);

      const result = getAppointmentsByDateRange(
        new Date('2025-10-22'),
        new Date('2025-10-31')
      );
      expect(result).toHaveLength(2);
      expect(result.map((a) => a._id)).toEqual(['appt-2', 'appt-3']);
    });

    it('should get upcoming appointments', () => {
      const { setAppointments, getUpcomingAppointments } = useAppointmentStore.getState();
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date(now);
      nextMonth.setDate(nextMonth.getDate() + 30);

      const appointments = [
        createMockAppointment('appt-1', tomorrow, 'scheduled'),
        createMockAppointment('appt-2', nextWeek, 'scheduled'),
        createMockAppointment('appt-3', nextMonth, 'scheduled'),
        createMockAppointment('appt-4', tomorrow, 'completed'),
      ];

      setAppointments(appointments);

      const result = getUpcomingAppointments(7);
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.status === 'scheduled')).toBe(true);
    });

    it('should get today appointments', () => {
      const { setAppointments, getTodayAppointments } = useAppointmentStore.getState();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointments = [
        createMockAppointment('appt-1', today),
        createMockAppointment('appt-2', tomorrow),
        createMockAppointment('appt-3', today),
      ];

      setAppointments(appointments);

      const result = getTodayAppointments();
      expect(result).toHaveLength(2);
    });

    it('should get overdue appointments', () => {
      const { setAppointments, getOverdueAppointments } = useAppointmentStore.getState();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointments = [
        createMockAppointment('appt-1', yesterday, 'scheduled'),
        createMockAppointment('appt-2', yesterday, 'completed'),
        createMockAppointment('appt-3', tomorrow, 'scheduled'),
      ];

      setAppointments(appointments);

      const result = getOverdueAppointments();
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('appt-1');
    });

    it('should get appointments by status', () => {
      const { setAppointments, getAppointmentsByStatus } = useAppointmentStore.getState();

      const appointments = [
        createMockAppointment('appt-1', new Date(), 'scheduled'),
        createMockAppointment('appt-2', new Date(), 'confirmed'),
        createMockAppointment('appt-3', new Date(), 'scheduled'),
      ];

      setAppointments(appointments);

      const result = getAppointmentsByStatus('scheduled');
      expect(result).toHaveLength(2);
    });

    it('should get appointments by type', () => {
      const { setAppointments, getAppointmentsByType } = useAppointmentStore.getState();

      const appointments = [
        createMockAppointment('appt-1', new Date(), 'scheduled', 'mtm_session'),
        createMockAppointment('appt-2', new Date(), 'scheduled', 'health_check'),
        createMockAppointment('appt-3', new Date(), 'scheduled', 'mtm_session'),
      ];

      setAppointments(appointments);

      const result = getAppointmentsByType('mtm_session');
      expect(result).toHaveLength(2);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useAppointmentStore.getState();

      setLoading('fetchAppointments', true);

      const state = useAppointmentStore.getState();
      expect(state.loading.fetchAppointments).toBe(true);
    });

    it('should clear loading state', () => {
      const { setLoading } = useAppointmentStore.getState();

      setLoading('fetchAppointments', true);
      setLoading('fetchAppointments', false);

      const state = useAppointmentStore.getState();
      expect(state.loading.fetchAppointments).toBe(false);
    });

    it('should set error state', () => {
      const { setError } = useAppointmentStore.getState();

      setError('fetchAppointments', 'Failed to fetch appointments');

      const state = useAppointmentStore.getState();
      expect(state.errors.fetchAppointments).toBe('Failed to fetch appointments');
    });

    it('should clear all errors', () => {
      const { setError, clearErrors } = useAppointmentStore.getState();

      setError('fetchAppointments', 'Error 1');
      setError('createAppointment', 'Error 2');
      clearErrors();

      const state = useAppointmentStore.getState();
      expect(state.errors).toEqual({});
    });
  });
});
