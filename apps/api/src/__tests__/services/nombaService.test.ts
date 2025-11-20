import axios from 'axios';
import { nombaService } from '../../services/nombaService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NombaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.NOMBA_CLIENT_ID = 'test_client_id';
    process.env.NOMBA_PRIVATE_KEY = 'test_private_key';
    process.env.NOMBA_ACCOUNT_ID = 'test_account_id';
  });

  describe('createCustomer', () => {
    const customerData = {
      email: 'test@example.com',
      name: 'Test User',
      phone: '+2348012345678',
      metadata: { userId: '123' }
    };

    it('should create customer successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            customer_code: 'CUS_123456',
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.createCustomer(customerData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        customerId: 'CUS_123456',
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.nomba.com/v1/customers',
        {
          email: 'test@example.com',
          name: 'Test User',
          phone: '+2348012345678',
          metadata: { userId: '123' }
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_client_id',
            'X-Nomba-Account-ID': 'test_account_id'
          })
        })
      );
    });

    it('should handle customer creation failure', async () => {
      const mockResponse = {
        data: {
          status: 'error',
          message: 'Customer already exists'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.createCustomer(customerData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Customer already exists');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockedAxios.post.mockRejectedValue(error);

      const result = await nombaService.createCustomer(customerData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Customer creation failed');
    });
  });

  describe('createSubscription', () => {
    const subscriptionData = {
      customerId: 'CUS_123456',
      planCode: 'PLAN_PRO',
      amount: 5000,
      currency: 'NGN',
      startDate: new Date('2024-01-01'),
      metadata: { workspaceId: 'workspace123' }
    };

    it('should create subscription successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            subscription_code: 'SUB_123456',
            status: 'active',
            next_payment_date: '2024-02-01T00:00:00Z'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.createSubscription(subscriptionData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        subscriptionId: 'SUB_123456',
        subscriptionCode: 'SUB_123456',
        status: 'active',
        nextPaymentDate: '2024-02-01T00:00:00Z'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.nomba.com/v1/subscriptions',
        {
          customer: 'CUS_123456',
          plan: 'PLAN_PRO',
          amount: 500000, // Converted to kobo
          currency: 'NGN',
          start_date: '2024-01-01T00:00:00.000Z',
          metadata: { workspaceId: 'workspace123' }
        },
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle subscription creation failure', async () => {
      const mockResponse = {
        data: {
          status: 'error',
          message: 'Invalid plan code'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.createSubscription(subscriptionData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid plan code');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          message: 'Subscription cancelled successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.cancelSubscription('SUB_123456');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Subscription cancelled successfully');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.nomba.com/v1/subscriptions/SUB_123456/cancel',
        {},
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle cancellation failure', async () => {
      const error = {
        response: {
          data: {
            message: 'Subscription not found'
          }
        }
      };

      mockedAxios.post.mockRejectedValue(error);

      const result = await nombaService.cancelSubscription('SUB_123456');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
    });
  });

  describe('getSubscription', () => {
    it('should get subscription successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            subscription_code: 'SUB_123456',
            status: 'active',
            next_payment_date: '2024-02-01T00:00:00Z'
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await nombaService.getSubscription('SUB_123456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        subscriptionId: 'SUB_123456',
        subscriptionCode: 'SUB_123456',
        status: 'active',
        nextPaymentDate: '2024-02-01T00:00:00Z'
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.nomba.com/v1/subscriptions/SUB_123456',
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle get subscription failure', async () => {
      const mockResponse = {
        data: {
          status: 'error',
          message: 'Subscription not found'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await nombaService.getSubscription('SUB_123456');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscription not found');
    });
  });

  describe('processInvoicePayment', () => {
    it('should process invoice payment successfully', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            reference: 'PAY_123456',
            authorization_url: 'https://checkout.nomba.com/pay/123456',
            access_code: 'ACCESS_123456'
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await nombaService.processInvoicePayment(
        'CUS_123456',
        5000,
        'Invoice payment',
        { invoiceId: 'INV_123' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        reference: 'PAY_123456',
        checkoutUrl: 'https://checkout.nomba.com/pay/123456',
        accessCode: 'ACCESS_123456'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.nomba.com/v1/charges',
        {
          customer: 'CUS_123456',
          amount: 500000, // Converted to kobo
          currency: 'NGN',
          description: 'Invoice payment',
          metadata: { invoiceId: 'INV_123' }
        },
        expect.objectContaining({
          headers: expect.any(Object)
        })
      );
    });

    it('should handle invoice payment failure', async () => {
      const error = {
        response: {
          data: {
            message: 'Insufficient funds'
          }
        }
      };

      mockedAxios.post.mockRejectedValue(error);

      const result = await nombaService.processInvoicePayment(
        'CUS_123456',
        5000,
        'Invoice payment'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Insufficient funds');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature correctly', () => {
      const payload = '{"event": "payment.success"}';
      const timestamp = '1640995200';
      
      // This would be the actual signature generated by Nomba
      const signature = nombaService['generateSignature'](payload, timestamp);

      const isValid = nombaService.verifyWebhookSignature(payload, signature, timestamp);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"event": "payment.success"}';
      const timestamp = '1640995200';
      const invalidSignature = 'invalid_signature';

      const isValid = nombaService.verifyWebhookSignature(payload, invalidSignature, timestamp);

      expect(isValid).toBe(false);
    });
  });

  describe('isNombaConfigured', () => {
    it('should return true when all credentials are configured', () => {
      const result = nombaService.isNombaConfigured();
      expect(result).toBe(true);
    });

    it('should return false when credentials are missing', () => {
      delete process.env.NOMBA_CLIENT_ID;
      
      // Create new instance to test configuration check
      const { nombaService: newNombaService } = require('../../services/nombaService');
      
      const result = newNombaService.isNombaConfigured();
      expect(result).toBe(false);
    });
  });
});