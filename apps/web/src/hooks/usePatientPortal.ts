import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientPortalService, AppointmentType, AvailableSlot, BookingData, PatientAppointment } from '../services/patientPortalService';

// Query keys for consistent caching
export const patientPortalKeys = {
  all: ['patient-portal'] as const,
  appointmentTypes: (workplaceId: string) => [...patientPortalKeys.all, 'appointment-types', workplaceId] as const,
  availableSlots: (params: { workplaceId: string; date: string; type?: string; duration?: number; pharmacistId?: string; locationId?: string }) => 
    [...patientPortalKeys.all, 'available-slots', params] as const,
  myAppointments: (params: any) => [...patientPortalKeys.all, 'my-appointments', params] as const,
};

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch available appointment types
 */
export const useAppointmentTypes = (workplaceId: string, enabled = true) => {
  return useQuery({
    queryKey: patientPortalKeys.appointmentTypes(workplaceId),
    queryFn: () => patientPortalService.getAppointmentTypes(workplaceId),
    enabled: enabled && !!workplaceId,
    staleTime: 10 * 60 * 1000, // 10 minutes - appointment types don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

/**
 * Hook to fetch available time slots
 */
export const useAvailableSlots = (
  params: {
    workplaceId: string;
    date: string;
    type?: string;
    duration?: number;
    pharmacistId?: string;
    locationId?: string;
  },
  enabled = true
) => {
  return useQuery({
    queryKey: patientPortalKeys.availableSlots(params),
    queryFn: () => patientPortalService.getAvailableSlots(params),
    enabled: enabled && !!params.workplaceId && !!params.date,
    staleTime: 1 * 60 * 1000, // 1 minute - slots change frequently
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes to keep slots fresh
  });
};

/**
 * Hook to fetch patient's appointments
 */
export const useMyAppointments = (
  params: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    cursor?: string;
    includeCompleted?: boolean;
    includeCancelled?: boolean;
  } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: patientPortalKeys.myAppointments(params),
    queryFn: () => patientPortalService.getMyAppointments(params),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// =============================================
// MUTATION HOOKS
// =============================================

/**
 * Hook to book an appointment
 */
export const useBookAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingData: BookingData) => 
      patientPortalService.bookAppointment(bookingData),
    
    onSuccess: (response, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.myAppointments({}) });
      
      // Invalidate available slots for the booked date
      queryClient.invalidateQueries({ 
        queryKey: patientPortalKeys.availableSlots({
          workplaceId: '', // Will be invalidated for all workplaces
          date: variables.scheduledDate,
        }),
        exact: false, // Invalidate all matching queries
      });
    },
    
    onError: (error) => {
      console.error('Failed to book appointment:', error);
    },
  });
};

/**
 * Hook to reschedule an appointment
 */
export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();

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
        notifyPharmacist?: boolean;
      };
    }) => patientPortalService.rescheduleAppointment(appointmentId, rescheduleData),

    onSuccess: (response, { rescheduleData }) => {
      // Invalidate appointments list
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.myAppointments({}) });
      
      // Invalidate available slots for both old and new dates
      queryClient.invalidateQueries({ 
        queryKey: patientPortalKeys.availableSlots({
          workplaceId: '',
          date: rescheduleData.newDate,
        }),
        exact: false,
      });
    },

    onError: (error) => {
      console.error('Failed to reschedule appointment:', error);
    },
  });
};

/**
 * Hook to cancel an appointment
 */
export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      cancelData 
    }: { 
      appointmentId: string; 
      cancelData: {
        reason: string;
        notifyPharmacist?: boolean;
      };
    }) => patientPortalService.cancelAppointment(appointmentId, cancelData),

    onSuccess: () => {
      // Invalidate appointments list
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.myAppointments({}) });
      
      // Invalidate available slots to show the freed slot
      queryClient.invalidateQueries({ 
        queryKey: patientPortalKeys.availableSlots({}),
        exact: false,
      });
    },

    onError: (error) => {
      console.error('Failed to cancel appointment:', error);
    },
  });
};

/**
 * Hook to confirm an appointment
 */
export const useConfirmAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      appointmentId, 
      confirmData 
    }: { 
      appointmentId: string; 
      confirmData: {
        confirmationToken?: string;
        patientNotes?: string;
        specialRequirements?: string;
      };
    }) => patientPortalService.confirmAppointment(appointmentId, confirmData),

    onSuccess: () => {
      // Invalidate appointments list to show updated confirmation status
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.myAppointments({}) });
    },

    onError: (error) => {
      console.error('Failed to confirm appointment:', error);
    },
  });
};

/**
 * Hook to reserve a time slot temporarily
 */
export const useReserveSlot = () => {
  return useMutation({
    mutationFn: (params: {
      workplaceId: string;
      date: string;
      time: string;
      type: string;
      pharmacistId?: string;
    }) => patientPortalService.reserveSlot(params),
    
    onError: (error) => {
      console.error('Failed to reserve slot:', error);
    },
  });
};

/**
 * Hook to release a reserved slot
 */
export const useReleaseSlot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) => 
      patientPortalService.releaseSlot(reservationId),
    
    onSuccess: () => {
      // Invalidate available slots to show the released slot
      queryClient.invalidateQueries({ 
        queryKey: patientPortalKeys.availableSlots({}),
        exact: false,
      });
    },

    onError: (error) => {
      console.error('Failed to release slot:', error);
    },
  });
};

// =============================================
// UTILITY HOOKS
// =============================================

/**
 * Hook to invalidate patient portal queries
 */
export const useInvalidatePatientPortal = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: patientPortalKeys.all }),
    invalidateAppointmentTypes: (workplaceId: string) => 
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.appointmentTypes(workplaceId) }),
    invalidateAvailableSlots: () => 
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.availableSlots({}), exact: false }),
    invalidateMyAppointments: () => 
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.myAppointments({}), exact: false }),
  };
};