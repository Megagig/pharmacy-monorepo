import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import labIntegrationService, {
  LabIntegration,
  CreateLabIntegrationRequest,
  ApproveRecommendationsRequest,
  ImplementAdjustmentsRequest,
  LabTrendData,
} from '../services/labIntegrationService';

// ========================================
// QUERY KEYS
// ========================================

export const LAB_INTEGRATION_KEYS = {
  all: ['labIntegration'] as const,
  lists: () => [...LAB_INTEGRATION_KEYS.all, 'list'] as const,
  list: (filters: string) => [...LAB_INTEGRATION_KEYS.lists(), { filters }] as const,
  details: () => [...LAB_INTEGRATION_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...LAB_INTEGRATION_KEYS.details(), id] as const,
  patient: (patientId: string) => [...LAB_INTEGRATION_KEYS.all, 'patient', patientId] as const,
  pendingReviews: () => [...LAB_INTEGRATION_KEYS.all, 'pendingReviews'] as const,
  criticalCases: () => [...LAB_INTEGRATION_KEYS.all, 'criticalCases'] as const,
  escalationRequired: () => [...LAB_INTEGRATION_KEYS.all, 'escalationRequired'] as const,
  approvedCases: () => [...LAB_INTEGRATION_KEYS.all, 'approvedCases'] as const,
  trends: (patientId: string, testCode: string) =>
    [...LAB_INTEGRATION_KEYS.all, 'trends', patientId, testCode] as const,
};

// ========================================
// QUERY HOOKS
// ========================================

/**
 * Get lab integration by ID
 */
export const useLabIntegration = (id: string, enabled: boolean = true) => {
  const query = useQuery({
    queryKey: LAB_INTEGRATION_KEYS.detail(id),
    queryFn: () => labIntegrationService.getLabIntegrationById(id),
    enabled: enabled && !!id,
    staleTime: 30000, // 30 seconds
    refetchInterval: (data) => {
      // Poll every 3 seconds if AI is processing
      if (data?.aiProcessingStatus === 'processing') {
        return 3000;
      }
      // Stop polling once processing is complete or failed
      return false;
    },
  });

  return query;
};

/**
 * Get lab integrations for a patient
 */
export const useLabIntegrationsByPatient = (patientId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.patient(patientId),
    queryFn: () => labIntegrationService.getLabIntegrationsByPatient(patientId),
    enabled: enabled && !!patientId,
    staleTime: 30000,
  });
};

/**
 * Get pending reviews
 */
export const usePendingReviews = (enabled: boolean = true) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.pendingReviews(),
    queryFn: () => labIntegrationService.getPendingReviews(),
    enabled,
    staleTime: 10000, // 10 seconds - more frequent updates for pending items
    refetchInterval: 30000, // Auto-refetch every 30 seconds
  });
};

/**
 * Get critical cases
 */
export const useCriticalCases = (enabled: boolean = true) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.criticalCases(),
    queryFn: () => labIntegrationService.getCriticalCases(),
    enabled,
    staleTime: 10000,
    refetchInterval: 30000,
  });
};

/**
 * Get cases requiring escalation
 */
export const useCasesRequiringEscalation = (enabled: boolean = true) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.escalationRequired(),
    queryFn: () => labIntegrationService.getCasesRequiringEscalation(),
    enabled,
    staleTime: 30000,
  });
};

/**
 * Get approved cases
 */
export const useApprovedCases = (enabled: boolean = true) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.approvedCases(),
    queryFn: () => labIntegrationService.getApprovedCases(),
    enabled,
    staleTime: 30000,
  });
};

/**
 * Get lab trends for a patient
 */
export const useLabTrends = (
  patientId: string,
  testCode: string,
  daysBack: number = 90,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: LAB_INTEGRATION_KEYS.trends(patientId, testCode),
    queryFn: () => labIntegrationService.getLabTrends(patientId, testCode, daysBack),
    enabled: enabled && !!patientId && !!testCode,
    staleTime: 60000, // 1 minute
  });
};

// ========================================
// MUTATION HOOKS
// ========================================

/**
 * Create a new lab integration
 */
export const useCreateLabIntegration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLabIntegrationRequest) =>
      labIntegrationService.createLabIntegration(data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.patient(data.patientId) });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.pendingReviews() });

      toast.success('Lab integration created successfully. AI interpretation in progress...');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to create lab integration';
      toast.error(message);
    },
  });
};

/**
 * Request AI interpretation
 */
export const useRequestAIInterpretation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => labIntegrationService.requestAIInterpretation(id),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(LAB_INTEGRATION_KEYS.detail(data._id), data);
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.patient(data.patientId) });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.pendingReviews() });

      toast.success('AI interpretation completed successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to request AI interpretation';
      toast.error(message);
    },
  });
};

/**
 * Approve or reject therapy recommendations
 */
export const useApproveRecommendations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveRecommendationsRequest }) =>
      labIntegrationService.approveRecommendations(id, data),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(LAB_INTEGRATION_KEYS.detail(data._id), data);
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.patient(data.patientId) });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.pendingReviews() });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.criticalCases() });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.approvedCases() });

      const decision = data.pharmacistReview?.decision;
      const message =
        decision === 'approved'
          ? 'Recommendations approved successfully'
          : decision === 'rejected'
            ? 'Recommendations rejected'
            : decision === 'escalated'
              ? 'Case escalated to physician'
              : 'Recommendations updated';

      toast.success(message);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to process recommendations';
      toast.error(message);
    },
  });
};

/**
 * Implement medication adjustments
 */
export const useImplementAdjustments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ImplementAdjustmentsRequest }) =>
      labIntegrationService.implementAdjustments(id, data),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(LAB_INTEGRATION_KEYS.detail(data._id), data);
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.patient(data.patientId) });
      queryClient.invalidateQueries({ queryKey: LAB_INTEGRATION_KEYS.pendingReviews() });

      // Also invalidate medication queries since we've made changes
      queryClient.invalidateQueries({ queryKey: ['medications', data.patientId] });

      toast.success('Medication adjustments implemented successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to implement adjustments';
      toast.error(message);
    },
  });
};

// ========================================
// UTILITY HOOKS
// ========================================

/**
 * Get statistics for lab integration dashboard
 */
export const useLabIntegrationStats = () => {
  const { data: pendingReviews } = usePendingReviews();
  const { data: criticalCases } = useCriticalCases();
  const { data: escalationRequired } = useCasesRequiringEscalation();
  const { data: approvedCases } = useApprovedCases();

  return {
    pendingCount: pendingReviews?.length || 0,
    criticalCount: criticalCases?.length || 0,
    escalationCount: escalationRequired?.length || 0,
    approvedCount: approvedCases?.length || 0,
    totalActionRequired: (pendingReviews?.length || 0) + (criticalCases?.length || 0),
  };
};

/**
 * Check if a case has critical findings
 */
export const useHasCriticalFindings = (labIntegration?: LabIntegration) => {
  if (!labIntegration) return false;

  return (
    labIntegration.priority === 'critical' ||
    labIntegration.aiInterpretation?.clinicalSignificance === 'critical' ||
    labIntegration.therapyRecommendations.some((rec) => rec.priority === 'critical') ||
    labIntegration.safetyChecks.some((check) => check.severity === 'critical')
  );
};

/**
 * Get status color for UI display
 */
export const useLabIntegrationStatusColor = (status: LabIntegration['status']) => {
  const statusColors: Record<LabIntegration['status'], string> = {
    draft: 'default',
    pending_interpretation: 'info',
    pending_review: 'warning',
    pending_approval: 'warning',
    approved: 'success',
    implemented: 'success',
    completed: 'success',
    cancelled: 'error',
  };

  return statusColors[status] || 'default';
};

