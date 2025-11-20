import ManualLabPerformanceService, {
    OrderProcessingMetrics,
    PDFGenerationMetrics,
    AIServiceMetrics,
    DatabaseQueryMetrics,
    CacheMetrics
} from '../services/manualLabPerformanceService';

// Mock Redis client
const mockRedisClient = {
    setex: jest.fn().mockResolvedValue('OK'),
    lpush: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    dbsize: jest.fn().mockResolvedValue(100),
    keys: jest.fn().mockResolvedValue(['manual_lab:metrics:test:1']),
    memory: jest.fn().mockResolvedValue(1024 * 1024)
};

jest.mock('../../../utils/performanceOptimization', () => ({
    getRedisClient: jest.fn(() => mockRedisClient)
}));

describe('ManualLabPerformanceService', () => {
    const workplaceId = 'workplace-123';
    const orderId = 'LAB-2024-0001';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Metrics Recording', () => {
        it('should record order processing metrics', async () => {
            const metrics: OrderProcessingMetrics = {
                orderId,
                workplaceId,
                patientId: 'patient-123',
                orderCreationTime: 1500,
                pdfGenerationTime: 2000,
                totalProcessingTime: 3500,
                testCount: 3,
                pdfSize: 1024 * 50, // 50KB
                success: true,
                timestamp: new Date(),
                userId: 'user-123',
                priority: 'routine'
            };

            await ManualLabPerformanceService.recordOrderProcessingMetrics(metrics);

            expect(mockRedisClient.setex).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:order:'),
                7 * 24 * 60 * 60, // 7 days TTL
                JSON.stringify(metrics)
            );

            expect(mockRedisClient.lpush).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:timeseries:order:'),
                JSON.stringify(metrics)
            );
        });

        it('should record PDF generation metrics', async () => {
            const metrics: PDFGenerationMetrics = {
                orderId,
                templateRenderTime: 500,
                qrCodeGenerationTime: 200,
                barcodeGenerationTime: 150,
                puppeteerProcessingTime: 1800,
                totalGenerationTime: 2650,
                pdfSize: 1024 * 75, // 75KB
                pageCount: 1,
                testCount: 3,
                success: true,
                fromCache: false,
                timestamp: new Date(),
                workplaceId
            };

            await ManualLabPerformanceService.recordPDFGenerationMetrics(metrics);

            expect(mockRedisClient.setex).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:pdf:'),
                7 * 24 * 60 * 60,
                JSON.stringify(metrics)
            );
        });

        it('should record AI service metrics', async () => {
            const metrics: AIServiceMetrics = {
                orderId,
                requestPreparationTime: 300,
                aiServiceResponseTime: 5000,
                resultProcessingTime: 200,
                totalAIProcessingTime: 5500,
                inputTokens: 1500,
                outputTokens: 800,
                requestSize: 2048,
                responseSize: 1024,
                success: true,
                retryCount: 0,
                redFlagsCount: 2,
                recommendationsCount: 5,
                confidenceScore: 85,
                timestamp: new Date(),
                workplaceId,
                patientId: 'patient-123'
            };

            await ManualLabPerformanceService.recordAIServiceMetrics(metrics);

            expect(mockRedisClient.setex).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:ai:'),
                7 * 24 * 60 * 60,
                JSON.stringify(metrics)
            );
        });

        it('should record database query metrics', async () => {
            const metrics: DatabaseQueryMetrics = {
                operation: 'create',
                collection: 'manuallaborders',
                queryTime: 150,
                documentsAffected: 1,
                indexesUsed: ['workplaceId_1', 'orderId_1'],
                success: true,
                timestamp: new Date(),
                workplaceId,
                userId: 'user-123'
            };

            await ManualLabPerformanceService.recordDatabaseQueryMetrics(metrics);

            expect(mockRedisClient.setex).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:db:'),
                7 * 24 * 60 * 60,
                JSON.stringify(metrics)
            );
        });

        it('should record cache metrics', async () => {
            const metrics: CacheMetrics = {
                operation: 'get',
                cacheKey: 'manual_lab:test_catalog:active:workplace-123',
                operationTime: 25,
                hit: true,
                dataSize: 2048,
                success: true,
                timestamp: new Date(),
                workplaceId
            };

            await ManualLabPerformanceService.recordCacheMetrics(metrics);

            expect(mockRedisClient.setex).toHaveBeenCalledWith(
                expect.stringContaining('manual_lab:metrics:cache:'),
                7 * 24 * 60 * 60,
                JSON.stringify(metrics)
            );
        });
    });

    describe('Performance Analysis', () => {
        it('should get real-time metrics', async () => {
            // Mock recent metrics data
            const mockOrderMetrics = [
                {
                    orderId: 'LAB-2024-0001',
                    totalProcessingTime: 3000,
                    success: true,
                    timestamp: new Date().toISOString()
                },
                {
                    orderId: 'LAB-2024-0002',
                    totalProcessingTime: 4000,
                    success: false,
                    timestamp: new Date().toISOString()
                }
            ];

            const mockCacheMetrics = [
                {
                    operation: 'get',
                    hit: true,
                    timestamp: new Date().toISOString()
                },
                {
                    operation: 'get',
                    hit: false,
                    timestamp: new Date().toISOString()
                }
            ];

            mockRedisClient.lrange
                .mockResolvedValueOnce(mockOrderMetrics.map(m => JSON.stringify(m)))
                .mockResolvedValueOnce(mockCacheMetrics.map(m => JSON.stringify(m)));

            const metrics = await ManualLabPerformanceService.getRealTimeMetrics(workplaceId);

            expect(metrics).toHaveProperty('activeOrders');
            expect(metrics).toHaveProperty('averageResponseTime');
            expect(metrics).toHaveProperty('errorRate');
            expect(metrics).toHaveProperty('cacheHitRate');
            expect(metrics).toHaveProperty('lastUpdated');

            expect(metrics.activeOrders).toBe(2);
            expect(metrics.averageResponseTime).toBe(3500); // Average of 3000 and 4000
            expect(metrics.errorRate).toBe(50); // 1 out of 2 failed
            expect(metrics.cacheHitRate).toBe(50); // 1 out of 2 cache hits
        });

        it('should get performance alerts', async () => {
            // Mock high response time scenario
            const mockOrderMetrics = [
                {
                    orderId: 'LAB-2024-0001',
                    totalProcessingTime: 12000, // 12 seconds - critical
                    success: true,
                    timestamp: new Date().toISOString()
                }
            ];

            mockRedisClient.lrange
                .mockResolvedValueOnce(mockOrderMetrics.map(m => JSON.stringify(m)))
                .mockResolvedValueOnce([]); // No cache metrics

            const alerts = await ManualLabPerformanceService.getPerformanceAlerts(workplaceId);

            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('critical');
            expect(alerts[0].metric).toBe('averageResponseTime');
            expect(alerts[0].value).toBe(12000);
        });

        it('should generate performance summary', async () => {
            const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            const endTime = new Date();

            // Mock comprehensive metrics data
            const mockOrderMetrics = [
                {
                    orderId: 'LAB-2024-0001',
                    totalProcessingTime: 3000,
                    success: true,
                    timestamp: new Date().toISOString()
                },
                {
                    orderId: 'LAB-2024-0002',
                    totalProcessingTime: 4000,
                    success: true,
                    timestamp: new Date().toISOString()
                }
            ];

            const mockPDFMetrics = [
                {
                    orderId: 'LAB-2024-0001',
                    totalGenerationTime: 2000,
                    pdfSize: 51200,
                    fromCache: false,
                    timestamp: new Date().toISOString()
                }
            ];

            const mockAIMetrics = [
                {
                    orderId: 'LAB-2024-0001',
                    aiServiceResponseTime: 5000,
                    success: true,
                    redFlagsCount: 1,
                    timestamp: new Date().toISOString()
                }
            ];

            mockRedisClient.lrange
                .mockResolvedValueOnce(mockOrderMetrics.map(m => JSON.stringify(m))) // Order metrics
                .mockResolvedValueOnce(mockPDFMetrics.map(m => JSON.stringify(m)))   // PDF metrics
                .mockResolvedValueOnce(mockAIMetrics.map(m => JSON.stringify(m)))    // AI metrics
                .mockResolvedValueOnce([])  // DB metrics
                .mockResolvedValueOnce([]); // Cache metrics

            const summary = await ManualLabPerformanceService.getPerformanceSummary(
                workplaceId,
                startTime,
                endTime
            );

            expect(summary).toHaveProperty('timeRange');
            expect(summary).toHaveProperty('totalOrders', 2);
            expect(summary).toHaveProperty('successfulOrders', 2);
            expect(summary).toHaveProperty('failedOrders', 0);
            expect(summary).toHaveProperty('averageOrderProcessingTime', 3500);
            expect(summary).toHaveProperty('totalPDFsGenerated', 1);
            expect(summary).toHaveProperty('averagePDFGenerationTime', 2000);
            expect(summary).toHaveProperty('totalAIRequests', 1);
            expect(summary).toHaveProperty('averageAIResponseTime', 5000);
        });
    });

    describe('Error Handling', () => {
        it('should handle Redis connection failures gracefully', async () => {
            // Mock Redis client to return null (not connected)
            const { getRedisClient } = require('../../../utils/performanceOptimization');
            getRedisClient.mockReturnValueOnce(null);

            const metrics: OrderProcessingMetrics = {
                orderId,
                workplaceId,
                patientId: 'patient-123',
                orderCreationTime: 1500,
                pdfGenerationTime: 2000,
                totalProcessingTime: 3500,
                testCount: 3,
                pdfSize: 1024 * 50,
                success: true,
                timestamp: new Date(),
                userId: 'user-123',
                priority: 'routine'
            };

            // Should not throw error when Redis is not available
            await expect(ManualLabPerformanceService.recordOrderProcessingMetrics(metrics))
                .resolves.not.toThrow();
        });

        it('should handle Redis operation failures gracefully', async () => {
            mockRedisClient.setex.mockRejectedValueOnce(new Error('Redis write failed'));

            const metrics: OrderProcessingMetrics = {
                orderId,
                workplaceId,
                patientId: 'patient-123',
                orderCreationTime: 1500,
                pdfGenerationTime: 2000,
                totalProcessingTime: 3500,
                testCount: 3,
                pdfSize: 1024 * 50,
                success: true,
                timestamp: new Date(),
                userId: 'user-123',
                priority: 'routine'
            };

            // Should not throw error when Redis operation fails
            await expect(ManualLabPerformanceService.recordOrderProcessingMetrics(metrics))
                .resolves.not.toThrow();
        });
    });

    describe('Cleanup', () => {
        it('should cleanup old metrics', async () => {
            const mockKeys = [
                'manual_lab:metrics:order:123:1234567890',
                'manual_lab:metrics:pdf:456:1234567890'
            ];

            mockRedisClient.keys.mockResolvedValueOnce(mockKeys);
            mockRedisClient.ttl.mockResolvedValue(-1); // No expiration set
            mockRedisClient.del.mockResolvedValue(1);

            await ManualLabPerformanceService.cleanupOldMetrics();

            expect(mockRedisClient.keys).toHaveBeenCalledWith('manual_lab:metrics:*');
            expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
        });
    });
});