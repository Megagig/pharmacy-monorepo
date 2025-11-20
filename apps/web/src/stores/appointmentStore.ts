import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Appointment,
  AppointmentFilters,
  AppointmentSummary,
  CalendarView,
  AvailableSlot,
} from './appointmentTypes';
import { LoadingState, ErrorState } from './types';

interface AppointmentStore {
  // State
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  selectedDate: Date;
  selectedView: CalendarView;
  filters: AppointmentFilters;
  availableSlots: AvailableSlot[];
  summary: AppointmentSummary | null;
  loading: LoadingState;
  errors: ErrorState;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Calendar view actions
  setSelectedDate: (date: Date) => void;
  setSelectedView: (view: CalendarView) => void;
  navigateDate: (direction: 'prev' | 'next') => void;
  goToToday: () => void;

  // Selection actions
  selectAppointment: (appointment: Appointment | null) => void;

  // Filter actions
  setFilters: (filters: Partial<AppointmentFilters>) => void;
  clearFilters: () => void;
  filterByStatus: (status: string | string[]) => void;
  filterByType: (type: string | string[]) => void;
  filterByPharmacist: (pharmacistId: string) => void;
  filterByPatient: (patientId: string) => void;
  filterByDateRange: (startDate: Date, endDate: Date) => void;

  // Pagination actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;

  // Utility actions
  clearErrors: () => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // Local state management
  addAppointmentToState: (appointment: Appointment) => void;
  updateAppointmentInState: (id: string, updates: Partial<Appointment>) => void;
  removeAppointmentFromState: (id: string) => void;
  setAppointments: (appointments: Appointment[]) => void;
  setAvailableSlots: (slots: AvailableSlot[]) => void;
  setSummary: (summary: AppointmentSummary) => void;

  // Computed getters
  getAppointmentsByDate: (date: Date) => Appointment[];
  getAppointmentsByDateRange: (startDate: Date, endDate: Date) => Appointment[];
  getUpcomingAppointments: (days?: number) => Appointment[];
  getTodayAppointments: () => Appointment[];
  getOverdueAppointments: () => Appointment[];
  getAppointmentsByStatus: (status: string) => Appointment[];
  getAppointmentsByType: (type: string) => Appointment[];
}

const DEFAULT_FILTERS: AppointmentFilters = {
  search: '',
  sortBy: 'scheduledDate',
  sortOrder: 'asc',
  page: 1,
  limit: 50,
};

export const useAppointmentStore = create<AppointmentStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        appointments: [],
        selectedAppointment: null,
        selectedDate: new Date(), // Always start with current date
        selectedView: 'month', // Start with month view for better overview
        filters: DEFAULT_FILTERS,
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

        // Calendar view actions
        setSelectedDate: (date: Date) => {
          set({ selectedDate: date }, false, 'setSelectedDate');
        },

        setSelectedView: (view: CalendarView) => {
          set({ selectedView: view }, false, 'setSelectedView');
        },

        navigateDate: (direction: 'prev' | 'next') => {
          const { selectedDate, selectedView } = get();
          const newDate = new Date(selectedDate);

          switch (selectedView) {
            case 'day':
              newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
              break;
            case 'week':
              newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
              break;
            case 'month':
              newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
              break;
          }

          set({ selectedDate: newDate }, false, 'navigateDate');
        },

        goToToday: () => {
          set({ selectedDate: new Date() }, false, 'goToToday');
        },

        // Selection actions
        selectAppointment: (appointment: Appointment | null) => {
          set({ selectedAppointment: appointment }, false, 'selectAppointment');
        },

        // Filter actions
        setFilters: (newFilters: Partial<AppointmentFilters>) => {
          set(
            (state) => ({
              filters: { ...state.filters, ...newFilters },
            }),
            false,
            'setFilters'
          );
        },

        clearFilters: () => {
          set({ filters: DEFAULT_FILTERS }, false, 'clearFilters');
        },

        filterByStatus: (status: string | string[]) => {
          set(
            (state) => ({
              filters: { ...state.filters, status: status as any, page: 1 },
            }),
            false,
            'filterByStatus'
          );
        },

        filterByType: (type: string | string[]) => {
          set(
            (state) => ({
              filters: { ...state.filters, type: type as any, page: 1 },
            }),
            false,
            'filterByType'
          );
        },

        filterByPharmacist: (pharmacistId: string) => {
          set(
            (state) => ({
              filters: { ...state.filters, assignedTo: pharmacistId, page: 1 },
            }),
            false,
            'filterByPharmacist'
          );
        },

        filterByPatient: (patientId: string) => {
          set(
            (state) => ({
              filters: { ...state.filters, patientId, page: 1 },
            }),
            false,
            'filterByPatient'
          );
        },

        filterByDateRange: (startDate: Date, endDate: Date) => {
          set(
            (state) => ({
              filters: { ...state.filters, startDate, endDate, page: 1 },
            }),
            false,
            'filterByDateRange'
          );
        },

        // Pagination actions
        setPage: (page: number) => {
          set(
            (state) => ({
              filters: { ...state.filters, page },
            }),
            false,
            'setPage'
          );
        },

        setLimit: (limit: number) => {
          set(
            (state) => ({
              filters: { ...state.filters, limit, page: 1 },
            }),
            false,
            'setLimit'
          );
        },

        // Utility actions
        clearErrors: () => {
          set({ errors: {} }, false, 'clearErrors');
        },

        setLoading: (key: string, loading: boolean) => {
          set(
            (state) => ({
              loading: { ...state.loading, [key]: loading },
            }),
            false,
            'setLoading'
          );
        },

        setError: (key: string, error: string | null) => {
          set(
            (state) => ({
              errors: { ...state.errors, [key]: error },
            }),
            false,
            'setError'
          );
        },

        // Local state management
        addAppointmentToState: (appointment: Appointment) => {
          set(
            (state) => ({
              appointments: [appointment, ...state.appointments],
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1,
              },
            }),
            false,
            'addAppointmentToState'
          );
        },

        updateAppointmentInState: (id: string, updates: Partial<Appointment>) => {
          set(
            (state) => ({
              appointments: state.appointments.map((a) =>
                a._id === id ? { ...a, ...updates } : a
              ),
              selectedAppointment:
                state.selectedAppointment && state.selectedAppointment._id === id
                  ? { ...state.selectedAppointment, ...updates }
                  : state.selectedAppointment,
            }),
            false,
            'updateAppointmentInState'
          );
        },

        removeAppointmentFromState: (id: string) => {
          set(
            (state) => ({
              appointments: state.appointments.filter((a) => a._id !== id),
              selectedAppointment:
                state.selectedAppointment && state.selectedAppointment._id === id
                  ? null
                  : state.selectedAppointment,
              pagination: {
                ...state.pagination,
                total: Math.max(0, state.pagination.total - 1),
              },
            }),
            false,
            'removeAppointmentFromState'
          );
        },

        setAppointments: (appointments: Appointment[]) => {
          set({ appointments }, false, 'setAppointments');
        },

        setAvailableSlots: (slots: AvailableSlot[]) => {
          set({ availableSlots: slots }, false, 'setAvailableSlots');
        },

        setSummary: (summary: AppointmentSummary) => {
          set({ summary }, false, 'setSummary');
        },

        // Computed getters
        getAppointmentsByDate: (date: Date) => {
          const { appointments } = get();
          const targetDate = new Date(date);
          targetDate.setHours(0, 0, 0, 0);

          return appointments.filter((appointment) => {
                const appointmentDate = new Date(appointment.scheduledDate);
            appointmentDate.setHours(0, 0, 0, 0);
            return appointmentDate.getTime() === targetDate.getTime();
          });
        },

        getAppointmentsByDateRange: (startDate: Date, endDate: Date) => {
          const { appointments } = get();
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          return appointments.filter((appointment) => {
            const appointmentDate = new Date(appointment.scheduledDate);
            return appointmentDate >= start && appointmentDate <= end;
          });
        },

        getUpcomingAppointments: (days: number = 7) => {
          const { appointments } = get();
          const now = new Date();
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + days);

          return appointments
            .filter((appointment) => {
              const appointmentDate = new Date(appointment.scheduledDate);
              return (
                appointmentDate >= now &&
                appointmentDate <= futureDate &&
                appointment.status === 'scheduled'
              );
            })
            .sort(
              (a, b) =>
                new Date(a.scheduledDate).getTime() -
                new Date(b.scheduledDate).getTime()
            );
        },

        getTodayAppointments: () => {
          const { appointments } = get();
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          return appointments.filter((appointment) => {
            const appointmentDate = new Date(appointment.scheduledDate);
            appointmentDate.setHours(0, 0, 0, 0);
            return appointmentDate.getTime() === today.getTime();
          });
        },

        getOverdueAppointments: () => {
          const { appointments } = get();
          const now = new Date();

          return appointments.filter((appointment) => {
            const appointmentDate = new Date(appointment.scheduledDate);
            return (
              appointmentDate < now &&
              appointment.status === 'scheduled' &&
              !appointment.isDeleted
            );
          });
        },

        getAppointmentsByStatus: (status: string) => {
          const { appointments } = get();
          return appointments.filter((a) => a.status === status);
        },

        getAppointmentsByType: (type: string) => {
          const { appointments } = get();
          return appointments.filter((a) => a.type === type);
        },
      }),
      {
        name: 'appointment-store',
        partialize: (state) => ({
          // Don't persist selectedDate so it always starts with today
          selectedView: state.selectedView,
          filters: state.filters,
          // Don't persist selectedAppointment to avoid stale selections
        }),
      }
    ),
    { name: 'AppointmentStore' }
  )
);

// Selector hooks for better performance - COMPLETELY STABLE to prevent infinite re-renders
export const useAppointmentCalendar = () => {
  // Use individual selectors to ensure maximum stability
  const selectedDate = useAppointmentStore((state) => state.selectedDate);
  const selectedView = useAppointmentStore((state) => state.selectedView);
  const setSelectedDate = useAppointmentStore((state) => state.setSelectedDate);
  const setSelectedView = useAppointmentStore((state) => state.setSelectedView);
  const navigateDate = useAppointmentStore((state) => state.navigateDate);
  const goToToday = useAppointmentStore((state) => state.goToToday);
  
  return {
    selectedDate,
    selectedView,
    setSelectedDate,
    setSelectedView,
    navigateDate,
    goToToday,
  };
};

export const useAppointmentSelection = () => {
  const selectedAppointment = useAppointmentStore((state) => state.selectedAppointment);
  const selectAppointment = useAppointmentStore((state) => state.selectAppointment);
  
  return {
    selectedAppointment,
    selectAppointment,
  };
};

export const useAppointmentFilters = () =>
  useAppointmentStore((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
    clearFilters: state.clearFilters,
    filterByStatus: state.filterByStatus,
    filterByType: state.filterByType,
    filterByPharmacist: state.filterByPharmacist,
    filterByPatient: state.filterByPatient,
    filterByDateRange: state.filterByDateRange,
  }));

export const useAppointmentList = () =>
  useAppointmentStore((state) => ({
    appointments: state.appointments,
    summary: state.summary,
    pagination: state.pagination,
    loading: state.loading,
    errors: state.errors,
    setPage: state.setPage,
    setLimit: state.setLimit,
  }));

export const useAppointmentSlots = () =>
  useAppointmentStore((state) => ({
    availableSlots: state.availableSlots,
    setAvailableSlots: state.setAvailableSlots,
    loading: state.loading.fetchSlots || false,
    error: state.errors.fetchSlots || null,
  }));

export const useAppointmentActions = () =>
  useAppointmentStore((state) => ({
    addAppointmentToState: state.addAppointmentToState,
    updateAppointmentInState: state.updateAppointmentInState,
    removeAppointmentFromState: state.removeAppointmentFromState,
    setAppointments: state.setAppointments,
    setSummary: state.setSummary,
    setLoading: state.setLoading,
    setError: state.setError,
    clearErrors: state.clearErrors,
  }));

export const useAppointmentQueries = () =>
  useAppointmentStore((state) => ({
    getUpcomingAppointments: state.getUpcomingAppointments,
    getTodayAppointments: state.getTodayAppointments,
    getOverdueAppointments: state.getOverdueAppointments,
    getAppointmentsByStatus: state.getAppointmentsByStatus,
    getAppointmentsByType: state.getAppointmentsByType,
  }));
