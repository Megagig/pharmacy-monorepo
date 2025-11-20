import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import diagnosticHistoryService, {
  DiagnosticHistoryItem,
  DiagnosticCase,
  DiagnosticAnalytics,
  DiagnosticReferral,
} from '../services/diagnosticHistoryService';
import { apiClient } from '../services/apiClient';
import { useNotifications } from '../components/common/NotificationSystem';

// Query Keys
export const diagnosticHistoryKeys = {
  all: ['diagnosticHistory'] as const,
  patient: (patientId: string) => [...diagnosticHistoryKeys.all, 'patient', patientId] as const,
  patientHistory: (patientId: string, options?: any) => 
    [...diagnosticHistoryKeys.patient(patientId), 'history', options] as const,
  analytics: (options?: any) => [...diagnosticHistoryKeys.all, 'analytics', options] as const,
  cases: (options?: any) => [...diagnosticHistoryKeys.all, 'cases', options] as const,
  referrals: (options?: any) => [...diagnosticHistoryKeys.all, 'referrals', options] as const,
};

/**
 * Hook to get patient diagnostic history
 */
export const usePatientDiagnosticHistory = (
  patientId: string,
  options: {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  } = {},
  queryOptions: {
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
  } = {}
) => {
  return useQuery({
    queryKey: diagnosticHistoryKeys.patientHistory(patientId, options),
    queryFn: () => diagnosticHistoryService.getPatientHistory(patientId, options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: queryOptions.enabled !== false && !!patientId,
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
  });
};

/**
 * Hook to add note to diagnostic history
 */
export const useAddDiagnosticHistoryNote = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();

  return useMutation({
    mutationFn: ({
      historyId,
      content,
      type = 'general',
    }: {
      historyId: string;
      content: string;
      type?: 'clinical' | 'follow_up' | 'review' | 'general';
    }) => diagnosticHistoryService.addNote(historyId, content, type),
    onSuccess: (data, variables) => {
      showSuccess('Diagnostic note has been added successfully.', 'Note Added');
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: diagnosticHistoryKeys.all,
      });
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'An error occurred while adding the note.', 'Failed to Add Note');
    },
  });
};

/**
 * Hook to get diagnostic analytics
 */
export const useDiagnosticAnalytics = (
  options: {
    dateFrom?: string;
    dateTo?: string;
    patientId?: string;
  } = {},
  queryOptions: {
    enabled?: boolean;
  } = {}
) => {
  return useQuery({
    queryKey: diagnosticHistoryKeys.analytics(options),
    queryFn: () => diagnosticHistoryService.getAnalytics(options),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: queryOptions.enabled !== false,
  });
};

/**
 * Hook to get all diagnostic cases
 */
export const useAllDiagnosticCases = (
  options: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {},
  queryOptions: {
    enabled?: boolean;
  } = {}
) => {
  return useQuery({
    queryKey: diagnosticHistoryKeys.cases(options),
    queryFn: () => diagnosticHistoryService.getAllCases(options),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: queryOptions.enabled !== false,
  });
};

/**
 * Hook to get diagnostic referrals
 */
export const useDiagnosticReferrals = (
  options: {
    page?: number;
    limit?: number;
    status?: string;
    specialty?: string;
  } = {},
  queryOptions: {
    enabled?: boolean;
  } = {}
) => {
  return useQuery({
    queryKey: diagnosticHistoryKeys.referrals(options),
    queryFn: () => diagnosticHistoryService.getReferrals(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: queryOptions.enabled !== false,
  });
};

/**
 * Hook to export diagnostic history as PDF
 */
export const useExportDiagnosticHistory = () => {
  const { showSuccess, showError } = useNotifications();

  return useMutation({
    mutationFn: ({
      historyId,
      purpose = 'patient_record',
    }: {
      historyId: string;
      purpose?: 'referral' | 'patient_record' | 'consultation' | 'audit';
    }) => diagnosticHistoryService.exportHistoryAsPDF(historyId, purpose),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagnostic-history-${variables.historyId}-${variables.purpose}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess('Diagnostic history has been exported successfully.', 'Export Successful');
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'An error occurred while exporting the history.', 'Export Failed');
    },
  });
};

/**
 * Hook to generate referral document
 */
export const useGenerateReferralDocument = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();

  return useMutation({
    mutationFn: ({ caseId, data }: { caseId: string; data: any }) => 
      diagnosticHistoryService.generateCaseReferralDocument(caseId, data),
    onSuccess: (data, historyId) => {
      showSuccess('Referral document has been generated successfully.', 'Referral Generated');
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: diagnosticHistoryKeys.all,
      });
    },
    onError: (error: any) => {
      showError(error.response?.data?.message || 'An error occurred while generating the referral.', 'Referral Generation Failed');
    },
  });
};

/**
 * Hook to compare diagnostic histories
 */
export const useCompareDiagnosticHistories = () => {
  const { showError } = useNotifications();

  return useMutation({
    mutationFn: ({
      historyId1,
      historyId2,
    }: {
      historyId1: string;
      historyId2: string;
    }) => diagnosticHistoryService.compareHistories(historyId1, historyId2),
    onError: (error: any) => {
      showError(error.response?.data?.message || 'An error occurred while comparing histories.', 'Comparison Failed');
    },
  });
};

/**
 * Hook to get recent diagnostic activity for dashboard
 */
export const useRecentDiagnosticActivity = (
  limit: number = 5
) => {
  return useAllDiagnosticCases(
    {
      page: 1,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    {
      enabled: true,
    }
  );
};

/**
 * Hook to get diagnostic dashboard data (uses dashboard endpoint instead of analytics)
 */
export const useDiagnosticDashboardStats = () => {
  return useQuery({
    queryKey: ['diagnostics', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/diagnostics/dashboard');
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: true,
  });
};

/**
 * Hook to mark case for follow-up
 */
export const useMarkCaseForFollowUp = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ caseId, data }: { caseId: string; data: any }) =>
      diagnosticHistoryService.markCaseForFollowUp(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagnosticHistoryKeys.all });
    },
  });
};

/**
 * Hook to mark case as completed
 */
export const useMarkCaseAsCompleted = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ caseId, data }: { caseId: string; data: any }) =>
      diagnosticHistoryService.markCaseAsCompleted(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagnosticHistoryKeys.all });
    },
  });
};



/**
 * Hook to get follow-up cases
 */
export const useFollowUpCases = (
  options: {
    page?: number;
    limit?: number;
    overdue?: boolean;
  } = {},
  queryOptions: {
    enabled?: boolean;
  } = {}
) => {
  return useQuery({
    queryKey: ['diagnostics', 'follow-up', options],
    queryFn: () => diagnosticHistoryService.getFollowUpCases(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: queryOptions.enabled !== false,
  });
};

/**
 * Hook to download referral document
 */
export const useDownloadReferralDocument = () => {
  return useMutation({
    mutationFn: ({ caseId, format }: { caseId: string; format?: 'pdf' | 'docx' | 'text' }) =>
      diagnosticHistoryService.downloadReferralDocument(caseId, format),
  });
};

/**
 * Hook to send referral electronically
 */
export const useSendReferralElectronically = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();
  
  return useMutation({
    mutationFn: ({ caseId, data }: { caseId: string; data: any }) => {

      return diagnosticHistoryService.sendReferralElectronically(caseId, data);
    },
    onSuccess: (result, variables) => {

      queryClient.invalidateQueries({ queryKey: diagnosticHistoryKeys.all });
      showSuccess(
        `Referral sent successfully to ${variables.data.physicianEmail}. Tracking ID: ${result.data?.trackingId || 'N/A'}`,
        'Referral Sent'
      );
    },
    onError: (error: any, variables) => {
      console.error('useSendReferralElectronically: Mutation failed', { 
        error, 
        caseId: variables.caseId,
        errorMessage: error?.response?.data?.message || error?.message 
      });
      showError(
        error?.response?.data?.message || error?.message || 'Failed to send referral electronically. Please try again.',
        'Send Failed'
      );
    },
  });
};

/**
 * Hook to delete referral
 */
export const useDeleteReferral = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) =>
      diagnosticHistoryService.deleteReferral(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagnosticHistoryKeys.all });
    },
  });
};

/**
 * Hook to update referral document
 */
export const useUpdateReferralDocument = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();
  
  return useMutation({
    mutationFn: ({ caseId, content }: { caseId: string; content: string }) => {

      return diagnosticHistoryService.updateReferralDocument(caseId, content);
    },
    onSuccess: (data, variables) => {

      queryClient.invalidateQueries({ queryKey: diagnosticHistoryKeys.all });
      showSuccess('Referral document updated successfully.', 'Document Updated');
    },
    onError: (error: any, variables) => {
      console.error('useUpdateReferralDocument: Mutation failed', { 
        error, 
        caseId: variables.caseId,
        errorMessage: error?.response?.data?.message || error?.message 
      });
      showError(
        error?.response?.data?.message || error?.message || 'Failed to update referral document. Please try again.',
        'Update Failed'
      );
    },
  });
};