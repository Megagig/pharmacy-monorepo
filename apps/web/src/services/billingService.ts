import { apiClient } from './apiClient';

export interface BillingAnalytics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  subscriptionsByStatus: Record<string, number>;
  revenueByPlan: Array<{ planName: string; revenue: number; count: number }>;
}

export interface CreateSubscriptionRequest {
  planId: string;
  billingInterval?: 'monthly' | 'yearly';
  trialDays?: number;
}

export interface UpdateSubscriptionRequest {
  subscriptionId: string;
  newPlanId: string;
  prorationBehavior?: 'immediate' | 'next_cycle';
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface CreateCheckoutRequest {
  subscriptionId?: string;
  invoiceId?: string;
}

export interface ProcessRefundRequest {
  paymentReference: string;
  amount?: number;
  reason?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class BillingService {
  private baseUrl = '/billing';

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/subscriptions`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create subscription'
      };
    }
  }

  /**
   * Get current subscription for workspace
   */
  async getCurrentSubscription(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/subscriptions/current`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch current subscription'
      };
    }
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(data: UpdateSubscriptionRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/subscriptions/${data.subscriptionId}`,
        {
          newPlanId: data.newPlanId,
          prorationBehavior: data.prorationBehavior
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update subscription'
      };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(data: CancelSubscriptionRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/subscriptions/${data.subscriptionId}/cancel`,
        {
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          reason: data.reason
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to cancel subscription'
      };
    }
  }

  /**
   * Get billing history for workspace
   */
  async getBillingHistory(limit?: number): Promise<ApiResponse> {
    try {
      const params = limit ? { limit } : {};
      const response = await apiClient.get(`${this.baseUrl}/history`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch billing history'
      };
    }
  }

  /**
   * Create checkout session for payment
   */
  async createCheckoutSession(data: CreateCheckoutRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/checkout`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create checkout session'
      };
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentReference: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/payment-success`, {
        paymentReference
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to process payment'
      };
    }
  }

  /**
   * Process refund (Admin only)
   */
  async processRefund(data: ProcessRefundRequest): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/refunds`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to process refund'
      };
    }
  }

  /**
   * Get billing analytics (Super Admin only)
   */
  async getBillingAnalytics(startDate?: string, endDate?: string): Promise<ApiResponse<BillingAnalytics>> {
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await apiClient.get(`${this.baseUrl}/analytics`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch billing analytics'
      };
    }
  }

  /**
   * Get all subscriptions with pagination
   */
  async getSubscriptions(page: number = 1, limit: number = 10, status?: string, search?: string): Promise<ApiResponse> {
    try {
      const params: any = { page, limit };
      if (status) params.status = status;
      if (search) params.search = search;

      const response = await apiClient.get(`${this.baseUrl}/subscriptions`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch subscriptions'
      };
    }
  }

  /**
   * Get revenue trends over time
   */
  async getRevenueTrends(period: '7d' | '30d' | '90d' | '365d' = '30d'): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/revenue-trends`, {
        params: { period }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch revenue trends'
      };
    }
  }

  /**
   * Get all invoices with pagination
   */
  async getInvoices(page: number = 1, limit: number = 10, status?: string, search?: string): Promise<ApiResponse> {
    try {
      const params: any = { page, limit };
      if (status) params.status = status;
      if (search) params.search = search;

      const response = await apiClient.get(`${this.baseUrl}/invoices`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch invoices'
      };
    }
  }

  /**
   * Get all payment methods
   */
  async getAllPaymentMethods(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payment-methods`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch payment methods'
      };
    }
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoice(invoiceId: string): Promise<Blob | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to download invoice:', error);
      return null;
    }
  }

  /**
   * Export billing report
   */
  async exportBillingReport(
    format: 'pdf' | 'csv' | 'excel',
    startDate?: string,
    endDate?: string
  ): Promise<Blob | null> {
    try {
      const params: any = { format };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await apiClient.get(`${this.baseUrl}/reports/export`, {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export billing report:', error);
      return null;
    }
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(customerId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/payment-methods/${customerId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch payment methods'
      };
    }
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(customerId: string, paymentMethodData: any): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(
        `${this.baseUrl}/payment-methods/${customerId}`,
        paymentMethodData
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to add payment method'
      };
    }
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(
        `${this.baseUrl}/payment-methods/${customerId}/${paymentMethodId}`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to remove payment method'
      };
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/payment-methods/${customerId}/${paymentMethodId}/default`
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to set default payment method'
      };
    }
  }
}

export const billingService = new BillingService();