#!/usr/bin/env node
// Database Initialization Script for Report Indexes
import mongoose from 'mongoose';
import DatabaseIndexingService from '../utils/databaseIndexing';
import logger from '../utils/logger';

/**
 * Initialize database indexes for optimal report performance
 */
async function initializeReportIndexes() {
    try {
        logger.info('Starting database index initialization...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        // Initialize indexing service
        const indexingService = DatabaseIndexingService.getInstance();

        // Create all report indexes
        await indexingService.createReportIndexes();

        // Analyze query performance and get recommendations
        const recommendations = await indexingService.analyzeQueryPerformance();

        if (recommendations.length > 0) {
            logger.info('Index recommendations generated:');
            recommendations.forEach((rec, index) => {
                logger.info(`${index + 1}. ${rec.collection}: ${rec.reason} (Priority: ${rec.priority})`);
                logger.info(`   Recommended index: ${JSON.stringify(rec.index.fields)}`);
                logger.info(`   Estimated impact: ${rec.estimatedImpact}`);
            });
        }

        // Get index statistics
        const indexStats = await indexingService.getIndexStats();
        logger.info(`Index statistics collected for ${indexStats.length} collections`);

        logger.info('Database index initialization completed successfully');

    } catch (error) {
        logger.error('Failed to initialize database indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        logger.info('Disconnected from MongoDB');
    }
}

/**
 * Drop unused indexes to optimize performance
 */
async function cleanupUnusedIndexes() {
    try {
        logger.info('Starting unused index cleanup...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        // Initialize indexing service
        const indexingService = DatabaseIndexingService.getInstance();

        // Drop unused indexes
        await indexingService.dropUnusedIndexes();

        logger.info('Unused index cleanup completed successfully');

    } catch (error) {
        logger.error('Failed to cleanup unused indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        logger.info('Disconnected from MongoDB');
    }
}

/**
 * Analyze query performance and generate recommendations
 */
async function analyzePerformance() {
    try {
        logger.info('Starting query performance analysis...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy_db';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB');

        // Initialize indexing service
        const indexingService = DatabaseIndexingService.getInstance();

        // Analyze performance
        const recommendations = await indexingService.analyzeQueryPerformance();

        if (recommendations.length === 0) {
            logger.info('No performance issues detected. All queries are performing well.');
        } else {
            logger.info(`Found ${recommendations.length} performance optimization opportunities:`);

            recommendations.forEach((rec, index) => {
                logger.info(`\n${index + 1}. Collection: ${rec.collection}`);
                logger.info(`   Priority: ${rec.priority.toUpperCase()}`);
                logger.info(`   Issue: ${rec.reason}`);
                logger.info(`   Recommended Index: ${JSON.stringify(rec.index.fields, null, 2)}`);
                logger.info(`   Expected Impact: ${rec.estimatedImpact}`);

                if (rec.index.options?.name) {
                    logger.info(`   Index Name: ${rec.index.options.name}`);
                }
            });

            // Generate MongoDB commands for manual execution
            logger.info('\n=== MongoDB Commands for Manual Execution ===');
            recommendations.forEach((rec, index) => {
                const collectionName = rec.collection;
                const indexFields = JSON.stringify(rec.index.fields);
                const indexOptions = rec.index.options ? JSON.stringify(rec.index.options) : '{}';

                logger.info(`\n// Recommendation ${index + 1}: ${rec.reason}`);
                logger.info(`db.${collectionName}.createIndex(${indexFields}, ${indexOptions});`);
            });
        }

        // Get current index statistics
        const indexStats = await indexingService.getIndexStats();
        logger.info(`\n=== Current Index Statistics ===`);

        indexStats.forEach(stat => {
            logger.info(`\nCollection: ${stat.collection}`);
            stat.indexes.forEach((idx: any) => {
                logger.info(`  - ${idx.name}: ${idx.accesses?.ops || 0} operations`);
            });
        });

        logger.info('Query performance analysis completed');

    } catch (error) {
        logger.error('Failed to analyze query performance:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        logger.info('Disconnected from MongoDB');
    }
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'init':
        initializeReportIndexes();
        break;
    case 'cleanup':
        cleanupUnusedIndexes();
        break;
    case 'analyze':
        analyzePerformance();
        break;
    default:
        console.log('Usage: npm run db:indexes <command>');
        console.log('Commands:');
        console.log('  init     - Initialize all report indexes');
        console.log('  cleanup  - Remove unused indexes');
        console.log('  analyze  - Analyze query performance and generate recommendations');
        console.log('');
        console.log('Examples:');
        console.log('  npm run db:indexes init');
        console.log('  npm run db:indexes analyze');
        console.log('  npm run db:indexes cleanup');
        process.exit(1);
}

export { initializeReportIndexes, cleanupUnusedIndexes, analyzePerformance };