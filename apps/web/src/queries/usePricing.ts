import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

// Types
export interface PricingFeature {
    _id: string;
    featureId: string;
    name: string;
    description?: string;
    category?: string;
    isActive: boolean;
    order: number;
}

export interface PricingPlan {
    _id: string;
    name: string;
    slug: string;
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly' | 'one-time';
    tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
    description: string;
    features: string[];
    featuresDetails?: PricingFeature[];
    isPopular: boolean;
    isActive: boolean;
    isContactSales: boolean;
    whatsappNumber?: string;
    trialDays?: number;
    order: number;
    metadata?: {
        buttonText?: string;
        badge?: string;
        icon?: string;
    };
}

// Public API - Get all active pricing plans
export const usePricingPlans = (billingPeriod?: 'monthly' | 'yearly') => {
    return useQuery<{ plans: PricingPlan[]; features: PricingFeature[] }>({
        queryKey: ['pricing-plans', billingPeriod],
        queryFn: async () => {
            const params = billingPeriod ? { billingPeriod } : {};
            const response = await apiClient.get('/pricing/plans', { params });
            return response.data.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Public API - Get plan by slug
export const usePricingPlan = (slug: string) => {
    return useQuery<{ plan: PricingPlan }>({
        queryKey: ['pricing-plan', slug],
        queryFn: async () => {
            const response = await apiClient.get(`/pricing/plans/${slug}`);
            return response.data.data;
        },
        enabled: !!slug,
    });
};

// ==================== ADMIN APIs ====================

// Get all plans (including inactive) - Admin only
export const useAdminPricingPlans = () => {
    return useQuery<{ plans: PricingPlan[]; features: PricingFeature[] }>({
        queryKey: ['admin-pricing-plans'],
        queryFn: async () => {
            const response = await apiClient.get('/pricing/admin/plans');
            return response.data.data;
        },
    });
};

// Get all features (including inactive) - Admin only
export const useAdminPricingFeatures = () => {
    return useQuery<{ features: PricingFeature[] }>({
        queryKey: ['admin-pricing-features'],
        queryFn: async () => {
            const response = await apiClient.get('/pricing/admin/features');
            return response.data.data;
        },
    });
};

// Create plan - Admin only
export const useCreatePlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (planData: Partial<PricingPlan>) => {
            const response = await apiClient.post('/pricing/admin/plans', planData);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });
};

// Update plan - Admin only
export const useUpdatePlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<PricingPlan> }) => {
            const response = await apiClient.put(`/pricing/admin/plans/${id}`, data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });
};

// Delete plan - Admin only
export const useDeletePlan = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.delete(`/pricing/admin/plans/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });
};

// Reorder plans - Admin only
export const useReorderPlans = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (planOrders: { id: string; order: number }[]) => {
            const response = await apiClient.post('/pricing/admin/plans/reorder', { planOrders });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });
};

// Create feature - Admin only
export const useCreateFeature = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (featureData: Partial<PricingFeature>) => {
            const response = await apiClient.post('/pricing/admin/features', featureData);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-features'] });
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
        },
    });
};

// Update feature - Admin only
export const useUpdateFeature = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<PricingFeature> }) => {
            const response = await apiClient.put(`/pricing/admin/features/${id}`, data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-features'] });
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
        },
    });
};

// Delete feature - Admin only
export const useDeleteFeature = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.delete(`/pricing/admin/features/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-features'] });
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-plans'] });
        },
    });
};

// Reorder features - Admin only
export const useReorderFeatures = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (featureOrders: { id: string; order: number }[]) => {
            const response = await apiClient.post('/pricing/admin/features/reorder', { featureOrders });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-pricing-features'] });
        },
    });
};
