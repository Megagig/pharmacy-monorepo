import { Db, MongoClient } from 'mongodb';
import logger from '../utils/logger';

/**
 * Manual Lab Order Database Migrations
 * 
 * This file contains all database migrations required for the Manual Lab Order workflow.
 * Migrations are designed to be idempotent and can be run multiple times safely.
 */

export interface MigrationResult {
    success: boolean;
    message: string;
    details?: any;
}

/**
 * Migration 001: Create Manual Lab Order Collections and Indexes
 */
export async function migration001_createManualLabCollections(db: Db): Promise<MigrationResult> {
    try {
        logger.info('Running migration 001: Create Manual Lab Order Collections');

        // Check if collections already exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        // Create manuallaborders collection if it doesn't exist
        if (!collectionNames.includes('manuallaborders')) {
            await db.createCollection('manuallaborders', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['orderId', 'patientId', 'workplaceId', 'orderedBy', 'tests', 'indication', 'status', 'consentObtained'],
                        properties: {
                            orderId: {
                                bsonType: 'string',
                                pattern: '^LAB-[0-9]{4}-[0-9]{4}$',
                                description: 'Order ID must be in format LAB-YYYY-XXXX'
                            },
                            patientId: {
                                bsonType: 'objectId',
                                description: 'Patient ObjectId is required'
                            },
                            workplaceId: {
                                bsonType: 'objectId',
                                description: 'Workplace ObjectId is required'
                            },
                            orderedBy: {
                                bsonType: 'objectId',
                                description: 'User ObjectId is required'
                            },
                            tests: {
                                bsonType: 'array',
                                minItems: 1,
                                maxItems: 20,
                                items: {
                                    bsonType: 'object',
                                    required: ['name', 'code', 'specimenType'],
                                    properties: {
                                        name: { bsonType: 'string', maxLength: 200 },
                                        code: { bsonType: 'string', maxLength: 20 },
                                        specimenType: { bsonType: 'string', maxLength: 100 }
                                    }
                                }
                            },
                            indication: {
                                bsonType: 'string',
                                maxLength: 1000,
                                description: 'Clinical indication is required'
                            },
                            status: {
                                bsonType: 'string',
                                enum: ['requested', 'sample_collected', 'result_awaited', 'completed', 'referred']
                            },
                            priority: {
                                bsonType: 'string',
                                enum: ['routine', 'urgent', 'stat']
                            },
                            consentObtained: {
                                bsonType: 'bool',
                                description: 'Patient consent is required'
                            },
                            isDeleted: {
                                bsonType: 'bool'
                            }
                        }
                    }
                }
            });
            logger.info('Created manuallaborders collection with validation schema');
        }

        // Create manuallabresults collection if it doesn't exist
        if (!collectionNames.includes('manuallabresults')) {
            await db.createCollection('manuallabresults', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['orderId', 'enteredBy', 'enteredAt', 'values'],
                        properties: {
                            orderId: {
                                bsonType: 'string',
                                pattern: '^LAB-[0-9]{4}-[0-9]{4}$',
                                description: 'Order ID must be in format LAB-YYYY-XXXX'
                            },
                            enteredBy: {
                                bsonType: 'objectId',
                                description: 'User ObjectId is required'
                            },
                            values: {
                                bsonType: 'array',
                                minItems: 1,
                                maxItems: 50,
                                items: {
                                    bsonType: 'object',
                                    required: ['testCode', 'testName'],
                                    properties: {
                                        testCode: { bsonType: 'string', maxLength: 20 },
                                        testName: { bsonType: 'string', maxLength: 200 },
                                        numericValue: { bsonType: 'number' },
                                        stringValue: { bsonType: 'string', maxLength: 500 }
                                    }
                                }
                            },
                            isDeleted: {
                                bsonType: 'bool'
                            }
                        }
                    }
                }
            });
            logger.info('Created manuallabresults collection with validation schema');
        }

        return {
            success: true,
            message: 'Manual Lab collections created successfully',
            details: {
                collectionsCreated: [
                    !collectionNames.includes('manuallaborders') ? 'manuallaborders' : null,
                    !collectionNames.includes('manuallabresults') ? 'manuallabresults' : null
                ].filter(Boolean)
            }
        };

    } catch (error) {
        logger.error('Failed to create Manual Lab collections', error);
        return {
            success: false,
            message: 'Failed to create Manual Lab collections',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Migration 002: Create Indexes for Manual Lab Collections
 */
export async function migration002_createManualLabIndexes(db: Db): Promise<MigrationResult> {
    try {
        logger.info('Running migration 002: Create Manual Lab Indexes');

        const indexResults = [];

        // Manual Lab Orders Indexes
        const orderIndexes = [
            // Unique compound index for workspace and order ID
            {
                keys: { workplaceId: 1, orderId: 1 },
                options: { unique: true, name: 'workplaceId_orderId_unique' }
            },
            // Patient order history index
            {
                keys: { patientId: 1, createdAt: -1 },
                options: { name: 'patientId_createdAt' }
            },
            // Status-based queries index
            {
                keys: { workplaceId: 1, status: 1 },
                options: { name: 'workplaceId_status' }
            },
            // Token resolution index
            {
                keys: { barcodeData: 1 },
                options: { unique: true, sparse: true, name: 'barcodeData_unique' }
            },
            // General query index
            {
                keys: { createdAt: -1 },
                options: { name: 'createdAt_desc' }
            },
            // Ordered by pharmacist index
            {
                keys: { orderedBy: 1, createdAt: -1 },
                options: { name: 'orderedBy_createdAt' }
            },
            // Priority and location indexes
            {
                keys: { workplaceId: 1, priority: 1, createdAt: -1 },
                options: { name: 'workplaceId_priority_createdAt' }
            },
            {
                keys: { workplaceId: 1, locationId: 1, createdAt: -1 },
                options: { sparse: true, name: 'workplaceId_locationId_createdAt' }
            }
        ];

        for (const index of orderIndexes) {
            try {
                await db.collection('manuallaborders').createIndex(index.keys as any, index.options);
                indexResults.push({ collection: 'manuallaborders', index: index.options.name, status: 'created' });
                logger.info(`Created index ${index.options.name} on manuallaborders`);
            } catch (error) {
                if (error instanceof Error && error.message.includes('already exists')) {
                    indexResults.push({ collection: 'manuallaborders', index: index.options.name, status: 'exists' });
                } else {
                    throw error;
                }
            }
        }

        // Manual Lab Results Indexes
        const resultIndexes = [
            // Unique index for order results
            {
                keys: { orderId: 1 },
                options: { unique: true, name: 'orderId_unique' }
            },
            // Entered by pharmacist index
            {
                keys: { enteredBy: 1, enteredAt: -1 },
                options: { name: 'enteredBy_enteredAt' }
            },
            // AI processing status index
            {
                keys: { aiProcessed: 1 },
                options: { name: 'aiProcessed' }
            },
            // Review status index
            {
                keys: { reviewedBy: 1, reviewedAt: -1 },
                options: { sparse: true, name: 'reviewedBy_reviewedAt' }
            }
        ];

        for (const index of resultIndexes) {
            try {
                await db.collection('manuallabresults').createIndex(index.keys as any, index.options);
                indexResults.push({ collection: 'manuallabresults', index: index.options.name, status: 'created' });
                logger.info(`Created index ${index.options.name} on manuallabresults`);
            } catch (error) {
                if (error instanceof Error && error.message.includes('already exists')) {
                    indexResults.push({ collection: 'manuallabresults', index: index.options.name, status: 'exists' });
                } else {
                    throw error;
                }
            }
        }

        return {
            success: true,
            message: 'Manual Lab indexes created successfully',
            details: { indexResults }
        };

    } catch (error) {
        logger.error('Failed to create Manual Lab indexes', error);
        return {
            success: false,
            message: 'Failed to create Manual Lab indexes',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Migration 003: Create Test Catalog Collection
 */
export async function migration003_createTestCatalog(db: Db): Promise<MigrationResult> {
    try {
        logger.info('Running migration 003: Create Test Catalog');

        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        // Create test catalog collection if it doesn't exist
        if (!collectionNames.includes('manuallabcatalog')) {
            await db.createCollection('manuallabcatalog', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['name', 'code', 'specimenType', 'category'],
                        properties: {
                            name: { bsonType: 'string', maxLength: 200 },
                            code: { bsonType: 'string', maxLength: 20 },
                            loincCode: { bsonType: 'string', maxLength: 20 },
                            specimenType: { bsonType: 'string', maxLength: 100 },
                            unit: { bsonType: 'string', maxLength: 20 },
                            refRange: { bsonType: 'string', maxLength: 100 },
                            category: { bsonType: 'string', maxLength: 100 },
                            isActive: { bsonType: 'bool' }
                        }
                    }
                }
            });

            // Create indexes for test catalog
            await db.collection('manuallabcatalog').createIndex(
                { code: 1 },
                { unique: true, name: 'code_unique' }
            );

            await db.collection('manuallabcatalog').createIndex(
                { category: 1, name: 1 },
                { name: 'category_name' }
            );

            await db.collection('manuallabcatalog').createIndex(
                { name: 'text', code: 'text' },
                { name: 'text_search' }
            );

            // Insert default test catalog
            const defaultTests = [
                {
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    loincCode: '58410-2',
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    name: 'Glucose',
                    code: 'GLU',
                    loincCode: '33747-0',
                    specimenType: 'Blood',
                    unit: 'mg/dL',
                    refRange: '70-100',
                    category: 'Chemistry',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    name: 'Hemoglobin A1c',
                    code: 'HBA1C',
                    loincCode: '4548-4',
                    specimenType: 'Blood',
                    unit: '%',
                    refRange: '<7.0',
                    category: 'Chemistry',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    name: 'Lipid Panel',
                    code: 'LIPID',
                    loincCode: '57698-3',
                    specimenType: 'Blood',
                    unit: 'mg/dL',
                    refRange: 'Various',
                    category: 'Chemistry',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    name: 'Urinalysis',
                    code: 'UA',
                    loincCode: '24357-6',
                    specimenType: 'Urine',
                    unit: 'Various',
                    refRange: 'Various',
                    category: 'Urinalysis',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            await db.collection('manuallabcatalog').insertMany(defaultTests);

            logger.info('Created test catalog collection with default tests');
        }

        return {
            success: true,
            message: 'Test catalog created successfully',
            details: {
                collectionCreated: !collectionNames.includes('manuallabcatalog'),
                defaultTestsCount: 5
            }
        };

    } catch (error) {
        logger.error('Failed to create test catalog', error);
        return {
            success: false,
            message: 'Failed to create test catalog',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Migration 004: Add Manual Lab Feature Flags
 */
export async function migration004_addFeatureFlags(db: Db): Promise<MigrationResult> {
    try {
        logger.info('Running migration 004: Add Manual Lab Feature Flags');

        const featureFlags = [
            {
                name: 'manual_lab_orders',
                description: 'Enable manual lab order workflow',
                isEnabled: true,
                scope: 'global',
                conditions: {},
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'manual_lab_ai_interpretation',
                description: 'Enable AI interpretation for manual lab results',
                isEnabled: true,
                scope: 'global',
                conditions: {},
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'manual_lab_notifications',
                description: 'Enable notifications for manual lab results',
                isEnabled: true,
                scope: 'global',
                conditions: {},
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        const results = [];
        for (const flag of featureFlags) {
            const existing = await db.collection('featureflags').findOne({ name: flag.name });
            if (!existing) {
                await db.collection('featureflags').insertOne(flag);
                results.push({ flag: flag.name, status: 'created' });
                logger.info(`Created feature flag: ${flag.name}`);
            } else {
                results.push({ flag: flag.name, status: 'exists' });
            }
        }

        return {
            success: true,
            message: 'Manual Lab feature flags added successfully',
            details: { results }
        };

    } catch (error) {
        logger.error('Failed to add feature flags', error);
        return {
            success: false,
            message: 'Failed to add feature flags',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Run all Manual Lab migrations
 */
export async function runAllManualLabMigrations(db: Db): Promise<MigrationResult[]> {
    logger.info('Starting Manual Lab database migrations');

    const migrations = [
        migration001_createManualLabCollections,
        migration002_createManualLabIndexes,
        migration003_createTestCatalog,
        migration004_addFeatureFlags
    ];

    const results: MigrationResult[] = [];

    for (const migration of migrations) {
        const result = await migration(db);
        results.push(result);

        if (!result.success) {
            logger.error(`Migration failed: ${result.message}`);
            break; // Stop on first failure
        }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Manual Lab migrations completed: ${successCount}/${results.length} successful`);

    return results;
}

/**
 * Rollback Manual Lab migrations (for development/testing)
 */
export async function rollbackManualLabMigrations(db: Db): Promise<MigrationResult> {
    try {
        logger.warn('Rolling back Manual Lab migrations - USE WITH CAUTION');

        // Drop collections (in reverse order)
        const collections = ['manuallabcatalog', 'manuallabresults', 'manuallaborders'];
        const droppedCollections = [];

        for (const collectionName of collections) {
            try {
                await db.collection(collectionName).drop();
                droppedCollections.push(collectionName);
                logger.info(`Dropped collection: ${collectionName}`);
            } catch (error) {
                if (error instanceof Error && error.message.includes('ns not found')) {
                    logger.info(`Collection ${collectionName} does not exist, skipping`);
                } else {
                    throw error;
                }
            }
        }

        // Remove feature flags
        const featureFlagNames = [
            'manual_lab_orders',
            'manual_lab_ai_interpretation',
            'manual_lab_notifications'
        ];

        const deleteResult = await db.collection('featureflags').deleteMany({
            name: { $in: featureFlagNames }
        });

        return {
            success: true,
            message: 'Manual Lab migrations rolled back successfully',
            details: {
                droppedCollections,
                deletedFeatureFlags: deleteResult.deletedCount
            }
        };

    } catch (error) {
        logger.error('Failed to rollback Manual Lab migrations', error);
        return {
            success: false,
            message: 'Failed to rollback Manual Lab migrations',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Validate Manual Lab database setup
 */
export async function validateManualLabSetup(db: Db): Promise<MigrationResult> {
    try {
        logger.info('Validating Manual Lab database setup');

        const validationResults = [];

        // Check collections exist
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        const requiredCollections = ['manuallaborders', 'manuallabresults', 'manuallabcatalog'];
        for (const collectionName of requiredCollections) {
            const exists = collectionNames.includes(collectionName);
            validationResults.push({
                type: 'collection',
                name: collectionName,
                status: exists ? 'exists' : 'missing'
            });
        }

        // Check indexes exist
        const orderIndexes = await db.collection('manuallaborders').listIndexes().toArray();
        const resultIndexes = await db.collection('manuallabresults').listIndexes().toArray();
        const catalogIndexes = await db.collection('manuallabcatalog').listIndexes().toArray();

        validationResults.push({
            type: 'indexes',
            collection: 'manuallaborders',
            count: orderIndexes.length,
            indexes: orderIndexes.map(i => i.name)
        });

        validationResults.push({
            type: 'indexes',
            collection: 'manuallabresults',
            count: resultIndexes.length,
            indexes: resultIndexes.map(i => i.name)
        });

        validationResults.push({
            type: 'indexes',
            collection: 'manuallabcatalog',
            count: catalogIndexes.length,
            indexes: catalogIndexes.map(i => i.name)
        });

        // Check feature flags
        const featureFlags = await db.collection('featureflags').find({
            name: { $in: ['manual_lab_orders', 'manual_lab_ai_interpretation', 'manual_lab_notifications'] }
        }).toArray();

        validationResults.push({
            type: 'feature_flags',
            count: featureFlags.length,
            flags: featureFlags.map(f => ({ name: f.name, enabled: f.isEnabled }))
        });

        // Check test catalog data
        const testCount = await db.collection('manuallabcatalog').countDocuments({ isActive: true });
        validationResults.push({
            type: 'test_catalog',
            activeTests: testCount
        });

        const allValid = validationResults.every(result => {
            if (result.type === 'collection') return result.status === 'exists';
            if (result.type === 'indexes') return (result as any).count > 1; // At least _id index + custom indexes
            if (result.type === 'feature_flags') return (result as any).count === 3;
            if (result.type === 'test_catalog') return (result as any).activeTests > 0;
            return true;
        });

        return {
            success: allValid,
            message: allValid ? 'Manual Lab setup validation passed' : 'Manual Lab setup validation failed',
            details: { validationResults }
        };

    } catch (error) {
        logger.error('Failed to validate Manual Lab setup', error);
        return {
            success: false,
            message: 'Failed to validate Manual Lab setup',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// CLI interface for running migrations
if (require.main === module) {
    const { MongoClient } = require('mongodb');

    async function runMigrationsCLI() {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
        const client = new MongoClient(mongoUri);

        try {
            await client.connect();
            const db = client.db();

            const command = process.argv[2];

            switch (command) {
                case 'up':
                    const results = await runAllManualLabMigrations(db);
                    console.log('Migration results:', JSON.stringify(results, null, 2));
                    break;

                case 'down':
                    const rollbackResult = await rollbackManualLabMigrations(db);
                    console.log('Rollback result:', JSON.stringify(rollbackResult, null, 2));
                    break;

                case 'validate':
                    const validationResult = await validateManualLabSetup(db);
                    console.log('Validation result:', JSON.stringify(validationResult, null, 2));
                    break;

                default:
                    console.log('Usage: node manualLabMigrations.js [up|down|validate]');
                    process.exit(1);
            }

        } catch (error) {
            console.error('Migration error:', error);
            process.exit(1);
        } finally {
            await client.close();
        }
    }

    runMigrationsCLI();
}