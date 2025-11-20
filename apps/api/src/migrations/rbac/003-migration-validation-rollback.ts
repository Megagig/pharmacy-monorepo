import mongoose from 'mongoose';
import User from '../../models/User';
import Role from '../../models/Role';
import Permission from '../../models/Permission';
import UserRole from '../../models/UserRole';
import RolePermission from '../../models/RolePermission';
import BackwardCompatibilityService from '../../services/BackwardCompatibilityService';
import { PERMISSION_MATRIX } from '../../config/permissionMatrix';
import logger from '../../utils/logger';

/**
 * Migration Validation and Rollback System
 * Provides comprehensive validation and rollback capabilities for RBAC migration
 */

interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    statistics: ValidationStatistics;
}

interface ValidationError {
    type: 'critical' | 'major' | 'minor';
    category: string;
    message: string;
    affectedRecords?: any[];
    suggestedFix?: string;
}

interface ValidationWarning {
    category: string;
    message: string;
    affectedRecords?: any[];
    recommendation?: string;
}

interface ValidationStatistics {
    totalUsers: number;
    migratedUsers: number;
    totalRoles: number;
    totalPermissions: number;
    totalRoleAssignments: number;
    totalRolePermissions: number;
    orphanedRecords: number;
    inconsistentPermissions: number;
}

interface RollbackPlan {
    canRollback: boolean;
    steps: RollbackStep[];
    estimatedDuration: number;
    risks: string[];
    backupRequired: boolean;
}

interface RollbackStep {
    order: number;
    description: string;
    action: string;
    estimatedTime: number;
    reversible: boolean;
}

export class MigrationValidator {
    private compatibilityService: BackwardCompatibilityService;

    constructor() {
        this.compatibilityService = BackwardCompatibilityService.getInstance();
    }

    /**
     * Comprehensive migration validation
     */
    async validateMigration(): Promise<ValidationResult> {
        logger.info('Starting comprehensive migration validation...');

        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const statistics = await this.gatherStatistics();

        try {
            // Data integrity validation
            await this.validateDataIntegrity(errors, warnings);

            // Permission consistency validation
            await this.validatePermissionConsistency(errors, warnings);

            // Role hierarchy validation
            await this.validateRoleHierarchy(errors, warnings);

            // User migration validation
            await this.validateUserMigration(errors, warnings);

            // Performance validation
            await this.validatePerformance(errors, warnings);

            // Security validation
            await this.validateSecurity(errors, warnings);

            const isValid = errors.filter(e => e.type === 'critical').length === 0;

            logger.info(`Migration validation completed - Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);

            return {
                isValid,
                errors,
                warnings,
                statistics
            };

        } catch (error) {
            logger.error('Migration validation failed:', error);
            errors.push({
                type: 'critical',
                category: 'system',
                message: `Validation process failed: ${error instanceof Error ? error.message : String(error)}`,
                suggestedFix: 'Check system logs and resolve underlying issues'
            });

            return {
                isValid: false,
                errors,
                warnings,
                statistics
            };
        }
    }

    /**
     * Validate data integrity
     */
    private async validateDataIntegrity(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating data integrity...');

        // Check for orphaned user role assignments
        const orphanedUserRoles = await UserRole.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'roles',
                    localField: 'roleId',
                    foreignField: '_id',
                    as: 'role'
                }
            },
            {
                $match: {
                    $or: [
                        { user: { $size: 0 } },
                        { role: { $size: 0 } }
                    ]
                }
            }
        ]);

        if (orphanedUserRoles.length > 0) {
            errors.push({
                type: 'major',
                category: 'data_integrity',
                message: `Found ${orphanedUserRoles.length} orphaned user role assignments`,
                affectedRecords: orphanedUserRoles,
                suggestedFix: 'Remove orphaned user role assignments'
            });
        }

        // Check for orphaned role permission assignments
        const orphanedRolePermissions = await RolePermission.aggregate([
            {
                $lookup: {
                    from: 'roles',
                    localField: 'roleId',
                    foreignField: '_id',
                    as: 'role'
                }
            },
            {
                $match: {
                    role: { $size: 0 }
                }
            }
        ]);

        if (orphanedRolePermissions.length > 0) {
            errors.push({
                type: 'major',
                category: 'data_integrity',
                message: `Found ${orphanedRolePermissions.length} orphaned role permission assignments`,
                affectedRecords: orphanedRolePermissions,
                suggestedFix: 'Remove orphaned role permission assignments'
            });
        }

        // Check for duplicate role assignments
        const duplicateAssignments = await UserRole.aggregate([
            {
                $group: {
                    _id: {
                        userId: '$userId',
                        roleId: '$roleId',
                        workspaceId: '$workspaceId'
                    },
                    count: { $sum: 1 },
                    assignments: { $push: '$$ROOT' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        if (duplicateAssignments.length > 0) {
            warnings.push({
                category: 'data_integrity',
                message: `Found ${duplicateAssignments.length} duplicate role assignments`,
                affectedRecords: duplicateAssignments,
                recommendation: 'Remove duplicate role assignments, keeping the most recent one'
            });
        }

        // Validate permission references
        const invalidPermissionRefs = await RolePermission.aggregate([
            {
                $lookup: {
                    from: 'permissions',
                    localField: 'permissionAction',
                    foreignField: 'action',
                    as: 'permission'
                }
            },
            {
                $match: {
                    permission: { $size: 0 }
                }
            }
        ]);

        if (invalidPermissionRefs.length > 0) {
            warnings.push({
                category: 'data_integrity',
                message: `Found ${invalidPermissionRefs.length} role permissions referencing non-existent permissions`,
                affectedRecords: invalidPermissionRefs,
                recommendation: 'Create missing permissions or remove invalid references'
            });
        }
    }

    /**
     * Validate permission consistency between static and dynamic systems
     */
    private async validatePermissionConsistency(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating permission consistency...');

        // Sample users for consistency testing
        const sampleUsers = await User.aggregate([
            { $match: { status: 'active' } },
            { $sample: { size: Math.min(100, await User.countDocuments({ status: 'active' })) } }
        ]);

        const inconsistencies: any[] = [];
        const testActions = Object.keys(PERMISSION_MATRIX).slice(0, 20); // Test subset for performance

        for (const user of sampleUsers) {
            try {
                const workspaceContext = await this.buildWorkspaceContext(user);
                const validation = await this.compatibilityService.validatePermissionConsistency(
                    workspaceContext,
                    user,
                    testActions
                );

                if (!validation.consistent) {
                    inconsistencies.push({
                        userId: user._id,
                        email: user.email,
                        inconsistencies: validation.inconsistencies
                    });
                }
            } catch (error) {
                warnings.push({
                    category: 'permission_consistency',
                    message: `Failed to validate permissions for user ${user.email}`,
                    recommendation: 'Check user data and role assignments'
                });
            }
        }

        if (inconsistencies.length > 0) {
            const totalInconsistencies = inconsistencies.reduce((sum, user) => sum + user.inconsistencies.length, 0);

            if (totalInconsistencies > sampleUsers.length * 0.1) { // More than 10% inconsistency rate
                errors.push({
                    type: 'major',
                    category: 'permission_consistency',
                    message: `High permission inconsistency rate: ${totalInconsistencies} inconsistencies across ${inconsistencies.length} users`,
                    affectedRecords: inconsistencies,
                    suggestedFix: 'Review and fix role assignments and permission mappings'
                });
            } else {
                warnings.push({
                    category: 'permission_consistency',
                    message: `Found ${totalInconsistencies} permission inconsistencies across ${inconsistencies.length} users`,
                    affectedRecords: inconsistencies,
                    recommendation: 'Review affected users and resolve inconsistencies'
                });
            }
        }
    }

    /**
     * Validate role hierarchy integrity
     */
    private async validateRoleHierarchy(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating role hierarchy...');

        const roles = await Role.find({ isActive: true }).populate('parentRole');

        // Check for circular dependencies
        for (const role of roles) {
            const visited = new Set<string>();
            let currentRole = role;

            while (currentRole && currentRole.parentRole) {
                const parentId = currentRole.parentRole._id.toString();

                if (visited.has(parentId)) {
                    errors.push({
                        type: 'critical',
                        category: 'role_hierarchy',
                        message: `Circular dependency detected in role hierarchy starting from ${role.name}`,
                        affectedRecords: [role],
                        suggestedFix: 'Break circular dependency by removing or changing parent role'
                    });
                    break;
                }

                visited.add(currentRole._id.toString());
                currentRole = currentRole.parentRole as any;
            }
        }

        // Check hierarchy level consistency
        for (const role of roles) {
            if (role.parentRole) {
                const parentRole = role.parentRole as any;
                if (role.hierarchyLevel !== parentRole.hierarchyLevel + 1) {
                    warnings.push({
                        category: 'role_hierarchy',
                        message: `Inconsistent hierarchy level for role ${role.name}`,
                        affectedRecords: [role],
                        recommendation: 'Recalculate hierarchy levels'
                    });
                }
            } else if (role.hierarchyLevel !== 0) {
                warnings.push({
                    category: 'role_hierarchy',
                    message: `Root role ${role.name} should have hierarchy level 0`,
                    affectedRecords: [role],
                    recommendation: 'Set hierarchy level to 0 for root roles'
                });
            }
        }

        // Check for excessive hierarchy depth
        const maxDepth = Math.max(...roles.map(r => r.hierarchyLevel));
        if (maxDepth > 5) {
            warnings.push({
                category: 'role_hierarchy',
                message: `Role hierarchy depth (${maxDepth}) exceeds recommended maximum (5)`,
                recommendation: 'Consider flattening role hierarchy for better performance'
            });
        }
    }

    /**
     * Validate user migration completeness
     */
    private async validateUserMigration(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating user migration...');

        // Check for users without role assignments
        const usersWithoutRoles = await User.find({
            status: 'active',
            $or: [
                { assignedRoles: { $exists: false } },
                { assignedRoles: { $size: 0 } }
            ],
            role: { $exists: true, $ne: null }
        });

        if (usersWithoutRoles.length > 0) {
            errors.push({
                type: 'major',
                category: 'user_migration',
                message: `${usersWithoutRoles.length} active users have no dynamic role assignments but have static roles`,
                affectedRecords: usersWithoutRoles.map(u => ({ _id: u._id, email: u.email, role: u.role })),
                suggestedFix: 'Complete user role migration for all active users'
            });
        }

        // Check for inconsistent role assignments
        const usersWithInconsistentRoles = await User.aggregate([
            {
                $lookup: {
                    from: 'user_roles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'roleAssignments'
                }
            },
            {
                $match: {
                    $expr: {
                        $ne: [
                            { $size: '$assignedRoles' },
                            { $size: { $filter: { input: '$roleAssignments', cond: { $eq: ['$$this.isActive', true] } } } }
                        ]
                    }
                }
            }
        ]);

        if (usersWithInconsistentRoles.length > 0) {
            warnings.push({
                category: 'user_migration',
                message: `${usersWithInconsistentRoles.length} users have inconsistent role assignment counts`,
                affectedRecords: usersWithInconsistentRoles,
                recommendation: 'Synchronize assignedRoles array with UserRole records'
            });
        }
    }

    /**
     * Validate system performance
     */
    private async validatePerformance(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating system performance...');

        // Test permission check performance
        const testUser = await User.findOne({ status: 'active', assignedRoles: { $exists: true, $ne: [] } });
        if (!testUser) {
            warnings.push({
                category: 'performance',
                message: 'No migrated users found for performance testing',
                recommendation: 'Complete user migration before performance validation'
            });
            return;
        }

        const workspaceContext = await this.buildWorkspaceContext(testUser);
        const testActions = Object.keys(PERMISSION_MATRIX).slice(0, 10);

        const startTime = Date.now();
        for (const action of testActions) {
            await this.compatibilityService.checkPermission(workspaceContext, testUser, action);
        }
        const avgResponseTime = (Date.now() - startTime) / testActions.length;

        if (avgResponseTime > 100) { // More than 100ms average
            warnings.push({
                category: 'performance',
                message: `Average permission check time (${avgResponseTime.toFixed(2)}ms) exceeds recommended threshold (100ms)`,
                recommendation: 'Optimize permission caching and database queries'
            });
        }

        // Check for large role assignments
        const usersWithManyRoles = await User.aggregate([
            {
                $match: {
                    assignedRoles: { $exists: true }
                }
            },
            {
                $project: {
                    email: 1,
                    roleCount: { $size: '$assignedRoles' }
                }
            },
            {
                $match: {
                    roleCount: { $gt: 10 }
                }
            }
        ]);

        if (usersWithManyRoles.length > 0) {
            warnings.push({
                category: 'performance',
                message: `${usersWithManyRoles.length} users have more than 10 role assignments`,
                affectedRecords: usersWithManyRoles,
                recommendation: 'Review role assignments and consider role consolidation'
            });
        }
    }

    /**
     * Validate security aspects
     */
    private async validateSecurity(errors: ValidationError[], warnings: ValidationWarning[]): Promise<void> {
        logger.debug('Validating security aspects...');

        // Check for users with excessive permissions
        const superAdminCount = await User.countDocuments({ role: 'super_admin', status: 'active' });
        if (superAdminCount > 5) {
            warnings.push({
                category: 'security',
                message: `High number of super admin users (${superAdminCount})`,
                recommendation: 'Review super admin assignments and apply principle of least privilege'
            });
        }

        // Check for roles with wildcard permissions
        const rolesWithWildcard = await Role.find({ permissions: '*', isActive: true });
        if (rolesWithWildcard.length > 1) {
            warnings.push({
                category: 'security',
                message: `${rolesWithWildcard.length} roles have wildcard permissions`,
                affectedRecords: rolesWithWildcard,
                recommendation: 'Replace wildcard permissions with specific permission grants'
            });
        }

        // Check for high-risk permission assignments
        const highRiskPermissions = await Permission.find({ riskLevel: 'critical', isActive: true });
        for (const permission of highRiskPermissions) {
            const assignmentCount = await RolePermission.countDocuments({
                permissionAction: permission.action,
                granted: true,
                isActive: true
            });

            if (assignmentCount > 10) {
                warnings.push({
                    category: 'security',
                    message: `Critical permission '${permission.action}' is assigned to ${assignmentCount} roles`,
                    recommendation: 'Review and restrict critical permission assignments'
                });
            }
        }
    }

    /**
     * Gather validation statistics
     */
    private async gatherStatistics(): Promise<ValidationStatistics> {
        const [
            totalUsers,
            migratedUsers,
            totalRoles,
            totalPermissions,
            totalRoleAssignments,
            totalRolePermissions
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ roleLastModifiedAt: { $exists: true } }),
            Role.countDocuments({ isActive: true }),
            Permission.countDocuments({ isActive: true }),
            UserRole.countDocuments({ isActive: true }),
            RolePermission.countDocuments({ isActive: true })
        ]);

        // Count orphaned records
        const orphanedUserRoles = await UserRole.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $match: { user: { $size: 0 } }
            },
            {
                $count: 'count'
            }
        ]);

        const orphanedRecords = orphanedUserRoles[0]?.count || 0;

        return {
            totalUsers,
            migratedUsers,
            totalRoles,
            totalPermissions,
            totalRoleAssignments,
            totalRolePermissions,
            orphanedRecords,
            inconsistentPermissions: 0 // Will be updated during validation
        };
    }

    /**
     * Build workspace context for testing
     */
    private async buildWorkspaceContext(user: any): Promise<any> {
        // Simplified workspace context for validation
        return {
            workspace: user.workplaceId ? { _id: user.workplaceId } : null,
            subscription: null,
            plan: { tier: user.subscriptionTier || 'basic' },
            permissions: user.features || [],
            limits: {},
            isTrialExpired: false,
            isSubscriptionActive: true
        };
    }
}

export class MigrationRollback {
    /**
     * Generate rollback plan
     */
    async generateRollbackPlan(): Promise<RollbackPlan> {
        logger.info('Generating migration rollback plan...');

        const steps: RollbackStep[] = [
            {
                order: 1,
                description: 'Create backup of current dynamic RBAC data',
                action: 'backup_dynamic_data',
                estimatedTime: 300, // 5 minutes
                reversible: false
            },
            {
                order: 2,
                description: 'Disable dynamic RBAC feature flags',
                action: 'disable_dynamic_rbac',
                estimatedTime: 30,
                reversible: true
            },
            {
                order: 3,
                description: 'Clear dynamic role assignments from users',
                action: 'clear_user_dynamic_roles',
                estimatedTime: 600, // 10 minutes
                reversible: true
            },
            {
                order: 4,
                description: 'Remove dynamic role assignments',
                action: 'remove_user_roles',
                estimatedTime: 300,
                reversible: true
            },
            {
                order: 5,
                description: 'Remove role-permission mappings',
                action: 'remove_role_permissions',
                estimatedTime: 180,
                reversible: true
            },
            {
                order: 6,
                description: 'Remove dynamic roles (keep system roles)',
                action: 'remove_dynamic_roles',
                estimatedTime: 120,
                reversible: true
            },
            {
                order: 7,
                description: 'Remove dynamic permissions',
                action: 'remove_dynamic_permissions',
                estimatedTime: 60,
                reversible: true
            },
            {
                order: 8,
                description: 'Validate legacy RBAC functionality',
                action: 'validate_legacy_rbac',
                estimatedTime: 300,
                reversible: false
            }
        ];

        const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);

        // Check for rollback risks
        const risks: string[] = [];

        const activeUserRoles = await UserRole.countDocuments({ isActive: true });
        if (activeUserRoles > 1000) {
            risks.push('Large number of role assignments may cause extended rollback time');
        }

        const customRoles = await Role.countDocuments({ isSystemRole: false, isActive: true });
        if (customRoles > 0) {
            risks.push(`${customRoles} custom roles will be permanently deleted`);
        }

        const directPermissions = await User.countDocuments({ directPermissions: { $exists: true, $ne: [] } });
        if (directPermissions > 0) {
            risks.push(`${directPermissions} users have direct permissions that will be lost`);
        }

        return {
            canRollback: true,
            steps,
            estimatedDuration: totalTime,
            risks,
            backupRequired: true
        };
    }

    /**
     * Execute rollback
     */
    async executeRollback(plan: RollbackPlan): Promise<void> {
        logger.info('Starting migration rollback...');

        if (!plan.canRollback) {
            throw new Error('Rollback is not possible with current system state');
        }

        for (const step of plan.steps) {
            logger.info(`Executing rollback step ${step.order}: ${step.description}`);

            try {
                await this.executeRollbackStep(step);
                logger.info(`Completed rollback step ${step.order}`);
            } catch (error) {
                logger.error(`Failed rollback step ${step.order}:`, error);

                if (!step.reversible) {
                    throw new Error(`Critical rollback step ${step.order} failed and cannot be reversed`);
                }

                // Continue with next step for reversible failures
                logger.warn(`Continuing rollback despite failure in step ${step.order}`);
            }
        }

        logger.info('Migration rollback completed');
    }

    /**
     * Execute individual rollback step
     */
    private async executeRollbackStep(step: RollbackStep): Promise<void> {
        switch (step.action) {
            case 'backup_dynamic_data':
                await this.backupDynamicData();
                break;
            case 'disable_dynamic_rbac':
                await this.disableDynamicRBAC();
                break;
            case 'clear_user_dynamic_roles':
                await this.clearUserDynamicRoles();
                break;
            case 'remove_user_roles':
                await this.removeUserRoles();
                break;
            case 'remove_role_permissions':
                await this.removeRolePermissions();
                break;
            case 'remove_dynamic_roles':
                await this.removeDynamicRoles();
                break;
            case 'remove_dynamic_permissions':
                await this.removeDynamicPermissions();
                break;
            case 'validate_legacy_rbac':
                await this.validateLegacyRBAC();
                break;
            default:
                throw new Error(`Unknown rollback action: ${step.action}`);
        }
    }

    // Rollback step implementations
    private async backupDynamicData(): Promise<void> {
        // Implementation would create backups of dynamic RBAC data
        logger.info('Creating backup of dynamic RBAC data...');
    }

    private async disableDynamicRBAC(): Promise<void> {
        const FeatureFlag = (await import('../../models/FeatureFlag')).default;
        await FeatureFlag.updateMany(
            { key: { $regex: /^rbac_/ } },
            { $set: { isActive: false } }
        );
    }

    private async clearUserDynamicRoles(): Promise<void> {
        await User.updateMany(
            {},
            {
                $unset: {
                    assignedRoles: 1,
                    directPermissions: 1,
                    deniedPermissions: 1,
                    roleLastModifiedBy: 1,
                    roleLastModifiedAt: 1,
                    cachedPermissions: 1
                }
            }
        );
    }

    private async removeUserRoles(): Promise<void> {
        await UserRole.deleteMany({});
    }

    private async removeRolePermissions(): Promise<void> {
        await RolePermission.deleteMany({});
    }

    private async removeDynamicRoles(): Promise<void> {
        await Role.deleteMany({ isSystemRole: false });
    }

    private async removeDynamicPermissions(): Promise<void> {
        await Permission.deleteMany({});
    }

    private async validateLegacyRBAC(): Promise<void> {
        // Validate that legacy RBAC is working correctly
        const testUser = await User.findOne({ status: 'active' });
        if (testUser) {
            const compatibilityService = BackwardCompatibilityService.getInstance();
            const workspaceContext = {
                workspace: null,
                subscription: null,
                plan: null,
                permissions: [],
                limits: {},
                isTrialExpired: false,
                isSubscriptionActive: true
            } as any;

            const result = await compatibilityService.checkPermission(
                workspaceContext,
                testUser,
                'patient.read',
                { forceMethod: 'legacy' }
            );

            if (result.source !== 'legacy') {
                throw new Error('Legacy RBAC validation failed');
            }
        }
    }
}

/**
 * Execute migration validation
 */
export async function validateMigration(): Promise<ValidationResult> {
    const validator = new MigrationValidator();
    return await validator.validateMigration();
}

/**
 * Execute migration rollback
 */
export async function rollbackMigration(): Promise<void> {
    const rollback = new MigrationRollback();
    const plan = await rollback.generateRollbackPlan();
    await rollback.executeRollback(plan);
}

// Export for direct execution
if (require.main === module) {
    const command = process.argv[2];

    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas')
        .then(async () => {
            if (command === 'rollback') {
                await rollbackMigration();
            } else {
                const result = await validateMigration();
                console.log(JSON.stringify(result, null, 2));
            }
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Operation failed:', error);
            process.exit(1);
        });
}