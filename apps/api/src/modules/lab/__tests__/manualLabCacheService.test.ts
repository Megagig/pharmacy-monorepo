import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ManualLabCacheService from '../services/manualLabCacheService';
import TestCatalog from '../models/TestCatalog';
import ManualLabOrder from '../models/ManualLabOrder';
import ManualLabResult from '../models/ManualLabResult';

// Mock Redis client
jest.mock('../../../utils/performanceOptimization', () => ({
    CacheManager: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn()
    },
    getRedisClient: jest.fn(() => ({
        dbsize: jest.fn().mockResolvedValue(100),
        keys: jest.fn().mockResolvedValue(['manual_lab:test:1', 'manual_lab:test:2']),
        memory: jest.fn().mockResolvedValue(1024 * 1024) // 1MB
    }))
}));

describe('ManualLabCacheService', () => {
    let mongoServer: MongoMemoryServer;
    let workplaceId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await TestCatalog.deleteMany({});
        await ManualLabOrder.deleteMany({});
        await ManualLabResult.deleteMany({});

        workplaceId = new mongoose.Types.ObjectId();
    });

    describe('Test Catalog Caching', () => {
        it('should cache active test catalog', async () => {
            // Create test data
            const testData = {
                workplaceId,
                code: 'CBC',
                name: 'Complete Blood Count',
                category: 'Hematology',
                specimenType: 'Blood',
                isActive: true,
                isCustom: false,
                createdBy: new mongoose.Types.ObjectId()
            };

            await TestCatalog.create(testData);

            // Mock cache miss then hit
            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.get.mockResolvedValueOnce(null); // Cache miss
            CacheManager.set.mockResolvedValueOnce(true);

            // First call should fetch from database and cache
            const result1 = await ManualLabCacheService.cacheActiveTestCatalog(workplaceId);
            expect(result1).toHaveLength(1);
            expect(result1[0]?.code).toBe('CBC');
            expect(CacheManager.set).toHaveBeenCalled();

            // Mock cache hit for second call
            CacheManager.get.mockResolvedValueOnce(result1);

            // Second call should return from cache
            const result2 = await ManualLabCacheService.cacheActiveTestCatalog(workplaceId);
            expect(result2).toEqual(result1);
        });

        it('should cache test categories', async () => {
            // Create test data with different categories
            const tests = [
                {
                    workplaceId,
                    code: 'CBC',
                    name: 'Complete Blood Count',
                    category: 'Hematology',
                    specimenType: 'Blood',
                    isActive: true,
                    createdBy: new mongoose.Types.ObjectId()
                },
                {
                    workplaceId,
                    code: 'BUN',
                    name: 'Blood Urea Nitrogen',
                    category: 'Chemistry',
                    specimenType: 'Blood',
                    isActive: true,
                    createdBy: new mongoose.Types.ObjectId()
                }
            ];

            await TestCatalog.create(tests);

            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.get.mockResolvedValueOnce(null); // Cache miss
            CacheManager.set.mockResolvedValueOnce(true);

            const categories = await ManualLabCacheService.cacheTestCategories(workplaceId);
            expect(categories).toContain('Hematology');
            expect(categories).toContain('Chemistry');
            expect(CacheManager.set).toHaveBeenCalled();
        });

        it('should invalidate test catalog cache', async () => {
            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.delete.mockResolvedValue(true);

            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);
            expect(CacheManager.delete).toHaveBeenCalledTimes(7); // All cache patterns
        });
    });

    describe('PDF Caching', () => {
        it('should cache PDF requisition', async () => {
            const orderId = 'LAB-2024-0001';
            const pdfData = {
                buffer: Buffer.from('fake pdf data'),
                fileName: 'test.pdf',
                url: '/api/test.pdf',
                metadata: { size: 1024 }
            };

            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.set.mockResolvedValue(true);

            await ManualLabCacheService.cachePDFRequisition(orderId, pdfData);
            expect(CacheManager.set).toHaveBeenCalledTimes(2); // PDF buffer and metadata
        });

        it('should retrieve cached PDF requisition', async () => {
            const orderId = 'LAB-2024-0001';
            const mockBuffer = Buffer.from('fake pdf data');
            const mockMetadata = {
                fileName: 'test.pdf',
                url: '/api/test.pdf',
                metadata: { size: 1024 }
            };

            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.get
                .mockResolvedValueOnce(mockBuffer) // PDF buffer
                .mockResolvedValueOnce(mockMetadata); // Metadata

            const result = await ManualLabCacheService.getCachedPDFRequisition(orderId);
            expect(result).toBeDefined();
            expect(result?.buffer).toEqual(mockBuffer);
            expect(result?.fileName).toBe('test.pdf');
        });
    });

    describe('Order Caching', () => {
        it('should cache manual lab order', async () => {
            const orderData = {
                orderId: 'LAB-2024-0001',
                workplaceId,
                patientId: new mongoose.Types.ObjectId(),
                orderedBy: new mongoose.Types.ObjectId(),
                tests: [{
                    name: 'CBC',
                    code: 'CBC',
                    specimenType: 'Blood',
                    category: 'Hematology'
                }],
                indication: 'Test indication',
                requisitionFormUrl: '/api/test.pdf',
                barcodeData: 'test-barcode',
                status: 'requested' as const,
                consentObtained: true,
                consentTimestamp: new Date(),
                consentObtainedBy: new mongoose.Types.ObjectId(),
                createdBy: new mongoose.Types.ObjectId()
            };

            const order = await ManualLabOrder.create(orderData);

            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.set.mockResolvedValue(true);

            await ManualLabCacheService.cacheOrder(order);
            expect(CacheManager.set).toHaveBeenCalled();
        });

        it('should invalidate order cache', async () => {
            const orderId = 'LAB-2024-0001';
            const patientId = new mongoose.Types.ObjectId();

            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.delete.mockResolvedValue(true);

            await ManualLabCacheService.invalidateOrderCache(workplaceId, orderId, patientId);
            expect(CacheManager.delete).toHaveBeenCalled();
        });
    });

    describe('Cache Statistics', () => {
        it('should get cache statistics', async () => {
            const stats = await ManualLabCacheService.getCacheStats();

            expect(stats).toHaveProperty('redisConnected');
            expect(stats).toHaveProperty('totalKeys');
            expect(stats).toHaveProperty('manualLabKeys');
            expect(stats.totalKeys).toBe(100);
            expect(stats.manualLabKeys).toBe(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle cache failures gracefully', async () => {
            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.get.mockRejectedValueOnce(new Error('Redis connection failed'));

            // Should fallback to database query without throwing
            const result = await ManualLabCacheService.getCachedOrder(workplaceId, 'LAB-2024-0001');
            expect(result).toBeNull(); // No order in database
        });

        it('should handle cache set failures gracefully', async () => {
            const { CacheManager } = require('../../../utils/performanceOptimization');
            CacheManager.set.mockRejectedValueOnce(new Error('Redis write failed'));

            // Should not throw error when caching fails
            await expect(ManualLabCacheService.invalidateTestCatalogCache(workplaceId))
                .resolves.not.toThrow();
        });
    });
});