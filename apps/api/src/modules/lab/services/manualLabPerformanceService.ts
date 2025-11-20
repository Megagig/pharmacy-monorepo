import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import { getRedisClient } from '../../../utils/performanceOptimization';

/**
 * Manual Lab Performance Monitoring Service
 * Tracks and monitors performance metrics for manual lab workflow
 */

// ===============================
// PERFORMANCE METRICS INTERFACES
// ===============================

export interface OrderProcessingMetrics {
    orderId: string;
    workplaceId: string;
    patientId: string;

    // Timing metrics
    orderCreationTime: number; // milliseconds
    pdfGenerationTime: number; // milliseconds
    totalProcessingTime: number; // milliseconds

    // Resource metrics
    testCount: number;
    pdfSize: number; // bytes

    // Status
    success: boolean;
    errorType?: string;

    // Metadata
    timestamp: Date;
    userId: string;
    priority: 'routine' | 'urgent' | 'stat';
}

export interface PDFGenerationMetrics {
    orderId: string;

    // Timing metrics
    templateRenderTime: number; // milliseconds
    qrCodeGenerationTime: number; // milliseconds
    barcodeGenerationTime: number; // milliseconds
    puppeteerProcessingTime: number; // milliseconds
    totalGenerationTime: number; // milliseconds

    // Resource metrics
    pdfSize: number; // bytes
    pageCount: number;
    testCount: number;

    // Status
    success: boolean;
    errorType?: string;
    fromCache: boolean;

    // Metadata
    timestamp: Date;
    workplaceId: string;
}

export interface AIServiceMetrics {
    orderId: string;

    // Timing metrics
    requestPreparationTime: number; // milliseconds
    aiServiceResponseTime: number; // milliseconds
    resultProcessingTime: number; // milliseconds
    totalAIProcessingTime: number; // milliseconds

    // Request metrics
    inputTokens?: number;
    outputTokens?: number;
    requestSize: number; // bytes
    responseSize: number; // bytes

    // Status
    success: boolean;
    errorType?: string;
    retryCount: number;

    // AI Results
    redFlagsCount: number;
    recommendationsCount: number;
    confidenceScore?: number;

    // Metadata
    timestamp: Date;
    workplaceId: string;
    patientId: string;
}

export interface DatabaseQueryMetrics {
    operation: string; // 'create', 'read', 'update', 'delete'
    collection: string; // 'manuallaborders', 'manuallabresults', etc.

    // Timing metrics
    queryTime: number; // milliseconds

    // Query metrics
    documentsAffected: number;
    indexesUsed: string[];

    // Status
    success: boolean;
    errorType?: string;

    // Metadata
    timestamp: Date;
    workplaceId?: string;
    userId?: string;
}

export interface CacheMetrics {
    operation: 'get' | 'set' | 'delete' | 'invalidate';
    cacheKey: string;

    // Timing metrics
    operationTime: number; // milliseconds

    // Cache metrics
    hit: boolean; // for get operations
    dataSize?: number; // bytes
    ttl?: number; // seconds

    // Status
    success: boolean;
    errorType?: string;

    // Metadata
    timestamp: Date;
    workplaceId?: string;
}

export interface PerformanceSummary {
    timeRange: {
        start: Date;
        end: Date;
    };

    // Order metrics
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    averageOrderProcessingTime: number;

    // PDF metrics
    totalPDFsGenerated: number;
    averagePDFGenerationTime: number;
    averagePDFSize: number;
    pdfCacheHitRate: number;

    // AI metrics
    totalAIRequests: number;
    averageAIResponseTime: number;
    aiSuccessRate: number;
    averageRedFlags: number;

    // Database metrics
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number; // queries > 1000ms

    // Cache metrics
    cacheHitRate: number;
    cacheOperations: number;

    // Error analysis
    topErrors: Array<{
        errorType: string;
        count: number;
        percentage: number;
    }>;
}

// ===============================
// PERFORMANCE MONITORING SERVICE
// ===============================

export class ManualLabPerformanceService {
    private static readonly METRICS_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
    private static readonly REDIS_KEY_PREFIX = 'manual_lab:metrics';

    // ===============================
    // METRICS COLLECTION
    // ===============================

    /**
     * Record order processing metrics
     */
    static async recordOrderProcessingMetrics(metrics: OrderProcessingMetrics): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics storage');
                return;
            }

            const key = `${this.REDIS_KEY_PREFIX}:order:${metrics.orderId}:${Date.now()}`;
            await redisClient.setex(key, this.METRICS_TTL, JSON.stringify(metrics));

            // Also store in time-series format for aggregation
            const timeSeriesKey = `${this.REDIS_KEY_PREFIX}:timeseries:order:${metrics.workplaceId}:${this.getTimeSlot(metrics.timestamp)}`;
            await redisClient.lpush(timeSeriesKey, JSON.stringify(metrics));
            await redisClient.expire(timeSeriesKey, this.METRICS_TTL);

            logger.debug('Order processing metrics recorded', {
                orderId: metrics.orderId,
                processingTime: metrics.totalProcessingTime,
                success: metrics.success,
                service: 'manual-lab-performance'
            });
        } catch (error) {
            logger.error('Failed to record order processing metrics', {
                orderId: metrics.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }

    /**
     * Record PDF generation metrics
     */
    static async recordPDFGenerationMetrics(metrics: PDFGenerationMetrics): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics storage');
                return;
            }

            const key = `${this.REDIS_KEY_PREFIX}:pdf:${metrics.orderId}:${Date.now()}`;
            await redisClient.setex(key, this.METRICS_TTL, JSON.stringify(metrics));

            // Time-series storage
            const timeSeriesKey = `${this.REDIS_KEY_PREFIX}:timeseries:pdf:${metrics.workplaceId}:${this.getTimeSlot(metrics.timestamp)}`;
            await redisClient.lpush(timeSeriesKey, JSON.stringify(metrics));
            await redisClient.expire(timeSeriesKey, this.METRICS_TTL);

            logger.debug('PDF generation metrics recorded', {
                orderId: metrics.orderId,
                generationTime: metrics.totalGenerationTime,
                pdfSize: metrics.pdfSize,
                fromCache: metrics.fromCache,
                service: 'manual-lab-performance'
            });
        } catch (error) {
            logger.error('Failed to record PDF generation metrics', {
                orderId: metrics.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }

    /**
     * Record AI service metrics
     */
    static async recordAIServiceMetrics(metrics: AIServiceMetrics): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics storage');
                return;
            }

            const key = `${this.REDIS_KEY_PREFIX}:ai:${metrics.orderId}:${Date.now()}`;
            await redisClient.setex(key, this.METRICS_TTL, JSON.stringify(metrics));

            // Time-series storage
            const timeSeriesKey = `${this.REDIS_KEY_PREFIX}:timeseries:ai:${metrics.workplaceId}:${this.getTimeSlot(metrics.timestamp)}`;
            await redisClient.lpush(timeSeriesKey, JSON.stringify(metrics));
            await redisClient.expire(timeSeriesKey, this.METRICS_TTL);

            logger.debug('AI service metrics recorded', {
                orderId: metrics.orderId,
                responseTime: metrics.aiServiceResponseTime,
                success: metrics.success,
                redFlags: metrics.redFlagsCount,
                service: 'manual-lab-performance'
            });
        } catch (error) {
            logger.error('Failed to record AI service metrics', {
                orderId: metrics.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }

    /**
     * Record database query metrics
     */
    static async recordDatabaseQueryMetrics(metrics: DatabaseQueryMetrics): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics storage');
                return;
            }

            const key = `${this.REDIS_KEY_PREFIX}:db:${metrics.collection}:${Date.now()}`;
            await redisClient.setex(key, this.METRICS_TTL, JSON.stringify(metrics));

            // Time-series storage
            const timeSeriesKey = `${this.REDIS_KEY_PREFIX}:timeseries:db:${metrics.workplaceId || 'global'}:${this.getTimeSlot(metrics.timestamp)}`;
            await redisClient.lpush(timeSeriesKey, JSON.stringify(metrics));
            await redisClient.expire(timeSeriesKey, this.METRICS_TTL);

            // Log slow queries
            if (metrics.queryTime > 1000) {
                logger.warn('Slow database query detected', {
                    operation: metrics.operation,
                    collection: metrics.collection,
                    queryTime: metrics.queryTime,
                    documentsAffected: metrics.documentsAffected,
                    service: 'manual-lab-performance'
                });
            }
        } catch (error) {
            logger.error('Failed to record database query metrics', {
                operation: metrics.operation,
                collection: metrics.collection,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }

    /**
     * Record cache operation metrics
     */
    static async recordCacheMetrics(metrics: CacheMetrics): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics storage');
                return;
            }

            const key = `${this.REDIS_KEY_PREFIX}:cache:${Date.now()}`;
            await redisClient.setex(key, this.METRICS_TTL, JSON.stringify(metrics));

            // Time-series storage
            const timeSeriesKey = `${this.REDIS_KEY_PREFIX}:timeseries:cache:${metrics.workplaceId || 'global'}:${this.getTimeSlot(metrics.timestamp)}`;
            await redisClient.lpush(timeSeriesKey, JSON.stringify(metrics));
            await redisClient.expire(timeSeriesKey, this.METRICS_TTL);

            logger.debug('Cache metrics recorded', {
                operation: metrics.operation,
                cacheKey: metrics.cacheKey,
                hit: metrics.hit,
                operationTime: metrics.operationTime,
                service: 'manual-lab-performance'
            });
        } catch (error) {
            logger.error('Failed to record cache metrics', {
                operation: metrics.operation,
                cacheKey: metrics.cacheKey,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }

    // ===============================
    // PERFORMANCE ANALYSIS
    // ===============================

    /**
     * Get performance summary for a time range
     */
    static async getPerformanceSummary(
        workplaceId: string,
        startTime: Date,
        endTime: Date
    ): Promise<PerformanceSummary> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                throw new Error('Redis not available for metrics retrieval');
            }

            // Get time slots for the range
            const timeSlots = this.getTimeSlots(startTime, endTime);

            // Collect metrics from all time slots
            const [orderMetrics, pdfMetrics, aiMetrics, dbMetrics, cacheMetrics] = await Promise.all([
                this.collectTimeSeriesMetrics(redisClient, 'order', workplaceId, timeSlots),
                this.collectTimeSeriesMetrics(redisClient, 'pdf', workplaceId, timeSlots),
                this.collectTimeSeriesMetrics(redisClient, 'ai', workplaceId, timeSlots),
                this.collectTimeSeriesMetrics(redisClient, 'db', workplaceId, timeSlots),
                this.collectTimeSeriesMetrics(redisClient, 'cache', workplaceId, timeSlots)
            ]);

            // Analyze metrics
            const summary: PerformanceSummary = {
                timeRange: { start: startTime, end: endTime },

                // Order metrics
                totalOrders: orderMetrics.length,
                successfulOrders: orderMetrics.filter(m => m.success).length,
                failedOrders: orderMetrics.filter(m => !m.success).length,
                averageOrderProcessingTime: this.calculateAverage(orderMetrics.map(m => m.totalProcessingTime)),

                // PDF metrics
                totalPDFsGenerated: pdfMetrics.length,
                averagePDFGenerationTime: this.calculateAverage(pdfMetrics.map(m => m.totalGenerationTime)),
                averagePDFSize: this.calculateAverage(pdfMetrics.map(m => m.pdfSize)),
                pdfCacheHitRate: this.calculatePercentage(pdfMetrics.filter(m => m.fromCache).length, pdfMetrics.length),

                // AI metrics
                totalAIRequests: aiMetrics.length,
                averageAIResponseTime: this.calculateAverage(aiMetrics.map(m => m.aiServiceResponseTime)),
                aiSuccessRate: this.calculatePercentage(aiMetrics.filter(m => m.success).length, aiMetrics.length),
                averageRedFlags: this.calculateAverage(aiMetrics.map(m => m.redFlagsCount)),

                // Database metrics
                totalQueries: dbMetrics.length,
                averageQueryTime: this.calculateAverage(dbMetrics.map(m => m.queryTime)),
                slowQueries: dbMetrics.filter(m => m.queryTime > 1000).length,

                // Cache metrics
                cacheHitRate: this.calculatePercentage(cacheMetrics.filter(m => m.hit).length, cacheMetrics.filter(m => m.operation === 'get').length),
                cacheOperations: cacheMetrics.length,

                // Error analysis
                topErrors: this.analyzeErrors([...orderMetrics, ...pdfMetrics, ...aiMetrics, ...dbMetrics, ...cacheMetrics])
            };

            logger.info('Performance summary generated', {
                workplaceId,
                timeRange: `${startTime.toISOString()} - ${endTime.toISOString()}`,
                totalOrders: summary.totalOrders,
                successRate: this.calculatePercentage(summary.successfulOrders, summary.totalOrders),
                service: 'manual-lab-performance'
            });

            return summary;
        } catch (error) {
            logger.error('Failed to generate performance summary', {
                workplaceId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
            throw error;
        }
    }

    /**
     * Get real-time performance metrics
     */
    static async getRealTimeMetrics(workplaceId: string): Promise<{
        activeOrders: number;
        averageResponseTime: number;
        errorRate: number;
        cacheHitRate: number;
        lastUpdated: Date;
    }> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                throw new Error('Redis not available for metrics retrieval');
            }

            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

            // Get recent metrics
            const recentTimeSlot = this.getTimeSlot(now);
            const [orderMetrics, cacheMetrics] = await Promise.all([
                this.collectTimeSeriesMetrics(redisClient, 'order', workplaceId, [recentTimeSlot]),
                this.collectTimeSeriesMetrics(redisClient, 'cache', workplaceId, [recentTimeSlot])
            ]);

            // Filter to last 5 minutes
            const recentOrders = orderMetrics.filter(m => new Date(m.timestamp) >= fiveMinutesAgo);
            const recentCacheOps = cacheMetrics.filter(m => new Date(m.timestamp) >= fiveMinutesAgo);

            return {
                activeOrders: recentOrders.length,
                averageResponseTime: this.calculateAverage(recentOrders.map(m => m.totalProcessingTime)),
                errorRate: this.calculatePercentage(recentOrders.filter(m => !m.success).length, recentOrders.length),
                cacheHitRate: this.calculatePercentage(
                    recentCacheOps.filter(m => m.operation === 'get' && m.hit).length,
                    recentCacheOps.filter(m => m.operation === 'get').length
                ),
                lastUpdated: now
            };
        } catch (error) {
            logger.error('Failed to get real-time metrics', {
                workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
            throw error;
        }
    }

    /**
     * Get performance alerts
     */
    static async getPerformanceAlerts(workplaceId: string): Promise<Array<{
        type: 'warning' | 'critical';
        message: string;
        metric: string;
        value: number;
        threshold: number;
        timestamp: Date;
    }>> {
        try {
            const realTimeMetrics = await this.getRealTimeMetrics(workplaceId);
            const alerts: Array<{
                type: 'warning' | 'critical';
                message: string;
                metric: string;
                value: number;
                threshold: number;
                timestamp: Date;
            }> = [];

            // Check response time
            if (realTimeMetrics.averageResponseTime > 10000) { // 10 seconds
                alerts.push({
                    type: 'critical',
                    message: 'Average response time is critically high',
                    metric: 'averageResponseTime',
                    value: realTimeMetrics.averageResponseTime,
                    threshold: 10000,
                    timestamp: new Date()
                });
            } else if (realTimeMetrics.averageResponseTime > 5000) { // 5 seconds
                alerts.push({
                    type: 'warning',
                    message: 'Average response time is elevated',
                    metric: 'averageResponseTime',
                    value: realTimeMetrics.averageResponseTime,
                    threshold: 5000,
                    timestamp: new Date()
                });
            }

            // Check error rate
            if (realTimeMetrics.errorRate > 10) { // 10%
                alerts.push({
                    type: 'critical',
                    message: 'Error rate is critically high',
                    metric: 'errorRate',
                    value: realTimeMetrics.errorRate,
                    threshold: 10,
                    timestamp: new Date()
                });
            } else if (realTimeMetrics.errorRate > 5) { // 5%
                alerts.push({
                    type: 'warning',
                    message: 'Error rate is elevated',
                    metric: 'errorRate',
                    value: realTimeMetrics.errorRate,
                    threshold: 5,
                    timestamp: new Date()
                });
            }

            // Check cache hit rate
            if (realTimeMetrics.cacheHitRate < 50) { // 50%
                alerts.push({
                    type: 'warning',
                    message: 'Cache hit rate is low',
                    metric: 'cacheHitRate',
                    value: realTimeMetrics.cacheHitRate,
                    threshold: 50,
                    timestamp: new Date()
                });
            }

            return alerts;
        } catch (error) {
            logger.error('Failed to get performance alerts', {
                workplaceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
            return [];
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Get time slot for grouping metrics (hourly slots)
     */
    private static getTimeSlot(timestamp: Date): string {
        const hour = Math.floor(timestamp.getTime() / (60 * 60 * 1000));
        return hour.toString();
    }

    /**
     * Get all time slots for a date range
     */
    private static getTimeSlots(startTime: Date, endTime: Date): string[] {
        const slots: string[] = [];
        const startHour = Math.floor(startTime.getTime() / (60 * 60 * 1000));
        const endHour = Math.floor(endTime.getTime() / (60 * 60 * 1000));

        for (let hour = startHour; hour <= endHour; hour++) {
            slots.push(hour.toString());
        }

        return slots;
    }

    /**
     * Collect metrics from time series data
     */
    private static async collectTimeSeriesMetrics(
        redisClient: any,
        metricType: string,
        workplaceId: string,
        timeSlots: string[]
    ): Promise<any[]> {
        const allMetrics: any[] = [];

        for (const slot of timeSlots) {
            try {
                const key = `${this.REDIS_KEY_PREFIX}:timeseries:${metricType}:${workplaceId}:${slot}`;
                const metrics = await redisClient.lrange(key, 0, -1);

                for (const metricStr of metrics) {
                    try {
                        const metric = JSON.parse(metricStr);
                        allMetrics.push(metric);
                    } catch (parseError) {
                        logger.warn('Failed to parse metric data', { metricStr });
                    }
                }
            } catch (error) {
                logger.warn('Failed to retrieve metrics from time slot', {
                    metricType,
                    workplaceId,
                    slot,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return allMetrics;
    }

    /**
     * Calculate average of an array of numbers
     */
    private static calculateAverage(values: number[]): number {
        if (values.length === 0) return 0;
        const sum = values.reduce((acc, val) => acc + (val || 0), 0);
        return Math.round(sum / values.length);
    }

    /**
     * Calculate percentage
     */
    private static calculatePercentage(numerator: number, denominator: number): number {
        if (denominator === 0) return 0;
        return Math.round((numerator / denominator) * 100);
    }

    /**
     * Analyze errors and return top error types
     */
    private static analyzeErrors(metrics: any[]): Array<{
        errorType: string;
        count: number;
        percentage: number;
    }> {
        const errorCounts: { [key: string]: number } = {};
        const failedMetrics = metrics.filter(m => !m.success && m.errorType);

        failedMetrics.forEach(m => {
            errorCounts[m.errorType] = (errorCounts[m.errorType] || 0) + 1;
        });

        const totalErrors = failedMetrics.length;

        return Object.entries(errorCounts)
            .map(([errorType, count]) => ({
                errorType,
                count,
                percentage: this.calculatePercentage(count, totalErrors)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 errors
    }

    /**
     * Clean up old metrics (should be run periodically)
     */
    static async cleanupOldMetrics(): Promise<void> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                logger.warn('Redis not available for metrics cleanup');
                return;
            }

            const cutoffTime = Date.now() - (this.METRICS_TTL * 1000);
            const pattern = `${this.REDIS_KEY_PREFIX}:*`;

            const keys = await redisClient.keys(pattern);
            let deletedCount = 0;

            for (const key of keys) {
                try {
                    const ttl = await redisClient.ttl(key);
                    if (ttl === -1) { // Key without expiration
                        await redisClient.del(key);
                        deletedCount++;
                    }
                } catch (error) {
                    logger.warn('Failed to check/delete metric key', { key });
                }
            }

            logger.info('Metrics cleanup completed', {
                totalKeys: keys.length,
                deletedKeys: deletedCount,
                service: 'manual-lab-performance'
            });
        } catch (error) {
            logger.error('Failed to cleanup old metrics', {
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-performance'
            });
        }
    }
}

export default ManualLabPerformanceService;