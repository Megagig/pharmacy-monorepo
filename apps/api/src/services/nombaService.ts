import crypto from 'crypto';
import axios from 'axios';
import { config } from 'dotenv';

config();

interface NombaPaymentData {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  callbackUrl: string;
  metadata?: Record<string, any>;
}

interface NombaPaymentResponse {
  success: boolean;
  data?: {
    reference: string;
    checkoutUrl: string;
    accessCode: string;
  };
  message?: string;
}

interface NombaVerifyResponse {
  success: boolean;
  data?: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    customerEmail: string;
    paidAt?: string;
    metadata?: Record<string, any>;
  };
  message?: string;
}

interface NombaCustomerData {
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, any>;
}

interface NombaCustomerResponse {
  success: boolean;
  data?: {
    customerId: string;
    email: string;
    name: string;
  };
  message?: string;
}

interface NombaSubscriptionData {
  customerId: string;
  planCode: string;
  amount: number;
  currency: string;
  startDate?: Date;
  metadata?: Record<string, any>;
}

interface NombaSubscriptionResponse {
  success: boolean;
  data?: {
    subscriptionId: string;
    subscriptionCode: string;
    status: string;
    nextPaymentDate: string;
  };
  message?: string;
}

class NombaService {
  private clientId: string;
  private privateKey: string;
  private accountId: string;
  private baseURL: string = 'https://api.nomba.com/v1';
  private isConfigured: boolean = false;

  constructor() {
    this.clientId = process.env.NOMBA_CLIENT_ID || '';
    this.privateKey = process.env.NOMBA_PRIVATE_KEY || '';
    this.accountId = process.env.NOMBA_ACCOUNT_ID || '';

    this.isConfigured = !!(this.clientId && this.privateKey && this.accountId);

    if (!this.isConfigured) {
      console.warn('Nomba API credentials are not properly configured. Payment functionality will be limited.');
    }
  }

  isNombaConfigured(): boolean {
    return this.isConfigured;
  }

  private generateSignature(payload: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', this.privateKey)
      .update(message)
      .digest('hex');
  }

  private getHeaders(payload?: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.clientId}`,
      'X-Nomba-Account-ID': this.accountId,
      'X-Nomba-Timestamp': timestamp,
    };

    if (payload) {
      headers['X-Nomba-Signature'] = this.generateSignature(payload, timestamp);
    }

    return headers;
  }

  async initiatePayment(
    paymentData: NombaPaymentData
  ): Promise<NombaPaymentResponse> {
    try {
      const payload = {
        amount: paymentData.amount * 100, // Convert to kobo
        currency: paymentData.currency || 'NGN',
        customer: {
          email: paymentData.customerEmail,
          name: paymentData.customerName,
        },
        description: paymentData.description,
        callback_url: paymentData.callbackUrl,
        metadata: paymentData.metadata || {},
      };

      const payloadString = JSON.stringify(payload);
      const headers = this.getHeaders(payloadString);

      const response = await axios.post(
        `${this.baseURL}/checkout/initialize`,
        payload,
        { headers }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: {
            reference: response.data.data.reference,
            checkoutUrl: response.data.data.authorization_url,
            accessCode: response.data.data.access_code,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Payment initialization failed',
        };
      }
    } catch (error: any) {
      console.error(
        'Nomba payment initiation error:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Payment initialization failed',
      };
    }
  }

  /**
   * Create payment intent (alias for initiatePayment)
   */
  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    reference: string;
    transactionId: string;
    paymentUrl?: string;
  }> {
    try {
      const paymentData: NombaPaymentData = {
        amount: data.amount,
        currency: data.currency || 'NGN',
        description: data.description || 'Payment',
        customerEmail: data.metadata?.email || 'customer@example.com',
        customerName: data.metadata?.name || 'Customer',
        callbackUrl: process.env.NOMBA_CALLBACK_URL || `${process.env.API_BASE_URL}/api/payments/callback`,
        metadata: data.metadata,
      };

      const result = await this.initiatePayment(paymentData);

      if (result.success && result.data) {
        return {
          reference: result.data.reference,
          transactionId: result.data.reference,
          paymentUrl: result.data.checkoutUrl,
        };
      } else {
        throw new Error(result.message || 'Payment creation failed');
      }
    } catch (error: any) {
      console.error('Create payment intent error:', error.message);
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<NombaVerifyResponse> {
    try {
      const headers = this.getHeaders();

      const response = await axios.get(
        `${this.baseURL}/checkout/verify/${reference}`,
        { headers }
      );

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          success: true,
          data: {
            reference: data.reference,
            amount: data.amount / 100, // Convert from kobo
            currency: data.currency,
            status: data.status,
            customerEmail: data.customer.email,
            paidAt: data.paid_at,
            metadata: data.metadata,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Payment verification failed',
        };
      }
    } catch (error: any) {
      console.error(
        'Nomba payment verification error:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Payment verification failed',
      };
    }
  }

  async refundPayment(
    reference: string,
    amount?: number
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const payload = {
        transaction: reference,
        amount: amount ? amount * 100 : undefined, // Convert to kobo if specified
      };

      const payloadString = JSON.stringify(payload);
      const headers = this.getHeaders(payloadString);

      const response = await axios.post(`${this.baseURL}/refund`, payload, {
        headers,
      });

      return {
        success: response.data.status === 'success',
        message: response.data.message,
      };
    } catch (error: any) {
      console.error(
        'Nomba refund error:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Refund failed',
      };
    }
  }

  /**
   * Create a customer in Nomba for subscription management
   */
  async createCustomer(customerData: NombaCustomerData): Promise<NombaCustomerResponse> {
    try {
      const payload = {
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        metadata: customerData.metadata || {},
      };

      const payloadString = JSON.stringify(payload);
      const headers = this.getHeaders(payloadString);

      const response = await axios.post(
        `${this.baseURL}/customers`,
        payload,
        { headers }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: {
            customerId: response.data.data.customer_code,
            email: response.data.data.email,
            name: response.data.data.name,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Customer creation failed',
        };
      }
    } catch (error: any) {
      console.error('Nomba customer creation error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Customer creation failed',
      };
    }
  }

  /**
   * Create a subscription in Nomba
   */
  async createSubscription(subscriptionData: NombaSubscriptionData): Promise<NombaSubscriptionResponse> {
    try {
      const payload = {
        customer: subscriptionData.customerId,
        plan: subscriptionData.planCode,
        amount: subscriptionData.amount * 100, // Convert to kobo
        currency: subscriptionData.currency || 'NGN',
        start_date: subscriptionData.startDate?.toISOString(),
        metadata: subscriptionData.metadata || {},
      };

      const payloadString = JSON.stringify(payload);
      const headers = this.getHeaders(payloadString);

      const response = await axios.post(
        `${this.baseURL}/subscriptions`,
        payload,
        { headers }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: {
            subscriptionId: response.data.data.subscription_code,
            subscriptionCode: response.data.data.subscription_code,
            status: response.data.data.status,
            nextPaymentDate: response.data.data.next_payment_date,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Subscription creation failed',
        };
      }
    } catch (error: any) {
      console.error('Nomba subscription creation error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Subscription creation failed',
      };
    }
  }

  /**
   * Cancel a subscription in Nomba
   */
  async cancelSubscription(subscriptionCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = this.getHeaders();

      const response = await axios.post(
        `${this.baseURL}/subscriptions/${subscriptionCode}/cancel`,
        {},
        { headers }
      );

      return {
        success: response.data.status === 'success',
        message: response.data.message,
      };
    } catch (error: any) {
      console.error('Nomba subscription cancellation error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Subscription cancellation failed',
      };
    }
  }

  /**
   * Get subscription details from Nomba
   */
  async getSubscription(subscriptionCode: string): Promise<NombaSubscriptionResponse> {
    try {
      const headers = this.getHeaders();

      const response = await axios.get(
        `${this.baseURL}/subscriptions/${subscriptionCode}`,
        { headers }
      );

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          success: true,
          data: {
            subscriptionId: data.subscription_code,
            subscriptionCode: data.subscription_code,
            status: data.status,
            nextPaymentDate: data.next_payment_date,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to fetch subscription',
        };
      }
    } catch (error: any) {
      console.error('Nomba subscription fetch error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch subscription',
      };
    }
  }

  /**
   * Process a payment for an invoice
   */
  async processInvoicePayment(
    customerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<NombaPaymentResponse> {
    try {
      const payload = {
        customer: customerId,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        description,
        metadata: metadata || {},
      };

      const payloadString = JSON.stringify(payload);
      const headers = this.getHeaders(payloadString);

      const response = await axios.post(
        `${this.baseURL}/charges`,
        payload,
        { headers }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: {
            reference: response.data.data.reference,
            checkoutUrl: response.data.data.authorization_url,
            accessCode: response.data.data.access_code,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Payment processing failed',
        };
      }
    } catch (error: any) {
      console.error('Nomba invoice payment error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Payment processing failed',
      };
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, timestamp);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

export const nombaService = new NombaService();
export default NombaService;
