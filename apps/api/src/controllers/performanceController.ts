import { Request, Response } from 'express';
import DynamicPermissionService from '../services/DynamicPermissionService';
import CacheManager from '../services/CacheManager';
import PerformanceCacheService from '../services/PerformanceCacheService';
import DatabaseOptimizationService from '../services/DatabaseOptimizationService';
import PerformanceDatabaseOptimizer from '../services/PerformanceDatabaseOptimizer';
import PerformanceJobService from '../services/PerformanceJobService';
import DatabaseProfiler from '../services/DatabaseProfiler';
import { latencyTracker } from '../middlewares/latencyMeasurement';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export class PerformanceController {
    private dynamicPermissionService: DynamicPermissionService;
    private cacheManager: CacheManager;
    private performanceCacheService: PerformanceCacheService;
    private dbOptimizationService: any;
    private performanceDatabaseOptimizer: PerformanceDatabaseOptimizer;
    private performanceJobService: PerformanceJobService;

    constructor() {
        this.dynamicPermissionService = DynamicPermissionService.getInstance();
        this.cacheManager = CacheManager.getInstance();
        this.performanceCacheService = PerformanceCacheService.getInstance();
        // this.dbOptimizationService = DatabaseOptimizationService.getInstance();
        this.dbOptimizationService = null; // Service initialization disabled for now
        this.performanceDatabaseOptimizer = PerformanceDatabaseOptimizer.getInstance();
        this.performanceJobService = PerformanceJobService.getInstance();
    }

    /**
     * Get cache performance metrics
     * GET /api/admin/performance/cache
     */
    async getCacheMetrics(req: AuthRequest, res: Response): Promise<any> {
        try {
            const [rbacMetrics, performanceMetrics] = await Promise.all([
                this.cacheManager.getMetrics(),
                this.performanceCacheService.getStats()
            ]);

            res.json({
                success: true,
                data: {
                    rbacCache: rbacMetrics,
                    performanceCache: performanceMetrics,
                    combined: {
                        totalHits: rbacMetrics.hits + performanceMetrics.hits,
                        totalMisses: rbacMetrics.misses + performanceMetrics.misses,
                        overallHitRate: ((rbacMetrics.hits + performanceMetrics.hits) /
                            (rbacMetrics.totalOperations + performanceMetrics.hits + performanceMetrics.misses)) * 100,
                        totalMemoryUsage: rbacMetrics.memoryUsage + performanceMetrics.memoryUsage,
                        totalKeys: rbacMetrics.keyCount + performanceMetrics.keyCount
                    },
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting cache metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving cache metrics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get database optimization report
     * GET /api/admin/performance/database
     */
    async getDatabaseReport(req: AuthRequest, res: Response): Promise<any> {
        try {
            const report = await this.dbOptimizationService.analyzeQueryPerformance();

            res.json({
                success: true,
                data: report
            });

        } catch (error) {
            logger.error('Error getting database report:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving database optimization report',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get query performance statistics
     * GET /api/admin/performance/queries
     */
    async getQueryStats(req: AuthRequest, res: Response): Promise<any> {
        try {
            const stats = this.dbOptimizationService.getQueryStats();

            res.json({
                success: true,
                data: {
                    stats,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting query stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving query statistics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Check cache consistency
     * POST /api/admin/performance/cache/check
     */
    async checkCacheConsistency(req: AuthRequest, res: Response): Promise<any> {
        try {
            const result = await this.dynamicPermissionService.checkCacheConsistency();

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            logger.error('Error checking cache consistency:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking cache consistency',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Initialize database optimizations
     * POST /api/admin/performance/database/optimize
     */
    async initializeDatabaseOptimizations(req: AuthRequest, res: Response): Promise<any> {
        try {
            await this.dynamicPermissionService.initializeDatabaseOptimizations();

            res.json({
                success: true,
                message: 'Database optimizations initialized successfully'
            });

        } catch (error) {
            logger.error('Error initializing database optimizations:', error);
            res.status(500).json({
                success: false,
                message: 'Error initializing database optimizations',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Clear cache
     * POST /api/admin/performance/cache/clear
     */
    async clearCache(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { type } = req.body;

            if (type === 'rbac') {
                await this.cacheManager.clearAll();
            } else if (type === 'performance') {
                await this.performanceCacheService.clearAll();
            } else {
                // Clear both caches
                await Promise.all([
                    this.cacheManager.clearAll(),
                    this.performanceCacheService.clearAll()
                ]);
            }

            res.json({
                success: true,
                message: `Cache cleared successfully${type ? ` (${type})` : ' (all)'}`
            });

        } catch (error) {
            logger.error('Error clearing cache:', error);
            res.status(500).json({
                success: false,
                message: 'Error clearing cache',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Warm cache for specific users/roles
     * POST /api/admin/performance/cache/warm
     */
    async warmCache(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { userIds, roleIds, commonActions, workspaceId } = req.body;

            await this.dynamicPermissionService.warmPermissionCache({
                userIds,
                roleIds,
                commonActions,
                workspaceId
            });

            res.json({
                success: true,
                message: 'Cache warming initiated successfully'
            });

        } catch (error) {
            logger.error('Error warming cache:', error);
            res.status(500).json({
                success: false,
                message: 'Error warming cache',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get comprehensive performance overview
     * GET /api/admin/performance/overview
     */
    async getPerformanceOverview(req: AuthRequest, res: Response): Promise<any> {
        try {
            const [cacheMetrics, queryStats, dbReport] = await Promise.all([
                this.cacheManager.getMetrics(),
                this.dbOptimizationService.getQueryStats(),
                this.dbOptimizationService.analyzeQueryPerformance()
            ]);

            const overview = {
                cache: {
                    hitRate: cacheMetrics.hitRate,
                    totalOperations: cacheMetrics.totalOperations,
                    memoryUsage: cacheMetrics.memoryUsage,
                    keyCount: cacheMetrics.keyCount
                },
                queries: {
                    totalQueries: queryStats.totalQueries,
                    slowQueries: queryStats.slowQueries,
                    averageExecutionTime: queryStats.averageExecutionTime,
                    indexUsageRate: queryStats.indexUsageRate
                },
                database: {
                    slowQueriesCount: dbReport.slowQueries.length,
                    recommendationsCount: dbReport.indexRecommendations.length,
                    highPriorityRecommendations: dbReport.indexRecommendations.filter(r => r.priority === 'high').length
                },
                timestamp: new Date()
            };

            res.json({
                success: true,
                data: overview
            });

        } catch (error) {
            logger.error('Error getting performance overview:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving performance overview',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get API latency metrics
     * GET /api/admin/performance/latency
     */
    async getLatencyMetrics(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { endpoint } = req.query;

            const stats = latencyTracker.getStats(endpoint as string);
            const topEndpoints = latencyTracker.getTopEndpoints(10);
            const recentMetrics = latencyTracker.getMetrics(endpoint as string, 100);

            res.json({
                success: true,
                data: {
                    stats,
                    topEndpoints,
                    recentMetrics,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting latency metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving latency metrics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get database profiling data
     * GET /api/admin/performance/database/profile
     */
    async getDatabaseProfile(req: AuthRequest, res: Response): Promise<any> {
        try {
            const stats = await DatabaseProfiler.getDatabaseStats();
            const slowQueries = DatabaseProfiler.getSlowQueries(50);
            const queryAnalysis = await DatabaseProfiler.analyzeSlowQueries();

            res.json({
                success: true,
                data: {
                    stats,
                    slowQueries,
                    queryAnalysis,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting database profile:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving database profile',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Enable database profiling
     * POST /api/admin/performance/database/profiling/enable
     */
    async enableDatabaseProfiling(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { slowMs = 100 } = req.body;

            await DatabaseProfiler.enableProfiling(slowMs);

            res.json({
                success: true,
                message: `Database profiling enabled for operations slower than ${slowMs}ms`,
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error enabling database profiling:', error);
            res.status(500).json({
                success: false,
                message: 'Error enabling database profiling',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Disable database profiling
     * POST /api/admin/performance/database/profiling/disable
     */
    async disableDatabaseProfiling(req: AuthRequest, res: Response): Promise<any> {
        try {
            await DatabaseProfiler.disableProfiling();

            res.json({
                success: true,
                message: 'Database profiling disabled',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error disabling database profiling:', error);
            res.status(500).json({
                success: false,
                message: 'Error disabling database profiling',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Create optimal database indexes
     * POST /api/admin/performance/database/indexes/optimize
     */
    async optimizeDatabaseIndexes(req: AuthRequest, res: Response): Promise<any> {
        try {
            await DatabaseProfiler.createOptimalIndexes();

            res.json({
                success: true,
                message: 'Database indexes optimized successfully',
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error optimizing database indexes:', error);
            res.status(500).json({
                success: false,
                message: 'Error optimizing database indexes',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Invalidate cache by tags
     * POST /api/admin/performance/cache/invalidate
     */
    async invalidateCacheByTags(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { tags } = req.body;

            if (!tags || !Array.isArray(tags)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tags array is required'
                });
            }

            const deletedCount = await this.performanceCacheService.invalidateByTags(tags);

            res.json({
                success: true,
                message: `Invalidated ${deletedCount} cache entries`,
                data: {
                    deletedCount,
                    tags
                }
            });

        } catch (error) {
            logger.error('Error invalidating cache by tags:', error);
            res.status(500).json({
                success: false,
                message: 'Error invalidating cache',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get performance cache statistics
     * GET /api/admin/performance/cache/stats
     */
    async getPerformanceCacheStats(req: AuthRequest, res: Response): Promise<any> {
        try {
            const stats = await this.performanceCacheService.getStats();

            res.json({
                success: true,
                data: {
                    stats,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting performance cache stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving performance cache statistics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Warm performance cache for common operations
     * POST /api/admin/performance/cache/warm-performance
     */
    async warmPerformanceCache(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { operations = [] } = req.body;

            // This would implement cache warming for common operations
            // For now, just acknowledge the request
            logger.info('Performance cache warming requested for operations:', operations);

            res.json({
                success: true,
                message: 'Performance cache warming initiated',
                data: {
                    operations,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error warming performance cache:', error);
            res.status(500).json({
                success: false,
                message: 'Error warming performance cache',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Create optimized database indexes
     * POST /api/admin/performance/database/indexes/create-optimized
     */
    async createOptimizedIndexes(req: AuthRequest, res: Response): Promise<any> {
        try {
            logger.info('Creating optimized database indexes');

            const result = await this.performanceDatabaseOptimizer.createAllOptimizedIndexes();

            res.json({
                success: true,
                message: 'Database indexes optimization completed',
                data: {
                    totalIndexes: result.totalIndexes,
                    successfulIndexes: result.successfulIndexes,
                    failedIndexes: result.failedIndexes,
                    executionTime: result.executionTime,
                    timestamp: result.timestamp,
                    summary: result.results.reduce((acc, r) => {
                        if (!acc[r.collection]) {
                            acc[r.collection] = { attempted: 0, created: 0, failed: 0 };
                        }
                        acc[r.collection].attempted++;
                        if (r.created) {
                            acc[r.collection].created++;
                        } else {
                            acc[r.collection].failed++;
                        }
                        return acc;
                    }, {} as Record<string, any>)
                }
            });

        } catch (error) {
            logger.error('Error creating optimized indexes:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating optimized database indexes',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Analyze existing database indexes
     * GET /api/admin/performance/database/indexes/analyze
     */
    async analyzeExistingIndexes(req: AuthRequest, res: Response): Promise<any> {
        try {
            const analysis = await this.performanceDatabaseOptimizer.analyzeExistingIndexes();

            res.json({
                success: true,
                data: {
                    analysis,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error analyzing existing indexes:', error);
            res.status(500).json({
                success: false,
                message: 'Error analyzing existing database indexes',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Drop unused database indexes
     * POST /api/admin/performance/database/indexes/cleanup
     */
    async cleanupUnusedIndexes(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { dryRun = true } = req.body;

            const result = await this.performanceDatabaseOptimizer.dropUnusedIndexes(dryRun);

            res.json({
                success: true,
                message: dryRun ? 'Unused indexes analysis completed' : 'Unused indexes cleanup completed',
                data: {
                    droppedIndexes: result.droppedIndexes,
                    errors: result.errors,
                    dryRun,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error cleaning up unused indexes:', error);
            res.status(500).json({
                success: false,
                message: 'Error cleaning up unused database indexes',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Queue AI analysis job
     * POST /api/admin/performance/jobs/ai-analysis
     */
    async queueAIAnalysisJob(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { type, patientId, parameters, priority = 'medium' } = req.body;

            if (!type || !patientId) {
                return res.status(400).json({
                    success: false,
                    message: 'Type and patientId are required'
                });
            }

            const job = await this.performanceJobService.queueAIAnalysis({
                type,
                patientId,
                workspaceId: req.user?.workplaceId?.toString() || '',
                userId: req.user?.id?.toString() || '',
                parameters: parameters || {},
                priority,
            });

            res.json({
                success: true,
                message: 'AI analysis job queued successfully',
                data: {
                    jobId: job.id,
                    type,
                    priority,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error queuing AI analysis job:', error);
            res.status(500).json({
                success: false,
                message: 'Error queuing AI analysis job',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Queue data export job
     * POST /api/admin/performance/jobs/data-export
     */
    async queueDataExportJob(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { type, filters, format, fileName, includeAttachments = false } = req.body;

            if (!type || !format || !fileName) {
                return res.status(400).json({
                    success: false,
                    message: 'Type, format, and fileName are required'
                });
            }

            const job = await this.performanceJobService.queueDataExport({
                type,
                workspaceId: req.user?.workplaceId?.toString() || '',
                userId: req.user?.id?.toString() || '',
                userEmail: req.user?.email || '',
                filters: filters || {},
                format,
                fileName,
                includeAttachments,
            });

            res.json({
                success: true,
                message: 'Data export job queued successfully',
                data: {
                    jobId: job.id,
                    type,
                    format,
                    fileName,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error queuing data export job:', error);
            res.status(500).json({
                success: false,
                message: 'Error queuing data export job',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Queue cache warmup job
     * POST /api/admin/performance/jobs/cache-warmup
     */
    async queueCacheWarmupJob(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { type, targetUsers, priority = 'low' } = req.body;

            if (!type) {
                return res.status(400).json({
                    success: false,
                    message: 'Type is required'
                });
            }

            const job = await this.performanceJobService.queueCacheWarmup({
                type,
                workspaceId: req.user?.workplaceId?.toString() || '',
                targetUsers,
                priority,
            });

            res.json({
                success: true,
                message: 'Cache warmup job queued successfully',
                data: {
                    jobId: job.id,
                    type,
                    priority,
                    targetUsers: targetUsers?.length || 'all',
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error queuing cache warmup job:', error);
            res.status(500).json({
                success: false,
                message: 'Error queuing cache warmup job',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Queue database maintenance job
     * POST /api/admin/performance/jobs/database-maintenance
     */
    async queueDatabaseMaintenanceJob(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { type, parameters = {} } = req.body;

            if (!type) {
                return res.status(400).json({
                    success: false,
                    message: 'Type is required'
                });
            }

            const job = await this.performanceJobService.queueDatabaseMaintenance({
                type,
                workspaceId: req.user?.workplaceId?.toString(),
                parameters,
            });

            res.json({
                success: true,
                message: 'Database maintenance job queued successfully',
                data: {
                    jobId: job.id,
                    type,
                    parameters: Object.keys(parameters),
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error queuing database maintenance job:', error);
            res.status(500).json({
                success: false,
                message: 'Error queuing database maintenance job',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }

    /**
     * Get job statistics
     * GET /api/admin/performance/jobs/statistics
     */
    async getJobStatistics(req: AuthRequest, res: Response): Promise<any> {
        try {
            const statistics = await this.performanceJobService.getJobStatistics();

            res.json({
                success: true,
                data: {
                    statistics,
                    timestamp: new Date()
                }
            });

        } catch (error) {
            logger.error('Error getting job statistics:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving job statistics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
            });
        }
    }
}

export const performanceController = new PerformanceController();
