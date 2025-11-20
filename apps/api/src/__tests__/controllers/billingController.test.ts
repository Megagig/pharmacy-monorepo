import { Request, Response } from 'express';
import { BillingController } from '../../controllers/billingController';
import { billingService } from '../../services/BillingService';
import { nombaService } from '../../services/nombaService';
import Payment from '../../models/Payment';
import BillingInvoice from '../../models/BillingInvoice';

// Mock dependencies
jest.mock('../../services/BillingService');
jest.mock('../../services/nombaService');
jest.mock('../../models/Payment');
jest.mock('../../models/BillingInvoice');

const mockedBillingService = billingService as jest.Mocked<typeof billingService>;
const mockedNombaService = nombaService as jest.Mocked<typeof nombaService>;
const MockedPayment = Payment as jest.Mocked<typeof Payment>;
const MockedBillingInvoice = BillingInvoice as jest.Mocked<typeof BillingInvoice>;

describe('BillingController', () => {
  let billingController: BillingController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    billingController = new BillingController();

    mockRequest = {
      user: {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        workplaceId: 'workspace123'
      },
      body: {},
      query: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    beforeEach(() => {
      mockRequest.body = {
        planId: 'plan123',
        billingInterval: 'monthly',
        trialDays: 14
      };
    });

    it('should create subscription successfully', async () => {
      const mockSubscription = {
        _id: 'sub123',
        workspaceId: 'workspace123',
        planId: 'plan123',
        status: 'trialing'
      };

      mockedBillingService.createSubscription.mockResolvedValue(mockSubscription as any);

      await billingController.createSubscription(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.createSubscription).toHaveBeenCalledWith({
        workspaceId: 'workspace123',
        planId: 'plan123',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        billingInterval: 'monthly',
        trialDays: 14,
        metadata: {
          userId: 'user123',
          createdBy: 'test@example.com'
        }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription,
        message: 'Subscription created successfully'
      });
    });

    it('should return error if user has no workplace', async () => {
      mockRequest.user!.workplaceId = undefined;

      await billingController.createSubscription(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User must be associated with a workspace'
      });
    });

    it('should handle service errors', async () => {
      mockedBillingService.createSubscription.mockRejectedValue(new Error('Plan not found'));

      await billingController.createSubscription(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Plan not found'
      });
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return current subscription', async () => {
      const mockSubscription = {
        _id: 'sub123',
        workspaceId: 'workspace123',
        status: 'active'
      };

      mockedBillingService.getSubscriptionByWorkspace.mockResolvedValue(mockSubscription as any);

      await billingController.getCurrentSubscription(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.getSubscriptionByWorkspace).toHaveBeenCalledWith('workspace123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription
      });
    });

    it('should return error if user has no workplace', async () => {
      mockRequest.user!.workplaceId = undefined;

      await billingController.getCurrentSubscription(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User must be associated with a workspace'
      });
    });
  });

  describe('updateSubscription', () => {
    beforeEach(() => {
      mockRequest.body = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate'
      };
    });

    it('should update subscription successfully', async () => {
      const mockUpdatedSubscription = {
        _id: 'sub123',
        planId: 'plan456',
        status: 'active'
      };

      mockedBillingService.updateSubscription.mockResolvedValue(mockUpdatedSubscription as any);

      await billingController.updateSubscription(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate'
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedSubscription,
        message: 'Subscription updated successfully'
      });
    });

    it('should handle service errors', async () => {
      mockedBillingService.updateSubscription.mockRejectedValue(new Error('Subscription not found'));

      await billingController.updateSubscription(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Subscription not found'
      });
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      mockRequest.body = {
        subscriptionId: 'sub123',
        cancelAtPeriodEnd: true,
        reason: 'User request'
      };
    });

    it('should cancel subscription successfully', async () => {
      const mockCanceledSubscription = {
        _id: 'sub123',
        status: 'active',
        cancelAtPeriodEnd: true
      };

      mockedBillingService.cancelSubscription.mockResolvedValue(mockCanceledSubscription as any);

      await billingController.cancelSubscription(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.cancelSubscription).toHaveBeenCalledWith(
        'sub123',
        true,
        'User request'
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCanceledSubscription,
        message: 'Subscription canceled successfully'
      });
    });
  });

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      mockRequest.body = {
        invoiceId: 'inv123'
      };
    });

    it('should create checkout session with Nomba', async () => {
      const mockInvoice = {
        _id: 'inv123',
        total: 5000,
        currency: 'NGN',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        invoiceNumber: 'INV-2024-001'
      };

      const mockPaymentResponse = {
        success: true,
        data: {
          reference: 'PAY_123456',
          checkoutUrl: 'https://checkout.nomba.com/pay/123456',
          accessCode: 'ACCESS_123456'
        }
      };

      MockedBillingInvoice.findById.mockResolvedValue(mockInvoice as any);
      mockedNombaService.isNombaConfigured.mockReturnValue(true);
      mockedNombaService.initiatePayment.mockResolvedValue(mockPaymentResponse);
      MockedPayment.create.mockResolvedValue({} as any);

      await billingController.createCheckoutSession(mockRequest as any, mockResponse as Response);

      expect(MockedBillingInvoice.findById).toHaveBeenCalledWith('inv123');
      expect(mockedNombaService.initiatePayment).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'NGN',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        description: 'Payment for invoice INV-2024-001',
        callbackUrl: `${process.env.FRONTEND_URL}/billing/payment-success`,
        metadata: {
          invoiceId: 'inv123',
          subscriptionId: undefined,
          userId: 'user123'
        }
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          checkoutUrl: 'https://checkout.nomba.com/pay/123456',
          reference: 'PAY_123456'
        }
      });
    });

    it('should handle development mode when Nomba not configured', async () => {
      const mockInvoice = {
        _id: 'inv123',
        total: 5000,
        currency: 'NGN',
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        invoiceNumber: 'INV-2024-001'
      };

      MockedBillingInvoice.findById.mockResolvedValue(mockInvoice as any);
      mockedNombaService.isNombaConfigured.mockReturnValue(false);
      MockedPayment.create.mockResolvedValue({} as any);

      await billingController.createCheckoutSession(mockRequest as any, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Development mode: Mock payment initiated'
        })
      );
    });

    it('should return error if invoice not found', async () => {
      MockedBillingInvoice.findById.mockResolvedValue(null);

      await billingController.createCheckoutSession(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invoice not found'
      });
    });
  });

  describe('handlePaymentSuccess', () => {
    beforeEach(() => {
      mockRequest.body = {
        paymentReference: 'PAY_123456'
      };
    });

    it('should handle payment success', async () => {
      const mockPaymentRecord = {
        _id: 'payment123',
        paymentReference: 'PAY_123456',
        status: 'pending',
        metadata: { invoiceId: 'inv123' },
        save: jest.fn().mockResolvedValue(true)
      };

      const mockInvoice = {
        _id: 'inv123',
        status: 'open',
        total: 5000,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockVerificationResult = {
        success: true,
        data: {
          status: 'success',
          reference: 'PAY_123456',
          amount: 5000,
          currency: 'NGN',
          customerEmail: 'test@example.com'
        }
      };

      MockedPayment.findOne.mockResolvedValue(mockPaymentRecord as any);
      MockedBillingInvoice.findById.mockResolvedValue(mockInvoice as any);
      mockedNombaService.isNombaConfigured.mockReturnValue(true);
      mockedNombaService.verifyPayment.mockResolvedValue(mockVerificationResult);

      await billingController.handlePaymentSuccess(mockRequest as any, mockResponse as Response);

      expect(MockedPayment.findOne).toHaveBeenCalledWith({ paymentReference: 'PAY_123456' });
      expect(mockedNombaService.verifyPayment).toHaveBeenCalledWith('PAY_123456');
      expect(mockPaymentRecord.status).toBe('completed');
      expect(mockInvoice.status).toBe('paid');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment processed successfully'
      });
    });

    it('should handle mock payments in development', async () => {
      mockRequest.body.paymentReference = 'mock_123456';

      const mockPaymentRecord = {
        _id: 'payment123',
        paymentReference: 'mock_123456',
        status: 'pending',
        metadata: { invoiceId: 'inv123' },
        save: jest.fn().mockResolvedValue(true)
      };

      const mockInvoice = {
        _id: 'inv123',
        status: 'open',
        total: 5000,
        save: jest.fn().mockResolvedValue(true)
      };

      MockedPayment.findOne.mockResolvedValue(mockPaymentRecord as any);
      MockedBillingInvoice.findById.mockResolvedValue(mockInvoice as any);

      await billingController.handlePaymentSuccess(mockRequest as any, mockResponse as Response);

      expect(mockPaymentRecord.status).toBe('completed');
      expect(mockInvoice.status).toBe('paid');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment processed successfully'
      });
    });

    it('should return error if payment reference is missing', async () => {
      mockRequest.body = {};

      await billingController.handlePaymentSuccess(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment reference is required'
      });
    });

    it('should return error if payment record not found', async () => {
      MockedPayment.findOne.mockResolvedValue(null);

      await billingController.handlePaymentSuccess(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment record not found'
      });
    });
  });

  describe('getBillingAnalytics', () => {
    beforeEach(() => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };
    });

    it('should return billing analytics', async () => {
      const mockAnalytics = {
        totalRevenue: 100000,
        monthlyRecurringRevenue: 8333,
        annualRecurringRevenue: 100000,
        churnRate: 5.2,
        averageRevenuePerUser: 416.65,
        lifetimeValue: 2000,
        subscriptionsByStatus: { active: 20, trialing: 5 },
        revenueByPlan: [
          { planName: 'Basic', revenue: 30000, count: 10 },
          { planName: 'Pro', revenue: 70000, count: 10 }
        ]
      };

      mockedBillingService.getBillingAnalytics.mockResolvedValue(mockAnalytics);

      await billingController.getBillingAnalytics(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.getBillingAnalytics).toHaveBeenCalledWith({
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    it('should handle analytics without date range', async () => {
      mockRequest.query = {};

      const mockAnalytics = {
        totalRevenue: 100000,
        monthlyRecurringRevenue: 8333,
        annualRecurringRevenue: 100000,
        churnRate: 5.2,
        averageRevenuePerUser: 416.65,
        lifetimeValue: 2000,
        subscriptionsByStatus: { active: 20, trialing: 5 },
        revenueByPlan: []
      };

      mockedBillingService.getBillingAnalytics.mockResolvedValue(mockAnalytics);

      await billingController.getBillingAnalytics(mockRequest as any, mockResponse as Response);

      expect(mockedBillingService.getBillingAnalytics).toHaveBeenCalledWith(undefined);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });
  });
});