import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  subscriptionService,
  SubscriptionPlan,
  Subscription,
} from '../services/subscriptionService';
import {
  paymentService,
  Payment,
  PaymentMethod,
} from '../services/paymentService';

interface SubscriptionState {
  // Subscription data
  currentSubscription: Subscription | null;
  availablePlans: SubscriptionPlan[];

  // Payment data
  paymentMethods: PaymentMethod[];
  paymentHistory: Payment[];

  // Analytics data
  usageMetrics: Record<string, unknown> | null;
  billingHistory: Record<string, unknown>[];

  // UI state
  loading: {
    subscription: boolean;
    plans: boolean;
    paymentMethods: boolean;
    paymentHistory: boolean;
    actions: boolean;
  };

  // Pagination
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };

  // Filters
  filters: {
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

interface SubscriptionActions {
  // Subscription actions
  loadCurrentSubscription: () => Promise<void>;
  loadAvailablePlans: () => Promise<void>;
  createCheckoutSession: (
    planId: string,
    billingInterval: 'monthly' | 'yearly'
  ) => Promise<string>;
  cancelSubscription: (reason?: string) => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  updateSubscription: (
    planId: string,
    billingInterval: 'monthly' | 'yearly'
  ) => Promise<void>;

  // Payment actions
  loadPaymentMethods: () => Promise<void>;
  addPaymentMethod: (
    paymentMethodId: string,
    setAsDefault?: boolean
  ) => Promise<void>;
  removePaymentMethod: (paymentMethodId: string) => Promise<void>;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<void>;

  // Payment history actions
  loadPaymentHistory: (page?: number, limit?: number) => Promise<void>;
  downloadInvoice: (paymentId: string) => Promise<void>;

  // Analytics actions
  loadUsageMetrics: () => Promise<void>;
  loadBillingHistory: () => Promise<void>;

  // Filter actions
  updateFilters: (filters: Partial<SubscriptionState['filters']>) => void;
  clearFilters: () => void;

  // UI actions
  setLoading: (key: keyof SubscriptionState['loading'], value: boolean) => void;
  resetStore: () => void;
}

type SubscriptionStore = SubscriptionState & SubscriptionActions;

const initialState: SubscriptionState = {
  currentSubscription: null,
  availablePlans: [],
  paymentMethods: [],
  paymentHistory: [],
  usageMetrics: null,
  billingHistory: [],
  loading: {
    subscription: false,
    plans: false,
    paymentMethods: false,
    paymentHistory: false,
    actions: false,
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  },
  filters: {},
};

export const useSubscriptionStore = create<SubscriptionStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Subscription actions
        loadCurrentSubscription: async () => {
          set((state) => ({
            loading: { ...state.loading, subscription: true },
          }));
          try {
            const subscription =
              await subscriptionService.getCurrentSubscription();
            set({
              currentSubscription: subscription.data?.subscription || null,
            });
          } catch (error) {
            console.error('Failed to load current subscription:', error);
            set({ currentSubscription: null });
          } finally {
            set((state) => ({
              loading: { ...state.loading, subscription: false },
            }));
          }
        },

        loadAvailablePlans: async () => {
          set((state) => ({ loading: { ...state.loading, plans: true } }));
          try {
            const response = await subscriptionService.getPlans();
            set({ availablePlans: response.data || [] });
          } catch (error) {
            console.error('Failed to load available plans:', error);
            set({ availablePlans: [] });
          } finally {
            set((state) => ({ loading: { ...state.loading, plans: false } }));
          }
        },

        createCheckoutSession: async (
          planId: string,
          billingInterval: 'monthly' | 'yearly'
        ) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            const response = await subscriptionService.createCheckoutSession(
              planId,
              billingInterval
            );
            return response.data.sessionUrl;
          } catch (error) {
            console.error('Failed to create checkout session:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        cancelSubscription: async (reason?: string) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await subscriptionService.cancelSubscription(reason);
            // Reload subscription data
            await get().loadCurrentSubscription();
          } catch (error) {
            console.error('Failed to cancel subscription:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        reactivateSubscription: async () => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await subscriptionService.reactivateSubscription();
            await get().loadCurrentSubscription();
          } catch (error) {
            console.error('Failed to reactivate subscription:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        updateSubscription: async (
          planId: string,
          billingInterval: 'monthly' | 'yearly'
        ) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await subscriptionService.updateSubscription(
              planId,
              billingInterval
            );
            await get().loadCurrentSubscription();
          } catch (error) {
            console.error('Failed to update subscription:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        // Payment actions
        loadPaymentMethods: async () => {
          set((state) => ({
            loading: { ...state.loading, paymentMethods: true },
          }));
          try {
            const methods = await paymentService.getPaymentMethods();
            set({ paymentMethods: methods });
          } catch (error) {
            console.error('Failed to load payment methods:', error);
            set({ paymentMethods: [] });
          } finally {
            set((state) => ({
              loading: { ...state.loading, paymentMethods: false },
            }));
          }
        },

        addPaymentMethod: async (
          paymentMethodId: string,
          setAsDefault = false
        ) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await paymentService.addPaymentMethod(
              paymentMethodId,
              setAsDefault
            );
            await get().loadPaymentMethods();
          } catch (error) {
            console.error('Failed to add payment method:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        removePaymentMethod: async (paymentMethodId: string) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await paymentService.removePaymentMethod(paymentMethodId);
            await get().loadPaymentMethods();
          } catch (error) {
            console.error('Failed to remove payment method:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        setDefaultPaymentMethod: async (paymentMethodId: string) => {
          set((state) => ({ loading: { ...state.loading, actions: true } }));
          try {
            await paymentService.setDefaultPaymentMethod(paymentMethodId);
            await get().loadPaymentMethods();
          } catch (error) {
            console.error('Failed to set default payment method:', error);
            throw error;
          } finally {
            set((state) => ({ loading: { ...state.loading, actions: false } }));
          }
        },

        // Payment history actions
        loadPaymentHistory: async (page = 1, limit = 10) => {
          set((state) => ({
            loading: { ...state.loading, paymentHistory: true },
          }));
          try {
            const { filters } = get();
            const response = await paymentService.getPayments(
              page,
              limit,
              filters.paymentStatus,
              filters.dateFrom,
              filters.dateTo
            );

            set({
              paymentHistory: response.payments,
              pagination: response.pagination,
            });
          } catch (error) {
            console.error('Failed to load payment history:', error);
            set({ paymentHistory: [] });
          } finally {
            set((state) => ({
              loading: { ...state.loading, paymentHistory: false },
            }));
          }
        },

        downloadInvoice: async (paymentId: string) => {
          try {
            await paymentService.generateInvoice(paymentId);
          } catch (error) {
            console.error('Failed to download invoice:', error);
            throw error;
          }
        },

        // Analytics actions
        loadUsageMetrics: async () => {
          try {
            const metrics = await subscriptionService.getUsageMetrics();
            set({ usageMetrics: metrics.data });
          } catch (error) {
            console.error('Failed to load usage metrics:', error);
          }
        },

        loadBillingHistory: async () => {
          try {
            const history = await subscriptionService.getBillingHistory();
            set({ billingHistory: history.data || [] });
          } catch (error) {
            console.error('Failed to load billing history:', error);
            set({ billingHistory: [] });
          }
        },

        // Filter actions
        updateFilters: (newFilters) => {
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          }));
        },

        clearFilters: () => {
          set({ filters: {} });
        },

        // UI actions
        setLoading: (key, value) => {
          set((state) => ({
            loading: { ...state.loading, [key]: value },
          }));
        },

        resetStore: () => {
          set(initialState);
        },
      }),
      {
        name: 'subscription-store',
        partialize: (state) => ({
          currentSubscription: state.currentSubscription,
          availablePlans: state.availablePlans,
          filters: state.filters,
        }),
      }
    ),
    {
      name: 'subscription-store',
    }
  )
);

// Convenience hooks
export const useCurrentSubscription = () =>
  useSubscriptionStore((state) => state.currentSubscription);

export const useAvailablePlans = () =>
  useSubscriptionStore((state) => state.availablePlans);

export const usePaymentMethods = () =>
  useSubscriptionStore((state) => state.paymentMethods);

export const usePaymentHistory = () =>
  useSubscriptionStore((state) => state.paymentHistory);

export const useSubscriptionLoading = () =>
  useSubscriptionStore((state) => state.loading);

export const useSubscriptionActions = () =>
  useSubscriptionStore((state) => ({
    loadCurrentSubscription: state.loadCurrentSubscription,
    loadAvailablePlans: state.loadAvailablePlans,
    createCheckoutSession: state.createCheckoutSession,
    cancelSubscription: state.cancelSubscription,
    reactivateSubscription: state.reactivateSubscription,
    updateSubscription: state.updateSubscription,
    loadPaymentMethods: state.loadPaymentMethods,
    addPaymentMethod: state.addPaymentMethod,
    removePaymentMethod: state.removePaymentMethod,
    setDefaultPaymentMethod: state.setDefaultPaymentMethod,
    loadPaymentHistory: state.loadPaymentHistory,
    downloadInvoice: state.downloadInvoice,
    loadUsageMetrics: state.loadUsageMetrics,
    loadBillingHistory: state.loadBillingHistory,
    updateFilters: state.updateFilters,
    clearFilters: state.clearFilters,
  }));
