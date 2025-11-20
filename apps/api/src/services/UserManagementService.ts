import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { Role, IRole } from '../models/Role';
import { Permission, IPermission } from '../models/Permission';
import { UserSession, IUserSession } from '../models/UserSession';
import { SecurityAuditLog } from '../models/SecurityAuditLog';
import { DynamicPermissionService } from './DynamicPermissionService';
import { RedisCacheService } from './RedisCacheService';
import { AuditService } from './auditService';
import { emailService } from '../utils/emailService';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  workspaceId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    userId: string;
    error: string;
  }>;
}

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
}

export interface ImpersonationSession {
  sessionToken: string;
  expiresAt: Date;
  targetUser: IUser;
  adminUser: IUser;
}

export interface UserUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  roles?: string[];
  permissions?: string[];
  workspaceId?: string;
}

/**
 * UserManagementService - Handles user CRUD operations with RBAC integration
 * Provides comprehensive user management functionality for super administrators
 */
export class UserManagementService {
  private static instance: UserManagementService;
  private cacheService: RedisCacheService;
  private permissionService: DynamicPermissionService;
  private auditService: typeof AuditService;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly IMPERSONATION_TTL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.cacheService = RedisCacheService.getInstance();
    this.permissionService = DynamicPermissionService.getInstance();
    this.auditService = AuditService;
  }

  public static getInstance(): UserManagementService {
    if (!UserManagementService.instance) {
      UserManagementService.instance = new UserManagementService();
    }
    return UserManagementService.instance;
  }

  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(filters: UserFilters = {}, pagination: Pagination): Promise<PaginatedUsers> {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

      // Build query
      const query = this.buildUserQuery(filters);

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions: Record<string, 1 | -1> = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries in parallel
      const [users, total] = await Promise.all([
        User.find(query)
          .populate('workplaceId', 'name type')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return {
        users: users as IUser[],
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      };
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      // Check cache first
      const cacheKey = `user:${userId}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        return cached as any;
      }

      const user = await User.findById(userId)
        .populate('workplaceId', 'name type')
        .lean();

      if (user) {
        // Cache the result
        await this.cacheService.set(cacheKey, user, { ttl: this.CACHE_TTL / 1000 });
      }

      return user as IUser;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw new Error('Failed to retrieve user');
    }
  }

  /**
   * Update user role with RBAC validation
   */
  async updateUserRole(
    userId: string,
    roleId: string,
    workspaceId?: string,
    adminId?: string
  ): Promise<void> {
    try {
      // Validate user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate role exists - support both ObjectId and role name
      let role: IRole | null;
      if (mongoose.Types.ObjectId.isValid(roleId)) {
        role = await Role.findById(roleId);
      } else {
        // Look up role by name
        role = await Role.findOne({ name: roleId, isActive: true });
      }

      if (!role) {
        throw new Error('Role not found');
      }

      // Check if admin has permission to assign this role
      if (adminId) {
        const admin = await User.findById(adminId);
        if (!admin) {
          throw new Error('Admin user not found');
        }
        const canAssignRole = await this.permissionService.checkPermission(
          admin,
          'ASSIGN_ROLES',
          {
            workspace: null,
            subscription: null,
            plan: null,
            permissions: [], isTrialExpired: false, isSubscriptionActive: true,
            limits: { patients: 0, users: 0, locations: 0, storage: 0, apiCalls: 0 },


          }
        );
        if (!canAssignRole) {
          throw new Error('Insufficient permissions to assign role');
        }
      }

      // Store old values for audit
      const oldRole = user.role;
      const oldAssignedRoles = user.assignedRoles || [];

      // Determine the role name to set in the primary role field
      let primaryRoleName: string;
      if (mongoose.Types.ObjectId.isValid(roleId)) {
        primaryRoleName = role.name;
      } else {
        primaryRoleName = roleId;
      }

      // Update user role - both the primary role field and the assignedRoles array
      await User.findByIdAndUpdate(userId, {
        role: primaryRoleName, // Update primary role field for UI display
        $addToSet: { assignedRoles: role._id }, // Add to assignedRoles for RBAC
        updatedAt: new Date(),
        roleLastModifiedAt: new Date(),
        roleLastModifiedBy: adminId
      });

      // Clear user cache to ensure fresh data is returned
      await this.cacheService.del(`user:${userId}`);

      // Send role assignment email
      try {
        await emailService.sendRoleAssignmentNotification(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          newRole: role.name,
          workspaceName: user.workplaceId ? (user.workplaceId as any).name : undefined
        });
      } catch (emailError) {
        logger.error('Failed to send role assignment email:', emailError);
        // Don't throw - email failure shouldn't block the role assignment
      }

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'ROLE_ASSIGNED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            targetUserId: userId,
            roleId,
            roleName: role.name,
            workspaceId
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium',
          changedFields: ['role', 'assignedRoles'],
          oldValues: { role: oldRole, assignedRoles: oldAssignedRoles },
          newValues: { role: primaryRoleName, assignedRoles: [...oldAssignedRoles, role._id] },
          workspaceId
        });
      }

      logger.info(`Role ${roleId} assigned to user ${userId} by admin ${adminId}`);
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Revoke user role
   */
  async revokeUserRole(
    userId: string,
    roleId: string,
    workspaceId?: string,
    adminId?: string
  ): Promise<void> {
    try {
      // Validate user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if admin has permission to revoke this role
      if (adminId) {
        const admin = await User.findById(adminId);
        if (!admin) {
          throw new Error('Admin user not found');
        }
        const canRevokeRole = await this.permissionService.checkPermission(
          admin,
          'REVOKE_ROLES',
          {
            workspace: null,
            subscription: null,
            plan: null,
            permissions: [], isTrialExpired: false, isSubscriptionActive: true,
            limits: { patients: 0, users: 0, locations: 0, storage: 0, apiCalls: 0 },


          }
        );
        if (!canRevokeRole) {
          throw new Error('Insufficient permissions to revoke role');
        }
      }

      // Store old values for audit
      const oldRoles = [user.role];

      // Remove role from user
      await User.findByIdAndUpdate(userId, {
        $pull: { roles: roleId },
        updatedAt: new Date()
      });

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Create audit log
      if (adminId) {
        const role = await Role.findById(roleId);
        await this.auditService.createAuditLog({
          action: 'ROLE_REVOKED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            targetUserId: userId,
            roleId,
            roleName: role?.name,
            workspaceId
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium',
          changedFields: ['roles'],
          oldValues: { roles: oldRoles },
          newValues: { roles: (oldRoles || []).filter(r => r.toString() !== roleId) },
          workspaceId
        });
      }

      logger.info(`Role ${roleId} revoked from user ${userId} by admin ${adminId}`);
    } catch (error) {
      logger.error('Error revoking user role:', error);
      throw error;
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId: string, reason: string, adminId?: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user status
      await User.findByIdAndUpdate(userId, {
        status: 'suspended',
        isActive: false,
        suspendedAt: new Date(),
        suspensionReason: reason,
        updatedAt: new Date()
      });

      // Terminate all active sessions
      await this.terminateAllUserSessions(userId);

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Send suspension email
      try {
        await emailService.sendUserSuspensionNotification(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          reason
        });
      } catch (emailError) {
        logger.error('Failed to send suspension email:', emailError);
        // Don't throw - email failure shouldn't block the suspension
      }

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'PERMISSION_REVOKED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            action: 'USER_SUSPENDED',
            targetUserId: userId,
            reason,
            suspendedAt: new Date()
          },
          complianceCategory: 'access_control',
          riskLevel: 'high',
          changedFields: ['isActive', 'suspendedAt', 'suspensionReason'],
          oldValues: { isActive: true },
          newValues: { isActive: false, suspendedAt: new Date(), suspensionReason: reason }
        });
      }

      logger.info(`User ${userId} suspended by admin ${adminId}. Reason: ${reason}`);
    } catch (error) {
      logger.error('Error suspending user:', error);
      throw error;
    }
  }

  /**
   * Reactivate suspended user
   */
  async reactivateUser(userId: string, adminId?: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user status
      await User.findByIdAndUpdate(userId, {
        status: 'active',
        isActive: true,
        $unset: {
          suspendedAt: 1,
          suspensionReason: 1
        },
        updatedAt: new Date()
      });

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'PERMISSION_GRANTED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            action: 'USER_REACTIVATED',
            targetUserId: userId,
            reactivatedAt: new Date()
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium',
          changedFields: ['isActive', 'suspendedAt', 'suspensionReason'],
          oldValues: { isActive: false },
          newValues: { isActive: true }
        });
      }

      logger.info(`User ${userId} reactivated by admin ${adminId}`);
    } catch (error) {
      logger.error('Error reactivating user:', error);
      throw error;
    }
  }

  /**
   * Bulk assign roles to multiple users
   */
  async bulkAssignRoles(userIds: string[], roleId: string, adminId?: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Process each user
      for (const userId of userIds) {
        try {
          await this.updateUserRole(userId, roleId, undefined, adminId);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Create bulk audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_ROLE_ASSIGNMENT',
          userId: adminId,
          details: {
            roleId,
            roleName: role.name,
            userIds,
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors
          },
          complianceCategory: 'access_control',
          riskLevel: 'high'
        });
      }

      logger.info(`Bulk role assignment completed. Success: ${result.success}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('Error in bulk role assignment:', error);
      throw error;
    }
  }

  /**
   * Bulk revoke roles from multiple users
   */
  async bulkRevokeRoles(userIds: string[], roleId: string, adminId?: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Process each user
      for (const userId of userIds) {
        try {
          await this.revokeUserRole(userId, roleId, undefined, adminId);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Create bulk audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_ROLE_ASSIGNMENT',
          userId: adminId,
          details: {
            action: 'BULK_ROLE_REVOCATION',
            roleId,
            roleName: role.name,
            userIds,
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors
          },
          complianceCategory: 'access_control',
          riskLevel: 'high'
        });
      }

      logger.info(`Bulk role revocation completed. Success: ${result.success}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('Error in bulk role revocation:', error);
      throw error;
    }
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const auditLogs = await this.auditService.getAuditLogs({
        userId,
        limit
      });

      return auditLogs.logs.map(log => ({
        id: log._id.toString(),
        action: log.action,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details
      }));
    } catch (error) {
      logger.error('Error getting user activity logs:', error);
      throw new Error('Failed to retrieve user activity logs');
    }
  }

  /**
   * Create impersonation session for support
   */
  async impersonateUser(adminId: string, targetUserId: string): Promise<ImpersonationSession> {
    try {
      // Validate admin has impersonation permission
      const admin = await User.findById(adminId);
      if (!admin) {
        throw new Error('Admin user not found');
      }
      const canImpersonate = await this.permissionService.checkPermission(
        admin,
        'IMPERSONATE_USERS',
        {
          workspace: null,
          subscription: null,
          plan: null,
          permissions: [], isTrialExpired: false, isSubscriptionActive: true,
          limits: { patients: 0, users: 0, locations: 0, storage: 0, apiCalls: 0 },


        }
      );
      if (!canImpersonate) {
        throw new Error('Insufficient permissions to impersonate users');
      }

      // Get target user
      const targetUser = await this.getUserById(targetUserId);
      if (!targetUser) {
        throw new Error('Target user not found');
      }

      // Get admin user
      const adminUser = await this.getUserById(adminId);
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      // Create impersonation token
      const expiresAt = new Date(Date.now() + this.IMPERSONATION_TTL);
      const sessionToken = jwt.sign(
        {
          adminId,
          targetUserId,
          type: 'impersonation',
          exp: Math.floor(expiresAt.getTime() / 1000)
        },
        process.env.JWT_SECRET || 'default-secret'
      );

      // Store impersonation session in cache
      const sessionKey = `impersonation:${sessionToken}`;
      await this.cacheService.set(sessionKey, {
        adminId,
        targetUserId,
        createdAt: new Date(),
        expiresAt
      }, { ttl: this.IMPERSONATION_TTL / 1000 });

      // Create audit log
      await this.auditService.createAuditLog({
        action: 'SUPER_ADMIN_ACCESS',
        userId: adminId,
        resourceType: 'User',
        resourceId: targetUserId,
        details: {
          action: 'USER_IMPERSONATION_STARTED',
          targetUserId,
          targetUserEmail: targetUser.email,
          sessionToken: sessionToken.substring(0, 10) + '...',
          expiresAt
        },
        complianceCategory: 'access_control',
        riskLevel: 'critical'
      });

      logger.info(`Admin ${adminId} started impersonating user ${targetUserId}`);

      return {
        sessionToken,
        expiresAt,
        targetUser,
        adminUser
      };
    } catch (error) {
      logger.error('Error creating impersonation session:', error);
      throw error;
    }
  }

  /**
   * End impersonation session
   */
  async endImpersonation(sessionToken: string): Promise<void> {
    try {
      const sessionKey = `impersonation:${sessionToken}`;
      const session = await this.cacheService.get(sessionKey);

      if (session) {
        // Remove session from cache
        await this.cacheService.del(sessionKey);

        // Create audit log
        await this.auditService.createAuditLog({
          action: 'SUPER_ADMIN_ACCESS',
          userId: (session as any).adminId,
          resourceType: 'User',
          resourceId: (session as any).targetUserId,
          details: {
            action: 'USER_IMPERSONATION_ENDED',
            targetUserId: (session as any).targetUserId,
            sessionToken: sessionToken.substring(0, 10) + '...',
            endedAt: new Date()
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium'
        });

        logger.info(`Impersonation session ended for admin ${(session as any).adminId}`);
      }
    } catch (error) {
      logger.error('Error ending impersonation session:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updateData: UserUpdateData, adminId?: string): Promise<IUser> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Store old values for audit
      const oldValues = { ...user };

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).populate('workplaceId', 'name type');

      if (!updatedUser) {
        throw new Error('Failed to update user');
      }

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'PERMISSION_CHANGED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            action: 'USER_UPDATED',
            targetUserId: userId,
            updatedFields: Object.keys(updateData)
          },
          complianceCategory: 'access_control',
          riskLevel: 'low',
          changedFields: Object.keys(updateData),
          oldValues,
          newValues: updateData
        });
      }

      logger.info(`User ${userId} updated by admin ${adminId}`);
      return updatedUser as IUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  // Private helper methods

  private buildUserQuery(filters: UserFilters): Record<string, any> {
    const query: Record<string, any> = {};

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.role) {
      query.roles = filters.role;
    }

    if (filters.status) {
      switch (filters.status) {
        case 'active':
          query.isActive = true;
          query.suspendedAt = { $exists: false };
          break;
        case 'inactive':
          query.isActive = false;
          query.suspendedAt = { $exists: false };
          break;
        case 'suspended':
          query.suspendedAt = { $exists: true };
          break;
      }
    }

    if (filters.workspaceId) {
      query.workplaceId = filters.workspaceId;
    }

    if (filters.createdAfter || filters.createdBefore) {
      query.createdAt = {};
      if (filters.createdAfter) {
        query.createdAt.$gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        query.createdAt.$lte = filters.createdBefore;
      }
    }

    if (filters.lastLoginAfter || filters.lastLoginBefore) {
      query.lastLoginAt = {};
      if (filters.lastLoginAfter) {
        query.lastLoginAt.$gte = filters.lastLoginAfter;
      }
      if (filters.lastLoginBefore) {
        query.lastLoginAt.$lte = filters.lastLoginBefore;
      }
    }

    return query;
  }

  private async terminateAllUserSessions(userId: string): Promise<void> {
    try {
      // Update all active sessions for the user
      await UserSession.updateMany(
        { userId, isActive: true },
        {
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: 'User suspended'
        }
      );

      // Clear any cached sessions
      await this.cacheService.delPattern(`session:${userId}:*`);
    } catch (error) {
      logger.error('Error terminating user sessions:', error);
      // Don't throw here as this is a cleanup operation
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    newThisMonth: number;
  }> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [total, active, inactive, suspended, newThisMonth] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true, suspendedAt: { $exists: false } }),
        User.countDocuments({ isActive: false, suspendedAt: { $exists: false } }),
        User.countDocuments({ suspendedAt: { $exists: true } }),
        User.countDocuments({ createdAt: { $gte: startOfMonth } })
      ]);

      return {
        total,
        active,
        inactive,
        suspended,
        newThisMonth
      };
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw new Error('Failed to retrieve user statistics');
    }
  }

  /**
   * Clear user cache
   */
  async clearUserCache(userId?: string): Promise<void> {
    try {
      if (userId) {
        await this.cacheService.del(`user:${userId}`);
      } else {
        await this.cacheService.delPattern('user:*');
      }
    } catch (error) {
      logger.error('Error clearing user cache:', error);
      throw new Error('Failed to clear user cache');
    }
  }

  /**
   * Approve pending user
   */
  async approveUser(userId: string, adminId?: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'pending') {
        throw new Error('User is not in pending status');
      }

      // Update user status to active
      await User.findByIdAndUpdate(userId, {
        status: 'active',
        isActive: true,
        updatedAt: new Date()
      });

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Send approval email
      try {
        await emailService.sendUserApprovalNotification(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          workspaceName: user.workplaceId ? (user.workplaceId as any).name : undefined
        });
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError);
        // Don't throw - email failure shouldn't block the approval
      }

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'PERMISSION_GRANTED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            action: 'USER_APPROVED',
            targetUserId: userId,
            approvedAt: new Date()
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium',
          changedFields: ['status', 'isActive'],
          oldValues: { status: 'pending', isActive: false },
          newValues: { status: 'active', isActive: true }
        });
      }

      logger.info(`User ${userId} approved by admin ${adminId}`);
    } catch (error) {
      logger.error('Error approving user:', error);
      throw error;
    }
  }

  /**
   * Reject pending user
   */
  async rejectUser(userId: string, reason?: string, adminId?: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'pending') {
        throw new Error('User is not in pending status');
      }

      // Update user status to rejected
      await User.findByIdAndUpdate(userId, {
        status: 'suspended',
        isActive: false,
        suspensionReason: reason || 'Registration rejected',
        suspendedAt: new Date(),
        updatedAt: new Date()
      });

      // Clear user cache
      await this.cacheService.del(`user:${userId}`);

      // Send rejection email
      try {
        await emailService.sendUserRejectionNotification(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          reason
        });
      } catch (emailError) {
        logger.error('Failed to send rejection email:', emailError);
        // Don't throw - email failure shouldn't block the rejection
      }

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'PERMISSION_REVOKED',
          userId: adminId,
          resourceType: 'User',
          resourceId: userId,
          details: {
            action: 'USER_REJECTED',
            targetUserId: userId,
            reason: reason || 'Registration rejected',
            rejectedAt: new Date()
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium',
          changedFields: ['status', 'isActive', 'suspensionReason'],
          oldValues: { status: 'pending' },
          newValues: { status: 'suspended', isActive: false, suspensionReason: reason }
        });
      }

      logger.info(`User ${userId} rejected by admin ${adminId}. Reason: ${reason}`);
    } catch (error) {
      logger.error('Error rejecting user:', error);
      throw error;
    }
  }

  /**
   * Bulk approve users
   */
  async bulkApproveUsers(userIds: string[], adminId?: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      for (const userId of userIds) {
        try {
          await this.approveUser(userId, adminId);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Create bulk audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_OPERATION',
          userId: adminId,
          details: {
            action: 'BULK_USER_APPROVAL',
            userIds,
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors
          },
          complianceCategory: 'access_control',
          riskLevel: 'high'
        });
      }

      logger.info(`Bulk user approval completed. Success: ${result.success}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('Error in bulk user approval:', error);
      throw error;
    }
  }

  /**
   * Bulk reject users
   */
  async bulkRejectUsers(userIds: string[], reason?: string, adminId?: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      for (const userId of userIds) {
        try {
          await this.rejectUser(userId, reason, adminId);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Create bulk audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_OPERATION',
          userId: adminId,
          details: {
            action: 'BULK_USER_REJECTION',
            userIds,
            reason,
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors
          },
          complianceCategory: 'access_control',
          riskLevel: 'high'
        });
      }

      logger.info(`Bulk user rejection completed. Success: ${result.success}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('Error in bulk user rejection:', error);
      throw error;
    }
  }

  /**
   * Bulk suspend users
   */
  async bulkSuspendUsers(userIds: string[], reason: string, adminId?: string): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      for (const userId of userIds) {
        try {
          await this.suspendUser(userId, reason, adminId);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Create bulk audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'BULK_OPERATION',
          userId: adminId,
          details: {
            action: 'BULK_USER_SUSPENSION',
            userIds,
            reason,
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors
          },
          complianceCategory: 'access_control',
          riskLevel: 'critical'
        });
      }

      logger.info(`Bulk user suspension completed. Success: ${result.success}, Failed: ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('Error in bulk user suspension:', error);
      throw error;
    }
  }

  /**
   * Create new user (by super admin)
   */
  async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
    workplaceId?: string;
    phone?: string;
  }, adminId?: string): Promise<IUser> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Create user
      const newUser = await User.create({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash,
        role: userData.role,
        workplaceId: userData.workplaceId,
        phone: userData.phone,
        status: 'active',
        isActive: true,
        emailVerified: true, // Auto-verify for admin-created users
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Populate workplaceId for email
      const populatedUser = await User.findById(newUser._id).populate('workplaceId', 'name');

      // Send welcome email with credentials
      try {
        await emailService.sendUserCreatedNotification(userData.email, {
          firstName: userData.firstName,
          lastName: userData.lastName,
          tempPassword: userData.password,
          workspaceName: populatedUser?.workplaceId ? (populatedUser.workplaceId as any).name : undefined
        });
      } catch (emailError) {
        logger.error('Failed to send user creation email:', emailError);
        // Don't throw - email failure shouldn't block user creation
      }

      // Create audit log
      if (adminId) {
        await this.auditService.createAuditLog({
          action: 'USER_CREATED',
          userId: adminId,
          resourceType: 'User',
          resourceId: newUser._id.toString(),
          details: {
            action: 'USER_CREATED_BY_ADMIN',
            targetUserId: newUser._id.toString(),
            email: userData.email,
            role: userData.role,
            workplaceId: userData.workplaceId
          },
          complianceCategory: 'access_control',
          riskLevel: 'medium'
        });
      }

      logger.info(`User ${newUser._id} created by admin ${adminId}`);
      return newUser;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }
}

export default UserManagementService;