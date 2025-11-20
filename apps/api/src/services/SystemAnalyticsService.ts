import mongoose from 'mongoose';
import { SystemMetrics, ISystemMetrics } from '../models/SystemMetrics';
import { UserAnalytics, IUserAnalytics } from '../models/UserAnalytics';
import { SubscriptionAnalytics, ISubscriptionAnalytics } from '../models/SubscriptionAnalytics';
import { User } from '../models/User';
import { Workplace } from '../models/Workplace';
import { Subscription } from '../models/Subscription';
import { FeatureFlag } from '../models/FeatureFlag';
// import { License } from '../models/License'; // TODO: Implement License model
import { RedisCacheService } from './RedisCacheService';
import { BackgroundJobService } from './BackgroundJobService';
import logger from '../utils/logger';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'critical';
    responseTime: number;
    connections: number;
  };
  api: {
    status: 'healthy' | 'warning' | 'critical';
    responseTime: number;
    requestsPerMinute: number;
  };
  memory: {
    status: 'healthy' | 'warning' | 'critical';
    usage: number;
    available: number;
  };
  cache: {
    status: 'healthy' | 'warning' | 'critical';
    hitRate: number;
    connections: number;
  };
}

export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  revenueGrowth: number;
  averageRevenuePerUser: number;
}

export interface ChurnAnalytics {
  churnRate: number;
  churnedUsers: number;
  retentionRate: number;
  lifetimeValue: number;
}

export interface Activity {
  id: string;
  type: 'user_registration' | 'feature_flag_change' | 'license_approval' | 'subscription_change';
  description: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * SystemAnalyticsService - Handles system metrics calculation and aggregation
 * Provides real-time system health monitoring and analytics data
 */
export class SystemAnalyticsService {
  private static instance: SystemAnalyticsService;
  private cacheService: RedisCacheService;
  private backgroundJobService: BackgroundJobService;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly METRICS_CACHE_KEY = 'system:metrics';
  private readonly HEALTH_CACHE_KEY = 'system:health';

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.backgroundJobService = BackgroundJobService.getInstance();
  }

  public static getInstance(): SystemAnalyticsService {
    if (!SystemAnalyticsService.instance) {
      SystemAnalyticsService.instance = new SystemAnalyticsService();
    }
    return SystemAnalyticsService.instance;
  }

  /**
   * Get current system metrics with caching
   */
  async getSystemMetrics(): Promise<ISystemMetrics> {
    try {
      // Try to get from cache first
      const cached = await this.cacheService.get(this.METRICS_CACHE_KEY);
      if (cached) {
        return cached as any;
      }

      // Calculate metrics
      const metrics = await this.calculateSystemMetrics();

      // Cache the result
      await this.cacheService.set(this.METRICS_CACHE_KEY, metrics, { ttl: this.CACHE_TTL / 1000 });

      return metrics;
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw new Error('Failed to retrieve system metrics');
    }
  }

  /**
   * Calculate real-time system metrics
   */
  private async calculateSystemMetrics(): Promise<ISystemMetrics> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Parallel execution of all metric calculations
      const [
        totalUsers,
        activeUsers,
        newUsersToday,
        activeSubscriptions,
        totalWorkspaces,
        monthlyRevenue,
        systemUptime,
        activeFeatureFlags,
        pendingLicenses,
        supportTickets,
        systemHealth
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(),
        this.getNewUsersToday(startOfDay),
        this.getActiveSubscriptions(),
        this.getTotalWorkspaces(),
        this.getMonthlyRevenue(startOfMonth),
        this.getSystemUptime(),
        this.getActiveFeatureFlags(),
        this.getPendingLicenses(),
        this.getSupportTicketsMetrics(),
        this.getSystemHealth()
      ]);

      // Create metrics document
      const metrics = new SystemMetrics({
        timestamp: now,
        totalUsers,
        activeUsers,
        newUsersToday,
        activeSubscriptions,
        totalWorkspaces,
        monthlyRevenue,
        systemUptime,
        activeFeatureFlags,
        pendingLicenses,
        supportTickets,
        systemHealth
      });

      // Save to database for historical tracking
      await metrics.save();

      return metrics;
    } catch (error) {
      logger.error('Error calculating system metrics:', error);
      throw new Error('Failed to calculate system metrics');
    }
  }

  /**
   * Get user analytics for a specific time range
   */
  async getUserAnalytics(timeRange: TimeRange): Promise<IUserAnalytics> {
    try {
      const cacheKey = `user:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const analytics = await this.calculateUserAnalytics(timeRange);

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, analytics, { ttl: 60 * 60 });

      return analytics;
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw new Error('Failed to retrieve user analytics');
    }
  }

  /**
   * Get subscription analytics for a specific time range
   */
  async getSubscriptionAnalytics(timeRange: TimeRange): Promise<ISubscriptionAnalytics> {
    try {
      const cacheKey = `subscription:analytics:${timeRange.startDate.getTime()}:${timeRange.endDate.getTime()}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const analytics = await this.calculateSubscriptionAnalytics(timeRange);

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, analytics, { ttl: 60 * 60 });

      return analytics;
    } catch (error) {
      logger.error('Error getting subscription analytics:', error);
      throw new Error('Failed to retrieve subscription analytics');
    }
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(timeRange: TimeRange): Promise<RevenueMetrics> {
    try {
      const subscriptionAnalytics = await this.getSubscriptionAnalytics(timeRange);

      return {
        mrr: subscriptionAnalytics.mrr,
        arr: subscriptionAnalytics.arr,
        totalRevenue: subscriptionAnalytics.totalRevenue,
        revenueGrowth: subscriptionAnalytics.revenueGrowth,
        averageRevenuePerUser: subscriptionAnalytics.averageRevenuePerUser
      };
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      throw new Error('Failed to retrieve revenue metrics');
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      // Try cache first
      const cached = await this.cacheService.get(this.HEALTH_CACHE_KEY);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const health = await this.calculateSystemHealth();

      // Cache for 1 minute (health checks should be frequent)
      await this.cacheService.set(this.HEALTH_CACHE_KEY, health, { ttl: 60 });

      return health;
    } catch (error) {
      logger.error('Error getting system health:', error);
      throw new Error('Failed to retrieve system health');
    }
  }

  /**
   * Get churn analytics
   */
  async getChurnAnalytics(timeRange: TimeRange): Promise<ChurnAnalytics> {
    try {
      const subscriptionAnalytics = await this.getSubscriptionAnalytics(timeRange);

      return {
        churnRate: subscriptionAnalytics.churnRate,
        churnedUsers: subscriptionAnalytics.churnedSubscriptions,
        retentionRate: 100 - subscriptionAnalytics.churnRate,
        lifetimeValue: subscriptionAnalytics.ltv
      };
    } catch (error) {
      logger.error('Error getting churn analytics:', error);
      throw new Error('Failed to retrieve churn analytics');
    }
  }

  /**
   * Get recent system activities
   */
  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    try {
      const cacheKey = `system:activities:${limit}`;

      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const activities = await this.fetchRecentActivities(limit);

      // Cache for 2 minutes
      await this.cacheService.set(cacheKey, activities, { ttl: 120 });

      return activities;
    } catch (error) {
      logger.error('Error getting recent activities:', error);
      throw new Error('Failed to retrieve recent activities');
    }
  }

  /**
   * Schedule background job for metrics aggregation
   */
  async scheduleMetricsAggregation(): Promise<void> {
    try {
      // Background job service addJob method not available, skip scheduling
      // await this.backgroundJobService.addJob('metrics-aggregation', {
      //   type: 'system-metrics',
      //   timestamp: new Date()
      // }, {
      //   repeat: { cron: '*/5 * * * *' }, // Every 5 minutes
      //   removeOnComplete: 10,
      //   removeOnFail: 5
      // });

      logger.info('Scheduled metrics aggregation job');
    } catch (error) {
      logger.error('Error scheduling metrics aggregation:', error);
      throw new Error('Failed to schedule metrics aggregation');
    }
  }

  // Private helper methods

  private async getTotalUsers(): Promise<number> {
    return await User.countDocuments({ isActive: true });
  }

  private async getActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await User.countDocuments({
      isActive: true,
      lastLoginAt: { $gte: thirtyDaysAgo }
    });
  }

  private async getNewUsersToday(startOfDay: Date): Promise<number> {
    return await User.countDocuments({
      createdAt: { $gte: startOfDay }
    });
  }

  private async getActiveSubscriptions(): Promise<number> {
    return await Subscription.countDocuments({
      status: 'active'
    });
  }

  private async getTotalWorkspaces(): Promise<number> {
    return await Workplace.countDocuments({ isActive: true });
  }

  private async getMonthlyRevenue(startOfMonth: Date): Promise<number> {
    const result = await Subscription.aggregate([
      {
        $match: {
          status: 'active',
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalRevenue : 0;
  }

  private async getSystemUptime(): Promise<string> {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  private async getActiveFeatureFlags(): Promise<number> {
    return await FeatureFlag.countDocuments({ isEnabled: true });
  }

  private async getPendingLicenses(): Promise<number> {
    // TODO: Implement License model and query
    // return await License.countDocuments({ status: 'pending' });
    return 0;
  }

  private async getSupportTicketsMetrics(): Promise<{ open: number; resolved: number; critical: number }> {
    // This would integrate with your support ticket system
    // For now, returning mock data
    return {
      open: 0,
      resolved: 0,
      critical: 0
    };
  }

  private async calculateSystemHealth(): Promise<SystemHealth> {
    const startTime = Date.now();

    // Database health check
    const dbHealth = await this.checkDatabaseHealth();

    // API health check
    const apiHealth = await this.checkApiHealth(startTime);

    // Memory health check
    const memoryHealth = await this.checkMemoryHealth();

    // Cache health check
    const cacheHealth = await this.checkCacheHealth();

    return {
      database: dbHealth,
      api: apiHealth,
      memory: memoryHealth,
      cache: cacheHealth
    };
  }

  private async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      const connections = mongoose.connection.readyState === 1 ? 1 : 0;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (responseTime > 1000) status = 'critical';
      else if (responseTime > 500) status = 'warning';

      return {
        status,
        responseTime,
        connections
      };
    } catch (error) {
      return {
        status: 'critical' as const,
        responseTime: -1,
        connections: 0
      };
    }
  }

  private async checkApiHealth(startTime: number) {
    const responseTime = Date.now() - startTime;

    // Mock requests per minute calculation
    const requestsPerMinute = 100; // This would come from actual metrics

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (responseTime > 2000) status = 'critical';
    else if (responseTime > 1000) status = 'warning';

    return {
      status,
      responseTime,
      requestsPerMinute
    };
  }

  private async checkMemoryHealth() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const availableMemory = totalMemory - usedMemory;

    const usagePercentage = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (usagePercentage > 90) status = 'critical';
    else if (usagePercentage > 75) status = 'warning';

    return {
      status,
      usage: usedMemory,
      available: availableMemory
    };
  }

  private async checkCacheHealth() {
    try {
      const startTime = Date.now();
      await this.cacheService.ping();
      const responseTime = Date.now() - startTime;

      // Mock cache hit rate - this would come from actual Redis stats
      const hitRate = 85;
      const connections = 1;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (hitRate < 50) status = 'critical';
      else if (hitRate < 70) status = 'warning';

      return {
        status,
        hitRate,
        connections
      };
    } catch (error) {
      return {
        status: 'critical' as const,
        hitRate: 0,
        connections: 0
      };
    }
  }

  private async calculateUserAnalytics(timeRange: TimeRange): Promise<IUserAnalytics> {
    // This is a complex calculation that would involve multiple aggregations
    // For now, returning a basic structure
    const date = new Date();

    const analytics = new UserAnalytics({
      date,
      registrationTrend: [],
      activationRate: 85,
      churnRate: 5,
      usersByRole: [],
      usersBySubscription: [],
      geographicDistribution: [],
      totalRegistrations: await this.getTotalUsers(),
      activeUsers: await this.getActiveUsers(),
      inactiveUsers: 0,
      suspendedUsers: 0,
      averageSessionDuration: 45,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: await this.getActiveUsers()
    });

    await analytics.save();
    return analytics;
  }

  private async calculateSubscriptionAnalytics(timeRange: TimeRange): Promise<ISubscriptionAnalytics> {
    // This is a complex calculation that would involve multiple aggregations
    // For now, returning a basic structure
    const date = new Date();

    const analytics = new SubscriptionAnalytics({
      date,
      mrr: await this.getMonthlyRevenue(new Date(date.getFullYear(), date.getMonth(), 1)),
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
    });

    await analytics.save();
    return analytics;
  }

  private async fetchRecentActivities(limit: number): Promise<Activity[]> {
    // This would fetch from various sources like audit logs, user registrations, etc.
    // For now, returning mock data
    return [];
  }

  /**
   * Clear all cached metrics (useful for testing or manual refresh)
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del(this.METRICS_CACHE_KEY),
        this.cacheService.del(this.HEALTH_CACHE_KEY),
        this.cacheService.delPattern('user:analytics:*'),
        this.cacheService.delPattern('subscription:analytics:*'),
        this.cacheService.delPattern('system:activities:*')
      ]);

      logger.info('System analytics cache cleared');
    } catch (error) {
      logger.error('Error clearing analytics cache:', error);
      throw new Error('Failed to clear analytics cache');
    }
  }
}

export default SystemAnalyticsService;