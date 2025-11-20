import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../types/auth';
import logger from '../../../utils/logger';
import performanceOptimizationService from '../services/performanceOptimizationService';

/**
 * Performance Monitoring Middleware
 * Tracks request performance, database queries, and resource usage
 */

export interface PerformanceMetrics {
    requestId: string;
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    queryCount: number;
    cacheHits: number;
    cacheMisses: number;
    timestamp: Date;
    userId?: string;
    workplaceId?: string;
}

class PerformanceMiddleware {
    private requestMetrics: Map<string, PerformanceMetrics> = new Map();
    private slowRequestThreshold = 5000; // 5 seconds
    private memoryWarningThreshold = 0.8; // 80% of heap
    private cpuWarningThreshold = 0.8; // 80% CPU usage

    /**
     * Main performance monitoring middleware
     */
    monitor = (req: AuthRequest, res: Response, next: NextFunction): void => {
        const startTime = Date.now();
        const startCpuUsage = process.cpuUsage();
        const startMemory = process.memoryUsage();
        const requestId = this.generateRequestId();

        // Add request ID to request for tracking
        req.requestId = requestId;

        // Initialize performance tracking
        let queryCount = 0;
        let cacheHits = 0;
        let cacheMisses = 0;

        // Track database queries (simplified - in production, hook into MongoDB driver)
        const originalQuery = req.query;
        req.query = new Proxy(originalQuery, {
            get: (target, prop) => {
                if (typeof prop === 'string' && prop.startsWith('db_')) {
                    queryCount++;
                }
                return target[prop as keyof typeof target];
            },
        });

        // Override res.json to capture response metrics
        const originalJson = res.json;
        res.json = (body: any) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            const endCpuUsage = process.cpuUsage(startCpuUsage);
            const endMemory = process.memoryUsage();

            // Create performance metrics
            const metrics: PerformanceMetrics = {
                requestId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                responseTime,
                memoryUsage: endMemory,
                cpuUsage: endCpuUsage,
                queryCount,
                cacheHits,
                cacheMisses,
                timestamp: new Date(startTime),
                userId: req.user?._id?.toString(),
                workplaceId: req.workspaceContext?.workspace?._id?.toString(),
            };

            // Store metrics
            this.storeMetrics(metrics);

            // Log performance warnings
            this.checkPerformanceWarnings(metrics);

            // Log slow requests
            if (responseTime > this.slowRequestThreshold) {
                logger.warn('Slow request detected', {
                    requestId,
                    method: req.method,
                    url: req.originalUrl,
                    responseTime,
                    statusCode: res.statusCode,
                    userId: req.user?._id?.toString(),
                });
            }

            return originalJson.call(res, body);
        };

        next();
    };

    /**
     * Database query performance monitoring
     */
    monitorQuery = (queryType: string, collection?: string) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            const startTime = Date.now();

            // Override res.json to capture query metrics
            const originalJson = res.json;
            res.json = function (body: any) {
                const queryTime = Date.now() - startTime;

                // Log slow queries
                if (queryTime > 1000) { // 1 second threshold
                    logger.warn('Slow database query detected', {
                        requestId: req.requestId,
                        queryType,
                        collection,
                        queryTime,
                        url: req.originalUrl,
                    });
                }

                // Update query metrics
                performanceOptimizationService.updateConnectionPoolStats({
                    totalConnections: 10, // Mock data - in production, get from connection pool
                    activeConnections: 5,
                    idleConnections: 5,
                    waitingRequests: 0,
                    averageWaitTime: queryTime,
                    connectionErrors: 0,
                });

                return originalJson.call(this, body);
            };

            next();
        };
    };

    /**
     * Memory usage monitoring
     */
    monitorMemory = (req: AuthRequest, res: Response, next: NextFunction): void => {
        const memoryUsage = process.memoryUsage();
        const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

        if (heapUsagePercent > this.memoryWarningThreshold) {
            logger.warn('High memory usage detected', {
                requestId: req.requestId,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                heapUsagePercent: Math.round(heapUsagePercent * 100),
                url: req.originalUrl,
            });

            // Trigger garbage collection if available
            if (global.gc) {
                global.gc();
                logger.info('Garbage collection triggered');
            }
        }

        next();
    };

    /**
     * Cache performance monitoring
     */
    monitorCache = (cacheType: string) => {
        return (req: AuthRequest, res: Response, next: NextFunction): void => {
            const startTime = Date.now();

            // Track cache operations (simplified)
            req.cacheMetrics = {
                type: cacheType,
                startTime,
                hits: 0,
                misses: 0,
            };

            next();
        };
    };

    /**
     * API rate limiting performance impact
     */
    monitorRateLimit = (req: AuthRequest, res: Response, next: NextFunction): void => {
        const rateLimitHeaders = {
            limit: res.get('X-RateLimit-Limit'),
            remaining: res.get('X-RateLimit-Remaining'),
            reset: res.get('X-RateLimit-Reset'),
        };

        if (rateLimitHeaders.remaining && parseInt(rateLimitHeaders.remaining) < 10) {
            logger.warn('Rate limit approaching', {
                requestId: req.requestId,
                userId: req.user?._id,
                remaining: rateLimitHeaders.remaining,
                limit: rateLimitHeaders.limit,
                url: req.originalUrl,
            });
        }

        next();
    };

    /**
     * Background job performance monitoring
     */
    monitorBackgroundJobs = (req: AuthRequest, res: Response, next: NextFunction): void => {
        // Check if request might trigger background jobs
        const jobTriggeringEndpoints = [
            '/api/diagnostics',
            '/api/lab/orders',
            '/api/interactions/check',
        ];

        const isJobTrigger = jobTriggeringEndpoints.some(endpoint =>
            req.originalUrl.includes(endpoint)
        );

        if (isJobTrigger) {
            // Monitor background job queue size
            const queueSize = this.getBackgroundJobQueueSize();

            if (queueSize > 100) {
                logger.warn('High background job queue size', {
                    requestId: req.requestId,
                    queueSize,
                    url: req.originalUrl,
                });
            }
        }

        next();
    };

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Store performance metrics
     */
    private storeMetrics(metrics: PerformanceMetrics): void {
        this.requestMetrics.set(metrics.requestId, metrics);

        // Keep only last 1000 requests to prevent memory leak
        if (this.requestMetrics.size > 1000) {
            const oldestKey = this.requestMetrics.keys().next().value;
            if (oldestKey) {
                this.requestMetrics.delete(oldestKey);
            }
        }

        // Log metrics for analysis
        logger.debug('Request performance metrics', {
            requestId: metrics.requestId,
            method: metrics.method,
            url: metrics.url,
            responseTime: metrics.responseTime,
            statusCode: metrics.statusCode,
            memoryUsed: metrics.memoryUsage.heapUsed,
            queryCount: metrics.queryCount,
        });
    }

    /**
     * Check for performance warnings
     */
    private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
        const warnings: string[] = [];

        // Response time warning
        if (metrics.responseTime > this.slowRequestThreshold) {
            warnings.push(`Slow response time: ${metrics.responseTime}ms`);
        }

        // Memory usage warning
        const memoryPercent = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
        if (memoryPercent > this.memoryWarningThreshold) {
            warnings.push(`High memory usage: ${Math.round(memoryPercent * 100)}%`);
        }

        // CPU usage warning (if available)
        if (metrics.cpuUsage) {
            const cpuPercent = (metrics.cpuUsage.user + metrics.cpuUsage.system) / 1000000; // Convert to seconds
            if (cpuPercent > this.cpuWarningThreshold) {
                warnings.push(`High CPU usage: ${Math.round(cpuPercent * 100)}%`);
            }
        }

        // Query count warning
        if (metrics.queryCount > 10) {
            warnings.push(`High query count: ${metrics.queryCount}`);
        }

        // Log warnings
        if (warnings.length > 0) {
            logger.warn('Performance warnings detected', {
                requestId: metrics.requestId,
                warnings,
                metrics: {
                    responseTime: metrics.responseTime,
                    memoryUsage: metrics.memoryUsage.heapUsed,
                    queryCount: metrics.queryCount,
                },
            });
        }
    }

    /**
     * Get background job queue size (mock implementation)
     */
    private getBackgroundJobQueueSize(): number {
        // In production, this would get actual queue size
        return Math.floor(Math.random() * 50);
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        totalRequests: number;
        averageResponseTime: number;
        slowRequests: number;
        errorRate: number;
        memoryTrend: number[];
        topSlowEndpoints: Array<{
            url: string;
            averageResponseTime: number;
            requestCount: number;
        }>;
    } {
        const metrics = Array.from(this.requestMetrics.values());

        if (metrics.length === 0) {
            return {
                totalRequests: 0,
                averageResponseTime: 0,
                slowRequests: 0,
                errorRate: 0,
                memoryTrend: [],
                topSlowEndpoints: [],
            };
        }

        const totalResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
        const slowRequests = metrics.filter(m => m.responseTime > this.slowRequestThreshold).length;
        const errorRequests = metrics.filter(m => m.statusCode >= 400).length;

        // Group by endpoint for slow endpoint analysis
        const endpointStats = new Map<string, { totalTime: number; count: number }>();

        for (const metric of metrics) {
            const endpoint = `${metric.method} ${metric.url.split('?')[0]}`;
            const existing = endpointStats.get(endpoint) || { totalTime: 0, count: 0 };
            existing.totalTime += metric.responseTime;
            existing.count++;
            endpointStats.set(endpoint, existing);
        }

        const topSlowEndpoints = Array.from(endpointStats.entries())
            .map(([url, stats]) => ({
                url,
                averageResponseTime: stats.totalTime / stats.count,
                requestCount: stats.count,
            }))
            .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
            .slice(0, 10);

        // Memory trend (last 10 requests)
        const memoryTrend = metrics
            .slice(-10)
            .map(m => m.memoryUsage.heapUsed);

        return {
            totalRequests: metrics.length,
            averageResponseTime: totalResponseTime / metrics.length,
            slowRequests,
            errorRate: errorRequests / metrics.length,
            memoryTrend,
            topSlowEndpoints,
        };
    }

    /**
     * Get real-time performance metrics
     */
    getRealTimeMetrics(): {
        currentMemoryUsage: NodeJS.MemoryUsage;
        activeRequests: number;
        requestsPerMinute: number;
        averageResponseTimeLast100: number;
    } {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const last100Requests = Array.from(this.requestMetrics.values())
            .slice(-100);

        const recentRequests = Array.from(this.requestMetrics.values())
            .filter(m => m.timestamp.getTime() > oneMinuteAgo);

        const averageResponseTime = last100Requests.length > 0 ?
            last100Requests.reduce((sum, m) => sum + m.responseTime, 0) / last100Requests.length : 0;

        return {
            currentMemoryUsage: process.memoryUsage(),
            activeRequests: 0, // Would track active requests in production
            requestsPerMinute: recentRequests.length,
            averageResponseTimeLast100: averageResponseTime,
        };
    }

    /**
     * Clear old metrics
     */
    clearOldMetrics(olderThanMs: number = 60 * 60 * 1000): void {
        const cutoff = Date.now() - olderThanMs;

        for (const [requestId, metrics] of this.requestMetrics.entries()) {
            if (metrics.timestamp.getTime() < cutoff) {
                this.requestMetrics.delete(requestId);
            }
        }
    }

    /**
     * Export metrics for analysis
     */
    exportMetrics(): PerformanceMetrics[] {
        return Array.from(this.requestMetrics.values());
    }
}

// Extend AuthRequest interface
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
            cacheMetrics?: {
                type: string;
                startTime: number;
                hits: number;
                misses: number;
            };
        }
    }
}

export default new PerformanceMiddleware();