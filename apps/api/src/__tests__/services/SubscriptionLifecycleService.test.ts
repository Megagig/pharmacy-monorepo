import { SubscriptionLifecycleService } from '../../services/SubscriptionLifecycleService';
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

describe('SubscriptionLifecycleService', () => {
  let lifecycleService: SubscriptionLifecycleService;

  beforeEach(() => {
    lifecycleService = new SubscriptionLifecycleService();
    jest.clearAllMocks();
  });

  describe('upgradeSubscription', () => {
    const mockSubscription = {
      _id: 'sub123',
      planId: 'plan123',
      unitAmount: 3000,
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      canUpgrade: jest.fn().mockReturnValue(true),
      calculateProration: jest.fn().mockReturnValue(2000),
      save: jest.fn().mockResolvedValue(true),
      metadata: {}
    };

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

    beforeEach(() => {
      MockedBillingSubscription.findById.mockResolvedValue(mockSubscription as any);
      MockedSubscriptionPlan.findById
        .mockResolvedValueOnce(mockNewPlan as any)
        .mockResolvedValueOnce(mockCurrentPlan as any);
    });

    it('should upgrade subscription immediately with proration', async () => {
      const upgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      const result = await lifecycleService.upgradeSubscription(upgradeOptions);

      expect(MockedBillingSubscription.findById).toHaveBeenCalledWith('sub123');
      expect(mockSubscription.canUpgrade).toHaveBeenCalled();
      expect(mockSubscription.planId).toBe('plan456');
      expect(mockSubscription.unitAmount).toBe(5000);
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should schedule upgrade for next cycle', async () => {
      const upgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'next_cycle' as const
      };

      const result = await lifecycleService.upgradeSubscription(upgradeOptions);

      expect(mockSubscription.pendingUpdate).toEqual({
        planId: 'plan456',
        effectiveDate: mockSubscription.currentPeriodEnd,
        prorationAmount: 0
      });
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      MockedBillingSubscription.findById.mockResolvedValue(null);

      const upgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      await expect(lifecycleService.upgradeSubscription(upgradeOptions))
        .rejects.toThrow('Subscription not found');
    });

    it('should throw error if subscription cannot be upgraded', async () => {
      mockSubscription.canUpgrade.mockReturnValue(false);

      const upgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      await expect(lifecycleService.upgradeSubscription(upgradeOptions))
        .rejects.toThrow('Subscription cannot be upgraded in current state');
    });

    it('should throw error if new plan price is not higher', async () => {
      const lowerPricePlan = { ...mockNewPlan, priceNGN: 2000 };
      MockedSubscriptionPlan.findById
        .mockResolvedValueOnce(lowerPricePlan as any)
        .mockResolvedValueOnce(mockCurrentPlan as any);

      const upgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan456',
        prorationBehavior: 'immediate' as const
      };

      await expect(lifecycleService.upgradeSubscription(upgradeOptions))
        .rejects.toThrow('New plan price must be higher than current plan for upgrade');
    });
  });

  describe('downgradeSubscription', () => {
    const mockSubscription = {
      _id: 'sub123',
      planId: 'plan456',
      unitAmount: 5000,
      currentPeriodEnd: new Date('2024-02-01'),
      canDowngrade: jest.fn().mockReturnValue(true),
      save: jest.fn().mockResolvedValue(true),
      metadata: {}
    };

    const mockCurrentPlan = {
      _id: 'plan456',
      name: 'Pro Plan',
      priceNGN: 5000
    };

    const mockNewPlan = {
      _id: 'plan123',
      name: 'Basic Plan',
      priceNGN: 3000
    };

    beforeEach(() => {
      MockedBillingSubscription.findById.mockResolvedValue(mockSubscription as any);
      MockedSubscriptionPlan.findById
        .mockResolvedValueOnce(mockNewPlan as any)
        .mockResolvedValueOnce(mockCurrentPlan as any);
    });

    it('should downgrade subscription immediately', async () => {
      const downgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan123',
        applyImmediately: true
      };

      const result = await lifecycleService.downgradeSubscription(downgradeOptions);

      expect(mockSubscription.canDowngrade).toHaveBeenCalled();
      expect(mockSubscription.planId).toBe('plan123');
      expect(mockSubscription.unitAmount).toBe(3000);
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should schedule downgrade for next cycle', async () => {
      const downgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan123',
        applyImmediately: false
      };

      const result = await lifecycleService.downgradeSubscription(downgradeOptions);

      expect(mockSubscription.pendingUpdate).toEqual({
        planId: 'plan123',
        effectiveDate: mockSubscription.currentPeriodEnd,
        prorationAmount: 0
      });
      expect(mockSubscription.save).toHaveBeenCalled();
    });

    it('should throw error if new plan price is not lower', async () => {
      const higherPricePlan = { ...mockNewPlan, priceNGN: 6000 };
      MockedSubscriptionPlan.findById
        .mockResolvedValueOnce(higherPricePlan as any)
        .mockResolvedValueOnce(mockCurrentPlan as any);

      const downgradeOptions = {
        subscriptionId: 'sub123',
        newPlanId: 'plan123',
        applyImmediately: true
      };

      await expect(lifecycleService.downgradeSubscription(downgradeOptions))
        .rejects.toThrow('New plan price must be lower than current plan for downgrade');
    });
  });

  describe('processBillingCycles', () => {
    beforeEach(() => {
      MockedBillingSubscription.find = jest.fn();
      MockedBillingSubscription.updateMany = jest.fn();
    });

    it('should process billing cycles successfully', async () => {
      const mockSubscriptions = [
        {
          _id: 'sub1',
          status: 'active',
          currentPeriodEnd: new Date('2024-01-01'),
          cancelAtPeriodEnd: false,
          save: jest.fn().mockResolvedValue(true)
        },
        {
          _id: 'sub2',
          status: 'active',
          currentPeriodEnd: new Date('2024-01-01'),
          cancelAtPeriodEnd: false,
          save: jest.fn().mockResolvedValue(true)
        }
      ];

      (MockedBillingSubscription.find as jest.Mock).mockResolvedValue(mockSubscriptions);
      
      // Mock the private method calls
      const processSubscriptionRenewalSpy = jest.spyOn(lifecycleService as any, 'processSubscriptionRenewal')
        .mockResolvedValue(undefined);
      const processPendingPlanChangesSpy = jest.spyOn(lifecycleService as any, 'processPendingPlanChanges')
        .mockResolvedValue(undefined);
      const processTrialExpirationsSpy = jest.spyOn(lifecycleService as any, 'processTrialExpirations')
        .mockResolvedValue(undefined);

      const result = await lifecycleService.processBillingCycles();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(processSubscriptionRenewalSpy).toHaveBeenCalledTimes(2);
      expect(processPendingPlanChangesSpy).toHaveBeenCalled();
      expect(processTrialExpirationsSpy).toHaveBeenCalled();
    });

    it('should handle renewal failures', async () => {
      const mockSubscriptions = [
        {
          _id: 'sub1',
          status: 'active',
          currentPeriodEnd: new Date('2024-01-01'),
          cancelAtPeriodEnd: false,
          save: jest.fn().mockResolvedValue(true)
        }
      ];

      (MockedBillingSubscription.find as jest.Mock).mockResolvedValue(mockSubscriptions);
      
      const processSubscriptionRenewalSpy = jest.spyOn(lifecycleService as any, 'processSubscriptionRenewal')
        .mockRejectedValue(new Error('Payment failed'));

      const result = await lifecycleService.processBillingCycles();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        subscriptionId: 'sub1',
        error: 'Payment failed'
      });
      expect(mockSubscriptions[0].status).toBe('past_due');
    });
  });

  describe('updateSubscriptionStatuses', () => {
    beforeEach(() => {
      MockedBillingSubscription.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    });

    it('should update expired trials', async () => {
      await lifecycleService.updateSubscriptionStatuses();

      expect(MockedBillingSubscription.updateMany).toHaveBeenCalledWith(
        {
          status: 'trialing',
          trialEnd: { $lte: expect.any(Date) }
        },
        {
          status: 'active'
        }
      );
    });

    it('should update expired subscriptions', async () => {
      await lifecycleService.updateSubscriptionStatuses();

      expect(MockedBillingSubscription.updateMany).toHaveBeenCalledWith(
        {
          status: 'active',
          currentPeriodEnd: { $lte: expect.any(Date) },
          cancelAtPeriodEnd: true
        },
        {
          status: 'canceled',
          canceledAt: expect.any(Date)
        }
      );
    });

    it('should update past due subscriptions that exceeded grace period', async () => {
      await lifecycleService.updateSubscriptionStatuses();

      expect(MockedBillingSubscription.updateMany).toHaveBeenCalledWith(
        {
          status: 'past_due',
          lastDunningAttempt: { $lte: expect.any(Date) },
          pastDueNotificationsSent: { $gte: 5 }
        },
        {
          status: 'canceled',
          canceledAt: expect.any(Date),
          cancelationReason: 'Payment failure after multiple attempts'
        }
      );
    });
  });

  describe('calculateProrationAmount', () => {
    const mockSubscription = {
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      unitAmount: 3000
    };

    it('should calculate proration correctly for mid-period upgrade', () => {
      const effectiveDate = new Date('2024-01-16'); // Halfway through period
      const newPlanAmount = 5000;

      const prorationAmount = lifecycleService.calculateProrationAmount(
        mockSubscription as any,
        newPlanAmount,
        effectiveDate
      );

      // Should be roughly half the difference between plans
      expect(prorationAmount).toBeCloseTo(1000, 0); // (5000 - 3000) * 0.5
    });

    it('should return 0 for proration at end of period', () => {
      const effectiveDate = new Date('2024-02-01'); // End of period
      const newPlanAmount = 5000;

      const prorationAmount = lifecycleService.calculateProrationAmount(
        mockSubscription as any,
        newPlanAmount,
        effectiveDate
      );

      expect(prorationAmount).toBe(0);
    });

    it('should handle negative proration for downgrades', () => {
      const effectiveDate = new Date('2024-01-16'); // Halfway through period
      const newPlanAmount = 1000; // Lower than current

      const prorationAmount = lifecycleService.calculateProrationAmount(
        mockSubscription as any,
        newPlanAmount,
        effectiveDate
      );

      expect(prorationAmount).toBeLessThan(0);
    });
  });
});