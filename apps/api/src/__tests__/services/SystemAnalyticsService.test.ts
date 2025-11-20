import { SystemAnalyticsService } from '../../services/SystemAnalyticsService';
import { SystemMetrics } from '../../models/SystemMetrics';
import { UserAnalytics } from '../../models/UserAnalytics';
import { SubscriptionAnalytics } from '../../models/SubscriptionAnalytics';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';
import { Subscription } from '../../models/Subscription';
import { FeatureFlag } from '../../models/FeatureFlag';
import { License } from '../../models/License';
import { RedisCacheService } from '../../services/RedisCacheService';
import { BackgroundJobService } from '../../services/BackgroundJobService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../models/SystemMetrics');
jest.mock('../../models/UserAnalytics');
jest.mock('../../models/SubscriptionAnalytics');
jest.mock('../../models/User');
jest.mock('../../models/Workplace');
jest.mock('../../models/Subscription');
jest.mock('../../models/FeatureFlag');
jest.mock('../../models/License');
jest.mock('../../services/RedisCacheService');
jest.mock('../../services/BackgroundJobService');
jest.mock('../../utils/logger');

describe('SystemAnalyticsService', () => {
  let service: SystemAnalyticsService;
  let mockCacheService: jest.Mocked<RedisCacheService>;
  let mockBackgroundJobService: jest.Mocked<BackgroundJobService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      ping: jest.fn(),
    } as any;

    // Mock BackgroundJobService
    mockBackgroundJobService = {
      addJob: jest.fn(),
    } as any;

    // Mock static getInstance methods
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    (BackgroundJobService.getInstance as jest.Mock).mockReturnValue(mockBackgroundJobService);

    service = SystemAnalyticsService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SystemAnalyticsService.getInstance();
      const instance2 = SystemAnalyticsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return cached metrics if available', async () => {
      const cachedMetrics = {
        totalUsers: 100,
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 10000,
        systemUptime: '5d 10h 30m',
        activeFeatureFlags: 15,
        pendingLicenses: 3,
        supportTickets: { open: 5, resolved: 20, critical: 1 },
        systemHealth: {
          database: { status: 'healthy', responseTime: 50, connections: 1 },
          api: { status: 'healthy', responseTime: 100, requestsPerMinute: 100 },
          memory: { status: 'healthy', usage: 1000000, available: 2000000 },
          cache: { status: 'healthy', hitRate: 85, connections: 1 }
        }
      };

      mockCacheService.get.mockResolvedValue(cachedMetrics);

      const result = await service.getSystemMetrics();

      expect(mockCacheService.get).toHaveBeenCalledWith('system:metrics');
      expect(result).toEqual(cachedMetrics);
    });

    it('should calculate and cache metrics if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock database queries
      (User.countDocuments as jest.Mock)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80)  // activeUsers
        .mockResolvedValueOnce(5);  // newUsersToday

      (Workplace.countDocuments as jest.Mock).mockResolvedValue(25);
      (Subscription.countDocuments as jest.Mock).mockResolvedValue(50);
      (Subscription.aggregate as jest.Mock).mockResolvedValue([{ totalRevenue: 10000 }]);
      (FeatureFlag.countDocuments as jest.Mock).mockResolvedValue(15);
      (License.countDocuments as jest.Mock).mockResolvedValue(3);

      // Mock SystemMetrics constructor and save
      const mockMetrics = {
        save: jest.fn().mockResolvedValue(true),
        totalUsers: 100,
        activeUsers: 80,
        newUsersToday: 5,
        activeSubscriptions: 50,
        totalWorkspaces: 25,
        monthlyRevenue: 10000,
        systemUptime: expect.any(String),
        activeFeatureFlags: 15,
        pendingLicenses: 3,
        supportTickets: { open: 0, resolved: 0, critical: 0 },
        systemHealth: expect.any(Object)
      };

      (SystemMetrics as any).mockImplementation(() => mockMetrics);

      // Mock mongoose connection for health check
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockResolvedValue(true)
          })
        },
        readyState: 1
      };
      (mongoose.connection as any) = mockConnection;

      mockCacheService.ping.mockResolvedValue(true);

      const result = await service.getSystemMetrics();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'system:metrics',
        mockMetrics,
        5 * 60 * 1000
      );
      expect(result).toEqual(mockMetrics);
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getSystemMetrics()).rejects.toThrow('Failed to retrieve system metrics');
    });
  });

  describe('getUserAnalytics', () => {
    it('should return cached analytics if available', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const cachedAnalytics = {
        date: new Date(),
        registrationTrend: [],
        activationRate: 85,
        churnRate: 5,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 80,
        inactiveUsers: 20,
        suspendedUsers: 0,
        averageSessionDuration: 45,
        dailyActiveUsers: 30,
        weeklyActiveUsers: 60,
        monthlyActiveUsers: 80
      };

      mockCacheService.get.mockResolvedValue(cachedAnalytics);

      const result = await service.getUserAnalytics(timeRange);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        `user:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`
      );
      expect(result).toEqual(cachedAnalytics);
    });

    it('should calculate and cache analytics if not in cache', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockCacheService.get.mockResolvedValue(null);

      // Mock User queries
      (User.countDocuments as jest.Mock)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80); // activeUsers

      // Mock UserAnalytics constructor and save
      const mockAnalytics = {
        save: jest.fn().mockResolvedValue(true),
        date: expect.any(Date),
        registrationTrend: [],
        activationRate: 85,
        churnRate: 5,
        usersByRole: [],
        usersBySubscription: [],
        geographicDistribution: [],
        totalRegistrations: 100,
        activeUsers: 80,
        inactiveUsers: 0,
        suspendedUsers: 0,
        averageSessionDuration: 45,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 80
      };

      (UserAnalytics as any).mockImplementation(() => mockAnalytics);

      const result = await service.getUserAnalytics(timeRange);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `user:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`,
        mockAnalytics,
        60 * 60 * 1000
      );
      expect(result).toEqual(mockAnalytics);
    });

    it('should handle errors gracefully', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getUserAnalytics(timeRange)).rejects.toThrow('Failed to retrieve user analytics');
    });
  });

  describe('getSubscriptionAnalytics', () => {
    it('should return cached analytics if available', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const cachedAnalytics = {
        date: new Date(),
        mrr: 10000,
        arr: 120000,
        ltv: 5000,
        cac: 100,
        churnRate: 5,
        upgradeRate: 10,
        downgradeRate: 2,
        totalRevenue: 50000,
        revenueGrowth: 15,
        averageRevenuePerUser: 200,
        newSubscriptions: 20,
        canceledSubscriptions: 5,
        churnedSubscriptions: 3,
        planDistribution: [],
        revenueByPlan: []
      };

      mockCacheService.get.mockResolvedValue(cachedAnalytics);

      const result = await service.getSubscriptionAnalytics(timeRange);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        `subscription:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`
      );
      expect(result).toEqual(cachedAnalytics);
    });

    it('should calculate and cache analytics if not in cache', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockCacheService.get.mockResolvedValue(null);

      // Mock Subscription queries
      (Subscription.aggregate as jest.Mock).mockResolvedValue([{ totalRevenue: 10000 }]);

      // Mock SubscriptionAnalytics constructor and save
      const mockAnalytics = {
        save: jest.fn().mockResolvedValue(true),
        date: expect.any(Date),
        mrr: 10000,
        arr: 0,
        ltv: 0,
        cac: 0,
        churnRate: 5,
        upgradeRate: 10,
        downgradeRate: 2,
        totalRevenue: 0,
        revenueGrowth: 15,
        averageRevenuePerUser: 0,
        newSubscriptions: 0,
        canceledSubscriptions: 0,
        churnedSubscriptions: 0,
        planDistribution: [],
        revenueByPlan: []
      };

      (SubscriptionAnalytics as any).mockImplementation(() => mockAnalytics);

      const result = await service.getSubscriptionAnalytics(timeRange);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `subscription:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`,
        mockAnalytics,
        60 * 60 * 1000
      );
      expect(result).toEqual(mockAnalytics);
    });

    it('should handle errors gracefully', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getSubscriptionAnalytics(timeRange)).rejects.toThrow('Failed to retrieve subscription analytics');
    });
  });

  describe('getSystemHealth', () => {
    it('should return cached health if available', async () => {
      const cachedHealth = {
        database: { status: 'healthy', responseTime: 50, connections: 1 },
        api: { status: 'healthy', responseTime: 100, requestsPerMinute: 100 },
        memory: { status: 'healthy', usage: 1000000, available: 2000000 },
        cache: { status: 'healthy', hitRate: 85, connections: 1 }
      };

      mockCacheService.get.mockResolvedValue(cachedHealth);

      const result = await service.getSystemHealth();

      expect(mockCacheService.get).toHaveBeenCalledWith('system:health');
      expect(result).toEqual(cachedHealth);
    });

    it('should calculate and cache health if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock mongoose connection for health check
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockResolvedValue(true)
          })
        },
        readyState: 1
      };
      (mongoose.connection as any) = mockConnection;

      mockCacheService.ping.mockResolvedValue(true);

      const result = await service.getSystemHealth();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'system:health',
        result,
        60 * 1000
      );
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('api');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('cache');
    });

    it('should handle database connection errors', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock failed database connection
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockRejectedValue(new Error('Connection failed'))
          })
        },
        readyState: 0
      };
      (mongoose.connection as any) = mockConnection;

      mockCacheService.ping.mockResolvedValue(true);

      const result = await service.getSystemHealth();

      expect(result.database.status).toBe('critical');
      expect(result.database.responseTime).toBe(-1);
      expect(result.database.connections).toBe(0);
    });

    it('should handle cache connection errors', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock mongoose connection
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockResolvedValue(true)
          })
        },
        readyState: 1
      };
      (mongoose.connection as any) = mockConnection;

      mockCacheService.ping.mockRejectedValue(new Error('Cache connection failed'));

      const result = await service.getSystemHealth();

      expect(result.cache.status).toBe('critical');
      expect(result.cache.hitRate).toBe(0);
      expect(result.cache.connections).toBe(0);
    });
  });

  describe('getRevenueMetrics', () => {
    it('should return revenue metrics from subscription analytics', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const mockSubscriptionAnalytics = {
        mrr: 10000,
        arr: 120000,
        totalRevenue: 50000,
        revenueGrowth: 15,
        averageRevenuePerUser: 200
      };

      // Mock the getSubscriptionAnalytics method
      jest.spyOn(service, 'getSubscriptionAnalytics').mockResolvedValue(mockSubscriptionAnalytics as any);

      const result = await service.getRevenueMetrics(timeRange);

      expect(result).toEqual({
        mrr: 10000,
        arr: 120000,
        totalRevenue: 50000,
        revenueGrowth: 15,
        averageRevenuePerUser: 200
      });
    });

    it('should handle errors gracefully', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      jest.spyOn(service, 'getSubscriptionAnalytics').mockRejectedValue(new Error('Analytics error'));

      await expect(service.getRevenueMetrics(timeRange)).rejects.toThrow('Failed to retrieve revenue metrics');
    });
  });

  describe('getChurnAnalytics', () => {
    it('should return churn analytics from subscription analytics', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const mockSubscriptionAnalytics = {
        churnRate: 5,
        churnedSubscriptions: 3,
        ltv: 5000
      };

      jest.spyOn(service, 'getSubscriptionAnalytics').mockResolvedValue(mockSubscriptionAnalytics as any);

      const result = await service.getChurnAnalytics(timeRange);

      expect(result).toEqual({
        churnRate: 5,
        churnedUsers: 3,
        retentionRate: 95,
        lifetimeValue: 5000
      });
    });

    it('should handle errors gracefully', async () => {
      const timeRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      jest.spyOn(service, 'getSubscriptionAnalytics').mockRejectedValue(new Error('Analytics error'));

      await expect(service.getChurnAnalytics(timeRange)).rejects.toThrow('Failed to retrieve churn analytics');
    });
  });

  describe('getRecentActivities', () => {
    it('should return cached activities if available', async () => {
      const cachedActivities = [
        {
          id: '1',
          type: 'user_registration',
          description: 'New user registered',
          timestamp: new Date(),
          userId: 'user1'
        }
      ];

      mockCacheService.get.mockResolvedValue(cachedActivities);

      const result = await service.getRecentActivities(10);

      expect(mockCacheService.get).toHaveBeenCalledWith('system:activities:10');
      expect(result).toEqual(cachedActivities);
    });

    it('should fetch and cache activities if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.getRecentActivities(10);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'system:activities:10',
        [],
        2 * 60 * 1000
      );
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getRecentActivities(10)).rejects.toThrow('Failed to retrieve recent activities');
    });
  });

  describe('scheduleMetricsAggregation', () => {
    it('should schedule background job for metrics aggregation', async () => {
      mockBackgroundJobService.addJob.mockResolvedValue(undefined);

      await service.scheduleMetricsAggregation();

      expect(mockBackgroundJobService.addJob).toHaveBeenCalledWith(
        'metrics-aggregation',
        {
          type: 'system-metrics',
          timestamp: expect.any(Date)
        },
        {
          repeat: { cron: '*/5 * * * *' },
          removeOnComplete: 10,
          removeOnFail: 5
        }
      );
    });

    it('should handle errors gracefully', async () => {
      mockBackgroundJobService.addJob.mockRejectedValue(new Error('Job scheduling error'));

      await expect(service.scheduleMetricsAggregation()).rejects.toThrow('Failed to schedule metrics aggregation');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached metrics', async () => {
      mockCacheService.del.mockResolvedValue(1);
      mockCacheService.delPattern.mockResolvedValue(1);

      await service.clearCache();

      expect(mockCacheService.del).toHaveBeenCalledWith('system:metrics');
      expect(mockCacheService.del).toHaveBeenCalledWith('system:health');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('user:analytics:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('subscription:analytics:*');
      expect(mockCacheService.delPattern).toHaveBeenCalledWith('system:activities:*');
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.del.mockRejectedValue(new Error('Cache error'));

      await expect(service.clearCache()).rejects.toThrow('Failed to clear analytics cache');
    });
  });
});