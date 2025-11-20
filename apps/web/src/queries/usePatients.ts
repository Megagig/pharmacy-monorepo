import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../services/patientService';
import { queryKeys } from '../lib/queryClient';
import { useUIStore } from '../stores';
import type {
  CreatePatientData,
  UpdatePatientData,
  PatientSearchParams,
  AllergySearchParams,
  CreateAllergyData,
  UpdateAllergyData,
  CreateConditionData,
  UpdateConditionData,
  CreateMedicationData,
  UpdateMedicationData,
} from '../types/patientManagement';

// Error type for API calls
type ApiError =
  | {
    message?: string;
  }
  | Error;

// Hook to fetch all patients with optional filters
export const usePatients = (filters: PatientSearchParams = {}) => {
  return useQuery({
    queryKey: queryKeys.patients.list(filters),
    queryFn: () => patientService.getPatients(filters),
    staleTime: 30000, // 30 seconds - prevent excessive refetching
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};

// Hook to fetch a single patient by ID
export const usePatient = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.patients.detail(patientId),
    queryFn: () => patientService.getPatient(patientId),
    enabled: !!patientId, // Only run query if patientId exists
    refetchOnWindowFocus: false,
  });
};

// Stable select function to prevent re-renders
const selectPatientSearchData = (data: unknown) => {
  // Check for the standard API response format
  // { success: true, message: string, data: { patients: [...], total, query }, timestamp: string }
  if (data?.success && data?.data) {
    if (data.data.patients) {
      return {
        data: {
          results: data.data.patients,
        },
        meta: {
          total: data.data.total || 0,
          page: 1,
          limit: data.data.patients?.length || 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  // Check for direct response format
  // { patients: [...], total, query }
  if (data?.patients) {
    return {
      data: {
        results: data.patients,
      },
      meta: {
        total: data.total || 0,
        page: 1,
        limit: data.patients?.length || 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  // If we receive an array directly
  if (Array.isArray(data)) {
    return {
      data: {
        results: data,
      },
      meta: {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  // Last resort fallback
  return {
    data: {
      results: [],
    },
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
};

// Hook to search patients
export const useSearchPatients = (searchQuery: string) => {
  return useQuery({
    queryKey: queryKeys.patients.search(searchQuery),
    queryFn: () => patientService.searchPatients(searchQuery),
    enabled: !!searchQuery && searchQuery.length >= 2 && searchQuery.trim() !== '', // Only search with 2+ characters and non-empty
    select: selectPatientSearchData,
    staleTime: 30000, // 30 seconds - prevent excessive refetching
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount
    refetchInterval: false, // Don't refetch on interval
  });
};

// Hook to create a new patient
export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (patientData: CreatePatientData) =>
      patientService.createPatient(patientData),
    onSuccess: (data) => {
      // Invalidate and refetch patients list - be more aggressive about cache invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });

      // Also refetch the current page to ensure data is fresh
      queryClient.refetchQueries({ queryKey: queryKeys.patients.lists() });

      // Show success notification
      const patient = data?.data?.patient;
      addNotification({
        type: 'success',
        title: 'Patient Created',
        message: `Patient ${patient?.firstName || ''} ${patient?.lastName || ''
          } has been successfully created.`,
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error.message || 'Failed to create patient. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to update a patient
export const useUpdatePatient = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      patientId,
      patientData,
    }: {
      patientId: string;
      patientData: UpdatePatientData;
    }) => patientService.updatePatient(patientId, patientData),
    onSuccess: (data, variables) => {
      // Update the specific patient in cache
      queryClient.setQueryData(
        queryKeys.patients.detail(variables.patientId),
        data
      );

      // Invalidate patients list to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Patient Updated',
        message: 'Patient information has been successfully updated.',
        duration: 5000,
      });
    },
    onError: (error: ApiError) => {
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update patient. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to delete a patient
export const useDeletePatient = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (patientId: string) => patientService.deletePatient(patientId),
    onSuccess: (_, patientId) => {
      // Remove patient from cache
      queryClient.removeQueries({
        queryKey: queryKeys.patients.detail(patientId),
      });

      // Invalidate patients list
      queryClient.invalidateQueries({ queryKey: queryKeys.patients.lists() });

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Patient Deleted',
        message: 'Patient has been successfully deleted.',
        duration: 5000,
      });
    },
    onError: (error: ApiError) => {
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete patient. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Hook to fetch patient medications
export const usePatientMedications = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.medications.byPatient(patientId),
    queryFn: () => patientService.getMedications(patientId),
    enabled: !!patientId,
  });
};

// =======================
// ALLERGY MANAGEMENT HOOKS
// =======================

export const usePatientAllergies = (
  patientId: string,
  params?: AllergySearchParams
) => {
  return useQuery({
    queryKey: queryKeys.allergies.byPatient(patientId),
    queryFn: () => patientService.getAllergies(patientId, params),
    enabled: !!patientId,
  });
};

// Remove individual allergy hook since there's no such service method

export const useCreateAllergy = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      patientId,
      allergyData,
    }: {
      patientId: string;
      allergyData: CreateAllergyData;
    }) => patientService.createAllergy(patientId, allergyData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.allergies.byPatient(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patients.detail(variables.patientId),
      });

      addNotification({
        type: 'success',
        title: 'Allergy Added',
        message: 'Patient allergy has been successfully recorded.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Failed to Add Allergy',
        message: error.message || 'Unable to record allergy. Please try again.',
        duration: 5000,
      });
    },
  });
};

export const useUpdateAllergy = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      allergyId,
      allergyData,
    }: {
      allergyId: string;
      allergyData: UpdateAllergyData;
    }) => patientService.updateAllergy(allergyId, allergyData),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.allergies.detail(variables.allergyId),
        data
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.allergies.lists() });

      addNotification({
        type: 'success',
        title: 'Allergy Updated',
        message: 'Allergy information has been updated.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update allergy.',
        duration: 5000,
      });
    },
  });
};

export const useDeleteAllergy = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (allergyId: string) => patientService.deleteAllergy(allergyId),
    onSuccess: (_, allergyId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.allergies.detail(allergyId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.allergies.lists() });

      addNotification({
        type: 'success',
        title: 'Allergy Deleted',
        message: 'Allergy record has been removed.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete allergy.',
        duration: 5000,
      });
    },
  });
};

// ========================
// CONDITION MANAGEMENT HOOKS
// ========================

export const usePatientConditions = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.conditions.byPatient(patientId),
    queryFn: () => patientService.getConditions(patientId),
    enabled: !!patientId,
    select: (data: unknown) => {

      // Handle various response formats
      if (data?.data?.conditions) {
        return {
          results: data.data.conditions,
          total: data.data.total || 0,
        };
      } else if (data?.conditions) {
        return {
          results: data.conditions,
          total: data.total || 0,
        };
      } else if (data?.results) {
        return data;
      } else if (Array.isArray(data)) {
        return {
          results: data,
          total: data.length,
        };
      } else if (data?.data && Array.isArray(data.data)) {
        return {
          results: data.data,
          total: data.data.length,
        };
      } else if (data?.data?.results) {
        return {
          results: data.data.results,
          total: data.meta?.total || 0,
        };
      }
      // Default case - return empty results to prevent UI errors
      return { results: [], total: 0 };
    },
    retry: 1, // Reduced retries to avoid excessive 422 errors
    retryDelay: () => 1000, // Fixed delay of 1 second
    // TanStack Query v4 uses onSettled, onSuccess, and onError
    // We'll use staleTime to reduce refetch frequency
    staleTime: 30000, // 30 seconds
  });
};

// Remove individual condition hook since there's no such service method

export const useCreateCondition = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      patientId,
      conditionData,
    }: {
      patientId: string;
      conditionData: CreateConditionData;
    }) => patientService.createCondition(patientId, conditionData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conditions.byPatient(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patients.detail(variables.patientId),
      });

      addNotification({
        type: 'success',
        title: 'Condition Added',
        message: 'Patient condition has been recorded.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Failed to Add Condition',
        message: error.message || 'Unable to record condition.',
        duration: 5000,
      });
    },
  });
};

export const useUpdateCondition = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      conditionId,
      conditionData,
    }: {
      conditionId: string;
      conditionData: UpdateConditionData;
    }) => patientService.updateCondition(conditionId, conditionData),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.conditions.detail(variables.conditionId),
        data
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.conditions.lists() });

      addNotification({
        type: 'success',
        title: 'Condition Updated',
        message: 'Condition information has been updated.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update condition.',
        duration: 5000,
      });
    },
  });
};

export const useDeleteCondition = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (conditionId: string) =>
      patientService.deleteCondition(conditionId),
    onSuccess: (_, conditionId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.conditions.detail(conditionId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conditions.lists() });

      addNotification({
        type: 'success',
        title: 'Condition Deleted',
        message: 'Condition record has been removed.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete condition.',
        duration: 5000,
      });
    },
  });
};

// ==========================
// MEDICATION MANAGEMENT HOOKS
// ==========================

export const useCurrentMedications = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.medications.current(patientId),
    queryFn: () =>
      patientService.getMedications(patientId, { phase: 'current' }),
    enabled: !!patientId,
  });
};

export const usePastMedications = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.medications.past(patientId),
    queryFn: () => patientService.getMedications(patientId, { phase: 'past' }),
    enabled: !!patientId,
  });
};

// Remove individual medication hook since there's no such service method

export const useCreateMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      patientId,
      medicationData,
    }: {
      patientId: string;
      medicationData: CreateMedicationData;
    }) => patientService.createMedication(patientId, medicationData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.medications.byPatient(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patients.detail(variables.patientId),
      });

      addNotification({
        type: 'success',
        title: 'Medication Added',
        message: 'Medication record has been created.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Failed to Add Medication',
        message: error.message || 'Unable to add medication.',
        duration: 5000,
      });
    },
  });
};

export const useUpdateMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: ({
      medicationId,
      medicationData,
    }: {
      medicationId: string;
      medicationData: UpdateMedicationData;
    }) => patientService.updateMedication(medicationId, medicationData),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        queryKeys.medications.detail(variables.medicationId),
        data
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.medications.lists(),
      });

      addNotification({
        type: 'success',
        title: 'Medication Updated',
        message: 'Medication information has been updated.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update medication.',
        duration: 5000,
      });
    },
  });
};

export const useDeleteMedication = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (medicationId: string) =>
      patientService.deleteMedication(medicationId),
    onSuccess: (_, medicationId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.medications.detail(medicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.medications.lists(),
      });

      addNotification({
        type: 'success',
        title: 'Medication Deleted',
        message: 'Medication record has been removed.',
        duration: 4000,
      });
    },
    onError: (error: ApiError) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.message || 'Failed to delete medication.',
        duration: 5000,
      });
    },
  });
};

// =========================
// PATIENT SUMMARY HOOKS
// =========================

export const usePatientSummary = (patientId: string) => {
  return useQuery({
    queryKey: queryKeys.patients.summary(patientId),
    queryFn: () => patientService.getPatientSummary(patientId),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000, // 2 minutes - summary data can be slightly stale
  });
};
