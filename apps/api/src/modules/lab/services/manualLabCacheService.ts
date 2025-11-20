import mongoose from 'mongoose';
import logger from '../../../utils/logger';
import { CacheManager, getRedisClient } from '../../../utils/performanceOptimization';

// Import models
import TestCatalog, { ITestCatalog } from '../models/TestCatalog';
import ManualLabOrder, { IManualLabOrder } from '../models/ManualLabOrder';
import ManualLabResult, { IManualLabResult } from '../models/ManualLabResult';

/**
 * Manual Lab Cache Service
 * Implements caching strategies for manual lab workflow performance optimization
 */

// ===============================
// CACHE KEY CONSTANTS
// ===============================

const CACHE_KEYS = {
    TEST_CATALOG: {
        ALL_ACTIVE: (workplaceId: string) => `manual_lab:test_catalog:active:${workplaceId}`,
        BY_CATEGORY: (workplaceId: string, category: string) => `manual_lab:test_catalog:category:${workplaceId}:${category}`,
        BY_SPECIMEN: (workplaceId: string, specimen: string) => `manual_lab:test_catalog:specimen:${workplaceId}:${specimen}`,
        CATEGORIES: (workplaceId: string) => `manual_lab:test_catalog:categories:${workplaceId}`,
        SPECIMEN_TYPES: (workplaceId: string) => `manual_lab:test_catalog:specimen_types:${workplaceId}`,
        SEARCH: (workplaceId: string, query: string, options: string) => `manual_lab:test_catalog:search:${workplaceId}:${query}:${options}`,
        BY_CODE: (workplaceId: string, code: string) => `manual_lab:test_catalog:code:${workplaceId}:${code}`
    },
    PDF: {
        REQUISITION: (orderId: string) => `manual_lab:pdf:requisition:${orderId}`,
        METADATA: (orderId: string) => `manual_lab:pdf:metadata:${orderId}`
    },
    ORDER: {
        BY_ID: (workplaceId: string, orderId: string) => `manual_lab:order:${workplaceId}:${orderId}`,
        BY_PATIENT: (workplaceId: string, patientId: string, page: number, limit: number) =>
            `manual_lab:orders:patient:${workplaceId}:${patientId}:${page}:${limit}`,
        ACTIVE: (workplaceId: string) => `manual_lab:orders:active:${workplaceId}`,
        BY_STATUS: (workplaceId: string, status: string) => `manual_lab:orders:status:${workplaceId}:${status}`
    },
    RESULT: {
        BY_ORDER: (orderId: string) => `manual_lab:result:order:${orderId}`
    },
    STATS: {
        WORKPLACE: (workplaceId: string) => `manual_lab:stats:workplace:${workplaceId}`,
        PERFORMANCE: (workplaceId: string) => `manual_lab:performance:workplace:${workplaceId}`
    }
};

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
    TEST_CATALOG: 3600, // 1 hour - test catalogs don't change frequently
    PDF: 86400, // 24 hours - PDFs are immutable once generated
    ORDER: 300, // 5 minutes - orders can change status frequently
    RESULT: 1800, // 30 minutes - results are mostly immutable after entry
    STATS: 600, // 10 minutes - stats can be refreshed periodically
    SEARCH: 900 // 15 minutes - search results can be cached for moderate time
};

// ===============================
// MANUAL LAB CACHE SERVICE
// ===============================

export class ManualLabCacheService {

    // ===============================
    // TEST CATALOG CACHING
    // ===============================

    /**
     * Cache active test catalog for a workplace
     */
    static async cacheActiveTestCatalog(workplaceId: mongoose.Types.ObjectId): Promise<ITestCatalog[]> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.ALL_ACTIVE(workplaceId.toString());

        try {
            // Try to get from cache first
            const cached = await CacheManager.get<ITestCatalog[]>(cacheKey);
            if (cached) {
                logger.debug('Test catalog retrieved from cache', {
                    workplaceId: workplaceId.toString(),
                    count: cached.length,
                    service: 'manual-lab-cache'
                });
                return cached;
            }

            // Fetch from database
            const tests = await TestCatalog.findActiveTests(workplaceId);

            // Cache the results
            await CacheManager.set(cacheKey, tests, { ttl: CACHE_TTL.TEST_CATALOG });

            logger.info('Test catalog cached successfully', {
                workplaceId: workplaceId.toString(),
                count: tests.length,
                service: 'manual-lab-cache'
            });

            return tests;
        } catch (error) {
            logger.error('Failed to cache test catalog', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            // Fallback to direct database query
            return await TestCatalog.findActiveTests(workplaceId);
        }
    }

    /**
     * Cache test catalog by category
     */
    static async cacheTestsByCategory(
        workplaceId: mongoose.Types.ObjectId,
        category: string
    ): Promise<ITestCatalog[]> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.BY_CATEGORY(workplaceId.toString(), category);

        try {
            const cached = await CacheManager.get<ITestCatalog[]>(cacheKey);
            if (cached) {
                return cached;
            }

            const tests = await TestCatalog.findByCategory(workplaceId, category);
            await CacheManager.set(cacheKey, tests, { ttl: CACHE_TTL.TEST_CATALOG });

            return tests;
        } catch (error) {
            logger.error('Failed to cache tests by category', {
                workplaceId: workplaceId.toString(),
                category,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.findByCategory(workplaceId, category);
        }
    }

    /**
     * Cache test catalog by specimen type
     */
    static async cacheTestsBySpecimen(
        workplaceId: mongoose.Types.ObjectId,
        specimenType: string
    ): Promise<ITestCatalog[]> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.BY_SPECIMEN(workplaceId.toString(), specimenType);

        try {
            const cached = await CacheManager.get<ITestCatalog[]>(cacheKey);
            if (cached) {
                return cached;
            }

            const tests = await TestCatalog.findBySpecimenType(workplaceId, specimenType);
            await CacheManager.set(cacheKey, tests, { ttl: CACHE_TTL.TEST_CATALOG });

            return tests;
        } catch (error) {
            logger.error('Failed to cache tests by specimen type', {
                workplaceId: workplaceId.toString(),
                specimenType,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.findBySpecimenType(workplaceId, specimenType);
        }
    }

    /**
     * Cache test categories for a workplace
     */
    static async cacheTestCategories(workplaceId: mongoose.Types.ObjectId): Promise<string[]> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.CATEGORIES(workplaceId.toString());

        try {
            const cached = await CacheManager.get<string[]>(cacheKey);
            if (cached) {
                return cached;
            }

            const categories = await TestCatalog.getCategories(workplaceId);
            await CacheManager.set(cacheKey, categories, { ttl: CACHE_TTL.TEST_CATALOG });

            return categories;
        } catch (error) {
            logger.error('Failed to cache test categories', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.getCategories(workplaceId);
        }
    }

    /**
     * Cache specimen types for a workplace
     */
    static async cacheSpecimenTypes(workplaceId: mongoose.Types.ObjectId): Promise<string[]> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.SPECIMEN_TYPES(workplaceId.toString());

        try {
            const cached = await CacheManager.get<string[]>(cacheKey);
            if (cached) {
                return cached;
            }

            const specimenTypes = await TestCatalog.getSpecimenTypes(workplaceId);
            await CacheManager.set(cacheKey, specimenTypes, { ttl: CACHE_TTL.TEST_CATALOG });

            return specimenTypes;
        } catch (error) {
            logger.error('Failed to cache specimen types', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.getSpecimenTypes(workplaceId);
        }
    }

    /**
     * Cache test search results
     */
    static async cacheTestSearch(
        workplaceId: mongoose.Types.ObjectId,
        query: string,
        options: {
            category?: string;
            specimenType?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<ITestCatalog[]> {
        const optionsKey = JSON.stringify(options);
        const cacheKey = CACHE_KEYS.TEST_CATALOG.SEARCH(workplaceId.toString(), query, optionsKey);

        try {
            const cached = await CacheManager.get<ITestCatalog[]>(cacheKey);
            if (cached) {
                return cached;
            }

            const tests = await TestCatalog.searchTests(workplaceId, query, options);
            await CacheManager.set(cacheKey, tests, { ttl: CACHE_TTL.SEARCH });

            return tests;
        } catch (error) {
            logger.error('Failed to cache test search', {
                workplaceId: workplaceId.toString(),
                query,
                options,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.searchTests(workplaceId, query, options);
        }
    }

    /**
     * Cache test by code
     */
    static async cacheTestByCode(
        workplaceId: mongoose.Types.ObjectId,
        code: string
    ): Promise<ITestCatalog | null> {
        const cacheKey = CACHE_KEYS.TEST_CATALOG.BY_CODE(workplaceId.toString(), code);

        try {
            const cached = await CacheManager.get<ITestCatalog | null>(cacheKey);
            if (cached !== undefined) {
                return cached;
            }

            const test = await TestCatalog.findByCode(workplaceId, code);
            await CacheManager.set(cacheKey, test, { ttl: CACHE_TTL.TEST_CATALOG });

            return test;
        } catch (error) {
            logger.error('Failed to cache test by code', {
                workplaceId: workplaceId.toString(),
                code,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return await TestCatalog.findByCode(workplaceId, code);
        }
    }

    // ===============================
    // PDF CACHING
    // ===============================

    /**
     * Cache generated PDF requisition
     */
    static async cachePDFRequisition(
        orderId: string,
        pdfData: {
            pdfBuffer: Buffer;
            fileName: string;
            url: string;
            metadata?: any;
        }
    ): Promise<void> {
        const pdfCacheKey = CACHE_KEYS.PDF.REQUISITION(orderId);
        const metadataCacheKey = CACHE_KEYS.PDF.METADATA(orderId);

        try {
            // Cache PDF buffer (compressed)
            await CacheManager.set(pdfCacheKey, pdfData.pdfBuffer, {
                ttl: CACHE_TTL.PDF,
                compress: true
            });

            // Cache metadata separately
            await CacheManager.set(metadataCacheKey, {
                fileName: pdfData.fileName,
                url: pdfData.url,
                metadata: pdfData.metadata,
                cachedAt: new Date()
            }, { ttl: CACHE_TTL.PDF });

            logger.info('PDF requisition cached successfully', {
                orderId,
                fileName: pdfData.fileName,
                bufferSize: pdfData.pdfBuffer.length,
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to cache PDF requisition', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Get cached PDF requisition
     */
    static async getCachedPDFRequisition(orderId: string): Promise<{
        pdfBuffer: Buffer;
        fileName: string;
        url: string;
        metadata?: any;
    } | null> {
        const pdfCacheKey = CACHE_KEYS.PDF.REQUISITION(orderId);
        const metadataCacheKey = CACHE_KEYS.PDF.METADATA(orderId);

        try {
            const [pdfBuffer, metadata] = await Promise.all([
                CacheManager.get<Buffer>(pdfCacheKey),
                CacheManager.get<any>(metadataCacheKey)
            ]);

            if (pdfBuffer && metadata) {
                logger.debug('PDF requisition retrieved from cache', {
                    orderId,
                    fileName: metadata.fileName,
                    bufferSize: pdfBuffer.length,
                    service: 'manual-lab-cache'
                });

                return {
                    pdfBuffer,
                    fileName: metadata.fileName,
                    url: metadata.url,
                    metadata: metadata.metadata
                };
            }

            return null;
        } catch (error) {
            logger.error('Failed to retrieve cached PDF requisition', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return null;
        }
    }

    // ===============================
    // ORDER CACHING
    // ===============================

    /**
     * Cache manual lab order
     */
    static async cacheOrder(order: IManualLabOrder): Promise<void> {
        const cacheKey = CACHE_KEYS.ORDER.BY_ID(order.workplaceId.toString(), order.orderId);

        try {
            await CacheManager.set(cacheKey, order, { ttl: CACHE_TTL.ORDER });

            logger.debug('Manual lab order cached', {
                orderId: order.orderId,
                workplaceId: order.workplaceId.toString(),
                status: order.status,
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to cache manual lab order', {
                orderId: order.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Get cached order
     */
    static async getCachedOrder(
        workplaceId: mongoose.Types.ObjectId,
        orderId: string
    ): Promise<IManualLabOrder | null> {
        const cacheKey = CACHE_KEYS.ORDER.BY_ID(workplaceId.toString(), orderId);

        try {
            const cached = await CacheManager.get<IManualLabOrder>(cacheKey);
            if (cached) {
                logger.debug('Manual lab order retrieved from cache', {
                    orderId,
                    workplaceId: workplaceId.toString(),
                    service: 'manual-lab-cache'
                });
            }
            return cached;
        } catch (error) {
            logger.error('Failed to retrieve cached order', {
                orderId,
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return null;
        }
    }

    /**
     * Cache patient orders
     */
    static async cachePatientOrders(
        workplaceId: mongoose.Types.ObjectId,
        patientId: mongoose.Types.ObjectId,
        orders: IManualLabOrder[],
        page: number,
        limit: number
    ): Promise<void> {
        const cacheKey = CACHE_KEYS.ORDER.BY_PATIENT(
            workplaceId.toString(),
            patientId.toString(),
            page,
            limit
        );

        try {
            await CacheManager.set(cacheKey, orders, { ttl: CACHE_TTL.ORDER });

            logger.debug('Patient orders cached', {
                patientId: patientId.toString(),
                workplaceId: workplaceId.toString(),
                count: orders.length,
                page,
                limit,
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to cache patient orders', {
                patientId: patientId.toString(),
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Get cached patient orders
     */
    static async getCachedPatientOrders(
        workplaceId: mongoose.Types.ObjectId,
        patientId: mongoose.Types.ObjectId,
        page: number,
        limit: number
    ): Promise<IManualLabOrder[] | null> {
        const cacheKey = CACHE_KEYS.ORDER.BY_PATIENT(
            workplaceId.toString(),
            patientId.toString(),
            page,
            limit
        );

        try {
            const cached = await CacheManager.get<IManualLabOrder[]>(cacheKey);
            if (cached) {
                logger.debug('Patient orders retrieved from cache', {
                    patientId: patientId.toString(),
                    workplaceId: workplaceId.toString(),
                    count: cached.length,
                    page,
                    limit,
                    service: 'manual-lab-cache'
                });
            }
            return cached;
        } catch (error) {
            logger.error('Failed to retrieve cached patient orders', {
                patientId: patientId.toString(),
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return null;
        }
    }

    // ===============================
    // RESULT CACHING
    // ===============================

    /**
     * Cache lab result
     */
    static async cacheResult(result: IManualLabResult): Promise<void> {
        const cacheKey = CACHE_KEYS.RESULT.BY_ORDER(result.orderId);

        try {
            await CacheManager.set(cacheKey, result, { ttl: CACHE_TTL.RESULT });

            logger.debug('Manual lab result cached', {
                orderId: result.orderId,
                testCount: result.values.length,
                aiProcessed: result.aiProcessed,
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to cache manual lab result', {
                orderId: result.orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Get cached result
     */
    static async getCachedResult(orderId: string): Promise<IManualLabResult | null> {
        const cacheKey = CACHE_KEYS.RESULT.BY_ORDER(orderId);

        try {
            const cached = await CacheManager.get<IManualLabResult>(cacheKey);
            if (cached) {
                logger.debug('Manual lab result retrieved from cache', {
                    orderId,
                    testCount: cached.values.length,
                    aiProcessed: cached.aiProcessed,
                    service: 'manual-lab-cache'
                });
            }
            return cached;
        } catch (error) {
            logger.error('Failed to retrieve cached result', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return null;
        }
    }

    // ===============================
    // CACHE INVALIDATION
    // ===============================

    /**
     * Invalidate test catalog cache for a workplace
     */
    static async invalidateTestCatalogCache(workplaceId: mongoose.Types.ObjectId): Promise<void> {
        try {
            const patterns = [
                CACHE_KEYS.TEST_CATALOG.ALL_ACTIVE(workplaceId.toString()),
                `${CACHE_KEYS.TEST_CATALOG.BY_CATEGORY(workplaceId.toString(), '*')}`,
                `${CACHE_KEYS.TEST_CATALOG.BY_SPECIMEN(workplaceId.toString(), '*')}`,
                CACHE_KEYS.TEST_CATALOG.CATEGORIES(workplaceId.toString()),
                CACHE_KEYS.TEST_CATALOG.SPECIMEN_TYPES(workplaceId.toString()),
                `${CACHE_KEYS.TEST_CATALOG.SEARCH(workplaceId.toString(), '*', '*')}`,
                `${CACHE_KEYS.TEST_CATALOG.BY_CODE(workplaceId.toString(), '*')}`
            ];

            await Promise.all(patterns.map(pattern => CacheManager.delete(pattern)));

            logger.info('Test catalog cache invalidated', {
                workplaceId: workplaceId.toString(),
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to invalidate test catalog cache', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Invalidate order cache
     */
    static async invalidateOrderCache(
        workplaceId: mongoose.Types.ObjectId,
        orderId?: string,
        patientId?: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            const patterns: string[] = [];

            if (orderId) {
                patterns.push(CACHE_KEYS.ORDER.BY_ID(workplaceId.toString(), orderId));
            }

            if (patientId) {
                patterns.push(`${CACHE_KEYS.ORDER.BY_PATIENT(workplaceId.toString(), patientId.toString(), 0, 0).split(':').slice(0, -2).join(':')}:*`);
            }

            // Invalidate workplace-level caches
            patterns.push(CACHE_KEYS.ORDER.ACTIVE(workplaceId.toString()));
            patterns.push(`${CACHE_KEYS.ORDER.BY_STATUS(workplaceId.toString(), '*')}`);

            await Promise.all(patterns.map(pattern => CacheManager.delete(pattern)));

            logger.info('Order cache invalidated', {
                workplaceId: workplaceId.toString(),
                orderId,
                patientId: patientId?.toString(),
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to invalidate order cache', {
                workplaceId: workplaceId.toString(),
                orderId,
                patientId: patientId?.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Invalidate result cache
     */
    static async invalidateResultCache(orderId: string): Promise<void> {
        try {
            await CacheManager.delete(CACHE_KEYS.RESULT.BY_ORDER(orderId));

            logger.info('Result cache invalidated', {
                orderId,
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to invalidate result cache', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    /**
     * Clear all manual lab caches for a workplace
     */
    static async clearWorkplaceCache(workplaceId: mongoose.Types.ObjectId): Promise<void> {
        try {
            const patterns = [
                `manual_lab:*:${workplaceId.toString()}:*`,
                `manual_lab:*:${workplaceId.toString()}`
            ];

            await Promise.all(patterns.map(pattern => CacheManager.delete(pattern)));

            logger.info('All manual lab caches cleared for workplace', {
                workplaceId: workplaceId.toString(),
                service: 'manual-lab-cache'
            });
        } catch (error) {
            logger.error('Failed to clear workplace cache', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });
        }
    }

    // ===============================
    // CACHE STATISTICS
    // ===============================

    /**
     * Get cache statistics for monitoring
     */
    static async getCacheStats(): Promise<{
        redisConnected: boolean;
        totalKeys: number;
        manualLabKeys: number;
        memoryUsage?: string;
    }> {
        try {
            const redisClient = await getRedisClient();
            if (!redisClient) {
                return {
                    redisConnected: false,
                    totalKeys: 0,
                    manualLabKeys: 0
                };
            }

            const [totalKeys, manualLabKeys, memoryInfoArray] = await Promise.all([
                redisClient.dbsize(),
                redisClient.keys('manual_lab:*').then(keys => keys.length),
                redisClient.memory('STATS').catch(() => null)
            ]);

            let memoryUsageBytes: number | undefined;
            if (memoryInfoArray) {
                const usedMemoryIndex = memoryInfoArray.indexOf('used_memory');
                if (usedMemoryIndex !== -1 && usedMemoryIndex + 1 < memoryInfoArray.length) {
                    memoryUsageBytes = parseInt(memoryInfoArray[usedMemoryIndex + 1] as string);
                }
            }

            return {
                redisConnected: true,
                totalKeys,
                manualLabKeys,
                memoryUsage: memoryUsageBytes ? `${Math.round(memoryUsageBytes / 1024 / 1024 * 100) / 100} MB` : undefined
            };
        } catch (error) {
            logger.error('Failed to get cache statistics', {
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'manual-lab-cache'
            });

            return {
                redisConnected: false,
                totalKeys: 0,
                manualLabKeys: 0
            };
        }
    }
}

export default ManualLabCacheService;