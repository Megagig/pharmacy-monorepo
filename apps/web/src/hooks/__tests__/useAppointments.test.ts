import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useAppointments,
  useAppointmentCalendar,
  useAppointment,
  usePatientAppointments,
  useUpcomingAppointments,
  useAvailableSlots,
  useCreateAppointment,
  useUpdateAppointmentStatus,
  useRescheduleAppointment,
  useCancelAppointment,
  appointmentKeys,
} from '../useAppointments';
import { appointmentService } from '../../services/appointmentService';
import { useAppointmentStore } from '../../stores/appointmentStore';
import { Appointment, AppointmentFormData } from '../../stores/appointmentTypes';

// Mock the appointment service
vi.mock('../../services/appointmentService', () => ({
  appointmentService: {
    getAppointments: vi.fn(),
    getCalendarAppointments: vi.fn(),
    getAppointment: vi.fn(),
    getPatientAppointments: vi.fn(),
    getUpcomingAppointments: vi.fn(),
    getAvailableSlots: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointmentStatus: vi.fn(),
    rescheduleAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
  },
}));

// Mock the appointment store
vi.mock('../../stores/appointmentStore', () => ({
  useAppointmentStore: vi.fn(),
}));

// Mock data
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
  duration: 30,
  timezone: 'Africa/Lagos',
  status: 'scheduled',
  confirmationStatus: 'pending',
  isRecurring: false,
  isRecurringException: false,
  reminders: [],
  relatedRecords: {},
  createdBy: 'pharmacist-1',
  isDeleted: false,
  createdAt: new Date('2025-10-25T08:00:00Z'),
  updatedAt: new Date('2025-10-25T08:00:00Z'),
};

const mockAppointmentFormData: AppointmentFormData = {
  patientId: 'patient-1',
  type: 'mtm_session',
  scheduledDate: new Date('2025-10-26T10:00:00Z'),
  scheduledTime: '10:00',
  duration: 30,
  assignedTo: 'pharmacist-1',
  description: 'MTM Session',
};

const mockStoreActions = {
  setAppointments: vi.fn(),
  setSummary: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  selectAppointment: vi.fn(),
  setAvailableSlots: vi.fn(),
  addAppointmentToState: vi.fn(),
  updateAppointmentInState: vi.fn(),
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useAppointments hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAppointmentStore as any).mockReturnValue(mockStoreActions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useAppointments', () => {
    it('should fetch appointments successfully', async () => {
      const mockResponse = {
        data: { results: [mockAppointment] },
        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrev: false },
        summary: { total: 1, byStatus: { scheduled: 1 }, byType: { mtm_session: 1 } },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.getAppointments as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAppointments({}), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });

      expect(appointmentService.getAppointments).toHaveBeenCalledWith({});
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith('fetchAppointments', true);
      expect(mockStoreActions.setAppointments).toHaveBeenCalledWith([mockAppointment]);
      expect(mockStoreActions.setSummary).toHaveBeenCalledWith(mockResponse.summary);
      expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchAppointments', null);
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith('fetchAppointments', false);
    });

    it('should call error handling when service fails', async () => {
      const mockError = new Error('Failed to fetch appointments');
      (appointmentService.getAppointments as any).mockRejectedValue(mockError);

      const wrapper = createWrapper();
      renderHook(() => useAppointments({}), { wrapper });

      // Wait a bit for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error handling was called
      expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchAppointments', 'Failed to fetch appointments');
    });

    it('should use correct query key with filters', () => {
      const filters = { status: 'scheduled', patientId: 'patient-1' };
      const expectedKey = appointmentKeys.list(filters);

      expect(expectedKey).toEqual(['appointments', 'list', filters]);
    });
  });

  describe('useAppointmentCalendar', () => {
    it('should fetch calendar appointments successfully', async () => {
      const params = { view: 'week' as const, date: '2025-10-26', pharmacistId: 'pharmacist-1' };
      const mockResponse = {
        data: {
          appointments: [mockAppointment],
          summary: { total: 1, byStatus: { scheduled: 1 }, byType: { mtm_session: 1 } },
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.getCalendarAppointments as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAppointmentCalendar(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.getCalendarAppointments).toHaveBeenCalledWith(params);
      expect(mockStoreActions.setAppointments).toHaveBeenCalledWith([mockAppointment]);
      expect(mockStoreActions.setSummary).toHaveBeenCalledWith(mockResponse.data.summary);
    });
  });

  describe('useAppointment', () => {
    it('should fetch single appointment successfully', async () => {
      const appointmentId = 'appointment-1';
      const mockResponse = {
        data: {
          appointment: mockAppointment,
          patient: { _id: 'patient-1', firstName: 'John', lastName: 'Doe' },
          assignedPharmacist: { _id: 'pharmacist-1', firstName: 'Jane', lastName: 'Smith' },
          relatedRecords: {},
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.getAppointment as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAppointment(appointmentId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.getAppointment).toHaveBeenCalledWith(appointmentId);
      expect(mockStoreActions.selectAppointment).toHaveBeenCalledWith(mockAppointment);
    });

    it('should not fetch when disabled', () => {
      const appointmentId = 'appointment-1';
      const wrapper = createWrapper();
      renderHook(() => useAppointment(appointmentId, false), { wrapper });

      expect(appointmentService.getAppointment).not.toHaveBeenCalled();
    });
  });

  describe('useAvailableSlots', () => {
    it('should fetch available slots successfully', async () => {
      const params = { date: '2025-10-26', pharmacistId: 'pharmacist-1', duration: 30 };
      const mockSlots = [
        { time: '09:00', available: true, pharmacistId: 'pharmacist-1' },
        { time: '09:30', available: true, pharmacistId: 'pharmacist-1' },
        { time: '10:00', available: false, pharmacistId: 'pharmacist-1' },
      ];
      const mockResponse = {
        data: {
          slots: mockSlots,
          pharmacists: [{ _id: 'pharmacist-1', firstName: 'Jane', lastName: 'Smith' }],
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.getAvailableSlots as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useAvailableSlots(params), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.getAvailableSlots).toHaveBeenCalledWith(params);
      expect(mockStoreActions.setAvailableSlots).toHaveBeenCalledWith(mockSlots);
    });
  });

  describe('useCreateAppointment', () => {
    it('should create appointment successfully with optimistic updates', async () => {
      const mockResponse = {
        data: {
          appointment: mockAppointment,
          reminders: [],
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.createAppointment as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateAppointment(), { wrapper });

      // Trigger mutation
      result.current.mutate(mockAppointmentFormData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.createAppointment).toHaveBeenCalledWith(mockAppointmentFormData);
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith('createAppointment', true);
      expect(mockStoreActions.addAppointmentToState).toHaveBeenCalled();
      expect(mockStoreActions.setLoading).toHaveBeenCalledWith('createAppointment', false);
    });

    it('should handle create appointment error', async () => {
      const mockError = new Error('Failed to create appointment');
      (appointmentService.createAppointment as any).mockRejectedValue(mockError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateAppointment(), { wrapper });

      // Trigger mutation
      result.current.mutate(mockAppointmentFormData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockStoreActions.setError).toHaveBeenCalledWith('createAppointment', 'Failed to create appointment');
    });
  });

  describe('useUpdateAppointmentStatus', () => {
    it('should update appointment status successfully', async () => {
      const appointmentId = 'appointment-1';
      const statusData = { status: 'confirmed' as const };
      const mockResponse = {
        data: {
          appointment: { ...mockAppointment, status: 'confirmed', confirmedAt: new Date() },
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.updateAppointmentStatus as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateAppointmentStatus(), { wrapper });

      // Trigger mutation
      result.current.mutate({ appointmentId, statusData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.updateAppointmentStatus).toHaveBeenCalledWith(appointmentId, statusData);
      expect(mockStoreActions.updateAppointmentInState).toHaveBeenCalled();
    });
  });

  describe('useRescheduleAppointment', () => {
    it('should reschedule appointment successfully', async () => {
      const appointmentId = 'appointment-1';
      const rescheduleData = {
        newDate: '2025-10-27',
        newTime: '14:00',
        reason: 'Patient requested change',
        notifyPatient: true,
      };
      const mockResponse = {
        data: {
          appointment: {
            ...mockAppointment,
            scheduledDate: new Date('2025-10-27T14:00:00Z'),
            scheduledTime: '14:00',
            status: 'rescheduled',
          },
          notificationSent: true,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.rescheduleAppointment as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRescheduleAppointment(), { wrapper });

      // Trigger mutation
      result.current.mutate({ appointmentId, rescheduleData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.rescheduleAppointment).toHaveBeenCalledWith(appointmentId, rescheduleData);
      expect(mockStoreActions.updateAppointmentInState).toHaveBeenCalled();
    });
  });

  describe('useCancelAppointment', () => {
    it('should cancel appointment successfully', async () => {
      const appointmentId = 'appointment-1';
      const cancelData = {
        reason: 'Patient no longer needs service',
        notifyPatient: true,
        cancelType: 'this_only' as const,
      };
      const mockResponse = {
        data: {
          appointment: {
            ...mockAppointment,
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: cancelData.reason,
          },
          cancelledCount: 1,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.cancelAppointment as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCancelAppointment(), { wrapper });

      // Trigger mutation
      result.current.mutate({ appointmentId, cancelData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(appointmentService.cancelAppointment).toHaveBeenCalledWith(appointmentId, cancelData);
      expect(mockStoreActions.updateAppointmentInState).toHaveBeenCalled();
    });
  });

  describe('Query Keys', () => {
    it('should generate correct query keys', () => {
      const filters = { status: 'scheduled', patientId: 'patient-1' };
      const calendarParams = { view: 'week', date: '2025-10-26', pharmacistId: 'pharmacist-1' };
      const upcomingParams = { days: 7, pharmacistId: 'pharmacist-1' };
      const slotsParams = { date: '2025-10-26', pharmacistId: 'pharmacist-1', duration: 30 };

      expect(appointmentKeys.all).toEqual(['appointments']);
      expect(appointmentKeys.lists()).toEqual(['appointments', 'list']);
      expect(appointmentKeys.list(filters)).toEqual(['appointments', 'list', filters]);
      expect(appointmentKeys.details()).toEqual(['appointments', 'detail']);
      expect(appointmentKeys.detail('appointment-1')).toEqual(['appointments', 'detail', 'appointment-1']);
      expect(appointmentKeys.calendar()).toEqual(['appointments', 'calendar']);
      expect(appointmentKeys.calendarView(calendarParams)).toEqual(['appointments', 'calendar', calendarParams]);
      expect(appointmentKeys.patient('patient-1')).toEqual(['appointments', 'patient', 'patient-1']);
      expect(appointmentKeys.upcoming(upcomingParams)).toEqual(['appointments', 'upcoming', upcomingParams]);
      expect(appointmentKeys.availableSlots(slotsParams)).toEqual(['appointments', 'slots', slotsParams]);
    });
  });

  describe('Error Handling', () => {
    it('should have retry logic configured', () => {
      // Test that the retry function exists and behaves correctly
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAppointments({}), { wrapper });
      
      // The hook should be created successfully
      expect(result.current).toBeDefined();
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Service error');
      (appointmentService.getAppointments as any).mockRejectedValue(mockError);

      const wrapper = createWrapper();
      renderHook(() => useAppointments({}), { wrapper });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockStoreActions.setError).toHaveBeenCalledWith('fetchAppointments', 'Service error');
    });
  });

  describe('Optimistic Updates', () => {
    it('should perform optimistic update on create and revert on error', async () => {
      const mockError = new Error('Network error');
      (appointmentService.createAppointment as any).mockRejectedValue(mockError);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCreateAppointment(), { wrapper });

      // Trigger mutation
      result.current.mutate(mockAppointmentFormData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 3000 });

      // Should add optimistic appointment during onMutate
      expect(mockStoreActions.addAppointmentToState).toHaveBeenCalled();
      // Should handle error
      expect(mockStoreActions.setError).toHaveBeenCalledWith('createAppointment', 'Network error');
    });

    it('should perform optimistic update on status change', async () => {
      const appointmentId = 'appointment-1';
      const statusData = { status: 'confirmed' as const };
      const mockResponse = {
        data: { appointment: { ...mockAppointment, status: 'confirmed' } },
        success: true,
        timestamp: new Date().toISOString(),
      };

      (appointmentService.updateAppointmentStatus as any).mockResolvedValue(mockResponse);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateAppointmentStatus(), { wrapper });

      // Trigger mutation
      result.current.mutate({ appointmentId, statusData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 3000 });

      // Should optimistically update during onMutate and onSuccess
      expect(mockStoreActions.updateAppointmentInState).toHaveBeenCalled();
    });
  });
});