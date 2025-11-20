// Database Optimization Service for SaaS Settings Module
import mongoose from 'mongoose';
import { User } from '../models/User';
import { SystemMetrics } from '../models/SystemMetrics';
import { UserAnalytics } from '../models/UserAnalytics';
import { SubscriptionAnalytics } from '../models/SubscriptionAnalytics';
import { SecuritySettings } from '../models/SecuritySettings';
import { UserSession } from '../models/UserSession';
import { SecurityAuditLog } from '../models/SecurityAuditLog';
import { NotificationSettings } from '../models/NotificationSettings';
import { NotificationRule } from '../models/NotificationRule';
import { NotificationTemplate } from '../models/NotificationTemplate';
import { Tenant } from '../models/Tenant';
import { TenantSettings } from '../models/TenantSettings';
import { SupportTicket } from '../models/SupportTicket';
import { KnowledgeBaseArticle } from '../models/KnowledgeBaseArticle';
import { IApiEndpoint } from '../models/ApiEndpoint';
import { IApiKey } from '../models/ApiKey';
import { IApiUsageMetrics } from '../models/ApiUsageMetrics';
import logger from '../utils/logger';

interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1 | 'text'>;
  options?: mongoose.IndexOptions;
  description: string;
}

interface QueryOptimization {
  collection: string;
  operation: string;
  pipeline?: any[];
  filter?: any;
  sort?: any;
  limit?: number;
  description: string;
}

interface PerformanceMetrics {
  collection: string;
  operation: string;
  executionTime: number;
  documentsExamined: number;
  documentsReturned: number;
  indexUsed: boolean;
  timestamp: Date;
}

export class DatabaseOptimizationService {
  private static instance: DatabaseOptimizationService;
  private performanceMetrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;

  constructor() {
    this.setupIndexes();
  }

  static getInstance(): DatabaseOptimizationService {
    if (!DatabaseOptimizationService.instance) {
      DatabaseOptimizationService.instance = new DatabaseOptimizationService();
    }
    return DatabaseOptimizationService.instance;
  }

  /**
   * Setup all required indexes for optimal query performance
   */
  private async setupIndexes(): Promise<void> {
    const indexes: IndexDefinition[] = [
      // User collection indexes
      {
        collection: 'users',
        index: { email: 1 },
        options: { unique: true },
        description: 'Unique index for user email lookups',
      },
      {
        collection: 'users',
        index: { workspaceId: 1, role: 1 },
        description: 'Compound index for workspace user queries',
      },
      {
        collection: 'users',
        index: { createdAt: -1 },
        description: 'Index for user registration analytics',
      },
      {
        collection: 'users',
        index: { lastLoginAt: -1 },
        description: 'Index for user activity analytics',
      },
      {
        collection: 'users',
        index: { isActive: 1, workspaceId: 1 },
        description: 'Index for active user queries by workspace',
      },

      // System metrics indexes
      {
        collection: 'systemmetrics',
        index: { timestamp: -1 },
        description: 'Index for time-series metrics queries',
      },
      {
        collection: 'systemmetrics',
        index: { metricType: 1, timestamp: -1 },
        description: 'Compound index for metric type and time queries',
      },

      // User analytics indexes
      {
        collection: 'useranalytics',
        index: { userId: 1, timestamp: -1 },
        description: 'Compound index for user analytics queries',
      },
      {
        collection: 'useranalytics',
        index: { workspaceId: 1, timestamp: -1 },
        description: 'Compound index for workspace analytics',
      },
      {
        collection: 'useranalytics',
        index: { eventType: 1, timestamp: -1 },
        description: 'Index for event-based analytics',
      },

      // Subscription analytics indexes
      {
        collection: 'subscriptionanalytics',
        index: { subscriptionId: 1, timestamp: -1 },
        description: 'Compound index for subscription analytics',
      },
      {
        collection: 'subscriptionanalytics',
        index: { planType: 1, timestamp: -1 },
        description: 'Index for plan-based analytics',
      },
      {
        collection: 'subscriptionanalytics',
        index: { workspaceId: 1, status: 1 },
        description: 'Index for workspace subscription queries',
      },

      // Security-related indexes
      {
        collection: 'usersessions',
        index: { userId: 1, isActive: 1 },
        description: 'Index for active user sessions',
      },
      {
        collection: 'usersessions',
        index: { sessionId: 1 },
        options: { unique: true },
        description: 'Unique index for session lookups',
      },
      {
        collection: 'usersessions',
        index: { createdAt: -1 },
        options: { expireAfterSeconds: 86400 * 30 }, // 30 days
        description: 'TTL index for session cleanup',
      },
      {
        collection: 'usersessions',
        index: { ipAddress: 1, createdAt: -1 },
        description: 'Index for IP-based security queries',
      },

      // Security audit log indexes
      {
        collection: 'securityauditlogs',
        index: { userId: 1, timestamp: -1 },
        description: 'Index for user audit queries',
      },
      {
        collection: 'securityauditlogs',
        index: { action: 1, timestamp: -1 },
        description: 'Index for action-based audit queries',
      },
      {
        collection: 'securityauditlogs',
        index: { ipAddress: 1, timestamp: -1 },
        description: 'Index for IP-based security analysis',
      },
      {
        collection: 'securityauditlogs',
        index: { timestamp: -1 },
        options: { expireAfterSeconds: 86400 * 365 }, // 1 year
        description: 'TTL index for audit log retention',
      },

      // Notification indexes
      {
        collection: 'notificationrules',
        index: { isActive: 1, trigger: 1 },
        description: 'Index for active notification rules',
      },
      {
        collection: 'notificationtemplates',
        index: { channel: 1, isActive: 1 },
        description: 'Index for active templates by channel',
      },

      // Tenant indexes
      {
        collection: 'tenants',
        index: { status: 1, type: 1 },
        description: 'Index for tenant status and type queries',
      },
      {
        collection: 'tenants',
        index: { subscriptionPlan: 1, status: 1 },
        description: 'Index for subscription plan queries',
      },
      {
        collection: 'tenants',
        index: { createdAt: -1 },
        description: 'Index for tenant creation analytics',
      },
      {
        collection: 'tenants',
        index: { lastActivity: -1 },
        description: 'Index for tenant activity tracking',
      },

      // Support ticket indexes
      {
        collection: 'supporttickets',
        index: { status: 1, priority: 1 },
        description: 'Index for ticket status and priority queries',
      },
      {
        collection: 'supporttickets',
        index: { assignedTo: 1, status: 1 },
        description: 'Index for assigned ticket queries',
      },
      {
        collection: 'supporttickets',
        index: { createdBy: 1, createdAt: -1 },
        description: 'Index for user ticket history',
      },
      {
        collection: 'supporttickets',
        index: { tenantId: 1, status: 1 },
        description: 'Index for tenant support queries',
      },

      // Knowledge base indexes
      {
        collection: 'knowledgebasearticles',
        index: { category: 1, isPublished: 1 },
        description: 'Index for published articles by category',
      },
      {
        collection: 'knowledgebasearticles',
        index: { tags: 1, isPublished: 1 },
        description: 'Index for article tag searches',
      },
      {
        collection: 'knowledgebasearticles',
        index: { title: 'text', content: 'text' },
        description: 'Full-text search index for articles',
      },

      // API management indexes
      {
        collection: 'apiendpoints',
        index: { path: 1, method: 1 },
        options: { unique: true },
        description: 'Unique index for API endpoint identification',
      },
      {
        collection: 'apiendpoints',
        index: { isActive: 1, version: 1 },
        description: 'Index for active API endpoints by version',
      },

      // API key indexes
      {
        collection: 'apikeys',
        index: { keyHash: 1 },
        options: { unique: true },
        description: 'Unique index for API key lookups',
      },
      {
        collection: 'apikeys',
        index: { developerId: 1, isActive: 1 },
        description: 'Index for developer API keys',
      },
      {
        collection: 'apikeys',
        index: { expiresAt: 1 },
        options: { expireAfterSeconds: 0 },
        description: 'TTL index for API key expiration',
      },

      // API usage metrics indexes
      {
        collection: 'apiusagemetrics',
        index: { apiKeyId: 1, timestamp: -1 },
        description: 'Index for API usage by key',
      },
      {
        collection: 'apiusagemetrics',
        index: { endpoint: 1, timestamp: -1 },
        description: 'Index for endpoint usage analytics',
      },
      {
        collection: 'apiusagemetrics',
        index: { timestamp: -1 },
        options: { expireAfterSeconds: 86400 * 90 }, // 90 days
        description: 'TTL index for usage metrics retention',
      },
    ];

    await this.createIndexes(indexes);
  }

  /**
   * Create database indexes
   */
  private async createIndexes(indexes: IndexDefinition[]): Promise<void> {
    logger.info(`Creating ${indexes.length} database indexes for optimization`);

    for (const indexDef of indexes) {
      try {
        const collection = mongoose.connection.db?.collection(indexDef.collection);
        if (!collection) {
          logger.warn(`Collection ${indexDef.collection} not found, skipping index creation`);
          continue;
        }

        await collection.createIndex(indexDef.index, indexDef.options || {});
        logger.debug(`Created index for ${indexDef.collection}: ${indexDef.description}`);
      } catch (error: any) {
        // Index might already exist, which is fine
        if (error.code !== 85) { // Index already exists error code
          logger.error(`Failed to create index for ${indexDef.collection}:`, error);
        }
      }
    }

    logger.info('Database index creation completed');
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(
    collection: string,
    operation: string,
    query: any
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      // Execute explain for the query
      const explainResult = await db.collection(collection).find(query).explain('executionStats');
      
      const executionStats = explainResult.executionStats;
      const metrics: PerformanceMetrics = {
        collection,
        operation,
        executionTime: Date.now() - startTime,
        documentsExamined: executionStats.totalDocsExamined || 0,
        documentsReturned: executionStats.totalDocsReturned || 0,
        indexUsed: executionStats.totalDocsExamined <= executionStats.totalDocsReturned * 2,
        timestamp: new Date(),
      };

      this.recordPerformanceMetrics(metrics);
      return metrics;
    } catch (error) {
      logger.error(`Failed to analyze query performance for ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Get optimized aggregation pipeline for user analytics
   */
  getOptimizedUserAnalyticsPipeline(timeRange: { start: Date; end: Date }): any[] {
    return [
      // Match stage with indexed fields first
      {
        $match: {
          createdAt: {
            $gte: timeRange.start,
            $lte: timeRange.end,
          },
        },
      },
      // Group by date and count
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0],
            },
          },
        },
      },
      // Sort by date
      {
        $sort: { _id: 1 },
      },
    ];
  }

  /**
   * Get optimized aggregation pipeline for subscription analytics
   */
  getOptimizedSubscriptionAnalyticsPipeline(timeRange: { start: Date; end: Date }): any[] {
    return [
      // Match stage with indexed fields
      {
        $match: {
          timestamp: {
            $gte: timeRange.start,
            $lte: timeRange.end,
          },
        },
      },
      // Group by plan type and calculate metrics
      {
        $group: {
          _id: '$planType',
          totalRevenue: { $sum: '$revenue' },
          subscriptionCount: { $sum: 1 },
          avgRevenue: { $avg: '$revenue' },
        },
      },
      // Sort by total revenue
      {
        $sort: { totalRevenue: -1 },
      },
    ];
  }

  /**
   * Get optimized query for active user sessions
   */
  getOptimizedActiveSessionsQuery(): any {
    return {
      isActive: true,
      lastActivity: {
        $gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
      },
    };
  }

  /**
   * Get optimized query for security audit logs
   */
  getOptimizedSecurityAuditQuery(filters: {
    userId?: string;
    action?: string;
    ipAddress?: string;
    timeRange?: { start: Date; end: Date };
  }): any {
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.ipAddress) {
      query.ipAddress = filters.ipAddress;
    }

    if (filters.timeRange) {
      query.timestamp = {
        $gte: filters.timeRange.start,
        $lte: filters.timeRange.end,
      };
    }

    return query;
  }

  /**
   * Implement cursor-based pagination for large datasets
   */
  async getCursorPaginatedResults<T>(
    model: mongoose.Model<T>,
    query: any = {},
    options: {
      limit?: number;
      cursor?: string;
      sortField?: string;
      sortOrder?: 1 | -1;
    } = {}
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
    totalCount?: number;
  }> {
    const {
      limit = 20,
      cursor,
      sortField = '_id',
      sortOrder = -1,
    } = options;

    // Build query with cursor
    const paginatedQuery = { ...query };
    if (cursor) {
      const cursorCondition = sortOrder === 1 ? '$gt' : '$lt';
      paginatedQuery[sortField] = { [cursorCondition]: cursor };
    }

    // Execute query with limit + 1 to check if there are more results
    const results = await model
      .find(paginatedQuery)
      .sort({ [sortField]: sortOrder })
      .limit(limit + 1)
      .lean()
      .exec();

    // Check if there are more results
    const hasMore = results.length > limit;
    if (hasMore) {
      results.pop(); // Remove the extra result
    }

    // Get next cursor
    const nextCursor = hasMore && results.length > 0
      ? (results[results.length - 1] as any)[sortField]
      : undefined;

    return {
      data: results as T[],
      nextCursor: nextCursor?.toString(),
      hasMore,
    };
  }

  /**
   * Optimize aggregation queries with proper indexing
   */
  async executeOptimizedAggregation<T>(
    model: mongoose.Model<T>,
    pipeline: any[],
    options: {
      allowDiskUse?: boolean;
      maxTimeMS?: number;
    } = {}
  ): Promise<any[]> {
    const {
      allowDiskUse = true,
      maxTimeMS = 30000, // 30 seconds
    } = options;

    const startTime = Date.now();

    try {
      const results = await model.aggregate(pipeline, {
        allowDiskUse,
        maxTimeMS,
      });

      const executionTime = Date.now() - startTime;
      
      // Record performance metrics
      this.recordPerformanceMetrics({
        collection: model.collection.name,
        operation: 'aggregation',
        executionTime,
        documentsExamined: 0, // Not available for aggregation
        documentsReturned: results.length,
        indexUsed: true, // Assume optimized pipeline uses indexes
        timestamp: new Date(),
      });

      return results;
    } catch (error) {
      logger.error(`Aggregation failed for ${model.collection.name}:`, error);
      throw error;
    }
  }

  /**
   * Record performance metrics
   */
  private recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.push(metrics);

    // Keep only the last N metrics to prevent memory issues
    if (this.performanceMetrics.length > this.MAX_METRICS_HISTORY) {
      this.performanceMetrics.shift();
    }

    // Log slow queries
    if (metrics.executionTime > 1000) { // Queries taking more than 1 second
      logger.warn(`Slow query detected in ${metrics.collection}:`, {
        operation: metrics.operation,
        executionTime: metrics.executionTime,
        documentsExamined: metrics.documentsExamined,
        documentsReturned: metrics.documentsReturned,
        indexUsed: metrics.indexUsed,
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    indexUsageRate: number;
    recentMetrics: PerformanceMetrics[];
  } {
    const totalQueries = this.performanceMetrics.length;
    const averageExecutionTime = totalQueries > 0
      ? this.performanceMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0;
    
    const slowQueries = this.performanceMetrics.filter(m => m.executionTime > 1000).length;
    const indexUsageRate = totalQueries > 0
      ? (this.performanceMetrics.filter(m => m.indexUsed).length / totalQueries) * 100
      : 0;

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      indexUsageRate,
      recentMetrics: this.performanceMetrics.slice(-10), // Last 10 queries
    };
  }

  /**
   * Analyze and suggest index improvements
   */
  async analyzeIndexUsage(): Promise<{
    collections: string[];
    suggestions: string[];
    unusedIndexes: string[];
  }> {
    const suggestions: string[] = [];
    const unusedIndexes: string[] = [];
    const collections: string[] = [];

    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not available');
      }

      const collectionNames = await db.listCollections().toArray();
      
      for (const collectionInfo of collectionNames) {
        const collectionName = collectionInfo.name;
        collections.push(collectionName);

        try {
          const collection = db.collection(collectionName);
          // Note: indexStats() might not be available in all MongoDB versions
          // This is a placeholder for index analysis
          const indexStats: any[] = [];

          for (const indexStat of indexStats) {
            const indexName = indexStat.name;
            const usageCount = indexStat.accesses?.ops || 0;

            // Skip the default _id index
            if (indexName === '_id_') {
              continue;
            }

            // Suggest removal of unused indexes
            if (usageCount === 0) {
              unusedIndexes.push(`${collectionName}.${indexName}`);
            }
          }
        } catch (error) {
          logger.debug(`Could not analyze indexes for collection ${collectionName}:`, error);
        }
      }

      // Add general suggestions based on performance metrics
      const slowQueries = this.performanceMetrics.filter(m => m.executionTime > 1000);
      if (slowQueries.length > 0) {
        suggestions.push('Consider adding indexes for frequently queried fields in slow queries');
      }

      const lowIndexUsage = this.performanceMetrics.filter(m => !m.indexUsed);
      const totalQueries = this.performanceMetrics.length;
      if (lowIndexUsage.length > totalQueries * 0.2) { // More than 20% queries not using indexes
        suggestions.push('Review query patterns and add appropriate compound indexes');
      }

      return {
        collections,
        suggestions,
        unusedIndexes,
      };
    } catch (error) {
      logger.error('Failed to analyze index usage:', error);
      return {
        collections: [],
        suggestions: ['Failed to analyze index usage - check database connection'],
        unusedIndexes: [],
      };
    }
  }

  /**
   * Clear performance metrics history
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
    logger.info('Performance metrics history cleared');
  }
}

export default DatabaseOptimizationService.getInstance();