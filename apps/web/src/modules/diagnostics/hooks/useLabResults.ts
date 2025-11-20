import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labApi } from '../api/labApi';
import { useUIStore } from '../../../stores';
import type {
    LabResult,
    LabResultForm,
    LabResultParams,
    ApiResponse
} from '../types';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// Query keys for lab results
export const labResultQueryKeys = {
    all: ['lab', 'results'] as const,
    lists: () => ['lab', 'results', 'list'] as const,
    list: (params: LabResultParams) => ['lab', 'results', 'list', params] as const,
    details: () => ['lab', 'results', 'detail'] as const,
    detail: (id: string) => ['lab', 'results', 'detail', id] as const,
    byPatient: (patientId: string) => ['lab', 'results', 'patient', patientId] as const,
    byOrder: (orderId: string) => ['lab', 'results', 'order', orderId] as const,
    critical: (workplaceId?: string) => ['lab', 'results', 'critical', workplaceId] as const,
    abnormal: (patientId: string, days?: number) => ['lab', 'results', 'abnormal', patientId, days] as const,
};

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to fetch lab results with optional filters
 */
export const useLabResults = (params: LabResultParams = {}) => {
    return useQuery({
        queryKey: labResultQueryKeys.list(params),
        queryFn: () => labApi.getResults(params),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch a single lab result by ID
 */
export const useLabResult = (resultId: string) => {
    return useQuery({
        queryKey: labResultQueryKeys.detail(resultId),
        queryFn: () => labApi.getResult(resultId),
        enabled: !!resultId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch lab results for a specific patient
 */
export const useLabResultsByPatient = (patientId: string, params: Omit<LabResultParams, 'patientId'> = {}) => {
    return useQuery({
        queryKey: labResultQueryKeys.byPatient(patientId),
        queryFn: () => labApi.getResults({ ...params, patientId }),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch lab results for a specific order
 */
export const useLabResultsByOrder = (orderId: string) => {
    return useQuery({
        queryKey: labResultQueryKeys.byOrder(orderId),
        queryFn: () => labApi.getResults({ orderId }),
        enabled: !!orderId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch critical lab results
 */
export const useCriticalLabResults = (workplaceId?: string) => {
    return useQuery({
        queryKey: labResultQueryKeys.critical(workplaceId),
        queryFn: () => labApi.getCriticalResults(workplaceId),
        staleTime: 30 * 1000, // 30 seconds for critical results
        refetchOnWindowFocus: true, // Refetch critical results on focus
        refetchInterval: 2 * 60 * 1000, // Auto-refetch every 2 minutes
    });
};

/**
 * Hook to fetch abnormal lab results for a patient
 */
export const useAbnormalLabResults = (patientId: string, days: number = 30) => {
    return useQuery({
        queryKey: labResultQueryKeys.abnormal(patientId, days),
        queryFn: () => labApi.getAbnormalResults(patientId, days),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

// ===============================
// MUTATION HOOKS
// ===============================

/**
 * Hook to add a new lab result
 */
export const useAddLabResult = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: LabResultForm) => labApi.addResult(data),
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: labResultQueryKeys.byPatient(variables.patientId) });

            // Snapshot previous value
            const previousResults = queryClient.getQueryData(
                labResultQueryKeys.byPatient(variables.patientId)
            );

            // Optimistically update
            const optimisticResult: Partial<LabResult> = {
                _id: `temp-${Date.now()}`,
                patientId: variables.patientId,
                orderId: variables.orderId,
                testCode: variables.testCode,
                testName: variables.testName,
                value: variables.value,
                unit: variables.unit,
                referenceRange: variables.referenceRange,
                interpretation: variables.interpretation || 'normal',
                flags: variables.flags || [],
                source: 'manual',
                performedAt: variables.performedAt,
                recordedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData(
                labResultQueryKeys.byPatient(variables.patientId),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticResult, ...old.data.results],
                        },
                    };
                }
            );

            return { previousResults };
        },
        onSuccess: (response, variables) => {
            const result = response?.data;

            if (result) {
                // Update the specific result in cache
                queryClient.setQueryData(labResultQueryKeys.detail(result._id), response);

                // Invalidate and refetch related queries
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.lists() });
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.byPatient(variables.patientId) });

                if (variables.orderId) {
                    queryClient.invalidateQueries({ queryKey: labResultQueryKeys.byOrder(variables.orderId) });
                }

                // Invalidate critical and abnormal results if applicable
                if (result.interpretation === 'critical') {
                    queryClient.invalidateQueries({ queryKey: labResultQueryKeys.critical() });
                }
                if (result.interpretation !== 'normal') {
                    queryClient.invalidateQueries({ queryKey: labResultQueryKeys.abnormal(variables.patientId) });
                }

                addNotification({
                    type: 'success',
                    title: 'Lab Result Added',
                    message: `Lab result for ${result.testName} has been successfully recorded.`,
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError, variables, context) => {
            // Rollback optimistic update
            if (context?.previousResults) {
                queryClient.setQueryData(
                    labResultQueryKeys.byPatient(variables.patientId),
                    context.previousResults
                );
            }

            addNotification({
                type: 'error',
                title: 'Result Entry Failed',
                message: error.message || 'Failed to add lab result. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update lab result
 */
export const useUpdateLabResult = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ resultId, data }: { resultId: string; data: Partial<LabResultForm> }) =>
            labApi.updateResult(resultId, data),
        onMutate: async ({ resultId, data }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: labResultQueryKeys.detail(resultId) });

            // Snapshot previous value
            const previousResult = queryClient.getQueryData(labResultQueryKeys.detail(resultId));

            // Optimistically update
            queryClient.setQueryData(labResultQueryKeys.detail(resultId), (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: {
                        ...old.data,
                        ...data,
                        updatedAt: new Date().toISOString(),
                    },
                };
            });

            return { previousResult };
        },
        onSuccess: (response, { resultId }) => {
            const result = response?.data;

            if (result) {
                // Update the result in cache
                queryClient.setQueryData(labResultQueryKeys.detail(resultId), response);

                // Invalidate related queries
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.lists() });
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.byPatient(result.patientId) });

                if (result.orderId) {
                    queryClient.invalidateQueries({ queryKey: labResultQueryKeys.byOrder(result.orderId) });
                }

                // Invalidate critical and abnormal results if applicable
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.critical() });
                queryClient.invalidateQueries({ queryKey: labResultQueryKeys.abnormal(result.patientId) });

                addNotification({
                    type: 'success',
                    title: 'Result Updated',
                    message: 'Lab result has been successfully updated.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError, { resultId }, context) => {
            // Rollback optimistic update
            if (context?.previousResult) {
                queryClient.setQueryData(labResultQueryKeys.detail(resultId), context.previousResult);
            }

            addNotification({
                type: 'error',
                title: 'Update Failed',
                message: error.message || 'Failed to update lab result. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to delete lab result
 */
export const useDeleteLabResult = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (resultId: string) => labApi.deleteResult(resultId),
        onMutate: async (resultId) => {
            // Get the result data before deletion for rollback
            const resultData = queryClient.getQueryData(labResultQueryKeys.detail(resultId));
            return { resultData };
        },
        onSuccess: (_, resultId, context) => {
            // Remove result from cache
            queryClient.removeQueries({ queryKey: labResultQueryKeys.detail(resultId) });

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: labResultQueryKeys.lists() });

            if (context?.resultData?.data?.patientId) {
                queryClient.invalidateQueries({
                    queryKey: labResultQueryKeys.byPatient(context.resultData.data.patientId)
                });
            }

            if (context?.resultData?.data?.orderId) {
                queryClient.invalidateQueries({
                    queryKey: labResultQueryKeys.byOrder(context.resultData.data.orderId)
                });
            }

            // Invalidate critical and abnormal results
            queryClient.invalidateQueries({ queryKey: labResultQueryKeys.critical() });
            if (context?.resultData?.data?.patientId) {
                queryClient.invalidateQueries({
                    queryKey: labResultQueryKeys.abnormal(context.resultData.data.patientId)
                });
            }

            addNotification({
                type: 'success',
                title: 'Result Deleted',
                message: 'Lab result has been successfully deleted.',
                duration: 4000,
            });
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Deletion Failed',
                message: error.message || 'Failed to delete lab result. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook for optimistic updates when adding lab results
 */
export const useOptimisticAddLabResult = () => {
    const queryClient = useQueryClient();
    const addMutation = useAddLabResult();

    return {
        ...addMutation,
        mutateAsync: async (data: LabResultForm) => {
            // Create optimistic result
            const optimisticResult: Partial<LabResult> = {
                _id: `temp-${Date.now()}`,
                patientId: data.patientId,
                orderId: data.orderId,
                testCode: data.testCode,
                testName: data.testName,
                value: data.value,
                unit: data.unit,
                referenceRange: data.referenceRange,
                interpretation: data.interpretation || 'normal',
                flags: data.flags || [],
                source: 'manual',
                performedAt: data.performedAt,
                recordedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Optimistically update the cache
            const previousData = queryClient.getQueryData(
                labResultQueryKeys.byPatient(data.patientId)
            );

            queryClient.setQueryData(
                labResultQueryKeys.byPatient(data.patientId),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticResult, ...old.data.results],
                        },
                    };
                }
            );

            try {
                // Perform the actual mutation
                const result = await addMutation.mutateAsync(data);
                return result;
            } catch (error) {
                // Revert optimistic update on error
                queryClient.setQueryData(
                    labResultQueryKeys.byPatient(data.patientId),
                    previousData
                );
                throw error;
            }
        },
    };
};

/**
 * Hook to prefetch lab result details
 */
export const usePrefetchLabResult = () => {
    const queryClient = useQueryClient();

    return (resultId: string) => {
        queryClient.prefetchQuery({
            queryKey: labResultQueryKeys.detail(resultId),
            queryFn: () => labApi.getResult(resultId),
            staleTime: 2 * 60 * 1000, // 2 minutes
        });
    };
};

export default useLabResults;