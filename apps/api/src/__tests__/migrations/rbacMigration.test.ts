import mongoose from 'mongoose';
import User, { IUser } from '../../models/User';
import Role, { IRole } from '../../models/Role';
import Permission, { IPermission } from '../../models/Permission';
import UserRole, { IUserRole } from '../../models/UserRole';
import RolePermission, { IRolePermission } from '../../models/RolePermission';

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/Role');
jest.mock('../../models/Permission');
jest.mock('../../models/UserRole');
jest.mock('../../models/RolePermission');

describe('RBAC Migration Scripts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createSystemRoles', () => {
        it('should create system roles from static configuration', async () => {
            const { createSystemRoles } = await import('../../migrations/rbac/createSystemRoles');

            // Mock Role.findOne to return null (role doesn't exist)
            (Role.findOne as jest.Mock).mockResolvedValue(null);

            // Mock Role.create to return created role
            const mockCreatedRole = {
                _id: new mongoose.Types.ObjectId(),
                name: 'super_admin',
                displayName: 'Super Administrator',
                isSystemRole: true
            };
            (Role.create as jest.Mock).mockResolvedValue(mockCreatedRole);

            await createSystemRoles();

            expect(Role.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'super_admin',
                    displayName: 'Super Administrator',
                    isSystemRole: true
                })
            );
        });

        it('should skip creating existing system roles', async () => {
            const { createSystemRoles } = await import('../../migrations/rbac/createSystemRoles');

            // Mock Role.findOne to return existing role
            const existingRole = {
                _id: new mongoose.Types.ObjectId(),
                name: 'super_admin',
                displayName: 'Super Administrator'
            };
            (Role.findOne as jest.Mock).mockResolvedValue(existingRole);

            await createSystemRoles();

            expect(Role.create).not.toHaveBeenCalled();
        });

        it('should handle role creation errors gracefully', async () => {
            const { createSystemRoles } = await import('../../migrations/rbac/createSystemRoles');

            (Role.findOne as jest.Mock).mockResolvedValue(null);
            (Role.create as jest.Mock).mockRejectedValue(new Error('Database error'));

            await expect(createSystemRoles()).rejects.toThrow('Database error');
        });
    });

    describe('createPermissionsFromMatrix', () => {
        it('should create permissions from permission matrix', async () => {
            const { createPermissionsFromMatrix } = await import('../../migrations/rbac/createPermissionsFromMatrix');

            // Mock Permission.findOne to return null (permission doesn't exist)
            (Permission.findOne as jest.Mock).mockResolvedValue(null);

            // Mock Permission.create
            const mockCreatedPermission = {
                _id: new mongoose.Types.ObjectId(),
                action: 'patient.create',
                displayName: 'Create Patient',
                isSystemPermission: true
            };
            (Permission.create as jest.Mock).mockResolvedValue(mockCreatedPermission);

            await createPermissionsFromMatrix();

            expect(Permission.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: expect.any(String),
                    displayName: expect.any(String),
                    isSystemPermission: true
                })
            );
        });

        it('should skip creating existing permissions', async () => {
            const { createPermissionsFromMatrix } = await import('../../migrations/rbac/createPermissionsFromMatrix');

            // Mock Permission.findOne to return existing permission
            const existingPermission = {
                _id: new mongoose.Types.ObjectId(),
                action: 'patient.create',
                displayName: 'Create Patient'
            };
            (Permission.findOne as jest.Mock).mockResolvedValue(existingPermission);

            await createPermissionsFromMatrix();

            expect(Permission.create).not.toHaveBeenCalled();
        });
    });

    describe('migrateUserRoles', () => {
        it('should migrate user.role to dynamic role assignments', async () => {
            const { migrateUserRoles } = await import('../../migrations/rbac/migrateUserRoles');

            const mockUsers = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    role: 'pharmacist',
                    workplaceRole: 'Pharmacist',
                    permissions: ['patient.create', 'patient.read']
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    role: 'super_admin',
                    workplaceRole: 'Owner',
                    permissions: []
                }
            ];

            const mockRoles = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    name: 'pharmacist',
                    displayName: 'Pharmacist'
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    name: 'super_admin',
                    displayName: 'Super Administrator'
                }
            ];

            (User.find as jest.Mock).mockResolvedValue(mockUsers);
            (Role.findOne as jest.Mock)
                .mockResolvedValueOnce(mockRoles[0])
                .mockResolvedValueOnce(mockRoles[1]);
            (UserRole.create as jest.Mock).mockResolvedValue({});
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

            await migrateUserRoles();

            expect(UserRole.create).toHaveBeenCalledTimes(2);
            expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);

            // Verify user with direct permissions gets them migrated
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                mockUsers[0]._id,
                expect.objectContaining({
                    $set: expect.objectContaining({
                        directPermissions: ['patient.create', 'patient.read']
                    })
                })
            );
        });

        it('should handle users without matching roles', async () => {
            const { migrateUserRoles } = await import('../../migrations/rbac/migrateUserRoles');

            const mockUsers = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    role: 'unknown_role',
                    workplaceRole: 'Unknown',
                    permissions: []
                }
            ];

            (User.find as jest.Mock).mockResolvedValue(mockUsers);
            (Role.findOne as jest.Mock).mockResolvedValue(null);

            await migrateUserRoles();

            expect(UserRole.create).not.toHaveBeenCalled();
            // Should still update user to clear legacy fields
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                mockUsers[0]._id,
                expect.objectContaining({
                    $set: expect.objectContaining({
                        directPermissions: []
                    })
                })
            );
        });
    });

    describe('createRolePermissionMappings', () => {
        it('should create role-permission mappings from static configuration', async () => {
            const { createRolePermissionMappings } = await import('../../migrations/rbac/createRolePermissionMappings');

            const mockRoles = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    name: 'pharmacist',
                    permissions: ['patient.create', 'patient.read']
                }
            ];

            const mockPermissions = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    action: 'patient.create'
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    action: 'patient.read'
                }
            ];

            (Role.find as jest.Mock).mockResolvedValue(mockRoles);
            (Permission.find as jest.Mock).mockResolvedValue(mockPermissions);
            (RolePermission.findOne as jest.Mock).mockResolvedValue(null);
            (RolePermission.create as jest.Mock).mockResolvedValue({});

            await createRolePermissionMappings();

            expect(RolePermission.create).toHaveBeenCalledTimes(2);
            expect(RolePermission.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    roleId: mockRoles[0]._id,
                    permissionAction: 'patient.create',
                    granted: true
                })
            );
        });

        it('should skip existing role-permission mappings', async () => {
            const { createRolePermissionMappings } = await import('../../migrations/rbac/createRolePermissionMappings');

            const mockRoles = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    name: 'pharmacist',
                    permissions: ['patient.create']
                }
            ];

            const mockPermissions = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    action: 'patient.create'
                }
            ];

            const existingMapping = {
                _id: new mongoose.Types.ObjectId(),
                roleId: mockRoles[0]._id,
                permissionAction: 'patient.create'
            };

            (Role.find as jest.Mock).mockResolvedValue(mockRoles);
            (Permission.find as jest.Mock).mockResolvedValue(mockPermissions);
            (RolePermission.findOne as jest.Mock).mockResolvedValue(existingMapping);

            await createRolePermissionMappings();

            expect(RolePermission.create).not.toHaveBeenCalled();
        });
    });

    describe('validateMigration', () => {
        it('should validate successful migration', async () => {
            const { validateMigration } = await import('../../migrations/rbac/validateMigration');

            // Mock successful validation data
            (User.countDocuments as jest.Mock)
                .mockResolvedValueOnce(100) // Total users
                .mockResolvedValueOnce(100); // Users with role assignments

            (Role.countDocuments as jest.Mock).mockResolvedValue(10);
            (Permission.countDocuments as jest.Mock).mockResolvedValue(50);
            (UserRole.countDocuments as jest.Mock).mockResolvedValue(100);
            (RolePermission.countDocuments as jest.Mock).mockResolvedValue(200);

            const result = await validateMigration();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
            expect(result.statistics.totalUsers).toBe(100);
            expect(result.statistics.usersWithRoles).toBe(100);
        });

        it('should detect validation errors', async () => {
            const { validateMigration } = await import('../../migrations/rbac/validateMigration');

            // Mock validation data with issues
            (User.countDocuments as jest.Mock)
                .mockResolvedValueOnce(100) // Total users
                .mockResolvedValueOnce(80); // Users with role assignments (missing 20)

            (Role.countDocuments as jest.Mock).mockResolvedValue(0); // No roles created
            (Permission.countDocuments as jest.Mock).mockResolvedValue(50);
            (UserRole.countDocuments as jest.Mock).mockResolvedValue(80);
            (RolePermission.countDocuments as jest.Mock).mockResolvedValue(0); // No role-permission mappings

            const result = await validateMigration();

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('rollbackMigration', () => {
        it('should rollback migration changes', async () => {
            const { rollbackMigration } = await import('../../migrations/rbac/rollbackMigration');

            // Mock session for transaction
            const mockSession = {
                withTransaction: jest.fn().mockImplementation(async (fn) => await fn()),
                endSession: jest.fn()
            };
            jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

            // Mock delete operations
            (UserRole.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 100 });
            (RolePermission.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 200 });
            (Role.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 10 });
            (Permission.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 50 });

            // Mock user updates
            (User.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 100 });

            const result = await rollbackMigration();

            expect(result.success).toBe(true);
            expect(result.deletedCounts.userRoles).toBe(100);
            expect(result.deletedCounts.rolePermissions).toBe(200);
            expect(result.deletedCounts.roles).toBe(10);
            expect(result.deletedCounts.permissions).toBe(50);
            expect(result.restoredUsers).toBe(100);
        });

        it('should handle rollback errors and cleanup session', async () => {
            const { rollbackMigration } = await import('../../migrations/rbac/rollbackMigration');

            const mockSession = {
                withTransaction: jest.fn().mockRejectedValue(new Error('Rollback failed')),
                endSession: jest.fn()
            };
            jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

            const result = await rollbackMigration();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Rollback failed');
            expect(mockSession.endSession).toHaveBeenCalled();
        });
    });
});