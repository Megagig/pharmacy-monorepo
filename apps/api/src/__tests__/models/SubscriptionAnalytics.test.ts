import mongoose from 'mongoose';
import { SubscriptionAnalytics, ISubscriptionAnalytics } from '../../models/SubscriptionAnalytics';

describe('SubscriptionAnalytics Model', () => {

  describe('Model Validation', () => {
    it('should create a valid SubscriptionAnalytics document', async () => {
      const planId = new mongoose.Types.ObjectId();
      
      const validAnalytics = {
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 5.5,
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [
          {
            planId,
            planName: 'Basic',
            count: 50,
            percentage: 50,
            revenue: 5000,
          },
          {
            planId: new mongoose.Types.ObjectId(),
            planName: 'Premium',
            count: 50,
            percentage: 50,
            revenue: 10000,
          },
        ],
        revenueByPlan: [
          {
            planId,
            planName: 'Basic',
            revenue: 5000,
            subscriptionCount: 50,
            averageRevenuePerUser: 100,
          },
        ],
        churnAnalytics: {
          totalChurned: 10,
          churnRate: 5.5,
          churnByPlan: [
            {
              planId,
              planName: 'Basic',
              churnedCount: 5,
              churnRate: 10,
            },
          ],
          churnReasons: [
            {
              reason: 'Price too high',
              count: 5,
              percentage: 50,
            },
            {
              reason: 'Feature limitations',
              count: 3,
              percentage: 30,
            },
          ],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 95,
        grossRevenueRetention: 90,
      };

      const analytics = new SubscriptionAnalytics(validAnalytics);
      const savedAnalytics = await analytics.save();

      expect(savedAnalytics._id).toBeDefined();
      expect(savedAnalytics.mrr).toBe(10000);
      expect(savedAnalytics.planDistribution).toHaveLength(2);
      expect(savedAnalytics.churnAnalytics.totalChurned).toBe(10);
      expect(savedAnalytics.createdAt).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const incompleteAnalytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: 10000,
        // Missing required fields
      });

      await expect(incompleteAnalytics.save()).rejects.toThrow();
    });

    it('should validate numeric constraints', async () => {
      const invalidAnalytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: -1000, // Invalid negative value
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 5.5,
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [],
        revenueByPlan: [],
        churnAnalytics: {
          totalChurned: 10,
          churnRate: 5.5,
          churnByPlan: [],
          churnReasons: [],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 95,
        grossRevenueRetention: 90,
      });

      await expect(invalidAnalytics.save()).rejects.toThrow();
    });

    it('should validate percentage constraints', async () => {
      const invalidAnalytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 150, // Invalid percentage > 100
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [],
        revenueByPlan: [],
        churnAnalytics: {
          totalChurned: 10,
          churnRate: 5.5,
          churnByPlan: [],
          churnReasons: [],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 95,
        grossRevenueRetention: 90,
      });

      await expect(invalidAnalytics.save()).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for time-series queries', async () => {
      const indexes = await SubscriptionAnalytics.collection.getIndexes();
      
      expect(indexes).toHaveProperty('date_-1');
      expect(indexes).toHaveProperty('createdAt_-1');
    });
  });

  describe('Methods', () => {
    let analytics: ISubscriptionAnalytics;

    beforeEach(async () => {
      analytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 5.5,
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [],
        revenueByPlan: [],
        churnAnalytics: {
          totalChurned: 10,
          churnRate: 5.5,
          churnByPlan: [],
          churnReasons: [],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 110,
        grossRevenueRetention: 95,
      });
      await analytics.save();
    });

    it('should calculate growth rate correctly', () => {
      const previousMrr = 8000;
      const growthRate = analytics.calculateGrowthRate(previousMrr);
      expect(growthRate).toBe(25); // ((10000 - 8000) / 8000) * 100
    });

    it('should handle zero previous MRR for growth rate', () => {
      const growthRate = analytics.calculateGrowthRate(0);
      expect(growthRate).toBe(0);
    });

    it('should calculate LTV to CAC ratio correctly', () => {
      const ltvCacRatio = analytics.calculateLtvToCacRatio();
      expect(ltvCacRatio).toBe(10); // 5000 / 500
    });

    it('should handle zero CAC for LTV to CAC ratio', async () => {
      analytics.cac = 0;
      const ltvCacRatio = analytics.calculateLtvToCacRatio();
      expect(ltvCacRatio).toBe(0);
    });

    it('should calculate health score correctly', () => {
      const healthScore = analytics.getHealthScore();
      expect(healthScore).toBeGreaterThan(0);
      expect(healthScore).toBeLessThanOrEqual(100);
    });

    it('should exclude __v field in JSON output', () => {
      const jsonOutput = analytics.toJSON();
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('mrr');
    });
  });

  describe('Nested Schema Validation', () => {
    it('should validate plan distribution structure', async () => {
      const analytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 5.5,
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [
          {
            planId: new mongoose.Types.ObjectId(),
            planName: 'Basic',
            count: -5, // Invalid negative count
            percentage: 50,
            revenue: 5000,
          },
        ],
        revenueByPlan: [],
        churnAnalytics: {
          totalChurned: 10,
          churnRate: 5.5,
          churnByPlan: [],
          churnReasons: [],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 95,
        grossRevenueRetention: 90,
      });

      await expect(analytics.save()).rejects.toThrow();
    });

    it('should validate churn analytics structure', async () => {
      const analytics = new SubscriptionAnalytics({
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 500,
        churnRate: 5.5,
        upgradeRate: 15.2,
        downgradeRate: 3.1,
        planDistribution: [],
        revenueByPlan: [],
        churnAnalytics: {
          totalChurned: -5, // Invalid negative value
          churnRate: 5.5,
          churnByPlan: [],
          churnReasons: [],
        },
        totalSubscriptions: 100,
        activeSubscriptions: 90,
        trialSubscriptions: 20,
        canceledSubscriptions: 10,
        newSubscriptions: 15,
        renewedSubscriptions: 75,
        averageSubscriptionValue: 100,
        netRevenueRetention: 95,
        grossRevenueRetention: 90,
      });

      await expect(analytics.save()).rejects.toThrow();
    });
  });

  describe('TTL Index', () => {
    it('should have TTL index configuration', async () => {
      // Check that the schema has TTL index configuration
      const schema = SubscriptionAnalytics.schema;
      const indexes = schema.indexes();
      
      // Look for TTL index configuration
      const ttlIndexConfig = indexes.find((index: any) => 
        index[1] && index[1].expireAfterSeconds !== undefined
      );
      
      expect(ttlIndexConfig).toBeDefined();
      expect(ttlIndexConfig[1].expireAfterSeconds).toBe(63072000); // 2 years in seconds
    });
  });
});