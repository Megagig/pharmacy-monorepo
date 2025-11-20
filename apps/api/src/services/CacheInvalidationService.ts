// Cache Invalidation Service for SaaS Settings Module
import { RedisCacheService } from './RedisCacheService';
import { CacheWarmingService } from './CacheWarmingService';
import { defaultCacheConfig, SaaSCacheKeys, SaaSCacheTags } from '../config/cacheConfig';
import logger from '../utils/logger';

interface InvalidationRule {
  event: string;
  patterns: string[];
  tags: string[];
  warmAfterInvalidation: boolean;
}

interface InvalidationEvent {
  type: string;
  entityId?: string;
  entityType?: string;
  metadata?: any;
  timestamp: Date;
}

export class CacheInvalidationService {
  private static instance: CacheInvalidationService;
  private cacheService: RedisCacheService;
  private warmingService: CacheWarmingService;
  private invalidationRules: Map<string, InvalidationRule> = new Map();
  private invalidationStats = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    failedInvalidations: 0,
    lastInvalidationTime: null as Date | null,
  };

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.warmingService = CacheWarmingService.getInstance();
    this.setupInvalidationRules();
  }

  static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  /**
   * Setup invalidation rules for different events
   */
  private setupInvalidationRules(): void {
    // User-related invalidations
    this.addInvalidationRule({
      event: 'user.created',
      patterns: ['saas:users:list:*', 'saas:system:metrics'],
      tags: [SaaSCacheTags.USERS, SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'user.updated',
      patterns: ['saas:user:*', 'saas:users:list:*'],
      tags: [SaaSCacheTags.USERS],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'user.deleted',
      patterns: ['saas:user:*', 'saas:users:list:*', 'saas:system:metrics'],
      tags: [SaaSCacheTags.USERS, SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'user.role.changed',
      patterns: ['saas:user:*', 'saas:users:list:*', 'saas:analytics:users:*'],
      tags: [SaaSCacheTags.USERS, SaaSCacheTags.ANALYTICS],
      warmAfterInvalidation: true,
    });

    // Security-related invalidations
    this.addInvalidationRule({
      event: 'security.settings.updated',
      patterns: ['saas:security:*'],
      tags: [SaaSCacheTags.SECURITY],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'security.session.created',
      patterns: ['saas:security:sessions:*'],
      tags: [SaaSCacheTags.SECURITY],
      warmAfterInvalidation: false,
    });

    this.addInvalidationRule({
      event: 'security.session.terminated',
      patterns: ['saas:security:sessions:*'],
      tags: [SaaSCacheTags.SECURITY],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'security.audit.logged',
      patterns: ['saas:security:audit:*'],
      tags: [SaaSCacheTags.SECURITY],
      warmAfterInvalidation: false,
    });

    // Feature flag invalidations
    this.addInvalidationRule({
      event: 'feature.flag.updated',
      patterns: ['saas:feature:*'],
      tags: [SaaSCacheTags.FEATURE_FLAGS],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'feature.flag.toggled',
      patterns: ['saas:feature:flags', 'saas:feature:*:usage'],
      tags: [SaaSCacheTags.FEATURE_FLAGS],
      warmAfterInvalidation: true,
    });

    // System-related invalidations
    this.addInvalidationRule({
      event: 'system.metrics.updated',
      patterns: ['saas:system:*'],
      tags: [SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'system.health.changed',
      patterns: ['saas:system:health'],
      tags: [SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    // Tenant-related invalidations
    this.addInvalidationRule({
      event: 'tenant.created',
      patterns: ['saas:tenants:*', 'saas:system:metrics'],
      tags: [SaaSCacheTags.TENANTS, SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'tenant.updated',
      patterns: ['saas:tenant:*', 'saas:tenants:*'],
      tags: [SaaSCacheTags.TENANTS],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'tenant.deleted',
      patterns: ['saas:tenant:*', 'saas:tenants:*', 'saas:system:metrics'],
      tags: [SaaSCacheTags.TENANTS, SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    // Billing-related invalidations
    this.addInvalidationRule({
      event: 'billing.subscription.created',
      patterns: ['saas:billing:*', 'saas:analytics:*', 'saas:system:metrics'],
      tags: [SaaSCacheTags.BILLING, SaaSCacheTags.ANALYTICS, SaaSCacheTags.SYSTEM],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'billing.subscription.updated',
      patterns: ['saas:billing:subscription:*', 'saas:billing:overview'],
      tags: [SaaSCacheTags.BILLING],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'billing.payment.processed',
      patterns: ['saas:billing:*', 'saas:analytics:revenue:*'],
      tags: [SaaSCacheTags.BILLING, SaaSCacheTags.ANALYTICS],
      warmAfterInvalidation: true,
    });

    // Notification-related invalidations
    this.addInvalidationRule({
      event: 'notification.sent',
      patterns: ['saas:notifications:history:*'],
      tags: [SaaSCacheTags.NOTIFICATIONS],
      warmAfterInvalidation: false,
    });

    this.addInvalidationRule({
      event: 'notification.settings.updated',
      patterns: ['saas:notifications:*'],
      tags: [SaaSCacheTags.NOTIFICATIONS],
      warmAfterInvalidation: true,
    });

    // Support-related invalidations
    this.addInvalidationRule({
      event: 'support.ticket.created',
      patterns: ['saas:support:tickets:*', 'saas:support:metrics'],
      tags: [SaaSCacheTags.SUPPORT],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'support.ticket.updated',
      patterns: ['saas:support:tickets:*', 'saas:support:metrics'],
      tags: [SaaSCacheTags.SUPPORT],
      warmAfterInvalidation: false,
    });

    // API-related invalidations
    this.addInvalidationRule({
      event: 'api.endpoint.created',
      patterns: ['saas:api:endpoints'],
      tags: [SaaSCacheTags.API],
      warmAfterInvalidation: true,
    });

    this.addInvalidationRule({
      event: 'api.usage.recorded',
      patterns: ['saas:api:usage:*'],
      tags: [SaaSCacheTags.API],
      warmAfterInvalidation: false,
    });

    logger.info(`Initialized ${this.invalidationRules.size} cache invalidation rules`);
  }

  /**
   * Add an invalidation rule
   */
  private addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.set(rule.event, rule);
  }

  /**
   * Handle invalidation event
   */
  async handleInvalidationEvent(event: InvalidationEvent): Promise<void> {
    const startTime = Date.now();

    try {
      const rule = this.invalidationRules.get(event.type);
      if (!rule) {
        logger.debug(`No invalidation rule found for event: ${event.type}`);
        return;
      }

      logger.info(`Processing invalidation event: ${event.type}`);

      // Invalidate by patterns
      if (rule.patterns.length > 0) {
        await this.invalidateByPatterns(rule.patterns, event);
      }

      // Invalidate by tags
      if (rule.tags.length > 0) {
        if (rule.warmAfterInvalidation) {
          await this.warmingService.invalidateByTagsAndWarm(rule.tags);
        } else {
          await this.cacheService.invalidateByTags(rule.tags);
        }
      }

      this.invalidationStats.successfulInvalidations++;
      this.invalidationStats.totalInvalidations++;
      this.invalidationStats.lastInvalidationTime = new Date();

      const duration = Date.now() - startTime;
      logger.info(`Invalidation event ${event.type} processed in ${duration}ms`);
    } catch (error) {
      this.invalidationStats.failedInvalidations++;
      this.invalidationStats.totalInvalidations++;
      logger.error(`Failed to process invalidation event ${event.type}:`, error);
    }
  }

  /**
   * Invalidate cache by patterns
   */
  private async invalidateByPatterns(patterns: string[], event: InvalidationEvent): Promise<void> {
    for (const pattern of patterns) {
      try {
        // Replace placeholders in patterns with actual values
        const resolvedPattern = this.resolvePattern(pattern, event);
        const deletedCount = await this.cacheService.delPattern(resolvedPattern);
        
        if (deletedCount > 0) {
          logger.debug(`Invalidated ${deletedCount} cache entries matching pattern: ${resolvedPattern}`);
        }
      } catch (error) {
        logger.error(`Failed to invalidate pattern ${pattern}:`, error);
      }
    }
  }

  /**
   * Resolve pattern placeholders with event data
   */
  private resolvePattern(pattern: string, event: InvalidationEvent): string {
    let resolvedPattern = pattern;

    // Replace entity ID placeholder
    if (event.entityId) {
      resolvedPattern = resolvedPattern.replace(/\{entityId\}/g, event.entityId);
    }

    // Replace entity type placeholder
    if (event.entityType) {
      resolvedPattern = resolvedPattern.replace(/\{entityType\}/g, event.entityType);
    }

    // Replace metadata placeholders
    if (event.metadata) {
      Object.entries(event.metadata).forEach(([key, value]) => {
        resolvedPattern = resolvedPattern.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          String(value)
        );
      });
    }

    return resolvedPattern;
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'user.updated',
      entityId: userId,
      entityType: 'user',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate tenant-related caches
   */
  async invalidateTenantCaches(tenantId: string): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'tenant.updated',
      entityId: tenantId,
      entityType: 'tenant',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate system-wide caches
   */
  async invalidateSystemCaches(): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'system.metrics.updated',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate security-related caches
   */
  async invalidateSecurityCaches(): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'security.settings.updated',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate feature flag caches
   */
  async invalidateFeatureFlagCaches(flagId?: string): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'feature.flag.updated',
      entityId: flagId,
      entityType: 'feature_flag',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate billing-related caches
   */
  async invalidateBillingCaches(subscriptionId?: string): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'billing.subscription.updated',
      entityId: subscriptionId,
      entityType: 'subscription',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate notification caches
   */
  async invalidateNotificationCaches(): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'notification.settings.updated',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate support caches
   */
  async invalidateSupportCaches(): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'support.ticket.created',
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate API-related caches
   */
  async invalidateApiCaches(): Promise<void> {
    await this.handleInvalidationEvent({
      type: 'api.endpoint.created',
      timestamp: new Date(),
    });
  }

  /**
   * Smart invalidation based on data changes
   */
  async smartInvalidate(changes: {
    collection: string;
    operation: 'create' | 'update' | 'delete';
    documentId?: string;
    fields?: string[];
  }): Promise<void> {
    const eventType = `${changes.collection}.${changes.operation}`;
    
    await this.handleInvalidationEvent({
      type: eventType,
      entityId: changes.documentId,
      entityType: changes.collection,
      metadata: {
        fields: changes.fields,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStats(): typeof this.invalidationStats {
    return { ...this.invalidationStats };
  }

  /**
   * Get invalidation rules
   */
  getInvalidationRules(): Array<{ event: string; rule: InvalidationRule }> {
    return Array.from(this.invalidationRules.entries()).map(([event, rule]) => ({
      event,
      rule,
    }));
  }

  /**
   * Clear all caches (emergency use only)
   */
  async clearAllCaches(): Promise<boolean> {
    try {
      logger.warn('Clearing all caches - this should only be used in emergencies');
      const result = await this.cacheService.clear();
      
      if (result) {
        // Trigger warming of critical caches
        await this.warmingService.warmCriticalCaches();
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to clear all caches:', error);
      return false;
    }
  }
}

export default CacheInvalidationService.getInstance();