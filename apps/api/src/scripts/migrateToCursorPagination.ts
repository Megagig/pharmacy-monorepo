#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

/**
 * Migration script to help transition from skip/limit to cursor-based pagination
 * This script analyzes existing pagination usage and provides recommendations
 */

interface PaginationAnalysis {
  collection: string;
  totalDocuments: number;
  averageDocumentSize: number;
  indexesOnSortFields: string[];
  recommendedSortField: string;
  estimatedPerformanceGain: string;
  migrationComplexity: 'low' | 'medium' | 'high';
}

async function analyzePaginationPerformance() {
  try {
    logger.info('Starting pagination performance analysis');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const analyses: PaginationAnalysis[] = [];

    // Analyze key collections that benefit from cursor pagination
    const keyCollections = [
      'patients',
      'clinicalnotes', 
      'medications',
      'auditlogs',
      'messages',
      'notifications',
      'medicationtherapyreviews',
      'clinicalinterventions'
    ];

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      if (!keyCollections.includes(collectionName)) {
        continue;
      }

      try {
        const collection = db.collection(collectionName);
        
        // Get collection stats
        const stats = await collection.stats();
        const indexes = await collection.indexes();
        
        // Analyze indexes on common sort fields
        const sortFields = ['createdAt', 'updatedAt', '_id', 'timestamp'];
        const indexesOnSortFields = indexes
          .filter(index => {
            const keys = Object.keys(index.key);
            return sortFields.some(field => keys.includes(field));
          })
          .map(index => Object.keys(index.key).join(', '));

        // Determine recommended sort field
        let recommendedSortField = 'createdAt';
        if (indexesOnSortFields.some(idx => idx.includes('createdAt'))) {
          recommendedSortField = 'createdAt';
        } else if (indexesOnSortFields.some(idx => idx.includes('updatedAt'))) {
          recommendedSortField = 'updatedAt';
        } else if (indexesOnSortFields.some(idx => idx.includes('timestamp'))) {
          recommendedSortField = 'timestamp';
        } else {
          recommendedSortField = '_id';
        }

        // Estimate performance gain based on collection size
        let estimatedPerformanceGain = 'minimal';
        let migrationComplexity: 'low' | 'medium' | 'high' = 'low';

        if (stats.count > 100000) {
          estimatedPerformanceGain = 'significant (50-80% faster for large offsets)';
          migrationComplexity = 'medium';
        } else if (stats.count > 10000) {
          estimatedPerformanceGain = 'moderate (20-50% faster for large offsets)';
          migrationComplexity = 'low';
        } else if (stats.count > 1000) {
          estimatedPerformanceGain = 'small (10-20% faster for large offsets)';
          migrationComplexity = 'low';
        }

        // Increase complexity if no proper indexes exist
        if (indexesOnSortFields.length === 0) {
          migrationComplexity = 'high';
        }

        const analysis: PaginationAnalysis = {
          collection: collectionName,
          totalDocuments: stats.count,
          averageDocumentSize: Math.round(stats.avgObjSize || 0),
          indexesOnSortFields,
          recommendedSortField,
          estimatedPerformanceGain,
          migrationComplexity,
        };

        analyses.push(analysis);

        logger.info(`Analyzed collection: ${collectionName}`, {
          documents: stats.count,
          avgSize: analysis.averageDocumentSize,
          indexes: indexesOnSortFields.length,
        });

      } catch (error) {
        logger.warn(`Failed to analyze collection ${collectionName}:`, error);
      }
    }

    // Generate migration report
    const report = {
      timestamp: new Date().toISOString(),
      totalCollectionsAnalyzed: analyses.length,
      summary: {
        highPriorityMigrations: analyses.filter(a => 
          a.totalDocuments > 10000 && a.migrationComplexity !== 'high'
        ).length,
        mediumPriorityMigrations: analyses.filter(a => 
          a.totalDocuments > 1000 && a.totalDocuments <= 10000
        ).length,
        lowPriorityMigrations: analyses.filter(a => 
          a.totalDocuments <= 1000
        ).length,
        complexMigrations: analyses.filter(a => 
          a.migrationComplexity === 'high'
        ).length,
      },
      collections: analyses,
      recommendations: generateRecommendations(analyses),
    };

    // Log summary
    logger.info('Pagination Analysis Summary:', report.summary);

    // Write detailed report to file
    const fs = await import('fs');
    const path = await import('path');
    const reportPath = path.join(process.cwd(), 'cursor-pagination-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.info(`Detailed report written to: ${reportPath}`);

    // Print recommendations
    console.log('\n=== CURSOR PAGINATION MIGRATION RECOMMENDATIONS ===\n');
    
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log('\n=== COLLECTION ANALYSIS ===\n');
    
    analyses
      .sort((a, b) => b.totalDocuments - a.totalDocuments)
      .forEach(analysis => {
        console.log(`Collection: ${analysis.collection}`);
        console.log(`  Documents: ${analysis.totalDocuments.toLocaleString()}`);
        console.log(`  Avg Size: ${analysis.averageDocumentSize} bytes`);
        console.log(`  Sort Indexes: ${analysis.indexesOnSortFields.join(', ') || 'None'}`);
        console.log(`  Recommended Sort: ${analysis.recommendedSortField}`);
        console.log(`  Performance Gain: ${analysis.estimatedPerformanceGain}`);
        console.log(`  Migration Complexity: ${analysis.migrationComplexity}`);
        console.log('');
      });

    process.exit(0);

  } catch (error) {
    logger.error('Pagination analysis failed:', error);
    process.exit(1);
  }
}

function generateRecommendations(analyses: PaginationAnalysis[]): string[] {
  const recommendations: string[] = [];

  // High priority collections
  const highPriority = analyses.filter(a => 
    a.totalDocuments > 10000 && a.migrationComplexity !== 'high'
  );

  if (highPriority.length > 0) {
    recommendations.push(
      `HIGH PRIORITY: Migrate ${highPriority.map(a => a.collection).join(', ')} to cursor pagination immediately. These collections have >10k documents and will see significant performance improvements.`
    );
  }

  // Collections needing indexes
  const needIndexes = analyses.filter(a => a.indexesOnSortFields.length === 0);
  
  if (needIndexes.length > 0) {
    recommendations.push(
      `CREATE INDEXES: Add indexes on sort fields for ${needIndexes.map(a => a.collection).join(', ')} before migrating to cursor pagination.`
    );
  }

  // Medium priority collections
  const mediumPriority = analyses.filter(a => 
    a.totalDocuments > 1000 && a.totalDocuments <= 10000 && a.migrationComplexity === 'low'
  );

  if (mediumPriority.length > 0) {
    recommendations.push(
      `MEDIUM PRIORITY: Consider migrating ${mediumPriority.map(a => a.collection).join(', ')} to cursor pagination for better scalability.`
    );
  }

  // API compatibility
  recommendations.push(
    'BACKWARD COMPATIBILITY: Implement dual pagination support (cursor + legacy skip/limit) to maintain API compatibility during transition.'
  );

  // Frontend updates
  recommendations.push(
    'FRONTEND UPDATES: Update frontend pagination components to use cursor-based pagination for better user experience with large datasets.'
  );

  // Monitoring
  recommendations.push(
    'MONITORING: Set up performance monitoring to track pagination performance improvements after migration.'
  );

  return recommendations;
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Cursor Pagination Migration Analysis Tool

Usage:
  npm run db:analyze-pagination              # Run full analysis
  npm run db:analyze-pagination -- --help   # Show this help

This tool analyzes your MongoDB collections and provides recommendations
for migrating from skip/limit to cursor-based pagination.

The analysis includes:
- Collection sizes and document counts
- Existing indexes on sort fields
- Estimated performance improvements
- Migration complexity assessment
- Prioritized recommendations

Output:
- Console summary with recommendations
- Detailed JSON report: cursor-pagination-analysis.json
  `);
  process.exit(0);
}

// Run the analysis
analyzePaginationPerformance();

export default analyzePaginationPerformance;