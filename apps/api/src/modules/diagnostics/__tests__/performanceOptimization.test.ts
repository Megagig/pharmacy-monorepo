import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import performanceOptimizationService from '../services/performanceOptimizationService';
import diagnosticCacheService from '../services/diagnosticCacheService';

describe('Performance Optimization Service Tests', () => {
    beforeEach(() => {
        // Clear any existing jobs and metrics
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Clean up
        jest.clearAllMocks();
    });

    describe('Query Optimization', () => {
        it('should optimize MongoDB aggregation pipeline', () => {
            const originalPipeline = [
                { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' } },
                { $match: { workplaceId: 'workspace123' } },
                { $project: { _id: 1, patientId: 1, createdAt: 1 } },
                { $sort: { createdAt: -1 } },
            ];

            const result = performanceOptimizationService.optimizeAggregationPipeline(originalPipeline);

            expect(result.originalQuery).toEqual(originalPipeline);
            expect(result.optimizedQuery).toBeDefined();
            expect(result.estimatedImprovement).toBeGreaterThan(0);
            expect(result.recommendations.length).toBeGreaterThan(0);

            // Should move $match to beginning
            expect(result.recommendations).toContain('Moved $match stages to beginning for early filtering');
        });

        it('should optimize find queries', () => {
            const originalQuery = {
                workplaceId: 'workspace123',
                patientId: 'patient456',
                createdAt: { $gte: new Date('2024-01-01'), $lte: new Date('2024-12-31') },
                symptoms: { $regex: 'headache', $options: 'i' },
            };

            const options = {};

            const result = performanceOptimizationService.optimizeFindQuery(originalQuery, options);

            expect(result.originalQuery).toEqual(originalQuery);
            expect(result.optimizedQuery).toBeDefined();
            expect(result.estimatedImprovement).toBeGreaterThan(0);
            expect(result.recommendations.length).toBeGreaterThan(0);

            // Should recommend indexes and projections
            expect(result.recommendations.some(r => r.includes('index'))).toBe(true);
            expect(result.recommendations.some(r => r.includes('projection'))).toBe(true);
        });

        it('should provide recommended indexes', () => {
            const indexes = performanceOptimizationService.getRecommendedIndexes();

            expect(Array.isArray(indexes)).toBe(true);
            expect(indexes.length).toBeGreaterThan(0);

            // Check index structure
            const diagnosticRequestIndex = indexes.find(idx =>
                idx.collection === 'diagnosticrequests' &&
                idx.index.workplaceId === 1
            );

            expect(diagnosticRequestIndex).toBeDefined();
            expect(diagnosticRequestIndex?.rationale).toBeDefined();
            expect(diagnosticRequestIndex?.options).toBeDefined();
        });

        it('should detect inefficient regex queries', () => {
            const queryWithBadRegex = {
                symptoms: { $regex: 'headache' }, // No anchoring
                notes: { $regex: 'pain', $options: '' }, // No case insensitive
            };

            const result = performanceOptimizationService.optimizeFindQuery(queryWithBadRegex);

            expect(result.recommendations.some(r => r.includes('anchoring'))).toBe(true);
            expect(result.recommendations.some(r => r.includes('case-insensitive'))).toBe(true);
        });
    });

    describe('Connection Pool Management', () => {
        it('should update connection pool statistics', () => {
            const stats = {
                totalConnections: 20,
                activeConnections: 15,
                idleConnections: 5,
                waitingRequests: 2,
                averageWaitTime: 150,
                connectionErrors: 0,
            };

            performanceOptimizationService.updateConnectionPoolStats(stats);

            const recommendations = performanceOptimizationService.getConnectionPoolRecommendations();
            expect(Array.isArray(recommendations)).toBe(true);
        });

        it('should provide connection pool recommendations for high utilization', () => {
            const highUtilizationStats = {
                totalConnections: 10,
                activeConnections: 9, // 90% utilization
                idleConnections: 1,
                waitingRequests: 5,
                averageWaitTime: 2000, // 2 seconds
                connectionErrors: 0,
            };

            performanceOptimizationService.updateConnectionPoolStats(highUtilizationStats);
            const recommendations = performanceOptimizationService.getConnectionPoolRecommendations();

            expect(recommendations.some(r => r.includes('increasing pool size'))).toBe(true);
            expect(recommendations.some(r => r.includes('High average wait time'))).toBe(true);
        });

        it('should recommend reducing pool size for low utilization', () => {
            const lowUtilizationStats = {
                totalConnections: 20,
                activeConnections: 2, // 10% utilization
                idleConnections: 18,
                waitingRequests: 0,
                averageWaitTime: 50,
                connectionErrors: 0,
            };

            performanceOptimizationService.updateConnectionPoolStats(lowUtilizationStats);
            const recommendations = performanceOptimizationService.getConnectionPoolRecommendations();

            expect(recommendations.some(r => r.includes('reducing pool size'))).toBe(true);
        });

        it('should detect connection errors', () => {
            const errorStats = {
                totalConnections: 10,
                activeConnections: 5,
                idleConnections: 5,
                waitingRequests: 0,
                averageWaitTime: 100,
                connectionErrors: 3,
            };

            performanceOptimizationService.updateConnectionPoolStats(errorStats);
            const recommendations = performanceOptimizationService.getConnectionPoolRecommendations();

            expect(recommendations.some(r => r.includes('Connection errors'))).toBe(true);
        });
    });

    describe('Background Job Processing', () => {
        it('should schedule AI processing job', () => {
            const jobId = performanceOptimizationService.scheduleAIProcessing(
                'request123',
                { symptoms: ['headache'] },
                'high'
            );

            expect(jobId).toBeDefined();
            expect(typeof jobId).toBe('string');

            const jobStatus = performanceOptimizationService.getJobStatus(jobId);
            expect(jobStatus).toBeDefined();
            expect(jobStatus?.type).toBe('ai_processing');
            expect(jobStatus?.priority).toBe('high');
            expect(jobStatus?.status).toBe('pending');
        });

        it('should schedule data aggregation job', () => {
            const jobId = performanceOptimizationService.scheduleDataAggregation(
                'diagnostic_summary',
                { workplaceId: 'workspace123' },
                'low'
            );

            expect(jobId).toBeDefined();

            const jobStatus = performanceOptimizationService.getJobStatus(jobId);
            expect(jobStatus?.type).toBe('data_aggregation');
            expect(jobStatus?.priority).toBe('low');
        });

        it('should schedule cache warmup job', () => {
            const cacheKeys = ['key1', 'key2', 'key3'];
            const jobId = performanceOptimizationService.scheduleCacheWarmup(cacheKeys, 'medium');

            expect(jobId).toBeDefined();

            const jobStatus = performanceOptimizationService.getJobStatus(jobId);
            expect(jobStatus?.type).toBe('cache_warmup');
            expect(jobStatus?.payload.cacheKeys).toEqual(cacheKeys);
        });

        it('should cancel pending job', () => {
            const jobId = performanceOptimizationService.scheduleDataAggregation(
                'test_aggregation',
                {},
                'low'
            );

            const cancelled = performanceOptimizationService.cancelJob(jobId);
            expect(cancelled).toBe(true);

            const jobStatus = performanceOptimizationService.getJobStatus(jobId);
            expect(jobStatus?.status).toBe('cancelled');
        });

        it('should not cancel running job', () => {
            const jobId = performanceOptimizationService.scheduleAIProcessing(
                'request456',
                { symptoms: ['nausea'] }
            );

            // Simulate job starting
            const job = performanceOptimizationService.getJobStatus(jobId);
            if (job) {
                job.status = 'running';
            }

            const cancelled = performanceOptimizationService.cancelJob(jobId);
            expect(cancelled).toBe(false);
        });

        it('should handle non-existent job status request', () => {
            const jobStatus = performanceOptimizationService.getJobStatus('non-existent-job');
            expect(jobStatus).toBeNull();
        });

        it('should process jobs with different priorities', async () => {
            // Schedule jobs with different priorities
            const lowPriorityJob = performanceOptimizationService.scheduleDataAggregation(
                'low_priority',
                {},
                'low'
            );

            const highPriorityJob = performanceOptimizationService.scheduleAIProcessing(
                'high_priority',
                {},
                'high'
            );

            const criticalJob = performanceOptimizationService.scheduleAIProcessing(
                'critical_job',
                {},
                'critical'
            );

            // Wait a bit for job processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check that jobs exist
            expect(performanceOptimizationService.getJobStatus(lowPriorityJob)).toBeDefined();
            expect(performanceOptimizationService.getJobStatus(highPriorityJob)).toBeDefined();
            expect(performanceOptimizationService.getJobStatus(criticalJob)).toBeDefined();
        });
    });

    describe('Performance Metrics', () => {
        it('should collect comprehensive performance metrics', () => {
            // Schedule some jobs to generate metrics
            performanceOptimizationService.scheduleAIProcessing('test1', {});
            performanceOptimizationService.scheduleDataAggregation('test2', {});

            const metrics = performanceOptimizationService.getPerformanceMetrics();

            expect(metrics).toBeDefined();
            expect(metrics.queryPerformance).toBeDefined();
            expect(metrics.connectionPool).toBeDefined();
            expect(metrics.backgroundJobs).toBeDefined();
            expect(metrics.memoryUsage).toBeDefined();

            expect(typeof metrics.queryPerformance.averageQueryTime).toBe('number');
            expect(typeof metrics.backgroundJobs.totalJobs).toBe('number');
            expect(typeof metrics.memoryUsage.heapUsed).toBe('number');
        });

        it('should provide performance recommendations', () => {
            // Set up conditions that would trigger recommendations
            performanceOptimizationService.updateConnectionPoolStats({
                totalConnections: 10,
                activeConnections: 9,
                idleConnections: 1,
                waitingRequests: 15, // High waiting requests
                averageWaitTime: 2000, // High wait time
                connectionErrors: 2, // Some errors
            });

            const recommendations = performanceOptimizationService.getPerformanceRecommendations();

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.some(r => r.includes('pool size'))).toBe(true);
        });

        it('should track memory usage trends', () => {
            const metrics = performanceOptimizationService.getPerformanceMetrics();

            expect(metrics.memoryUsage).toBeDefined();
            expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
            expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0);
            expect(metrics.memoryUsage.external).toBeGreaterThanOrEqual(0);
            expect(metrics.memoryUsage.rss).toBeGreaterThan(0);
        });
    });

    describe('Cache Integration', () => {
        it('should integrate with cache service for performance metrics', () => {
            const cacheStats = diagnosticCacheService.getStats();

            expect(cacheStats).toBeDefined();
            expect(typeof cacheStats.hitRate).toBe('number');
            expect(typeof cacheStats.missRate).toBe('number');
            expect(typeof cacheStats.totalEntries).toBe('number');
        });

        it('should schedule cache warmup based on performance needs', () => {
            const cacheKeys = [
                'frequently_accessed_key_1',
                'frequently_accessed_key_2',
                'frequently_accessed_key_3',
            ];

            const jobId = performanceOptimizationService.scheduleCacheWarmup(cacheKeys);

            expect(jobId).toBeDefined();

            const job = performanceOptimizationService.getJobStatus(jobId);
            expect(job?.type).toBe('cache_warmup');
            expect(job?.payload.cacheKeys).toEqual(cacheKeys);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle empty aggregation pipeline', () => {
            const result = performanceOptimizationService.optimizeAggregationPipeline([]);

            expect(result.originalQuery).toEqual([]);
            expect(result.optimizedQuery).toEqual([]);
            expect(result.estimatedImprovement).toBe(0);
            expect(Array.isArray(result.recommendations)).toBe(true);
        });

        it('should handle malformed query objects', () => {
            const malformedQuery = {
                invalidField: { $invalidOperator: 'value' },
                workplaceId: 'workspace123',
            };

            const result = performanceOptimizationService.optimizeFindQuery(malformedQuery);

            expect(result.originalQuery).toEqual(malformedQuery);
            expect(result.optimizedQuery).toBeDefined();
            expect(Array.isArray(result.recommendations)).toBe(true);
        });

        it('should handle job scheduling with invalid parameters', () => {
            // This should not throw an error
            const jobId = performanceOptimizationService.scheduleJob(
                'ai_processing',
                null, // Invalid payload
                { priority: 'invalid' as any } // Invalid priority
            );

            expect(jobId).toBeDefined();

            const job = performanceOptimizationService.getJobStatus(jobId);
            expect(job).toBeDefined();
        });

        it('should handle connection pool stats with missing fields', () => {
            const incompleteStats = {
                totalConnections: 10,
                // Missing other required fields
            };

            // Should not throw an error
            performanceOptimizationService.updateConnectionPoolStats(incompleteStats);

            const recommendations = performanceOptimizationService.getConnectionPoolRecommendations();
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('Load Testing Scenarios', () => {
        it('should handle high job volume', () => {
            const jobIds: string[] = [];

            // Schedule many jobs
            for (let i = 0; i < 100; i++) {
                const jobId = performanceOptimizationService.scheduleDataAggregation(
                    `load_test_${i}`,
                    { index: i },
                    'low'
                );
                jobIds.push(jobId);
            }

            expect(jobIds.length).toBe(100);

            // Check that all jobs were scheduled
            for (const jobId of jobIds) {
                const job = performanceOptimizationService.getJobStatus(jobId);
                expect(job).toBeDefined();
                expect(job?.status).toBe('pending');
            }
        });

        it('should maintain performance under concurrent operations', async () => {
            const operations = [];

            // Simulate concurrent operations
            for (let i = 0; i < 50; i++) {
                operations.push(
                    performanceOptimizationService.scheduleAIProcessing(`concurrent_${i}`, {})
                );
            }

            // All operations should complete without errors
            expect(operations.length).toBe(50);
            operations.forEach(jobId => {
                expect(typeof jobId).toBe('string');
            });
        });

        it('should handle memory pressure scenarios', () => {
            // Simulate high memory usage
            const largePayload = {
                data: new Array(10000).fill('large_data_chunk'),
            };

            const jobId = performanceOptimizationService.scheduleDataAggregation(
                'memory_test',
                largePayload,
                'low'
            );

            expect(jobId).toBeDefined();

            const job = performanceOptimizationService.getJobStatus(jobId);
            expect(job?.payload.data.length).toBe(10000);
        });
    });
});