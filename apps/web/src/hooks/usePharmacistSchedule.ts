import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  pharmacistScheduleService,
  PharmacistSchedule,
  TimeOffRequest,
  ScheduleUpdateData,
  CapacityReport,
} from '../services/pharmacistScheduleService';

// Query keys for consistent caching
export const scheduleKeys = {
  all: ['pharmacist-schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (locationId?: string) => [...scheduleKeys.lists(), { locationId }] as const,
  details: () => [...scheduleKeys.all, 'detail'] as const,
  detail: (pharmacistId: string) => [...scheduleKeys.details(), pharmacistId] as const,
  capacity: () => [...scheduleKeys.all, 'capacity'] as const,
  capacityReport: (params: {
    startDate: string;
    endDate: string;
    pharmacistId?: string;
    locationId?: string;
  }) => [...scheduleKeys.capacity(), params] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch pharmacist schedule
 */
export const usePharmacistSchedule = (pharmacistId: string, enabled = true) => {
  return useQuery({
    queryKey: scheduleKeys.detail(pharmacistId),
    queryFn: async () => {
      try {
        return await pharmacistScheduleService.getPharmacistSchedule(pharmacistId);
      } catch (error: any) {
        console.warn('Pharmacist schedule API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Pharmacist schedule API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled: enabled && !!pharmacistId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch all pharmacist schedules
 */
export const useAllPharmacistSchedules = (locationId?: string) => {
  return useQuery({
    queryKey: scheduleKeys.list(locationId),
    queryFn: async () => {
      try {
        return await pharmacistScheduleService.getAllPharmacistSchedules(locationId);
      } catch (error: any) {
        console.warn('All pharmacist schedules API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('All pharmacist schedules API not available - returning empty data');
          return { data: [], success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Hook to fetch capacity report
 */
export const useCapacityReport = (
  params: {
    startDate: string;
    endDate: string;
    pharmacistId?: string;
    locationId?: string;
  },
  enabled = true
) => {
  return useQuery({
    queryKey: scheduleKeys.capacityReport(params),
    queryFn: async () => {
      try {
        return await pharmacistScheduleService.getCapacityReport(params);
      } catch (error: any) {
        console.warn('Capacity report API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Capacity report API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled: enabled && !!params.startDate && !!params.endDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to update pharmacist schedule
 */
export const useUpdatePharmacistSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pharmacistId,
      scheduleData,
    }: {
      pharmacistId: string;
      scheduleData: ScheduleUpdateData;
    }) => pharmacistScheduleService.updatePharmacistSchedule(pharmacistId, scheduleData),

    onMutate: async ({ pharmacistId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduleKeys.detail(pharmacistId) });

      // Snapshot the previous value
      const previousSchedule = queryClient.getQueryData(scheduleKeys.detail(pharmacistId));

      return { previousSchedule, pharmacistId };
    },

    onSuccess: (response, { pharmacistId }) => {
      if (response.data?.schedule) {
        // Update the schedule in cache
        queryClient.setQueryData(scheduleKeys.detail(pharmacistId), response);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
        queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
      }
    },

    onError: (error, { pharmacistId }, context) => {
      // Revert optimistic update
      if (context?.previousSchedule) {
        queryClient.setQueryData(scheduleKeys.detail(pharmacistId), context.previousSchedule);
      }
    },
  });
};

/**
 * Hook to request time off
 */
export const useRequestTimeOff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pharmacistId,
      timeOffData,
    }: {
      pharmacistId: string;
      timeOffData: TimeOffRequest;
    }) => pharmacistScheduleService.requestTimeOff(pharmacistId, timeOffData),

    onSuccess: (response, { pharmacistId }) => {
      // Invalidate schedule to refetch with new time-off request
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(pharmacistId) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
};

/**
 * Hook to update time-off status
 */
export const useUpdateTimeOffStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pharmacistId,
      timeOffId,
      status,
      reason,
    }: {
      pharmacistId: string;
      timeOffId: string;
      status: 'approved' | 'rejected';
      reason?: string;
    }) => pharmacistScheduleService.updateTimeOffStatus(pharmacistId, timeOffId, status, reason),

    onSuccess: (response, { pharmacistId }) => {
      // Invalidate schedule to refetch with updated time-off status
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(pharmacistId) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to prefetch pharmacist schedule
 */
export const usePrefetchPharmacistSchedule = () => {
  const queryClient = useQueryClient();

  return (pharmacistId: string) => {
    queryClient.prefetchQuery({
      queryKey: scheduleKeys.detail(pharmacistId),
      queryFn: () => pharmacistScheduleService.getPharmacistSchedule(pharmacistId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
};

/**
 * Hook to invalidate schedule queries
 */
export const useInvalidateSchedules = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() }),
    invalidateDetail: (pharmacistId: string) => 
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(pharmacistId) }),
    invalidateCapacity: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() }),
  };
};