import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  subscriptionService,
} from '../services/subscriptionService';
// import type { SubscriptionPlan } from '../services/subscriptionService';
import { paymentService } from '../services/paymentService';
import { useNotifications } from '../context/NotificationContext';

// Query Keys
export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  paymentMethods: () => [...subscriptionKeys.all, 'paymentMethods'] as const,
  paymentHistory: (filters?: Record<string, unknown>) =>
    [...subscriptionKeys.all, 'paymentHistory', filters] as const,
  usageMetrics: () => [...subscriptionKeys.all, 'usageMetrics'] as const,
  billingHistory: () => [...subscriptionKeys.all, 'billingHistory'] as const,
};

// Current Subscription Query
export const useCurrentSubscriptionQuery = () => {
  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async () => {
      const response = await subscriptionService.fetchCurrentSubscription();
      return response?.data?.subscription || null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};

// Available Plans Query
export const useAvailablePlansQuery = (
  billingInterval: 'monthly' | 'yearly' = 'monthly'
) => {
  return useQuery({
    queryKey: [...subscriptionKeys.plans(), billingInterval],
    queryFn: async () => {
      try {
        const plans = await subscriptionService.fetchPlans();
        // Filter plans by billing interval if needed, ensure we always return an array
        if (Array.isArray(plans)) {
          return plans.filter(plan => plan.billingInterval === billingInterval);
        }
        return [];
      } catch (error) {
        console.error('Failed to fetch plans:', error);
        throw error; // Let React Query handle the error state
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

// Payment Methods Query
export const usePaymentMethodsQuery = () => {
  return useQuery({
    queryKey: subscriptionKeys.paymentMethods(),
    queryFn: async () => {
      const methods = await paymentService.getPaymentMethods();
      return methods;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Payment History Query
export const usePaymentHistoryQuery = (
  page = 1,
  limit = 10,
  filters: { status?: string; dateFrom?: string; dateTo?: string } = {}
) => {
  return useQuery({
    queryKey: subscriptionKeys.paymentHistory({ page, limit, ...filters }),
    queryFn: async () => {
      const result = await paymentService.getPayments(
        page,
        limit,
        filters.status,
        filters.dateFrom,
        filters.dateTo
      );
      return result;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Usage Metrics Query
export const useUsageMetricsQuery = () => {
  return useQuery({
    queryKey: subscriptionKeys.usageMetrics(),
    queryFn: async () => {
      const response = await subscriptionService.getUsageStatistics();
      return response?.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Billing History Query
export const useBillingHistoryQuery = () => {
  return useQuery({
    queryKey: subscriptionKeys.billingHistory(),
    queryFn: async () => {
      const response = await subscriptionService.getBillingHistory();
      return response || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Safe notifications hook that doesn't throw if provider is missing
const useSafeNotifications = () => {
  try {
    return useNotifications();
  } catch (error) {
    // Return a fallback object when NotificationProvider is not available
    return {
      addNotification: (notification: any) => {
        console.warn('NotificationProvider not available, using fallback:', notification);
        // Fallback to browser alert for critical errors
        if (notification.type === 'error') {
          alert(`${notification.title}: ${notification.message}`);
        }
      }
    };
  }
};

// Checkout Session Mutation
export const useCreateCheckoutSessionMutation = () => {
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: async ({
      planId,
      billingInterval,
    }: {
      planId: string;
      billingInterval: 'monthly' | 'yearly';
    }) => {
      const response = await subscriptionService.createCheckoutSession({
        planId,
        interval: billingInterval,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });
      return response.sessionUrl;
    },
    onSuccess: (sessionUrl) => {
      // Redirect to Stripe checkout
      window.location.href = sessionUrl;
    },
    onError: (error) => {
      console.error('Checkout session creation failed:', error);
      addNotification({
        type: 'error',
        title: 'Checkout Failed',
        message: 'Failed to start checkout process. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Cancel Subscription Mutation
export const useCancelSubscriptionMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: (subscriptionId: string) =>
      subscriptionService.cancelSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      addNotification({
        type: 'success',
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled successfully.',
        duration: 5000,
      });
    },
    onError: (error) => {
      console.error('Subscription cancellation failed:', error);
      addNotification({
        type: 'error',
        title: 'Cancellation Failed',
        message: 'Failed to cancel subscription. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Reactivate Subscription Mutation
export const useReactivateSubscriptionMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: () => subscriptionService.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      addNotification({
        type: 'success',
        title: 'Subscription Reactivated',
        message: 'Your subscription has been reactivated successfully.',
        duration: 5000,
      });
    },
    onError: (error) => {
      console.error('Subscription reactivation failed:', error);
      addNotification({
        type: 'error',
        title: 'Reactivation Failed',
        message: 'Failed to reactivate subscription. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Update Subscription Mutation
export const useUpdateSubscriptionMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: ({
      planId,
      billingInterval,
    }: {
      planId: string;
      billingInterval: 'monthly' | 'yearly';
    }) => subscriptionService.updateSubscription(planId, billingInterval),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      addNotification({
        type: 'success',
        title: 'Subscription Updated',
        message: 'Your subscription has been updated successfully.',
        duration: 5000,
      });
    },
    onError: (error) => {
      console.error('Subscription update failed:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update subscription. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Add Payment Method Mutation
export const useAddPaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: ({
      paymentMethodId,
      setAsDefault,
    }: {
      paymentMethodId: string;
      setAsDefault?: boolean;
    }) => paymentService.addPaymentMethod(paymentMethodId, setAsDefault),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.paymentMethods(),
      });
      addNotification({
        type: 'success',
        title: 'Payment Method Added',
        message: 'Payment method has been added successfully.',
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Add payment method failed:', error);
      addNotification({
        type: 'error',
        title: 'Add Failed',
        message: 'Failed to add payment method. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Remove Payment Method Mutation
export const useRemovePaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: (paymentMethodId: string) =>
      paymentService.removePaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.paymentMethods(),
      });
      addNotification({
        type: 'success',
        title: 'Payment Method Removed',
        message: 'Payment method has been removed successfully.',
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Remove payment method failed:', error);
      addNotification({
        type: 'error',
        title: 'Remove Failed',
        message: 'Failed to remove payment method. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Set Default Payment Method Mutation
export const useSetDefaultPaymentMethodMutation = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: (paymentMethodId: string) =>
      paymentService.setDefaultPaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.paymentMethods(),
      });
      addNotification({
        type: 'success',
        title: 'Default Updated',
        message: 'Default payment method has been updated successfully.',
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Set default payment method failed:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update default payment method. Please try again.',
        duration: 5000,
      });
    },
  });
};

// Download Invoice Mutation
export const useDownloadInvoiceMutation = () => {
  const { addNotification } = useSafeNotifications();

  return useMutation({
    mutationFn: (paymentId: string) =>
      paymentService.generateInvoice(paymentId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Invoice Downloaded',
        message: 'Invoice has been generated and downloaded.',
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Download invoice failed:', error);
      addNotification({
        type: 'error',
        title: 'Download Failed',
        message: 'Failed to download invoice. Please try again.',
        duration: 5000,
      });
    },
  });
};
