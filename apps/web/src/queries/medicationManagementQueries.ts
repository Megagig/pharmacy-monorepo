import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import medicationManagementService, {
  MedicationCreateData,
  MedicationUpdateData,
  AdherenceLogCreateData,
  InteractionCheckItem,
  // Removing unused types
  // MedicationReminderSettings,
  // MedicationMonitoringSettings,
} from '../services/medicationManagementService';

// Query Keys
export const medicationKeys = {
  all: ['medications'] as const,
  lists: () => [...medicationKeys.all, 'list'] as const,
  list: (filters: { patientId?: string; status?: string }) =>
    [...medicationKeys.lists(), filters] as const,
  details: () => [...medicationKeys.all, 'detail'] as const,
  detail: (id: string) => [...medicationKeys.details(), id] as const,
  adherence: () => [...medicationKeys.all, 'adherence'] as const,
  adherenceList: (filters: {
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }) => [...medicationKeys.adherence(), filters] as const,
  interactions: () => [...medicationKeys.all, 'interactions'] as const,
  analytics: () => [...medicationKeys.all, 'analytics'] as const,
  adherenceAnalytics: (patientId: string, period: string) =>
    [...medicationKeys.analytics(), 'adherence', patientId, period] as const,
  prescriptionPatternAnalytics: (patientId: string) =>
    [...medicationKeys.analytics(), 'prescriptionPatterns', patientId] as const,
  interactionAnalytics: (patientId: string) =>
    [...medicationKeys.analytics(), 'interactions', patientId] as const,
  medicationSummary: (patientId: string) =>
    [...medicationKeys.analytics(), 'summary', patientId] as const,
  settings: () => [...medicationKeys.all, 'settings'] as const,
  patientSettings: (patientId: string) =>
    [...medicationKeys.settings(), patientId] as const,
};

// Medication Hooks

/**
 * Hook for creating a new medication
 */
export const useCreateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicationData: MedicationCreateData) =>
      medicationManagementService.createMedication(medicationData),
    onSuccess: (_, variables) => {
      // Invalidate medications list for this patient
      queryClient.invalidateQueries({
        queryKey: medicationKeys.list({ patientId: variables.patientId }),
      });
    },
  });
};

/**
 * Hook for fetching medications for a patient
 */
export const useMedicationsByPatient = (
  patientId: string,
  status = 'active'
) => {
  return useQuery({
    queryKey: medicationKeys.list({ patientId, status }),
    queryFn: () =>
      medicationManagementService.getMedicationsByPatient(patientId, status),
    enabled: !!patientId,
  });
};

/**
 * Hook for fetching a specific medication by ID
 */
export const useMedicationById = (id: string) => {
  return useQuery({
    queryKey: medicationKeys.detail(id),
    queryFn: () => medicationManagementService.getMedicationById(id),
    enabled: !!id,
  });
};

/**
 * Hook for updating a medication
 */
export const useUpdateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MedicationUpdateData }) =>
      medicationManagementService.updateMedication(id, data),
    onSuccess: (data) => {
      // Invalidate specific medication detail
      queryClient.invalidateQueries({
        queryKey: medicationKeys.detail(data._id),
      });

      // Invalidate patient's medications list
      queryClient.invalidateQueries({
        queryKey: medicationKeys.list({ patientId: data.patientId }),
      });
    },
  });
};

/**
 * Hook for archiving a medication
 */
export const useArchiveMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      medicationManagementService.archiveMedication(id, reason),
    onSuccess: (data) => {
      // Invalidate specific medication detail
      queryClient.invalidateQueries({
        queryKey: medicationKeys.detail(data._id),
      });

      // Invalidate patient's medications list
      queryClient.invalidateQueries({
        queryKey: medicationKeys.list({ patientId: data.patientId }),
      });
    },
  });
};

// Adherence Hooks

/**
 * Hook for logging medication adherence
 */
export const useLogAdherence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adherenceData: AdherenceLogCreateData) =>
      medicationManagementService.logAdherence(adherenceData),
    onSuccess: (_, variables) => {
      // Invalidate adherence logs for this patient
      queryClient.invalidateQueries({
        queryKey: medicationKeys.adherenceList({
          patientId: variables.patientId,
        }),
      });
    },
  });
};

/**
 * Hook for fetching adherence logs for a patient
 */
export const useAdherenceLogs = (
  patientId: string,
  startDate?: string | Date,
  endDate?: string | Date
) => {
  return useQuery({
    queryKey: medicationKeys.adherenceList({
      patientId,
      startDate: startDate?.toString(),
      endDate: endDate?.toString(),
    }),
    queryFn: () =>
      medicationManagementService.getAdherenceLogs(
        patientId,
        startDate,
        endDate
      ),
    enabled: !!patientId,
  });
};

// Interaction Hooks

/**
 * Hook for checking medication interactions
 */
export const useCheckInteractions = () => {
  return useMutation({
    mutationFn: (medications: InteractionCheckItem[]) =>
      medicationManagementService.checkInteractions(medications),
  });
};

/**
 * Hook for getting patient medication settings
 */
export const usePatientMedicationSettings = (patientId: string) => {
  return useQuery({
    queryKey: medicationKeys.patientSettings(patientId),
    queryFn: () =>
      medicationManagementService.getPatientMedicationSettings(patientId),
    enabled: !!patientId,
  });
};

/**
 * Hook for updating patient medication settings
 */
export const useUpdatePatientMedicationSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      settings,
    }: {
      patientId: string;
      settings: {
        reminderSettings?: {
          enabled?: boolean;
          defaultReminderTimes?: string[];
          reminderMethod?: 'email' | 'sms' | 'both';
          defaultNotificationLeadTime?: number;
        };
        monitoringSettings?: {
          adherenceMonitoring?: boolean;
          refillReminders?: boolean;
          interactionChecking?: boolean;
        };
      };
    }) =>
      medicationManagementService.updatePatientMedicationSettings(
        patientId,
        settings
      ),
    onSuccess: (_, variables) => {
      // Invalidate patient settings
      queryClient.invalidateQueries({
        queryKey: medicationKeys.patientSettings(variables.patientId),
      });
    },
  });
};

/**
 * Hook for testing notifications
 */
export const useTestNotification = () => {
  return useMutation({
    mutationFn: ({
      patientId,
      type,
      contact,
    }: {
      patientId: string;
      type: 'email' | 'sms';
      contact: string;
    }) =>
      medicationManagementService.testNotification(patientId, type, contact),
  });
};

// Analytics Hooks

/**
 * Hook to get adherence analytics for a patient
 */
export const useAdherenceAnalytics = (
  patientId: string,
  period: string = '6months'
) => {
  return useQuery({
    queryKey: medicationKeys.adherenceAnalytics(patientId, period),
    queryFn: () =>
      medicationManagementService.getAdherenceAnalytics(patientId, period),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get prescription pattern analytics for a patient
 */
export const usePrescriptionPatternAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: medicationKeys.prescriptionPatternAnalytics(patientId),
    queryFn: () =>
      medicationManagementService.getPrescriptionPatternAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get medication interaction analytics for a patient
 */
export const useInteractionAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: medicationKeys.interactionAnalytics(patientId),
    queryFn: () =>
      medicationManagementService.getMedicationInteractionAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get medication summary for a patient
 */
export const usePatientMedicationSummary = (patientId: string) => {
  return useQuery({
    queryKey: medicationKeys.medicationSummary(patientId),
    queryFn: () =>
      medicationManagementService.getPatientMedicationSummary(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
/**
 * Hook to get medication cost analytics for a patient
 */
export const useMedicationCostAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: [...medicationKeys.analytics(), 'costs', patientId],
    queryFn: () =>
      medicationManagementService.getMedicationCostAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};