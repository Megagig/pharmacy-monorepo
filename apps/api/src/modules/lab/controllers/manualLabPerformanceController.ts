import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import ManualLabPerformanceService from '../services/manualLabPerformanceService';
import ManualLabCacheService from '../services/manualLabCacheService';

// Import utilities
import {
    sendSuccess,
    sendError,
    asyncHandler,
    getRequestContext,
} from '../../../utils/responseHelpers';

// Import logger
import logger from '../../../utils/logger';

/**
 * Manual Lab Performance Monitoring Controller
 * Provides API endpoints for performance metrics and monitoring
 */

// ===============================
// PERFORMANCE METRICS ENDPOINTS
// ===============================

/**
 * GET /api/manual-lab-orders/performance/summary
 * Get performance summary for a time range
 */
export const getPerformanceSummary = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { startTime, endTime } = req.query;

        if (!startTime || !endTime) {
            return sendError(res, 'VALIDATION_ERROR', 'Start time and end time are required', 400);
        }

        try {
            const start = new Date(startTime as string);
            const end = new Date(endTime as string);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return sendError(res, 'VALIDATION_ERROR', 'Invalid date format', 400);
            }

            if (start >= end) {
                return sendError(res, 'VALIDATION_ERROR', 'Start time must be before end time', 400);
            }

            // Limit time range to prevent excessive data retrieval
            const maxRangeMs = 30 * 24 * 60 * 60 * 1000; // 30 days
            if (end.getTime() - start.getTime() > maxRangeMs) {
                return sendError(res, 'VALIDATION_ERROR', 'Time range cannot exceed 30 days', 400);
            }

            const summary = await ManualLabPerformanceService.getPerformanceSummary(
                context.workplaceId,
                start,
                end
            );

            sendSuccess(res, {
                summary,
                metadata: {
                    requestedRange: {
                        start: start.toISOString(),
                        end: end.toISOString()
                    },
                    generatedAt: new Date().toISOString()
                }
            });

            logger.info('Performance summary retrieved', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                timeRange: `${start.toISOString()} - ${end.toISOString()}`,
                totalOrders: summary.totalOrders,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to retrieve performance summary', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                startTime,
                endTime,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve performance summary', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/performance/realtime
 * Get real-time performance metrics
 */
export const getRealTimeMetrics = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const metrics = await ManualLabPerformanceService.getRealTimeMetrics(context.workplaceId);

            sendSuccess(res, {
                metrics,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    dataFreshness: '5 minutes'
                }
            });

            logger.debug('Real-time metrics retrieved', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                activeOrders: metrics.activeOrders,
                averageResponseTime: metrics.averageResponseTime,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to retrieve real-time metrics', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve real-time metrics', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/performance/alerts
 * Get performance alerts
 */
export const getPerformanceAlerts = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const alerts = await ManualLabPerformanceService.getPerformanceAlerts(context.workplaceId);

            sendSuccess(res, {
                alerts,
                metadata: {
                    alertCount: alerts.length,
                    criticalAlerts: alerts.filter(a => a.type === 'critical').length,
                    warningAlerts: alerts.filter(a => a.type === 'warning').length,
                    generatedAt: new Date().toISOString()
                }
            });

            if (alerts.length > 0) {
                logger.warn('Performance alerts detected', {
                    workplaceId: context.workplaceId,
                    userId: context.userId,
                    alertCount: alerts.length,
                    criticalAlerts: alerts.filter(a => a.type === 'critical').length,
                    service: 'manual-lab-performance-api'
                });
            }
        } catch (error) {
            logger.error('Failed to retrieve performance alerts', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve performance alerts', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/performance/cache-stats
 * Get cache performance statistics
 */
export const getCacheStats = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const stats = await ManualLabCacheService.getCacheStats();

            sendSuccess(res, {
                stats,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    workplaceId: context.workplaceId
                }
            });

            logger.debug('Cache statistics retrieved', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                redisConnected: stats.redisConnected,
                manualLabKeys: stats.manualLabKeys,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to retrieve cache statistics', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve cache statistics', 500);
        }
    }
);

/**
 * POST /api/manual-lab-orders/performance/cache/clear
 * Clear cache for the workplace (admin only)
 */
export const clearWorkplaceCache = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        // Check if user has admin privileges
        if (!req.user || !['owner', 'admin'].includes(req.user.role)) {
            return sendError(res, 'FORBIDDEN', 'Insufficient permissions to clear cache', 403);
        }

        try {
            await ManualLabCacheService.clearWorkplaceCache(new mongoose.Types.ObjectId(context.workplaceId));

            sendSuccess(res, {
                message: 'Workplace cache cleared successfully',
                metadata: {
                    workplaceId: context.workplaceId,
                    clearedAt: new Date().toISOString(),
                    clearedBy: context.userId
                }
            });

            logger.info('Workplace cache cleared', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                userRole: req.user.role,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to clear workplace cache', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to clear workplace cache', 500);
        }
    }
);

/**
 * GET /api/manual-lab-orders/performance/health
 * Get system health status
 */
export const getSystemHealth = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        try {
            const [realTimeMetrics, cacheStats, alerts] = await Promise.all([
                ManualLabPerformanceService.getRealTimeMetrics(context.workplaceId),
                ManualLabCacheService.getCacheStats(),
                ManualLabPerformanceService.getPerformanceAlerts(context.workplaceId)
            ]);

            // Determine overall health status
            const criticalAlerts = alerts.filter(a => a.type === 'critical');
            const warningAlerts = alerts.filter(a => a.type === 'warning');

            let healthStatus: 'healthy' | 'warning' | 'critical';
            if (criticalAlerts.length > 0) {
                healthStatus = 'critical';
            } else if (warningAlerts.length > 0 || realTimeMetrics.errorRate > 5) {
                healthStatus = 'warning';
            } else {
                healthStatus = 'healthy';
            }

            const health = {
                status: healthStatus,
                timestamp: new Date().toISOString(),
                metrics: {
                    activeOrders: realTimeMetrics.activeOrders,
                    averageResponseTime: realTimeMetrics.averageResponseTime,
                    errorRate: realTimeMetrics.errorRate,
                    cacheHitRate: realTimeMetrics.cacheHitRate
                },
                cache: {
                    connected: cacheStats.redisConnected,
                    totalKeys: cacheStats.totalKeys,
                    manualLabKeys: cacheStats.manualLabKeys,
                    memoryUsage: cacheStats.memoryUsage
                },
                alerts: {
                    total: alerts.length,
                    critical: criticalAlerts.length,
                    warning: warningAlerts.length
                }
            };

            sendSuccess(res, {
                health,
                metadata: {
                    workplaceId: context.workplaceId,
                    generatedAt: new Date().toISOString()
                }
            });

            logger.debug('System health status retrieved', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                healthStatus,
                alertCount: alerts.length,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to retrieve system health status', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve system health status', 500);
        }
    }
);

/**
 * POST /api/manual-lab-orders/performance/cleanup
 * Clean up old performance metrics (admin only)
 */
export const cleanupOldMetrics = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);

        // Check if user has admin privileges
        if (!req.user || !['owner', 'admin'].includes(req.user.role)) {
            return sendError(res, 'FORBIDDEN', 'Insufficient permissions to cleanup metrics', 403);
        }

        try {
            await ManualLabPerformanceService.cleanupOldMetrics();

            sendSuccess(res, {
                message: 'Old metrics cleaned up successfully',
                metadata: {
                    cleanedAt: new Date().toISOString(),
                    cleanedBy: context.userId
                }
            });

            logger.info('Old metrics cleaned up', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                userRole: req.user.role,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to cleanup old metrics', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to cleanup old metrics', 500);
        }
    }
);

// ===============================
// PERFORMANCE DASHBOARD DATA
// ===============================

/**
 * GET /api/manual-lab-orders/performance/dashboard
 * Get comprehensive dashboard data
 */
export const getPerformanceDashboard = asyncHandler(
    async (req: AuthRequest, res: Response) => {
        const context = getRequestContext(req);
        const { timeRange = '24h' } = req.query;

        try {
            // Calculate time range
            const endTime = new Date();
            let startTime: Date;

            switch (timeRange) {
                case '1h':
                    startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
                    break;
                case '6h':
                    startTime = new Date(endTime.getTime() - 6 * 60 * 60 * 1000);
                    break;
                case '24h':
                    startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
            }

            const [summary, realTimeMetrics, alerts, cacheStats] = await Promise.all([
                ManualLabPerformanceService.getPerformanceSummary(context.workplaceId, startTime, endTime),
                ManualLabPerformanceService.getRealTimeMetrics(context.workplaceId),
                ManualLabPerformanceService.getPerformanceAlerts(context.workplaceId),
                ManualLabCacheService.getCacheStats()
            ]);

            const dashboard = {
                timeRange: {
                    start: startTime.toISOString(),
                    end: endTime.toISOString(),
                    range: timeRange
                },
                summary,
                realTime: realTimeMetrics,
                alerts: {
                    items: alerts,
                    counts: {
                        total: alerts.length,
                        critical: alerts.filter(a => a.type === 'critical').length,
                        warning: alerts.filter(a => a.type === 'warning').length
                    }
                },
                cache: cacheStats,
                metadata: {
                    generatedAt: new Date().toISOString(),
                    workplaceId: context.workplaceId
                }
            };

            sendSuccess(res, { dashboard });

            logger.info('Performance dashboard data retrieved', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                timeRange,
                totalOrders: summary.totalOrders,
                alertCount: alerts.length,
                service: 'manual-lab-performance-api'
            });
        } catch (error) {
            logger.error('Failed to retrieve performance dashboard data', {
                workplaceId: context.workplaceId,
                userId: context.userId,
                timeRange,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance-api'
            });

            sendError(res, 'SERVER_ERROR', 'Failed to retrieve performance dashboard data', 500);
        }
    }
);

export default {
    getPerformanceSummary,
    getRealTimeMetrics,
    getPerformanceAlerts,
    getCacheStats,
    clearWorkplaceCache,
    getSystemHealth,
    cleanupOldMetrics,
    getPerformanceDashboard
};