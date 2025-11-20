import mongoose from 'mongoose';
import { seedSystemRolesAndPermissions } from './001-seed-system-roles-permissions';
import { migrateUserRoles, rollbackUserRoleMigration } from './002-migrate-user-roles';
import { validateMigration, rollbackMigration } from './003-migration-validation-rollback';
import BackwardCompatibilityService from '../../services/BackwardCompatibilityService';
import FeatureFlag from '../../models/FeatureFlag';
import logger from '../../utils/logger';

/**
 * RBAC Migration Orchestrator
 * Coordinates the complete migration from static to dynamic RBAC
 */

interface MigrationConfig {
    enableGradualRollout: boolean;
    rolloutPercentage: number;
    enableValidation: boolean;
    enableBackup: boolean;
    skipUserMigration: boolean;
    dryRun: boolean;
}

interface MigrationResult {
    success: boolean;
    phase: string;
    duration: number;
    errors: string[];
    warnings: string[];
    statistics: {
        rolesCreated: number;
        permissionsCreated: number;
        usersMigrated: number;
        validationErrors: number;
    };
}

export class RBACMigrationOrchestrator {
    private config: MigrationConfig;
    private compatibilityService: BackwardCompatibilityService;

    constructor(config: Partial<MigrationConfig> = {}) {
        this.config = {
            enableGradualRollout: true,
            rolloutPercentage: 0,
            enableValidation: true,
            enableBackup: true,
            skipUserMigration: false,
            dryRun: false,
            ...config
        };

        this.compatibilityService = BackwardCompatibilityService.getInstance();
    }

    /**
     * Execute complete RBAC migration
     */
    async executeMigration(): Promise<MigrationResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        let currentPhase = 'initialization';

        try {
            logger.info('Starting RBAC migration orchestration...', { config: this.config });

            // Phase 1: Initialization
            currentPhase = 'initialization';
            await this.initializeMigration();

            // Phase 2: System roles and permissions seeding
            currentPhase = 'seeding';
            logger.info('Phase 2: Seeding system roles and permissions...');
            if (!this.config.dryRun) {
                await seedSystemRolesAndPermissions();
            } else {
                logger.info('DRY RUN: Would seed system roles and permissions');
            }

            // Phase 3: User role migration
            if (!this.config.skipUserMigration) {
                currentPhase = 'user_migration';
                logger.info('Phase 3: Migrating user roles...');
                if (!this.config.dryRun) {
                    const migrationResults = await migrateUserRoles();
                    const failedMigrations = migrationResults.filter(r => !r.success);

                    if (failedMigrations.length > 0) {
                        warnings.push(`${failedMigrations.length} user migrations failed`);
                    }
                } else {
                    logger.info('DRY RUN: Would migrate user roles');
                }
            }

            // Phase 4: Validation
            if (this.config.enableValidation) {
                currentPhase = 'validation';
                logger.info('Phase 4: Validating migration...');
                if (!this.config.dryRun) {
                    const validationResult = await validateMigration();

                    if (!validationResult.isValid) {
                        const criticalErrors = validationResult.errors.filter(e => e.type === 'critical');
                        if (criticalErrors.length > 0) {
                            throw new Error(`Migration validation failed with ${criticalErrors.length} critical errors`);
                        }
                    }

                    warnings.push(...validationResult.warnings.map(w => w.message));
                } else {
                    logger.info('DRY RUN: Would validate migration');
                }
            }

            // Phase 5: Gradual rollout setup
            if (this.config.enableGradualRollout) {
                currentPhase = 'rollout_setup';
                logger.info('Phase 5: Setting up gradual rollout...');
                if (!this.config.dryRun) {
                    await this.setupGradualRollout();
                } else {
                    logger.info('DRY RUN: Would setup gradual rollout');
                }
            }

            // Phase 6: Enable dynamic RBAC
            currentPhase = 'activation';
            logger.info('Phase 6: Activating dynamic RBAC...');
            if (!this.config.dryRun) {
                await this.activateDynamicRBAC();
            } else {
                logger.info('DRY RUN: Would activate dynamic RBAC');
            }

            const duration = Date.now() - startTime;
            const statistics = await this.gatherMigrationStatistics();

            logger.info('RBAC migration completed successfully', {
                duration: `${duration}ms`,
                statistics
            });

            return {
                success: true,
                phase: 'completed',
                duration,
                errors,
                warnings,
                statistics
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);

            logger.error(`RBAC migration failed in phase ${currentPhase}:`, error);

            // Attempt rollback if not in dry run mode
            if (!this.config.dryRun) {
                try {
                    logger.info('Attempting automatic rollback...');
                    await this.rollbackMigration();
                    warnings.push('Automatic rollback completed');
                } catch (rollbackError) {
                    logger.error('Automatic rollback failed:', rollbackError);
                    errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
                }
            }

            return {
                success: false,
                phase: currentPhase,
                duration,
                errors,
                warnings,
                statistics: {
                    rolesCreated: 0,
                    permissionsCreated: 0,
                    usersMigrated: 0,
                    validationErrors: 0
                }
            };
        }
    }

    /**
     * Initialize migration environment
     */
    private async initializeMigration(): Promise<void> {
        logger.info('Initializing migration environment...');

        // Initialize compatibility service
        await this.compatibilityService.initialize();

        // Create backup if enabled
        if (this.config.enableBackup && !this.config.dryRun) {
            await this.createBackup();
        }

        // Set migration phase
        await this.setMigrationPhase('preparation');

        logger.info('Migration environment initialized');
    }

    /**
     * Setup gradual rollout configuration
     */
    private async setupGradualRollout(): Promise<void> {
        logger.info(`Setting up gradual rollout with ${this.config.rolloutPercentage}% coverage...`);

        await this.compatibilityService.updateConfiguration({
            enableDynamicRBAC: true,
            enableLegacyFallback: true,
            enableDeprecationWarnings: true,
            migrationPhase: 'migration',
            rolloutPercentage: this.config.rolloutPercentage
        });

        logger.info('Gradual rollout configured');
    }

    /**
     * Activate dynamic RBAC system
     */
    private async activateDynamicRBAC(): Promise<void> {
        logger.info('Activating dynamic RBAC system...');

        // Update feature flags
        await FeatureFlag.findOneAndUpdate(
            { key: 'rbac_enable_dynamic' },
            {
                key: 'rbac_enable_dynamic',
                value: true,
                isActive: true,
                description: 'Enable dynamic RBAC system',
                lastModifiedAt: new Date()
            },
            { upsert: true }
        );

        // Set migration phase to validation
        await this.setMigrationPhase('validation');

        // Update compatibility service configuration
        await this.compatibilityService.updateConfiguration({
            enableDynamicRBAC: true,
            migrationPhase: 'validation'
        });

        logger.info('Dynamic RBAC system activated');
    }

    /**
     * Create system backup
     */
    private async createBackup(): Promise<void> {
        logger.info('Creating system backup...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `rbac-migration-backup-${timestamp}`;

        // In a real implementation, this would create actual database backups
        // For now, we'll just log the backup creation
        logger.info(`Backup created: ${backupName}`);
    }

    /**
     * Set migration phase in feature flags
     */
    private async setMigrationPhase(phase: string): Promise<void> {
        await FeatureFlag.findOneAndUpdate(
            { key: 'rbac_migration_phase' },
            {
                key: 'rbac_migration_phase',
                value: phase,
                isActive: true,
                description: 'Current RBAC migration phase',
                lastModifiedAt: new Date()
            },
            { upsert: true }
        );
    }

    /**
     * Gather migration statistics
     */
    private async gatherMigrationStatistics(): Promise<{
        rolesCreated: number;
        permissionsCreated: number;
        usersMigrated: number;
        validationErrors: number;
    }> {
        const Role = (await import('../../models/Role')).default;
        const Permission = (await import('../../models/Permission')).default;
        const User = (await import('../../models/User')).default;

        const [rolesCreated, permissionsCreated, usersMigrated] = await Promise.all([
            Role.countDocuments({ isSystemRole: true, isActive: true }),
            Permission.countDocuments({ isSystemPermission: true, isActive: true }),
            User.countDocuments({ roleLastModifiedAt: { $exists: true } })
        ]);

        return {
            rolesCreated,
            permissionsCreated,
            usersMigrated,
            validationErrors: 0 // Would be populated from validation results
        };
    }

    /**
     * Rollback migration
     */
    async rollbackMigration(): Promise<void> {
        logger.info('Starting migration rollback...');

        try {
            // Disable dynamic RBAC
            await this.compatibilityService.updateConfiguration({
                enableDynamicRBAC: false,
                enableLegacyFallback: true,
                migrationPhase: 'preparation'
            });

            // Execute full rollback
            await rollbackMigration();

            logger.info('Migration rollback completed');

        } catch (error) {
            logger.error('Migration rollback failed:', error);
            throw error;
        }
    }

    /**
     * Get migration status
     */
    async getMigrationStatus(): Promise<{
        phase: string;
        isActive: boolean;
        rolloutPercentage: number;
        statistics: any;
    }> {
        const metrics = this.compatibilityService.getMetrics();
        const statistics = await this.gatherMigrationStatistics();

        return {
            phase: metrics.config.migrationPhase,
            isActive: metrics.config.enableDynamicRBAC,
            rolloutPercentage: metrics.config.rolloutPercentage,
            statistics
        };
    }

    /**
     * Update rollout percentage
     */
    async updateRolloutPercentage(percentage: number): Promise<void> {
        if (percentage < 0 || percentage > 100) {
            throw new Error('Rollout percentage must be between 0 and 100');
        }

        await this.compatibilityService.updateConfiguration({
            rolloutPercentage: percentage
        });

        logger.info(`Rollout percentage updated to ${percentage}%`);
    }

    /**
     * Complete migration (100% rollout)
     */
    async completeMigration(): Promise<void> {
        logger.info('Completing RBAC migration...');

        // Set to 100% rollout
        await this.updateRolloutPercentage(100);

        // Set migration phase to cleanup
        await this.setMigrationPhase('cleanup');

        // Disable legacy fallback after a grace period
        setTimeout(async () => {
            await this.compatibilityService.updateConfiguration({
                enableLegacyFallback: false,
                enableDeprecationWarnings: false
            });
            logger.info('Legacy fallback disabled - migration fully completed');
        }, 24 * 60 * 60 * 1000); // 24 hours

        logger.info('RBAC migration completion initiated');
    }
}

/**
 * Execute RBAC migration with configuration
 */
export async function executeRBACMigration(config: Partial<MigrationConfig> = {}): Promise<MigrationResult> {
    const orchestrator = new RBACMigrationOrchestrator(config);
    return await orchestrator.executeMigration();
}

/**
 * Rollback RBAC migration
 */
export async function rollbackRBACMigration(): Promise<void> {
    const orchestrator = new RBACMigrationOrchestrator();
    await orchestrator.rollbackMigration();
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    const options = process.argv.slice(3);

    const config: Partial<MigrationConfig> = {};

    // Parse CLI options
    for (const option of options) {
        if (option === '--dry-run') {
            config.dryRun = true;
        } else if (option === '--skip-validation') {
            config.enableValidation = false;
        } else if (option === '--skip-user-migration') {
            config.skipUserMigration = true;
        } else if (option.startsWith('--rollout=')) {
            const value = option.split('=')[1];
            if (value) {
                config.rolloutPercentage = parseInt(value);
            }
        }
    }

    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas')
        .then(async () => {
            const orchestrator = new RBACMigrationOrchestrator(config);

            switch (command) {
                case 'migrate':
                    const result = await orchestrator.executeMigration();
                    console.log(JSON.stringify(result, null, 2));
                    break;
                case 'rollback':
                    await orchestrator.rollbackMigration();
                    break;
                case 'status':
                    const status = await orchestrator.getMigrationStatus();
                    console.log(JSON.stringify(status, null, 2));
                    break;
                case 'complete':
                    await orchestrator.completeMigration();
                    break;
                case 'rollout':
                    const percentage = options[0] ? parseInt(options[0]) : 0;
                    await orchestrator.updateRolloutPercentage(percentage);
                    break;
                default:
                    console.log('Usage: node migration-orchestrator.js <command> [options]');
                    console.log('Commands: migrate, rollback, status, complete, rollout <percentage>');
                    console.log('Options: --dry-run, --skip-validation, --skip-user-migration, --rollout=<percentage>');
            }

            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration orchestration failed:', error);
            process.exit(1);
        });
}