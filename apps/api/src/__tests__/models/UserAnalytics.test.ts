import { UserAnalytics, IUserAnalytics } from '../../models/UserAnalytics';

describe('UserAnalytics Model', () => {

  describe('Model Validation', () => {
    it('should create a valid UserAnalytics document', async () => {
      const validAnalytics = {
        date: new Date(),
        registrationTrend: [
          { date: new Date('2024-01-01'), value: 10 },
          { date: new Date('2024-01-02'), value: 15 },
        ],
        activationRate: 85.5,
        churnRate: 5.2,
        usersByRole: [
          { role: 'pharmacist', count: 50, percentage: 50 },
          { role: 'pharmacy_team', count: 30, percentage: 30 },
          { role: 'owner', count: 20, percentage: 20 },
        ],
        usersBySubscription: [
          { planName: 'Basic', count: 40, percentage: 40 },
          { planName: 'Premium', count: 60, percentage: 60 },
        ],
        geographicDistribution: [
          { country: 'Nigeria', state: 'Lagos', city: 'Lagos', count: 80, percentage: 80 },
          { country: 'Nigeria', state: 'Abuja', count: 20, percentage: 20 },
        ],
        totalRegistrations: 100,
        activeUsers: 85,
        inactiveUsers: 10,
        suspendedUsers: 5,
        averageSessionDuration: 1800, // 30 minutes
        dailyActiveUsers: 70,
        weeklyActiveUsers: 85,
        monthlyActiveUsers: 95,
      };

      const analytics = new UserAnalytics(validAnalytics);
      const savedAnalytics = await analytics.save();

      expect(savedAnalytics._id).toBeDefined();
      expect(savedAnalytics.activationRate).toBe(85.5);
      expect(savedAnalytics.registrationTrend).toHaveLength(2);
      expect(savedAnalytics.usersByRole).toHaveLength(3);
      expect(savedAnalytics.createdAt).toBeDefined();
    });

    it('should require all mandatory fields', async () => {
      const incompleteAnalytics = new UserAnalytics({
        date: new Date(),
        activationRate: 85.5,
        // Missing required fields
      });

      await expect(incompleteAnalytics.save()).rejects.toThrow();
    });

    it('should validate percentage constraints', async () => {
      const invalidAnalytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [],
        activationRate: 150, // Invalid percentage > 100
        churnRate: 5.2,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 85,
        inactiveUsers: 10,
        suspendedUsers: 5,
        averageSessionDuration: 1800,
        dailyActiveUsers: 70,
        weeklyActiveUsers: 85,
        monthlyActiveUsers: 95,
      });

      await expect(invalidAnalytics.save()).rejects.toThrow();
    });

    it('should validate negative values', async () => {
      const invalidAnalytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [],
        activationRate: 85.5,
        churnRate: 5.2,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: -10, // Invalid negative value
        activeUsers: 85,
        inactiveUsers: 10,
        suspendedUsers: 5,
        averageSessionDuration: 1800,
        dailyActiveUsers: 70,
        weeklyActiveUsers: 85,
        monthlyActiveUsers: 95,
      });

      await expect(invalidAnalytics.save()).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for time-series queries', async () => {
      const indexes = await UserAnalytics.collection.getIndexes();
      
      expect(indexes).toHaveProperty('date_-1');
      expect(indexes).toHaveProperty('createdAt_-1');
    });
  });

  describe('Methods', () => {
    let analytics: IUserAnalytics;

    beforeEach(async () => {
      analytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [],
        activationRate: 85.5,
        churnRate: 5.2,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 70,
        inactiveUsers: 20,
        suspendedUsers: 10,
        averageSessionDuration: 1800,
        dailyActiveUsers: 60,
        weeklyActiveUsers: 75,
        monthlyActiveUsers: 85,
      });
      await analytics.save();
    });

    it('should calculate total users correctly', () => {
      const totalUsers = analytics.calculateTotalUsers();
      expect(totalUsers).toBe(100); // 70 + 20 + 10
    });

    it('should calculate engagement rate correctly', () => {
      const engagementRate = analytics.getEngagementRate();
      expect(engagementRate).toBe(70); // (70 / 100) * 100
    });

    it('should handle zero total users for engagement rate', async () => {
      const emptyAnalytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [],
        activationRate: 0,
        churnRate: 0,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        suspendedUsers: 0,
        averageSessionDuration: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
      });

      const engagementRate = emptyAnalytics.getEngagementRate();
      expect(engagementRate).toBe(0);
    });

    it('should exclude __v field in JSON output', () => {
      const jsonOutput = analytics.toJSON();
      expect(jsonOutput).not.toHaveProperty('__v');
      expect(jsonOutput).toHaveProperty('_id');
      expect(jsonOutput).toHaveProperty('activationRate');
    });
  });

  describe('Nested Schema Validation', () => {
    it('should validate time series data structure', async () => {
      const analytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [
          { date: new Date(), value: -5 }, // Invalid negative value
        ],
        activationRate: 85.5,
        churnRate: 5.2,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 85,
        inactiveUsers: 10,
        suspendedUsers: 5,
        averageSessionDuration: 1800,
        dailyActiveUsers: 70,
        weeklyActiveUsers: 85,
        monthlyActiveUsers: 95,
      });

      await expect(analytics.save()).rejects.toThrow();
    });

    it('should validate role distribution percentages', async () => {
      const analytics = new UserAnalytics({
        date: new Date(),
        registrationTrend: [],
        activationRate: 85.5,
        churnRate: 5.2,
        usersByRole: [
          { role: 'pharmacist', count: 50, percentage: 150 }, // Invalid percentage > 100
        ],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 85,
        inactiveUsers: 10,
        suspendedUsers: 5,
        averageSessionDuration: 1800,
        dailyActiveUsers: 70,
        weeklyActiveUsers: 85,
        monthlyActiveUsers: 95,
      });

      await expect(analytics.save()).rejects.toThrow();
    });
  });

  describe('TTL Index', () => {
    it('should have TTL index configuration', async () => {
      // Check that the schema has TTL index configuration
      const schema = UserAnalytics.schema;
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