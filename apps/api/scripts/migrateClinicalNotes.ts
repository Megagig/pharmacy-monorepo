#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import { config } from 'dotenv';
import logger from '../src/utils/logger';
import {
    runClinicalNotesMigrations,
    rollbackClinicalNotesMigrations,
    getClinicalNotesMigrationStatus,
} from '../src/migrations/clinicalNotesMigration';

// Load environment variables
config();

/**
 * Clinical Notes Migration CLI
 * 
 * Usage:
 *   npm run migrate:clinical-notes
 *   npm run migrate:clinical-notes -- --rollback
 *   npm run migrate:clinical-notes -- --status
 */

interface CliOptions {
    rollback?: boolean;
    status?: boolean;
    help?: boolean;
    force?: boolean;
    dryRun?: boolean;
}

class ClinicalNotesMigrationCLI {
    private options: CliOptions = {};

    constructor() {
        this.parseArguments();
    }

    private parseArguments(): void {
        const args = process.argv.slice(2);

        for (const arg of args) {
            switch (arg) {
                case '--rollback':
                case '-r':
                    this.options.rollback = true;
                    break;
                case '--status':
                case '-s':
                    this.options.status = true;
                    break;
                case '--help':
                case '-h':
                    this.options.help = true;
                    break;
                case '--force':
                case '-f':
                    this.options.force = true;
                    break;
                case '--dry-run':
                case '-d':
                    this.options.dryRun = true;
                    break;
                default:
                    if (arg.startsWith('--')) {
                        console.warn(`Unknown option: ${arg}`);
                    }
            }
        }
    }

    private showHelp(): void {
        console.log(`
Clinical Notes Migration CLI

Usage:
  npm run migrate:clinical-notes [options]

Options:
  --rollback, -r    Rollback migrations
  --status, -s      Show migration status
  --help, -h        Show this help message
  --force, -f       Force migration without confirmation
  --dry-run, -d     Show what would be migrated without making changes

Examples:
  npm run migrate:clinical-notes                    # Run migrations
  npm run migrate:clinical-notes -- --status        # Check status
  npm run migrate:clinical-notes -- --rollback      # Rollback migrations
  npm run migrate:clinical-notes -- --dry-run       # Preview migrations

Environment Variables:
  MONGODB_URI       MongoDB connection string (required)
  NODE_ENV          Environment (development, production, etc.)
    `);
    }

    private async connectToDatabase(): Promise<void> {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is required');
        }

        try {
            await mongoose.connect(mongoUri);
            logger.info('Connected to MongoDB');
        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    private async disconnectFromDatabase(): Promise<void> {
        try {
            await mongoose.disconnect();
            logger.info('Disconnected from MongoDB');
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
        }
    }

    private async confirmAction(message: string): Promise<boolean> {
        if (this.options.force) {
            return true;
        }

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(`${message} (y/N): `, (answer: string) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }

    private async showStatus(): Promise<void> {
        try {
            console.log('\n📊 Clinical Notes Migration Status\n');

            const status = await getClinicalNotesMigrationStatus();

            console.log(`Migration Version: ${status.version}`);
            console.log(`Total Notes: ${status.totalNotes.toLocaleString()}`);
            console.log(`Active Notes: ${status.activeNotes.toLocaleString()}`);
            console.log(`Deleted Notes: ${status.deletedNotes.toLocaleString()}`);
            console.log(`Database Indexes: ${status.indexesCount}`);

            if (status.lastMigration) {
                console.log(`Last Migration: ${status.lastMigration.toISOString()}`);
            }

            // Check if migration is needed
            const collection = mongoose.connection.db.collection('clinicalnotes');
            const sampleNote = await collection.findOne({});

            if (sampleNote) {
                const needsMigration = !sampleNote.createdBy || !sampleNote.lastModifiedBy;
                console.log(`Migration Needed: ${needsMigration ? '⚠️  Yes' : '✅ No'}`);
            } else {
                console.log('Migration Needed: ℹ️  No notes found');
            }

            console.log('\n');
        } catch (error) {
            logger.error('Failed to get migration status:', error);
            process.exit(1);
        }
    }

    private async runMigrations(): Promise<void> {
        try {
            if (this.options.dryRun) {
                console.log('\n🔍 Dry Run Mode - No changes will be made\n');

                // Show what would be migrated
                const collection = mongoose.connection.db.collection('clinicalnotes');
                const totalNotes = await collection.countDocuments();
                const notesNeedingMigration = await collection.countDocuments({
                    $or: [
                        { lastModifiedBy: { $exists: false } },
                        { createdBy: { $exists: false } },
                    ],
                });

                console.log(`Total Notes: ${totalNotes.toLocaleString()}`);
                console.log(`Notes Needing Migration: ${notesNeedingMigration.toLocaleString()}`);
                console.log('\nMigrations that would run:');
                console.log('  ✓ Create database indexes');
                console.log('  ✓ Migrate existing notes schema');
                console.log('  ✓ Add audit fields');
                console.log('  ✓ Setup text search indexes');
                console.log('  ✓ Validate data integrity');
                console.log('\nUse --force to run migrations without confirmation');
                return;
            }

            console.log('\n🚀 Starting Clinical Notes Migrations\n');

            const confirmed = await this.confirmAction(
                'This will modify your database. Are you sure you want to continue?'
            );

            if (!confirmed) {
                console.log('Migration cancelled by user');
                return;
            }

            const startTime = Date.now();
            const result = await runClinicalNotesMigrations();
            const duration = Date.now() - startTime;

            if (result.success) {
                console.log(`\n✅ Migration completed successfully in ${duration}ms`);
                console.log(`   Records migrated: ${result.migratedCount || 0}`);
                console.log(`   Message: ${result.message}`);
            } else {
                console.log(`\n❌ Migration failed: ${result.message}`);
                if (result.errors) {
                    console.log('\nErrors:');
                    result.errors.forEach((error, index) => {
                        console.log(`  ${index + 1}. ${error}`);
                    });
                }
                process.exit(1);
            }
        } catch (error) {
            logger.error('Migration failed with exception:', error);
            process.exit(1);
        }
    }

    private async runRollback(): Promise<void> {
        try {
            console.log('\n⚠️  Rolling Back Clinical Notes Migrations\n');

            const confirmed = await this.confirmAction(
                'This will rollback migrations. This action cannot be undone. Continue?'
            );

            if (!confirmed) {
                console.log('Rollback cancelled by user');
                return;
            }

            const result = await rollbackClinicalNotesMigrations();

            if (result.success) {
                console.log(`\n✅ Rollback completed: ${result.message}`);
            } else {
                console.log(`\n❌ Rollback failed: ${result.message}`);
                process.exit(1);
            }
        } catch (error) {
            logger.error('Rollback failed with exception:', error);
            process.exit(1);
        }
    }

    async run(): Promise<void> {
        try {
            if (this.options.help) {
                this.showHelp();
                return;
            }

            // Connect to database
            await this.connectToDatabase();

            // Execute based on options
            if (this.options.status) {
                await this.showStatus();
            } else if (this.options.rollback) {
                await this.runRollback();
            } else {
                await this.runMigrations();
            }
        } catch (error) {
            logger.error('CLI execution failed:', error);
            process.exit(1);
        } finally {
            await this.disconnectFromDatabase();
        }
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the CLI
if (require.main === module) {
    const cli = new ClinicalNotesMigrationCLI();
    cli.run().catch((error) => {
        logger.error('CLI failed:', error);
        process.exit(1);
    });
}

export default ClinicalNotesMigrationCLI;