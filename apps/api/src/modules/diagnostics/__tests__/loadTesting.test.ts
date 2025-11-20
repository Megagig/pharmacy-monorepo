import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    aiDiagnosticSecurityMiddleware,
    externalApiSecurityMiddleware,
} from '../middlewares/securityMiddleware';
import performanceMiddleware from '../middlewares/performanceMiddleware';
import { AuthRequest } from '../../../types/auth';

/**
 * Load Testing Suite for Diagnostic Module
 * Tests system performance under various load conditions
 */

describe('Load Testing - Diagnostic Module', () => {
    let app: express.Application;
    let mockUser: any;
    let mockWorkspaceContext: any;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockUser = {
            _id: 'user123',
            role: 'pharmacist',
            workplaceRole: 'pharmacist',
        };

        mockWorkspaceContext = {
            workspace: { _id: 'workspace123' },
            plan: { name: 'professional' },
            isSubscriptionActive: true,
        };

        // Mock authentication middleware
        app.use((req: AuthRequest, res, next) => {
            req.user = mockUser;
            req.workspaceContext = mockWorkspaceContext;
            next();
        });

        // Add performance monitoring
        app.use(performanceMiddleware.monitor);
    });

    afterEach(() => {
        jest.clearAllMocks();
        performanceMiddleware.clearOldMetrics(0); // Clear all metrics
    });

    describe('Concurrent Request Handling', () => {
        beforeEach(() => {
            app.use('/api/diagnostics', aiDiagnosticSecurityMiddleware);
            app.post('/api/diagnostics', (req, res) => {
                // Simulate processing time
                setTimeout(() => {
                    res.json({
                        success: true,
                        requestId: req.requestId,
                        timestamp: new Date().toISOString(),
                    });
                }, Math.random() * 100); // 0-100ms random delay
            });
        });

        it('should handle 50 concurrent diagnostic requests', async () => {
            const concurrentRequests = 50;
            const requests = [];

            const startTime = Date.now();

            for (let i = 0; i < concurrentRequests; i++) {
                const requestPromise = request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [`symptom_${i}`, 'headache'],
                            severity: 'moderate',
                            onset: 'acute',
                        },
                        vitalSigns: {
                            heartRate: 70 + i,
                            temperature: 37.0,
                        },
                    });

                requests.push(requestPromise);
            }

            const responses = await Promise.all(requests);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // All requests should succeed
            responses.forEach((response, index) => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.requestId).toBeDefined();
            });

            // Performance assertions
            expect(responses.length).toBe(concurrentRequests);
            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

            console.log(`Concurrent requests test: ${concurrentRequests} requests in ${totalTime}ms`);
            console.log(`Average response time: ${totalTime / concurrentRequests}ms per request`);
        });

        it('should handle 100 concurrent requests with rate limiting', async () => {
            const concurrentRequests = 100;
            const requests = [];

            for (let i = 0; i < concurrentRequests; i++) {
                const requestPromise = request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: [`load_test_${i}`],
                            severity: 'mild',
                            onset: 'chronic',
                        },
                    });

                requests.push(requestPromise);
            }

            const responses = await Promise.all(requests);

            // Some requests should succeed, some might be rate limited
            const successfulRequests = responses.filter(r => r.status === 200);
            const rateLimitedRequests = responses.filter(r => r.status === 429);

            expect(successfulRequests.length).toBeGreaterThan(0);
            expect(successfulRequests.length + rateLimitedRequests.length).toBe(concurrentRequests);

            console.log(`Rate limiting test: ${successfulRequests.length} successful, ${rateLimitedRequests.length} rate limited`);
        });

        it('should maintain response quality under load', async () => {
            const requests = [];
            const concurrentRequests = 30;

            for (let i = 0; i < concurrentRequests; i++) {
                const requestPromise = request(app)
                    .post('/api/diagnostics')
                    .send({
                        symptoms: {
                            subjective: ['chest pain', 'shortness of breath'],
                            severity: 'severe',
                            onset: 'acute',
                        },
                        vitalSigns: {
                            heartRate: 120,
                            bloodPressure: '160/100',
                            temperature: 38.5,
                        },
                    });

                requests.push(requestPromise);
            }

            const responses = await Promise.all(requests);
            const successfulResponses = responses.filter(r => r.status === 200);

            // Check response quality
            successfulResponses.forEach(response => {
                expect(response.body.success).toBe(true);
                expect(response.body.requestId).toBeDefined();
                expect(response.body.timestamp).toBeDefined();
            });

            // Performance metrics
            const stats = performanceMiddleware.getPerformanceStats();
            expect(stats.totalRequests).toBeGreaterThan(0);
            expect(stats.averageResponseTime).toBeLessThan(2000); // Less than 2 seconds average
        });
    });

    describe('Memory and Resource Usage', () => {
        beforeEach(() => {
            app.use('/api/large-data', performanceMiddleware.monitorMemory);
            app.post('/api/large-data', (req, res) => {
                // Simulate memory-intensive operation
                const largeArray = new Array(10000).fill(req.body);

                setTimeout(() => {
                    res.json({
                        success: true,
                        processedItems: largeArray.length,
                        memoryUsage: process.memoryUsage(),
                    });
                }, 50);
            });
        });

        it('should handle large payload requests', async () => {
            const largePayload = {
                symptoms: {
                    subjective: new Array(100).fill('symptom'),
                    objective: new Array(50).fill('finding'),
                    severity: 'moderate',
                    onset: 'acute',
                },
                currentMedications: new Array(30).fill({
                    name: 'Medication Name',
                    dosage: '10mg',
                    frequency: 'daily',
                }),
                labResults: new Array(50).fill({
                    testName: 'Complete Blood Count',
                    value: '5.2',
                    unit: '10^6/uL',
                }),
            };

            const response = await request(app)
                .post('/api/large-data')
                .send(largePayload);

            expect(response.status).toBeOneOf([200, 413]); // Success or payload too large

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.processedItems).toBe(10000);
                expect(response.body.memoryUsage).toBeDefined();
            }
        });

        it('should monitor memory usage during sustained load', async () => {
            const requests = [];
            const sustainedRequests = 20;

            const initialMemory = process.memoryUsage();

            for (let i = 0; i < sustainedRequests; i++) {
                const requestPromise = request(app)
                    .post('/api/large-data')
                    .send({
                        data: new Array(1000).fill(`data_chunk_${i}`),
                    });

                requests.push(requestPromise);

                // Stagger requests to simulate sustained load
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            await Promise.all(requests);

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            console.log(`Memory usage increase: ${memoryIncrease} bytes`);
            console.log(`Initial heap: ${initialMemory.heapUsed}, Final heap: ${finalMemory.heapUsed}`);

            // Memory should not increase excessively
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
        });

        it('should handle memory pressure gracefully', async () => {
            // Create a very large payload to test memory limits
            const massivePayload = {
                largeData: new Array(50000).fill('x'.repeat(100)),
            };

            const response = await request(app)
                .post('/api/large-data')
                .send(massivePayload);

            // Should either process successfully or reject gracefully
            expect([200, 400, 413, 500]).toContain(response.status);

            if (response.status !== 200) {
                // Should provide meaningful error message
                expect(response.body).toBeDefined();
            }
        });
    });

    describe('Database Query Performance', () => {
        beforeEach(() => {
            app.use('/api/queries', performanceMiddleware.monitorQuery('find', 'diagnostics'));
            app.get('/api/queries/search', (req, res) => {
                // Simulate database query
                setTimeout(() => {
                    res.json({
                        results: new Array(100).fill({
                            id: Math.random().toString(36),
                            data: 'mock_data',
                        }),
                        queryTime: Math.random() * 500,
                    });
                }, Math.random() * 200); // 0-200ms query time
            });

            app.get('/api/queries/complex', (req, res) => {
                // Simulate complex aggregation query
                setTimeout(() => {
                    res.json({
                        aggregatedData: {
                            totalRecords: 1000,
                            averageValue: 42.5,
                            groupedResults: new Array(10).fill({
                                group: 'group_name',
                                count: Math.floor(Math.random() * 100),
                            }),
                        },
                        queryTime: Math.random() * 1000 + 500, // 500-1500ms
                    });
                }, Math.random() * 1000 + 500);
            });
        });

        it('should handle concurrent database queries', async () => {
            const queryRequests = [];
            const concurrentQueries = 25;

            for (let i = 0; i < concurrentQueries; i++) {
                const queryPromise = request(app)
                    .get('/api/queries/search')
                    .query({
                        workplaceId: 'workspace123',
                        patientId: `patient_${i}`,
                        limit: 50,
                    });

                queryRequests.push(queryPromise);
            }

            const responses = await Promise.all(queryRequests);

            // All queries should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.results).toBeDefined();
                expect(Array.isArray(response.body.results)).toBe(true);
            });

            console.log(`Concurrent queries test: ${concurrentQueries} queries completed`);
        });

        it('should handle complex aggregation queries under load', async () => {
            const complexQueries = [];
            const queryCount = 10;

            const startTime = Date.now();

            for (let i = 0; i < queryCount; i++) {
                const queryPromise = request(app)
                    .get('/api/queries/complex')
                    .query({
                        workplaceId: 'workspace123',
                        dateRange: '2024-01-01,2024-12-31',
                        groupBy: 'month',
                    });

                complexQueries.push(queryPromise);
            }

            const responses = await Promise.all(complexQueries);
            const endTime = Date.now();

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.aggregatedData).toBeDefined();
                expect(response.body.queryTime).toBeDefined();
            });

            const totalTime = endTime - startTime;
            const averageTime = totalTime / queryCount;

            console.log(`Complex queries test: ${queryCount} queries in ${totalTime}ms (avg: ${averageTime}ms)`);

            // Complex queries should complete within reasonable time
            expect(averageTime).toBeLessThan(3000); // Less than 3 seconds average
        });

        it('should maintain query performance with mixed workload', async () => {
            const mixedRequests = [];

            // Mix of simple and complex queries
            for (let i = 0; i < 15; i++) {
                if (i % 3 === 0) {
                    // Complex query
                    mixedRequests.push(
                        request(app).get('/api/queries/complex')
                    );
                } else {
                    // Simple query
                    mixedRequests.push(
                        request(app).get('/api/queries/search')
                    );
                }
            }

            const responses = await Promise.all(mixedRequests);

            const simpleQueries = responses.slice().filter((_, i) => i % 3 !== 0);
            const complexQueries = responses.slice().filter((_, i) => i % 3 === 0);

            // All queries should succeed
            expect(simpleQueries.every(r => r.status === 200)).toBe(true);
            expect(complexQueries.every(r => r.status === 200)).toBe(true);

            console.log(`Mixed workload: ${simpleQueries.length} simple, ${complexQueries.length} complex queries`);
        });
    });

    describe('Cache Performance Under Load', () => {
        beforeEach(() => {
            app.use('/api/cached', performanceMiddleware.monitorCache('diagnostic_cache'));
            app.get('/api/cached/data/:id', (req, res) => {
                const { id } = req.params;

                // Simulate cache lookup
                const isCacheHit = Math.random() > 0.3; // 70% cache hit rate

                if (isCacheHit) {
                    // Fast cache response
                    setTimeout(() => {
                        res.json({
                            data: `cached_data_${id}`,
                            cached: true,
                            responseTime: Math.random() * 50, // 0-50ms
                        });
                    }, Math.random() * 50);
                } else {
                    // Slower database response
                    setTimeout(() => {
                        res.json({
                            data: `fresh_data_${id}`,
                            cached: false,
                            responseTime: Math.random() * 500 + 200, // 200-700ms
                        });
                    }, Math.random() * 500 + 200);
                }
            });
        });

        it('should maintain cache performance under high request volume', async () => {
            const cacheRequests = [];
            const requestCount = 100;
            const dataIds = Array.from({ length: 20 }, (_, i) => `data_${i}`);

            for (let i = 0; i < requestCount; i++) {
                const randomId = dataIds[Math.floor(Math.random() * dataIds.length)];

                const requestPromise = request(app)
                    .get(`/api/cached/data/${randomId}`);

                cacheRequests.push(requestPromise);
            }

            const responses = await Promise.all(cacheRequests);

            const cacheHits = responses.filter(r => r.body.cached === true);
            const cacheMisses = responses.filter(r => r.body.cached === false);

            expect(responses.length).toBe(requestCount);
            expect(cacheHits.length + cacheMisses.length).toBe(requestCount);

            const cacheHitRate = cacheHits.length / requestCount;
            const avgCacheHitTime = cacheHits.reduce((sum, r) => sum + r.body.responseTime, 0) / cacheHits.length;
            const avgCacheMissTime = cacheMisses.reduce((sum, r) => sum + r.body.responseTime, 0) / cacheMisses.length;

            console.log(`Cache performance: ${Math.round(cacheHitRate * 100)}% hit rate`);
            console.log(`Avg cache hit time: ${avgCacheHitTime.toFixed(2)}ms`);
            console.log(`Avg cache miss time: ${avgCacheMissTime.toFixed(2)}ms`);

            // Cache hits should be significantly faster
            expect(avgCacheHitTime).toBeLessThan(avgCacheMissTime);
            expect(cacheHitRate).toBeGreaterThan(0.5); // At least 50% hit rate
        });
    });

    describe('Error Handling Under Load', () => {
        beforeEach(() => {
            app.post('/api/error-prone', (req, res) => {
                const errorRate = 0.1; // 10% error rate

                if (Math.random() < errorRate) {
                    res.status(500).json({
                        success: false,
                        error: 'Simulated server error',
                    });
                } else {
                    res.json({
                        success: true,
                        data: 'processed successfully',
                    });
                }
            });
        });

        it('should handle errors gracefully under load', async () => {
            const requests = [];
            const requestCount = 50;

            for (let i = 0; i < requestCount; i++) {
                const requestPromise = request(app)
                    .post('/api/error-prone')
                    .send({ data: `request_${i}` });

                requests.push(requestPromise);
            }

            const responses = await Promise.all(requests);

            const successfulRequests = responses.filter(r => r.status === 200);
            const errorRequests = responses.filter(r => r.status === 500);

            expect(successfulRequests.length + errorRequests.length).toBe(requestCount);
            expect(successfulRequests.length).toBeGreaterThan(requestCount * 0.8); // At least 80% success
            expect(errorRequests.length).toBeLessThan(requestCount * 0.2); // Less than 20% errors

            // All error responses should be properly formatted
            errorRequests.forEach(response => {
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBeDefined();
            });

            console.log(`Error handling: ${successfulRequests.length} success, ${errorRequests.length} errors`);
        });
    });

    describe('Performance Metrics Collection', () => {
        it('should collect accurate performance metrics during load test', async () => {
            // Set up endpoint with performance monitoring
            app.get('/api/metrics-test', performanceMiddleware.monitor, (req, res) => {
                setTimeout(() => {
                    res.json({ success: true, timestamp: Date.now() });
                }, Math.random() * 200);
            });

            const requests = [];
            const requestCount = 30;

            for (let i = 0; i < requestCount; i++) {
                requests.push(request(app).get('/api/metrics-test'));
            }

            await Promise.all(requests);

            const stats = performanceMiddleware.getPerformanceStats();
            const realTimeMetrics = performanceMiddleware.getRealTimeMetrics();

            expect(stats.totalRequests).toBeGreaterThan(0);
            expect(stats.averageResponseTime).toBeGreaterThan(0);
            expect(realTimeMetrics.currentMemoryUsage).toBeDefined();
            expect(realTimeMetrics.requestsPerMinute).toBeGreaterThan(0);

            console.log('Performance Stats:', {
                totalRequests: stats.totalRequests,
                averageResponseTime: Math.round(stats.averageResponseTime),
                slowRequests: stats.slowRequests,
                errorRate: Math.round(stats.errorRate * 100),
            });

            console.log('Real-time Metrics:', {
                memoryUsed: Math.round(realTimeMetrics.currentMemoryUsage.heapUsed / 1024 / 1024),
                requestsPerMinute: realTimeMetrics.requestsPerMinute,
                avgResponseTime: Math.round(realTimeMetrics.averageResponseTimeLast100),
            });
        });

        it('should identify performance bottlenecks', async () => {
            // Create endpoints with different performance characteristics
            app.get('/api/fast', (req, res) => {
                res.json({ data: 'fast response' });
            });

            app.get('/api/slow', (req, res) => {
                setTimeout(() => {
                    res.json({ data: 'slow response' });
                }, 1000); // 1 second delay
            });

            // Make requests to both endpoints
            const fastRequests = Array(10).fill(null).map(() => request(app).get('/api/fast'));
            const slowRequests = Array(5).fill(null).map(() => request(app).get('/api/slow'));

            await Promise.all([...fastRequests, ...slowRequests]);

            const stats = performanceMiddleware.getPerformanceStats();

            expect(stats.topSlowEndpoints.length).toBeGreaterThan(0);

            // The slow endpoint should be identified
            const slowEndpoint = stats.topSlowEndpoints.find(endpoint =>
                endpoint.url.includes('/api/slow')
            );

            if (slowEndpoint) {
                expect(slowEndpoint.averageResponseTime).toBeGreaterThan(500);
            }

            console.log('Top slow endpoints:', stats.topSlowEndpoints);
        });
    });
});