// Database Indexing Strategies for Reports & Analytics
import mongoose from 'mongoose';
import logger from './logger';

interface IndexDefinition {
    fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
    options?: {
        name?: string;
        unique?: boolean;
        sparse?: boolean;
        background?: boolean;
        partialFilterExpression?: any;
        expireAfterSeconds?: number;
    };
}

interface IndexRecommendation {
    collection: string;
    index: IndexDefinition;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
}

/**
 * Database indexing service for optimizing report queries
 */
export class DatabaseIndexingService {
    private static instance: DatabaseIndexingService;
    private indexRecommendations: IndexRecommendation[] = [];

    static getInstance(): DatabaseIndexingService {
        if (!DatabaseIndexingService.instance) {
            DatabaseIndexingService.instance = new DatabaseIndexingService();
        }
        return DatabaseIndexingService.instance;
    }

    /**
     * Create optimized indexes for report collections
     */
    async createReportIndexes(): Promise<void> {
        logger.info('Creating optimized indexes for report collections...');

        try {
            await Promise.all([
                this.createMTRIndexes(),
                this.createInterventionIndexes(),
                this.createProblemIndexes(),
                this.createMedicationIndexes(),
                this.createAuditIndexes(),
                this.createTemplateIndexes(),
                this.createScheduleIndexes(),
            ]);

            logger.info('All report indexes created successfully');
        } catch (error) {
            logger.error('Failed to create report indexes:', error);
            throw error;
        }
    }

    /**
     * Create indexes for MedicationTherapyReview collection
     */
    private async createMTRIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('medicationtherapyreviews');

        const indexes: IndexDefinition[] = [
            // Compound index for workspace and date filtering (most common query pattern)
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Compound index for workspace, status, and date
            {
                fields: { workplaceId: 1, status: 1, createdAt: -1 },
                options: {
                    name: 'workplace_status_date_idx',
                    background: true,
                },
            },
            // Index for patient-specific queries
            {
                fields: { workplaceId: 1, patientId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_patient_date_idx',
                    background: true,
                },
            },
            // Index for pharmacist performance queries
            {
                fields: { workplaceId: 1, pharmacistId: 1, status: 1 },
                options: {
                    name: 'workplace_pharmacist_status_idx',
                    background: true,
                },
            },
            // Index for review type analysis
            {
                fields: { workplaceId: 1, reviewType: 1, createdAt: -1 },
                options: {
                    name: 'workplace_reviewtype_date_idx',
                    background: true,
                },
            },
            // Index for priority-based queries
            {
                fields: { workplaceId: 1, priority: 1, status: 1 },
                options: {
                    name: 'workplace_priority_status_idx',
                    background: true,
                },
            },
            // Sparse index for completed reviews (completion time analysis)
            {
                fields: { workplaceId: 1, completedAt: -1 },
                options: {
                    name: 'workplace_completed_idx',
                    sparse: true,
                    background: true,
                },
            },
            // Index for cost savings analysis
            {
                fields: { workplaceId: 1, 'clinicalOutcomes.costSavings': -1 },
                options: {
                    name: 'workplace_costsavings_idx',
                    background: true,
                },
            },
            // Text index for search functionality
            {
                fields: {
                    'patient.name': 'text',
                    'medications.name': 'text',
                    notes: 'text',
                },
                options: {
                    name: 'mtr_text_search_idx',
                    background: true,
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'MedicationTherapyReview');
    }

    /**
     * Create indexes for MTRIntervention collection
     */
    private async createInterventionIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('mtrinterventions');

        const indexes: IndexDefinition[] = [
            // Primary compound index
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Index for intervention type analysis
            {
                fields: { workplaceId: 1, type: 1, outcome: 1 },
                options: {
                    name: 'workplace_type_outcome_idx',
                    background: true,
                },
            },
            // Index for pharmacist performance
            {
                fields: { workplaceId: 1, pharmacistId: 1, outcome: 1 },
                options: {
                    name: 'workplace_pharmacist_outcome_idx',
                    background: true,
                },
            },
            // Index for MTR-specific interventions
            {
                fields: { workplaceId: 1, mtrId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_mtr_date_idx',
                    background: true,
                },
            },
            // Index for cost analysis
            {
                fields: { workplaceId: 1, costSavings: -1 },
                options: {
                    name: 'workplace_costsavings_idx',
                    background: true,
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'MTRIntervention');
    }

    /**
     * Create indexes for DrugTherapyProblem collection
     */
    private async createProblemIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('drugtherapyproblems');

        const indexes: IndexDefinition[] = [
            // Primary compound index
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Index for problem category analysis
            {
                fields: { workplaceId: 1, category: 1, status: 1 },
                options: {
                    name: 'workplace_category_status_idx',
                    background: true,
                },
            },
            // Index for severity analysis
            {
                fields: { workplaceId: 1, severity: 1, status: 1 },
                options: {
                    name: 'workplace_severity_status_idx',
                    background: true,
                },
            },
            // Index for adverse events
            {
                fields: { workplaceId: 1, category: 1, severity: 1 },
                options: {
                    name: 'workplace_category_severity_idx',
                    background: true,
                    partialFilterExpression: { category: 'adverse_event' },
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'DrugTherapyProblem');
    }

    /**
     * Create indexes for MedicationManagement collection
     */
    private async createMedicationIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('medicationmanagements');

        const indexes: IndexDefinition[] = [
            // Primary compound index
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Index for medication analysis
            {
                fields: { workplaceId: 1, 'medication.name': 1, status: 1 },
                options: {
                    name: 'workplace_medication_status_idx',
                    background: true,
                },
            },
            // Index for patient medication tracking
            {
                fields: { workplaceId: 1, patientId: 1, status: 1 },
                options: {
                    name: 'workplace_patient_status_idx',
                    background: true,
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'MedicationManagement');
    }

    /**
     * Create indexes for audit collections
     */
    private async createAuditIndexes(): Promise<void> {
        const auditCollections = [
            'mtrauditlogs',
            'reportauditlogs',
            'communicationauditlogs',
        ];

        for (const collectionName of auditCollections) {
            const collection = mongoose.connection.db.collection(collectionName);

            const indexes: IndexDefinition[] = [
                // Primary compound index
                {
                    fields: { workplaceId: 1, timestamp: -1 },
                    options: {
                        name: 'workplace_timestamp_idx',
                        background: true,
                    },
                },
                // Index for user activity tracking
                {
                    fields: { workplaceId: 1, userId: 1, timestamp: -1 },
                    options: {
                        name: 'workplace_user_timestamp_idx',
                        background: true,
                    },
                },
                // Index for action-based queries
                {
                    fields: { workplaceId: 1, action: 1, timestamp: -1 },
                    options: {
                        name: 'workplace_action_timestamp_idx',
                        background: true,
                    },
                },
                // TTL index for automatic cleanup (optional)
                {
                    fields: { timestamp: 1 },
                    options: {
                        name: 'audit_ttl_idx',
                        expireAfterSeconds: 365 * 24 * 60 * 60, // 1 year
                        background: true,
                    },
                },
            ];

            await this.createIndexes(collection, indexes, collectionName);
        }
    }

    /**
     * Create indexes for ReportTemplate collection
     */
    private async createTemplateIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('reporttemplates');

        const indexes: IndexDefinition[] = [
            // Primary compound index
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Index for template type queries
            {
                fields: { workplaceId: 1, reportType: 1, isPublic: 1 },
                options: {
                    name: 'workplace_type_public_idx',
                    background: true,
                },
            },
            // Index for user templates
            {
                fields: { workplaceId: 1, createdBy: 1, createdAt: -1 },
                options: {
                    name: 'workplace_creator_date_idx',
                    background: true,
                },
            },
            // Text index for template search
            {
                fields: {
                    name: 'text',
                    description: 'text',
                },
                options: {
                    name: 'template_text_search_idx',
                    background: true,
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'ReportTemplate');
    }

    /**
     * Create indexes for ReportSchedule collection
     */
    private async createScheduleIndexes(): Promise<void> {
        const collection = mongoose.connection.db.collection('reportschedules');

        const indexes: IndexDefinition[] = [
            // Primary compound index
            {
                fields: { workplaceId: 1, createdAt: -1 },
                options: {
                    name: 'workplace_date_idx',
                    background: true,
                },
            },
            // Index for active schedules
            {
                fields: { workplaceId: 1, isActive: 1, nextRun: 1 },
                options: {
                    name: 'workplace_active_nextrun_idx',
                    background: true,
                },
            },
            // Index for schedule execution
            {
                fields: { isActive: 1, nextRun: 1 },
                options: {
                    name: 'active_nextrun_idx',
                    background: true,
                },
            },
            // Index for user schedules
            {
                fields: { workplaceId: 1, createdBy: 1, isActive: 1 },
                options: {
                    name: 'workplace_creator_active_idx',
                    background: true,
                },
            },
        ];

        await this.createIndexes(collection, indexes, 'ReportSchedule');
    }

    /**
     * Create indexes for a collection
     */
    private async createIndexes(
        collection: any,
        indexes: IndexDefinition[],
        collectionName: string
    ): Promise<void> {
        try {
            for (const indexDef of indexes) {
                const { fields, options = {} } = indexDef;

                // Check if index already exists
                const existingIndexes = await collection.indexes();
                const indexName = options.name || this.generateIndexName(fields);

                const indexExists = existingIndexes.some((idx: any) =>
                    idx.name === indexName || this.compareIndexFields(idx.key, fields)
                );

                if (!indexExists) {
                    await collection.createIndex(fields, options);
                    logger.info(`Created index ${indexName} on ${collectionName}`);
                } else {
                    logger.debug(`Index ${indexName} already exists on ${collectionName}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to create indexes for ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generate index name from fields
     */
    private generateIndexName(fields: Record<string, any>): string {
        return Object.entries(fields)
            .map(([field, direction]) => `${field}_${direction}`)
            .join('_');
    }

    /**
     * Compare index fields
     */
    private compareIndexFields(existing: Record<string, any>, proposed: Record<string, any>): boolean {
        const existingKeys = Object.keys(existing).sort();
        const proposedKeys = Object.keys(proposed).sort();

        if (existingKeys.length !== proposedKeys.length) {
            return false;
        }

        return existingKeys.every((key, index) =>
            key === proposedKeys[index] && existing[key] === proposed[key]
        );
    }

    /**
     * Analyze query performance and suggest indexes
     */
    async analyzeQueryPerformance(): Promise<IndexRecommendation[]> {
        logger.info('Analyzing query performance for index recommendations...');

        try {
            const recommendations: IndexRecommendation[] = [];

            // Analyze slow queries from MongoDB profiler
            const slowQueries = await this.getSlowQueries();

            for (const query of slowQueries) {
                const recommendation = this.generateIndexRecommendation(query);
                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }

            this.indexRecommendations = recommendations;
            return recommendations;
        } catch (error) {
            logger.error('Failed to analyze query performance:', error);
            return [];
        }
    }

    /**
     * Get slow queries from MongoDB profiler
     */
    private async getSlowQueries(): Promise<any[]> {
        try {
            // Enable profiler for slow operations (>100ms) - skip for Atlas
            if (!process.env.MONGODB_URI?.includes('mongodb.net') && process.env.DISABLE_PROFILING !== 'true') {
                await mongoose.connection.db.admin().command({
                    profile: 2,
                    slowms: 100,
                });
            }

            // Get profiler data
            const profilerData = await mongoose.connection.db
                .collection('system.profile')
                .find({
                    ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
                    ns: { $regex: /^reports_/ }, // Only report-related collections
                })
                .sort({ ts: -1 })
                .limit(100)
                .toArray();

            return profilerData;
        } catch (error) {
            logger.error('Failed to get slow queries:', error);
            return [];
        }
    }

    /**
     * Generate index recommendation from slow query
     */
    private generateIndexRecommendation(query: any): IndexRecommendation | null {
        try {
            const { ns, command, ts, millis } = query;
            const collection = ns.split('.')[1];

            if (!command || !command.filter) {
                return null;
            }

            const filterFields = Object.keys(command.filter);
            const sortFields = command.sort ? Object.keys(command.sort) : [];

            // Generate compound index recommendation
            const indexFields: Record<string, 1 | -1> = {};

            // Add filter fields first
            filterFields.forEach(field => {
                if (field !== '_id') {
                    indexFields[field] = 1;
                }
            });

            // Add sort fields
            sortFields.forEach(field => {
                if (!indexFields[field]) {
                    indexFields[field] = command.sort[field];
                }
            });

            if (Object.keys(indexFields).length === 0) {
                return null;
            }

            return {
                collection,
                index: {
                    fields: indexFields,
                    options: {
                        background: true,
                        name: `${collection}_${this.generateIndexName(indexFields)}_recommended`,
                    },
                },
                reason: `Slow query detected (${millis}ms) - would benefit from compound index`,
                priority: millis > 1000 ? 'high' : millis > 500 ? 'medium' : 'low',
                estimatedImpact: `Could reduce query time from ${millis}ms to <50ms`,
            };
        } catch (error) {
            logger.error('Failed to generate index recommendation:', error);
            return null;
        }
    }

    /**
     * Get current index recommendations
     */
    getIndexRecommendations(): IndexRecommendation[] {
        return this.indexRecommendations;
    }

    /**
     * Drop unused indexes
     */
    async dropUnusedIndexes(): Promise<void> {
        logger.info('Analyzing and dropping unused indexes...');

        try {
            const collections = await mongoose.connection.db.listCollections().toArray();

            for (const collectionInfo of collections) {
                const collection = mongoose.connection.db.collection(collectionInfo.name);
                const indexes = await collection.indexes();

                for (const index of indexes) {
                    if (index.name === '_id_') continue; // Never drop _id index

                    // Check index usage statistics
                    const stats = await collection.aggregate([
                        { $indexStats: {} },
                        { $match: { name: index.name } },
                    ]).toArray();

                    if (stats.length > 0 && stats[0].accesses.ops === 0) {
                        logger.info(`Dropping unused index ${index.name} from ${collectionInfo.name}`);
                        await collection.dropIndex(index.name);
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to drop unused indexes:', error);
        }
    }

    /**
     * Get index usage statistics
     */
    async getIndexStats(): Promise<any[]> {
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            const stats: any[] = [];

            for (const collectionInfo of collections) {
                const collection = mongoose.connection.db.collection(collectionInfo.name);
                const indexStats = await collection.aggregate([{ $indexStats: {} }]).toArray();

                stats.push({
                    collection: collectionInfo.name,
                    indexes: indexStats,
                });
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get index stats:', error);
            return [];
        }
    }
}

export default DatabaseIndexingService;
