import logger from '../../../utils/logger';
import diagnosticCacheService from './diagnosticCacheService';

/**
 * Performance Optimization Service
 * Database query optimization, connection pooling, and background job processing
 */

export interface QueryOptimizationResult {
    originalQuery: any;
    optimizedQuery: any;
    estimatedImprovement: number;
    recommendations: string[];
}

export interface ConnectionPoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    averageWaitTime: number;
    connectionErrors: number;
}

export interface BackgroundJob {
    id: string;
    type: 'ai_processing' | 'data_aggregation' | 'cache_warmup' | 'cleanup' | 'analytics';
    priority: 'low' | 'medium' | 'high' | 'critical';
    payload: any;
    createdAt: Date;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    retryCount: number;
    maxRetries: number;
    error?: string;
    progress?: number;
}

export interface PerformanceMetrics {
    queryPerformance: {
        averageQueryTime: number;
        slowQueries: number;
        optimizedQueries: number;
        cacheHitRate: number;
    };
    connectionPool: ConnectionPoolStats;
    backgroundJobs: {
        totalJobs: number;
        completedJobs: number;
        failedJobs: number;
        averageProcessingTime: number;
    };
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
}

class PerformanceOptimizationService {
    private backgroundJobs: Map<string, BackgroundJob> = new Map();
    private jobQueue: BackgroundJob[] = [];
    private isProcessingJobs = false;
    private connectionPoolStats: ConnectionPoolStats = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        averageWaitTime: 0,
        connectionErrors: 0,
    };
    private queryMetrics = {
        totalQueries: 0,
        totalQueryTime: 0,
        slowQueries: 0,
        optimizedQueries: 0,
    };

    constructor() {
        this.startBackgroundJobProcessor();
        this.startPerformanceMonitoring();
    }

    // ===============================
    // DATABASE QUERY OPTIMIZATION
    // ===============================

    /**
     * Optimize MongoDB aggregation pipeline
     */
    optimizeAggregationPipeline(pipeline: any[]): QueryOptimizationResult {
        const originalPipeline = [...pipeline];
        const optimizedPipeline = [...pipeline];
        const recommendations: string[] = [];
        let estimatedImprovement = 0;

        // Move $match stages to the beginning
        const matchStages = optimizedPipeline.filter(stage => stage.$match);
        const otherStages = optimizedPipeline.filter(stage => !stage.$match);

        if (matchStages.length > 0 && optimizedPipeline.indexOf(matchStages[0]) > 0) {
            optimizedPipeline.splice(0, 0, ...matchStages);
            otherStages.forEach(stage => {
                if (!matchStages.includes(stage)) {
                    optimizedPipeline.push(stage);
                }
            });
            recommendations.push('Moved $match stages to beginning for early filtering');
            estimatedImprovement += 20;
        }

        // Optimize $lookup stages
        for (let i = 0; i < optimizedPipeline.length; i++) {
            const stage = optimizedPipeline[i];
            if (stage.$lookup) {
                // Add $match after $lookup if not present
                const nextStage = optimizedPipeline[i + 1];
                if (!nextStage || !nextStage.$match) {
                    recommendations.push('Consider adding $match after $lookup to filter joined data');
                    estimatedImprovement += 15;
                }
            }
        }

        // Check for unnecessary $project stages
        const projectStages = optimizedPipeline.filter(stage => stage.$project);
        if (projectStages.length > 1) {
            recommendations.push('Multiple $project stages detected - consider combining them');
            estimatedImprovement += 10;
        }

        // Add $limit if not present and no $group stage
        const hasLimit = optimizedPipeline.some(stage => stage.$limit);
        const hasGroup = optimizedPipeline.some(stage => stage.$group);

        if (!hasLimit && !hasGroup) {
            recommendations.push('Consider adding $limit to prevent large result sets');
            estimatedImprovement += 25;
        }

        return {
            originalQuery: originalPipeline,
            optimizedQuery: optimizedPipeline,
            estimatedImprovement,
            recommendations,
        };
    }

    /**
     * Optimize find queries
     */
    optimizeFindQuery(query: any, options: any = {}): QueryOptimizationResult {
        const originalQuery = { ...query };
        const optimizedQuery = { ...query };
        const recommendations: string[] = [];
        let estimatedImprovement = 0;

        // Check for inefficient regex queries
        for (const [key, value] of Object.entries(optimizedQuery)) {
            if (value && typeof value === 'object' && (value as any).$regex) {
                if (!(value as any).$options || !(value as any).$options.includes('i')) {
                    recommendations.push(`Consider case-insensitive regex for field: ${key}`);
                }

                if (typeof (value as any).$regex === 'string' && !(value as any).$regex.startsWith('^')) {
                    recommendations.push(`Consider anchoring regex with ^ for field: ${key}`);
                    estimatedImprovement += 30;
                }
            }
        }

        // Check for missing indexes
        const indexableFields = ['workplaceId', 'patientId', 'createdAt', 'status', 'isDeleted'];
        for (const field of indexableFields) {
            if (optimizedQuery[field]) {
                recommendations.push(`Ensure index exists for field: ${field}`);
                estimatedImprovement += 20;
            }
        }

        // Optimize date range queries
        if (optimizedQuery.createdAt && typeof optimizedQuery.createdAt === 'object') {
            if (optimizedQuery.createdAt.$gte && optimizedQuery.createdAt.$lte) {
                recommendations.push('Date range query detected - ensure compound index on (workplaceId, createdAt)');
                estimatedImprovement += 15;
            }
        }

        // Add projection if not specified
        if (!options.projection && !options.select) {
            recommendations.push('Consider adding projection to limit returned fields');
            estimatedImprovement += 10;
        }

        // Add limit if not specified
        if (!options.limit) {
            recommendations.push('Consider adding limit to prevent large result sets');
            estimatedImprovement += 20;
        }

        return {
            originalQuery,
            optimizedQuery,
            estimatedImprovement,
            recommendations,
        };
    }

    /**
     * Create optimized indexes for diagnostic collections
     */
    getRecommendedIndexes(): Array<{
        collection: string;
        index: any;
        options?: any;
        rationale: string;
    }> {
        return [
            {
                collection: 'diagnosticrequests',
                index: { workplaceId: 1, patientId: 1, createdAt: -1 },
                options: { background: true },
                rationale: 'Optimize patient diagnostic history queries',
            },
            {
                collection: 'diagnosticrequests',
                index: { workplaceId: 1, status: 1, createdAt: -1 },
                options: { background: true },
                rationale: 'Optimize status-based queries with date sorting',
            },
            {
                collection: 'diagnosticrequests',
                index: { workplaceId: 1, pharmacistId: 1, createdAt: -1 },
                options: { background: true },
                rationale: 'Optimize pharmacist-specific diagnostic queries',
            },
            {
                collection: 'diagnosticresults',
                index: { requestId: 1 },
                options: { unique: true, background: true },
                rationale: 'Ensure unique results per request and fast lookups',
            },
            {
                collection: 'diagnosticresults',
                index: { workplaceId: 1, createdAt: -1 },
                options: { background: true },
                rationale: 'Optimize workplace-wide result queries',
            },
            {
                collection: 'diagnosticresults',
                index: { 'aiMetadata.modelId': 1, 'aiMetadata.confidenceScore': -1 },
                options: { background: true },
                rationale: 'Optimize AI performance analytics queries',
            },
            {
                collection: 'laborders',
                index: { workplaceId: 1, patientId: 1, orderDate: -1 },
                options: { background: true },
                rationale: 'Optimize patient lab order history',
            },
            {
                collection: 'laborders',
                index: { workplaceId: 1, status: 1, orderDate: -1 },
                options: { background: true },
                rationale: 'Optimize lab order status tracking',
            },
            {
                collection: 'labresults',
                index: { workplaceId: 1, patientId: 1, performedAt: -1 },
                options: { background: true },
                rationale: 'Optimize patient lab result history',
            },
            {
                collection: 'labresults',
                index: { workplaceId: 1, testCode: 1, performedAt: -1 },
                options: { background: true },
                rationale: 'Optimize test-specific trend analysis',
            },
            {
                collection: 'labresults',
                index: { interpretation: 1, workplaceId: 1 },
                options: { background: true },
                rationale: 'Optimize abnormal result queries',
            },
        ];
    }

    // ===============================
    // CONNECTION POOLING
    // ===============================

    /**
     * Monitor connection pool performance
     */
    updateConnectionPoolStats(stats: Partial<ConnectionPoolStats>): void {
        this.connectionPoolStats = { ...this.connectionPoolStats, ...stats };
    }

    /**
     * Get connection pool recommendations
     */
    getConnectionPoolRecommendations(): string[] {
        const recommendations: string[] = [];
        const stats = this.connectionPoolStats;

        if (stats.waitingRequests > 10) {
            recommendations.push('High number of waiting requests - consider increasing pool size');
        }

        if (stats.averageWaitTime > 1000) {
            recommendations.push('High average wait time - consider optimizing queries or increasing pool size');
        }

        if (stats.connectionErrors > 0) {
            recommendations.push('Connection errors detected - check network stability and database health');
        }

        const utilizationRate = stats.activeConnections / stats.totalConnections;
        if (utilizationRate > 0.9) {
            recommendations.push('High connection utilization - consider increasing pool size');
        } else if (utilizationRate < 0.3) {
            recommendations.push('Low connection utilization - consider reducing pool size');
        }

        return recommendations;
    }

    // ===============================
    // BACKGROUND JOB PROCESSING
    // ===============================

    /**
     * Schedule background job
     */
    scheduleJob(
        type: BackgroundJob['type'],
        payload: any,
        options: {
            priority?: BackgroundJob['priority'];
            delay?: number;
            maxRetries?: number;
        } = {}
    ): string {
        const jobId = this.generateJobId();
        const now = new Date();
        const scheduledAt = options.delay ?
            new Date(now.getTime() + options.delay) : now;

        const job: BackgroundJob = {
            id: jobId,
            type,
            priority: options.priority || 'medium',
            payload,
            createdAt: now,
            scheduledAt,
            status: 'pending',
            retryCount: 0,
            maxRetries: options.maxRetries || 3,
        };

        this.backgroundJobs.set(jobId, job);
        this.addToQueue(job);

        logger.info('Background job scheduled', {
            jobId,
            type,
            priority: job.priority,
            scheduledAt,
        });

        return jobId;
    }

    /**
     * Process AI diagnostic request in background
     */
    scheduleAIProcessing(
        requestId: string,
        inputData: any,
        priority: BackgroundJob['priority'] = 'high'
    ): string {
        return this.scheduleJob('ai_processing', {
            requestId,
            inputData,
        }, { priority });
    }

    /**
     * Schedule data aggregation job
     */
    scheduleDataAggregation(
        aggregationType: string,
        parameters: any,
        priority: BackgroundJob['priority'] = 'low'
    ): string {
        return this.scheduleJob('data_aggregation', {
            aggregationType,
            parameters,
        }, { priority });
    }

    /**
     * Schedule cache warmup
     */
    scheduleCacheWarmup(
        cacheKeys: string[],
        priority: BackgroundJob['priority'] = 'medium'
    ): string {
        return this.scheduleJob('cache_warmup', {
            cacheKeys,
        }, { priority });
    }

    /**
     * Get job status
     */
    getJobStatus(jobId: string): BackgroundJob | null {
        return this.backgroundJobs.get(jobId) || null;
    }

    /**
     * Cancel job
     */
    cancelJob(jobId: string): boolean {
        const job = this.backgroundJobs.get(jobId);

        if (job && job.status === 'pending') {
            job.status = 'cancelled';
            this.backgroundJobs.set(jobId, job);

            // Remove from queue
            this.jobQueue = this.jobQueue.filter(queuedJob => queuedJob.id !== jobId);

            logger.info('Background job cancelled', { jobId });
            return true;
        }

        return false;
    }

    /**
     * Add job to priority queue
     */
    private addToQueue(job: BackgroundJob): void {
        // Insert job in priority order
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const jobPriority = priorityOrder[job.priority];

        let insertIndex = this.jobQueue.length;
        for (let i = 0; i < this.jobQueue.length; i++) {
            const queuePriority = priorityOrder[this.jobQueue[i]!.priority];
            if (jobPriority < queuePriority) {
                insertIndex = i;
                break;
            }
        }

        this.jobQueue.splice(insertIndex, 0, job);
    }

    /**
     * Start background job processor
     */
    private startBackgroundJobProcessor(): void {
        setInterval(async () => {
            if (!this.isProcessingJobs && this.jobQueue.length > 0) {
                await this.processNextJob();
            }
        }, 1000); // Check every second
    }

    /**
     * Process next job in queue
     */
    private async processNextJob(): Promise<void> {
        if (this.jobQueue.length === 0) {
            return;
        }

        this.isProcessingJobs = true;

        try {
            const job = this.jobQueue.shift();
            if (!job) {
                return;
            }

            // Check if job is ready to run
            if (job.scheduledAt > new Date()) {
                // Put back in queue
                this.addToQueue(job);
                return;
            }

            await this.executeJob(job);
        } catch (error) {
            logger.error('Error in job processor', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            this.isProcessingJobs = false;
        }
    }

    /**
     * Execute background job
     */
    private async executeJob(job: BackgroundJob): Promise<void> {
        job.status = 'running';
        job.startedAt = new Date();
        this.backgroundJobs.set(job.id, job);

        logger.info('Executing background job', {
            jobId: job.id,
            type: job.type,
            priority: job.priority,
        });

        try {
            switch (job.type) {
                case 'ai_processing':
                    await this.executeAIProcessingJob(job);
                    break;
                case 'data_aggregation':
                    await this.executeDataAggregationJob(job);
                    break;
                case 'cache_warmup':
                    await this.executeCacheWarmupJob(job);
                    break;
                case 'cleanup':
                    await this.executeCleanupJob(job);
                    break;
                case 'analytics':
                    await this.executeAnalyticsJob(job);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            job.status = 'completed';
            job.completedAt = new Date();
            job.progress = 100;

            logger.info('Background job completed', {
                jobId: job.id,
                type: job.type,
                duration: job.completedAt.getTime() - job.startedAt!.getTime(),
            });
        } catch (error) {
            job.status = 'failed';
            job.error = error instanceof Error ? error.message : 'Unknown error';
            job.retryCount++;

            logger.error('Background job failed', {
                jobId: job.id,
                type: job.type,
                error: job.error,
                retryCount: job.retryCount,
            });

            // Retry if under max retries
            if (job.retryCount < job.maxRetries) {
                job.status = 'pending';
                job.scheduledAt = new Date(Date.now() + (job.retryCount * 30000)); // Exponential backoff
                this.addToQueue(job);
            }
        }

        this.backgroundJobs.set(job.id, job);
    }

    /**
     * Execute AI processing job
     */
    private async executeAIProcessingJob(job: BackgroundJob): Promise<void> {
        const { requestId, inputData } = job.payload;

        // Simulate AI processing
        job.progress = 25;
        await this.sleep(1000);

        job.progress = 50;
        await this.sleep(2000);

        job.progress = 75;
        await this.sleep(1000);

        // Cache result
        const cacheKey = diagnosticCacheService.generateCacheKey('ai_result', inputData);
        await diagnosticCacheService.cacheAIResult(cacheKey, {
            requestId,
            processed: true,
            timestamp: new Date(),
        });
    }

    /**
     * Execute data aggregation job
     */
    private async executeDataAggregationJob(job: BackgroundJob): Promise<void> {
        const { aggregationType, parameters } = job.payload;

        logger.info('Executing data aggregation', {
            type: aggregationType,
            parameters,
        });

        // Simulate aggregation processing
        await this.sleep(5000);
    }

    /**
     * Execute cache warmup job
     */
    private async executeCacheWarmupJob(job: BackgroundJob): Promise<void> {
        const { cacheKeys } = job.payload;

        for (let i = 0; i < cacheKeys.length; i++) {
            job.progress = Math.round((i / cacheKeys.length) * 100);

            // Simulate cache warmup
            await this.sleep(100);
        }
    }

    /**
     * Execute cleanup job
     */
    private async executeCleanupJob(job: BackgroundJob): Promise<void> {
        // Clean up old jobs
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

        for (const [jobId, existingJob] of this.backgroundJobs.entries()) {
            if (existingJob.completedAt && existingJob.completedAt < cutoff) {
                this.backgroundJobs.delete(jobId);
            }
        }

        logger.info('Cleanup job completed');
    }

    /**
     * Execute analytics job
     */
    private async executeAnalyticsJob(job: BackgroundJob): Promise<void> {
        // Simulate analytics processing
        await this.sleep(3000);

        logger.info('Analytics job completed');
    }

    /**
     * Generate unique job ID
     */
    private generateJobId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===============================
    // PERFORMANCE MONITORING
    // ===============================

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        setInterval(() => {
            this.collectPerformanceMetrics();
        }, 60000); // Every minute
    }

    /**
     * Collect performance metrics
     */
    private collectPerformanceMetrics(): void {
        const memoryUsage = process.memoryUsage();

        logger.debug('Performance metrics collected', {
            memoryUsage,
            connectionPool: this.connectionPoolStats,
            queryMetrics: this.queryMetrics,
            backgroundJobs: {
                total: this.backgroundJobs.size,
                queued: this.jobQueue.length,
            },
        });
    }

    /**
     * Get comprehensive performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        const completedJobs = Array.from(this.backgroundJobs.values())
            .filter(job => job.status === 'completed');

        const failedJobs = Array.from(this.backgroundJobs.values())
            .filter(job => job.status === 'failed');

        const totalProcessingTime = completedJobs.reduce((sum, job) => {
            if (job.startedAt && job.completedAt) {
                return sum + (job.completedAt!.getTime() - job.startedAt!.getTime());
            }
            return sum;
        }, 0);

        return {
            queryPerformance: {
                averageQueryTime: this.queryMetrics.totalQueries > 0 ?
                    this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries : 0,
                slowQueries: this.queryMetrics.slowQueries,
                optimizedQueries: this.queryMetrics.optimizedQueries,
                cacheHitRate: diagnosticCacheService.getStats().hitRate,
            },
            connectionPool: this.connectionPoolStats,
            backgroundJobs: {
                totalJobs: this.backgroundJobs.size,
                completedJobs: completedJobs.length,
                failedJobs: failedJobs.length,
                averageProcessingTime: completedJobs.length > 0 ?
                    totalProcessingTime / completedJobs.length : 0,
            },
            memoryUsage: process.memoryUsage(),
        };
    }

    /**
     * Get performance recommendations
     */
    getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];
        const metrics = this.getPerformanceMetrics();

        // Query performance recommendations
        if (metrics.queryPerformance.averageQueryTime > 1000) {
            recommendations.push('Average query time is high - consider query optimization');
        }

        if (metrics.queryPerformance.cacheHitRate < 0.5) {
            recommendations.push('Cache hit rate is low - consider cache tuning');
        }

        // Memory recommendations
        const memoryUsagePercent = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
        if (memoryUsagePercent > 0.8) {
            recommendations.push('High memory usage detected - consider memory optimization');
        }

        // Background job recommendations
        const jobFailureRate = metrics.backgroundJobs.failedJobs / metrics.backgroundJobs.totalJobs;
        if (jobFailureRate > 0.1) {
            recommendations.push('High background job failure rate - investigate job errors');
        }

        // Connection pool recommendations
        recommendations.push(...this.getConnectionPoolRecommendations());

        return recommendations;
    }
}

export default new PerformanceOptimizationService();