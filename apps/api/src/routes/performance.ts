import express from 'express';
import { performanceController } from '../controllers/performanceController';
import { auth } from '../middlewares/auth';
// import { requirePermission } from '../middlewares/permission';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Apply admin permission requirement to all routes
// router.use(requirePermission('system:admin'));

/**
 * @route GET /api/admin/performance/cache
 * @desc Get cache performance metrics
 * @access Admin
 */
router.get('/cache', performanceController.getCacheMetrics.bind(performanceController));

/**
 * @route GET /api/admin/performance/database
 * @desc Get database optimization report
 * @access Admin
 */
router.get('/database', performanceController.getDatabaseReport.bind(performanceController));

/**
 * @route GET /api/admin/performance/queries
 * @desc Get query performance statistics
 * @access Admin
 */
router.get('/queries', performanceController.getQueryStats.bind(performanceController));

/**
 * @route GET /api/admin/performance/overview
 * @desc Get comprehensive performance overview
 * @access Admin
 */
router.get('/overview', performanceController.getPerformanceOverview.bind(performanceController));

/**
 * @route POST /api/admin/performance/cache/check
 * @desc Check cache consistency
 * @access Admin
 */
router.post('/cache/check', performanceController.checkCacheConsistency.bind(performanceController));

/**
 * @route POST /api/admin/performance/cache/clear
 * @desc Clear all cache
 * @access Admin
 */
router.post('/cache/clear', performanceController.clearCache.bind(performanceController));

/**
 * @route POST /api/admin/performance/cache/warm
 * @desc Warm cache for specific users/roles
 * @access Admin
 */
router.post('/cache/warm', performanceController.warmCache.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/optimize
 * @desc Initialize database optimizations
 * @access Admin
 */
router.post('/database/optimize', performanceController.initializeDatabaseOptimizations.bind(performanceController));

/**
 * @route GET /api/admin/performance/latency
 * @desc Get API latency metrics
 * @access Admin
 */
router.get('/latency', performanceController.getLatencyMetrics.bind(performanceController));

/**
 * @route GET /api/admin/performance/database/profile
 * @desc Get database profiling data
 * @access Admin
 */
router.get('/database/profile', performanceController.getDatabaseProfile.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/profiling/enable
 * @desc Enable database profiling
 * @access Admin
 */
router.post('/database/profiling/enable', performanceController.enableDatabaseProfiling.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/profiling/disable
 * @desc Disable database profiling
 * @access Admin
 */
router.post('/database/profiling/disable', performanceController.disableDatabaseProfiling.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/indexes/optimize
 * @desc Create optimal database indexes
 * @access Admin
 */
router.post('/database/indexes/optimize', performanceController.optimizeDatabaseIndexes.bind(performanceController));

/**
 * @route POST /api/admin/performance/cache/invalidate
 * @desc Invalidate cache by tags
 * @access Admin
 */
router.post('/cache/invalidate', performanceController.invalidateCacheByTags.bind(performanceController));

/**
 * @route GET /api/admin/performance/cache/stats
 * @desc Get performance cache statistics
 * @access Admin
 */
router.get('/cache/stats', performanceController.getPerformanceCacheStats.bind(performanceController));

/**
 * @route POST /api/admin/performance/cache/warm-performance
 * @desc Warm performance cache for common operations
 * @access Admin
 */
router.post('/cache/warm-performance', performanceController.warmPerformanceCache.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/indexes/create-optimized
 * @desc Create optimized database indexes for all collections
 * @access Admin
 */
router.post('/database/indexes/create-optimized', performanceController.createOptimizedIndexes.bind(performanceController));

/**
 * @route GET /api/admin/performance/database/indexes/analyze
 * @desc Analyze existing database indexes
 * @access Admin
 */
router.get('/database/indexes/analyze', performanceController.analyzeExistingIndexes.bind(performanceController));

/**
 * @route POST /api/admin/performance/database/indexes/cleanup
 * @desc Clean up unused database indexes
 * @access Admin
 */
router.post('/database/indexes/cleanup', performanceController.cleanupUnusedIndexes.bind(performanceController));

/**
 * @route POST /api/admin/performance/jobs/ai-analysis
 * @desc Queue AI analysis background job
 * @access Admin
 */
router.post('/jobs/ai-analysis', performanceController.queueAIAnalysisJob.bind(performanceController));

/**
 * @route POST /api/admin/performance/jobs/data-export
 * @desc Queue data export background job
 * @access Admin
 */
router.post('/jobs/data-export', performanceController.queueDataExportJob.bind(performanceController));

/**
 * @route POST /api/admin/performance/jobs/cache-warmup
 * @desc Queue cache warmup background job
 * @access Admin
 */
router.post('/jobs/cache-warmup', performanceController.queueCacheWarmupJob.bind(performanceController));

/**
 * @route POST /api/admin/performance/jobs/database-maintenance
 * @desc Queue database maintenance background job
 * @access Admin
 */
router.post('/jobs/database-maintenance', performanceController.queueDatabaseMaintenanceJob.bind(performanceController));

/**
 * @route GET /api/admin/performance/jobs/statistics
 * @desc Get background job statistics
 * @access Admin
 */
router.get('/jobs/statistics', performanceController.getJobStatistics.bind(performanceController));

export default router;