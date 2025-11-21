import crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { config } from 'dotenv';

// Load environment variables immediately to ensure they're available
config();

interface NombaResponse<T = any> {
  code: string;
  description: string;
  data: T;
}

interface NombaCheckoutOrder {
  orderReference: string;
  customerId: string;
  callbackUrl: string;
  customerEmail: string;
  amount: string;
  currency: string;
  accountId: string;
}

interface NombaCheckoutResponse {
  checkoutLink: string;
  orderReference: string;
  orderId: string;
}

interface NombaTransactionVerification {
  orderId: string;
  orderReference: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  customerEmail: string;
  accountId: string;
  transactionId?: string;
  cardType?: string;
  cardLast4Digits?: string;
  paidAt?: string;
}

interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant: {
      walletId: string;
      walletBalance: number;
      userId: string;
    };
    transaction: {
      fee: number;
      type: string;
      transactionId: string;
      cardIssuer?: string;
      responseCode: string;
      originatingFrom: string;
      merchantTxRef: string;
      transactionAmount: number;
      time: string;
    };
    order: {
      amount: number;
      orderId: string;
      cardType?: string;
      accountId: string;
      cardLast4Digits?: string;
      cardCurrency: string;
      customerEmail: string;
      customerId: string;
      isTokenizedCardPayment: string;
      orderReference: string;
      paymentMethod: string;
      callbackUrl: string;
      currency: string;
    };
    tokenizedCardData?: {
      tokenKey: string;
      cardType: string;
      tokenExpiryYear: string;
      tokenExpiryMonth: string;
      cardPan: string;
    };
  };
}

interface ServiceResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
}

class NombaService {
  private readonly baseUrl = 'https://api.nomba.com/v1';
  private readonly clientId: string;
  private readonly privateKey: string;
  private readonly accountId: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.clientId = process.env.NOMBA_CLIENT_ID || '';
    this.privateKey = process.env.NOMBA_PRIVATE_KEY || '';
    this.accountId = process.env.NOMBA_ACCOUNT_ID || '';

    // Add better logging to debug environment variable issues
    console.log('Nomba Service initialized with: ', {
      clientIdExists: !!this.clientId,
      privateKeyExists: !!this.privateKey,
      accountIdExists: !!this.accountId,
      clientIdFirstChars: this.clientId
        ? this.clientId.substring(0, 8) + '...'
        : 'none',
      accountIdFirstChars: this.accountId
        ? this.accountId.substring(0, 8) + '...'
        : 'none',
    });

    if (!this.clientId || !this.privateKey || !this.accountId) {
      console.warn('Nomba credentials not found in environment variables');
    }
  }

  /**
   * Get access token for API authentication
   * Tokens are cached and reused until they expire
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/token/issue`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.privateKey,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'accountId': this.accountId,
          },
        }
      );

      // Nomba returns a nested structure: { data: { data: { access_token: ... } } }
      const tokenData = response.data?.data;

      if (tokenData && tokenData.access_token) {
        this.accessToken = tokenData.access_token;

        // Use expiresAt if provided, otherwise default to 1 hour
        if (tokenData.expiresAt) {
          this.tokenExpiry = new Date(tokenData.expiresAt);
        } else {
          const expiresIn = tokenData.expires_in || 3600;
          this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
        }

        console.log('Nomba access token obtained successfully');
        return this.accessToken;
      } else {
        console.error('Nomba authentication response:', {
          status: response.status,
          data: response.data,
          hasAccessToken: !!tokenData?.access_token,
          dataKeys: response.data ? Object.keys(response.data) : []
        });
        throw new Error('Invalid token response from Nomba');
      }
    } catch (error: any) {
      console.error('Error obtaining Nomba access token:', {
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
      });
      throw new Error('Failed to authenticate with Nomba API');
    }
  }

  /**
   * Get headers for API requests
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      accountId: this.accountId,
    };
  }

  /**
   * Check if Nomba is properly configured
   */
  public isConfigured(): boolean {
    return Boolean(this.clientId && this.privateKey && this.accountId);
  }

  /**
   * Create a checkout order
   */
  async createCheckoutOrder(
    orderData: NombaCheckoutOrder
  ): Promise<ServiceResponse<NombaCheckoutResponse>> {
    try {
      // Log configuration status
      console.log('Nomba configuration status:', {
        isConfigured: this.isConfigured(),
        hasClientId: !!this.clientId,
        hasPrivateKey: !!this.privateKey,
        hasAccountId: !!this.accountId,
      });

      // More detailed logging before making the API call
      console.log('Creating Nomba checkout order with:', {
        email: orderData.customerEmail,
        amount: orderData.amount,
        currency: orderData.currency,
        callbackUrl: orderData.callbackUrl,
        orderReference: orderData.orderReference,
      });

      const headers = await this.getHeaders();
      const response: AxiosResponse<NombaResponse<NombaCheckoutResponse>> =
        await axios.post(
          `${this.baseUrl}/checkout/order`,
          {
            order: orderData,
          },
          { headers }
        );

      if (response.data && response.data.data) {
        return {
          success: true,
          message: response.data.description || 'Checkout order created successfully',
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          message: response.data?.description || 'Failed to create checkout order',
        };
      }
    } catch (error: any) {
      console.error('Error creating Nomba checkout order:', {
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack,
      });

      return {
        success: false,
        message:
          error.response?.data?.description || 'Failed to create checkout order',
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Verify a transaction by order reference
   */
  async verifyTransaction(
    orderReference: string
  ): Promise<ServiceResponse<NombaTransactionVerification>> {
    try {
      const headers = await this.getHeaders();
      const response: AxiosResponse<
        NombaResponse<NombaTransactionVerification>
      > = await axios.get(
        `${this.baseUrl}/checkout/order/${orderReference}`,
        { headers }
      );

      if (response.data && response.data.data) {
        return {
          success: true,
          message: response.data.description || 'Transaction verified successfully',
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          message: response.data?.description || 'Failed to verify transaction',
        };
      }
    } catch (error: any) {
      console.error('Error verifying Nomba transaction:', {
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
      });

      return {
        success: false,
        message:
          error.response?.data?.description || 'Failed to verify transaction',
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Verify webhook signature
   * Nomba uses HMAC SHA-512 for webhook signature validation
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.privateKey) {
      console.error('Nomba private key not configured for webhook verification');
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha512', this.privateKey)
        .update(payload, 'utf8')
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Error verifying Nomba webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: NombaWebhookPayload): Promise<ServiceResponse> {
    try {
      const { event_type, data } = event;

      console.log(`Processing Nomba webhook event: ${event_type}`);

      switch (event_type) {
        case 'payment_success':
          return await this.handlePaymentSuccess(data);
        case 'payment_failed':
          return await this.handlePaymentFailed(data);
        default:
          console.log(`Unhandled Nomba webhook event: ${event_type}`);
          return {
            success: true,
            message: `Event ${event_type} received but not handled`,
          };
      }
    } catch (error: any) {
      console.error('Error handling Nomba webhook event:', error);
      return {
        success: false,
        message: 'Failed to handle webhook event',
        error: error.message,
      };
    }
  }

  private async handlePaymentSuccess(data: NombaWebhookPayload['data']): Promise<ServiceResponse> {
    console.log('Payment successful:', data.order.orderReference);
    // This will be handled by the subscription controller
    return {
      success: true,
      message: 'Payment success event processed',
      data: {
        orderReference: data.order.orderReference,
        amount: data.order.amount,
        status: 'success',
      }
    };
  }

  private async handlePaymentFailed(data: NombaWebhookPayload['data']): Promise<ServiceResponse> {
    console.log('Payment failed:', data.order.orderReference);
    // This will be handled by the subscription controller
    return {
      success: true,
      message: 'Payment failed event processed',
      data: {
        orderReference: data.order.orderReference,
        amount: data.order.amount,
        status: 'failed',
      }
    };
  }

  /**
   * Get account ID for frontend or other services
   */
  getAccountId(): string {
    return this.accountId;
  }

  /**
   * Convert amount to Nomba format (string with 2 decimal places)
   */
  static formatAmount(amountInNGN: number): string {
    return amountInNGN.toFixed(2);
  }

  /**
   * Parse amount from Nomba format to number
   */
  static parseAmount(amountString: string): number {
    return parseFloat(amountString);
  }
}

export const nombaService = new NombaService();
export { NombaService };
