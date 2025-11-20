import mongoose from 'mongoose';
import DynamicPermissionService from '../../services/DynamicPermissionService';
import RoleHierarchyService from '../../services/RoleHierarchyService';
import CacheManager from '../../services/CacheManager';
import CacheInvalidationService from '../../services/CacheInvalidationService';
import User, { IUser } from '../../models/User';
import Role, { IRole } from '../../models/Role';
import Permission, { IPermission } from '../../models/Permission';
import UserRole, { IUserRole } from '../../models/UserRole';
import RolePermission, { IRolePermission } from '../../models/RolePermission';
import { WorkspaceContext } from '../../types/auth';

// Mock dependencies
jest.mock('../../services/RoleHierarchyService');
jest.mock('../../services/CacheManager');
jest.mock('../../services/CacheInvalidationService');
jest.mock('../../services/DatabaseOptimizationService');
jest.mock('../../services/PermissionAggregationService');
jest.mock('../../middlewares/auditLogging');

describe('DynamicPermissionService', () => {
    let dynamicPermissionService: DynamicPermissionService;
    let mockRoleHierarchyService: jest.Mocked<RoleHierarchyService>;
    let mockCacheManager: jest.Mocked<CacheManager>;
    let mockCacheInvalidationService: jest.Mocked<CacheInvalidationService>;

    const mockUser: Partial<IUser> = {
        _id: new mongoose.Types.ObjectId(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'pharmacist',
        status: 'active',
        workplaceRole: 'Pharmacist',
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: []
    };

    const mockSuperAdminUser: Partial<IUser> = {
        _id: new mongoose.Types.ObjectId(),
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@example.com',
        role: 'super_admin',
        status: 'active',
        workplaceRole: 'Owner',
        directPermissions: [],
        deniedPermissions: [],
        assignedRoles: []
    };

    const mockWorkspace = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Pharmacy',
        type: 'Community',
        ownerId: new mongoose.Types.ObjectId(),
        teamMembers: []
    };

    const mockContext: WorkspaceContext = {
        workspace: mockWorkspace as any,
        plan: null,
        subscription: null,
        permissions: ['patient_management'],
        limits: {
            patients: 100,
            users: 5,
            locations: 1,
            storage: 1000,
            apiCalls: 1000
        },
        isSubscriptionActive: true,
        isTrialExpired: false
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mock instances
        mockRoleHierarchyService = {
            getInstance: jest.fn().mockReturnThis(),
            getAllRolePermissions: jest.fn(),
            createRoleHierarchy: jest.fn(),
            validateHierarchy: jest.fn(),
            getHierarchyTree: jest.fn()
        } as any;

        mockCacheManager = {
            getInstance: jest.fn().mockReturnThis(),
            getCachedPermissionCheck: jest.fn(),
            cachePermissionCheck: jest.fn(),
            getCachedUserPermissions: jest.fn(),
            cacheUserPermissions: jest.fn(),
            getCachedRolePermissions: jest.fn(),
            cacheRolePermissions: jest.fn(),
            invalidatePattern: jest.fn(),
            getMetrics: jest.fn()
        } as any;

        mockCacheInvalidationService = {
            getInstance: jest.fn().mockReturnThis(),
            invalidateUserPermissions: jest.fn(),
            invalidateRolePermissions: jest.fn()
        } as any;

        // Mock static getInstance methods
        (RoleHierarchyService.getInstance as jest.Mock).mockReturnValue(mockRoleHierarchyService);
        (CacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);
        (CacheInvalidationService.getInstance as jest.Mock).mockReturnValue(mockCacheInvalidationService);

        dynamicPermissionService = DynamicPermissionService.getInstance();
    });

    describe('checkPermission', () => {
        it('should allow super admin to access any action', async () => {
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);
            mockCacheManager.cachePermissionCheck.mockResolvedValue(undefined);

            const result = await dynamicPermissionService.checkPermission(
                mockSuperAdminUser as IUser,
                'any.action',
                mockContext
            );

            expect(result.allowed).toBe(true);
            expect(result.source).toBe('super_admin');
            expect(mockCacheManager.cachePermissionCheck).toHaveBeenCalledWith(
                mockSuperAdminUser._id,
                'any.action',
                true,
                'super_admin',
                mockContext.workspace._id,
                expect.any(Number)
            );
        });

        it('should deny access for suspended users', async () => {
            const suspendedUser = { ...mockUser, status: 'suspended' };
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);

            const result = await dynamicPermissionService.checkPermission(
                suspendedUser as IUser,
                'patient.create',
                mockContext
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('User account is suspended');
            expect(result.source).toBe('none');
        });

        it('should deny access for users with rejected license', async () => {
            const rejectedUser = { ...mockUser, licenseStatus: 'rejected' };
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);

            const result = await dynamicPermissionService.checkPermission(
                rejectedUser as IUser,
                'patient.create',
                mockContext
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('License verification rejected');
            expect(result.source).toBe('none');
        });

        it('should return cached result when available', async () => {
            const cachedResult = {
                allowed: true,
                source: 'role'
            };
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(cachedResult);

            const result = await dynamicPermissionService.checkPermission(
                mockUser as IUser,
                'patient.create',
                mockContext
            );

            expect(result.allowed).toBe(true);
            expect(result.source).toBe('role');
            expect(mockCacheManager.getCachedPermissionCheck).toHaveBeenCalledWith(
                mockUser._id,
                'patient.create',
                mockContext.workspace._id
            );
        });

        it('should deny access for explicitly denied permissions', async () => {
            const userWithDeniedPermission = {
                ...mockUser,
                deniedPermissions: ['patient.delete']
            };
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);
            mockCacheManager.cachePermissionCheck.mockResolvedValue(undefined);

            const result = await dynamicPermissionService.checkPermission(
                userWithDeniedPermission as IUser,
                'patient.delete',
                mockContext
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Permission explicitly denied');
            expect(result.source).toBe('direct_denial');
        });

        it('should allow access for direct permissions', async () => {
            const userWithDirectPermission = {
                ...mockUser,
                directPermissions: ['patient.create']
            };
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);
            mockCacheManager.cachePermissionCheck.mockResolvedValue(undefined);

            const result = await dynamicPermissionService.checkPermission(
                userWithDirectPermission as IUser,
                'patient.create',
                mockContext
            );

            expect(result.allowed).toBe(true);
            expect(result.source).toBe('direct_permission');
        });

        it('should handle permission check errors gracefully', async () => {
            mockCacheManager.getCachedPermissionCheck.mockRejectedValue(new Error('Cache error'));

            const result = await dynamicPermissionService.checkPermission(
                mockUser as IUser,
                'patient.create',
                mockContext
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Permission check failed due to system error');
            expect(result.source).toBe('none');
        });

        it('should provide permission suggestions for denied access', async () => {
            mockCacheManager.getCachedPermissionCheck.mockResolvedValue(null);
            mockCacheManager.cachePermissionCheck.mockResolvedValue(undefined);

            // Mock the getPermissionSuggestions method
            const mockSuggestions = ['Consider requesting patient.read permission'];
            jest.spyOn(dynamicPermissionService, 'getPermissionSuggestions')
                .mockResolvedValue(mockSuggestions);

            const result = await dynamicPermissionService.checkPermission(
                mockUser as IUser,
                'patient.delete',
                mockContext
            );

            expect(result.allowed).toBe(false);
            expect(result.suggestions).toEqual(mockSuggestions);
        });
    });

    describe('resolveUserPermissions', () => {
        it('should return all permissions for super admin', async () => {
            mockCacheManager.getCachedUserPermissions.mockResolvedValue(null);
            mockCacheManager.cacheUserPermissions.mockResolvedValue(undefined);

            // Mock Permission.find to return system permissions
            const mockPermissions = [
                { action: 'patient.create' },
                { action: 'patient.read' },
                { action: 'patient.update' },
                { action: 'patient.delete' }
            ];
            jest.spyOn(Permission, 'find').mockReturnValue({
                select: jest.fn().mockResolvedValue(mockPermissions)
            } as any);

            const result = await dynamicPermissionService.resolveUserPermissions(
                mockSuperAdminUser as IUser,
                mockContext
            );

            expect(result.permissions).toHaveLength(4);
            expect(result.permissions).toContain('patient.create');
            expect(result.sources['patient.create']).toBe('super_admin');
            expect(result.deniedPermissions).toHaveLength(0);
        });

        it('should return cached permissions when available', async () => {
            const cachedPermissions = {
                permissions: ['patient.create', 'patient.read'],
                sources: { 'patient.create': 'role', 'patient.read': 'role' },
                deniedPermissions: []
            };
            mockCacheManager.getCachedUserPermissions.mockResolvedValue(cachedPermissions);

            const result = await dynamicPermissionService.resolveUserPermissions(
                mockUser as IUser,
                mockContext
            );

            expect(result).toEqual(cachedPermissions);
            expect(mockCacheManager.getCachedUserPermissions).toHaveBeenCalledWith(
                mockUser._id,
                mockContext.workspace._id
            );
        });

        it('should include direct permissions in result', async () => {
            const userWithDirectPermissions = {
                ...mockUser,
                directPermissions: ['patient.create', 'patient.update']
            };
            mockCacheManager.getCachedUserPermissions.mockResolvedValue(null);
            mockCacheManager.cacheUserPermissions.mockResolvedValue(undefined);

            const result = await dynamicPermissionService.resolveUserPermissions(
                userWithDirectPermissions as IUser,
                mockContext
            );

            expect(result.permissions).toContain('patient.create');
            expect(result.permissions).toContain('patient.update');
            expect(result.sources['patient.create']).toBe('direct_permission');
            expect(result.sources['patient.update']).toBe('direct_permission');
        });

        it('should exclude denied permissions from result', async () => {
            const userWithDeniedPermissions = {
                ...mockUser,
                directPermissions: ['patient.create', 'patient.update', 'patient.delete'],
                deniedPermissions: ['patient.delete']
            };
            mockCacheManager.getCachedUserPermissions.mockResolvedValue(null);
            mockCacheManager.cacheUserPermissions.mockResolvedValue(undefined);

            const result = await dynamicPermissionService.resolveUserPermissions(
                userWithDeniedPermissions as IUser,
                mockContext
            );

            expect(result.permissions).toContain('patient.create');
            expect(result.permissions).toContain('patient.update');
            expect(result.permissions).not.toContain('patient.delete');
            expect(result.deniedPermissions).toContain('patient.delete');
        });

        it('should handle errors gracefully', async () => {
            mockCacheManager.getCachedUserPermissions.mockRejectedValue(new Error('Cache error'));

            const result = await dynamicPermissionService.resolveUserPermissions(
                mockUser as IUser,
                mockContext
            );

            expect(result.permissions).toHaveLength(0);
            expect(result.sources).toEqual({});
            expect(result.deniedPermissions).toHaveLength(0);
        });
    });

    describe('getPermissionSuggestions', () => {
        it('should provide suggestions for similar permissions', async () => {
            // Mock resolveUserPermissions to return user permissions
            jest.spyOn(dynamicPermissionService, 'resolveUserPermissions')
                .mockResolvedValue({
                    permissions: ['patient.read', 'patient.update'],
                    sources: {},
                    deniedPermissions: []
                });

            // Mock RolePermission.find for roles with the requested permission
            const mockRolePermissions = [
                {
                    roleId: {
                        displayName: 'Pharmacist'
                    }
                },
                {
                    roleId: {
                        displayName: 'Owner'
                    }
                }
            ];
            jest.spyOn(RolePermission, 'find').mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockRolePermissions)
            } as any);

            const suggestions = await dynamicPermissionService.getPermissionSuggestions(
                mockUser as IUser,
                'patient.delete'
            );

            expect(suggestions).toContain('You have other patient permissions: patient.read, patient.update');
            expect(suggestions).toContain('This permission is available in roles: Pharmacist, Owner');
        });

        it('should handle errors gracefully', async () => {
            jest.spyOn(dynamicPermissionService, 'resolveUserPermissions')
                .mockRejectedValue(new Error('Permission resolution error'));

            const suggestions = await dynamicPermissionService.getPermissionSuggestions(
                mockUser as IUser,
                'patient.delete'
            );

            expect(suggestions).toHaveLength(0);
        });
    });

    describe('invalidateUserCache', () => {
        it('should invalidate user permission cache', async () => {
            const userId = new mongoose.Types.ObjectId();
            const workspaceId = new mongoose.Types.ObjectId();
            const reason = 'Role assignment changed';
            const initiatedBy = new mongoose.Types.ObjectId();

            await dynamicPermissionService.invalidateUserCache(
                userId,
                workspaceId,
                reason,
                initiatedBy
            );

            expect(mockCacheInvalidationService.invalidateUserPermissions).toHaveBeenCalledWith(
                userId,
                {
                    workspaceId,
                    reason,
                    initiatedBy,
                    strategy: {
                        immediate: true,
                        cascade: false,
                        selective: true,
                        distributed: true
                    }
                }
            );
        });

        it('should handle cache invalidation errors gracefully', async () => {
            const userId = new mongoose.Types.ObjectId();
            mockCacheInvalidationService.invalidateUserPermissions.mockRejectedValue(
                new Error('Cache invalidation failed')
            );

            // Should not throw error
            await expect(
                dynamicPermissionService.invalidateUserCache(userId)
            ).resolves.not.toThrow();
        });
    });

    describe('invalidateRoleCache', () => {
        it('should invalidate role permission cache', async () => {
            const roleId = new mongoose.Types.ObjectId();
            const reason = 'Role permissions updated';
            const initiatedBy = new mongoose.Types.ObjectId();

            await dynamicPermissionService.invalidateRoleCache(
                roleId,
                reason,
                initiatedBy
            );

            expect(mockCacheInvalidationService.invalidateRolePermissions).toHaveBeenCalledWith(
                roleId,
                expect.objectContaining({
                    reason,
                    initiatedBy
                })
            );
        });
    });

    describe('bulkUpdateUserPermissions', () => {
        it('should update multiple users permissions in transaction', async () => {
            const updates = [
                {
                    userId: new mongoose.Types.ObjectId(),
                    roleIds: [new mongoose.Types.ObjectId()],
                    directPermissions: ['patient.create'],
                    deniedPermissions: []
                },
                {
                    userId: new mongoose.Types.ObjectId(),
                    roleIds: [new mongoose.Types.ObjectId()],
                    directPermissions: ['patient.read'],
                    deniedPermissions: ['patient.delete']
                }
            ];
            const modifiedBy = new mongoose.Types.ObjectId();

            // Mock mongoose session
            const mockSession = {
                withTransaction: jest.fn().mockImplementation(async (fn) => await fn()),
                endSession: jest.fn()
            };
            jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

            // Mock User.findByIdAndUpdate
            jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({} as any);

            // Mock invalidateUserCache
            jest.spyOn(dynamicPermissionService, 'invalidateUserCache').mockResolvedValue();

            await dynamicPermissionService.bulkUpdateUserPermissions(updates, modifiedBy);

            expect(mockSession.withTransaction).toHaveBeenCalled();
            expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
            expect(dynamicPermissionService.invalidateUserCache).toHaveBeenCalledTimes(2);
        });

        it('should handle bulk update errors and cleanup session', async () => {
            const updates = [
                {
                    userId: new mongoose.Types.ObjectId(),
                    roleIds: [new mongoose.Types.ObjectId()]
                }
            ];
            const modifiedBy = new mongoose.Types.ObjectId();

            const mockSession = {
                withTransaction: jest.fn().mockRejectedValue(new Error('Transaction failed')),
                endSession: jest.fn()
            };
            jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

            await expect(
                dynamicPermissionService.bulkUpdateUserPermissions(updates, modifiedBy)
            ).rejects.toThrow('Transaction failed');

            expect(mockSession.endSession).toHaveBeenCalled();
        });
    });
});