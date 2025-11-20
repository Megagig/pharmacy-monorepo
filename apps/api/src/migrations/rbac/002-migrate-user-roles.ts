import mongoose from 'mongoose';
import User from '../../models/User';
import Role from '../../models/Role';
import UserRole from '../../models/UserRole';
import logger from '../../utils/logger';

/**
 * Migration script to convert static user role assignments to dynamic role assignments
 * This migrates user.role and user.workplaceRole to the new UserRole junction table
 */

interface UserMigrationResult {
    userId: mongoose.Types.ObjectId;
    email: string;
    staticRole: string;
    staticWorkplaceRole?: string;
    assignedRoles: string[];
    directPermissions: string[];
    success: boolean;
    errors: string[];
}

export class UserRoleMigrator {
    private systemUserId: mongoose.Types.ObjectId;
    private migrationResults: UserMigrationResult[] = [];

    constructor() {
        // Create a system user ID for audit purposes
        this.systemUserId = new mongoose.Types.ObjectId();
    }

    /**
     * Main migration function
     */
    async migrate(): Promise<UserMigrationResult[]> {
        try {
            logger.info('Starting user role migration...');

            // Step 1: Get all users that need migration
            const users = await User.find({
                $or: [
                    { role: { $exists: true, $ne: null } },
                    { workplaceRole: { $exists: true, $ne: null } }
                ]
            });

            logger.info(`Found ${users.length} users to migrate`);

            // Step 2: Migrate each user
            for (const user of users) {
                await this.migrateUser(user);
            }

            // Step 3: Validate migration results
            await this.validateMigration();

            // Step 4: Generate migration report
            this.generateMigrationReport();

            logger.info('User role migration completed successfully');
            return this.migrationResults;

        } catch (error) {
            logger.error('Error during user role migration:', error);
            throw error;
        }
    }

    /**
     * Migrate a single user's roles
     */
    private async migrateUser(user: any): Promise<void> {
        const migrationResult: UserMigrationResult = {
            userId: user._id,
            email: user.email,
            staticRole: user.role,
            staticWorkplaceRole: user.workplaceRole,
            assignedRoles: [],
            directPermissions: [],
            success: false,
            errors: []
        };

        try {
            const session = await mongoose.startSession();

            await session.withTransaction(async () => {
                // Step 1: Migrate system role
                if (user.role) {
                    await this.migrateSystemRole(user, migrationResult, session);
                }

                // Step 2: Migrate workplace role
                if (user.workplaceRole) {
                    await this.migrateWorkplaceRole(user, migrationResult, session);
                }

                // Step 3: Migrate existing permissions array to directPermissions
                if (user.permissions && user.permissions.length > 0) {
                    await this.migrateDirectPermissions(user, migrationResult, session);
                }

                // Step 4: Update user document with dynamic role fields
                await this.updateUserDocument(user, migrationResult, session);

                migrationResult.success = true;
            });

            await session.endSession();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            migrationResult.errors.push(errorMessage);
            logger.error(`Error migrating user ${user.email}:`, error);
        }

        this.migrationResults.push(migrationResult);
    }

    /**
     * Migrate user's system role to dynamic role assignment
     */
    private async migrateSystemRole(
        user: any,
        result: UserMigrationResult,
        session: mongoose.ClientSession
    ): Promise<void> {
        // Find corresponding dynamic role
        const systemRole = await Role.findOne({
            name: user.role,
            category: 'system',
            isActive: true
        }).session(session);

        if (!systemRole) {
            result.errors.push(`System role '${user.role}' not found in dynamic roles`);
            return;
        }

        // Check if role assignment already exists
        const existingAssignment = await UserRole.findOne({
            userId: user._id,
            roleId: systemRole._id,
            isActive: true
        }).session(session);

        if (existingAssignment) {
            result.assignedRoles.push(systemRole.name);
            return;
        }

        // Create new role assignment
        const userRole = new UserRole({
            userId: user._id,
            roleId: systemRole._id,
            workspaceId: user.workplaceId,
            isTemporary: false,
            isActive: true,
            assignedBy: this.systemUserId,
            assignedAt: new Date(),
            lastModifiedBy: this.systemUserId,
            assignmentReason: 'Migrated from static role assignment',
            assignmentContext: {
                migrationType: 'system_role',
                originalRole: user.role,
                migrationDate: new Date()
            }
        });

        await userRole.save({ session });
        result.assignedRoles.push(systemRole.name);

        logger.debug(`Migrated system role ${user.role} for user ${user.email}`);
    }

    /**
     * Migrate user's workplace role to dynamic role assignment
     */
    private async migrateWorkplaceRole(
        user: any,
        result: UserMigrationResult,
        session: mongoose.ClientSession
    ): Promise<void> {
        // Map workplace role to dynamic role name
        const workplaceRoleMap: Record<string, string> = {
            'Owner': 'workplace_owner',
            'Pharmacist': 'workplace_pharmacist',
            'Staff': 'workplace_staff',
            'Technician': 'workplace_technician',
            'Cashier': 'workplace_cashier',
            'Assistant': 'workplace_assistant'
        };

        const dynamicRoleName = workplaceRoleMap[user.workplaceRole];
        if (!dynamicRoleName) {
            result.errors.push(`Unknown workplace role '${user.workplaceRole}'`);
            return;
        }

        // Find corresponding dynamic role
        const workplaceRole = await Role.findOne({
            name: dynamicRoleName,
            category: 'workplace',
            isActive: true
        }).session(session);

        if (!workplaceRole) {
            result.errors.push(`Workplace role '${dynamicRoleName}' not found in dynamic roles`);
            return;
        }

        // Check if role assignment already exists
        const existingAssignment = await UserRole.findOne({
            userId: user._id,
            roleId: workplaceRole._id,
            workspaceId: user.workplaceId,
            isActive: true
        }).session(session);

        if (existingAssignment) {
            result.assignedRoles.push(workplaceRole.name);
            return;
        }

        // Create new role assignment
        const userRole = new UserRole({
            userId: user._id,
            roleId: workplaceRole._id,
            workspaceId: user.workplaceId,
            isTemporary: false,
            isActive: true,
            assignedBy: this.systemUserId,
            assignedAt: new Date(),
            lastModifiedBy: this.systemUserId,
            assignmentReason: 'Migrated from static workplace role assignment',
            assignmentContext: {
                migrationType: 'workplace_role',
                originalRole: user.workplaceRole,
                migrationDate: new Date()
            }
        });

        await userRole.save({ session });
        result.assignedRoles.push(workplaceRole.name);

        logger.debug(`Migrated workplace role ${user.workplaceRole} for user ${user.email}`);
    }

    /**
     * Migrate user's permissions array to directPermissions
     */
    private async migrateDirectPermissions(
        user: any,
        result: UserMigrationResult,
        session: mongoose.ClientSession
    ): Promise<void> {
        // Filter out permissions that would be granted by roles
        const rolePermissions = await this.getRolePermissions(user, session);
        const directPermissions = user.permissions.filter((permission: string) =>
            !rolePermissions.includes(permission)
        );

        if (directPermissions.length > 0) {
            result.directPermissions = directPermissions;
            logger.debug(`Migrated ${directPermissions.length} direct permissions for user ${user.email}`);
        }
    }

    /**
     * Get all permissions that would be granted by user's roles
     */
    private async getRolePermissions(user: any, session: mongoose.ClientSession): Promise<string[]> {
        const allPermissions = new Set<string>();

        // Get system role permissions
        if (user.role) {
            const systemRole = await Role.findOne({
                name: user.role,
                category: 'system',
                isActive: true
            }).session(session);

            if (systemRole) {
                const rolePermissions = await (systemRole as any).getAllPermissions();
                rolePermissions.forEach((permission: string) => allPermissions.add(permission));
            }
        }

        // Get workplace role permissions
        if (user.workplaceRole) {
            const workplaceRoleMap: Record<string, string> = {
                'Owner': 'workplace_owner',
                'Pharmacist': 'workplace_pharmacist',
                'Staff': 'workplace_staff',
                'Technician': 'workplace_technician',
                'Cashier': 'workplace_cashier',
                'Assistant': 'workplace_assistant'
            };

            const dynamicRoleName = workplaceRoleMap[user.workplaceRole];
            if (dynamicRoleName) {
                const workplaceRole = await Role.findOne({
                    name: dynamicRoleName,
                    category: 'workplace',
                    isActive: true
                }).session(session);

                if (workplaceRole) {
                    const rolePermissions = await (workplaceRole as any).getAllPermissions();
                    rolePermissions.forEach((permission: string) => allPermissions.add(permission));
                }
            }
        }

        return Array.from(allPermissions);
    }

    /**
     * Update user document with dynamic role fields
     */
    private async updateUserDocument(
        user: any,
        result: UserMigrationResult,
        session: mongoose.ClientSession
    ): Promise<void> {
        // Get assigned role IDs
        const assignedRoleIds: mongoose.Types.ObjectId[] = [];

        for (const roleName of result.assignedRoles) {
            const role = await Role.findOne({ name: roleName, isActive: true }).session(session);
            if (role) {
                assignedRoleIds.push(role._id);
            }
        }

        // Update user document
        await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    assignedRoles: assignedRoleIds,
                    directPermissions: result.directPermissions,
                    deniedPermissions: [], // Initialize as empty
                    roleLastModifiedBy: this.systemUserId,
                    roleLastModifiedAt: new Date(),
                    // Clear cached permissions to force refresh
                    cachedPermissions: undefined
                }
            },
            { session }
        );

        logger.debug(`Updated user document for ${user.email}`);
    }

    /**
     * Validate migration results
     */
    private async validateMigration(): Promise<void> {
        logger.info('Validating user role migration...');

        const successfulMigrations = this.migrationResults.filter(r => r.success);
        const failedMigrations = this.migrationResults.filter(r => !r.success);

        // Validate successful migrations
        for (const result of successfulMigrations) {
            const user = await User.findById(result.userId);
            if (!user) {
                throw new Error(`User ${result.email} not found after migration`);
            }

            // Verify role assignments exist
            const userRoles = await UserRole.find({
                userId: result.userId,
                isActive: true
            }).populate('roleId');

            const assignedRoleNames = userRoles.map((ur: any) => ur.roleId.name);

            for (const expectedRole of result.assignedRoles) {
                if (!assignedRoleNames.includes(expectedRole)) {
                    throw new Error(`Role assignment ${expectedRole} missing for user ${result.email}`);
                }
            }

            // Verify direct permissions
            if (result.directPermissions.length > 0) {
                const userDirectPermissions = user.directPermissions || [];
                for (const expectedPermission of result.directPermissions) {
                    if (!userDirectPermissions.includes(expectedPermission)) {
                        throw new Error(`Direct permission ${expectedPermission} missing for user ${result.email}`);
                    }
                }
            }
        }

        logger.info(`Migration validation completed - Success: ${successfulMigrations.length}, Failed: ${failedMigrations.length}`);
    }

    /**
     * Generate migration report
     */
    private generateMigrationReport(): void {
        const successful = this.migrationResults.filter(r => r.success).length;
        const failed = this.migrationResults.filter(r => !r.success).length;
        const totalRolesAssigned = this.migrationResults.reduce((sum, r) => sum + r.assignedRoles.length, 0);
        const totalDirectPermissions = this.migrationResults.reduce((sum, r) => sum + r.directPermissions.length, 0);

        logger.info('=== USER ROLE MIGRATION REPORT ===');
        logger.info(`Total users processed: ${this.migrationResults.length}`);
        logger.info(`Successful migrations: ${successful}`);
        logger.info(`Failed migrations: ${failed}`);
        logger.info(`Total roles assigned: ${totalRolesAssigned}`);
        logger.info(`Total direct permissions migrated: ${totalDirectPermissions}`);

        // Log failed migrations
        if (failed > 0) {
            logger.warn('Failed migrations:');
            this.migrationResults
                .filter(r => !r.success)
                .forEach(r => {
                    logger.warn(`- ${r.email}: ${r.errors.join(', ')}`);
                });
        }

        logger.info('=== END MIGRATION REPORT ===');
    }

    /**
     * Rollback migration for a specific user
     */
    async rollbackUser(userId: mongoose.Types.ObjectId): Promise<void> {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Remove dynamic role assignments created by migration
                await UserRole.deleteMany({
                    userId,
                    assignmentReason: { $regex: /migrated from static/i }
                }, { session });

                // Clear dynamic role fields from user
                await User.findByIdAndUpdate(
                    userId,
                    {
                        $unset: {
                            assignedRoles: 1,
                            directPermissions: 1,
                            deniedPermissions: 1,
                            roleLastModifiedBy: 1,
                            roleLastModifiedAt: 1,
                            cachedPermissions: 1
                        }
                    },
                    { session }
                );
            });

            logger.info(`Rolled back migration for user ${userId}`);
        } finally {
            await session.endSession();
        }
    }

    /**
     * Rollback entire migration
     */
    async rollbackAll(): Promise<void> {
        logger.info('Rolling back user role migration...');

        // Remove all migration-created role assignments
        const result = await UserRole.deleteMany({
            assignmentReason: { $regex: /migrated from static/i }
        });

        // Clear dynamic role fields from all users
        await User.updateMany(
            {
                $or: [
                    { assignedRoles: { $exists: true } },
                    { directPermissions: { $exists: true } },
                    { deniedPermissions: { $exists: true } }
                ]
            },
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

        logger.info(`Rollback completed - Removed ${result.deletedCount} role assignments`);
    }
}

/**
 * Execute the user role migration
 */
export async function migrateUserRoles(): Promise<UserMigrationResult[]> {
    const migrator = new UserRoleMigrator();
    return await migrator.migrate();
}

/**
 * Rollback user role migration
 */
export async function rollbackUserRoleMigration(): Promise<void> {
    const migrator = new UserRoleMigrator();
    await migrator.rollbackAll();
}

// Export for direct execution
if (require.main === module) {
    const command = process.argv[2];

    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas')
        .then(async () => {
            if (command === 'rollback') {
                await rollbackUserRoleMigration();
            } else {
                await migrateUserRoles();
            }
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}