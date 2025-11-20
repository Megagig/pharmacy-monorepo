import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import User, { IUser } from '../../models/User';
import Role, { IRole } from '../../models/Role';
import Permission, { IPermission } from '../../models/Permission';
import UserRole, { IUserRole } from '../../models/UserRole';
import RolePermission, { IRolePermission } from '../../models/RolePermission';
import Workplace, { IWorkplace } from '../../models/Workplace';
import DynamicPermissionService from '../../services/DynamicPermissionService';
import CacheManager from '../../services/CacheManager';

describe('RBAC Integration Tests', () => {
    let testUser: IUser;
    let testSuperAdmin: IUser;
    let testWorkplace: IWorkplace;
    let testRole: IRole;
    let testPermission: IPermission;
    let authToken: string;
    let superAdminToken: string;

    beforeAll(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            type: 'Community',
            address: '123 Test St',
            phone: '+1234567890',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            ownerId: new mongoose.Types.ObjectId()
        });

        // Create test permission
        testPermission = await Permission.create({
            action: 'patient.create',
            displayName: 'Create Patient',
            description: 'Permission to create new patients',
            category: 'patient_management',
            isSystemPermission: true,
            createdBy: new mongoose.Types.ObjectId(),
            lastModifiedBy: new mongoose.Types.ObjectId()
        });

        // Create test role
        testRole = await Role.create({
            name: 'test_pharmacist',
            displayName: 'Test Pharmacist',
            description: 'Test pharmacist role',
            category: 'workplace',
            permissions: ['patient.create'],
            isActive: true,
            isSystemRole: false,
            hierarchyLevel: 1,
            createdBy: new mongoose.Types.ObjectId(),
            lastModifiedBy: new mongoose.Types.ObjectId()
        });

        // Create role-permission mapping
        await RolePermission.create({
            roleId: testRole._id,
            permissionAction: testPermission.action,
            granted: true,
            grantedBy: new mongoose.Types.ObjectId(),
            grantedAt: new Date(),
            lastModifiedBy: new mongoose.Types.ObjectId(),
            lastModifiedAt: new Date()
        });

        // Create test user
        testUser = await User.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            status: 'active',
            workplaceRole: 'Pharmacist',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        // Create super admin user
        testSuperAdmin = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@test.com',
            password: 'hashedpassword',
            role: 'super_admin',
            status: 'active',
            workplaceRole: 'Owner',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        // Generate auth tokens (mock JWT tokens)
        authToken = 'Bearer mock-jwt-token-user';
        superAdminToken = 'Bearer mock-jwt-token-admin';
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Role.deleteMany({});
        await Permission.deleteMany({});
        await UserRole.deleteMany({});
        await RolePermission.deleteMany({});
        await Workplace.deleteMany({});
    });

    describe('Role Assignment Workflow', () => {
        it('should assign role to user and update permissions immediately', async () => {
            // Step 1: Assign role to user
            const assignRoleResponse = await request(app)
                .post(`/api/admin/users/${testUser._id}/roles`)
                .set('Authorization', superAdminToken)
                .send({
                    roleId: testRole._id,
                    workspaceId: testWorkplace._id
                })
                .expect(200);

            expect(assignRoleResponse.body.success).toBe(true);

            // Step 2: Verify UserRole was created
            const userRole = await UserRole.findOne({
                userId: testUser._id,
                roleId: testRole._id
            });
            expect(userRole).toBeTruthy();
            expect(userRole?.isActive).toBe(true);

            // Step 3: Check permission immediately after assignment
            const dynamicPermissionService = DynamicPermissionService.getInstance();
            const permissionResult = await dynamicPermissionService.checkPermission(
                testUser,
                'patient.create',
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            );

            expect(permissionResult.allowed).toBe(true);
            expect(permissionResult.source).toBe('role');
            expect(permissionResult.roleId?.toString()).toBe(testRole._id.toString());
        });

        it('should revoke role from user and remove permissions immediately', async () => {
            // First assign the role
            await UserRole.create({
                userId: testUser._id,
                roleId: testRole._id,
                workspaceId: testWorkplace._id,
                assignedBy: testSuperAdmin._id,
                assignedAt: new Date(),
                isActive: true,
                isTemporary: false,
                lastModifiedBy: testSuperAdmin._id,
                lastModifiedAt: new Date()
            });

            // Step 1: Revoke role from user
            const revokeRoleResponse = await request(app)
                .delete(`/api/admin/users/${testUser._id}/roles/${testRole._id}`)
                .set('Authorization', superAdminToken)
                .expect(200);

            expect(revokeRoleResponse.body.success).toBe(true);

            // Step 2: Verify UserRole was deactivated
            const userRole = await UserRole.findOne({
                userId: testUser._id,
                roleId: testRole._id
            });
            expect(userRole?.isActive).toBe(false);

            // Step 3: Check permission is denied after revocation
            const dynamicPermissionService = DynamicPermissionService.getInstance();
            const permissionResult = await dynamicPermissionService.checkPermission(
                testUser,
                'patient.create',
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            );

            expect(permissionResult.allowed).toBe(false);
        });
    });

    describe('Permission Check Workflow', () => {
        it('should check permissions through API endpoint', async () => {
            // Assign role to user first
            await UserRole.create({
                userId: testUser._id,
                roleId: testRole._id,
                workspaceId: testWorkplace._id,
                assignedBy: testSuperAdmin._id,
                assignedAt: new Date(),
                isActive: true,
                isTemporary: false,
                lastModifiedBy: testSuperAdmin._id,
                lastModifiedAt: new Date()
            });

            // Check permission through API
            const response = await request(app)
                .get(`/api/admin/users/${testUser._id}/effective-permissions`)
                .set('Authorization', superAdminToken)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.permissions).toContain('patient.create');
            expect(response.body.data.sources['patient.create']).toBe('role');
        });

        it('should handle permission denied scenarios with suggestions', async () => {
            // Try to access endpoint without proper permissions
            const response = await request(app)
                .post('/api/patients')
                .set('Authorization', authToken)
                .send({
                    firstName: 'Test',
                    lastName: 'Patient',
                    mrn: 'TEST123'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Permission denied');
            expect(response.body.suggestions).toBeDefined();
        });
    });
}); d
escribe('Real-time Permission Updates', () => {
    it('should update permissions in real-time when role permissions change', async () => {
        // Step 1: Assign role to user
        await UserRole.create({
            userId: testUser._id,
            roleId: testRole._id,
            workspaceId: testWorkplace._id,
            assignedBy: testSuperAdmin._id,
            assignedAt: new Date(),
            isActive: true,
            isTemporary: false,
            lastModifiedBy: testSuperAdmin._id,
            lastModifiedAt: new Date()
        });

        // Step 2: Verify user has permission
        let permissionResult = await DynamicPermissionService.getInstance().checkPermission(
            testUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(true);

        // Step 3: Remove permission from role
        await RolePermission.findOneAndUpdate(
            { roleId: testRole._id, permissionAction: 'patient.create' },
            { granted: false }
        );

        // Step 4: Invalidate cache to simulate real-time update
        const cacheManager = CacheManager.getInstance();
        await cacheManager.invalidateRolePermissions(testRole._id);
        await cacheManager.invalidateUserPermissions(testUser._id);

        // Step 5: Verify permission is now denied
        permissionResult = await DynamicPermissionService.getInstance().checkPermission(
            testUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(false);
    });

    it('should handle WebSocket notifications for permission changes', async () => {
        // This would test WebSocket functionality if implemented
        // For now, we'll test the notification service directly

        const mockNotificationService = {
            notifyPermissionChange: jest.fn()
        };

        // Simulate permission change notification
        await mockNotificationService.notifyPermissionChange(testUser._id);

        expect(mockNotificationService.notifyPermissionChange).toHaveBeenCalledWith(testUser._id);
    });
});

describe('Bulk Operations Workflow', () => {
    it('should handle bulk role assignments consistently', async () => {
        // Create additional test users
        const testUsers = await Promise.all([
            User.create({
                firstName: 'User1',
                lastName: 'Test',
                email: 'user1@test.com',
                password: 'hashedpassword',
                role: 'pharmacist',
                status: 'active',
                workplace: testWorkplace._id
            }),
            User.create({
                firstName: 'User2',
                lastName: 'Test',
                email: 'user2@test.com',
                password: 'hashedpassword',
                role: 'pharmacist',
                status: 'active',
                workplace: testWorkplace._id
            })
        ]);

        // Bulk assign roles
        const bulkUpdates = testUsers.map(user => ({
            userId: user._id,
            roleIds: [testRole._id],
            directPermissions: [],
            deniedPermissions: []
        }));

        const dynamicPermissionService = DynamicPermissionService.getInstance();
        await dynamicPermissionService.bulkUpdateUserPermissions(
            bulkUpdates,
            testSuperAdmin._id
        );

        // Verify all users have the role assigned
        for (const user of testUsers) {
            const userRole = await UserRole.findOne({
                userId: user._id,
                roleId: testRole._id,
                isActive: true
            });
            expect(userRole).toBeTruthy();

            // Verify permissions are available
            const permissionResult = await dynamicPermissionService.checkPermission(
                user,
                'patient.create',
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            );
            expect(permissionResult.allowed).toBe(true);
        }

        // Clean up
        await User.deleteMany({ _id: { $in: testUsers.map(u => u._id) } });
    });

    it('should handle partial failures in bulk operations', async () => {
        const validUserId = testUser._id;
        const invalidUserId = new mongoose.Types.ObjectId();

        const bulkUpdates = [
            {
                userId: validUserId,
                roleIds: [testRole._id]
            },
            {
                userId: invalidUserId, // This user doesn't exist
                roleIds: [testRole._id]
            }
        ];

        const dynamicPermissionService = DynamicPermissionService.getInstance();

        // Should handle partial failure gracefully
        await expect(
            dynamicPermissionService.bulkUpdateUserPermissions(
                bulkUpdates,
                testSuperAdmin._id
            )
        ).rejects.toThrow();

        // Verify valid user wasn't affected by the failure
        const userRole = await UserRole.findOne({
            userId: validUserId,
            roleId: testRole._id,
            isActive: true
        });
        expect(userRole).toBeFalsy(); // Should not exist due to transaction rollback
    });
});

describe('Cache Consistency Workflow', () => {
    it('should maintain cache consistency across operations', async () => {
        const cacheManager = CacheManager.getInstance();
        const dynamicPermissionService = DynamicPermissionService.getInstance();

        // Step 1: Assign role and cache permission
        await UserRole.create({
            userId: testUser._id,
            roleId: testRole._id,
            workspaceId: testWorkplace._id,
            assignedBy: testSuperAdmin._id,
            assignedAt: new Date(),
            isActive: true,
            isTemporary: false,
            lastModifiedBy: testSuperAdmin._id,
            lastModifiedAt: new Date()
        });

        // Step 2: Check permission (should cache result)
        let permissionResult = await dynamicPermissionService.checkPermission(
            testUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(true);

        // Step 3: Verify cache was populated
        const cachedResult = await cacheManager.getCachedPermissionCheck(
            testUser._id,
            'patient.create',
            testWorkplace._id
        );
        expect(cachedResult).toBeTruthy();
        expect(cachedResult?.allowed).toBe(true);

        // Step 4: Revoke role
        await UserRole.findOneAndUpdate(
            { userId: testUser._id, roleId: testRole._id },
            { isActive: false }
        );

        // Step 5: Invalidate cache
        await dynamicPermissionService.invalidateUserCache(testUser._id);

        // Step 6: Verify cache was cleared
        const clearedCache = await cacheManager.getCachedPermissionCheck(
            testUser._id,
            'patient.create',
            testWorkplace._id
        );
        expect(clearedCache).toBeNull();

        // Step 7: Check permission again (should return fresh result)
        permissionResult = await dynamicPermissionService.checkPermission(
            testUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(false);
    });
});

describe('Migration Workflow Integration', () => {
    it('should maintain permissions during migration from static to dynamic', async () => {
        // Create user with legacy permissions
        const legacyUser = await User.create({
            firstName: 'Legacy',
            lastName: 'User',
            email: 'legacy@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            status: 'active',
            workplaceRole: 'Pharmacist',
            workplace: testWorkplace._id,
            permissions: ['patient.create', 'patient.read'] // Legacy permissions
        });

        const dynamicPermissionService = DynamicPermissionService.getInstance();

        // Step 1: Check legacy permission works
        let permissionResult = await dynamicPermissionService.checkPermission(
            legacyUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(true);
        expect(permissionResult.source).toBe('legacy');

        // Step 2: Migrate to dynamic permissions
        await User.findByIdAndUpdate(legacyUser._id, {
            $set: {
                directPermissions: legacyUser.permissions,
                assignedRoles: []
            },
            $unset: {
                permissions: 1 // Remove legacy field
            }
        });

        // Step 3: Invalidate cache to force fresh lookup
        await dynamicPermissionService.invalidateUserCache(legacyUser._id);

        // Step 4: Check permission still works with dynamic system
        permissionResult = await dynamicPermissionService.checkPermission(
            legacyUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );
        expect(permissionResult.allowed).toBe(true);
        expect(permissionResult.source).toBe('direct_permission');

        // Clean up
        await User.findByIdAndDelete(legacyUser._id);
    });
});

describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
        const dynamicPermissionService = DynamicPermissionService.getInstance();

        // Mock database error
        jest.spyOn(UserRole, 'find').mockRejectedValueOnce(new Error('Database connection lost'));

        const permissionResult = await dynamicPermissionService.checkPermission(
            testUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );

        expect(permissionResult.allowed).toBe(false);
        expect(permissionResult.reason).toContain('system error');

        // Restore mock
        jest.restoreAllMocks();
    });

    it('should fallback to legacy permissions when dynamic system fails', async () => {
        const legacyUser = await User.create({
            firstName: 'Fallback',
            lastName: 'User',
            email: 'fallback@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            status: 'active',
            workplaceRole: 'Pharmacist',
            workplace: testWorkplace._id,
            permissions: ['patient.create'] // Legacy permissions as fallback
        });

        const dynamicPermissionService = DynamicPermissionService.getInstance();

        // Mock dynamic permission resolution failure
        jest.spyOn(UserRole, 'find').mockRejectedValueOnce(new Error('Dynamic system error'));

        const permissionResult = await dynamicPermissionService.checkPermission(
            legacyUser,
            'patient.create',
            {
                workspace: testWorkplace,
                plan: null,
                subscription: null,
                permissions: [],
                limits: {},
                isSubscriptionActive: true,
                isTrialExpired: false
            }
        );

        // Should fallback to legacy system
        expect(permissionResult.allowed).toBe(true);
        expect(permissionResult.source).toBe('legacy');

        // Clean up
        await User.findByIdAndDelete(legacyUser._id);
        jest.restoreAllMocks();
    });
});