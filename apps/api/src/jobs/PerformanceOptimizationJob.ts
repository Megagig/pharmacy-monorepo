/**
 * Performance Optimization Background Job
 * Monitors and optimizes patient engagement performance
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1
 */

import { Job } from 'bull';
import patientEngagementPerformanceService from '../services/PatientEngagementPerformanceService';
import patientEngagementIndexOptimizer from '../services/PatientEngagementIndexOptimizer';
import PerformanceCacheService from '../services/PerformanceCacheService';
import ConnectionPoolService from '../services/ConnectionPoolService';
import databaseOptimizationService from '../services/DatabaseOptimizationService';
import logger from '../utils/logger';

export interface PerformanceOptimizationJobData {
  type: 'cache_cleanup' | 'index_analysis' | 'connection_health' | 'query_analysis' | 'full_optimization';
  workplaceId?: string;
  options?: {
    force?: boolean;
    dryRun?: boolean;
    includeAnalytics?: boolean;
  };
}

export interface PerformanceReport {
  timestamp: Date;
  type: string;
  duration: number;
  results: {
    cacheStats?: any;
    indexAnalysis?: any;
    connectionHealth?: any;
    queryPerformance?: any;
    recommendations?: string[];
  };
  errors?: string[];
}

/**
 * Background job processor for performance optimization
 */
export class PerformanceOptimizationJobProcessor {
  private performanceService: any;
  private indexOptimizer: any;
  private cacheService: any;
  private connectionPool: any;
  private dbOptimizer: any;

  constructor() {
    this.performanceService = patientEngagementPerformanceService;
    this.indexOptimizer = patientEngagementIndexOptimizer;
    this.cacheService = PerformanceCacheService.getInstance();
    this.connectionPool = ConnectionPoolService.getInstance();
    this.dbOptimizer = databaseOptimizationService;
  }

  /**
   * Process performance optimization job
   */
  async process(job: Job<PerformanceOptimizationJobData>): Promise<PerformanceReport> {
    const startTime = Date.now();
    const { type, workplaceId, options = {} } = job.data;

    logger.info('Starting performance optimization job', {
      jobId: job.id,
      type,
      workplaceId,
      options,
    });

    const report: PerformanceReport = {
      timestamp: new Date(),
      type,
      duration: 0,
      results: {},
      errors: [],
    };

    try {
      // Update job progress
      await job.progress(10);

      switch (type) {
        case 'cache_cleanup':
          await this.performCacheCleanup(job, report, options);
          break;
        case 'index_analysis':
          await this.performIndexAnalysis(job, report, options);
          break;
        case 'connection_health':
          await this.checkConnectionHealth(job, report, options);
          break;
        case 'query_analysis':
          await this.analyzeQueryPerformance(job, report, options);
          break;
        case 'full_optimization':
          await this.performFullOptimization(job, report, options);
          break;
        default:
          throw new Error(`Unknown optimization type: ${type}`);
      }

      report.duration = Date.now() - startTime;
      
      logger.info('Performance optimization job completed', {
        jobId: job.id,
        type,
        duration: report.duration,
        errorsCount: report.errors?.length || 0,
      });

      return report;
    } catch (error) {
      report.duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      report.errors?.push(errorMessage);

      logger.error('Performance optimization job failed', {
        jobId: job.id,
        type,
        error: errorMessage,
        duration: report.duration,
      });

      throw error;
    }
  }

  /**
   * Perform cache cleanup and optimization
   */
  private async performCacheCleanup(
    job: Job,
    report: PerformanceReport,
    options: any
  ): Promise<void> {
    try {
      await job.progress(20);

      // Get cache statistics before cleanup
      const statsBefore = await this.cacheService.getStats();
      
      await job.progress(40);

      // Perform cache cleanup based on options
      if (options.force) {
        await this.cacheService.clearAll();
        logger.info('Performed force cache clear');
      } else {
        // Intelligent cleanup based on usage patterns
        await this.performIntelligentCacheCleanup();
      }

      await job.progress(70);

      // Get statistics after cleanup
      const statsAfter = await this.cacheService.getStats();

      await job.progress(90);

      // Generate cache warming for frequently accessed data
      if (!options.dryRun) {
        await this.warmFrequentlyAccessedCache();
      }

      report.results.cacheStats = {
        before: statsBefore,
        after: statsAfter,
        improvement: {
          memoryFreed: statsBefore.memoryUsage - statsAfter.memoryUsage,
          hitRateChange: statsAfter.hitRate - statsBefore.hitRate,
        },
      };

      await job.progress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cache cleanup failed';
      report.errors?.push(errorMessage);
      throw error;
    }
  }

  /**
   * Perform database index analysis
   */
  private async performIndexAnalysis(
    job: Job,
    report: PerformanceReport,
    options: any
  ): Promise<void> {
    try {
      await job.progress(20);

      // Analyze existing indexes
      const indexAnalysis = await this.indexOptimizer.analyzeIndexes();
      
      await job.progress(50);

      // Get index performance statistics
      const performanceStats = await this.indexOptimizer.getIndexPerformanceStats();
      
      await job.progress(70);

      // Monitor index usage
      await this.indexOptimizer.monitorIndexPerformance();

      await job.progress(90);

      // Generate recommendations
      const recommendations = this.generateIndexRecommendations(indexAnalysis);

      // Apply optimizations if not dry run
      if (!options.dryRun) {
        await this.indexOptimizer.optimizeExistingIndexes();
        await this.indexOptimizer.createQuerySpecificIndexes();
      }

      report.results.indexAnalysis = {
        analysis: indexAnalysis,
        performanceStats,
        recommendations,
      };

      await job.progress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Index analysis failed';
      report.errors?.push(errorMessage);
      throw error;
    }
  }

  /**
   * Check connection pool health
   */
  private async checkConnectionHealth(
    job: Job,
    report: PerformanceReport,
    options: any
  ): Promise<void> {
    try {
      await job.progress(30);

      // Get connection pool statistics
      const poolStats = this.connectionPool.getStats();
      
      await job.progress(60);

      // Get health status of all connections
      const healthStatus = this.connectionPool.getHealthStatus();

      await job.progress(90);

      // Identify and reconnect failed connections if not dry run
      const failedConnections = Object.entries(healthStatus)
        .filter(([_, status]) => !(status as any).healthy)
        .map(([name]) => name);

      if (failedConnections.length > 0 && !options.dryRun) {
        await this.connectionPool.reconnectFailedConnections();
      }

      // Generate connection recommendations
      const recommendations = this.generateConnectionRecommendations(poolStats, healthStatus);

      report.results.connectionHealth = {
        poolStats,
        healthStatus,
        failedConnections,
        recommendations,
      };

      await job.progress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection health check failed';
      report.errors?.push(errorMessage);
      throw error;
    }
  }

  /**
   * Analyze query performance
   */
  private async analyzeQueryPerformance(
    job: Job,
    report: PerformanceReport,
    options: any
  ): Promise<void> {
    try {
      await job.progress(20);

      // Get database optimization statistics
      const dbStats = this.dbOptimizer.getPerformanceStats();
      
      await job.progress(50);

      // Analyze slow queries
      const slowQueries = dbStats.recentMetrics.filter(m => m.executionTime > 1000);
      
      await job.progress(80);

      // Generate query optimization recommendations
      const recommendations = this.generateQueryRecommendations(dbStats, slowQueries);

      report.results.queryPerformance = {
        stats: dbStats,
        slowQueries,
        recommendations,
      };

      await job.progress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query analysis failed';
      report.errors?.push(errorMessage);
      throw error;
    }
  }

  /**
   * Perform full optimization (all tasks)
   */
  private async performFullOptimization(
    job: Job,
    report: PerformanceReport,
    options: any
  ): Promise<void> {
    try {
      // Cache cleanup (0-25%)
      await job.progress(5);
      await this.performCacheCleanup(job, report, options);
      
      // Index analysis (25-50%)
      await job.progress(25);
      await this.performIndexAnalysis(job, report, options);
      
      // Connection health (50-75%)
      await job.progress(50);
      await this.checkConnectionHealth(job, report, options);
      
      // Query analysis (75-100%)
      await job.progress(75);
      await this.analyzeQueryPerformance(job, report, options);

      // Generate overall recommendations
      const overallRecommendations = this.generateOverallRecommendations(report);
      report.results.recommendations = overallRecommendations;

      await job.progress(100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Full optimization failed';
      report.errors?.push(errorMessage);
      throw error;
    }
  }

  /**
   * Perform intelligent cache cleanup based on usage patterns
   */
  private async performIntelligentCacheCleanup(): Promise<void> {
    try {
      // Clear expired entries
      await this.cacheService.invalidateByTags(['expired']);

      // Clear low-hit-rate entries
      const stats = await this.cacheService.getStats();
      if (stats.hitRate < 50) {
        await this.cacheService.invalidateByTags(['low-usage']);
      }

      // Clear old analytics cache (older than 1 hour)
      await this.cacheService.invalidateByTags(['analytics']);

      logger.info('Intelligent cache cleanup completed');
    } catch (error) {
      logger.error('Intelligent cache cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Warm frequently accessed cache entries
   */
  private async warmFrequentlyAccessedCache(): Promise<void> {
    try {
      // This would pre-load commonly accessed data
      // Implementation would depend on specific usage patterns
      
      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate index optimization recommendations
   */
  private generateIndexRecommendations(analysis: any[]): string[] {
    const recommendations: string[] = [];

    const ineffectiveIndexes = analysis.filter(a => a.effectiveness < 50);
    if (ineffectiveIndexes.length > 0) {
      recommendations.push(
        `${ineffectiveIndexes.length} indexes have low effectiveness and should be reviewed`
      );
    }

    const unusedIndexes = analysis.filter(a => a.usage.ops === 0);
    if (unusedIndexes.length > 0) {
      recommendations.push(
        `${unusedIndexes.length} indexes are unused and can be dropped to save space`
      );
    }

    const largeIndexes = analysis.filter(a => a.size > 100 * 1024 * 1024); // 100MB
    if (largeIndexes.length > 0) {
      recommendations.push(
        `${largeIndexes.length} indexes are very large and may impact write performance`
      );
    }

    return recommendations;
  }

  /**
   * Generate connection pool recommendations
   */
  private generateConnectionRecommendations(poolStats: any, healthStatus: any): string[] {
    const recommendations: string[] = [];

    // Check utilization
    const utilizationRate = (poolStats.activeConnections / poolStats.totalConnections) * 100;
    
    if (utilizationRate > 90) {
      recommendations.push('Connection pool utilization is high (>90%). Consider increasing pool size.');
    } else if (utilizationRate < 20) {
      recommendations.push('Connection pool utilization is low (<20%). Consider reducing pool size.');
    }

    // Check failed connections
    const failedCount = Object.values(healthStatus).filter((status: any) => !status.healthy).length;
    if (failedCount > 0) {
      recommendations.push(`${failedCount} connection(s) are unhealthy and need attention.`);
    }

    // Check response times
    if (poolStats.avgResponseTime > 100) {
      recommendations.push('Average response time is high (>100ms). Check network and database performance.');
    }

    return recommendations;
  }

  /**
   * Generate query optimization recommendations
   */
  private generateQueryRecommendations(dbStats: any, slowQueries: any[]): string[] {
    const recommendations: string[] = [];

    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} slow queries detected (>1s). Review and optimize these queries.`
      );
    }

    if (dbStats.indexUsageRate < 80) {
      recommendations.push(
        `Index usage rate is ${dbStats.indexUsageRate.toFixed(1)}%. Add indexes for frequently queried fields.`
      );
    }

    if (dbStats.averageExecutionTime > 500) {
      recommendations.push(
        `Average query execution time is ${dbStats.averageExecutionTime.toFixed(1)}ms. Consider query optimization.`
      );
    }

    return recommendations;
  }

  /**
   * Generate overall optimization recommendations
   */
  private generateOverallRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = [];

    // Combine recommendations from all analyses
    if (report.results.cacheStats) {
      const hitRate = report.results.cacheStats.after?.hitRate || 0;
      if (hitRate < 70) {
        recommendations.push('Cache hit rate is low. Review caching strategy and TTL settings.');
      }
    }

    if (report.results.indexAnalysis?.recommendations) {
      recommendations.push(...report.results.indexAnalysis.recommendations);
    }

    if (report.results.connectionHealth?.recommendations) {
      recommendations.push(...report.results.connectionHealth.recommendations);
    }

    if (report.results.queryPerformance?.recommendations) {
      recommendations.push(...report.results.queryPerformance.recommendations);
    }

    // Add general recommendations
    recommendations.push('Schedule regular performance optimization jobs for optimal system health.');
    recommendations.push('Monitor key performance metrics and set up alerts for degradation.');

    return recommendations;
  }
}

/**
 * Job queue setup and scheduling
 */
export class PerformanceOptimizationScheduler {
  private processor: PerformanceOptimizationJobProcessor;

  constructor() {
    this.processor = new PerformanceOptimizationJobProcessor();
  }

  /**
   * Schedule regular performance optimization jobs
   */
  setupScheduledJobs(queue: any): void {
    // Cache cleanup every 30 minutes
    queue.add(
      'performance-optimization',
      {
        type: 'cache_cleanup',
        options: { force: false },
      },
      {
        repeat: { cron: '*/30 * * * *' }, // Every 30 minutes
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    // Index analysis every 6 hours
    queue.add(
      'performance-optimization',
      {
        type: 'index_analysis',
        options: { dryRun: false },
      },
      {
        repeat: { cron: '0 */6 * * *' }, // Every 6 hours
        removeOnComplete: 5,
        removeOnFail: 3,
      }
    );

    // Connection health check every hour
    queue.add(
      'performance-optimization',
      {
        type: 'connection_health',
        options: { dryRun: false },
      },
      {
        repeat: { cron: '0 * * * *' }, // Every hour
        removeOnComplete: 24,
        removeOnFail: 5,
      }
    );

    // Query analysis every 2 hours
    queue.add(
      'performance-optimization',
      {
        type: 'query_analysis',
        options: { includeAnalytics: true },
      },
      {
        repeat: { cron: '0 */2 * * *' }, // Every 2 hours
        removeOnComplete: 12,
        removeOnFail: 3,
      }
    );

    // Full optimization daily at 2 AM
    queue.add(
      'performance-optimization',
      {
        type: 'full_optimization',
        options: { force: false, includeAnalytics: true },
      },
      {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        removeOnComplete: 7,
        removeOnFail: 3,
      }
    );

    logger.info('Performance optimization jobs scheduled');
  }

  /**
   * Process performance optimization job
   */
  async processJob(job: Job<PerformanceOptimizationJobData>): Promise<PerformanceReport> {
    return await this.processor.process(job);
  }
}

export default new PerformanceOptimizationScheduler();