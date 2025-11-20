import axios from 'axios';

// Development: Direct backend URL (Vite proxy is broken)
// Production: /api (same port, served by backend)
const API_BASE_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:5000/api' 
  : '/api';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: Date;
}

interface Payment {
  _id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  subscription: {
    _id: string;
    tier: string;
    planId: {
      name: string;
      priceNGN: number;
      billingInterval: string;
    };
  };
  invoice?: {
    invoiceNumber: string;
    items: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
}

interface PaymentSummary {
  totalAmount: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
}

interface PaginatedPayments {
  payments: Payment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: PaymentSummary;
}

class PaymentService {
  private async makeRequest(url: string, options: RequestInit = {}) {
    try {
      const response = await axios(`${API_BASE_URL}${url}`, {
        method: (options.method || 'GET') as any,
        data: options.body ? JSON.parse(options.body as string) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...((options.headers as Record<string, string>) || {}),
        },
        withCredentials: true, // Include httpOnly cookies for authentication
      });

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message ||
          error.message ||
          `Request failed with status: ${error.response?.status || 'unknown'}`
      );
    }
  }

  // Payment History Methods
  async getPayments(
    page = 1,
    limit = 10,
    status?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<PaginatedPayments> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) params.append('status', status);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await this.makeRequest(`/payments?${params.toString()}`);
    return response.data;
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const response = await this.makeRequest(`/payments/${paymentId}`);
    return response.data.payment;
  }

  async generateInvoice(paymentId: string) {
    const response = await this.makeRequest(`/payments/${paymentId}/invoice`);
    return response.data.invoice;
  }

  // Payment Methods Management
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.makeRequest('/payments/methods/list');
    return response.data.paymentMethods;
  }

  async createSetupIntent() {
    const response = await this.makeRequest('/payments/methods/setup-intent', {
      method: 'POST',
    });
    return response.data;
  }

  async addPaymentMethod(paymentMethodId: string, setAsDefault = false) {
    const response = await this.makeRequest('/payments/methods/add', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId, setAsDefault }),
    });
    return response;
  }

  async removePaymentMethod(paymentMethodId: string) {
    const response = await this.makeRequest(
      `/payments/methods/${paymentMethodId}`,
      {
        method: 'DELETE',
      }
    );
    return response;
  }

  async setDefaultPaymentMethod(paymentMethodId: string) {
    const response = await this.makeRequest('/payments/methods/default', {
      method: 'PUT',
      body: JSON.stringify({ paymentMethodId }),
    });
    return response;
  }

  // Subscription Management
  async getSubscription() {
    const response = await this.makeRequest('/subscription-management/current');
    return response.data;
  }

  async getSubscriptionPlans() {
    const response = await this.makeRequest('/subscription-management/plans');
    return response.data;
  }

  async getSubscriptionAnalytics() {
    const response = await this.makeRequest(
      '/subscription-management/analytics'
    );
    return response.data;
  }

  async createCheckoutSession(planId: string, billingInterval = 'monthly') {
    const response = await this.makeRequest(
      '/subscription-management/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ planId, billingInterval }),
      }
    );
    return response.data;
  }

  async upgradeSubscription(planId: string, billingInterval = 'monthly') {
    const response = await this.makeRequest(
      '/subscription-management/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({ planId, billingInterval }),
      }
    );
    return response.data;
  }

  async downgradeSubscription(planId: string) {
    const response = await this.makeRequest(
      '/subscription-management/downgrade',
      {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }
    );
    return response.data;
  }

  async cancelSubscription(reason?: string) {
    const response = await this.makeRequest('/subscription-management/cancel', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return response.data;
  }

  async handleSuccessfulPayment(sessionId: string) {
    const response = await this.makeRequest(
      '/subscription-management/success',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }
    );
    return response.data;
  }

  // Legacy methods for backward compatibility
  async createPayment(paymentData: Record<string, unknown>) {
    const response = await this.makeRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    return response.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateSubscription(_subscriptionData: Record<string, unknown>) {
    // This would likely be handled by upgrade/downgrade methods
    throw new Error('Use upgradeSubscription or downgradeSubscription instead');
  }

  async renewSubscription() {
    // This would be handled automatically by Stripe webhooks
    throw new Error('Subscription renewal is handled automatically');
  }

  async getPlans() {
    return this.getSubscriptionPlans();
  }

  // Stripe integration methods (legacy)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createPaymentIntent(_amount: number, _currency = 'ngn') {
    // This would be part of the checkout flow now
    throw new Error('Use createCheckoutSession for new payments');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async confirmPayment(_paymentIntentId: string) {
    // This would be handled by Stripe checkout
    throw new Error('Payment confirmation is handled by Stripe checkout');
  }

  async updatePaymentMethod(paymentMethodId: string) {
    return this.setDefaultPaymentMethod(paymentMethodId);
  }
}

export const paymentService = new PaymentService();
export type { PaymentMethod, Payment, PaymentSummary, PaginatedPayments };
