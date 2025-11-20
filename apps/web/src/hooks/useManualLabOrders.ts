import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
    ManualLabOrder,
    CreateOrderRequest,
    CreateOrderResponse,
    OrderTokenResponse
} from '../types/manualLabOrder';

/**
 * Hook for fetching patient's manual lab order history
 */
export const usePatientLabOrders = (patientId: string, options?: {
    enabled?: boolean;
    refetchInterval?: number;
}) => {
    return useQuery({
        queryKey: ['manualLabOrders', 'patient', patientId],
        queryFn: async (): Promise<ManualLabOrder[]> => {
            const response = await api.get(`/manual-lab/patient/${patientId}`);
            return response.data?.data?.orders || response.data?.orders || response.data || [];
        },
        enabled: options?.enabled !== false && !!patientId,
        refetchInterval: options?.refetchInterval,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error: any) => {
            // Don't retry on 404 (not found) or 403 (forbidden) errors
            if (error?.response?.status === 404 || error?.response?.status === 403) {
                return false;
            }
            return failureCount < 2;
        },
    });
};

/**
 * Hook for fetching a specific manual lab order by ID
 */
export const useManualLabOrder = (orderId: string, options?: {
    enabled?: boolean;
}) => {
    return useQuery({
        queryKey: ['manualLabOrders', orderId],
        queryFn: async (): Promise<ManualLabOrder> => {
            const response = await api.get(`/manual-lab/${orderId}`);
            return response.data?.data?.order || response.data?.order || response.data;
        },
        enabled: options?.enabled !== false && !!orderId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};

/**
 * Hook for creating a new manual lab order
 */
export const useCreateManualLabOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderData: CreateOrderRequest): Promise<CreateOrderResponse> => {
            const response = await api.post('/manual-lab', orderData);
            return response.data;
        },
        onSuccess: (data, variables) => {
            // Invalidate patient orders list
            queryClient.invalidateQueries({
                queryKey: ['manualLabOrders', 'patient', variables.patientId]
            });

            // Add the new order to cache
            queryClient.setQueryData(
                ['manualLabOrders', data.data.order.orderId],
                data.data.order
            );
        },
    });
};

/**
 * Hook for updating manual lab order status
 */
export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const response = await api.put(`/manual-lab/${orderId}/status`, { status });
            return response.data;
        },
        onSuccess: (data, variables) => {
            // Update the specific order in cache
            queryClient.setQueryData(
                ['manualLabOrders', variables.orderId],
                (oldData: ManualLabOrder | undefined) => {
                    if (oldData) {
                        return { ...oldData, status: variables.status, updatedAt: new Date().toISOString() };
                    }
                    return oldData;
                }
            );

            // Invalidate patient orders list to refresh
            queryClient.invalidateQueries({
                queryKey: ['manualLabOrders', 'patient']
            });
        },
    });
};

/**
 * Hook for resolving order token (for scanning)
 */
export const useResolveOrderToken = () => {
    return useMutation({
        mutationFn: async (token: string): Promise<OrderTokenResponse> => {
            const response = await api.get(`/manual-lab/scan?token=${encodeURIComponent(token)}`);
            return response.data;
        },
    });
};

/**
 * Hook for getting PDF URL for an order
 */
export const useOrderPdfUrl = (orderId: string) => {
    return useQuery({
        queryKey: ['manualLabOrders', orderId, 'pdf'],
        queryFn: async (): Promise<string> => {
            // Return the PDF URL directly - the backend handles authentication
            return `/api/manual-lab-orders/${orderId}/pdf`;
        },
        enabled: !!orderId,
        staleTime: Infinity, // PDF URLs don't change
    });
};

/**
 * Hook for fetching lab results for an order
 */
export const useLabResults = (orderId: string, options?: {
    enabled?: boolean;
}) => {
    return useQuery({
        queryKey: ['manualLabOrders', orderId, 'results'],
        queryFn: async () => {
            const response = await apiHelpers.get(`/manual-lab-orders/${orderId}/results`);
            return response.data;
        },
        enabled: options?.enabled !== false && !!orderId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};