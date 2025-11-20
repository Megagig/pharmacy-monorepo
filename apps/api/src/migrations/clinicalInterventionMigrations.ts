/**
 * Database Migration Scripts for Clinical Interventions Module
 * Handles schema updates and data migrations for production deployment
 */

import mongoose from 'mongoose';
import logger from '../utils/logger';
import ClinicalIntervention from '../models/ClinicalIntervention';

export interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export interface MigrationRecord {
  version: string;
  description: string;
  appliedAt: Date;
  executionTime: number;
}

/**
 * Migration tracking collection
 */
const migrationSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  appliedAt: { type: Date, required: true, default: Date.now },
  executionTime: { type: Number, required: true }, // milliseconds
});

const MigrationModel = mongoose.model('Migration', migrationSchema);

/**
 * Clinical Interventions Module Migrations
 */
export const clinicalInterventionMigrations: Migration[] = [
  {
    version: '1.0.0',
    description: 'Initial Clinical Interventions schema setup',
    up: async () => {
      logger.info('Creating Clinical Interventions collection and indexes...');

      // Ensure collection exists
      await ClinicalIntervention.createCollection();

      // Create optimized indexes
      const indexes = [
        { workplaceId: 1, isDeleted: 1, status: 1, identifiedDate: -1 },
        { workplaceId: 1, patientId: 1, isDeleted: 1, identifiedDate: -1 },
        { 'assignments.userId': 1, 'assignments.status': 1, workplaceId: 1 },
        { workplaceId: 1, category: 1, priority: 1, status: 1 },
        { workplaceId: 1, interventionNumber: 1 },
      ];

      for (const index of indexes) {
        // Filter out undefined values from index specification
        const cleanIndex = Object.fromEntries(
          Object.entries(index).filter(([_, value]) => value !== undefined)
        );
        await ClinicalIntervention.collection.createIndex(cleanIndex, {
          background: true,
        });
      }

      logger.info('Clinical Interventions indexes created successfully');
    },
    down: async () => {
      logger.info('Dropping Clinical Interventions collection...');
      await ClinicalIntervention.collection.drop();
    },
  },

  {
    version: '1.1.0',
    description: 'Add text search indexes for Clinical Interventions',
    up: async () => {
      logger.info('Adding text search indexes...');

      await ClinicalIntervention.collection.createIndex(
        {
          interventionNumber: 'text',
          issueDescription: 'text',
          implementationNotes: 'text',
        },
        {
          name: 'intervention_text_search',
          background: true,
        }
      );

      logger.info('Text search indexes created successfully');
    },
    down: async () => {
      logger.info('Dropping text search indexes...');
      await ClinicalIntervention.collection.dropIndex(
        'intervention_text_search'
      );
    },
  },

  {
    version: '1.2.0',
    description: 'Add performance optimization indexes',
    up: async () => {
      logger.info('Adding performance optimization indexes...');

      const performanceIndexes = [
        {
          fields: { workplaceId: 1, status: 1, priority: 1, startedAt: 1 },
          options: {
            name: 'overdue_interventions',
            background: true,
            partialFilterExpression: {
              status: {
                $in: ['identified', 'planning', 'in_progress', 'implemented'],
              },
            },
          },
        },
        {
          fields: {
            workplaceId: 1,
            'followUp.scheduledDate': 1,
            'followUp.required': 1,
          },
          options: {
            name: 'followup_scheduling',
            background: true,
            sparse: true,
            partialFilterExpression: {
              'followUp.required': true,
              'followUp.scheduledDate': { $exists: true },
            },
          },
        },
        {
          fields: { workplaceId: 1, relatedMTRId: 1, isDeleted: 1 },
          options: {
            name: 'mtr_integration',
            background: true,
            sparse: true,
          },
        },
      ];

      for (const { fields, options } of performanceIndexes) {
        // Filter out undefined values from index specification
        const cleanFields = Object.fromEntries(
          Object.entries(fields).filter(([_, value]) => value !== undefined)
        );
        await ClinicalIntervention.collection.createIndex(cleanFields, options);
      }

      logger.info('Performance optimization indexes created successfully');
    },
    down: async () => {
      logger.info('Dropping performance optimization indexes...');
      const indexesToDrop = [
        'overdue_interventions',
        'followup_scheduling',
        'mtr_integration',
      ];

      for (const indexName of indexesToDrop) {
        try {
          await ClinicalIntervention.collection.dropIndex(indexName);
        } catch (error) {
          logger.warn(`Failed to drop index ${indexName}:`, error);
        }
      }
    },
  },

  {
    version: '1.3.0',
    description: 'Migrate existing intervention data to new schema format',
    up: async () => {
      logger.info('Migrating existing intervention data...');

      // Find interventions that need migration
      const interventionsToMigrate = await ClinicalIntervention.find({
        $or: [
          { interventionNumber: { $exists: false } },
          { interventionNumber: { $regex: /^(?!CI-)/ } }, // Not in CI-YYYYMM-XXXX format
        ],
      });

      logger.info(
        `Found ${interventionsToMigrate.length} interventions to migrate`
      );

      for (const intervention of interventionsToMigrate) {
        try {
          // Generate new intervention number if missing or invalid
          if (
            !intervention.interventionNumber ||
            !intervention.interventionNumber.match(/^CI-\d{6}-\d{4}$/)
          ) {
            const newNumber =
              await ClinicalIntervention.generateNextInterventionNumber(
                intervention.workplaceId
              );
            intervention.interventionNumber = newNumber;
          }

          // Ensure followUp object exists
          if (!intervention.followUp) {
            intervention.followUp = { required: false };
          }

          // Ensure relatedDTPIds array exists
          if (!intervention.relatedDTPIds) {
            intervention.relatedDTPIds = [];
          }

          // Ensure strategies array exists
          if (!intervention.strategies) {
            intervention.strategies = [];
          }

          // Ensure assignments array exists
          if (!intervention.assignments) {
            intervention.assignments = [];
          }

          await intervention.save();
          logger.debug(`Migrated intervention ${intervention._id}`);
        } catch (error) {
          logger.error(
            `Failed to migrate intervention ${intervention._id}:`,
            error
          );
        }
      }

      logger.info('Data migration completed successfully');
    },
    down: async () => {
      logger.warn(
        'Data migration rollback not implemented - manual intervention required'
      );
    },
  },

  {
    version: '1.4.0',
    description: 'Add audit trail enhancements',
    up: async () => {
      logger.info('Adding audit trail enhancements...');

      // Update existing interventions to ensure audit fields
      const result = await ClinicalIntervention.updateMany(
        { createdBy: { $exists: false } },
        {
          $set: {
            createdBy: new mongoose.Types.ObjectId('000000000000000000000000'), // Placeholder
            isDeleted: false,
          },
        }
      );

      logger.info(
        `Updated ${result.modifiedCount} interventions with audit fields`
      );
    },
    down: async () => {
      logger.info('Removing audit trail enhancements...');

      await ClinicalIntervention.updateMany(
        {},
        {
          $unset: {
            createdBy: 1,
            updatedBy: 1,
            isDeleted: 1,
          },
        }
      );
    },
  },

  {
    version: '1.5.0',
    description: 'Optimize intervention number generation',
    up: async () => {
      logger.info('Optimizing intervention number generation...');

      // Create compound unique index for intervention numbers
      await ClinicalIntervention.collection.createIndex(
        { workplaceId: 1, interventionNumber: 1 },
        {
          name: 'unique_intervention_number_per_workplace',
          unique: true,
          background: true,
        }
      );

      logger.info('Intervention number optimization completed');
    },
    down: async () => {
      logger.info('Removing intervention number optimization...');

      try {
        await ClinicalIntervention.collection.dropIndex(
          'unique_intervention_number_per_workplace'
        );
      } catch (error) {
        logger.warn('Failed to drop unique intervention number index:', error);
      }
    },
  },
];

/**
 * Migration Manager
 */
export class MigrationManager {
  /**
   * Get applied migrations
   */
  static async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      return await MigrationModel.find({}).sort({ appliedAt: 1 }).lean();
    } catch (error) {
      logger.error('Failed to get applied migrations:', error);
      return [];
    }
  }

  /**
   * Get pending migrations
   */
  static async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));

    return clinicalInterventionMigrations.filter(
      (migration) => !appliedVersions.has(migration.version)
    );
  }

  /**
   * Apply a single migration
   */
  static async applyMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        `Applying migration ${migration.version}: ${migration.description}`
      );

      await migration.up();

      const executionTime = Date.now() - startTime;

      // Record migration
      await MigrationModel.create({
        version: migration.version,
        description: migration.description,
        appliedAt: new Date(),
        executionTime,
      });

      logger.info(
        `Migration ${migration.version} applied successfully in ${executionTime}ms`
      );
    } catch (error) {
      logger.error(`Failed to apply migration ${migration.version}:`, error);
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  static async rollbackMigration(version: string): Promise<void> {
    const migration = clinicalInterventionMigrations.find(
      (m) => m.version === version
    );
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    const startTime = Date.now();

    try {
      logger.info(
        `Rolling back migration ${version}: ${migration.description}`
      );

      await migration.down();

      // Remove migration record
      await MigrationModel.deleteOne({ version });

      const executionTime = Date.now() - startTime;
      logger.info(
        `Migration ${version} rolled back successfully in ${executionTime}ms`
      );
    } catch (error) {
      logger.error(`Failed to rollback migration ${version}:`, error);
      throw error;
    }
  }

  /**
   * Apply all pending migrations
   */
  static async applyPendingMigrations(): Promise<void> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      logger.info('No pending migrations to apply');
      return;
    }

    logger.info(`Applying ${pending.length} pending migrations...`);

    for (const migration of pending) {
      await this.applyMigration(migration);
    }

    logger.info('All pending migrations applied successfully');
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      applied,
      pending,
      total: clinicalInterventionMigrations.length,
    };
  }

  /**
   * Validate migration integrity
   */
  static async validateMigrations(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check for duplicate versions
      const versions = clinicalInterventionMigrations.map((m) => m.version);
      const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
      if (duplicates.length > 0) {
        issues.push(`Duplicate migration versions: ${duplicates.join(', ')}`);
      }

      // Check version ordering
      const sortedVersions = [...versions].sort();
      if (JSON.stringify(versions) !== JSON.stringify(sortedVersions)) {
        issues.push('Migration versions are not in order');
      }

      // Check applied migrations exist in code
      const applied = await this.getAppliedMigrations();
      const codeVersions = new Set(versions);

      for (const appliedMigration of applied) {
        if (!codeVersions.has(appliedMigration.version)) {
          issues.push(
            `Applied migration ${appliedMigration.version} not found in code`
          );
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(
        `Validation error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { valid: false, issues };
    }
  }
}

/**
 * CLI Migration Runner
 */
export const runMigrations = async (
  command: string,
  version?: string
): Promise<void> => {
  try {
    switch (command) {
      case 'status':
        const status = await MigrationManager.getMigrationStatus();
        console.log('Migration Status:');
        console.log(`Applied: ${status.applied.length}/${status.total}`);
        console.log(`Pending: ${status.pending.length}`);

        if (status.pending.length > 0) {
          console.log('\nPending migrations:');
          status.pending.forEach((m) => {
            console.log(`  ${m.version}: ${m.description}`);
          });
        }
        break;

      case 'up':
        if (version) {
          const migration = clinicalInterventionMigrations.find(
            (m) => m.version === version
          );
          if (!migration) {
            throw new Error(`Migration ${version} not found`);
          }
          await MigrationManager.applyMigration(migration);
        } else {
          await MigrationManager.applyPendingMigrations();
        }
        break;

      case 'down':
        if (!version) {
          throw new Error('Version required for rollback');
        }
        await MigrationManager.rollbackMigration(version);
        break;

      case 'validate':
        const validation = await MigrationManager.validateMigrations();
        if (validation.valid) {
          console.log('All migrations are valid');
        } else {
          console.error('Migration validation failed:');
          validation.issues.forEach((issue) => console.error(`  - ${issue}`));
          process.exit(1);
        }
        break;

      default:
        console.error('Unknown command. Use: status, up, down, validate');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Migration command failed:', error);
    process.exit(1);
  }
};

// Export for CLI usage
if (require.main === module) {
  const [, , command, version] = process.argv;
  runMigrations(command || 'status', version);
}
