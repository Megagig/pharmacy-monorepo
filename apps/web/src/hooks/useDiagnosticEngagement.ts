import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engagementIntegrationApi } from '../services/api/engagementIntegrationApi';

/**
 * Hook to get diagnostic case with linked engagement data
 */
export const useDiagnosticEngagementData = (diagnosticCaseId: string) => {
  return useQuery({
    queryKey: ['diagnosticEngagementData', diagnosticCaseId],
    queryFn: async () => {
      if (!diagnosticCaseId) {
        return null;
      }
      try {
        const result = await engagementIntegrationApi.getDiagnosticWithEngagementData(diagnosticCaseId);
        // Ensure we always return a valid structure
        return result || {
          diagnosticCase: null,
          followUpTasks: [],
          appointments: []
        };
      } catch (error) {
        console.error('Failed to fetch diagnostic engagement data:', error);
        // Return empty structure instead of throwing to prevent React Query errors
        return {
          diagnosticCase: null,
          followUpTasks: [],
          appointments: []
        };
      }
    },
    enabled: !!diagnosticCaseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2, // Reduce retry attempts to avoid excessive API calls
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

/**
 * Hook to create follow-up task from diagnostic case
 */
export const useCreateFollowUpFromDiagnostic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      diagnosticCaseId,
      data,
    }: {
      diagnosticCaseId: string;
      data: {
        assignedTo?: string;
        locationId?: string;
      };
    }) => engagementIntegrationApi.createFollowUpFromDiagnostic(diagnosticCaseId, data),
    onSuccess: (_, variables) => {
      // Invalidate and refetch diagnostic engagement data
      queryClient.invalidateQueries({
        queryKey: ['diagnosticEngagementData', variables.diagnosticCaseId],
      });
      
      // Invalidate follow-up tasks queries
      queryClient.invalidateQueries({
        queryKey: ['followUpTasks'],
      });
      
      // Invalidate dashboard queries that might show follow-up counts
      queryClient.invalidateQueries({
        queryKey: ['dashboardSummary'],
      });
    },
  });
};

/**
 * Hook to get multiple diagnostic cases with engagement data
 */
export const useDiagnosticEngagementDataBatch = (diagnosticCaseIds: string[]) => {
  return useQuery({
    queryKey: ['diagnosticEngagementDataBatch', diagnosticCaseIds],
    queryFn: async () => {
      const results = await Promise.all(
        diagnosticCaseIds.map(id => 
          engagementIntegrationApi.getDiagnosticWithEngagementData(id)
        )
      );
      return results;
    },
    enabled: diagnosticCaseIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to prefetch diagnostic engagement data
 */
export const usePrefetchDiagnosticEngagement = () => {
  const queryClient = useQueryClient();

  return (diagnosticCaseId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['diagnosticEngagementData', diagnosticCaseId],
      queryFn: () => engagementIntegrationApi.getDiagnosticWithEngagementData(diagnosticCaseId),
      staleTime: 5 * 60 * 1000,
    });
  };
};