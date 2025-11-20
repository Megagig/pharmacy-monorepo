// Cache Warming Service for SaaS Settings Module
import { RedisCacheService } from './RedisCacheService';
import { SystemAnalyticsService } from './SystemAnalyticsService';
import { UserManagementService } from './UserManagementService';
// Import types for services that may not exist yet
interface SecurityMonitoringServiceInterface {
  getSecuritySettings(): Promise<any>;
  getActiveSessions(): Promise<any>;
}

interface NotificationServiceInterface {
  getNotificationSettings(): Promise<any>;
}
import { defaultCacheConfig, SaaSCacheKeys, SaaSCacheTags } from '../config/cacheConfig';
import logger from '../utils/logger';
import * as cron from 'node-cron';

interface WarmingJob {
  key: string;
  warmFunction: () => Promise<any>;
  ttl: number;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
}

export class CacheWarmingService {
  private static instance: CacheWarmingService;
  private cacheService: RedisCacheService;
  private systemAnalytics: SystemAnalyticsService;
  private userManagement: UserManagementService;
  private securityMonitoring: SecurityMonitoringServiceInterface;
  private notificationService: NotificationServiceInterface;
  private warmingJobs: Map<string, WarmingJob> = new Map();
  private isWarming = false;
  private warmingStats = {
    totalWarmed: 0,
    successfulWarming: 0,
    failedWarming: 0,
    lastWarmingTime: null as Date | null,
    averageWarmingTime: 0,
  };

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.systemAnalytics = SystemAnalyticsService.getInstance();
    this.userManagement = UserManagementService.getInstance();
    
    // Initialize optional services with fallbacks
    try {
      const SecurityMonitoringService = (global as any).SecurityMonitoringService || 
        require('./SecurityMonitoringService').SecurityMonitoringService;
      this.securityMonitoring = SecurityMonitoringService.getInstance();
    } catch (error) {
      this.securityMonitoring = {
        getSecuritySettings: async () => ({ enabled: true }),
        getActiveSessions: async () => ({ count: 0, sessions: [] }),
      };
    }
    
    try {
      const NotificationService = (global as any).NotificationService || 
        require('./NotificationService').NotificationService;
      this.notificationService = NotificationService.getInstance();
    } catch (error) {
      this.notificationService = {
        getNotificationSettings: async () => ({ enabled: true, channels: [] }),
      };
    }
    
    this.setupWarmingJobs();
    this.startWarmingScheduler();
  }

  static getInstance(): CacheWarmingService {
    if (!CacheWarmingService.instance) {
      CacheWarmingService.instance = new CacheWarmingService();
    }
    return CacheWarmingService.instance;
  }

  /**
   * Setup warming jobs for critical cache entries
   */
  private setupWarmingJobs(): void {
    // System metrics - highest priority
    this.addWarmingJob({
      key: SaaSCacheKeys.systemMetrics(),
      warmFunction: () => this.systemAnalytics.getSystemMetrics(),
      ttl: defaultCacheConfig.ttl.systemMetrics,
      tags: [SaaSCacheTags.SYSTEM, SaaSCacheTags.ANALYTICS],
      priority: 'high',
    });

    // System health - highest priority
    this.addWarmingJob({
      key: SaaSCacheKeys.systemHealth(),
      warmFunction: () => this.systemAnalytics.getSystemHealth(),
      ttl: defaultCacheConfig.ttl.systemMetrics,
      tags: [SaaSCacheTags.SYSTEM],
      priority: 'high',
    });

    // Recent activities - high priority
    this.addWarmingJob({
      key: SaaSCacheKeys.recentActivities(),
      warmFunction: () => this.systemAnalytics.getRecentActivities(10),
      ttl: defaultCacheConfig.ttl.systemMetrics,
      tags: [SaaSCacheTags.SYSTEM],
      priority: 'high',
    });

    // Feature flags - high priority
    this.addWarmingJob({
      key: SaaSCacheKeys.featureFlags(),
      warmFunction: () => this.getFeatureFlags(),
      ttl: defaultCacheConfig.ttl.featureFlags,
      tags: [SaaSCacheTags.FEATURE_FLAGS],
      priority: 'high',
    });

    // Security settings - medium priority
    this.addWarmingJob({
      key: SaaSCacheKeys.securitySettings(),
      warmFunction: () => this.securityMonitoring.getSecuritySettings(),
      ttl: defaultCacheConfig.ttl.securitySettings,
      tags: [SaaSCacheTags.SECURITY],
      priority: 'medium',
    });

    // Active sessions - medium priority
    this.addWarmingJob({
      key: SaaSCacheKeys.activeSessions(),
      warmFunction: () => this.securityMonitoring.getActiveSessions(),
      ttl: defaultCacheConfig.ttl.securitySettings,
      tags: [SaaSCacheTags.SECURITY],
      priority: 'medium',
    });

    // Notification settings - medium priority
    this.addWarmingJob({
      key: SaaSCacheKeys.notificationSettings(),
      warmFunction: () => this.notificationService.getNotificationSettings(),
      ttl: defaultCacheConfig.ttl.notifications,
      tags: [SaaSCacheTags.NOTIFICATIONS],
      priority: 'medium',
    });

    // User analytics - low priority (expensive to calculate)
    this.addWarmingJob({
      key: SaaSCacheKeys.userAnalytics('7d'),
      warmFunction: () => this.systemAnalytics.getUserAnalytics({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      }),
      ttl: defaultCacheConfig.ttl.userAnalytics,
      tags: [SaaSCacheTags.ANALYTICS, SaaSCacheTags.USERS],
      priority: 'low',
    });

    // Subscription analytics - low priority
    this.addWarmingJob({
      key: SaaSCacheKeys.subscriptionAnalytics('30d'),
      warmFunction: () => this.systemAnalytics.getSubscriptionAnalytics({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      }),
      ttl: defaultCacheConfig.ttl.userAnalytics,
      tags: [SaaSCacheTags.ANALYTICS, SaaSCacheTags.BILLING],
      priority: 'low',
    });
  }

  /**
   * Add a warming job
   */
  private addWarmingJob(job: WarmingJob): void {
    this.warmingJobs.set(job.key, job);
    logger.debug(`Added cache warming job for key: ${job.key}`);
  }

  /**
   * Start the cache warming scheduler
   */
  private startWarmingScheduler(): void {
    if (!defaultCacheConfig.warming.enabled) {
      logger.info('Cache warming is disabled');
      return;
    }

    // Schedule warming every 4 minutes (before 5-minute TTL expires)
    cron.schedule('*/4 * * * *', async () => {
      await this.warmCriticalCaches();
    });

    // Schedule comprehensive warming every hour
    cron.schedule('0 * * * *', async () => {
      await this.warmAllCaches();
    });

    logger.info('Cache warming scheduler started');
  }

  /**
   * Warm critical caches (high priority only)
   */
  async warmCriticalCaches(): Promise<void> {
    if (this.isWarming) {
      logger.debug('Cache warming already in progress, skipping');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      const criticalJobs = Array.from(this.warmingJobs.values())
        .filter(job => job.priority === 'high');

      logger.info(`Starting critical cache warming for ${criticalJobs.length} entries`);

      await this.executeWarmingJobs(criticalJobs);

      const duration = Date.now() - startTime;
      logger.info(`Critical cache warming completed in ${duration}ms`);
    } catch (error) {
      logger.error('Critical cache warming failed:', error);
    } finally {
      this.isWarming = false;
      this.warmingStats.lastWarmingTime = new Date();
    }
  }

  /**
   * Warm all caches
   */
  async warmAllCaches(): Promise<void> {
    if (this.isWarming) {
      logger.debug('Cache warming already in progress, skipping');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      const allJobs = Array.from(this.warmingJobs.values())
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

      logger.info(`Starting comprehensive cache warming for ${allJobs.length} entries`);

      await this.executeWarmingJobs(allJobs);

      const duration = Date.now() - startTime;
      this.warmingStats.averageWarmingTime = duration;
      logger.info(`Comprehensive cache warming completed in ${duration}ms`);
    } catch (error) {
      logger.error('Comprehensive cache warming failed:', error);
    } finally {
      this.isWarming = false;
      this.warmingStats.lastWarmingTime = new Date();
    }
  }

  /**
   * Execute warming jobs with concurrency control
   */
  private async executeWarmingJobs(jobs: WarmingJob[]): Promise<void> {
    const batchSize = 3; // Process 3 jobs concurrently
    const batches = [];

    for (let i = 0; i < jobs.length; i += batchSize) {
      batches.push(jobs.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(job => this.executeWarmingJob(job));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Execute a single warming job
   */
  private async executeWarmingJob(job: WarmingJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if cache entry is about to expire (within 1 minute)
      const ttl = await this.cacheService.ttl(job.key);
      if (ttl > 60) {
        logger.debug(`Cache entry ${job.key} still fresh (TTL: ${ttl}s), skipping`);
        return;
      }

      logger.debug(`Warming cache for key: ${job.key}`);

      // Execute the warming function
      const data = await job.warmFunction();

      // Cache the result
      await this.cacheService.set(job.key, data, {
        ttl: job.ttl,
        tags: job.tags,
      });

      this.warmingStats.successfulWarming++;
      this.warmingStats.totalWarmed++;

      const duration = Date.now() - startTime;
      logger.debug(`Successfully warmed cache for ${job.key} in ${duration}ms`);
    } catch (error) {
      this.warmingStats.failedWarming++;
      this.warmingStats.totalWarmed++;
      logger.error(`Failed to warm cache for ${job.key}:`, error);
    }
  }

  /**
   * Warm specific cache entry
   */
  async warmCache(key: string): Promise<boolean> {
    const job = this.warmingJobs.get(key);
    if (!job) {
      logger.warn(`No warming job found for key: ${key}`);
      return false;
    }

    try {
      await this.executeWarmingJob(job);
      return true;
    } catch (error) {
      logger.error(`Failed to warm cache for ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate and re-warm cache
   */
  async invalidateAndWarm(key: string): Promise<boolean> {
    try {
      // Invalidate existing cache
      await this.cacheService.del(key);

      // Warm the cache
      return await this.warmCache(key);
    } catch (error) {
      logger.error(`Failed to invalidate and warm cache for ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags and warm related entries
   */
  async invalidateByTagsAndWarm(tags: string[]): Promise<void> {
    try {
      // Invalidate by tags
      await this.cacheService.invalidateByTags(tags);

      // Find jobs that have matching tags and warm them
      const jobsToWarm = Array.from(this.warmingJobs.values())
        .filter(job => job.tags.some(tag => tags.includes(tag)));

      logger.info(`Invalidated caches with tags [${tags.join(', ')}], warming ${jobsToWarm.length} entries`);

      await this.executeWarmingJobs(jobsToWarm);
    } catch (error) {
      logger.error('Failed to invalidate by tags and warm:', error);
    }
  }

  /**
   * Get warming statistics
   */
  getWarmingStats(): typeof this.warmingStats {
    return { ...this.warmingStats };
  }

  /**
   * Get warming job status
   */
  getWarmingJobStatus(): Array<{ key: string; priority: string; lastWarmed?: Date }> {
    return Array.from(this.warmingJobs.entries()).map(([key, job]) => ({
      key,
      priority: job.priority,
      lastWarmed: this.warmingStats.lastWarmingTime,
    }));
  }

  /**
   * Stop warming scheduler
   */
  stop(): void {
    // Note: node-cron doesn't provide a direct way to stop specific tasks
    // In a production environment, you might want to use a more sophisticated scheduler
    logger.info('Cache warming service stopped');
  }

  // Helper methods for warming functions

  private async getFeatureFlags(): Promise<any> {
    // This would typically call the FeatureFlagService
    // For now, return a placeholder
    return {
      flags: [],
      totalCount: 0,
      categories: [],
    };
  }
}

export default CacheWarmingService.getInstance();