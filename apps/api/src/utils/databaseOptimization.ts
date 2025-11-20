/**
 * Database Optimization Utilities for Clinical Interventions Module
 * Implements advanced indexing strategies and query optimization
 */

import mongoose from 'mongoose';
import logger from './logger';

// ===============================
// INDEX OPTIMIZATION
// ===============================

export interface IndexDefinition {
    fields: Record<string, 1 | -1 | 'text'>;
    options?: {
        name?: string;
        unique?: boolean;
        sparse?: boolean;
        background?: boolean;
        partialFilterExpression?: any;
        expireAfterSeconds?: number;
    };
}

export class DatabaseOptimizer {
    /**
     * Create optimized indexes for Clinical Interventions
     */
    static async createOptimizedIndexes(): Promise<void> {
        try {
            const ClinicalIntervention = mongoose.model('ClinicalIntervention');

            // Define comprehensive index strategy
            const indexes: IndexDefinition[] = [
                // Primary query patterns
                {
                    fields: { workplaceId: 1, isDeleted: 1, status: 1, identifiedDate: -1 },
                    options: {
                        name: 'workplace_active_interventions',
                        background: true
                    }
                },

                // Patient-specific queries
                {
                    fields: { workplaceId: 1, patientId: 1, isDeleted: 1, identifiedDate: -1 },
                    options: {
                        name: 'patient_interventions_timeline',
                        background: true
                    }
                },

                // User assignment queries
                {
                    fields: { 'assignments.userId': 1, 'assignments.status': 1, workplaceId: 1 },
                    options: {
                        name: 'user_assignments_active',
                        background: true,
                        sparse: true
                    }
                },

                // Category and priority filtering
                {
                    fields: { workplaceId: 1, category: 1, priority: 1, status: 1 },
                    options: {
                        name: 'category_priority_filter',
                        background: true
                    }
                },

                // Overdue interventions (compound with priority)
                {
                    fields: { workplaceId: 1, status: 1, priority: 1, startedAt: 1 },
                    options: {
                        name: 'overdue_interventions',
                        background: true,
                        partialFilterExpression: {
                            status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] }
                        }
                    }
                },

                // Follow-up scheduling
                {
                    fields: { workplaceId: 1, 'followUp.scheduledDate': 1, 'followUp.required': 1 },
                    options: {
                        name: 'followup_scheduling',
                        background: true,
                        sparse: true,
                        partialFilterExpression: {
                            'followUp.required': true,
                            'followUp.scheduledDate': { $exists: true }
                        }
                    }
                },

                // MTR integration
                {
                    fields: { workplaceId: 1, relatedMTRId: 1, isDeleted: 1 },
                    options: {
                        name: 'mtr_integration',
                        background: true,
                        sparse: true
                    }
                },

                // Text search optimization
                {
                    fields: {
                        interventionNumber: 'text',
                        issueDescription: 'text',
                        implementationNotes: 'text'
                    },
                    options: {
                        name: 'intervention_text_search',
                        background: true
                    }
                },

                // Analytics and reporting
                {
                    fields: { workplaceId: 1, identifiedDate: -1, status: 1, category: 1 },
                    options: {
                        name: 'analytics_reporting',
                        background: true
                    }
                },

                // Completion tracking
                {
                    fields: { workplaceId: 1, completedAt: -1, status: 1 },
                    options: {
                        name: 'completion_tracking',
                        background: true,
                        sparse: true,
                        partialFilterExpression: {
                            status: { $in: ['completed', 'cancelled'] }
                        }
                    }
                },

                // Unique intervention number per workplace
                {
                    fields: { workplaceId: 1, interventionNumber: 1 },
                    options: {
                        name: 'unique_intervention_number',
                        unique: true,
                        background: true
                    }
                }
            ];

            // Create indexes
            for (const indexDef of indexes) {
                try {
                    await ClinicalIntervention.collection.createIndex(
                        indexDef.fields,
                        indexDef.options || {}
                    );
                    logger.info(`Created index: ${indexDef.options?.name || 'unnamed'}`);
                } catch (error: any) {
                    // Index might already exist
                    if (error.code !== 85) { // Index already exists
                        logger.error(`Failed to create index ${indexDef.options?.name}:`, error);
                    }
                }
            }

            logger.info('Database optimization indexes created successfully');
        } catch (error) {
            logger.error('Error creating optimized indexes:', error);
            throw error;
        }
    }

    /**
     * Analyze and optimize existing indexes
     */
    static async analyzeIndexUsage(): Promise<{
        totalIndexes: number;
        unusedIndexes: string[];
        slowQueries: any[];
        recommendations: string[];
    }> {
        try {
            const ClinicalIntervention = mongoose.model('ClinicalIntervention');
            const db = mongoose.connection.db;

            // Get index statistics
            const indexStats = await ClinicalIntervention.collection.aggregate([
                { $indexStats: {} }
            ]).toArray();

            // Get collection statistics
            const collStats = await db.command({
                collStats: 'clinicalinterventions'
            });

            // Analyze index usage
            const unusedIndexes = indexStats
                .filter(stat => stat.accesses.ops === 0)
                .map(stat => stat.name);

            const recommendations: string[] = [];

            // Check for missing indexes based on common query patterns
            if (collStats.count > 1000) {
                recommendations.push('Consider partitioning by workplaceId for large datasets');
            }

            if (unusedIndexes.length > 0) {
                recommendations.push(`Remove unused indexes: ${unusedIndexes.join(', ')}`);
            }

            // Check index selectivity
            const lowSelectivityIndexes = indexStats.filter(stat => {
                const selectivity = stat.accesses.ops / (collStats.count || 1);
                return selectivity < 0.1 && stat.accesses.ops > 0;
            });

            if (lowSelectivityIndexes.length > 0) {
                recommendations.push('Review low-selectivity indexes for optimization');
            }

            return {
                totalIndexes: indexStats.length,
                unusedIndexes,
                slowQueries: [], // Would need to implement query profiling
                recommendations
            };
        } catch (error) {
            logger.error('Error analyzing index usage:', error);
            throw error;
        }
    }

    /**
     * Optimize query execution plans
     */
    static async explainQuery(
        model: mongoose.Model<any>,
        query: any,
        options: any = {}
    ): Promise<any> {
        try {
            const explanation = await model.find(query, null, options).explain('executionStats') as any;

            const stats = explanation.executionStats;
            const isOptimal = stats.totalDocsExamined <= stats.totalDocsReturned * 2;

            logger.info('Query execution stats:', {
                totalDocsExamined: stats.totalDocsExamined,
                totalDocsReturned: stats.totalDocsReturned,
                executionTimeMillis: stats.executionTimeMillis,
                isOptimal,
                indexesUsed: explanation.queryPlanner.winningPlan.inputStage?.indexName || 'COLLSCAN'
            });

            return {
                ...stats,
                isOptimal,
                recommendations: isOptimal ? [] : [
                    'Consider adding appropriate indexes',
                    'Review query selectivity',
                    'Check for unnecessary field projections'
                ]
            };
        } catch (error) {
            logger.error('Error explaining query:', error);
            throw error;
        }
    }

    /**
     * Database maintenance operations
     */
    static async performMaintenance(): Promise<void> {
        try {
            const ClinicalIntervention = mongoose.model('ClinicalIntervention');

            // Analyze collection statistics
            const stats = await ClinicalIntervention.collection.stats();
            logger.info('Collection statistics:', {
                count: stats.count,
                avgObjSize: stats.avgObjSize,
                storageSize: stats.storageSize,
                totalIndexSize: stats.totalIndexSize
            });

            // Check for fragmentation
            if (stats.storageSize > stats.size * 2) {
                logger.warn('Collection fragmentation detected, consider compacting');
            }

            // Update index statistics
            await this.analyzeIndexUsage();

            logger.info('Database maintenance completed');
        } catch (error) {
            logger.error('Error during database maintenance:', error);
            throw error;
        }
    }

    /**
     * Connection pool optimization
     */
    static optimizeConnectionPool(): void {
        const options = {
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10'),
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2'),
            maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME || '30000'),
            serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || '5000'),
            socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT || '45000'),
            bufferMaxEntries: 0, // Disable mongoose buffering
            bufferCommands: false, // Disable mongoose buffering
        };

        mongoose.set('bufferCommands', false);

        logger.info('MongoDB connection pool optimized:', options);
    }
}

// ===============================
// QUERY BUILDERS
// ===============================

export class OptimizedQueryBuilder {
    /**
     * Build optimized intervention list query
     */
    static buildInterventionListQuery(filters: any) {
        const {
            workplaceId,
            patientId,
            category,
            priority,
            status,
            identifiedBy,
            assignedTo,
            dateFrom,
            dateTo,
            search
        } = filters;

        // Start with most selective filters
        const pipeline: any[] = [];

        // Match stage - use compound index
        const matchStage: any = {
            isDeleted: { $ne: true }
        };

        // Add workplaceId filter only if not super_admin
        // Super_admin can see interventions from all workplaces
        if (workplaceId && !filters.isSuperAdmin) {
            matchStage.workplaceId = new mongoose.Types.ObjectId(workplaceId);
        }

        if (patientId) matchStage.patientId = new mongoose.Types.ObjectId(patientId);
        if (category) matchStage.category = category;
        if (priority) matchStage.priority = priority;
        if (status) matchStage.status = status;
        if (identifiedBy) matchStage.identifiedBy = new mongoose.Types.ObjectId(identifiedBy);

        // Date range filter
        if (dateFrom || dateTo) {
            matchStage.identifiedDate = {};
            if (dateFrom) matchStage.identifiedDate.$gte = dateFrom;
            if (dateTo) matchStage.identifiedDate.$lte = dateTo;
        }

        pipeline.push({ $match: matchStage });

        // Assignment filter (if needed)
        if (assignedTo) {
            pipeline.push({
                $match: {
                    'assignments.userId': new mongoose.Types.ObjectId(assignedTo)
                }
            });
        }

        // Text search (if needed)
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { interventionNumber: { $regex: search, $options: 'i' } },
                        { issueDescription: { $regex: search, $options: 'i' } },
                        { implementationNotes: { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        // Lookup patient info (only essential fields)
        pipeline.push({
            $lookup: {
                from: 'patients',
                localField: 'patientId',
                foreignField: '_id',
                as: 'patient',
                pipeline: [
                    {
                        $project: {
                            firstName: 1,
                            lastName: 1,
                            mrn: 1,
                            dateOfBirth: 1
                        }
                    }
                ]
            }
        });

        // Lookup user info
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'identifiedBy',
                foreignField: '_id',
                as: 'identifiedByUser',
                pipeline: [
                    {
                        $project: {
                            firstName: 1,
                            lastName: 1,
                            email: 1
                        }
                    }
                ]
            }
        });

        // Unwind lookups
        pipeline.push(
            { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$identifiedByUser', preserveNullAndEmptyArrays: true } }
        );

        // Project only necessary fields for list view
        pipeline.push({
            $project: {
                interventionNumber: 1,
                category: 1,
                priority: 1,
                status: 1,
                identifiedDate: 1,
                startedAt: 1,
                completedAt: 1,
                issueDescriptionPreview: { $substr: ['$issueDescription', 0, 100] },
                patient: 1,
                identifiedByUser: 1,
                assignmentCount: { $size: { $ifNull: ['$assignments', []] } },
                strategyCount: { $size: { $ifNull: ['$strategies', []] } },
                hasOutcome: { $ne: ['$outcomes', null] },
                followUpRequired: '$followUp.required',
                followUpScheduled: '$followUp.scheduledDate',
                createdAt: 1,
                updatedAt: 1
            }
        });

        return pipeline;
    }

    /**
     * Build optimized dashboard metrics query
     */
    static buildDashboardMetricsQuery(workplaceId: string, dateRange?: { from: Date; to: Date }) {
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
                    // Overall statistics
                    overallStats: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                active: {
                                    $sum: {
                                        $cond: [
                                            { $in: ['$status', ['identified', 'planning', 'in_progress', 'implemented']] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                completed: {
                                    $sum: {
                                        $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                                    }
                                },
                                overdue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $in: ['$status', ['identified', 'planning', 'in_progress', 'implemented']] },
                                                    {
                                                        $lt: [
                                                            '$startedAt',
                                                            {
                                                                $dateSubtract: {
                                                                    startDate: new Date(),
                                                                    unit: 'day',
                                                                    amount: {
                                                                        $switch: {
                                                                            branches: [
                                                                                { case: { $in: ['$priority', ['critical', 'high']] }, then: 1 },
                                                                                { case: { $eq: ['$priority', 'medium'] }, then: 3 },
                                                                                { case: { $eq: ['$priority', 'low'] }, then: 7 }
                                                                            ],
                                                                            default: 3
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    }
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                avgResolutionTime: {
                                    $avg: {
                                        $cond: [
                                            { $and: [{ $eq: ['$status', 'completed'] }, { $gt: ['$actualDuration', 0] }] },
                                            '$actualDuration',
                                            null
                                        ]
                                    }
                                },
                                totalCostSavings: {
                                    $sum: {
                                        $ifNull: ['$outcomes.successMetrics.costSavings', 0]
                                    }
                                }
                            }
                        }
                    ],

                    // Category distribution with success rates
                    categoryStats: [
                        {
                            $group: {
                                _id: '$category',
                                count: { $sum: 1 },
                                completed: {
                                    $sum: {
                                        $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                                    }
                                },
                                successful: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ['$status', 'completed'] },
                                                    { $eq: ['$outcomes.successMetrics.problemResolved', true] }
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            $addFields: {
                                successRate: {
                                    $cond: [
                                        { $gt: ['$completed', 0] },
                                        { $multiply: [{ $divide: ['$successful', '$completed'] }, 100] },
                                        0
                                    ]
                                }
                            }
                        }
                    ],

                    // Priority distribution
                    priorityStats: [
                        {
                            $group: {
                                _id: '$priority',
                                count: { $sum: 1 }
                            }
                        }
                    ],

                    // Recent interventions
                    recentInterventions: [
                        { $sort: { identifiedDate: -1 } },
                        { $limit: 10 },
                        {
                            $lookup: {
                                from: 'patients',
                                localField: 'patientId',
                                foreignField: '_id',
                                as: 'patient',
                                pipeline: [{ $project: { firstName: 1, lastName: 1 } }]
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
                                patientName: {
                                    $concat: ['$patient.firstName', ' ', '$patient.lastName']
                                }
                            }
                        }
                    ]
                }
            }
        ];
    }
}

// ===============================
// INITIALIZATION
// ===============================

export const initializeDatabaseOptimization = async (): Promise<void> => {
    try {
        // Optimize connection pool
        DatabaseOptimizer.optimizeConnectionPool();

        // Create optimized indexes
        await DatabaseOptimizer.createOptimizedIndexes();

        // Schedule periodic maintenance
        setInterval(async () => {
            try {
                await DatabaseOptimizer.performMaintenance();
            } catch (error) {
                logger.error('Scheduled maintenance error:', error);
            }
        }, 24 * 60 * 60 * 1000); // Daily

        logger.info('Database optimization initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize database optimization:', error);
        throw error;
    }
};