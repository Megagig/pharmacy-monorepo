import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diagnosticApi } from '../api/diagnosticApi';
import { useUIStore } from '../../../stores';
import type {
    DiagnosticRequest,
    DiagnosticResult,
    DiagnosticRequestForm,
    DiagnosticHistoryParams,
    ApiResponse
} from '../types';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// Query keys for diagnostics
export const diagnosticQueryKeys = {
    all: ['diagnostics'] as const,
    requests: () => ['diagnostics', 'requests'] as const,
    request: (id: string) => ['diagnostics', 'request', id] as const,
    results: () => ['diagnostics', 'results'] as const,
    result: (requestId: string) => ['diagnostics', 'result', requestId] as const,
    history: (params: DiagnosticHistoryParams) => ['diagnostics', 'history', params] as const,
    analytics: (params?: { dateFrom?: string; dateTo?: string; patientId?: string }) =>
        ['diagnostics', 'analytics', params] as const,
    status: (requestId: string) => ['diagnostics', 'status', requestId] as const,
};

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to fetch diagnostic request by ID
 */
export const useDiagnosticRequest = (requestId: string) => {
    return useQuery({
        queryKey: diagnosticQueryKeys.request(requestId),
        queryFn: () => diagnosticApi.getRequest(requestId),
        enabled: !!requestId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch diagnostic result by request ID with automatic polling
 */
export const useDiagnosticResult = (requestId: string, options?: {
    enablePolling?: boolean;
    pollingInterval?: number;
}) => {
    const { enablePolling = false, pollingInterval = 5000 } = options || {};

    return useQuery({
        queryKey: diagnosticQueryKeys.result(requestId),
        queryFn: () => diagnosticApi.getResult(requestId),
        enabled: !!requestId,
        staleTime: 30 * 1000, // 30 seconds for results
        refetchInterval: enablePolling ? pollingInterval : false,
        refetchIntervalInBackground: enablePolling,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
            // Don't retry if result is not found (404) - it might not be ready yet
            if (error?.response?.status === 404) {
                return failureCount < 10; // Keep trying for up to 10 attempts
            }
            return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
};

/**
 * Hook to fetch diagnostic history with pagination and filtering
 */
export const useDiagnosticHistory = (params: DiagnosticHistoryParams = {}) => {
    return useQuery({
        queryKey: diagnosticQueryKeys.history(params),
        queryFn: () => diagnosticApi.getHistory(params),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch diagnostic analytics
 */
export const useDiagnosticAnalytics = (params?: {
    dateFrom?: string;
    dateTo?: string;
    patientId?: string;
}) => {
    return useQuery({
        queryKey: diagnosticQueryKeys.analytics(params),
        queryFn: () => diagnosticApi.getAnalytics(params),
        staleTime: 5 * 60 * 1000, // 5 minutes for analytics
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch processing status with polling
 */
export const useDiagnosticStatus = (requestId: string, options?: {
    enablePolling?: boolean;
    pollingInterval?: number;
}) => {
    const { enablePolling = false, pollingInterval = 3000 } = options || {};

    return useQuery({
        queryKey: diagnosticQueryKeys.status(requestId),
        queryFn: () => diagnosticApi.getStatus(requestId),
        enabled: !!requestId,
        staleTime: 10 * 1000, // 10 seconds for status
        refetchInterval: enablePolling ? pollingInterval : false,
        refetchIntervalInBackground: enablePolling,
        refetchOnWindowFocus: false,
    });
};

// ===============================
// MUTATION HOOKS
// ===============================

/**
 * Hook to create a new diagnostic request with optimistic updates
 */
export const useCreateDiagnosticRequest = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: DiagnosticRequestForm) => diagnosticApi.createRequest(data),
        onMutate: async (variables) => {
            // Cancel outgoing refetches for history
            await queryClient.cancelQueries({
                queryKey: diagnosticQueryKeys.history({ patientId: variables.patientId })
            });

            // Snapshot previous value
            const previousHistory = queryClient.getQueryData(
                diagnosticQueryKeys.history({ patientId: variables.patientId })
            );

            // Optimistically update history
            const optimisticRequest: Partial<DiagnosticRequest> = {
                _id: `temp-${Date.now()}`,
                patientId: variables.patientId,
                inputSnapshot: variables,
                status: 'pending',
                consentObtained: variables.consent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData(
                diagnosticQueryKeys.history({ patientId: variables.patientId }),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticRequest, ...old.data.results],
                        },
                    };
                }
            );

            return { previousHistory };
        },
        onSuccess: (response, variables) => {
            const request = response?.data;

            if (request) {
                // Update the specific request in cache
                queryClient.setQueryData(diagnosticQueryKeys.request(request._id), response);

                // Invalidate and refetch history to get accurate data
                queryClient.invalidateQueries({
                    queryKey: diagnosticQueryKeys.history({ patientId: variables.patientId })
                });

                // Invalidate analytics
                queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.analytics() });

                addNotification({
                    type: 'success',
                    title: 'Diagnostic Request Created',
                    message: `Diagnostic analysis has been initiated. Request ID: ${request._id}`,
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError, variables, context) => {
            // Rollback optimistic update
            if (context?.previousHistory) {
                queryClient.setQueryData(
                    diagnosticQueryKeys.history({ patientId: variables.patientId }),
                    context.previousHistory
                );
            }

            addNotification({
                type: 'error',
                title: 'Request Failed',
                message: error.message || 'Failed to create diagnostic request. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to approve diagnostic result
 */
export const useApproveDiagnostic = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (resultId: string) => diagnosticApi.approveResult(resultId),
        onSuccess: (response, resultId) => {
            const result = response?.data;

            if (result) {
                // Update the result in cache
                queryClient.setQueryData(diagnosticQueryKeys.result(result.requestId), response);

                // Invalidate related queries
                queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.analytics() });

                addNotification({
                    type: 'success',
                    title: 'Diagnostic Approved',
                    message: 'Diagnostic result has been approved successfully.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Approval Failed',
                message: error.message || 'Failed to approve diagnostic result. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to modify diagnostic result
 */
export const useModifyDiagnostic = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ resultId, modifications }: { resultId: string; modifications: string }) =>
            diagnosticApi.modifyResult(resultId, modifications),
        onSuccess: (response, { resultId }) => {
            const result = response?.data;

            if (result) {
                // Update the result in cache
                queryClient.setQueryData(diagnosticQueryKeys.result(result.requestId), response);

                // Invalidate analytics
                queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.analytics() });

                addNotification({
                    type: 'success',
                    title: 'Diagnostic Modified',
                    message: 'Diagnostic result has been modified successfully.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Modification Failed',
                message: error.message || 'Failed to modify diagnostic result. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to reject diagnostic result
 */
export const useRejectDiagnostic = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ resultId, rejectionReason }: { resultId: string; rejectionReason: string }) =>
            diagnosticApi.rejectResult(resultId, rejectionReason),
        onSuccess: (response, { resultId }) => {
            const result = response?.data;

            if (result) {
                // Update the result in cache
                queryClient.setQueryData(diagnosticQueryKeys.result(result.requestId), response);

                // Invalidate analytics
                queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.analytics() });

                addNotification({
                    type: 'success',
                    title: 'Diagnostic Rejected',
                    message: 'Diagnostic result has been rejected.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Rejection Failed',
                message: error.message || 'Failed to reject diagnostic result. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to cancel diagnostic request
 */
export const useCancelDiagnosticRequest = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (requestId: string) => diagnosticApi.cancelRequest(requestId),
        onSuccess: (response, requestId) => {
            const request = response?.data;

            if (request) {
                // Update the request in cache
                queryClient.setQueryData(diagnosticQueryKeys.request(requestId), response);

                // Invalidate history and analytics
                queryClient.invalidateQueries({
                    queryKey: diagnosticQueryKeys.history({ patientId: request.patientId })
                });
                queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.analytics() });

                addNotification({
                    type: 'success',
                    title: 'Request Cancelled',
                    message: 'Diagnostic request has been cancelled.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Cancellation Failed',
                message: error.message || 'Failed to cancel diagnostic request. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook for optimistic updates when creating diagnostic requests
 */
export const useOptimisticCreateDiagnosticRequest = () => {
    const queryClient = useQueryClient();
    const createMutation = useCreateDiagnosticRequest();

    return {
        ...createMutation,
        mutateAsync: async (data: DiagnosticRequestForm) => {
            // Create optimistic request
            const optimisticRequest: Partial<DiagnosticRequest> = {
                _id: `temp-${Date.now()}`,
                patientId: data.patientId,
                inputSnapshot: data,
                status: 'pending',
                consentObtained: data.consent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Optimistically update the cache
            const previousData = queryClient.getQueryData(
                diagnosticQueryKeys.history({ patientId: data.patientId })
            );

            queryClient.setQueryData(
                diagnosticQueryKeys.history({ patientId: data.patientId }),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticRequest, ...old.data.results],
                        },
                    };
                }
            );

            try {
                // Perform the actual mutation
                const result = await createMutation.mutateAsync(data);
                return result;
            } catch (error) {
                // Revert optimistic update on error
                queryClient.setQueryData(
                    diagnosticQueryKeys.history({ patientId: data.patientId }),
                    previousData
                );
                throw error;
            }
        },
    };
};

/**
 * Hook to prefetch diagnostic result
 */
export const usePrefetchDiagnosticResult = () => {
    const queryClient = useQueryClient();

    return (requestId: string) => {
        queryClient.prefetchQuery({
            queryKey: diagnosticQueryKeys.result(requestId),
            queryFn: () => diagnosticApi.getResult(requestId),
            staleTime: 30 * 1000, // 30 seconds
        });
    };
};

/**
 * Hook to manage polling for diagnostic results
 */
export const useDiagnosticPolling = (requestId: string) => {
    const queryClient = useQueryClient();

    const startPolling = (interval = 5000) => {
        queryClient.invalidateQueries({ queryKey: diagnosticQueryKeys.result(requestId) });
        // Polling is handled by the query's refetchInterval option
    };

    const stopPolling = () => {
        queryClient.cancelQueries({ queryKey: diagnosticQueryKeys.result(requestId) });
    };

    return { startPolling, stopPolling };
};

export default {
    useDiagnosticRequest,
    useDiagnosticResult,
    useDiagnosticHistory,
    useDiagnosticAnalytics,
    useDiagnosticStatus,
    useCreateDiagnosticRequest,
    useApproveDiagnostic,
    useModifyDiagnostic,
    useRejectDiagnostic,
    useCancelDiagnosticRequest,
    useOptimisticCreateDiagnosticRequest,
    usePrefetchDiagnosticResult,
    useDiagnosticPolling,
};