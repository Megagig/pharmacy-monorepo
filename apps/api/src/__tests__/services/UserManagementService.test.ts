import { UserManagementService } from '../../services/UserManagementService';
import { User } from '../../models/User';
import { Role } from '../../models/Role';
import { Permission } from '../../models/Permission';
import { UserSession } from '../../models/UserSession';
import { DynamicPermissionService } from '../../services/DynamicPermissionService';
import { RedisCacheService } from '../../services/RedisCacheService';
import { AuditService } from '../../services/auditService';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Role');
jest.mock('../../models/Permission');
jest.mock('../../models/UserSession');
jest.mock('../../services/DynamicPermissionService');
jest.mock('../../services/RedisCacheService');
jest.mock('../../services/auditService');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');

describe('UserManagementService', () => {
  let service: UserManagementService;
  let mockCacheService: jest.Mocked<RedisCacheService>;
  let mockPermissionService: jest.Mocked<DynamicPermissionService>;
  let mockAuditService: jest.Mocked<typeof AuditService>;

  const mockUser = {
    _id: 'user123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    isActive: true,
    roles: ['role123'],
    workplaceId: 'workplace123',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockRole = {
    _id: 'role123',
    name: 'pharmacist',
    displayName: 'Pharmacist',
    permissions: ['permission123']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RedisCacheService
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    // Mock DynamicPermissionService
    mockPermissionService = {
      hasPermission: jest.fn(),
    } as any;

    // Mock AuditService
    mockAuditService = {
      createAuditLog: jest.fn(),
      getAuditLogs: jest.fn(),
    } as any;

    // Mock static getInstance methods
    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    (DynamicPermissionService.getInstance as jest.Mock).mockReturnValue(mockPermissionService);
    (AuditService as any) = mockAuditService;

    service = UserManagementService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = UserManagementService.getInstance();
      const instance2 = UserManagementService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users with filters', async () => {
      const mockUsers = [mockUser];
      const mockTotal = 1;

      (User.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers)
      });

      (User.countDocuments as jest.Mock).mockResolvedValue(mockTotal);

      const filters = { search: 'john' };
      const pagination = { page: 1, limit: 20 };

      const result = await service.getAllUsers(filters, pagination);

      expect(result).toEqual({
        users: mockUsers,
        total: mockTotal,
        page: 1,
        limit: 20,
        pages: 1,
        hasNext: false,
        hasPrev: false
      });

      expect(User.find).toHaveBeenCalledWith({
        $or: [
          { firstName: { $regex: 'john', $options: 'i' } },
          { lastName: { $regex: 'john', $options: 'i' } },
          { email: { $regex: 'john', $options: 'i' } }
        ]
      });
    });

    it('should handle errors gracefully', async () => {
      (User.find as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const filters = {};
      const pagination = { page: 1, limit: 20 };

      await expect(service.getAllUsers(filters, pagination)).rejects.toThrow('Failed to retrieve users');
    });
  });

  describe('getUserById', () => {
    it('should return cached user if available', async () => {
      mockCacheService.get.mockResolvedValue(mockUser);

      const result = await service.getUserById('user123');

      expect(mockCacheService.get).toHaveBeenCalledWith('user:user123');
      expect(result).toEqual(mockUser);
    });

    it('should fetch and cache user if not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);

      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await service.getUserById('user123');

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(mockCacheService.set).toHaveBeenCalledWith('user:user123', mockUser, 10 * 60 * 1000);
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockCacheService.get.mockResolvedValue(null);

      (User.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      });

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));

      await expect(service.getUserById('user123')).rejects.toThrow('Failed to retrieve user');
    });
  });

  describe('updateUserRole', () => {
    it('should successfully assign role to user', async () => {
      // Mock getUserById
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);

      // Mock Role.findById
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);

      // Mock permission check
      mockPermissionService.hasPermission.mockResolvedValue(true);

      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

      await service.updateUserRole('user123', 'role123', 'workspace123', 'admin123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        $addToSet: { roles: 'role123' },
        updatedAt: expect.any(Date)
      });

      expect(mockCacheService.del).toHaveBeenCalledWith('user:user123');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_ROLE_ASSIGNED',
          userId: 'admin123'
        })
      );
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.updateUserRole('nonexistent', 'role123')).rejects.toThrow('User not found');
    });

    it('should throw error if role not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      (Role.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateUserRole('user123', 'nonexistent')).rejects.toThrow('Role not found');
    });

    it('should throw error if admin lacks permission', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await expect(service.updateUserRole('user123', 'role123', 'workspace123', 'admin123'))
        .rejects.toThrow('Insufficient permissions to assign role');
    });
  });

  describe('revokeUserRole', () => {
    it('should successfully revoke role from user', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);

      await service.revokeUserRole('user123', 'role123', 'workspace123', 'admin123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        $pull: { roles: 'role123' },
        updatedAt: expect.any(Date)
      });

      expect(mockCacheService.del).toHaveBeenCalledWith('user:user123');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_ROLE_REVOKED',
          userId: 'admin123'
        })
      );
    });

    it('should throw error if admin lacks permission', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await expect(service.revokeUserRole('user123', 'role123', 'workspace123', 'admin123'))
        .rejects.toThrow('Insufficient permissions to revoke role');
    });
  });

  describe('suspendUser', () => {
    it('should successfully suspend user', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);
      (UserSession.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      await service.suspendUser('user123', 'Violation of terms', 'admin123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        isActive: false,
        suspendedAt: expect.any(Date),
        suspensionReason: 'Violation of terms',
        updatedAt: expect.any(Date)
      });

      expect(UserSession.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        {
          isActive: false,
          terminatedAt: expect.any(Date),
          terminationReason: 'User suspended'
        }
      );

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_SUSPENDED',
          userId: 'admin123'
        })
      );
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.suspendUser('nonexistent', 'reason')).rejects.toThrow('User not found');
    });
  });

  describe('reactivateUser', () => {
    it('should successfully reactivate user', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUser);

      await service.reactivateUser('user123', 'admin123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        isActive: true,
        $unset: {
          suspendedAt: 1,
          suspensionReason: 1
        },
        updatedAt: expect.any(Date)
      });

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_REACTIVATED',
          userId: 'admin123'
        })
      );
    });
  });

  describe('bulkAssignRoles', () => {
    it('should successfully assign roles to multiple users', async () => {
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);
      jest.spyOn(service, 'updateUserRole').mockResolvedValue();

      const userIds = ['user1', 'user2', 'user3'];
      const result = await service.bulkAssignRoles(userIds, 'role123', 'admin123');

      expect(result).toEqual({
        success: 3,
        failed: 0,
        errors: []
      });

      expect(service.updateUserRole).toHaveBeenCalledTimes(3);
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_ROLE_ASSIGNMENT',
          userId: 'admin123'
        })
      );
    });

    it('should handle partial failures', async () => {
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);
      jest.spyOn(service, 'updateUserRole')
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('User not found'))
        .mockResolvedValueOnce();

      const userIds = ['user1', 'user2', 'user3'];
      const result = await service.bulkAssignRoles(userIds, 'role123', 'admin123');

      expect(result).toEqual({
        success: 2,
        failed: 1,
        errors: [{
          userId: 'user2',
          error: 'User not found'
        }]
      });
    });

    it('should throw error if role not found', async () => {
      (Role.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.bulkAssignRoles(['user1'], 'nonexistent')).rejects.toThrow('Role not found');
    });
  });

  describe('bulkRevokeRoles', () => {
    it('should successfully revoke roles from multiple users', async () => {
      (Role.findById as jest.Mock).mockResolvedValue(mockRole);
      jest.spyOn(service, 'revokeUserRole').mockResolvedValue();

      const userIds = ['user1', 'user2', 'user3'];
      const result = await service.bulkRevokeRoles(userIds, 'role123', 'admin123');

      expect(result).toEqual({
        success: 3,
        failed: 0,
        errors: []
      });

      expect(service.revokeUserRole).toHaveBeenCalledTimes(3);
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_ROLE_REVOCATION',
          userId: 'admin123'
        })
      );
    });
  });

  describe('getUserActivityLogs', () => {
    it('should return user activity logs', async () => {
      const mockLogs = {
        logs: [{
          _id: 'log123',
          action: 'LOGIN',
          timestamp: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          details: { success: true }
        }]
      };

      mockAuditService.getAuditLogs.mockResolvedValue(mockLogs as any);

      const result = await service.getUserActivityLogs('user123', 50);

      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith({
        userId: 'user123',
        limit: 50
      });

      expect(result).toEqual([{
        id: 'log123',
        action: 'LOGIN',
        timestamp: mockLogs.logs[0].timestamp,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { success: true }
      }]);
    });

    it('should handle errors gracefully', async () => {
      mockAuditService.getAuditLogs.mockRejectedValue(new Error('Audit service error'));

      await expect(service.getUserActivityLogs('user123')).rejects.toThrow('Failed to retrieve user activity logs');
    });
  });

  describe('impersonateUser', () => {
    it('should create impersonation session', async () => {
      const adminUser = { ...mockUser, _id: 'admin123' };
      const targetUser = { ...mockUser, _id: 'user123' };

      mockPermissionService.hasPermission.mockResolvedValue(true);
      jest.spyOn(service, 'getUserById')
        .mockResolvedValueOnce(targetUser as any)
        .mockResolvedValueOnce(adminUser as any);

      const mockToken = 'mock.jwt.token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await service.impersonateUser('admin123', 'user123');

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith('admin123', 'IMPERSONATE_USERS');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin123',
          targetUserId: 'user123',
          type: 'impersonation'
        }),
        expect.any(String)
      );

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `impersonation:${mockToken}`,
        expect.objectContaining({
          adminId: 'admin123',
          targetUserId: 'user123'
        }),
        60 * 60 * 1000
      );

      expect(result).toEqual({
        sessionToken: mockToken,
        expiresAt: expect.any(Date),
        targetUser,
        adminUser
      });

      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_IMPERSONATION_STARTED',
          userId: 'admin123'
        })
      );
    });

    it('should throw error if admin lacks permission', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(false);

      await expect(service.impersonateUser('admin123', 'user123'))
        .rejects.toThrow('Insufficient permissions to impersonate users');
    });

    it('should throw error if target user not found', async () => {
      mockPermissionService.hasPermission.mockResolvedValue(true);
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.impersonateUser('admin123', 'nonexistent'))
        .rejects.toThrow('Target user not found');
    });
  });

  describe('endImpersonation', () => {
    it('should end impersonation session', async () => {
      const mockSession = {
        adminId: 'admin123',
        targetUserId: 'user123',
        createdAt: new Date(),
        expiresAt: new Date()
      };

      mockCacheService.get.mockResolvedValue(mockSession);

      await service.endImpersonation('mock.jwt.token');

      expect(mockCacheService.del).toHaveBeenCalledWith('impersonation:mock.jwt.token');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_IMPERSONATION_ENDED',
          userId: 'admin123'
        })
      );
    });

    it('should handle non-existent session gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(service.endImpersonation('invalid.token')).resolves.not.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should successfully update user', async () => {
      const updateData = { firstName: 'Jane', lastName: 'Smith' };
      const updatedUser = { ...mockUser, ...updateData };

      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser as any);
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue(updatedUser)
      });

      const result = await service.updateUser('user123', updateData, 'admin123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { ...updateData, updatedAt: expect.any(Date) },
        { new: true }
      );

      expect(mockCacheService.del).toHaveBeenCalledWith('user:user123');
      expect(mockAuditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_UPDATED',
          userId: 'admin123'
        })
      );
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.updateUser('nonexistent', {})).rejects.toThrow('User not found');
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      (User.countDocuments as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // active
        .mockResolvedValueOnce(15)  // inactive
        .mockResolvedValueOnce(5)   // suspended
        .mockResolvedValueOnce(10); // newThisMonth

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        total: 100,
        active: 80,
        inactive: 15,
        suspended: 5,
        newThisMonth: 10
      });
    });

    it('should handle errors gracefully', async () => {
      (User.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getUserStatistics()).rejects.toThrow('Failed to retrieve user statistics');
    });
  });

  describe('clearUserCache', () => {
    it('should clear specific user cache', async () => {
      await service.clearUserCache('user123');

      expect(mockCacheService.del).toHaveBeenCalledWith('user:user123');
    });

    it('should clear all user cache', async () => {
      await service.clearUserCache();

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('user:*');
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.del.mockRejectedValue(new Error('Cache error'));

      await expect(service.clearUserCache('user123')).rejects.toThrow('Failed to clear user cache');
    });
  });
});