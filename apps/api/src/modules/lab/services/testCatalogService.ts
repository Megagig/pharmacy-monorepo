import mongoose from 'mongoose';
import logger from '../../../utils/logger';

// Import models
import TestCatalog, { ITestCatalog } from '../models/TestCatalog';

// Import cache service
import ManualLabCacheService from './manualLabCacheService';

// Import utilities
import {
    createValidationError,
    createNotFoundError,
    createBusinessRuleError,
} from '../../../utils/responseHelpers';

/**
 * Test Catalog Service with Caching
 * Handles business logic for test catalog management with performance optimization
 */

export interface CreateTestRequest {
    workplaceId: mongoose.Types.ObjectId;
    code: string;
    name: string;
    loincCode?: string;
    category: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    description?: string;
    estimatedCost?: number;
    turnaroundTime?: string;
    isCustom?: boolean;
    createdBy: mongoose.Types.ObjectId;
}

export interface UpdateTestRequest {
    name?: string;
    loincCode?: string;
    category?: string;
    specimenType?: string;
    unit?: string;
    refRange?: string;
    description?: string;
    estimatedCost?: number;
    turnaroundTime?: string;
    isActive?: boolean;
    updatedBy: mongoose.Types.ObjectId;
}

export interface TestSearchOptions {
    category?: string;
    specimenType?: string;
    limit?: number;
    offset?: number;
}

export class TestCatalogService {

    /**
     * Get all active tests for a workplace (cached)
     */
    static async getActiveTests(workplaceId: mongoose.Types.ObjectId): Promise<ITestCatalog[]> {
        try {
            return await ManualLabCacheService.cacheActiveTestCatalog(workplaceId);
        } catch (error) {
            logger.error('Failed to get active tests', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Get tests by category (cached)
     */
    static async getTestsByCategory(
        workplaceId: mongoose.Types.ObjectId,
        category: string
    ): Promise<ITestCatalog[]> {
        try {
            return await ManualLabCacheService.cacheTestsByCategory(workplaceId, category);
        } catch (error) {
            logger.error('Failed to get tests by category', {
                workplaceId: workplaceId.toString(),
                category,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Get tests by specimen type (cached)
     */
    static async getTestsBySpecimen(
        workplaceId: mongoose.Types.ObjectId,
        specimenType: string
    ): Promise<ITestCatalog[]> {
        try {
            return await ManualLabCacheService.cacheTestsBySpecimen(workplaceId, specimenType);
        } catch (error) {
            logger.error('Failed to get tests by specimen type', {
                workplaceId: workplaceId.toString(),
                specimenType,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Get test categories (cached)
     */
    static async getCategories(workplaceId: mongoose.Types.ObjectId): Promise<string[]> {
        try {
            return await ManualLabCacheService.cacheTestCategories(workplaceId);
        } catch (error) {
            logger.error('Failed to get test categories', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Get specimen types (cached)
     */
    static async getSpecimenTypes(workplaceId: mongoose.Types.ObjectId): Promise<string[]> {
        try {
            return await ManualLabCacheService.cacheSpecimenTypes(workplaceId);
        } catch (error) {
            logger.error('Failed to get specimen types', {
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Search tests (cached)
     */
    static async searchTests(
        workplaceId: mongoose.Types.ObjectId,
        query: string,
        options: TestSearchOptions = {}
    ): Promise<ITestCatalog[]> {
        try {
            return await ManualLabCacheService.cacheTestSearch(workplaceId, query, options);
        } catch (error) {
            logger.error('Failed to search tests', {
                workplaceId: workplaceId.toString(),
                query,
                options,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Get test by code (cached)
     */
    static async getTestByCode(
        workplaceId: mongoose.Types.ObjectId,
        code: string
    ): Promise<ITestCatalog | null> {
        try {
            return await ManualLabCacheService.cacheTestByCode(workplaceId, code);
        } catch (error) {
            logger.error('Failed to get test by code', {
                workplaceId: workplaceId.toString(),
                code,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });
            throw error;
        }
    }

    /**
     * Create new test (invalidates cache)
     */
    static async createTest(testData: CreateTestRequest): Promise<ITestCatalog> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Check if test code already exists
            const existingTest = await TestCatalog.findByCode(testData.workplaceId, testData.code);
            if (existingTest) {
                throw createBusinessRuleError(`Test with code ${testData.code} already exists`);
            }

            // Create the test
            const test = new TestCatalog({
                ...testData,
                code: testData.code.toUpperCase(),
                isCustom: testData.isCustom !== false, // Default to true for user-created tests
                createdBy: testData.createdBy
            });

            await test.save({ session });
            await session.commitTransaction();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(testData.workplaceId);

            logger.info('Test catalog entry created', {
                testId: test._id,
                code: test.code,
                name: test.name,
                workplaceId: testData.workplaceId.toString(),
                service: 'test-catalog'
            });

            return test;
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to create test catalog entry', {
                testData,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Update test (invalidates cache)
     */
    static async updateTest(
        workplaceId: mongoose.Types.ObjectId,
        testId: mongoose.Types.ObjectId,
        updateData: UpdateTestRequest
    ): Promise<ITestCatalog> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const test = await TestCatalog.findOne({
                _id: testId,
                workplaceId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!test) {
                throw createNotFoundError('Test not found');
            }

            // Update fields
            Object.assign(test, updateData);
            test.updatedBy = updateData.updatedBy;

            await test.save({ session });
            await session.commitTransaction();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Test catalog entry updated', {
                testId: test._id,
                code: test.code,
                workplaceId: workplaceId.toString(),
                service: 'test-catalog'
            });

            return test;
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to update test catalog entry', {
                testId,
                workplaceId: workplaceId.toString(),
                updateData,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Delete test (soft delete, invalidates cache)
     */
    static async deleteTest(
        workplaceId: mongoose.Types.ObjectId,
        testId: mongoose.Types.ObjectId,
        deletedBy: mongoose.Types.ObjectId
    ): Promise<void> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const test = await TestCatalog.findOne({
                _id: testId,
                workplaceId,
                isDeleted: { $ne: true }
            }).session(session);

            if (!test) {
                throw createNotFoundError('Test not found');
            }

            // Soft delete
            test.isDeleted = true;
            test.updatedBy = deletedBy;
            await test.save({ session });

            await session.commitTransaction();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Test catalog entry deleted', {
                testId: test._id,
                code: test.code,
                workplaceId: workplaceId.toString(),
                service: 'test-catalog'
            });
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to delete test catalog entry', {
                testId,
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Activate test (invalidates cache)
     */
    static async activateTest(
        workplaceId: mongoose.Types.ObjectId,
        testId: mongoose.Types.ObjectId,
        updatedBy: mongoose.Types.ObjectId
    ): Promise<ITestCatalog> {
        try {
            const test = await TestCatalog.findOne({
                _id: testId,
                workplaceId,
                isDeleted: { $ne: true }
            });

            if (!test) {
                throw createNotFoundError('Test not found');
            }

            await test.activate();
            test.updatedBy = updatedBy;
            await test.save();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Test catalog entry activated', {
                testId: test._id,
                code: test.code,
                workplaceId: workplaceId.toString(),
                service: 'test-catalog'
            });

            return test;
        } catch (error) {
            logger.error('Failed to activate test catalog entry', {
                testId,
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        }
    }

    /**
     * Deactivate test (invalidates cache)
     */
    static async deactivateTest(
        workplaceId: mongoose.Types.ObjectId,
        testId: mongoose.Types.ObjectId,
        updatedBy: mongoose.Types.ObjectId
    ): Promise<ITestCatalog> {
        try {
            const test = await TestCatalog.findOne({
                _id: testId,
                workplaceId,
                isDeleted: { $ne: true }
            });

            if (!test) {
                throw createNotFoundError('Test not found');
            }

            await test.deactivate();
            test.updatedBy = updatedBy;
            await test.save();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Test catalog entry deactivated', {
                testId: test._id,
                code: test.code,
                workplaceId: workplaceId.toString(),
                service: 'test-catalog'
            });

            return test;
        } catch (error) {
            logger.error('Failed to deactivate test catalog entry', {
                testId,
                workplaceId: workplaceId.toString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        }
    }

    /**
     * Update test cost (invalidates cache)
     */
    static async updateTestCost(
        workplaceId: mongoose.Types.ObjectId,
        testId: mongoose.Types.ObjectId,
        cost: number,
        updatedBy: mongoose.Types.ObjectId
    ): Promise<ITestCatalog> {
        try {
            const test = await TestCatalog.findOne({
                _id: testId,
                workplaceId,
                isDeleted: { $ne: true }
            });

            if (!test) {
                throw createNotFoundError('Test not found');
            }

            await test.updateCost(cost, updatedBy);

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Test catalog cost updated', {
                testId: test._id,
                code: test.code,
                newCost: cost,
                workplaceId: workplaceId.toString(),
                service: 'test-catalog'
            });

            return test;
        } catch (error) {
            logger.error('Failed to update test cost', {
                testId,
                workplaceId: workplaceId.toString(),
                cost,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        }
    }

    /**
     * Bulk import tests (invalidates cache)
     */
    static async bulkImportTests(
        workplaceId: mongoose.Types.ObjectId,
        tests: Omit<CreateTestRequest, 'workplaceId' | 'createdBy'>[],
        createdBy: mongoose.Types.ObjectId
    ): Promise<{
        imported: number;
        skipped: number;
        errors: string[];
    }> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let imported = 0;
            let skipped = 0;
            const errors: string[] = [];

            for (const testData of tests) {
                try {
                    // Check if test already exists
                    const existingTest = await TestCatalog.findByCode(workplaceId, testData.code);
                    if (existingTest) {
                        skipped++;
                        continue;
                    }

                    // Create test
                    const test = new TestCatalog({
                        ...testData,
                        workplaceId,
                        code: testData.code.toUpperCase(),
                        isCustom: false, // Bulk imports are usually system defaults
                        createdBy
                    });

                    await test.save({ session });
                    imported++;
                } catch (error) {
                    errors.push(`${testData.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            await session.commitTransaction();

            // Invalidate cache
            await ManualLabCacheService.invalidateTestCatalogCache(workplaceId);

            logger.info('Bulk test import completed', {
                workplaceId: workplaceId.toString(),
                totalTests: tests.length,
                imported,
                skipped,
                errors: errors.length,
                service: 'test-catalog'
            });

            return { imported, skipped, errors };
        } catch (error) {
            await session.abortTransaction();

            logger.error('Failed to bulk import tests', {
                workplaceId: workplaceId.toString(),
                testCount: tests.length,
                error: error instanceof Error ? error.message : 'Unknown error',
                service: 'test-catalog'
            });

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get cache statistics
     */
    static async getCacheStats(): Promise<{
        redisConnected: boolean;
        totalKeys: number;
        manualLabKeys: number;
        memoryUsage?: string;
    }> {
        return await ManualLabCacheService.getCacheStats();
    }
}

export default TestCatalogService;