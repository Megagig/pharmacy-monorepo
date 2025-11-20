import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientService } from '../services/patientService';
import type {
  AllergySearchParams,
  MedicationSearchParams,
  DTPSearchParams,
  CreateAllergyData,
  UpdateAllergyData,
  CreateConditionData,
  UpdateConditionData,
  CreateMedicationData,
  UpdateMedicationData,
  CreateAssessmentData,
  UpdateAssessmentData,
  CreateDTPData,
  UpdateDTPData,
  CreateCarePlanData,
  UpdateCarePlanData,
  CreateVisitData,
  UpdateVisitData,
} from '../types/patientManagement';

// Query keys factory
const patientResourceKeys = {
  all: ['patient-resources'] as const,
  allergies: (patientId: string) =>
    [...patientResourceKeys.all, 'allergies', patientId] as const,
  conditions: (patientId: string) =>
    [...patientResourceKeys.all, 'conditions', patientId] as const,
  medications: (patientId: string) =>
    [...patientResourceKeys.all, 'medications', patientId] as const,
  assessments: (patientId: string) =>
    [...patientResourceKeys.all, 'assessments', patientId] as const,
  dtps: (patientId: string) =>
    [...patientResourceKeys.all, 'dtps', patientId] as const,
  carePlans: (patientId: string) =>
    [...patientResourceKeys.all, 'carePlans', patientId] as const,
  visits: (patientId: string) =>
    [...patientResourceKeys.all, 'visits', patientId] as const,
};

// ==================== ALLERGIES ====================

export const usePatientAllergies = (
  patientId: string,
  params?: AllergySearchParams
) => {
  return useQuery({
    queryKey: [...patientResourceKeys.allergies(patientId), params],
    queryFn: () => patientService.getAllergies(patientId, params),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateAllergy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      allergyData,
    }: {
      patientId: string;
      allergyData: CreateAllergyData;
    }) => patientService.createAllergy(patientId, allergyData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.allergies(patientId),
      });
    },
  });
};

export const useUpdateAllergy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      allergyId,
      allergyData,
    }: {
      allergyId: string;
      allergyData: UpdateAllergyData;
    }) => patientService.updateAllergy(allergyId, allergyData),
    onSuccess: () => {
      // Invalidate all allergy queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

export const useDeleteAllergy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (allergyId: string) => patientService.deleteAllergy(allergyId),
    onSuccess: () => {
      // Invalidate all allergy queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// ==================== CONDITIONS ====================

export const usePatientConditions = (patientId: string) => {
  return useQuery({
    queryKey: patientResourceKeys.conditions(patientId),
    queryFn: () => patientService.getConditions(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateCondition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      conditionData,
    }: {
      patientId: string;
      conditionData: CreateConditionData;
    }) => patientService.createCondition(patientId, conditionData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.conditions(patientId),
      });
    },
  });
};

export const useUpdateCondition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conditionId,
      conditionData,
    }: {
      conditionId: string;
      conditionData: UpdateConditionData;
    }) => patientService.updateCondition(conditionId, conditionData),
    onSuccess: () => {
      // Invalidate all condition queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

export const useDeleteCondition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conditionId: string) =>
      patientService.deleteCondition(conditionId),
    onSuccess: () => {
      // Invalidate all condition queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// ==================== MEDICATIONS ====================

export const usePatientMedications = (
  patientId: string,
  params?: MedicationSearchParams
) => {
  return useQuery({
    queryKey: [...patientResourceKeys.medications(patientId), params],
    queryFn: () => patientService.getMedications(patientId, params),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      medicationData,
    }: {
      patientId: string;
      medicationData: CreateMedicationData;
    }) => patientService.createMedication(patientId, medicationData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.medications(patientId),
      });
    },
  });
};

export const useUpdateMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      medicationId,
      medicationData,
    }: {
      medicationId: string;
      medicationData: UpdateMedicationData;
    }) => patientService.updateMedication(medicationId, medicationData),
    onSuccess: () => {
      // Invalidate all medication queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

export const useDeleteMedication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicationId: string) =>
      patientService.deleteMedication(medicationId),
    onSuccess: () => {
      // Invalidate all medication queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// ==================== ASSESSMENTS ====================

export const usePatientAssessments = (patientId: string) => {
  return useQuery({
    queryKey: patientResourceKeys.assessments(patientId),
    queryFn: () => patientService.getAssessments(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      assessmentData,
    }: {
      patientId: string;
      assessmentData: CreateAssessmentData;
    }) => patientService.createAssessment(patientId, assessmentData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.assessments(patientId),
      });
    },
  });
};

export const useUpdateAssessment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assessmentId,
      assessmentData,
    }: {
      assessmentId: string;
      assessmentData: UpdateAssessmentData;
    }) => patientService.updateAssessment(assessmentId, assessmentData),
    onSuccess: () => {
      // Invalidate all assessment queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// Note: Delete assessment function doesn't exist in service, so omitting it

// ==================== DTPs (Drug Therapy Problems) ====================

export const usePatientDTPs = (patientId: string, params?: DTPSearchParams) => {
  return useQuery({
    queryKey: [...patientResourceKeys.dtps(patientId), params],
    queryFn: () => patientService.getDTPs(patientId, params),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateDTP = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      dtpData,
    }: {
      patientId: string;
      dtpData: CreateDTPData;
    }) => patientService.createDTP(patientId, dtpData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.dtps(patientId),
      });
    },
  });
};

export const useUpdateDTP = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dtpId,
      dtpData,
    }: {
      dtpId: string;
      dtpData: UpdateDTPData;
    }) => patientService.updateDTP(dtpId, dtpData),
    onSuccess: () => {
      // Invalidate all DTP queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// Note: Delete DTP function doesn't exist in service, so omitting it

// ==================== CARE PLANS ====================

export const usePatientCarePlans = (patientId: string) => {
  return useQuery({
    queryKey: patientResourceKeys.carePlans(patientId),
    queryFn: () => patientService.getCarePlans(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateCarePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      carePlanData,
    }: {
      patientId: string;
      carePlanData: CreateCarePlanData;
    }) => patientService.createCarePlan(patientId, carePlanData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.carePlans(patientId),
      });
    },
  });
};

export const useUpdateCarePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      carePlanId,
      carePlanData,
    }: {
      carePlanId: string;
      carePlanData: UpdateCarePlanData;
    }) => patientService.updateCarePlan(carePlanId, carePlanData),
    onSuccess: () => {
      // Invalidate all care plan queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

// Note: Delete care plan function doesn't exist in service, so omitting it

// ==================== VISITS ====================

export const usePatientVisits = (patientId: string) => {
  return useQuery({
    queryKey: patientResourceKeys.visits(patientId),
    queryFn: () => patientService.getVisits(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateVisit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      visitData,
    }: {
      patientId: string;
      visitData: CreateVisitData;
    }) => patientService.createVisit(patientId, visitData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.visits(patientId),
      });
    },
  });
};

export const useUpdateVisit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      visitId,
      visitData,
    }: {
      visitId: string;
      visitData: UpdateVisitData;
    }) => patientService.updateVisit(visitId, visitData),
    onSuccess: () => {
      // Invalidate all visit queries since we don't know which patient it belongs to
      queryClient.invalidateQueries({ queryKey: patientResourceKeys.all });
    },
  });
};

export const useCreateVisitFromAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      appointmentId,
      appointmentData,
    }: {
      patientId: string;
      appointmentId: string;
      appointmentData: {
        type: string;
        notes?: string;
        nextActions?: string[];
        scheduledDate: string;
        scheduledTime: string;
      };
    }) => patientService.createVisitFromAppointment(patientId, appointmentId, appointmentData),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: patientResourceKeys.visits(patientId),
      });
    },
  });
};

// Note: Delete visit function doesn't exist in service, so omitting it

// ==================== MOCK ANALYTICS & OVERVIEW ====================
// These are temporary mock hooks until the backend endpoints are implemented

export interface PatientAnalytics {
  totalPatients: number;
  newPatientsThisMonth: number;
  averageAge: number;
  genderDistribution: { male: number; female: number; other: number };
  topConditions: Array<{ name: string; count: number }>;
  medicationAdherence: number;
  visitTrends: Array<{ month: string; visits: number }>;
}

export interface PatientOverview {
  totalVisits: number;
  lastVisitDate?: string;
  activeMedications: number;
  activeConditions: number;
  lastAssessmentDate?: string;
  upcomingAppointments: number;
}

export const usePatientAnalytics = () => {
  return useQuery<PatientAnalytics>({
    queryKey: ['patient-analytics'],
    queryFn: async () => {
      // Mock data - replace with actual API call when endpoint is ready
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        totalPatients: 247,
        newPatientsThisMonth: 23,
        averageAge: 42.5,
        genderDistribution: { male: 123, female: 124, other: 0 },
        topConditions: [
          { name: 'Hypertension', count: 89 },
          { name: 'Diabetes', count: 67 },
          { name: 'Sickle Cell Disease', count: 34 },
          { name: 'Asthma', count: 28 },
        ],
        medicationAdherence: 78.5,
        visitTrends: [
          { month: 'Jan', visits: 145 },
          { month: 'Feb', visits: 168 },
          { month: 'Mar', visits: 189 },
          { month: 'Apr', visits: 178 },
          { month: 'May', visits: 203 },
          { month: 'Jun', visits: 221 },
        ],
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const usePatientOverview = (patientId: string) => {
  return useQuery<PatientOverview>({
    queryKey: ['patient-overview', patientId],
    queryFn: async () => {
      // Mock data - replace with actual API call when endpoint is ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        totalVisits: 8,
        lastVisitDate: '2024-01-15T10:30:00Z',
        activeMedications: 3,
        activeConditions: 2,
        lastAssessmentDate: '2024-01-10T14:20:00Z',
        upcomingAppointments: 1,
      };
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
