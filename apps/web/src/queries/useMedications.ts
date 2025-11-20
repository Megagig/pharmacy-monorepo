import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { medicationService } from '../services/medicationService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';

// Hook to fetch all medications with optional filters
export const useMedications = (filters: Record<string, unknown> = {}) => {
  return useQuery({
    queryKey: queryKeys.medications.list(filters),
    queryFn: () => medicationService.getMedications(filters),
    select: (data) => data.data || data,
  });
};

// Hook to fetch a single medication by ID
export const useMedication = (medicationId: string) => {
  return useQuery({
    queryKey: queryKeys.medications.detail(medicationId),
    queryFn: () => medicationService.getMedication(medicationId),
    enabled: !!medicationId,
    select: (data) => data.data || data,
  });
};

// Hook to fetch medications for a specific patient
export const useMedicationsByPatient = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.medications.byPatient(patientId),
    queryFn: () => medicationService.getMedicationsByPatient(patientId),
    enabled: !!patientId,
    select: (data) => data.data || data,
  });
};

// Hook to create a new medication
export const useCreateMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: medicationService.createMedication,
    onSuccess: (data: unknown) => {
      // Invalidate medications lists
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.lists() });

      // If medication has a patient, invalidate patient-specific medications
      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(data.patientId)
        });
      }

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Medication Added',
        message: `Medication ${data?.name || 'medication'} has been successfully added.`,
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Addition Failed',
        message: error.message || 'Failed to add medication. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to update a medication
export const useUpdateMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({ medicationId, medicationData }: { medicationId: string; medicationData: Record<string, unknown> }) =>
      medicationService.updateMedication(medicationId, medicationData),
    onSuccess: (data: unknown, variables) => {
      // Update specific medication in cache
      queryClient.setQueryData(
        queryKeys.medications.detail(variables.medicationId),
        data
      );

      // Invalidate medications lists
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.lists() });

      // If medication has a patient, invalidate patient-specific medications
      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(data.patientId)
        });
      }

      addNotification({
        type: 'success',
        title: 'Medication Updated',
        message: 'Medication has been successfully updated.',
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update medication. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to update medication status
export const useUpdateMedicationStatus = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({ medicationId, status }: { medicationId: string; status: string }) =>
      medicationService.updateMedicationStatus(medicationId, status),
    onMutate: async ({ medicationId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.medications.detail(medicationId) });

      // Snapshot previous value
      const previousMedication = queryClient.getQueryData(queryKeys.medications.detail(medicationId));

      // Optimistically update to new value
      queryClient.setQueryData(
        queryKeys.medications.detail(medicationId),
        (old: unknown) => old ? { ...old, status } : old
      );

      return { previousMedication };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousMedication) {
        queryClient.setQueryData(
          queryKeys.medications.detail(variables.medicationId),
          context.previousMedication
        );
      }

      addNotification({
        type: 'error',
        title: 'Status Update Failed',
        message: error.message || 'Failed to update medication status. Please try again.',
        duration: 5000,
      });
    },
    onSuccess: (data: unknown, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.lists() });

      if (data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.medications.byPatient(data.patientId)
        });
      }

      addNotification({
        type: 'success',
        title: 'Status Updated',
        message: `Medication status changed to ${variables.status}.`,
        duration: 5000,
      });
    },
  });
};

// Hook to delete a medication
export const useDeleteMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (medicationId: string) => medicationService.deleteMedication(medicationId),
    onSuccess: (data: unknown, medicationId: string) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.medications.detail(medicationId) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.lists() });

      // Invalidate patient-specific medications if applicable
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.all });

      addNotification({
        type: 'success',
        title: 'Medication Deleted',
        message: 'Medication has been successfully deleted.',
        duration: 5000,
      });
    },
    onError: (error: unknown) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete medication. Please try again.',
        duration: 5000,
      });
    },
  });
};