import mongoose from 'mongoose';
import logger from '../utils/logger';
import ClinicalNote from '../models/ClinicalNote';
import Medication from '../models/Medication';

/**
 * Clinical Notes Migration Script
 *
 * This script handles database migrations for the Clinical Notes module.
 * It ensures backward compatibility and data integrity during upgrades.
 */

interface MigrationResult {
  success: boolean;
  message: string;
  migratedCount?: number;
  errors?: string[];
}

class ClinicalNotesMigration {
  private static instance: ClinicalNotesMigration;
  private migrationVersion = '1.0.0';

  public static getInstance(): ClinicalNotesMigration {
    if (!ClinicalNotesMigration.instance) {
      ClinicalNotesMigration.instance = new ClinicalNotesMigration();
    }
    return ClinicalNotesMigration.instance;
  }

  /**
   * Run all necessary migrations for Clinical Notes
   */
  async runMigrations(): Promise<MigrationResult> {
    try {
      logger.info('Starting Clinical Notes migrations...');

      const migrations = [
        this.createIndexes.bind(this),
        this.migrateExistingNotes.bind(this),
        this.addAuditFields.bind(this),
        this.setupTextIndexes.bind(this),
        this.validateDataIntegrity.bind(this),
      ];

      let totalMigrated = 0;
      const errors: string[] = [];

      for (const migration of migrations) {
        try {
          const result = await migration();
          if (result.success) {
            totalMigrated += result.migratedCount || 0;
            logger.info(`Migration completed: ${result.message}`);
          } else {
            errors.push(result.message);
            logger.error(`Migration failed: ${result.message}`);
          }
        } catch (error) {
          const errorMessage = `Migration error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          errors.push(errorMessage);
          logger.error(errorMessage);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: `Migrations completed with ${errors.length} errors`,
          migratedCount: totalMigrated,
          errors,
        };
      }

      logger.info(
        `Clinical Notes migrations completed successfully. Total records migrated: ${totalMigrated}`
      );
      return {
        success: true,
        message: 'All migrations completed successfully',
        migratedCount: totalMigrated,
      };
    } catch (error) {
      const errorMessage = `Critical migration error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Create necessary database indexes for optimal performance
   */
  private async createIndexes(): Promise<MigrationResult> {
    try {
      const collection = mongoose.connection.db.collection('clinicalnotes');

      // Create compound indexes for efficient querying
      const indexes: Array<Record<string, 1 | -1>> = [
        // Primary filtering indexes
        { workplaceId: 1, patient: 1, deletedAt: 1 },
        { workplaceId: 1, pharmacist: 1, deletedAt: 1 },
        { workplaceId: 1, type: 1, deletedAt: 1 },
        { workplaceId: 1, priority: 1, deletedAt: 1 },
        { workplaceId: 1, isConfidential: 1, deletedAt: 1 },
        { workplaceId: 1, followUpRequired: 1, deletedAt: 1 },

        // Date-based indexes
        { workplaceId: 1, createdAt: -1, deletedAt: 1 },
        { workplaceId: 1, updatedAt: -1, deletedAt: 1 },
        { workplaceId: 1, followUpDate: 1, deletedAt: 1 },

        // Search and filtering indexes
        { workplaceId: 1, tags: 1, deletedAt: 1 },
        { workplaceId: 1, 'laborResults.status': 1, deletedAt: 1 },

        // Location-based index (sparse for optional field)
        { workplaceId: 1, locationId: 1, deletedAt: 1 },
      ];

      let createdCount = 0;
      for (const index of indexes) {
        try {
          await collection.createIndex(index, {
            background: true,
            sparse: index.locationId ? true : false,
          });
          createdCount++;
        } catch (error) {
          // Index might already exist, log but continue
          logger.warn(
            `Index creation warning: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      return {
        success: true,
        message: `Created ${createdCount} database indexes`,
        migratedCount: createdCount,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create indexes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Migrate existing clinical notes to new schema format
   */
  private async migrateExistingNotes(): Promise<MigrationResult> {
    try {
      // Find notes that need migration (missing new fields)
      const notesToMigrate = await ClinicalNote.find({
        $or: [
          { lastModifiedBy: { $exists: false } },
          { createdBy: { $exists: false } },
          { 'content.subjective': { $exists: false } },
          { 'content.objective': { $exists: false } },
          { 'content.assessment': { $exists: false } },
          { 'content.plan': { $exists: false } },
        ],
      });

      let migratedCount = 0;
      const errors: string[] = [];

      for (const note of notesToMigrate) {
        try {
          let needsUpdate = false;

          // Add missing audit fields
          if (!note.createdBy) {
            note.createdBy = note.pharmacist;
            needsUpdate = true;
          }

          if (!note.lastModifiedBy) {
            note.lastModifiedBy = note.pharmacist;
            needsUpdate = true;
          }

          // Ensure content structure exists
          if (!note.content) {
            note.content = {};
            needsUpdate = true;
          }

          // Migrate old content format if needed
          if ((note as any).description && !note.content.subjective) {
            note.content.subjective = (note as any).description;
            needsUpdate = true;
          }

          // Initialize empty arrays if missing
          if (!note.medications) {
            note.medications = [];
            needsUpdate = true;
          }

          if (!note.laborResults) {
            note.laborResults = [];
            needsUpdate = true;
          }

          if (!note.recommendations) {
            note.recommendations = [];
            needsUpdate = true;
          }

          if (!note.attachments) {
            note.attachments = [];
            needsUpdate = true;
          }

          if (!note.tags) {
            note.tags = [];
            needsUpdate = true;
          }

          // Set default values for new fields
          if (note.priority === undefined) {
            note.priority = 'medium';
            needsUpdate = true;
          }

          if (note.isConfidential === undefined) {
            note.isConfidential = false;
            needsUpdate = true;
          }

          if (note.followUpRequired === undefined) {
            note.followUpRequired = false;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await note.save();
            migratedCount++;
          }
        } catch (error) {
          const errorMessage = `Failed to migrate note ${note._id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          errors.push(errorMessage);
          logger.error(errorMessage);
        }
      }

      return {
        success: errors.length === 0,
        message: `Migrated ${migratedCount} existing notes${
          errors.length > 0 ? ` with ${errors.length} errors` : ''
        }`,
        migratedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to migrate existing notes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Add audit fields to existing notes
   */
  private async addAuditFields(): Promise<MigrationResult> {
    try {
      const result = await ClinicalNote.updateMany(
        {
          $or: [
            { createdBy: { $exists: false } },
            { lastModifiedBy: { $exists: false } },
          ],
        },
        [
          {
            $set: {
              createdBy: { $ifNull: ['$createdBy', '$pharmacist'] },
              lastModifiedBy: { $ifNull: ['$lastModifiedBy', '$pharmacist'] },
            },
          },
        ]
      );

      return {
        success: true,
        message: `Added audit fields to ${result.modifiedCount} notes`,
        migratedCount: result.modifiedCount,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add audit fields: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Setup text indexes for full-text search
   */
  private async setupTextIndexes(): Promise<MigrationResult> {
    try {
      const collection = mongoose.connection.db.collection('clinicalnotes');

      // Create text index for full-text search
      await collection.createIndex(
        {
          title: 'text',
          'content.subjective': 'text',
          'content.objective': 'text',
          'content.assessment': 'text',
          'content.plan': 'text',
          recommendations: 'text',
          tags: 'text',
        },
        {
          background: true,
          name: 'clinical_notes_text_search',
          weights: {
            title: 10,
            'content.assessment': 8,
            'content.plan': 8,
            'content.subjective': 5,
            'content.objective': 5,
            recommendations: 3,
            tags: 2,
          },
        }
      );

      return {
        success: true,
        message: 'Created text search indexes',
        migratedCount: 1,
      };
    } catch (error) {
      // Text index might already exist
      if (error instanceof Error && error.message.includes('already exists')) {
        return {
          success: true,
          message: 'Text search indexes already exist',
          migratedCount: 0,
        };
      }

      return {
        success: false,
        message: `Failed to create text indexes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Validate data integrity after migration
   */
  private async validateDataIntegrity(): Promise<MigrationResult> {
    try {
      const issues: string[] = [];

      // Check for notes without required fields
      const notesWithoutPatient = await ClinicalNote.countDocuments({
        patient: { $exists: false },
      });
      if (notesWithoutPatient > 0) {
        issues.push(`${notesWithoutPatient} notes missing patient reference`);
      }

      const notesWithoutPharmacist = await ClinicalNote.countDocuments({
        pharmacist: { $exists: false },
      });
      if (notesWithoutPharmacist > 0) {
        issues.push(
          `${notesWithoutPharmacist} notes missing pharmacist reference`
        );
      }

      const notesWithoutWorkplace = await ClinicalNote.countDocuments({
        workplaceId: { $exists: false },
      });
      if (notesWithoutWorkplace > 0) {
        issues.push(
          `${notesWithoutWorkplace} notes missing workplace reference`
        );
      }

      const notesWithoutTitle = await ClinicalNote.countDocuments({
        $or: [{ title: { $exists: false } }, { title: '' }, { title: null }],
      });
      if (notesWithoutTitle > 0) {
        issues.push(`${notesWithoutTitle} notes missing title`);
      }

      // Check for orphaned references
      const notesWithInvalidType = await ClinicalNote.countDocuments({
        type: {
          $nin: [
            'consultation',
            'medication_review',
            'follow_up',
            'adverse_event',
            'other',
          ],
        },
      });
      if (notesWithInvalidType > 0) {
        issues.push(`${notesWithInvalidType} notes with invalid type`);
      }

      const notesWithInvalidPriority = await ClinicalNote.countDocuments({
        priority: { $nin: ['low', 'medium', 'high'] },
      });
      if (notesWithInvalidPriority > 0) {
        issues.push(`${notesWithInvalidPriority} notes with invalid priority`);
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: `Data integrity issues found: ${issues.join(', ')}`,
          errors: issues,
        };
      }

      // Count total notes for verification
      const totalNotes = await ClinicalNote.countDocuments();
      const activeNotes = await ClinicalNote.countDocuments({
        deletedAt: { $exists: false },
      });
      const deletedNotes = await ClinicalNote.countDocuments({
        deletedAt: { $exists: true },
      });

      return {
        success: true,
        message: `Data integrity validation passed. Total: ${totalNotes}, Active: ${activeNotes}, Deleted: ${deletedNotes}`,
        migratedCount: totalNotes,
      };
    } catch (error) {
      return {
        success: false,
        message: `Data integrity validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Rollback migrations if needed
   */
  async rollbackMigrations(): Promise<MigrationResult> {
    try {
      logger.warn('Rolling back Clinical Notes migrations...');

      // Remove indexes created by migration
      const collection = mongoose.connection.db.collection('clinicalnotes');

      try {
        await collection.dropIndex('clinical_notes_text_search');
      } catch (error) {
        // Index might not exist
        logger.warn('Text search index not found during rollback');
      }

      // Note: We don't rollback data changes as they might be destructive
      // Instead, we log the rollback and recommend manual intervention

      logger.info('Clinical Notes migration rollback completed');
      return {
        success: true,
        message:
          'Migration rollback completed (indexes removed, data preserved)',
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    version: string;
    totalNotes: number;
    activeNotes: number;
    deletedNotes: number;
    indexesCount: number;
    lastMigration?: Date;
  }> {
    try {
      const totalNotes = await ClinicalNote.countDocuments();
      const activeNotes = await ClinicalNote.countDocuments({
        deletedAt: { $exists: false },
      });
      const deletedNotes = await ClinicalNote.countDocuments({
        deletedAt: { $exists: true },
      });

      const collection = mongoose.connection.db.collection('clinicalnotes');
      const indexes = await collection.indexes();

      return {
        version: this.migrationVersion,
        totalNotes,
        activeNotes,
        deletedNotes,
        indexesCount: indexes.length,
        lastMigration: new Date(),
      };
    } catch (error) {
      logger.error(
        `Failed to get migration status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      throw error;
    }
  }
}

export default ClinicalNotesMigration;

// Export migration functions for CLI usage
export const runClinicalNotesMigrations =
  async (): Promise<MigrationResult> => {
    const migration = ClinicalNotesMigration.getInstance();
    return await migration.runMigrations();
  };

export const rollbackClinicalNotesMigrations =
  async (): Promise<MigrationResult> => {
    const migration = ClinicalNotesMigration.getInstance();
    return await migration.rollbackMigrations();
  };

export const getClinicalNotesMigrationStatus = async () => {
  const migration = ClinicalNotesMigration.getInstance();
  return await migration.getMigrationStatus();
};
