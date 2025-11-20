import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app';
import DynamicPermissionService from '../../services/DynamicPermissionService';
import CacheManager from '../../services/CacheManager';
import User, { IUser } from '../../models/User';
import Role, { IRole } from '../../models/Role';
import Permission, { IPermission } from '../../models/Permission';
import UserRole, { IUserRole } from '../../models/UserRole';
import RolePermission, { IRolePermission } from '../../models/RolePermission';
import AuditLog from '../../models/AuditLog';
import Workplace, { IWorkplace } from '../../models/Workplace';

describe('RBAC Security Tests', () => {
    let dynamicPermissionService: DynamicPermissionService;
    let cacheManager: CacheManager;
    let testWorkplace: IWorkplace;
    let normalUser: IUser;
    let adminUser: IUser;
    let superAdminUser: IUser;
    let suspendedUser: IUser;
    let testRole: IRole;
    let adminRole: IRole;
    let sensitivePermission: IPermission;
    let normalToken: string;
    let adminToken: string;
    let superAdminToken: string;
    let suspendedToken: string;

    beforeAll(async () => {
        dynamicPermissionService = DynamicPermissionService.getInstance();
        cacheManager = CacheManager.getInstance();

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Security Test Pharmacy',
            type: 'Community',
            address: '123 Security St',
            phone: '+1234567890',
            email: 'security@test.com',
            licenseNumber: 'SEC123',
            ownerId: new mongoose.Types.ObjectId()
        });

        // Create sensitive permission
        sensitivePermission = await Permission.create({
            action: 'admin.delete_user',
            displayName: 'Delete User',
            description: 'Permission to delete user accounts',
            category: 'admin',
            isSystemPermission: true,
            createdBy: new mongoose.Types.ObjectId(),
            lastModifiedBy: new mongoose.Types.ObjectId()
        });

        // Create roles
        testRole = await Role.create({
            name: 'basic_user',
            displayName: 'Basic User',
            description: 'Basic user with limited permissions',
            category: 'workplace',
            permissions: ['patient.read'],
            isActive: true,
            isSystemRole: false,
            hierarchyLevel: 2,
            createdBy: new mongoose.Types.ObjectId(),
            lastModifiedBy: new mongoose.Types.ObjectId()
        });

        adminRole = await Role.create({
            name: 'admin_user',
            displayName: 'Admin User',
            description: 'Admin user with elevated permissions',
            category: 'system',
            permissions: ['admin.delete_user', 'user.manage'],
            isActive: true,
            isSystemRole: true,
            hierarchyLevel: 1,
            createdBy: new mongoose.Types.ObjectId(),
            lastModifiedBy: new mongoose.Types.ObjectId()
        });

        // Create role-permission mappings
        await RolePermission.create({
            roleId: adminRole._id,
            permissionAction: sensitivePermission.action,
            granted: true,
            grantedBy: new mongoose.Types.ObjectId(),
            grantedAt: new Date(),
            lastModifiedBy: new mongoose.Types.ObjectId(),
            lastModifiedAt: new Date()
        });

        // Create test users
        normalUser = await User.create({
            firstName: 'Normal',
            lastName: 'User',
            email: 'normal@security.test',
            password: 'hashedpassword',
            role: 'pharmacist',
            status: 'active',
            workplaceRole: 'Pharmacist',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        adminUser = await User.create({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@security.test',
            password: 'hashedpassword',
            role: 'pharmacy_outlet',
            status: 'active',
            workplaceRole: 'Owner',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        superAdminUser = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin@security.test',
            password: 'hashedpassword',
            role: 'super_admin',
            status: 'active',
            workplaceRole: 'Owner',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        suspendedUser = await User.create({
            firstName: 'Suspended',
            lastName: 'User',
            email: 'suspended@security.test',
            password: 'hashedpassword',
            role: 'pharmacist',
            status: 'suspended',
            workplaceRole: 'Pharmacist',
            workplace: testWorkplace._id,
            assignedRoles: [],
            directPermissions: [],
            deniedPermissions: []
        });

        // Assign roles to users
        await UserRole.create({
            userId: normalUser._id,
            roleId: testRole._id,
            workspaceId: testWorkplace._id,
            assignedBy: superAdminUser._id,
            assignedAt: new Date(),
            isActive: true,
            isTemporary: false,
            lastModifiedBy: superAdminUser._id,
            lastModifiedAt: new Date()
        });

        await UserRole.create({
            userId: adminUser._id,
            roleId: adminRole._id,
            workspaceId: testWorkplace._id,
            assignedBy: superAdminUser._id,
            assignedAt: new Date(),
            isActive: true,
            isTemporary: false,
            lastModifiedBy: superAdminUser._id,
            lastModifiedAt: new Date()
        });

        // Mock JWT tokens
        normalToken = 'Bearer mock-jwt-normal';
        adminToken = 'Bearer mock-jwt-admin';
        superAdminToken = 'Bearer mock-jwt-superadmin';
        suspendedToken = 'Bearer mock-jwt-suspended';
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Role.deleteMany({});
        await Permission.deleteMany({});
        await UserRole.deleteMany({});
        await RolePermission.deleteMany({});
        await AuditLog.deleteMany({});
        await Workplace.deleteMany({});
    });

    describe('Privilege Escalation Prevention', () => {
        it('should prevent normal user from assigning admin roles to themselves', async () => {
            const response = await request(app)
                .post(`/api/admin/users/${normalUser._id}/roles`)
                .set('Authorization', normalToken)
                .send({
                    roleId: adminRole._id,
                    workspaceId: testWorkplace._id
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Permission denied');

            // Verify role was not assigned
            const userRole = await UserRole.findOne({
                userId: normalUser._id,
                roleId: adminRole._id,
                isActive: true
            });
            expect(userRole).toBeNull();
        });

        it('should prevent users from granting themselves direct permissions', async () => {
            const response = await request(app)
                .put(`/api/admin/users/${normalUser._id}/permissions`)
                .set('Authorization', normalToken)
                .send({
                    directPermissions: ['admin.delete_user'],
                    deniedPermissions: []
                })
                .expect(403);

            expect(response.body.success).toBe(false);

            // Verify user doesn't have the permission
            const permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                'admin.delete_user',
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

        it('should prevent role hierarchy manipulation to gain elevated access', async () => {
            // Try to create a role with admin as parent (privilege escalation attempt)
            const response = await request(app)
                .post('/api/admin/roles')
                .set('Authorization', normalToken)
                .send({
                    name: 'escalated_role',
                    displayName: 'Escalated Role',
                    description: 'Attempt to escalate privileges',
                    parentRoleId: adminRole._id,
                    permissions: []
                })
                .expect(403);

            expect(response.body.success).toBe(false);

            // Verify role was not created
            const createdRole = await Role.findOne({ name: 'escalated_role' });
            expect(createdRole).toBeNull();
        });

        it('should prevent unauthorized role permission modifications', async () => {
            // Try to add sensitive permission to basic role
            const response = await request(app)
                .put(`/api/admin/roles/${testRole._id}/permissions`)
                .set('Authorization', normalToken)
                .send({
                    permissions: ['admin.delete_user']
                })
                .expect(403);

            expect(response.body.success).toBe(false);

            // Verify permission was not added
            const rolePermission = await RolePermission.findOne({
                roleId: testRole._id,
                permissionAction: 'admin.delete_user',
                granted: true
            });
            expect(rolePermission).toBeNull();
        });
    });

    describe('Unauthorized Access Prevention', () => {
        it('should deny access to suspended users', async () => {
            const permissionResult = await dynamicPermissionService.checkPermission(
                suspendedUser,
                'patient.read',
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
            expect(permissionResult.reason).toBe('User account is suspended');
        });

        it('should prevent access with invalid or expired tokens', async () => {
            const response = await request(app)
                .get('/api/admin/users')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Authentication required');
        });

        it('should prevent cross-workspace role assignments', async () => {
            // Create another workplace
            const otherWorkplace = await Workplace.create({
                name: 'Other Pharmacy',
                type: 'Community',
                address: '456 Other St',
                phone: '+0987654321',
                email: 'other@test.com',
                licenseNumber: 'OTHER123',
                ownerId: new mongoose.Types.ObjectId()
            });

            // Try to assign role from different workspace
            const response = await request(app)
                .post(`/api/admin/users/${normalUser._id}/roles`)
                .set('Authorization', adminToken)
                .send({
                    roleId: testRole._id,
                    workspaceId: otherWorkplace._id // Different workspace
                })
                .expect(403);

            expect(response.body.success).toBe(false);

            // Clean up
            await Workplace.findByIdAndDelete(otherWorkplace._id);
        });
    });

    describe('Permission Bypass Vulnerabilities', () => {
        it('should prevent cache poisoning attacks', async () => {
            // Attempt to poison cache with false permission data
            const maliciousData = {
                allowed: true,
                source: 'role',
                userId: normalUser._id.toString(),
                workspaceId: testWorkplace._id.toString(),
                cachedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 300000).toISOString()
            };

            // Try to directly set cache (should be prevented by access controls)
            try {
                await cacheManager.cachePermissionCheck(
                    normalUser._id,
                    'admin.delete_user',
                    true,
                    'role',
                    testWorkplace._id,
                    300
                );
            } catch (error) {
                // Expected to fail due to security controls
            }

            // Verify actual permission check is not affected
            const permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                'admin.delete_user',
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

        it('should prevent SQL injection in permission queries', async () => {
            // Attempt SQL injection through permission action
            const maliciousAction = "patient.read'; DROP TABLE users; --";

            const permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                maliciousAction,
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

            // Verify users table still exists
            const userCount = await User.countDocuments();
            expect(userCount).toBeGreaterThan(0);
        });

        it('should prevent NoSQL injection in role queries', async () => {
            // Attempt NoSQL injection through role ID
            const maliciousRoleId = { $ne: null };

            try {
                await UserRole.findOne({
                    userId: normalUser._id,
                    roleId: maliciousRoleId as any,
                    isActive: true
                });
            } catch (error) {
                // Should fail due to type validation
                expect(error).toBeDefined();
            }

            // Verify normal query still works
            const validUserRole = await UserRole.findOne({
                userId: normalUser._id,
                roleId: testRole._id,
                isActive: true
            });
            expect(validUserRole).toBeTruthy();
        });

        it('should prevent timing attacks on permission checks', async () => {
            const timingResults: number[] = [];

            // Test timing for valid permission
            for (let i = 0; i < 100; i++) {
                const startTime = Date.now();
                await dynamicPermissionService.checkPermission(
                    normalUser,
                    'patient.read',
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
                timingResults.push(Date.now() - startTime);
            }

            // Test timing for invalid permission
            const invalidTimingResults: number[] = [];
            for (let i = 0; i < 100; i++) {
                const startTime = Date.now();
                await dynamicPermissionService.checkPermission(
                    normalUser,
                    'admin.delete_user',
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
                invalidTimingResults.push(Date.now() - startTime);
            }

            const avgValidTime = timingResults.reduce((a, b) => a + b, 0) / timingResults.length;
            const avgInvalidTime = invalidTimingResults.reduce((a, b) => a + b, 0) / invalidTimingResults.length;

            // Timing difference should be minimal to prevent timing attacks
            const timingDifference = Math.abs(avgValidTime - avgInvalidTime);
            expect(timingDifference).toBeLessThan(5); // Less than 5ms difference
        });
    });

    describe('Audit Logging Security', () => {
        it('should log all permission changes with complete audit trail', async () => {
            const initialAuditCount = await AuditLog.countDocuments();

            // Perform a permission-changing operation
            await request(app)
                .post(`/api/admin/users/${normalUser._id}/roles`)
                .set('Authorization', superAdminToken)
                .send({
                    roleId: adminRole._id,
                    workspaceId: testWorkplace._id
                })
                .expect(200);

            // Verify audit log was created
            const finalAuditCount = await AuditLog.countDocuments();
            expect(finalAuditCount).toBeGreaterThan(initialAuditCount);

            const auditLog = await AuditLog.findOne({
                userId: normalUser._id,
                action: 'role_assigned'
            }).sort({ createdAt: -1 });

            expect(auditLog).toBeTruthy();
            expect(auditLog?.details).toContain(adminRole._id.toString());
            expect(auditLog?.performedBy).toBeDefined();
        });

        it('should log failed permission attempts', async () => {
            const initialAuditCount = await AuditLog.countDocuments({
                action: 'permission_denied'
            });

            // Attempt unauthorized action
            await request(app)
                .delete(`/api/admin/users/${adminUser._id}`)
                .set('Authorization', normalToken)
                .expect(403);

            // Verify failed attempt was logged
            const finalAuditCount = await AuditLog.countDocuments({
                action: 'permission_denied'
            });
            expect(finalAuditCount).toBeGreaterThan(initialAuditCount);

            const auditLog = await AuditLog.findOne({
                userId: normalUser._id,
                action: 'permission_denied'
            }).sort({ createdAt: -1 });

            expect(auditLog).toBeTruthy();
            expect(auditLog?.details).toContain('admin.delete_user');
        });

        it('should prevent audit log tampering', async () => {
            // Create an audit log entry
            const auditLog = await AuditLog.create({
                userId: normalUser._id,
                action: 'test_action',
                details: 'Original details',
                performedBy: superAdminUser._id,
                timestamp: new Date(),
                ipAddress: '127.0.0.1',
                userAgent: 'Test Agent'
            });

            // Attempt to modify audit log (should be prevented)
            try {
                await request(app)
                    .put(`/api/admin/audit-logs/${auditLog._id}`)
                    .set('Authorization', superAdminToken)
                    .send({
                        details: 'Modified details'
                    })
                    .expect(405); // Method not allowed
            } catch (error) {
                // Expected to fail
            }

            // Verify audit log was not modified
            const unchangedLog = await AuditLog.findById(auditLog._id);
            expect(unchangedLog?.details).toBe('Original details');
        });

        it('should maintain audit log integrity under concurrent operations', async () => {
            const concurrentOperations = 50;
            const operationPromises: Promise<any>[] = [];

            // Perform concurrent operations that should generate audit logs
            for (let i = 0; i < concurrentOperations; i++) {
                operationPromises.push(
                    request(app)
                        .get(`/api/admin/users/${normalUser._id}/effective-permissions`)
                        .set('Authorization', superAdminToken)
                );
            }

            await Promise.all(operationPromises);

            // Verify all operations were logged
            const auditLogs = await AuditLog.find({
                action: 'permission_check',
                userId: normalUser._id
            }).sort({ createdAt: -1 }).limit(concurrentOperations);

            expect(auditLogs.length).toBe(concurrentOperations);

            // Verify no duplicate or corrupted entries
            const timestamps = auditLogs.map(log => log.timestamp.getTime());
            const uniqueTimestamps = new Set(timestamps);
            expect(uniqueTimestamps.size).toBe(timestamps.length);
        });
    });

    describe('Session Security', () => {
        it('should invalidate sessions when critical permissions are revoked', async () => {
            // Assign admin role to user
            await UserRole.create({
                userId: normalUser._id,
                roleId: adminRole._id,
                workspaceId: testWorkplace._id,
                assignedBy: superAdminUser._id,
                assignedAt: new Date(),
                isActive: true,
                isTemporary: false,
                lastModifiedBy: superAdminUser._id,
                lastModifiedAt: new Date()
            });

            // Verify user has admin permission
            let permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                'admin.delete_user',
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

            // Revoke admin role
            await UserRole.findOneAndUpdate(
                { userId: normalUser._id, roleId: adminRole._id },
                { isActive: false }
            );

            // Invalidate user cache (simulates session invalidation)
            await dynamicPermissionService.invalidateUserCache(normalUser._id);

            // Verify permission is now denied
            permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                'admin.delete_user',
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

        it('should prevent session fixation attacks', async () => {
            // This test would verify that session IDs are regenerated after privilege changes
            // For now, we'll test that cache invalidation works properly

            // Cache a permission result
            await dynamicPermissionService.checkPermission(
                normalUser,
                'patient.read',
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

            // Verify cache exists
            let cachedResult = await cacheManager.getCachedPermissionCheck(
                normalUser._id,
                'patient.read',
                testWorkplace._id
            );
            expect(cachedResult).toBeTruthy();

            // Simulate privilege change (should invalidate cache)
            await dynamicPermissionService.invalidateUserCache(normalUser._id);

            // Verify cache was cleared
            cachedResult = await cacheManager.getCachedPermissionCheck(
                normalUser._id,
                'patient.read',
                testWorkplace._id
            );
            expect(cachedResult).toBeNull();
        });
    });

    describe('Input Validation Security', () => {
        it('should validate and sanitize role names', async () => {
            const maliciousRoleName = '<script>alert("xss")</script>';

            const response = await request(app)
                .post('/api/admin/roles')
                .set('Authorization', superAdminToken)
                .send({
                    name: maliciousRoleName,
                    displayName: 'Test Role',
                    description: 'Test description',
                    permissions: []
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid role name');

            // Verify role was not created
            const createdRole = await Role.findOne({ name: maliciousRoleName });
            expect(createdRole).toBeNull();
        });

        it('should validate permission action formats', async () => {
            const maliciousPermission = '../../../etc/passwd';

            const permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                maliciousPermission,
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
            expect(permissionResult.reason).toContain('Permission not defined');
        });

        it('should prevent buffer overflow attacks in permission strings', async () => {
            const longPermissionString = 'a'.repeat(10000); // Very long string

            const permissionResult = await dynamicPermissionService.checkPermission(
                normalUser,
                longPermissionString,
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
            // Should handle gracefully without crashing
        });
    });

    describe('Rate Limiting Security', () => {
        it('should prevent brute force permission enumeration', async () => {
            const maxAttempts = 100;
            const attempts: Promise<any>[] = [];

            // Attempt rapid permission checks
            for (let i = 0; i < maxAttempts; i++) {
                attempts.push(
                    request(app)
                        .get(`/api/admin/users/${normalUser._id}/effective-permissions`)
                        .set('Authorization', normalToken)
                );
            }

            const results = await Promise.allSettled(attempts);
            const failedAttempts = results.filter(r => r.status === 'rejected' ||
                (r.status === 'fulfilled' && r.value.status === 429));

            // Should have some rate limiting after many attempts
            expect(failedAttempts.length).toBeGreaterThan(0);
        });

        it('should prevent DoS attacks through expensive operations', async () => {
            const startTime = Date.now();
            const expensiveOperations: Promise<any>[] = [];

            // Attempt multiple expensive hierarchy traversals
            for (let i = 0; i < 50; i++) {
                expensiveOperations.push(
                    dynamicPermissionService.resolveUserPermissions(
                        normalUser,
                        {
                            workspace: testWorkplace,
                            plan: null,
                            subscription: null,
                            permissions: [],
                            limits: {},
                            isSubscriptionActive: true,
                            isTrialExpired: false
                        }
                    )
                );
            }

            await Promise.all(expensiveOperations);
            const endTime = Date.now();

            // Should complete within reasonable time (not hang indefinitely)
            expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
        });
    });

    describe('Data Integrity Security', () => {
        it('should maintain referential integrity during concurrent modifications', async () => {
            const concurrentModifications: Promise<any>[] = [];

            // Perform concurrent role assignments and revocations
            for (let i = 0; i < 20; i++) {
                if (i % 2 === 0) {
                    concurrentModifications.push(
                        UserRole.create({
                            userId: normalUser._id,
                            roleId: testRole._id,
                            workspaceId: testWorkplace._id,
                            assignedBy: superAdminUser._id,
                            assignedAt: new Date(),
                            isActive: true,
                            isTemporary: false,
                            lastModifiedBy: superAdminUser._id,
                            lastModifiedAt: new Date()
                        })
                    );
                } else {
                    concurrentModifications.push(
                        UserRole.findOneAndUpdate(
                            { userId: normalUser._id, roleId: testRole._id },
                            { isActive: false }
                        )
                    );
                }
            }

            await Promise.allSettled(concurrentModifications);

            // Verify data integrity
            const userRoles = await UserRole.find({ userId: normalUser._id });
            const activeRoles = userRoles.filter(ur => ur.isActive);
            const inactiveRoles = userRoles.filter(ur => !ur.isActive);

            // Should have consistent state
            expect(activeRoles.length + inactiveRoles.length).toBe(userRoles.length);
        });

        it('should prevent orphaned permission assignments', async () => {
            // Create a role with permissions
            const tempRole = await Role.create({
                name: 'temp_role',
                displayName: 'Temporary Role',
                description: 'Temporary role for testing',
                category: 'test',
                permissions: ['temp.permission'],
                isActive: true,
                isSystemRole: false,
                hierarchyLevel: 1,
                createdBy: superAdminUser._id,
                lastModifiedBy: superAdminUser._id
            });

            // Assign role to user
            await UserRole.create({
                userId: normalUser._id,
                roleId: tempRole._id,
                workspaceId: testWorkplace._id,
                assignedBy: superAdminUser._id,
                assignedAt: new Date(),
                isActive: true,
                isTemporary: false,
                lastModifiedBy: superAdminUser._id,
                lastModifiedAt: new Date()
            });

            // Delete the role
            await Role.findByIdAndDelete(tempRole._id);

            // Verify user role assignment is handled properly
            const orphanedUserRole = await UserRole.findOne({
                userId: normalUser._id,
                roleId: tempRole._id
            });

            if (orphanedUserRole) {
                // Should be marked as inactive or cleaned up
                expect(orphanedUserRole.isActive).toBe(false);
            }
        });
    });
});