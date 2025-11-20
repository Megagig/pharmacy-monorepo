import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labApi } from '../api/labApi';
import { useUIStore } from '../../../stores';
import type {
    LabOrder,
    LabOrderForm,
    LabOrderParams,
    ApiResponse
} from '../types';

// Error type for API calls
type ApiError = {
    message?: string;
} | Error;

// Query keys for lab orders
export const labOrderQueryKeys = {
    all: ['lab', 'orders'] as const,
    lists: () => ['lab', 'orders', 'list'] as const,
    list: (params: LabOrderParams) => ['lab', 'orders', 'list', params] as const,
    details: () => ['lab', 'orders', 'detail'] as const,
    detail: (id: string) => ['lab', 'orders', 'detail', id] as const,
    byPatient: (patientId: string) => ['lab', 'orders', 'patient', patientId] as const,
    pending: () => ['lab', 'orders', 'pending'] as const,
    completed: () => ['lab', 'orders', 'completed'] as const,
};

// ===============================
// QUERY HOOKS
// ===============================

/**
 * Hook to fetch lab orders with optional filters
 */
export const useLabOrders = (params: LabOrderParams = {}) => {
    return useQuery({
        queryKey: labOrderQueryKeys.list(params),
        queryFn: () => labApi.getOrders(params),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch a single lab order by ID
 */
export const useLabOrder = (orderId: string) => {
    return useQuery({
        queryKey: labOrderQueryKeys.detail(orderId),
        queryFn: () => labApi.getOrder(orderId),
        enabled: !!orderId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch lab orders for a specific patient
 */
export const useLabOrdersByPatient = (patientId: string, params: Omit<LabOrderParams, 'patientId'> = {}) => {
    return useQuery({
        queryKey: labOrderQueryKeys.byPatient(patientId),
        queryFn: () => labApi.getOrders({ ...params, patientId }),
        enabled: !!patientId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch pending lab orders
 */
export const usePendingLabOrders = (params: Omit<LabOrderParams, 'status'> = {}) => {
    return useQuery({
        queryKey: labOrderQueryKeys.pending(),
        queryFn: () => labApi.getOrders({ ...params, status: 'ordered' }),
        staleTime: 1 * 60 * 1000, // 1 minute for pending orders
        refetchOnWindowFocus: false,
    });
};

/**
 * Hook to fetch completed lab orders
 */
export const useCompletedLabOrders = (params: Omit<LabOrderParams, 'status'> = {}) => {
    return useQuery({
        queryKey: labOrderQueryKeys.completed(),
        queryFn: () => labApi.getOrders({ ...params, status: 'completed' }),
        staleTime: 5 * 60 * 1000, // 5 minutes for completed orders
        refetchOnWindowFocus: false,
    });
};

// ===============================
// MUTATION HOOKS
// ===============================

/**
 * Hook to create a new lab order
 */
export const useCreateLabOrder = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (data: LabOrderForm) => labApi.createOrder(data),
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: labOrderQueryKeys.byPatient(variables.patientId) });

            // Snapshot previous value
            const previousOrders = queryClient.getQueryData(
                labOrderQueryKeys.byPatient(variables.patientId)
            );

            // Optimistically update
            const optimisticOrder: Partial<LabOrder> = {
                _id: `temp-${Date.now()}`,
                patientId: variables.patientId,
                tests: variables.tests,
                status: 'ordered',
                orderDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData(
                labOrderQueryKeys.byPatient(variables.patientId),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticOrder, ...old.data.results],
                        },
                    };
                }
            );

            return { previousOrders };
        },
        onSuccess: (response, variables) => {
            const order = response?.data;

            if (order) {
                // Update the specific order in cache
                queryClient.setQueryData(labOrderQueryKeys.detail(order._id), response);

                // Invalidate and refetch related queries
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.lists() });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.byPatient(variables.patientId) });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.pending() });

                addNotification({
                    type: 'success',
                    title: 'Lab Order Created',
                    message: `Lab order has been successfully created with ${order.tests.length} test(s).`,
                    duration: 5000,
                });
            }
        },
        onError: (error: ApiError, variables, context) => {
            // Rollback optimistic update
            if (context?.previousOrders) {
                queryClient.setQueryData(
                    labOrderQueryKeys.byPatient(variables.patientId),
                    context.previousOrders
                );
            }

            addNotification({
                type: 'error',
                title: 'Order Creation Failed',
                message: error.message || 'Failed to create lab order. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to update lab order status
 */
export const useUpdateLabOrderStatus = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: ({ orderId, status }: { orderId: string; status: LabOrder['status'] }) =>
            labApi.updateOrderStatus(orderId, status),
        onMutate: async ({ orderId, status }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: labOrderQueryKeys.detail(orderId) });

            // Snapshot previous value
            const previousOrder = queryClient.getQueryData(labOrderQueryKeys.detail(orderId));

            // Optimistically update
            queryClient.setQueryData(labOrderQueryKeys.detail(orderId), (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: {
                        ...old.data,
                        status,
                        updatedAt: new Date().toISOString(),
                    },
                };
            });

            return { previousOrder };
        },
        onSuccess: (response, { orderId, status }) => {
            const order = response?.data;

            if (order) {
                // Update the order in cache
                queryClient.setQueryData(labOrderQueryKeys.detail(orderId), response);

                // Invalidate related queries
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.lists() });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.byPatient(order.patientId) });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.pending() });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.completed() });

                addNotification({
                    type: 'success',
                    title: 'Order Status Updated',
                    message: `Lab order status has been updated to ${status}.`,
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError, { orderId }, context) => {
            // Rollback optimistic update
            if (context?.previousOrder) {
                queryClient.setQueryData(labOrderQueryKeys.detail(orderId), context.previousOrder);
            }

            addNotification({
                type: 'error',
                title: 'Status Update Failed',
                message: error.message || 'Failed to update lab order status. Please try again.',
                duration: 5000,
            });
        },
    });
};

/**
 * Hook to cancel lab order
 */
export const useCancelLabOrder = () => {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);

    return useMutation({
        mutationFn: (orderId: string) => labApi.cancelOrder(orderId),
        onSuccess: (response, orderId) => {
            const order = response?.data;

            if (order) {
                // Update the order in cache
                queryClient.setQueryData(labOrderQueryKeys.detail(orderId), response);

                // Invalidate related queries
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.lists() });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.byPatient(order.patientId) });
                queryClient.invalidateQueries({ queryKey: labOrderQueryKeys.pending() });

                addNotification({
                    type: 'success',
                    title: 'Order Cancelled',
                    message: 'Lab order has been successfully cancelled.',
                    duration: 4000,
                });
            }
        },
        onError: (error: ApiError) => {
            addNotification({
                type: 'error',
                title: 'Cancellation Failed',
                message: error.message || 'Failed to cancel lab order. Please try again.',
                duration: 5000,
            });
        },
    });
};

// ===============================
// UTILITY HOOKS
// ===============================

/**
 * Hook for optimistic updates when creating lab orders
 */
export const useOptimisticCreateLabOrder = () => {
    const queryClient = useQueryClient();
    const createMutation = useCreateLabOrder();

    return {
        ...createMutation,
        mutateAsync: async (data: LabOrderForm) => {
            // Create optimistic order
            const optimisticOrder: Partial<LabOrder> = {
                _id: `temp-${Date.now()}`,
                patientId: data.patientId,
                tests: data.tests,
                status: 'ordered',
                orderDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Optimistically update the cache
            const previousData = queryClient.getQueryData(
                labOrderQueryKeys.byPatient(data.patientId)
            );

            queryClient.setQueryData(
                labOrderQueryKeys.byPatient(data.patientId),
                (old: any) => {
                    if (!old?.data?.results) return old;
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            results: [optimisticOrder, ...old.data.results],
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
                    labOrderQueryKeys.byPatient(data.patientId),
                    previousData
                );
                throw error;
            }
        },
    };
};

/**
 * Hook to prefetch lab order details
 */
export const usePrefetchLabOrder = () => {
    const queryClient = useQueryClient();

    return (orderId: string) => {
        queryClient.prefetchQuery({
            queryKey: labOrderQueryKeys.detail(orderId),
            queryFn: () => labApi.getOrder(orderId),
            staleTime: 2 * 60 * 1000, // 2 minutes
        });
    };
};

export default useLabOrders;