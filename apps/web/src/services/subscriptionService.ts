import axios, { AxiosError } from 'axios';

// Create axios instance with base configuration similar to api.ts
const apiClient = axios.create({
  baseURL: import.meta.env.MODE === 'development' 
    ? 'http://localhost:5000/api' 
    : '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SubscriptionPlan {
  _id: string;
  name: string;
  tier: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
  priceNGN: number;
  priceNGN: number;
  billingInterval: 'monthly' | 'yearly';
  isContactSales?: boolean;
  whatsappNumber?: string;
  features: {
    patientLimit: number | null;
    reminderSmsMonthlyLimit: number | null;
    reportsExport: boolean;
    careNoteExport: boolean;
    adrModule: boolean;
    multiUserSupport: boolean;
    teamSize: number | null;
    apiAccess: boolean;
    mtpLimit: number | null;
    mtrLimit: number | null;
    datastoreLimit: number | null;
    additionalSupport: string[];
    clinicalToolsAccess: string[];
  };
  displayedFeatures: string[];
  metadata?: {
    mostPopular?: boolean;
    highlight?: boolean;
    recommended?: boolean;
    hidden?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Interface for API response
interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Subscription Service
export const subscriptionService = {
  // Fetch all subscription plans
  async fetchPlans(options: { sortBy?: string } = {}): Promise<SubscriptionPlan[]> {
    try {
      const response = await apiClient.get('/subscription/plans', {
        params: { sortBy: options.sortBy },
      });
      return response.data.data || [];
    } catch (error: unknown) {
      console.error('Failed to fetch subscription plans', error);
      return [];
    }
  },

  // Fetch current subscription details
  async fetchCurrentSubscription() {
    try {
      const response = await apiClient.get('/subscription/current');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch current subscription', error);
      return null;
    }
  },

  // Create a checkout session for a plan
  async createCheckoutSession({
    planId,
    interval,
    successUrl,
    cancelUrl,
    couponCode,
  }: {
    planId: string;
    interval: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
    couponCode?: string;
  }) {
    try {
      const response = await apiClient.post('/subscription/checkout', {
        planId,
        interval,
        successUrl,
        cancelUrl,
        couponCode,
      });

      return {
        success: true,
        sessionUrl: response.data.data?.sessionUrl,
        sessionId: response.data.data?.sessionId,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message:
          (error as AxiosError<{ message: string }>)?.response?.data?.message || 'Failed to create checkout session',
        error: (error as Error)?.message || 'Unknown error',
      };
    }
  },

  // Handle checkout success
  async handleCheckoutSuccess({
    sessionId,
    planId,
  }: {
    sessionId: string;
    planId: string;
  }) {
    try {
      const response = await apiClient.get(
        `/subscription/checkout-success?session_id=${sessionId}&plan_id=${planId}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to process checkout success', error);
      return null;
    }
  },

  // Process payment success
  async processPaymentSuccess(sessionId: string) {
    try {
      const response = await apiClient.post('/subscription/payment-success', {
        sessionId,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to process payment', error);
      return null;
    }
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await apiClient.post('/subscription/cancel', {
        subscriptionId,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to cancel subscription', error);
      return null;
    }
  },

  // Reactivate subscription
  async reactivateSubscription() {
    try {
      const response = await apiClient.post('/subscription/reactivate');
      return response.data;
    } catch (error) {
      console.error('Failed to reactivate subscription', error);
      return null;
    }
  },

  // Update subscription
  async updateSubscription(planId: string, interval: 'monthly' | 'yearly') {
    try {
      const response = await apiClient.put('/subscription/update', {
        planId,
        interval,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update subscription', error);
      return null;
    }
  },

  // Get billing history
  async getBillingHistory() {
    try {
      const response = await apiClient.get('/subscription/billing-history');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch billing history', error);
      return [];
    }
  },

  // Get invoice
  async getInvoice(invoiceId: string) {
    try {
      const response = await apiClient.get(`/subscription/invoice/${invoiceId}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch invoice', error);
      return null;
    }
  },

  // Get usage statistics
  async getUsageStatistics() {
    try {
      const response = await apiClient.get('/subscription/usage');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch usage statistics', error);
      return null;
    }
  },

  // Get feature limits
  async getFeatureLimits(feature: string) {
    try {
      const response = await apiClient.get(
        `/subscription/feature-limit?feature=${feature}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch feature limits', error);
      return null;
    }
  },

  // Get subscription status
  async getStatus() {
    try {
      const response = await apiClient.get('/subscription/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch subscription status', error);
      return null;
    }
  },

  // Update payment method
  async updatePaymentMethod() {
    try {
      const response = await apiClient.post('/subscription/payment-method/update');
      return response.data;
    } catch (error) {
      console.error('Failed to update payment method', error);
      return null;
    }
  },

  // Get upcoming invoice
  async getUpcomingInvoice() {
    try {
      const response = await apiClient.get('/subscription/upcoming-invoice');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch upcoming invoice', error);
      return null;
    }
  },

  // Apply coupon
  async applyCoupon(couponCode: string) {
    try {
      const response = await apiClient.post('/subscription/coupon/apply', {
        couponCode,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to apply coupon', error);
      return null;
    }
  },

  // Remove coupon
  async removeCoupon() {
    try {
      const response = await apiClient.post('/subscription/coupon/remove');
      return response.data;
    } catch (error) {
      console.error('Failed to remove coupon', error);
      return null;
    }
  },

  // Compare plans
  async comparePlans() {
    try {
      const response = await apiClient.get('/subscription/plans/compare');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch plan comparison', error);
      return [];
    }
  },

  // Generate comparison table data
  generateComparisonTable(plans: SubscriptionPlan[]) {
    // Implementation details
    return plans.map((plan) => ({
      name: plan.name,
      features: plan.features,
      price: plan.priceNGN,
      tier: plan.tier,
    }));
  },

  // Request custom quote
  async requestCustomQuote({
    name,
    email,
    phone,
    companySize,
    message,
  }: {
    name: string;
    email: string;
    phone: string;
    companySize: string;
    message: string;
  }) {
    try {
      const response = await apiClient.post(
        '/subscription/request-quote',
        {
          name,
          email,
          phone,
          companySize,
          message,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to request custom quote', error);
      return null;
    }
  },

  // Verify payment by reference
  async verifyPayment(reference: string) {
    try {
      const response = await apiClient.get(`/subscription/verify-payment?reference=${reference}`);
      return response.data;
    } catch (error) {
      console.error('Failed to verify payment', error);
      return { success: false, message: 'Payment verification failed' };
    }
  },

  // Handle successful payment
  async handleSuccessfulPayment(paymentReference: string) {
    try {
      const response = await apiClient.post('/subscription/payment-success', {
        paymentReference,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to handle successful payment', error);
      return null;
    }
  },
};

export default subscriptionService;
