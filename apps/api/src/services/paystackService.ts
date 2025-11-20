import crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { config } from 'dotenv';

// Load environment variables immediately to ensure they're available
config();

interface PaystackResponse<T = any> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

interface PaystackTransaction {
  email: string;
  amount: number; // Amount in kobo (NGN * 100)
  currency?: string;
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: string[];
  split_code?: string;
  subaccount?: string;
  transaction_charge?: number;
  bearer?: 'account' | 'subaccount';
  plan?: string;
  quantity?: number;
  invoice_limit?: number;
  customer?: string;
}

interface PaystackVerificationData {
  id: number;
  domain: string;
  status: string;
  reference: string;
  amount: number;
  message: string | null;
  gateway_response: string;
  paid_at: string;
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string;
  metadata: Record<string, any>;
  log: any;
  fees: number;
  fees_split: any;
  authorization: {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    channel: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    reusable: boolean;
    signature: string;
    account_name: string | null;
  };
  customer: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    customer_code: string;
    phone: string | null;
    metadata: Record<string, any>;
    risk_action: string;
    international_format_phone: string | null;
  };
  plan: any;
  order_id: string | null;
  paidAt: string;
  createdAt: string;
  requested_amount: number;
  pos_transaction_data: any;
  source: any;
  fees_breakdown: any;
}

interface ServiceResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
}

class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
    this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || '';

    // Add better logging to debug environment variable issues
    console.log('Paystack Service initialized with: ', {
      secretKeyExists: !!this.secretKey,
      publicKeyExists: !!this.publicKey,
      webhookSecretExists: !!this.webhookSecret,
      secretKeyFirstChars: this.secretKey
        ? this.secretKey.substring(0, 5) + '...'
        : 'none',
      publicKeyFirstChars: this.publicKey
        ? this.publicKey.substring(0, 5) + '...'
        : 'none',
    });

    if (!this.secretKey) {
      console.warn('Paystack secret key not found in environment variables');
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Check if Paystack is properly configured
   */
  public isConfigured(): boolean {
    return Boolean(this.secretKey && this.publicKey);
  }

  /**
   * Create a customer on Paystack
   */
  async createCustomer(
    customerData: PaystackCustomer
  ): Promise<ServiceResponse> {
    try {
      const response: AxiosResponse<PaystackResponse> = await axios.post(
        `${this.baseUrl}/customer`,
        customerData,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error(
        'Error creating Paystack customer:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create customer',
        error: error.message,
      };
    }
  }

  /**
   * Initialize a transaction
   */
  async initializeTransaction(
    transactionData: PaystackTransaction
  ): Promise<ServiceResponse> {
    try {
      // Log configuration status
      console.log('Paystack configuration status:', {
        isConfigured: this.isConfigured(),
        hasSecretKey: !!this.secretKey,
        hasPublicKey: !!this.publicKey,
      });

      // Generate reference if not provided
      if (!transactionData.reference) {
        transactionData.reference = `ps_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;
      }

      // More detailed logging before making the API call
      console.log('Initializing Paystack transaction with:', {
        email: transactionData.email,
        amount: transactionData.amount,
        callback_url: transactionData.callback_url,
        reference: transactionData.reference,
      });

      const response: AxiosResponse<PaystackResponse> = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        transactionData,
        { headers: this.getHeaders() }
      );

      if (response.data.status) {
        return {
          success: true,
          message: response.data.message,
          data: {
            authorization_url: response.data.data.authorization_url,
            access_code: response.data.data.access_code,
            reference: response.data.data.reference,
          },
        };
      } else {
        return {
          success: false,
          message: response.data.message,
        };
      }
    } catch (error: any) {
      console.error('Error initializing Paystack transaction:', {
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack,
      });

      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to initialize transaction',
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Verify a transaction
   */
  async verifyTransaction(
    reference: string
  ): Promise<ServiceResponse<PaystackVerificationData>> {
    try {
      const response: AxiosResponse<
        PaystackResponse<PaystackVerificationData>
      > = await axios.get(`${this.baseUrl}/transaction/verify/${reference}`, {
        headers: this.getHeaders(),
      });

      return {
        success: response.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error(
        'Error verifying Paystack transaction:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to verify transaction',
        error: error.message,
      };
    }
  }

  /**
   * List transactions
   */
  async listTransactions(params?: {
    perPage?: number;
    page?: number;
    customer?: string;
    status?: string;
    from?: string;
    to?: string;
    amount?: number;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }

      const response: AxiosResponse<PaystackResponse> = await axios.get(
        `${this.baseUrl}/transaction?${queryParams.toString()}`,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error(
        'Error listing Paystack transactions:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to list transactions',
        error: error.message,
      };
    }
  }

  /**
   * Create a plan (for recurring payments)
   */
  async createPlan(planData: {
    name: string;
    amount: number; // Amount in kobo
    interval: 'monthly' | 'quarterly' | 'biannually' | 'annually';
    description?: string;
    currency?: string;
    invoice_limit?: number;
    send_invoices?: boolean;
    send_sms?: boolean;
  }): Promise<ServiceResponse> {
    try {
      const response: AxiosResponse<PaystackResponse> = await axios.post(
        `${this.baseUrl}/plan`,
        {
          ...planData,
          currency: planData.currency || 'NGN',
        },
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error(
        'Error creating Paystack plan:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create plan',
        error: error.message,
      };
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(subscriptionData: {
    customer: string;
    plan: string;
    authorization?: string;
    start_date?: string;
  }): Promise<ServiceResponse> {
    try {
      const response: AxiosResponse<PaystackResponse> = await axios.post(
        `${this.baseUrl}/subscription`,
        subscriptionData,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error(
        'Error creating Paystack subscription:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to create subscription',
        error: error.message,
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.error('Paystack webhook secret not configured');
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Error verifying Paystack webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: any): Promise<ServiceResponse> {
    try {
      const { event: eventType, data } = event;

      console.log(`Processing Paystack webhook event: ${eventType}`);

      switch (eventType) {
        case 'charge.success':
          return await this.handleChargeSuccess(data);
        case 'charge.failed':
          return await this.handleChargeFailed(data);
        case 'subscription.create':
          return await this.handleSubscriptionCreate(data);
        case 'subscription.disable':
          return await this.handleSubscriptionDisable(data);
        case 'invoice.create':
          return await this.handleInvoiceCreate(data);
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(data);
        default:
          console.log(`Unhandled Paystack webhook event: ${eventType}`);
          return {
            success: true,
            message: `Event ${eventType} received but not handled`,
          };
      }
    } catch (error: any) {
      console.error('Error handling Paystack webhook event:', error);
      return {
        success: false,
        message: 'Failed to handle webhook event',
        error: error.message,
      };
    }
  }

  private async handleChargeSuccess(data: any): Promise<ServiceResponse> {
    console.log('Charge successful:', data.reference);
    // This will be handled by the subscription controller
    return { success: true, message: 'Charge success event processed' };
  }

  private async handleChargeFailed(data: any): Promise<ServiceResponse> {
    console.log('Charge failed:', data.reference);
    // This will be handled by the subscription controller
    return { success: true, message: 'Charge failed event processed' };
  }

  private async handleSubscriptionCreate(data: any): Promise<ServiceResponse> {
    console.log('Subscription created:', data);
    return { success: true, message: 'Subscription create event processed' };
  }

  private async handleSubscriptionDisable(data: any): Promise<ServiceResponse> {
    console.log('Subscription disabled:', data);
    return { success: true, message: 'Subscription disable event processed' };
  }

  private async handleInvoiceCreate(data: any): Promise<ServiceResponse> {
    console.log('Invoice created:', data);
    return { success: true, message: 'Invoice create event processed' };
  }

  private async handleInvoicePaymentFailed(
    data: any
  ): Promise<ServiceResponse> {
    console.log('Invoice payment failed:', data);
    return { success: true, message: 'Invoice payment failed event processed' };
  }

  /**
   * Get public key for frontend
   */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Convert amount from NGN to kobo (Paystack uses kobo)
   */
  static convertToKobo(amountInNGN: number): number {
    return Math.round(amountInNGN * 100);
  }

  /**
   * Convert amount from kobo to NGN
   */
  static convertFromKobo(amountInKobo: number): number {
    return amountInKobo / 100;
  }
}

export const paystackService = new PaystackService();
export { PaystackService };
