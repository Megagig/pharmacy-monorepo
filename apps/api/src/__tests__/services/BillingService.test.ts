import { BillingService } from '../../services/BillingService';
import BillingSubscription from '../../models/BillingSubscription';
import BillingInvoice from '../../models/BillingInvoice';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import { nombaService } from '../../services/nombaService';

// Mock dependencies
jest.mock('../../models/BillingSubscription');
jest.mock('../../models/BillingInvoice');
jest.mock('../../models/SubscriptionPlan');
jest.mock('../../services/nombaService');

const MockedBillingSubscription = BillingSubscription as jest.Mocked<typeof BillingSubscription>;
const MockedBillingInvoice = BillingInvoice as jest.Mocked<typeof BillingInvoice>;
const MockedSubscriptionPlan = SubscriptionPlan as jest.Mocked<typeof SubscriptionPlan>;
const mockedNombaService = nombaService as jest.Mocked<typeof nombaService>;

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    billingService = new BillingService();
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockPlan = {
      _id: 'plan123',
      name: 'Pro Plan',
      priceNGN: 5000,
      tier: 'pro'
    };

    const createSubscriptionData = {
      workspaceId: 'workspace123',
      planId: 'plan123',
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      billingInterval: 'monthly' as const,
      trialDays: 14
    };

    beforeEach(() => {
      MockedSubscriptionPlan.findById.mockResolvedValue(mockPlan as any);
      MockedBillingSubscription.findOne.mockResolvedValue(null);
    });

    it('should create a subscription successfully', async () => {
      const mockSubscription = {
        _id: 'sub123',
        workspaceId: 'workspace123',
        planId: 'plan123',
        status: 'trialing',
        save: jest.fn().mockResolvedValue(true)
      };

      MockedBillingSubscription.prototype.save = jest.fn().mockResolvedValue(mockSubscription);
      (MockedBillingSubscription as any).mockImplementation(() => mockSubscription);

      const result = await billingService.createSubscription(createSubscriptionData);

      expect(MockedSubscriptionPlan.findById).toHaveBeenCalledWith('plan123');
      expect(MockedBillingSubscription.findOne).toHaveBeenCalledWith({
        workspaceId: 'workspace123',
        status: { $in: ['active', 'trialing'] }
      });
      expect(result).toBeDefined();
    });

    it('should throw error if plan not found', async () => {
      MockedSubscriptionPlan.findById.mockResolvedValue(null);

      await expect(billingService.createSubscription(createSubscriptionData))
        .rejects.toThrow('Subscription plan not found');
    });

    it('should throw error if workspace already has active subscription', async () => {
      const existingSubscription = { _id: 'existing123', status: 'active' };
      MockedBillingSubscription.findOne.mockResolvedValue(existingSubscription as any);

      await expect(billingService.createSubscription(createSubscriptionData))
        .rejects.toThrow('Workspace already has an active subscription');
    });

    it('should create subscription without trial when trialDays is not provided', async () => {
      const dataWithoutTrial = { ...createSubscriptionData };
      delete dataWithoutTrial.trialDays;

      const mockSubscription = {
        _id: 'sub123',
        status: 'active',
        save: jest.fn().mockResolvedValue(true)
      };

      MockedBillingSubscription.prototype.save = jest.fn().mockResolvedValue(mockSubscription);
      (MockedBillingSubscription as any).mockImplementation(() => mockSubscription);

      const result = await billingService.createSubscription(dataWithoutTrial);

      expect(result).toBeDefined();
    });
  });

  describe('updateSubscription', () => {
    const mockCurrentPlan = {
      _id: 'plan123',
      name: 'Basic Plan',
      priceNGN: 3000
    };

    const mockNewPlan = {
      _id: 'plan456',
      name: 'Pro Plan',
      priceNGN: 5000
    };

    const mockSubscription = {
      _id: 'sub123',
      planId: 'plan123',
      unitAmount: 3000,
      currentPeriodEnd: new Date('2024-12-31'),
      calculateProration: jest.fn().mockReturnValue(2000),
      save: jest.fn().mockResolvedValue(true)
    };

    beforeEach(() => {
      MockedBillingSubscription.findById.mockResolvedValue(mockSubscription as any);
      MockedSubscriptionPlan.findById
        .mockResolvedValueOnce(mockNewPlan as any)
        .mockResolvedValueOnce(mockCurrentPlan as any);
    });

    it('should update subscription immediately with proration', async () => {
      const updateData = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      const result = await billingService.updateSubscription(updateData);

      expect(MockedBillingSubscription.findById).toHaveBeenCalledWith('sub123');
      expect(MockedSubscriptionPlan.findById).toHaveBeenCalledWith('plan456');
      expect(mockSubscription.calculateProration).toHaveBeenCalledWith(5000);
      expect(mockSubscription.planId).toBe('plan456');
      expect(mockSubscription.unitAmount).toBe(5000);
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should schedule update for next cycle', async () => {
      const updateData = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'next_cycle' as const
      };

      const result = await billingService.updateSubscription(updateData);

      expect(mockSubscription.pendingUpdate).toEqual({
        planId: 'plan456',
        effectiveDate: mockSubscription.currentPeriodEnd,
        prorationAmount: 0
      });
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      MockedBillingSubscription.findById.mockResolvedValue(null);

      const updateData = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      await expect(billingService.updateSubscription(updateData))
        .rejects.toThrow('Subscription not found');
    });

    it('should throw error if new plan not found', async () => {
      MockedSubscriptionPlan.findById.mockResolvedValueOnce(null);

      const updateData = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      await expect(billingService.updateSubscription(updateData))
        .rejects.toThrow('New plan not found');
    });
  });

  describe('cancelSubscription', () => {
    const mockSubscription = {
      _id: 'sub123',
      status: 'active',
      save: jest.fn().mockResolvedValue(true)
    };

    beforeEach(() => {
      MockedBillingSubscription.findById.mockResolvedValue(mockSubscription as any);
    });

    it('should cancel subscription at period end', async () => {
      const result = await billingService.cancelSubscription('sub123', true, 'User request');

      expect(mockSubscription.cancelAtPeriodEnd).toBe(true);
      expect(mockSubscription.cancelationReason).toBe('User request');
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should cancel subscription immediately', async () => {
      const result = await billingService.cancelSubscription('sub123', false, 'Immediate cancellation');

      expect(mockSubscription.status).toBe('canceled');
      expect(mockSubscription.canceledAt).toBeInstanceOf(Date);
      expect(mockSubscription.cancelationReason).toBe('Immediate cancellation');
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      MockedBillingSubscription.findById.mockResolvedValue(null);

      await expect(billingService.cancelSubscription('sub123'))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('getBillingAnalytics', () => {
    beforeEach(() => {
      // Mock aggregate methods
      MockedBillingSubscription.aggregate = jest.fn();
      MockedBillingSubscription.find = jest.fn();
    });

    it('should calculate billing analytics correctly', async () => {
      const mockSubscriptionsByStatus = [
        { _id: 'active', count: 10 },
        { _id: 'trialing', count: 5 }
      ];

      const mockActiveSubscriptions = [
        { billingInterval: 'monthly', unitAmount: 3000 },
        { billingInterval: 'monthly', unitAmount: 5000 },
        { billingInterval: 'yearly', unitAmount: 36000 }
      ];

      const mockRevenueByPlan = [
        { planName: 'Basic', revenue: 30000, count: 10 },
        { planName: 'Pro', revenue: 50000, count: 10 }
      ];

      (MockedBillingSubscription.aggregate as jest.Mock)
        .mockResolvedValueOnce(mockSubscriptionsByStatus)
        .mockResolvedValueOnce(mockRevenueByPlan);

      (MockedBillingSubscription.find as jest.Mock)
        .mockResolvedValue(mockActiveSubscriptions);

      const result = await billingService.getBillingAnalytics();

      expect(result.monthlyRecurringRevenue).toBe(11000); // 3000 + 5000 + (36000/12)
      expect(result.annualRecurringRevenue).toBe(132000); // 11000 * 12
      expect(result.subscriptionsByStatus).toEqual({
        active: 10,
        trialing: 5
      });
      expect(result.revenueByPlan).toEqual(mockRevenueByPlan);
    });

    it('should handle empty data gracefully', async () => {
      (MockedBillingSubscription.aggregate as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (MockedBillingSubscription.find as jest.Mock)
        .mockResolvedValue([]);

      const result = await billingService.getBillingAnalytics();

      expect(result.monthlyRecurringRevenue).toBe(0);
      expect(result.annualRecurringRevenue).toBe(0);
      expect(result.averageRevenuePerUser).toBe(0);
    });
  });

  describe('getSubscriptionByWorkspace', () => {
    it('should return subscription for workspace', async () => {
      const mockSubscription = { _id: 'sub123', workspaceId: 'workspace123' };
      
      MockedBillingSubscription.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSubscription)
      });

      const result = await billingService.getSubscriptionByWorkspace('workspace123');

      expect(MockedBillingSubscription.findOne).toHaveBeenCalledWith({
        workspaceId: 'workspace123',
        status: { $in: ['active', 'trialing', 'past_due'] }
      });
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('getInvoicesByWorkspace', () => {
    it('should return invoices for workspace', async () => {
      const mockInvoices = [
        { _id: 'inv123', workspaceId: 'workspace123' },
        { _id: 'inv456', workspaceId: 'workspace123' }
      ];

      MockedBillingInvoice.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockInvoices)
          })
        })
      });

      const result = await billingService.getInvoicesByWorkspace('workspace123', 5);

      expect(MockedBillingInvoice.find).toHaveBeenCalledWith({ workspaceId: 'workspace123' });
      expect(result).toEqual(mockInvoices);
    });
  });
});