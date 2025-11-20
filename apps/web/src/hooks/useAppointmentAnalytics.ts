import { useQuery } from '@tanstack/react-query';
import { appointmentAnalyticsService } from '../services/appointmentAnalyticsService';

// Query keys for consistent caching
export const appointmentAnalyticsKeys = {
  all: ['appointment-analytics'] as const,
  analytics: (params: AppointmentAnalyticsParams) => 
    [...appointmentAnalyticsKeys.all, 'analytics', params] as const,
  followUps: (params: FollowUpAnalyticsParams) => 
    [...appointmentAnalyticsKeys.all, 'follow-ups', params] as const,
  reminders: (params: ReminderAnalyticsParams) => 
    [...appointmentAnalyticsKeys.all, 'reminders', params] as const,
  capacity: (params: CapacityAnalyticsParams) => 
    [...appointmentAnalyticsKeys.all, 'capacity', params] as const,
};

// Types for analytics parameters
export interface AppointmentAnalyticsParams {
  startDate?: string;
  endDate?: string;
  pharmacistId?: string;
  locationId?: string;
  appointmentType?: string;
}

export interface FollowUpAnalyticsParams {
  startDate?: string;
  endDate?: string;
  pharmacistId?: string;
  taskType?: string;
  priority?: string;
}

export interface ReminderAnalyticsParams {
  startDate?: string;
  endDate?: string;
  channel?: string;
  templateId?: string;
}

export interface CapacityAnalyticsParams {
  startDate?: string;
  endDate?: string;
  pharmacistId?: string;
  locationId?: string;
}

// Analytics data types
export interface AppointmentAnalytics {
  summary: {
    totalAppointments: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    averageWaitTime: number;
    averageDuration: number;
  };
  byType: Array<{
    type: string;
    count: number;
    completionRate: number;
    averageDuration: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      appointments: number;
      completed: number;
      cancelled: number;
      noShow: number;
    }>;
    weekly: Array<{
      week: string;
      appointments: number;
      completionRate: number;
    }>;
    monthly: Array<{
      month: string;
      appointments: number;
      completionRate: number;
    }>;
  };
  peakTimes: {
    busiestDay: string;
    busiestHour: string;
    hourlyDistribution: Array<{
      hour: number;
      count: number;
    }>;
    dailyDistribution: Array<{
      day: string;
      count: number;
    }>;
  };
  pharmacistPerformance: Array<{
    pharmacistId: string;
    pharmacistName: string;
    totalAppointments: number;
    completionRate: number;
    averageDuration: number;
    patientSatisfaction?: number;
  }>;
}

export interface FollowUpAnalytics {
  summary: {
    totalTasks: number;
    completionRate: number;
    averageTimeToCompletion: number;
    overdueCount: number;
    criticalOverdueCount: number;
  };
  byType: Array<{
    type: string;
    count: number;
    completionRate: number;
    averageTimeToCompletion: number;
  }>;
  byPriority: Array<{
    priority: string;
    count: number;
    completionRate: number;
    averageTimeToCompletion: number;
  }>;
  byTrigger: Array<{
    triggerType: string;
    count: number;
    completionRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      created: number;
      completed: number;
      overdue: number;
    }>;
    weekly: Array<{
      week: string;
      created: number;
      completed: number;
      completionRate: number;
    }>;
  };
  escalationMetrics: {
    totalEscalations: number;
    escalationRate: number;
    averageEscalationTime: number;
    escalationsByPriority: Array<{
      fromPriority: string;
      toPriority: string;
      count: number;
    }>;
  };
}

export interface ReminderAnalytics {
  summary: {
    totalReminders: number;
    deliverySuccessRate: number;
    patientResponseRate: number;
    impactOnNoShowRate: number;
  };
  byChannel: Array<{
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    responseRate: number;
  }>;
  byTiming: Array<{
    timingLabel: string;
    sent: number;
    effectiveness: number;
  }>;
  templatePerformance: Array<{
    templateId: string;
    templateName: string;
    sent: number;
    deliveryRate: number;
    responseRate: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  };
}

export interface CapacityAnalytics {
  overall: {
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    availableSlots: number;
  };
  byPharmacist: Array<{
    pharmacistId: string;
    pharmacistName: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
    workingHours: number;
  }>;
  byDay: Array<{
    day: string;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  byHour: Array<{
    hour: number;
    totalSlots: number;
    bookedSlots: number;
    utilizationRate: number;
  }>;
  recommendations: string[];
}

// =============================================
// QUERY HOOKS
// =============================================

/**
 * Hook to fetch appointment analytics
 */
export const useAppointmentAnalytics = (
  params: AppointmentAnalyticsParams = {},
  enabled = true
) => {
  return useQuery({
    queryKey: appointmentAnalyticsKeys.analytics(params),
    queryFn: async () => {
      try {
        return await appointmentAnalyticsService.getAppointmentAnalytics(params);
      } catch (error: any) {
        console.warn('Appointment analytics API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Appointment analytics API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
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
 * Hook to fetch follow-up analytics
 */
export const useFollowUpAnalytics = (
  params: FollowUpAnalyticsParams = {},
  enabled = true
) => {
  return useQuery({
    queryKey: appointmentAnalyticsKeys.followUps(params),
    queryFn: async () => {
      try {
        return await appointmentAnalyticsService.getFollowUpAnalytics(params);
      } catch (error: any) {
        console.warn('Follow-up analytics API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Follow-up analytics API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
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
 * Hook to fetch reminder analytics
 */
export const useReminderAnalytics = (
  params: ReminderAnalyticsParams = {},
  enabled = true
) => {
  return useQuery({
    queryKey: appointmentAnalyticsKeys.reminders(params),
    queryFn: async () => {
      try {
        return await appointmentAnalyticsService.getReminderAnalytics(params);
      } catch (error: any) {
        console.warn('Reminder analytics API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Reminder analytics API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
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
 * Hook to fetch capacity analytics
 */
export const useCapacityAnalytics = (
  params: CapacityAnalyticsParams = {},
  enabled = true
) => {
  return useQuery({
    queryKey: appointmentAnalyticsKeys.capacity(params),
    queryFn: async () => {
      try {
        return await appointmentAnalyticsService.getCapacityAnalytics(params);
      } catch (error: any) {
        console.warn('Capacity analytics API error:', error.message);
        
        // Don't throw on 403/401 errors to prevent infinite loops
        if (error?.response?.status === 403 || error?.response?.status === 401) {
          console.warn('Capacity analytics API not available - returning empty data');
          return { data: null, success: false, message: 'API not available' };
        }
        
        throw error;
      }
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes for capacity data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Disable to prevent loops
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
};