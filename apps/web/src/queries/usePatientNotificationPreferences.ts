import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

export interface NotificationPreferencesData {
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
  language: 'en' | 'yo' | 'ig' | 'ha';
  timezone: string;
  optOut: boolean;
  channels: {
    appointmentReminders: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    medicationRefills: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    adherenceChecks: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    clinicalFollowups: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
    generalNotifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface NotificationPreferencesResponse {
  success: boolean;
  data: {
    preferences: NotificationPreferencesData;
  };
}

export interface UpdateNotificationPreferencesResponse {
  success: boolean;
  data: {
    preferences: NotificationPreferencesData;
    message: string;
  };
}

export interface OptOutStatusResponse {
  success: boolean;
  data: {
    optedOut: boolean;
    preferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
      whatsapp: boolean;
    };
  };
}

export interface UpdateOptOutStatusResponse {
  success: boolean;
  data: {
    optedOut: boolean;
    message: string;
  };
}

// Query keys
export const patientNotificationPreferencesKeys = {
  all: ['patient-notification-preferences'] as const,
  preferences: (patientId: string) => [...patientNotificationPreferencesKeys.all, 'preferences', patientId] as const,
  optOut: (patientId: string) => [...patientNotificationPreferencesKeys.all, 'opt-out', patientId] as const,
};

/**
 * Hook to get patient notification preferences
 */
export const usePatientNotificationPreferences = (patientId: string) => {
  return useQuery({
    queryKey: patientNotificationPreferencesKeys.preferences(patientId),
    queryFn: async (): Promise<NotificationPreferencesData> => {
      const response = await apiClient.get<NotificationPreferencesResponse>(
        `/patients/${patientId}/preferences`
      );
      return response.data.data.preferences;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to update patient notification preferences
 */
export const useUpdatePatientNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      preferences,
    }: {
      patientId: string;
      preferences: Partial<NotificationPreferencesData>;
    }): Promise<UpdateNotificationPreferencesResponse> => {
      const response = await apiClient.put<UpdateNotificationPreferencesResponse>(
        `/patients/${patientId}/preferences`,
        preferences
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Update the preferences cache
      queryClient.setQueryData(
        patientNotificationPreferencesKeys.preferences(variables.patientId),
        data.data.preferences
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: patientNotificationPreferencesKeys.all,
      });
    },
  });
};

/**
 * Hook to get patient opt-out status
 */
export const usePatientOptOutStatus = (patientId: string) => {
  return useQuery({
    queryKey: patientNotificationPreferencesKeys.optOut(patientId),
    queryFn: async (): Promise<OptOutStatusResponse['data']> => {
      const response = await apiClient.get<OptOutStatusResponse>(
        `/patients/${patientId}/opt-out`
      );
      return response.data.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to update patient opt-out status
 */
export const useUpdatePatientOptOutStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      optOut,
    }: {
      patientId: string;
      optOut: boolean;
    }): Promise<UpdateOptOutStatusResponse> => {
      const response = await apiClient.put<UpdateOptOutStatusResponse>(
        `/patients/${patientId}/opt-out`,
        { optOut }
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Update the opt-out cache
      queryClient.setQueryData(
        patientNotificationPreferencesKeys.optOut(variables.patientId),
        { optedOut: data.data.optedOut, preferences: {} }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: patientNotificationPreferencesKeys.all,
      });

      // Also invalidate preferences since opt-out affects them
      queryClient.invalidateQueries({
        queryKey: patientNotificationPreferencesKeys.preferences(variables.patientId),
      });
    },
  });
};