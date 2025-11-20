#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PerformanceDatabaseOptimizer from '../services/PerformanceDatabaseOptimizer';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Database Index Optimization Script
 * Creates optimized indexes for all PharmacyCopilot collections
 */
async function optimizeDatabaseIndexes() {
  try {
    logger.info('Starting database index optimization script');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Get optimizer instance
    const optimizer = PerformanceDatabaseOptimizer.getInstance();

    // Analyze existing indexes first
    logger.info('Analyzing existing indexes...');
    const analysis = await optimizer.analyzeExistingIndexes();
    logger.info('Existing index analysis:', {
      collections: analysis.collections.length,
      totalIndexes: analysis.totalIndexes,
    });

    // Create optimized indexes
    logger.info('Creating optimized indexes...');
    const result = await optimizer.createAllOptimizedIndexes();

    // Log results
    logger.info('Database optimization completed:', {
      totalIndexes: result.totalIndexes,
      successful: result.successfulIndexes,
      failed: result.failedIndexes,
      executionTime: `${result.executionTime}ms`,
    });

    // Log detailed results
    if (result.failedIndexes > 0) {
      logger.warn('Failed index creations:');
      result.results
        .filter(r => !r.created)
        .forEach(r => {
          logger.warn(`  ${r.collection}: ${JSON.stringify(r.indexSpec)} - ${r.error}`);
        });
    }

    // Log successful creations
    logger.info('Successfully created indexes:');
    result.results
      .filter(r => r.created)
      .forEach(r => {
        logger.info(`  ${r.collection}: ${JSON.stringify(r.indexSpec)} (${r.executionTime}ms)`);
      });

    // Generate summary report
    const summary = {
      timestamp: new Date().toISOString(),
      totalCollections: analysis.collections.length,
      existingIndexes: analysis.totalIndexes,
      newIndexesAttempted: result.totalIndexes,
      newIndexesCreated: result.successfulIndexes,
      newIndexesFailed: result.failedIndexes,
      totalExecutionTime: result.executionTime,
      collections: result.results.reduce((acc, r) => {
        if (!acc[r.collection]) {
          acc[r.collection] = { attempted: 0, created: 0, failed: 0 };
        }
        acc[r.collection].attempted++;
        if (r.created) {
          acc[r.collection].created++;
        } else {
          acc[r.collection].failed++;
        }
        return acc;
      }, {} as Record<string, any>),
    };

    logger.info('Optimization Summary:', summary);

    // Write summary to file
    const fs = await import('fs');
    const path = await import('path');
    const summaryPath = path.join(process.cwd(), 'database-optimization-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    logger.info(`Summary written to: ${summaryPath}`);

    process.exit(0);

  } catch (error) {
    logger.error('Database optimization failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const analyze = args.includes('--analyze');

if (analyze) {
  // Just analyze existing indexes
  (async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot');
      const optimizer = PerformanceDatabaseOptimizer.getInstance();
      const analysis = await optimizer.analyzeExistingIndexes();
      console.log('Index Analysis:', JSON.stringify(analysis, null, 2));
      process.exit(0);
    } catch (error) {
      console.error('Analysis failed:', error);
      process.exit(1);
    }
  })();
} else if (dryRun) {
  logger.info('DRY RUN MODE - No indexes will be created');
  // In dry run mode, we would just log what would be created
  process.exit(0);
} else {
  // Run the optimization
  optimizeDatabaseIndexes();
}

export default optimizeDatabaseIndexes;