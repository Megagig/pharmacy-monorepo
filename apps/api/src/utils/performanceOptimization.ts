/**
 * Performance Optimization Utilities for Clinical Interventions Module
 * Implements database query optimization, caching strategies, and performance monitoring
 */

import mongoose from 'mongoose';
import Redis from 'ioredis';
import logger from './logger';
import { getRedisClient as getSharedRedisClient, isRedisAvailable } from '../config/redis';

// ===============================
// REDIS CACHE CONFIGURATION
// ===============================

// Export wrapper functions for shared Redis connection
export const initializeRedisCache = () => {
    // Uses shared Redis connection from config/redis
    logger.info('Using shared Redis connection for performance cache');
    return null; // No initialization needed
};

export const getRedisClient = async (): Promise<Redis | null> => {
    return await getSharedRedisClient();
};

export const isRedisCacheAvailable = (): boolean => {
    return isRedisAvailable();
};

export const shutdownRedisCache = async (): Promise<void> => {
    // Connection managed by RedisConnectionManager
    logger.info('Redis cache: Using shared connection (no individual shutdown needed)');
};

// ===============================
// CACHE UTILITIES
// ===============================

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    prefix?: string;
    compress?: boolean;
}

export class CacheManager {
    private static defaultTTL = 300; // 5 minutes
    private static keyPrefix = 'clinical_interventions:';

    /**
     * Generate cache key with consistent formatting
     */
    static generateKey(type: string, identifier: string, workplaceId?: string): string {
        const parts = [this.keyPrefix, type, identifier];
        if (workplaceId) {
            parts.push(workplaceId);
        }
        return parts.join(':');
    }

    /**
     * Set cache value with optional compression
     */
    static async set(
        key: string,
        value: any,
        options: CacheOptions = {}
    ): Promise<boolean> {
        try {
            if (!isRedisCacheAvailable()) {
                return false;
            }

            const client = await getRedisClient();
            if (!client) {
                return false;
            }

            const { ttl = this.defaultTTL, compress = false } = options;
            let serializedValue = JSON.stringify(value);

            if (compress && serializedValue.length > 1000) {
                // Implement compression for large objects
                const zlib = require('zlib');
                serializedValue = zlib.gzipSync(serializedValue).toString('base64');
                key = `${key}:compressed`;
            }

            await client.setex(key, ttl, serializedValue);
            return true;
        } catch (error) {
            logger.error('Cache set error:', error);
            return false;
        }
    }

    /**
     * Get cache value with automatic decompression
     */
    static async get<T>(key: string): Promise<T | null> {
        try {
            if (!isRedisCacheAvailable()) {
                return null;
            }

            const client = await getRedisClient();
            if (!client) {
                return null;
            }

            let value = await client.get(key);
            if (!value) {
                // Try compressed version
                const compressedValue = await client.get(`${key}:compressed`);
                if (compressedValue) {
                    const zlib = require('zlib');
                    value = zlib.gunzipSync(Buffer.from(compressedValue, 'base64')).toString();
                }
            }

            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Delete cache key(s)
     */
    static async delete(pattern: string): Promise<boolean> {
        try {
            if (!isRedisCacheAvailable()) {
                return false;
            }

            const client = await getRedisClient();
            if (!client) {
                return false;
            }

            if (pattern.includes('*')) {
                // Delete multiple keys matching pattern
                const keys = await client.keys(pattern);
                if (keys.length > 0) {
                    await client.del(...keys);
                }
            } else {
                // Delete single key
                await client.del(pattern);
                await client.del(`${pattern}:compressed`);
            }
            return true;
        } catch (error) {
            logger.error('Cache delete error:', error);
            return false;
        }
    }

    /**
     * Invalidate intervention-related caches
     */
    static async invalidateInterventionCaches(
        interventionId?: string,
        patientId?: string,
        workplaceId?: string
    ): Promise<void> {
        try {
            const patterns = [];

            if (interventionId) {
                patterns.push(this.generateKey('intervention', interventionId, '*'));
            }

            if (patientId) {
                patterns.push(this.generateKey('patient_interventions', patientId, '*'));
                patterns.push(this.generateKey('patient_summary', patientId, '*'));
            }

            if (workplaceId) {
                patterns.push(this.generateKey('dashboard', '*', workplaceId));
                patterns.push(this.generateKey('analytics', '*', workplaceId));
                patterns.push(this.generateKey('interventions_list', '*', workplaceId));
            }

            await Promise.all(patterns.map(pattern => this.delete(pattern)));
        } catch (error) {
            logger.error('Cache invalidation error:', error);
        }
    }
}

// ===============================
// DATABASE QUERY OPTIMIZATION
// ===============================

export class QueryOptimizer {
    /**
     * Optimize intervention queries with proper indexing and aggregation
     */
    static optimizeInterventionQuery(baseQuery: any, options: {
        includePatient?: boolean;
        includeUser?: boolean;
        includeAssignments?: boolean;
        lean?: boolean;
    } = {}) {
        const { includePatient = false, includeUser = false, includeAssignments = false, lean = true } = options;

        let query = baseQuery;

        // Use lean queries for better performance when possible
        if (lean) {
            query = query.lean();
        }

        // Selective population to reduce data transfer
        if (includePatient) {
            query = query.populate('patientId', 'firstName lastName dateOfBirth mrn');
        }

        if (includeUser) {
            query = query.populate('identifiedBy', 'firstName lastName email');
        }

        if (includeAssignments) {
            query = query.populate('assignments.userId', 'firstName lastName email role');
        }

        return query;
    }

    /**
     * Create optimized aggregation pipeline for dashboard metrics
     */
    static createDashboardAggregation(workplaceId: string, dateRange?: { from: Date; to: Date }) {
        const matchStage: any = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: { $ne: true }
        };

        if (dateRange) {
            matchStage.identifiedDate = {
                $gte: dateRange.from,
                $lte: dateRange.to
            };
        }

        return [
            { $match: matchStage },
            {
                $facet: {
                    // Total counts by status
                    statusCounts: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Category distribution
                    categoryDistribution: [
                        {
                            $group: {
                                _id: '$category',
                                count: { $sum: 1 },
                                completed: {
                                    $sum: {
                                        $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                                    }
                                }
                            }
                        },
                        {
                            $addFields: {
                                successRate: {
                                    $cond: [
                                        { $gt: ['$count', 0] },
                                        { $multiply: [{ $divide: ['$completed', '$count'] }, 100] },
                                        0
                                    ]
                                }
                            }
                        }
                    ],
                    // Priority distribution
                    priorityDistribution: [
                        {
                            $group: {
                                _id: '$priority',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Average resolution time
                    resolutionMetrics: [
                        {
                            $match: {
                                status: 'completed',
                                actualDuration: { $exists: true, $gt: 0 }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                avgResolutionTime: { $avg: '$actualDuration' },
                                totalCostSavings: { $sum: '$outcomes.successMetrics.costSavings' }
                            }
                        }
                    ],
                    // Monthly trends (last 12 months)
                    monthlyTrends: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$identifiedDate' },
                                    month: { $month: '$identifiedDate' }
                                },
                                total: { $sum: 1 },
                                completed: {
                                    $sum: {
                                        $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                                    }
                                }
                            }
                        },
                        {
                            $addFields: {
                                successRate: {
                                    $cond: [
                                        { $gt: ['$total', 0] },
                                        { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
                                        0
                                    ]
                                }
                            }
                        },
                        { $sort: { '_id.year': 1, '_id.month': 1 } },
                        { $limit: 12 }
                    ]
                }
            }
        ];
    }

    /**
     * Create optimized query for user assignments
     */
    static createUserAssignmentsQuery(userId: string, workplaceId: string, status?: string[]) {
        const matchStage: any = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            'assignments.userId': new mongoose.Types.ObjectId(userId),
            isDeleted: { $ne: true }
        };

        if (status && status.length > 0) {
            matchStage['assignments.status'] = { $in: status };
        }

        return [
            { $match: matchStage },
            {
                $addFields: {
                    userAssignments: {
                        $filter: {
                            input: '$assignments',
                            cond: {
                                $and: [
                                    { $eq: ['$$this.userId', new mongoose.Types.ObjectId(userId)] },
                                    status ? { $in: ['$$this.status', status] } : { $ne: ['$$this.status', null] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'patients',
                    localField: 'patientId',
                    foreignField: '_id',
                    as: 'patient',
                    pipeline: [
                        { $project: { firstName: 1, lastName: 1, mrn: 1 } }
                    ]
                }
            },
            { $unwind: '$patient' },
            {
                $project: {
                    interventionNumber: 1,
                    category: 1,
                    priority: 1,
                    status: 1,
                    identifiedDate: 1,
                    patient: 1,
                    userAssignments: 1
                }
            },
            { $sort: { priority: 1, identifiedDate: -1 } }
        ];
    }
}

// ===============================
// PERFORMANCE MONITORING
// ===============================

export interface PerformanceMetrics {
    operation: string;
    duration: number;
    timestamp: Date;
    success: boolean;
    error?: string;
    metadata?: any;
}

export class PerformanceMonitor {
    private static metrics: PerformanceMetrics[] = [];
    private static maxMetrics = 1000; // Keep last 1000 metrics

    /**
     * Track operation performance
     */
    static async trackOperation<T>(
        operation: string,
        fn: () => Promise<T>,
        metadata?: any
    ): Promise<T> {
        const startTime = Date.now();
        let success = true;
        let error: string | undefined;
        let result: T;

        try {
            result = await fn();
            return result;
        } catch (err) {
            success = false;
            error = err instanceof Error ? err.message : 'Unknown error';
            throw err;
        } finally {
            const duration = Date.now() - startTime;

            this.recordMetric({
                operation,
                duration,
                timestamp: new Date(),
                success,
                error,
                metadata
            });

            // Log slow operations
            if (duration > 1000) { // > 1 second
                logger.warn(`Slow operation detected: ${operation} took ${duration}ms`, {
                    operation,
                    duration,
                    metadata,
                    error
                });
            }
        }
    }

    /**
     * Record performance metric
     */
    private static recordMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    /**
     * Get performance statistics
     */
    static getPerformanceStats(operation?: string): {
        totalOperations: number;
        averageDuration: number;
        successRate: number;
        slowOperations: number;
        recentErrors: string[];
    } {
        let filteredMetrics = this.metrics;

        if (operation) {
            filteredMetrics = this.metrics.filter(m => m.operation === operation);
        }

        if (filteredMetrics.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                successRate: 0,
                slowOperations: 0,
                recentErrors: []
            };
        }

        const totalOperations = filteredMetrics.length;
        const successfulOperations = filteredMetrics.filter(m => m.success).length;
        const averageDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
        const slowOperations = filteredMetrics.filter(m => m.duration > 1000).length;
        const recentErrors = filteredMetrics
            .filter(m => !m.success && m.error)
            .slice(-10)
            .map(m => m.error!);

        return {
            totalOperations,
            averageDuration: Math.round(averageDuration),
            successRate: Math.round((successfulOperations / totalOperations) * 100),
            slowOperations,
            recentErrors
        };
    }

    /**
     * Clear performance metrics
     */
    static clearMetrics(): void {
        this.metrics = [];
    }

    /**
     * Export metrics for analysis
     */
    static exportMetrics(operation?: string): PerformanceMetrics[] {
        if (operation) {
            return this.metrics.filter(m => m.operation === operation);
        }
        return [...this.metrics];
    }
}

// ===============================
// MEMORY OPTIMIZATION
// ===============================

export class MemoryOptimizer {
    /**
     * Clean up large objects and optimize memory usage
     */
    static optimizeInterventionData(intervention: any): any {
        // Remove unnecessary populated fields for list views
        const optimized = { ...intervention };

        // Keep only essential patient info
        if (optimized.patient) {
            optimized.patient = {
                _id: optimized.patient._id,
                firstName: optimized.patient.firstName,
                lastName: optimized.patient.lastName,
                displayName: `${optimized.patient.firstName} ${optimized.patient.lastName}`
            };
        }

        // Optimize assignments array
        if (optimized.assignments) {
            optimized.assignments = optimized.assignments.map((assignment: any) => ({
                _id: assignment._id,
                userId: assignment.userId,
                role: assignment.role,
                status: assignment.status,
                assignedAt: assignment.assignedAt,
                userName: assignment.userId?.firstName && assignment.userId?.lastName
                    ? `${assignment.userId.firstName} ${assignment.userId.lastName}`
                    : undefined
            }));
        }

        // Remove large text fields for list views
        if (optimized.issueDescription && optimized.issueDescription.length > 100) {
            optimized.issueDescriptionPreview = optimized.issueDescription.substring(0, 100) + '...';
        }

        return optimized;
    }

    /**
     * Batch process large datasets
     */
    static async processBatch<T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>,
        batchSize: number = 100
    ): Promise<R[]> {
        const results: R[] = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await processor(batch);
            results.push(...batchResults);

            // Allow event loop to process other tasks
            await new Promise(resolve => setImmediate(resolve));
        }

        return results;
    }
}

// ===============================
// INITIALIZATION
// ===============================

export const initializePerformanceOptimization = () => {
    // Initialize Redis cache
    initializeRedisCache();

    // Set up performance monitoring
    logger.info('Performance optimization initialized');

    // Clean up metrics periodically
    setInterval(() => {
        const stats = PerformanceMonitor.getPerformanceStats();
        logger.info('Performance stats:', stats);

        // Clear old metrics if too many
        if (stats.totalOperations > 5000) {
            PerformanceMonitor.clearMetrics();
        }
    }, 300000); // Every 5 minutes
};