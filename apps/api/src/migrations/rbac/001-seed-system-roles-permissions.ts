import mongoose from 'mongoose';
import Role from '../../models/Role';
import Permission from '../../models/Permission';
import RolePermission from '../../models/RolePermission';
import { PERMISSION_MATRIX, ROLE_HIERARCHY, WORKPLACE_ROLE_HIERARCHY } from '../../config/permissionMatrix';
import logger from '../../utils/logger';

/**
 * Migration script to seed system roles and permissions from static configuration
 * This creates the foundation for dynamic RBAC by converting static permissions to database records
 */

interface SystemRoleDefinition {
    name: string;
    displayName: string;
    description: string;
    category: 'system' | 'workplace' | 'custom';
    parentRole?: string;
    isSystemRole: boolean;
    isDefault: boolean;
    staticPermissions: string[];
}

interface PermissionDefinition {
    action: string;
    displayName: string;
    description: string;
    category: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiredSubscriptionTier?: string;
    requiredPlanFeatures?: string[];
    dependencies: string[];
    conflicts: string[];
    isSystemPermission: boolean;
}

export class SystemRolePermissionSeeder {
    private systemUserId: mongoose.Types.ObjectId;

    constructor() {
        // Create a system user ID for audit purposes
        this.systemUserId = new mongoose.Types.ObjectId();
    }

    /**
     * Main seeding function
     */
    async seed(): Promise<void> {
        try {
            logger.info('Starting system roles and permissions seeding...');

            // Step 1: Create permissions from static matrix
            await this.seedPermissions();

            // Step 2: Create system roles
            await this.seedSystemRoles();

            // Step 3: Create workplace roles
            await this.seedWorkplaceRoles();

            // Step 4: Create role-permission mappings
            await this.seedRolePermissions();

            // Step 5: Validate seeded data
            await this.validateSeededData();

            logger.info('System roles and permissions seeding completed successfully');

        } catch (error) {
            logger.error('Error during system roles and permissions seeding:', error);
            throw error;
        }
    }

    /**
     * Create permissions from static permission matrix
     */
    private async seedPermissions(): Promise<void> {
        logger.info('Seeding permissions from static matrix...');

        const permissions: PermissionDefinition[] = [];

        // Convert static permission matrix to permission definitions
        for (const [action, config] of Object.entries(PERMISSION_MATRIX)) {
            const [resource, operation] = action.split('.');

            if (!resource || !operation) {
                logger.warn(`Invalid action format: ${action}`);
                continue;
            }

            // Convert dot notation to colon notation for database storage
            const dbAction = `${resource}:${operation}`;

            permissions.push({
                action: dbAction,
                displayName: this.generateDisplayName(action),
                description: this.generateDescription(action, config),
                category: this.categorizePermission(resource),
                riskLevel: this.assessRiskLevel(action, config),
                requiredSubscriptionTier: config.planTiers?.[0],
                requiredPlanFeatures: config.features,
                dependencies: this.extractDependencies(action),
                conflicts: this.extractConflicts(action),
                isSystemPermission: true
            });
        }

        // Batch insert permissions
        for (const permissionDef of permissions) {
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
                } else {
                    logger.debug(`Permission already exists: ${permissionDef.action}`);
                }
            } catch (error) {
                logger.error(`Error creating permission ${permissionDef.action}:`, error);
                throw error;
            }
        }

        logger.info(`Seeded ${permissions.length} permissions`);
    }

    /**
     * Create system roles from static configuration
     */
    private async seedSystemRoles(): Promise<void> {
        logger.info('Seeding system roles...');

        const systemRoles: SystemRoleDefinition[] = [
            {
                name: 'super_admin',
                displayName: 'Super Administrator',
                description: 'Full system access with all permissions',
                category: 'system',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: ['*'] // All permissions
            },
            {
                name: 'owner',
                displayName: 'Pharmacy Owner',
                description: 'Pharmacy owner with full workspace management capabilities',
                category: 'system',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForSystemRole('owner')
            },
            {
                name: 'pharmacist',
                displayName: 'Licensed Pharmacist',
                description: 'Licensed pharmacist with clinical and patient management permissions',
                category: 'system',
                parentRole: 'owner',
                isSystemRole: true,
                isDefault: true,
                staticPermissions: this.getPermissionsForSystemRole('pharmacist')
            },
            {
                name: 'pharmacy_team',
                displayName: 'Pharmacy Team Member',
                description: 'Team member with limited administrative permissions',
                category: 'system',
                parentRole: 'pharmacist',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForSystemRole('pharmacy_team')
            },
            {
                name: 'pharmacy_outlet',
                displayName: 'Pharmacy Outlet Manager',
                description: 'Outlet manager with location-specific permissions',
                category: 'system',
                parentRole: 'pharmacy_team',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForSystemRole('pharmacy_outlet')
            },
            {
                name: 'intern_pharmacist',
                displayName: 'Intern Pharmacist',
                description: 'Intern pharmacist with supervised clinical permissions',
                category: 'system',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForSystemRole('intern_pharmacist')
            }
        ];

        // Create roles in hierarchy order (parents first)
        for (const roleDef of systemRoles) {
            try {
                const existingRole = await Role.findOne({ name: roleDef.name });

                if (!existingRole) {
                    // Find parent role if specified
                    let parentRoleId: mongoose.Types.ObjectId | undefined;
                    if (roleDef.parentRole) {
                        const parentRole = await Role.findOne({ name: roleDef.parentRole });
                        if (parentRole) {
                            parentRoleId = parentRole._id;
                        }
                    }

                    await Role.create({
                        name: roleDef.name,
                        displayName: roleDef.displayName,
                        description: roleDef.description,
                        category: roleDef.category,
                        parentRole: parentRoleId,
                        permissions: roleDef.staticPermissions,
                        isActive: true,
                        isSystemRole: roleDef.isSystemRole,
                        isDefault: roleDef.isDefault,
                        createdBy: this.systemUserId,
                        lastModifiedBy: this.systemUserId
                    });

                    logger.debug(`Created system role: ${roleDef.name}`);
                } else {
                    logger.debug(`System role already exists: ${roleDef.name}`);
                }
            } catch (error) {
                logger.error(`Error creating system role ${roleDef.name}:`, error);
                throw error;
            }
        }

        logger.info(`Seeded ${systemRoles.length} system roles`);
    }

    /**
     * Create workplace roles from static configuration
     */
    private async seedWorkplaceRoles(): Promise<void> {
        logger.info('Seeding workplace roles...');

        const workplaceRoles: SystemRoleDefinition[] = [
            {
                name: 'workplace_owner',
                displayName: 'Workplace Owner',
                description: 'Full workplace management and administrative permissions',
                category: 'workplace',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Owner')
            },
            {
                name: 'workplace_pharmacist',
                displayName: 'Workplace Pharmacist',
                description: 'Clinical and patient management permissions within workplace',
                category: 'workplace',
                parentRole: 'workplace_owner',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Pharmacist')
            },
            {
                name: 'workplace_staff',
                displayName: 'Workplace Staff',
                description: 'General staff permissions for daily operations',
                category: 'workplace',
                parentRole: 'workplace_pharmacist',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Staff')
            },
            {
                name: 'workplace_technician',
                displayName: 'Workplace Technician',
                description: 'Technical support and medication management permissions',
                category: 'workplace',
                parentRole: 'workplace_staff',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Technician')
            },
            {
                name: 'workplace_cashier',
                displayName: 'Workplace Cashier',
                description: 'Point of sale and basic customer service permissions',
                category: 'workplace',
                parentRole: 'workplace_technician',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Cashier')
            },
            {
                name: 'workplace_assistant',
                displayName: 'Workplace Assistant',
                description: 'Basic operational support permissions',
                category: 'workplace',
                parentRole: 'workplace_cashier',
                isSystemRole: true,
                isDefault: false,
                staticPermissions: this.getPermissionsForWorkplaceRole('Assistant')
            }
        ];

        // Create workplace roles in hierarchy order
        for (const roleDef of workplaceRoles) {
            try {
                const existingRole = await Role.findOne({ name: roleDef.name });

                if (!existingRole) {
                    // Find parent role if specified
                    let parentRoleId: mongoose.Types.ObjectId | undefined;
                    if (roleDef.parentRole) {
                        const parentRole = await Role.findOne({ name: roleDef.parentRole });
                        if (parentRole) {
                            parentRoleId = parentRole._id;
                        }
                    }

                    await Role.create({
                        name: roleDef.name,
                        displayName: roleDef.displayName,
                        description: roleDef.description,
                        category: roleDef.category,
                        parentRole: parentRoleId,
                        permissions: roleDef.staticPermissions,
                        isActive: true,
                        isSystemRole: roleDef.isSystemRole,
                        isDefault: roleDef.isDefault,
                        createdBy: this.systemUserId,
                        lastModifiedBy: this.systemUserId
                    });

                    logger.debug(`Created workplace role: ${roleDef.name}`);
                } else {
                    logger.debug(`Workplace role already exists: ${roleDef.name}`);
                }
            } catch (error) {
                logger.error(`Error creating workplace role ${roleDef.name}:`, error);
                throw error;
            }
        }

        logger.info(`Seeded ${workplaceRoles.length} workplace roles`);
    }

    /**
     * Create role-permission mappings
     */
    private async seedRolePermissions(): Promise<void> {
        logger.info('Seeding role-permission mappings...');

        const roles = await Role.find({ isSystemRole: true, isActive: true });
        let mappingCount = 0;

        for (const role of roles) {
            // Handle super admin special case
            if (role.name === 'super_admin') {
                // Super admin gets all permissions
                const allPermissions = await Permission.find({ isActive: true });

                for (const permission of allPermissions) {
                    try {
                        const existingMapping = await RolePermission.findOne({
                            roleId: role._id,
                            permissionAction: permission.action
                        });

                        if (!existingMapping) {
                            await RolePermission.create({
                                roleId: role._id,
                                permissionAction: permission.action,
                                granted: true,
                                isActive: true,
                                priority: 100, // Highest priority
                                grantedBy: this.systemUserId,
                                lastModifiedBy: this.systemUserId
                            });
                            mappingCount++;
                        }
                    } catch (error) {
                        logger.error(`Error creating role-permission mapping for ${role.name} - ${permission.action}:`, error);
                    }
                }
            } else {
                // Create mappings for role's static permissions
                for (const permissionAction of role.permissions) {
                    if (permissionAction === '*') continue; // Skip wildcard

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
                                priority: this.calculateRolePriority(role.name),
                                grantedBy: this.systemUserId,
                                lastModifiedBy: this.systemUserId
                            });
                            mappingCount++;
                        }
                    } catch (error) {
                        logger.error(`Error creating role-permission mapping for ${role.name} - ${permissionAction}:`, error);
                    }
                }
            }
        }

        logger.info(`Seeded ${mappingCount} role-permission mappings`);
    }

    /**
     * Validate seeded data integrity
     */
    private async validateSeededData(): Promise<void> {
        logger.info('Validating seeded data...');

        // Count created records
        const permissionCount = await Permission.countDocuments({ isSystemPermission: true, isActive: true });
        const roleCount = await Role.countDocuments({ isSystemRole: true, isActive: true });
        const mappingCount = await RolePermission.countDocuments({ isActive: true });

        // Validate role hierarchy
        const roles = await Role.find({ isSystemRole: true, isActive: true }).populate('parentRole');
        for (const role of roles) {
            if (role.parentRole && !(role.parentRole as any).isActive) {
                throw new Error(`Role ${role.name} has inactive parent role`);
            }
        }

        // Validate permission dependencies
        const permissions = await Permission.find({ isSystemPermission: true, isActive: true });
        for (const permission of permissions) {
            for (const dependency of permission.dependencies) {
                const dependentPermission = await Permission.findOne({ action: dependency, isActive: true });
                if (!dependentPermission) {
                    logger.warn(`Permission ${permission.action} has missing dependency: ${dependency}`);
                }
            }
        }

        logger.info(`Validation completed - Permissions: ${permissionCount}, Roles: ${roleCount}, Mappings: ${mappingCount}`);
    }

    // Helper methods
    private generateDisplayName(action: string): string {
        const [resource, operation] = action.split('.');
        if (!resource || !operation) {
            return action;
        }
        const resourceName = resource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const operationName = operation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `${resourceName} - ${operationName}`;
    }

    private generateDescription(action: string, config: any): string {
        const [resource, operation] = action.split('.');
        if (!resource || !operation) {
            return `Permission for ${action}`;
        }
        const baseDescription = `Permission to ${operation} ${resource.replace(/_/g, ' ')}`;

        if (config.planTiers?.length > 0) {
            return `${baseDescription} (requires ${config.planTiers[0]}+ plan)`;
        }

        return baseDescription;
    }

    private categorizePermission(resource: string): string {
        const categoryMap: Record<string, string> = {
            'patient': 'patient',
            'medication': 'medication',
            'clinical': 'clinical',
            'clinical_notes': 'clinical',
            'clinical_intervention': 'clinical',
            'reports': 'reports',
            'admin': 'administration',
            'workspace': 'workspace',
            'subscription': 'subscription',
            'billing': 'billing',
            'team': 'user_management',
            'invitation': 'user_management',
            'audit': 'audit',
            'api': 'integration',
            'integration': 'integration',
            'backup': 'system',
            'location': 'workspace',
            'adr': 'clinical'
        };

        return categoryMap[resource] || 'system';
    }

    private assessRiskLevel(action: string, config: any): 'low' | 'medium' | 'high' | 'critical' {
        if (action.includes('delete') || action.includes('admin')) return 'critical';
        if (action.includes('update') || action.includes('manage')) return 'high';
        if (action.includes('create') || action.includes('export')) return 'medium';
        return 'low';
    }

    private extractDependencies(action: string): string[] {
        // Define common permission dependencies (using colon notation)
        const dependencyMap: Record<string, string[]> = {
            'patient:update': ['patient:read'],
            'patient:delete': ['patient:read', 'patient:update'],
            'clinical_notes:update': ['clinical_notes:read'],
            'clinical_notes:delete': ['clinical_notes:read'],
            'medication:update': ['medication:read'],
            'medication:delete': ['medication:read']
        };

        // Convert input action from dot to colon notation for lookup
        const colonAction = action.replace('.', ':');
        const dependencies = dependencyMap[colonAction] || [];

        return dependencies;
    }

    private extractConflicts(action: string): string[] {
        // Define permission conflicts (permissions that cannot coexist) (using colon notation)
        const conflictMap: Record<string, string[]> = {
            'workspace:delete': ['workspace:transfer'],
            'subscription:cancel': ['subscription:upgrade']
        };

        // Convert input action from dot to colon notation for lookup
        const colonAction = action.replace('.', ':');
        const conflicts = conflictMap[colonAction] || [];

        return conflicts;
    }

    private getPermissionsForSystemRole(role: string): string[] {
        const permissions: string[] = [];

        for (const [action, config] of Object.entries(PERMISSION_MATRIX)) {
            if (config.systemRoles?.includes(role as any)) {
                // Convert dot notation to colon notation
                const dbAction = action.replace('.', ':');
                permissions.push(dbAction);
            }
        }

        return permissions;
    }

    private getPermissionsForWorkplaceRole(role: string): string[] {
        const permissions: string[] = [];

        for (const [action, config] of Object.entries(PERMISSION_MATRIX)) {
            if (config.workplaceRoles?.includes(role as any)) {
                // Convert dot notation to colon notation
                const dbAction = action.replace('.', ':');
                permissions.push(dbAction);
            }
        }

        return permissions;
    }

    private calculateRolePriority(roleName: string): number {
        const priorityMap: Record<string, number> = {
            'super_admin': 100,
            'owner': 90,
            'workplace_owner': 85,
            'pharmacist': 80,
            'workplace_pharmacist': 75,
            'pharmacy_team': 70,
            'workplace_staff': 65,
            'pharmacy_outlet': 60,
            'workplace_technician': 55,
            'workplace_cashier': 50,
            'intern_pharmacist': 45,
            'workplace_assistant': 40
        };

        return priorityMap[roleName] || 30;
    }
}

/**
 * Execute the seeding process
 */
export async function seedSystemRolesAndPermissions(): Promise<void> {
    const seeder = new SystemRolePermissionSeeder();
    await seeder.seed();
}

// Export for direct execution
if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas')
        .then(async () => {
            await seedSystemRolesAndPermissions();
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}