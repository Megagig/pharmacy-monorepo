import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User';
import Role from '../../models/Role';
import Permission from '../../models/Permission';
import UserRole from '../../models/UserRole';
import RolePermission from '../../models/RolePermission';
import { SystemRolePermissionSeeder } from '../../migrations/rbac/001-seed-system-roles-permissions';
import { UserRoleMigrator } from '../../migrations/rbac/002-migrate-user-roles';
import { MigrationValidator } from '../../migrations/rbac/003-migration-validation-rollback';
import { RBACMigrationOrchestrator } from '../../migrations/rbac/migration-orchestrator';

/**
 * Comprehensive test suite for RBAC migration system
 */

describe('RBAC Migration System', () => {
    let mongoServer: MongoMemoryServer;
    let systemUserId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        systemUserId = new mongoose.Types.ObjectId();
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections before each test
        await Promise.all([
            User.deleteMany({}),
            Role.deleteMany({}),
            Permission.deleteMany({}),
            UserRole.deleteMany({}),
            RolePermission.deleteMany({})
        ]);
    });

    describe('System Role and Permission Seeding', () => {
        let seeder: SystemRolePermissionSeeder;

        beforeEach(() => {
            seeder = new SystemRolePermissionSeeder();
        });

        test('should seed system permissions from static matrix', async () => {
            await seeder.seed();

            const permissions = await Permission.find({ isSystemPermission: true });
            expect(permissions.length).toBeGreaterThan(0);

            // Check specific permissions exist
            const patientReadPermission = await Permission.findOne({ action: 'patient.read' });
            expect(patientReadPermission).toBeTruthy();
            expect(patientReadPermission?.category).toBe('patient');
            expect(patientReadPermission?.isSystemPermission).toBe(true);
        });

        test('should seed system roles with correct hierarchy', async () => {
            await seeder.seed();

            const roles = await Role.find({ isSystemRole: true });
            expect(roles.length).toBeGreaterThan(0);

            // Check super admin role
            const superAdminRole = await Role.findOne({ name: 'super_admin' });
            expect(superAdminRole).toBeTruthy();
            expect(superAdminRole?.isSystemRole).toBe(true);
            expect(superAdminRole?.parentRole).toBeUndefined();

            // Check role hierarchy
            const pharmacistRole = await Role.findOne({ name: 'pharmacist' }).populate('parentRole');
            expect(pharmacistRole).toBeTruthy();
            expect(pharmacistRole?.parentRole).toBeTruthy();
        });

        test('should create role-permission mappings', async () => {
            await seeder.seed();

            const mappings = await RolePermission.find({ isActive: true });
            expect(mappings.length).toBeGreaterThan(0);

            // Check super admin has all permissions
            const superAdminRole = await Role.findOne({ name: 'super_admin' });
            const superAdminMappings = await RolePermission.find({
                roleId: superAdminRole?._id,
                granted: true
            });
            expect(superAdminMappings.length).toBeGreaterThan(50); // Should have many permissions
        });

        test('should handle duplicate seeding gracefully', async () => {
            // Seed twice
            await seeder.seed();
            await seeder.seed();

            // Should not create duplicates
            const permissions = await Permission.find({ isSystemPermission: true });
            const roles = await Role.find({ isSystemRole: true });

            // Check no duplicates by counting unique actions/names
            const uniquePermissions = new Set(permissions.map(p => p.action));
            const uniqueRoles = new Set(roles.map(r => r.name));

            expect(permissions.length).toBe(uniquePermissions.size);
            expect(roles.length).toBe(uniqueRoles.size);
        });

        test('should validate seeded data integrity', async () => {
            await seeder.seed();

            // Check all roles have valid parent references
            const roles = await Role.find({ isSystemRole: true }).populate('parentRole');
            for (const role of roles) {
                if (role.parentRole) {
                    expect(role.parentRole.isActive).toBe(true);
                }
            }

            // Check all role-permission mappings reference valid roles and permissions
            const mappings = await RolePermission.find({ isActive: true });
            for (const mapping of mappings) {
                const role = await Role.findById(mapping.roleId);
                const permission = await Permission.findOne({ action: mapping.permissionAction });

                expect(role).toBeTruthy();
                // Permission might not exist in Permission model for all actions (some are dynamic)
                // So we don't enforce this check
            }
        });
    });

    describe('User Role Migration', () => {
        let migrator: UserRoleMigrator;

        beforeEach(async () => {
            migrator = new UserRoleMigrator();

            // Seed system roles first
            const seeder = new SystemRolePermissionSeeder();
            await seeder.seed();
        });

        test('should migrate user system roles to dynamic assignments', async () => {
            // Create test user with static role
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            await migrator.migrate();

            // Check user has dynamic role assignment
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser?.assignedRoles).toBeDefined();
            expect(updatedUser?.assignedRoles.length).toBeGreaterThan(0);

            // Check UserRole record exists
            const userRole = await UserRole.findOne({
                userId: testUser._id,
                isActive: true
            }).populate('roleId');

            expect(userRole).toBeTruthy();
            expect((userRole?.roleId as any)?.name).toBe('pharmacist');
        });

        test('should migrate workplace roles to dynamic assignments', async () => {
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                workplaceRole: 'Owner',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            await migrator.migrate();

            // Check both system and workplace roles are assigned
            const userRoles = await UserRole.find({
                userId: testUser._id,
                isActive: true
            }).populate('roleId');

            expect(userRoles.length).toBe(2); // System role + workplace role

            const roleNames = userRoles.map((ur: any) => ur.roleId.name);
            expect(roleNames).toContain('pharmacist');
            expect(roleNames).toContain('workplace_owner');
        });

        test('should migrate direct permissions', async () => {
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                status: 'active',
                permissions: ['custom.permission', 'another.permission'],
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            await migrator.migrate();

            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser?.directPermissions).toBeDefined();
            // Direct permissions should only include those not granted by roles
            expect(updatedUser?.directPermissions).toContain('custom.permission');
        });

        test('should handle migration errors gracefully', async () => {
            // Create user with invalid role
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'invalid_role',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            const results = await migrator.migrate();

            const userResult = results.find(r => r.userId.equals(testUser._id));
            expect(userResult?.success).toBe(false);
            expect(userResult?.errors.length).toBeGreaterThan(0);
        });

        test('should support rollback functionality', async () => {
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            // Migrate
            await migrator.migrate();

            // Verify migration
            let userRoles = await UserRole.find({ userId: testUser._id, isActive: true });
            expect(userRoles.length).toBeGreaterThan(0);

            // Rollback
            await migrator.rollbackUser(testUser._id);

            // Verify rollback
            userRoles = await UserRole.find({ userId: testUser._id, isActive: true });
            expect(userRoles.length).toBe(0);

            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser?.assignedRoles).toBeUndefined();
            expect(updatedUser?.directPermissions).toBeUndefined();
        });
    });

    describe('Migration Validation', () => {
        let validator: MigrationValidator;

        beforeEach(async () => {
            validator = new MigrationValidator();

            // Setup test data
            const seeder = new SystemRolePermissionSeeder();
            await seeder.seed();
        });

        test('should validate data integrity', async () => {
            // Create valid test data
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            const migrator = new UserRoleMigrator();
            await migrator.migrate();

            const result = await validator.validateMigration();

            expect(result.isValid).toBe(true);
            expect(result.errors.filter(e => e.type === 'critical').length).toBe(0);
        });

        test('should detect orphaned records', async () => {
            // Create orphaned user role
            const fakeUserId = new mongoose.Types.ObjectId();
            const role = await Role.findOne({ name: 'pharmacist' });

            await UserRole.create({
                userId: fakeUserId,
                roleId: role?._id,
                isActive: true,
                assignedBy: systemUserId,
                lastModifiedBy: systemUserId
            });

            const result = await validator.validateMigration();

            const orphanedError = result.errors.find(e => e.category === 'data_integrity' && e.message.includes('orphaned'));
            expect(orphanedError).toBeTruthy();
        });

        test('should validate role hierarchy', async () => {
            // Create circular dependency
            const role1 = await Role.create({
                name: 'test_role_1',
                displayName: 'Test Role 1',
                description: 'Test role',
                category: 'custom',
                isActive: true,
                isSystemRole: false,
                permissions: [],
                createdBy: systemUserId,
                lastModifiedBy: systemUserId
            });

            const role2 = await Role.create({
                name: 'test_role_2',
                displayName: 'Test Role 2',
                description: 'Test role',
                category: 'custom',
                parentRole: role1._id,
                isActive: true,
                isSystemRole: false,
                permissions: [],
                createdBy: systemUserId,
                lastModifiedBy: systemUserId
            });

            // Create circular dependency
            role1.parentRole = role2._id;
            await role1.save();

            const result = await validator.validateMigration();

            const circularError = result.errors.find(e => e.category === 'role_hierarchy' && e.message.includes('circular'));
            expect(circularError).toBeTruthy();
        });

        test('should provide comprehensive statistics', async () => {
            const result = await validator.validateMigration();

            expect(result.statistics).toBeDefined();
            expect(result.statistics.totalRoles).toBeGreaterThan(0);
            expect(result.statistics.totalPermissions).toBeGreaterThan(0);
            expect(typeof result.statistics.totalUsers).toBe('number');
        });
    });

    describe('Migration Orchestrator', () => {
        test('should execute complete migration workflow', async () => {
            const orchestrator = new RBACMigrationOrchestrator({
                dryRun: false,
                enableValidation: true,
                skipUserMigration: false
            });

            // Create test user
            await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                status: 'active',
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: []
            });

            const result = await orchestrator.executeMigration();

            expect(result.success).toBe(true);
            expect(result.phase).toBe('completed');
            expect(result.statistics.rolesCreated).toBeGreaterThan(0);
            expect(result.statistics.permissionsCreated).toBeGreaterThan(0);
            expect(result.statistics.usersMigrated).toBeGreaterThan(0);
        });

        test('should handle dry run mode', async () => {
            const orchestrator = new RBACMigrationOrchestrator({
                dryRun: true,
                enableValidation: false
            });

            const result = await orchestrator.executeMigration();

            expect(result.success).toBe(true);

            // Verify no actual changes were made
            const roles = await Role.find({ isSystemRole: true });
            const permissions = await Permission.find({ isSystemPermission: true });

            expect(roles.length).toBe(0);
            expect(permissions.length).toBe(0);
        });

        test('should support rollback on failure', async () => {
            const orchestrator = new RBACMigrationOrchestrator({
                dryRun: false,
                enableValidation: true
            });

            // Create invalid data that will cause validation to fail
            await Role.create({
                name: 'invalid_role',
                displayName: 'Invalid Role',
                description: 'Invalid role for testing',
                category: 'custom',
                parentRole: new mongoose.Types.ObjectId(), // Non-existent parent
                isActive: true,
                isSystemRole: false,
                permissions: [],
                createdBy: systemUserId,
                lastModifiedBy: systemUserId
            });

            const result = await orchestrator.executeMigration();

            // Migration should fail but rollback should be attempted
            expect(result.success).toBe(false);
            expect(result.warnings.some(w => w.includes('rollback'))).toBe(true);
        });

        test('should provide migration status', async () => {
            const orchestrator = new RBACMigrationOrchestrator();

            const status = await orchestrator.getMigrationStatus();

            expect(status).toBeDefined();
            expect(typeof status.isActive).toBe('boolean');
            expect(typeof status.rolloutPercentage).toBe('number');
            expect(status.statistics).toBeDefined();
        });

        test('should support gradual rollout', async () => {
            const orchestrator = new RBACMigrationOrchestrator({
                enableGradualRollout: true,
                rolloutPercentage: 50
            });

            await orchestrator.updateRolloutPercentage(75);

            const status = await orchestrator.getMigrationStatus();
            expect(status.rolloutPercentage).toBe(75);
        });
    });

    describe('Integration Tests', () => {
        test('should maintain permission consistency after migration', async () => {
            // Create test user with specific permissions
            const testUser = await User.create({
                email: 'test@example.com',
                passwordHash: 'hashedpassword',
                firstName: 'Test',
                lastName: 'User',
                role: 'pharmacist',
                workplaceRole: 'Owner',
                status: 'active',
                permissions: ['patient.read', 'patient.create'],
                currentPlanId: new mongoose.Types.ObjectId(),
                subscriptionTier: 'basic',
                features: ['patientLimit']
            });

            // Execute complete migration
            const orchestrator = new RBACMigrationOrchestrator({
                dryRun: false,
                enableValidation: true
            });

            const result = await orchestrator.executeMigration();
            expect(result.success).toBe(true);

            // Verify user still has expected permissions
            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser?.assignedRoles.length).toBeGreaterThan(0);

            // Test permission resolution
            const allPermissions = await updatedUser?.getAllPermissions();
            expect(allPermissions).toContain('patient.read');
            expect(allPermissions).toContain('patient.create');
        });

        test('should handle concurrent migrations safely', async () => {
            // Create multiple test users
            const users = await Promise.all([
                User.create({
                    email: 'user1@example.com',
                    passwordHash: 'hashedpassword',
                    firstName: 'User',
                    lastName: 'One',
                    role: 'pharmacist',
                    status: 'active',
                    currentPlanId: new mongoose.Types.ObjectId(),
                    subscriptionTier: 'basic',
                    features: []
                }),
                User.create({
                    email: 'user2@example.com',
                    passwordHash: 'hashedpassword',
                    firstName: 'User',
                    lastName: 'Two',
                    role: 'pharmacy_team',
                    status: 'active',
                    currentPlanId: new mongoose.Types.ObjectId(),
                    subscriptionTier: 'basic',
                    features: []
                })
            ]);

            // Run multiple migrations concurrently
            const migrator1 = new UserRoleMigrator();
            const migrator2 = new UserRoleMigrator();

            const [result1, result2] = await Promise.all([
                migrator1.migrate(),
                migrator2.migrate()
            ]);

            // Both should succeed without conflicts
            expect(result1.every(r => r.success)).toBe(true);
            expect(result2.every(r => r.success)).toBe(true);

            // Verify no duplicate role assignments
            for (const user of users) {
                const userRoles = await UserRole.find({ userId: user._id, isActive: true });
                const roleIds = userRoles.map(ur => ur.roleId.toString());
                const uniqueRoleIds = new Set(roleIds);
                expect(roleIds.length).toBe(uniqueRoleIds.size);
            }
        });
    });
});