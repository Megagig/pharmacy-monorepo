import mongoose from 'mongoose';
import Permission from '../../models/Permission';
import Role from '../../models/Role';
import RolePermission from '../../models/RolePermission';
import logger from '../../utils/logger';

/**
 * Migration: Add Laboratory Results Permissions
 * Adds new permissions for the universal Laboratory Findings module
 */

interface PermissionDefinition {
    action: string;
    displayName: string;
    description: string;
    category: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiredSubscriptionTier?: 'free_trial' | 'basic' | 'pro' | 'pharmily' | 'network' | 'enterprise';
    requiredPlanFeatures?: string[];
    dependencies: string[];
    conflicts: string[];
    isSystemPermission: boolean;
}

// Lab Results Permissions
const LAB_RESULTS_PERMISSIONS: PermissionDefinition[] = [
    {
        action: 'lab_results:read',
        displayName: 'View Lab Results',
        description: 'View laboratory test results and reports',
        category: 'clinical',
        riskLevel: 'low',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: [],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_results:create',
        displayName: 'Create Lab Results',
        description: 'Add new laboratory test results',
        category: 'clinical',
        riskLevel: 'medium',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_results:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_results:update',
        displayName: 'Update Lab Results',
        description: 'Edit existing laboratory test results',
        category: 'clinical',
        riskLevel: 'medium',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_results:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_results:delete',
        displayName: 'Delete Lab Results',
        description: 'Delete laboratory test results (soft delete only)',
        category: 'clinical',
        riskLevel: 'high',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_results:read', 'lab_results:update'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_results:signoff',
        displayName: 'Sign Off Lab Results',
        description: 'Sign off and finalize laboratory test results',
        category: 'clinical',
        riskLevel: 'medium',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_results:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_results:upload',
        displayName: 'Upload Lab Documents',
        description: 'Upload lab result documents (PDF/images)',
        category: 'clinical',
        riskLevel: 'medium',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_results:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_templates:read',
        displayName: 'View Lab Templates',
        description: 'View laboratory test panel templates',
        category: 'clinical',
        riskLevel: 'low',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: [],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_templates:create',
        displayName: 'Create Lab Templates',
        description: 'Create custom laboratory test panel templates',
        category: 'clinical',
        riskLevel: 'low',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_templates:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_templates:update',
        displayName: 'Update Lab Templates',
        description: 'Edit laboratory test panel templates',
        category: 'clinical',
        riskLevel: 'low',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_templates:read'],
        conflicts: [],
        isSystemPermission: true
    },
    {
        action: 'lab_templates:delete',
        displayName: 'Delete Lab Templates',
        description: 'Delete custom laboratory test panel templates',
        category: 'clinical',
        riskLevel: 'medium',
        requiredPlanFeatures: ['laboratory_findings'],
        dependencies: ['lab_templates:read'],
        conflicts: [],
        isSystemPermission: true
    }
];

// Role-Permission Mappings
const ROLE_PERMISSION_MAPPINGS = {
    // System Roles
    super_admin: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:update',
        'lab_results:delete',
        'lab_results:signoff',
        'lab_results:upload',
        'lab_templates:read',
        'lab_templates:create',
        'lab_templates:update',
        'lab_templates:delete'
    ],
    admin: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:update',
        'lab_results:delete',
        'lab_results:signoff',
        'lab_results:upload',
        'lab_templates:read',
        'lab_templates:create',
        'lab_templates:update',
        'lab_templates:delete'
    ],
    owner: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:update',
        'lab_results:delete',
        'lab_results:signoff',
        'lab_results:upload',
        'lab_templates:read',
        'lab_templates:create',
        'lab_templates:update',
        'lab_templates:delete'
    ],
    
    // Workplace Roles
    pharmacist: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:update',
        'lab_results:signoff',
        'lab_results:upload',
        'lab_templates:read',
        'lab_templates:create',
        'lab_templates:update'
    ],
    intern_pharmacist: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:upload',
        'lab_templates:read'
    ],
    pharmacy_outlet: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:upload',
        'lab_templates:read'
    ],
    pharmacy_team: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:upload',
        'lab_templates:read'
    ],
    lab_technician: [
        'lab_results:read',
        'lab_results:create',
        'lab_results:update',
        'lab_results:upload',
        'lab_templates:read'
    ]
};

export class LabResultsPermissionMigration {
    private systemUserId: mongoose.Types.ObjectId;

    constructor() {
        this.systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');
    }

    /**
     * Run the migration
     */
    async up(): Promise<void> {
        try {
            logger.info('Starting lab results permissions migration...');

            // Step 1: Create permissions
            await this.createPermissions();

            // Step 2: Map permissions to roles
            await this.mapPermissionsToRoles();

            logger.info('Lab results permissions migration completed successfully');

        } catch (error) {
            logger.error('Error during lab results permissions migration:', error);
            throw error;
        }
    }

    /**
     * Rollback the migration
     */
    async down(): Promise<void> {
        try {
            logger.info('Rolling back lab results permissions migration...');

            // Remove role-permission mappings
            const permissionActions = LAB_RESULTS_PERMISSIONS.map(p => p.action);
            await RolePermission.deleteMany({ permissionAction: { $in: permissionActions } });
            logger.info('Removed role-permission mappings');

            // Remove permissions
            await Permission.deleteMany({ action: { $in: permissionActions } });
            logger.info('Removed permissions');

            logger.info('Lab results permissions migration rollback completed');

        } catch (error) {
            logger.error('Error during lab results permissions migration rollback:', error);
            throw error;
        }
    }

    /**
     * Create lab results permissions
     */
    private async createPermissions(): Promise<void> {
        logger.info('Creating lab results permissions...');

        let createdCount = 0;
        let skippedCount = 0;

        for (const permissionDef of LAB_RESULTS_PERMISSIONS) {
            try {
                const existingPermission = await Permission.findOne({ action: permissionDef.action });

                if (!existingPermission) {
                    await Permission.create({
                        ...permissionDef,
                        createdBy: this.systemUserId,
                        lastModifiedBy: this.systemUserId,
                        isActive: true
                    });
                    logger.debug(`Created permission: ${permissionDef.action}`);
                    createdCount++;
                } else {
                    logger.debug(`Permission already exists: ${permissionDef.action}`);
                    skippedCount++;
                }
            } catch (error) {
                logger.error(`Error creating permission ${permissionDef.action}:`, error);
                throw error;
            }
        }

        logger.info(`Created ${createdCount} permissions, skipped ${skippedCount} existing permissions`);
    }

    /**
     * Map permissions to roles
     */
    private async mapPermissionsToRoles(): Promise<void> {
        logger.info('Mapping lab results permissions to roles...');

        let mappingCount = 0;

        for (const [roleName, permissionActions] of Object.entries(ROLE_PERMISSION_MAPPINGS)) {
            const role = await Role.findOne({ name: roleName });

            if (!role) {
                logger.warn(`Role not found: ${roleName}`);
                continue;
            }

            for (const permissionAction of permissionActions) {
                try {
                    const existingMapping = await RolePermission.findOne({
                        roleId: role._id,
                        permissionAction
                    });

                    if (!existingMapping) {
                        await RolePermission.create({
                            roleId: role._id,
                            permissionAction,
                            granted: true,
                            isActive: true,
                            priority: 50,
                            grantedBy: this.systemUserId,
                            lastModifiedBy: this.systemUserId
                        });
                        logger.debug(`Mapped ${permissionAction} to ${roleName}`);
                        mappingCount++;
                    }
                } catch (error) {
                    logger.error(`Error mapping ${permissionAction} to ${roleName}:`, error);
                }
            }
        }

        logger.info(`Created ${mappingCount} role-permission mappings`);
    }
}

/**
 * Run migration
 */
export async function runLabResultsPermissionMigration(): Promise<void> {
    const migration = new LabResultsPermissionMigration();
    await migration.up();
}

/**
 * Rollback migration
 */
export async function rollbackLabResultsPermissionMigration(): Promise<void> {
    const migration = new LabResultsPermissionMigration();
    await migration.down();
}

export default {
    up: runLabResultsPermissionMigration,
    down: rollbackLabResultsPermissionMigration
};

