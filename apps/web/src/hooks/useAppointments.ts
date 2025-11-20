import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../services/appointmentService';
import { useAppointmentStore } from '../stores/appointmentStore';
import {
  Appointment,
  AppointmentFilters,
  AppointmentFormData,
  AppointmentSummary,
  AvailableSlot,
} from '../stores/appointmentTypes';

// Query keys for consistent caching
export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters: AppointmentFilters) => [...appointmentKeys.lists(), filters] as const,
  details: () => [...appointmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...appointmentKeys.details(), id] as const,
  calendar: () => [...appointmentKeys.all, 'calendar'] as const,
  calendarView: (params: { view: string; date: string; pharmacistId?: string; locationId?: string }) => 
    [...appointmentKeys.calendar(), params] as const,
  patient: (patientId: string) => [...appointmentKeys.all, 'patient', patientId] as const,
  upcoming: (params: { days?: number; pharmacistId?: string }) => 
    [...appointmentKeys.all, 'upcoming', params] as const,
  availableSlots: (params: { date: string; pharmacistId?: string; duration?: number; type?: string }) => 
    [...appointmentKeys.all, 'slots', params] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch appointments with filtering and pagination
 */
export const useAppointments = (filters: AppointmentFilters = {}) => {
  const { setAppointments, setSummary, setLoading, setError } = useAppointmentStore();

  return useQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: async () => {
      setLoading('fetchAppointments', true);
      try {
        const response = await appointmentService.getAppointments(filters);
        
        // Update store with fetched data
        setAppointments(response.data.results || []);
        if (response.summary) {
          setSummary(response.summary);
        }
        
        setError('fetchAppointments', null);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch appointments';
        setError('fetchAppointments', errorMessage);
        throw error;
      } finally {
        setLoading('fetchAppointments', false);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch calendar view of appointments
 */
export const useAppointmentCalendar = (
  params: {
    view: 'day' | 'week' | 'month';
    date: string;
    pharmacistId?: string;
    locationId?: string;
  },
  enabled = true
) => {
  const { setAppointments, setSummary, setLoading, setError } = useAppointmentStore();

  return useQuery({
    queryKey: appointmentKeys.calendarView(params),
    queryFn: async () => {
      setLoading('fetchCalendar', true);
      try {
        const response = await appointmentService.getCalendarAppointments(params);
        
        // Update store with calendar data
        if (response.data?.appointments) {
          setAppointments(response.data.appointments);
        }
        if (response.data?.summary) {
          setSummary(response.data.summary);
        }
        
        setError('fetchCalendar', null);
        return response;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch calendar';
        console.warn('Calendar API error:', errorMessage);
        setError('fetchCalendar', errorMessage);
        
        // Don't throw on 403/401 errors or "feature not available" errors to prevent infinite loops
        if (error?.response?.status === 403 || 
            error?.response?.status === 401 || 
            errorMessage.includes('This feature is not available') ||
            errorMessage.includes('feature is not available')) {
          console.warn('Calendar API not available - returning empty data');
          setError('fetchCalendar', null); // Clear the error
          return { data: { appointments: [], summary: null } };
        }
        
        throw error;
      } finally {
        setLoading('fetchCalendar', false);
      }
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes for calendar data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Disable to prevent loops
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors or feature not available errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      if (error?.message?.includes('This feature is not available') || 
          error?.message?.includes('feature is not available')) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch single appointment details
 */
export const useAppointment = (appointmentId: string, enabled = true) => {
  const { selectAppointment, setLoading, setError } = useAppointmentStore();

  return useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: async () => {
      setLoading('fetchAppointment', true);
      try {
        const response = await appointmentService.getAppointment(appointmentId);
        
        // Update selected appointment in store
        if (response.data?.appointment) {
          selectAppointment(response.data.appointment);
        }
        
        setError('fetchAppointment', null);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch appointment';
        setError('fetchAppointment', errorMessage);
        throw error;
      } finally {
        setLoading('fetchAppointment', false);
      }
    },
    enabled: enabled && !!appointmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch patient appointments
 */
export const usePatientAppointments = (
  patientId: string,
  params: { status?: string; limit?: number; page?: number } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: appointmentKeys.patient(patientId),
    queryFn: () => appointmentService.getPatientAppointments(patientId, params),
    enabled: enabled && !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch upcoming appointments
 */
export const useUpcomingAppointments = (
  params: { days?: number; pharmacistId?: string } = {}
) => {
  return useQuery({
    queryKey: appointmentKeys.upcoming(params),
    queryFn: () => appointmentService.getUpcomingAppointments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch available time slots with enhanced response handling
 */
export const useAvailableSlots = (
  params: {
    date: string;
    pharmacistId?: string;
    duration?: number;
    type?: string;
    includeUnavailable?: boolean;
  },
  enabled = true
) => {
  const { setAvailableSlots, setLoading, setError } = useAppointmentStore();

  return useQuery({
    queryKey: appointmentKeys.availableSlots(params),
    queryFn: async () => {
      setLoading('fetchSlots', true);
      try {
        const response = await appointmentService.getAvailableSlots(params);
        
        // Update available slots in store with enhanced data
        if (response.data?.slots) {
          setAvailableSlots(response.data.slots);
        }
        
        setError('fetchSlots', null);
        
        // Return enhanced response with additional metadata
        return {
          ...response,
          data: {
            ...response.data,
            // Ensure backward compatibility
            totalAvailable: response.data?.summary?.availableSlots || response.data?.totalAvailable || 0,
            // Add new enhanced data
            pharmacists: response.data?.pharmacists || [],
            summary: response.data?.summary || {
              totalSlots: response.data?.slots?.length || 0,
              availableSlots: response.data?.slots?.filter((s: any) => s.available)?.length || 0,
              unavailableSlots: response.data?.slots?.filter((s: any) => !s.available)?.length || 0,
              utilizationRate: 0
            }
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch available slots';
        setError('fetchSlots', errorMessage);
        
        // Enhanced error handling
        console.error('Available slots fetch error:', {
          error: errorMessage,
          params,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      } finally {
        setLoading('fetchSlots', false);
      }
    },
    enabled: enabled && !!params.date,
    staleTime: 1 * 60 * 1000, // 1 minute for slot availability
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on validation errors (4xx)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

/**
 * Hook to get next available slot for a pharmacist
 */
export const useNextAvailableSlot = (
  params: {
    pharmacistId: string;
    duration?: number;
    type?: string;
    daysAhead?: number;
  },
  enabled = true
) => {
  return useQuery({
    queryKey: [...appointmentKeys.all, 'next-available-slot', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      const { default: apiClient } = await import('../services/apiClient');
      const response = await apiClient({
        url: `/appointments/next-available-slot?${searchParams.toString()}`,
        method: 'GET',
      });

      return response.data;
    },
    enabled: enabled && !!params.pharmacistId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

/**
 * Hook to validate slot availability
 */
export const useValidateSlot = () => {
  return useMutation({
    mutationFn: async (slotData: {
      pharmacistId: string;
      date: string;
      time: string;
      duration?: number;
      type?: string;
    }) => {
      const { default: apiClient } = await import('../services/apiClient');
      const response = await apiClient({
        url: '/appointments/validate-slot',
        method: 'POST',
        data: slotData,
      });

      return response.data;
    },
  });
};

/**
 * Hook to get pharmacist availability summary
 */
export const usePharmacistAvailability = (
  params: {
    pharmacistId: string;
    startDate: string;
    endDate: string;
    duration?: number;
  },
  enabled = true
) => {
  return useQuery({
    queryKey: [...appointmentKeys.all, 'pharmacist-availability', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      const { default: apiClient } = await import('../services/apiClient');
      const response = await apiClient({
        url: `/appointments/pharmacist-availability?${searchParams.toString()}`,
        method: 'GET',
      });

      return response.data;
    },
    enabled: enabled && !!params.pharmacistId && !!params.startDate && !!params.endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to create new appointment
 */
export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  const { addAppointmentToState, setLoading, setError } = useAppointmentStore();

  return useMutation({
    mutationFn: (appointmentData: AppointmentFormData) => 
      appointmentService.createAppointment(appointmentData),
    
    onMutate: async (appointmentData) => {
      setLoading('createAppointment', true);
      setError('createAppointment', null);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentKeys.lists() });

      // Snapshot the previous value
      const previousAppointments = queryClient.getQueryData(appointmentKeys.lists());

      // Optimistically update the cache with temporary appointment
      const tempAppointment: Appointment = {
        _id: `temp-${Date.now()}`,
        workplaceId: '',
        patientId: appointmentData.patientId,
        assignedTo: appointmentData.assignedTo || '',
        type: appointmentData.type,
        title: `${appointmentData.type.replace('_', ' ')} appointment`,
        description: appointmentData.description,
        scheduledDate: appointmentData.scheduledDate,
        scheduledTime: appointmentData.scheduledTime,
        duration: appointmentData.duration,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        confirmationStatus: 'pending',
        isRecurring: appointmentData.isRecurring || false,
        recurrencePattern: appointmentData.recurrencePattern,
        isRecurringException: false,
        reminders: [],
        relatedRecords: {},
        patientPreferences: appointmentData.patientPreferences,
        metadata: {
          source: 'manual',
        },
        createdBy: '',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to store optimistically
      addAppointmentToState(tempAppointment);

      return { previousAppointments, tempAppointment };
    },

    onSuccess: (response, variables, context) => {
      setLoading('createAppointment', false);
      
      if (response.data?.appointment) {
        // Replace temp appointment with real one
        const realAppointment = response.data.appointment;
        
        // Update store with real appointment
        addAppointmentToState(realAppointment);
        
        // Invalidate and refetch related queries
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.calendar() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.upcoming({}) });
        
        // If patient-specific, invalidate patient appointments
        if (variables.patientId) {
          queryClient.invalidateQueries({ 
            queryKey: appointmentKeys.patient(variables.patientId) 
          });
        }
      }
    },

    onError: (error, variables, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create appointment';
      setError('createAppointment', errorMessage);
      setLoading('createAppointment', false);

      // Revert optimistic update
      if (context?.previousAppointments) {
        queryClient.setQueryData(appointmentKeys.lists(), context.previousAppointments);
      }
    },

    onSettled: () => {
      setLoading('createAppointment', false);
    },
  });
};

/**
 * Hook to update appointment status
 */
export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  const { updateAppointmentInState, setLoading, setError } = useAppointmentStore();

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      statusData 
    }: { 
      appointmentId: string; 
      statusData: {
        status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
        reason?: string;
        outcome?: any;
      };
    }) => appointmentService.updateAppointmentStatus(appointmentId, statusData),

    onMutate: async ({ appointmentId, statusData }) => {
      setLoading('updateStatus', true);
      setError('updateStatus', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentKeys.detail(appointmentId) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData(appointmentKeys.detail(appointmentId));

      // Optimistically update
      updateAppointmentInState(appointmentId, {
        status: statusData.status,
        ...(statusData.status === 'completed' && statusData.outcome && {
          completedAt: new Date(),
          outcome: statusData.outcome,
        }),
        ...(statusData.status === 'cancelled' && statusData.reason && {
          cancelledAt: new Date(),
          cancellationReason: statusData.reason,
        }),
        ...(statusData.status === 'confirmed' && {
          confirmedAt: new Date(),
          confirmationStatus: 'confirmed' as const,
        }),
      });

      return { previousAppointment };
    },

    onSuccess: (response, { appointmentId }) => {
      setLoading('updateStatus', false);
      
      if (response.data?.appointment) {
        // Update store with server response
        updateAppointmentInState(appointmentId, response.data.appointment);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.calendar() });
      }
    },

    onError: (error, { appointmentId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update appointment status';
      setError('updateStatus', errorMessage);
      setLoading('updateStatus', false);

      // Revert optimistic update
      if (context?.previousAppointment) {
        queryClient.setQueryData(appointmentKeys.detail(appointmentId), context.previousAppointment);
      }
    },

    onSettled: () => {
      setLoading('updateStatus', false);
    },
  });
};

/**
 * Hook to reschedule appointment
 */
export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();
  const { updateAppointmentInState, setLoading, setError } = useAppointmentStore();

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      rescheduleData 
    }: { 
      appointmentId: string; 
      rescheduleData: {
        newDate: string;
        newTime: string;
        reason: string;
        notifyPatient?: boolean;
      };
    }) => appointmentService.rescheduleAppointment(appointmentId, rescheduleData),

    onMutate: async ({ appointmentId, rescheduleData }) => {
      setLoading('reschedule', true);
      setError('reschedule', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentKeys.detail(appointmentId) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData(appointmentKeys.detail(appointmentId));

      // Optimistically update
      updateAppointmentInState(appointmentId, {
        scheduledDate: new Date(rescheduleData.newDate),
        scheduledTime: rescheduleData.newTime,
        rescheduledFrom: new Date(), // Will be corrected by server
        rescheduledTo: new Date(rescheduleData.newDate),
        rescheduledReason: rescheduleData.reason,
        rescheduledAt: new Date(),
        status: 'rescheduled',
      });

      return { previousAppointment };
    },

    onSuccess: (response, { appointmentId }) => {
      setLoading('reschedule', false);
      
      if (response.data?.appointment) {
        // Update store with server response
        updateAppointmentInState(appointmentId, response.data.appointment);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.calendar() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.availableSlots({}) });
      }
    },

    onError: (error, { appointmentId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reschedule appointment';
      setError('reschedule', errorMessage);
      setLoading('reschedule', false);

      // Revert optimistic update
      if (context?.previousAppointment) {
        queryClient.setQueryData(appointmentKeys.detail(appointmentId), context.previousAppointment);
      }
    },

    onSettled: () => {
      setLoading('reschedule', false);
    },
  });
};

/**
 * Hook to cancel appointment
 */
export const useCancelAppointment = () => {
  const queryClient = useQueryClient();
  const { updateAppointmentInState, setLoading, setError } = useAppointmentStore();

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      cancelData 
    }: { 
      appointmentId: string; 
      cancelData: {
        reason: string;
        notifyPatient?: boolean;
        cancelType?: 'this_only' | 'all_future';
      };
    }) => appointmentService.cancelAppointment(appointmentId, cancelData),

    onMutate: async ({ appointmentId, cancelData }) => {
      setLoading('cancel', true);
      setError('cancel', null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentKeys.detail(appointmentId) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData(appointmentKeys.detail(appointmentId));

      // Optimistically update
      updateAppointmentInState(appointmentId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: cancelData.reason,
      });

      return { previousAppointment };
    },

    onSuccess: (response, { appointmentId }) => {
      setLoading('cancel', false);
      
      if (response.data?.appointment) {
        // Update store with server response
        updateAppointmentInState(appointmentId, response.data.appointment);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.calendar() });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.availableSlots({}) });
      }
    },

    onError: (error, { appointmentId }, context) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel appointment';
      setError('cancel', errorMessage);
      setLoading('cancel', false);

      // Revert optimistic update
      if (context?.previousAppointment) {
        queryClient.setQueryData(appointmentKeys.detail(appointmentId), context.previousAppointment);
      }
    },

    onSettled: () => {
      setLoading('cancel', false);
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to prefetch appointment data
 */
export const usePrefetchAppointment = () => {
  const queryClient = useQueryClient();

  return (appointmentId: string) => {
    queryClient.prefetchQuery({
      queryKey: appointmentKeys.detail(appointmentId),
      queryFn: () => appointmentService.getAppointment(appointmentId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
};

/**
 * Hook to invalidate appointment queries
 */
export const useInvalidateAppointments = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() }),
    invalidateCalendar: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.calendar() }),
    invalidateDetail: (id: string) => queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(id) }),
    invalidatePatient: (patientId: string) => queryClient.invalidateQueries({ queryKey: appointmentKeys.patient(patientId) }),
    invalidateUpcoming: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.upcoming({}) }),
    invalidateSlots: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.availableSlots({}) }),
  };
};