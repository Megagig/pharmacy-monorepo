/**
 * Patient Engagement Database Index Optimizer
 * Creates and manages optimized indexes for appointment and follow-up queries
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import mongoose from 'mongoose';
import Appointment from '../models/Appointment';
import FollowUpTask from '../models/FollowUpTask';
import PharmacistSchedule from '../models/PharmacistSchedule';
import ReminderTemplate from '../models/ReminderTemplate';
import logger from '../utils/logger';

export interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1 | 'text'>;
  options?: mongoose.IndexOptions;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedUsage: number; // Percentage of queries that would use this index
}

export interface IndexAnalysis {
  collection: string;
  indexName: string;
  usage: {
    ops: number;
    since: Date;
  };
  size: number;
  effectiveness: number; // 0-100 score
  recommendation: 'keep' | 'drop' | 'modify';
}

/**
 * Database index optimizer for Patient Engagement module
 */
export class PatientEngagementIndexOptimizer {
  private static instance: PatientEngagementIndexOptimizer;

  static getInstance(): PatientEngagementIndexOptimizer {
    if (!PatientEngagementIndexOptimizer.instance) {
      PatientEngagementIndexOptimizer.instance = new PatientEngagementIndexOptimizer();
    }
    return PatientEngagementIndexOptimizer.instance;
  }

  /**
   * Create all optimized indexes for patient engagement
   */
  async createOptimizedIndexes(): Promise<void> {
    logger.info('Creating optimized indexes for Patient Engagement module...');

    const indexes = this.getOptimizedIndexDefinitions();
    
    // Sort by priority (high first)
    const sortedIndexes = indexes.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const indexDef of sortedIndexes) {
      try {
        await this.createIndex(indexDef);
        created++;
        logger.debug(`Created index: ${indexDef.description}`);
      } catch (error: any) {
        if (error.code === 85) { // Index already exists
          skipped++;
          logger.debug(`Index already exists: ${indexDef.description}`);
        } else {
          failed++;
          logger.error(`Failed to create index: ${indexDef.description}`, {
            error: error.message,
            collection: indexDef.collection,
          });
        }
      }
    }

    logger.info('Index creation completed', {
      total: indexes.length,
      created,
      skipped,
      failed,
    });
  }

  /**
   * Analyze existing indexes and provide recommendations
   */
  async analyzeIndexes(): Promise<IndexAnalysis[]> {
    logger.info('Analyzing Patient Engagement indexes...');

    const collections = ['appointments', 'followuptasks', 'pharmacistschedules', 'remindertemplates'];
    const analyses: IndexAnalysis[] = [];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (!collection) continue;

        const indexes = await collection.listIndexes().toArray();
        
        for (const index of indexes) {
          if (index.name === '_id_') continue; // Skip default index

          const analysis = await this.analyzeIndex(collectionName, index);
          analyses.push(analysis);
        }
      } catch (error) {
        logger.error(`Failed to analyze indexes for ${collectionName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return analyses;
  }

  /**
   * Drop unused or ineffective indexes
   */
  async optimizeExistingIndexes(): Promise<void> {
    logger.info('Optimizing existing indexes...');

    const analyses = await this.analyzeIndexes();
    const toRemove = analyses.filter(a => a.recommendation === 'drop');

    let removed = 0;
    let failed = 0;

    for (const analysis of toRemove) {
      try {
        const collection = mongoose.connection.db?.collection(analysis.collection);
        if (collection) {
          await collection.dropIndex(analysis.indexName);
          removed++;
          logger.info(`Dropped ineffective index: ${analysis.indexName} on ${analysis.collection}`);
        }
      } catch (error) {
        failed++;
        logger.error(`Failed to drop index: ${analysis.indexName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Index optimization completed', {
      analyzed: analyses.length,
      removed,
      failed,
    });
  }

  /**
   * Get performance statistics for indexes
   */
  async getIndexPerformanceStats(): Promise<any> {
    const stats = {
      collections: {} as Record<string, any>,
      summary: {
        totalIndexes: 0,
        totalSize: 0,
        avgEffectiveness: 0,
      },
    };

    const collections = ['appointments', 'followuptasks', 'pharmacistschedules', 'remindertemplates'];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (!collection) continue;

        const indexStats = await collection.stats();
        const indexes = await collection.listIndexes().toArray();

        stats.collections[collectionName] = {
          documentCount: indexStats.count || 0,
          indexCount: indexes.length,
          totalIndexSize: indexStats.totalIndexSize || 0,
          indexes: indexes.map(idx => ({
            name: idx.name,
            keys: idx.key,
            size: idx.size || 0,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
          })),
        };

        stats.summary.totalIndexes += indexes.length;
        stats.summary.totalSize += indexStats.totalIndexSize || 0;
      } catch (error) {
        logger.error(`Failed to get stats for ${collectionName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return stats;
  }

  /**
   * Create query-specific indexes based on common patterns
   */
  async createQuerySpecificIndexes(): Promise<void> {
    logger.info('Creating query-specific indexes...');

    const queryPatterns = this.getCommonQueryPatterns();
    
    for (const pattern of queryPatterns) {
      try {
        await this.createIndex(pattern);
        logger.debug(`Created query-specific index: ${pattern.description}`);
      } catch (error: any) {
        if (error.code !== 85) { // Ignore "already exists" errors
          logger.error(`Failed to create query-specific index: ${pattern.description}`, {
            error: error.message,
          });
        }
      }
    }
  }

  // Private methods

  private getOptimizedIndexDefinitions(): IndexDefinition[] {
    return [
      // Appointment indexes (high priority)
      {
        collection: 'appointments',
        index: { workplaceId: 1, scheduledDate: 1, status: 1 },
        options: { background: true },
        description: 'Compound index for workplace appointments by date and status',
        priority: 'high',
        estimatedUsage: 85,
      },
      {
        collection: 'appointments',
        index: { workplaceId: 1, assignedTo: 1, scheduledDate: 1 },
        options: { background: true },
        description: 'Compound index for pharmacist appointments by date',
        priority: 'high',
        estimatedUsage: 80,
      },
      {
        collection: 'appointments',
        index: { workplaceId: 1, patientId: 1, scheduledDate: -1 },
        options: { background: true },
        description: 'Compound index for patient appointment history',
        priority: 'high',
        estimatedUsage: 75,
      },
      {
        collection: 'appointments',
        index: { workplaceId: 1, type: 1, status: 1 },
        options: { background: true },
        description: 'Compound index for appointment type filtering',
        priority: 'medium',
        estimatedUsage: 60,
      },
      {
        collection: 'appointments',
        index: { workplaceId: 1, locationId: 1, scheduledDate: 1 },
        options: { background: true, sparse: true },
        description: 'Compound index for location-based appointment queries',
        priority: 'medium',
        estimatedUsage: 40,
      },
      {
        collection: 'appointments',
        index: { recurringSeriesId: 1, scheduledDate: 1 },
        options: { background: true, sparse: true },
        description: 'Index for recurring appointment series',
        priority: 'medium',
        estimatedUsage: 30,
      },
      {
        collection: 'appointments',
        index: { status: 1, scheduledDate: 1 },
        options: { background: true },
        description: 'Index for overdue appointment monitoring',
        priority: 'medium',
        estimatedUsage: 50,
      },
      {
        collection: 'appointments',
        index: { 'reminders.scheduledFor': 1, 'reminders.sent': 1 },
        options: { background: true },
        description: 'Index for reminder processing',
        priority: 'high',
        estimatedUsage: 70,
      },

      // FollowUpTask indexes (high priority)
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, status: 1, dueDate: 1 },
        options: { background: true },
        description: 'Compound index for follow-up task queries by status and due date',
        priority: 'high',
        estimatedUsage: 90,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, assignedTo: 1, status: 1, priority: -1 },
        options: { background: true },
        description: 'Compound index for pharmacist task assignment with priority',
        priority: 'high',
        estimatedUsage: 85,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, patientId: 1, status: 1 },
        options: { background: true },
        description: 'Compound index for patient follow-up tasks',
        priority: 'high',
        estimatedUsage: 75,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, type: 1, status: 1 },
        options: { background: true },
        description: 'Compound index for follow-up type filtering',
        priority: 'medium',
        estimatedUsage: 60,
      },
      {
        collection: 'followuptasks',
        index: { status: 1, dueDate: 1 },
        options: { background: true },
        description: 'Index for overdue task monitoring',
        priority: 'high',
        estimatedUsage: 80,
      },
      {
        collection: 'followuptasks',
        index: { 'trigger.type': 1, 'trigger.sourceId': 1 },
        options: { background: true },
        description: 'Index for trigger-based follow-up queries',
        priority: 'medium',
        estimatedUsage: 45,
      },

      // PharmacistSchedule indexes (medium priority)
      {
        collection: 'pharmacistschedules',
        index: { workplaceId: 1, pharmacistId: 1, isActive: 1 },
        options: { background: true },
        description: 'Compound index for active pharmacist schedules',
        priority: 'medium',
        estimatedUsage: 70,
      },
      {
        collection: 'pharmacistschedules',
        index: { workplaceId: 1, locationId: 1, isActive: 1 },
        options: { background: true, sparse: true },
        description: 'Compound index for location-based schedule queries',
        priority: 'medium',
        estimatedUsage: 40,
      },
      {
        collection: 'pharmacistschedules',
        index: { pharmacistId: 1, effectiveFrom: 1, effectiveTo: 1 },
        options: { background: true },
        description: 'Index for schedule effective date ranges',
        priority: 'medium',
        estimatedUsage: 60,
      },

      // ReminderTemplate indexes (low priority)
      {
        collection: 'remindertemplates',
        index: { workplaceId: 1, type: 1, isActive: 1 },
        options: { background: true },
        description: 'Compound index for active reminder templates by type',
        priority: 'low',
        estimatedUsage: 50,
      },
      {
        collection: 'remindertemplates',
        index: { workplaceId: 1, isDefault: 1 },
        options: { background: true },
        description: 'Index for default reminder templates',
        priority: 'low',
        estimatedUsage: 30,
      },

      // Text search indexes
      {
        collection: 'appointments',
        index: { title: 'text', description: 'text' },
        options: { background: true },
        description: 'Full-text search index for appointments',
        priority: 'low',
        estimatedUsage: 20,
      },
      {
        collection: 'followuptasks',
        index: { title: 'text', description: 'text' },
        options: { background: true },
        description: 'Full-text search index for follow-up tasks',
        priority: 'low',
        estimatedUsage: 25,
      },

      // Analytics indexes
      {
        collection: 'appointments',
        index: { workplaceId: 1, createdAt: -1 },
        options: { background: true },
        description: 'Index for appointment creation analytics',
        priority: 'medium',
        estimatedUsage: 40,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, createdAt: -1 },
        options: { background: true },
        description: 'Index for follow-up creation analytics',
        priority: 'medium',
        estimatedUsage: 40,
      },
    ];
  }

  private getCommonQueryPatterns(): IndexDefinition[] {
    return [
      // Calendar view queries
      {
        collection: 'appointments',
        index: { workplaceId: 1, scheduledDate: 1, scheduledTime: 1 },
        options: { background: true },
        description: 'Index for calendar view queries with time sorting',
        priority: 'high',
        estimatedUsage: 85,
      },

      // Dashboard queries
      {
        collection: 'appointments',
        index: { workplaceId: 1, status: 1, scheduledDate: 1 },
        options: { background: true },
        description: 'Index for dashboard appointment summaries',
        priority: 'high',
        estimatedUsage: 80,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, status: 1, priority: -1, dueDate: 1 },
        options: { background: true },
        description: 'Index for dashboard follow-up summaries with priority',
        priority: 'high',
        estimatedUsage: 85,
      },

      // Search and filter queries
      {
        collection: 'appointments',
        index: { workplaceId: 1, patientId: 1, type: 1, status: 1 },
        options: { background: true },
        description: 'Index for complex appointment filtering',
        priority: 'medium',
        estimatedUsage: 55,
      },
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, assignedTo: 1, type: 1, priority: 1 },
        options: { background: true },
        description: 'Index for complex follow-up filtering',
        priority: 'medium',
        estimatedUsage: 60,
      },

      // Notification and reminder queries
      {
        collection: 'appointments',
        index: { 'reminders.scheduledFor': 1, 'reminders.sent': 1, status: 1 },
        options: { background: true },
        description: 'Index for reminder processing with appointment status',
        priority: 'high',
        estimatedUsage: 75,
      },

      // Capacity and utilization queries
      {
        collection: 'appointments',
        index: { workplaceId: 1, assignedTo: 1, scheduledDate: 1, duration: 1 },
        options: { background: true },
        description: 'Index for capacity utilization calculations',
        priority: 'medium',
        estimatedUsage: 50,
      },
    ];
  }

  private async createIndex(indexDef: IndexDefinition): Promise<void> {
    const collection = mongoose.connection.db?.collection(indexDef.collection);
    if (!collection) {
      throw new Error(`Collection ${indexDef.collection} not found`);
    }

    await collection.createIndex(indexDef.index, indexDef.options || {});
  }

  private async analyzeIndex(collectionName: string, index: any): Promise<IndexAnalysis> {
    // This is a simplified analysis - in a real implementation,
    // you would use MongoDB's $indexStats aggregation stage
    const analysis: IndexAnalysis = {
      collection: collectionName,
      indexName: index.name,
      usage: {
        ops: 0,
        since: new Date(),
      },
      size: index.size || 0,
      effectiveness: 50, // Default score
      recommendation: 'keep',
    };

    // Analyze index effectiveness based on key patterns
    const keyCount = Object.keys(index.key || {}).length;
    
    // Single field indexes are less effective for complex queries
    if (keyCount === 1) {
      analysis.effectiveness = 40;
    }
    
    // Compound indexes with good field order are more effective
    if (keyCount > 1 && keyCount <= 4) {
      analysis.effectiveness = 80;
    }
    
    // Too many fields can reduce effectiveness
    if (keyCount > 4) {
      analysis.effectiveness = 60;
    }

    // Text indexes are specialized
    if (Object.values(index.key || {}).includes('text')) {
      analysis.effectiveness = 70;
    }

    // Determine recommendation based on effectiveness and usage
    if (analysis.effectiveness < 30 && analysis.usage.ops < 100) {
      analysis.recommendation = 'drop';
    } else if (analysis.effectiveness < 50) {
      analysis.recommendation = 'modify';
    }

    return analysis;
  }

  /**
   * Monitor index usage and performance
   */
  async monitorIndexPerformance(): Promise<void> {
    logger.info('Starting index performance monitoring...');

    try {
      const collections = ['appointments', 'followuptasks', 'pharmacistschedules'];
      
      for (const collectionName of collections) {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (!collection) continue;

        // Get index statistics
        const indexStats = await collection.aggregate([
          { $indexStats: {} }
        ]).toArray();

        for (const stat of indexStats) {
          const usage = stat.accesses?.ops || 0;
          const since = stat.accesses?.since || new Date();

          logger.debug('Index usage statistics', {
            collection: collectionName,
            index: stat.name,
            usage,
            since,
          });

          // Log underutilized indexes
          if (usage < 10 && stat.name !== '_id_') {
            logger.warn('Underutilized index detected', {
              collection: collectionName,
              index: stat.name,
              usage,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to monitor index performance', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create partial indexes for specific use cases
   */
  async createPartialIndexes(): Promise<void> {
    logger.info('Creating partial indexes for specific use cases...');

    const partialIndexes: IndexDefinition[] = [
      // Index only active appointments
      {
        collection: 'appointments',
        index: { workplaceId: 1, scheduledDate: 1 },
        options: {
          background: true,
          partialFilterExpression: {
            status: { $nin: ['cancelled', 'no_show'] }
          }
        },
        description: 'Partial index for active appointments only',
        priority: 'medium',
        estimatedUsage: 70,
      },

      // Index only pending/overdue follow-ups
      {
        collection: 'followuptasks',
        index: { workplaceId: 1, dueDate: 1, priority: -1 },
        options: {
          background: true,
          partialFilterExpression: {
            status: { $in: ['pending', 'in_progress', 'overdue'] }
          }
        },
        description: 'Partial index for active follow-up tasks only',
        priority: 'medium',
        estimatedUsage: 75,
      },

      // Index only recurring appointments
      {
        collection: 'appointments',
        index: { recurringSeriesId: 1, scheduledDate: 1 },
        options: {
          background: true,
          partialFilterExpression: {
            isRecurring: true
          }
        },
        description: 'Partial index for recurring appointments only',
        priority: 'low',
        estimatedUsage: 25,
      },
    ];

    for (const indexDef of partialIndexes) {
      try {
        await this.createIndex(indexDef);
        logger.debug(`Created partial index: ${indexDef.description}`);
      } catch (error: any) {
        if (error.code !== 85) {
          logger.error(`Failed to create partial index: ${indexDef.description}`, {
            error: error.message,
          });
        }
      }
    }
  }
}

export default PatientEngagementIndexOptimizer.getInstance();