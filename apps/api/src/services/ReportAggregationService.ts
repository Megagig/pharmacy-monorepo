// Optimized MongoDB Aggregation Service for Reports
import mongoose, { PipelineStage, AggregateOptions } from 'mongoose';
import { performance } from 'perf_hooks';
import logger from '../utils/logger';

interface AggregationOptions extends Omit<AggregateOptions, 'collation'> {
    allowDiskUse?: boolean;
    maxTimeMS?: number;
    hint?: string | object;
    collation?: any;
    batchSize?: number;
}

interface AggregationResult<T = any> {
    data: T[];
    executionTime: number;
    totalDocuments?: number;
    indexesUsed?: string[];
}

/**
 * Optimized aggregation service with performance monitoring and caching
 */
export class ReportAggregationService {
    private static instance: ReportAggregationService;
    private performanceMetrics: Map<string, number[]> = new Map();

    static getInstance(): ReportAggregationService {
        if (!ReportAggregationService.instance) {
            ReportAggregationService.instance = new ReportAggregationService();
        }
        return ReportAggregationService.instance;
    }

    /**
     * Execute optimized aggregation pipeline with performance monitoring
     */
    async executeAggregation<T = any>(
        model: mongoose.Model<any>,
        pipeline: PipelineStage[],
        options: AggregationOptions = {},
        cacheKey?: string
    ): Promise<AggregationResult<T>> {
        const startTime = performance.now();
        const operationId = `${model.modelName}_${Date.now()}`;

        try {
            // Set default options for performance
            const defaultOptions: AggregationOptions = {
                allowDiskUse: true,
                maxTimeMS: 30000, // 30 seconds timeout
                batchSize: 1000,
                ...options,
            };

            // Add explain stage for performance monitoring in development
            if (process.env.NODE_ENV === 'development') {
                logger.debug(`Executing aggregation for ${model.modelName}:`, {
                    pipeline: JSON.stringify(pipeline, null, 2),
                    options: defaultOptions,
                });
            }

            // Execute aggregation
            const aggregation = model.aggregate(pipeline, defaultOptions);
            const result = await aggregation.exec();

            const executionTime = performance.now() - startTime;

            // Track performance metrics
            this.trackPerformance(model.modelName, executionTime);

            // Log slow queries
            if (executionTime > 1000) {
                logger.warn(`Slow aggregation detected for ${model.modelName}:`, {
                    executionTime: `${executionTime.toFixed(2)}ms`,
                    pipeline: pipeline.slice(0, 3), // Log first 3 stages only
                    resultCount: result.length,
                });
            }

            return {
                data: result,
                executionTime,
                totalDocuments: result.length,
            };
        } catch (error) {
            const executionTime = performance.now() - startTime;
            logger.error(`Aggregation failed for ${model.modelName}:`, {
                error: error instanceof Error ? error.message : error,
                executionTime: `${executionTime.toFixed(2)}ms`,
                pipeline: pipeline.slice(0, 2), // Log first 2 stages for debugging
            });
            throw error;
        }
    }

    /**
     * Build optimized match stage with proper indexing hints
     */
    buildOptimizedMatchStage(
        workplaceId: string,
        filters: any = {},
        indexHints?: string[]
    ): PipelineStage {
        const matchStage: any = {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            isDeleted: { $ne: true }, // More efficient than false check
        };

        // Optimize date range queries
        if (filters.dateRange) {
            matchStage.createdAt = {
                $gte: filters.dateRange.startDate,
                $lte: filters.dateRange.endDate,
            };
        }

        // Add other filters with proper type conversion
        if (filters.patientId) {
            matchStage.patientId = new mongoose.Types.ObjectId(filters.patientId);
        }

        if (filters.pharmacistId) {
            matchStage.pharmacistId = new mongoose.Types.ObjectId(filters.pharmacistId);
        }

        if (filters.status) {
            matchStage.status = filters.status;
        }

        if (filters.priority) {
            matchStage.priority = filters.priority;
        }

        if (filters.reviewType) {
            matchStage.reviewType = filters.reviewType;
        }

        return { $match: matchStage };
    }

    /**
     * Build optimized group stage for common aggregations
     */
    buildOptimizedGroupStage(groupBy: string, metrics: string[]): PipelineStage {
        const groupStage: any = {
            _id: `$${groupBy}`,
        };

        metrics.forEach((metric) => {
            switch (metric) {
                case 'count':
                    groupStage.count = { $sum: 1 };
                    break;
                case 'avgCompletionTime':
                    groupStage.avgCompletionTime = {
                        $avg: {
                            $cond: [
                                { $ne: ['$completedAt', null] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$startedAt'] },
                                        1000 * 60 * 60 * 24, // Convert to days
                                    ],
                                },
                                null,
                            ],
                        },
                    };
                    break;
                case 'totalCostSavings':
                    groupStage.totalCostSavings = { $sum: '$clinicalOutcomes.costSavings' };
                    break;
                case 'completionRate':
                    groupStage.totalReviews = { $sum: 1 };
                    groupStage.completedReviews = {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                    };
                    break;
                case 'acceptanceRate':
                    groupStage.totalInterventions = { $sum: 1 };
                    groupStage.acceptedInterventions = {
                        $sum: { $cond: [{ $eq: ['$outcome', 'accepted'] }, 1, 0] },
                    };
                    break;
            }
        });

        return { $group: groupStage };
    }

    /**
     * Build time-series aggregation pipeline
     */
    buildTimeSeriesAggregation(
        workplaceId: string,
        filters: any,
        interval: 'hour' | 'day' | 'week' | 'month' = 'day'
    ): PipelineStage[] {
        const matchStage = this.buildOptimizedMatchStage(workplaceId, filters);

        let dateGrouping: any;
        switch (interval) {
            case 'hour':
                dateGrouping = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                    hour: { $hour: '$createdAt' },
                };
                break;
            case 'day':
                dateGrouping = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                };
                break;
            case 'week':
                dateGrouping = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' },
                };
                break;
            case 'month':
                dateGrouping = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                };
                break;
        }

        return [
            matchStage,
            {
                $group: {
                    _id: dateGrouping,
                    count: { $sum: 1 },
                    completedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                    },
                    totalCostSavings: { $sum: '$clinicalOutcomes.costSavings' },
                },
            },
            {
                $addFields: {
                    date: {
                        $dateFromParts: {
                            year: '$_id.year',
                            month: '$_id.month',
                            day: '$_id.day',
                            hour: '$_id.hour',
                        },
                    },
                    completionRate: {
                        $cond: [
                            { $gt: ['$count', 0] },
                            { $multiply: [{ $divide: ['$completedCount', '$count'] }, 100] },
                            0,
                        ],
                    },
                },
            },
            { $sort: { date: 1 } },
        ];
    }

    /**
     * Build faceted aggregation for multiple metrics
     */
    buildFacetedAggregation(
        workplaceId: string,
        filters: any,
        facets: Record<string, any[]>
    ): PipelineStage[] {
        const matchStage = this.buildOptimizedMatchStage(workplaceId, filters);

        return [
            matchStage,
            {
                $facet: facets,
            },
        ];
    }

    /**
     * Build lookup stage with optimized joins
     */
    buildOptimizedLookup(
        from: string,
        localField: string,
        foreignField: string,
        as: string,
        pipeline?: PipelineStage[]
    ): PipelineStage {
        const lookupStage: any = {
            $lookup: {
                from,
                localField,
                foreignField,
                as,
            },
        };

        // Add pipeline for additional filtering/projection
        if (pipeline) {
            lookupStage.$lookup.pipeline = pipeline;
        }

        return lookupStage;
    }

    /**
     * Build pagination pipeline
     */
    buildPaginationPipeline(
        page: number = 1,
        limit: number = 50,
        sortField: string = 'createdAt',
        sortOrder: 1 | -1 = -1
    ): PipelineStage[] {
        const skip = (page - 1) * limit;

        return [
            { $sort: { [sortField]: sortOrder } },
            {
                $facet: {
                    data: [{ $skip: skip }, { $limit: limit }],
                    totalCount: [{ $count: 'count' }],
                },
            },
            {
                $addFields: {
                    totalCount: { $arrayElemAt: ['$totalCount.count', 0] },
                    page,
                    limit,
                    totalPages: {
                        $ceil: {
                            $divide: [{ $arrayElemAt: ['$totalCount.count', 0] }, limit],
                        },
                    },
                },
            },
        ];
    }

    /**
     * Track performance metrics
     */
    private trackPerformance(modelName: string, executionTime: number): void {
        if (!this.performanceMetrics.has(modelName)) {
            this.performanceMetrics.set(modelName, []);
        }

        const metrics = this.performanceMetrics.get(modelName)!;
        metrics.push(executionTime);

        // Keep only last 100 measurements
        if (metrics.length > 100) {
            metrics.shift();
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(modelName?: string): Record<string, any> {
        if (modelName) {
            const metrics = this.performanceMetrics.get(modelName) || [];
            if (metrics.length === 0) return {};

            return {
                modelName,
                count: metrics.length,
                avgExecutionTime: metrics.reduce((a, b) => a + b, 0) / metrics.length,
                minExecutionTime: Math.min(...metrics),
                maxExecutionTime: Math.max(...metrics),
                p95ExecutionTime: this.calculatePercentile(metrics, 95),
            };
        }

        const allStats: Record<string, any> = {};
        for (const [model, metrics] of this.performanceMetrics.entries()) {
            allStats[model] = this.getPerformanceStats(model);
        }
        return allStats;
    }

    /**
     * Calculate percentile
     */
    private calculatePercentile(values: number[], percentile: number): number {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index] || 0;
    }

    /**
     * Clear performance metrics
     */
    clearPerformanceMetrics(): void {
        this.performanceMetrics.clear();
    }

    /**
     * Build index recommendations based on query patterns
     */
    getIndexRecommendations(modelName: string, queries: any[]): string[] {
        const recommendations: string[] = [];
        const fieldUsage: Record<string, number> = {};

        // Analyze query patterns
        queries.forEach((query) => {
            Object.keys(query).forEach((field) => {
                fieldUsage[field] = (fieldUsage[field] || 0) + 1;
            });
        });

        // Generate recommendations based on usage frequency
        const sortedFields = Object.entries(fieldUsage)
            .sort(([, a], [, b]) => b - a)
            .map(([field]) => field);

        // Recommend compound indexes for frequently used field combinations
        if (sortedFields.includes('workplaceId') && sortedFields.includes('createdAt')) {
            recommendations.push('{ workplaceId: 1, createdAt: -1 }');
        }

        if (sortedFields.includes('workplaceId') && sortedFields.includes('status')) {
            recommendations.push('{ workplaceId: 1, status: 1 }');
        }

        if (sortedFields.includes('patientId') && sortedFields.includes('createdAt')) {
            recommendations.push('{ patientId: 1, createdAt: -1 }');
        }

        return recommendations;
    }
}

export default ReportAggregationService;
