import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import { UserManagementService } from '../services/UserManagementService';
import { sendSuccess, sendError } from '../utils/responseHelpers';
import logger from '../utils/logger';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended';
  workspaceId?: string;
  subscriptionPlan?: string;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ImpersonationSession {
  sessionToken: string;
  expiresAt: Date;
  targetUserId: string;
  adminUserId: string;
}

/**
 * SaaS User Management Controller
 * Handles user management operations with RBAC integration
 * for the SaaS Settings Module
 */
export class SaaSUserManagementController {
  private userManagementService: UserManagementService;

  constructor() {
    this.userManagementService = UserManagementService.getInstance();
  }

  /**
   * Get all users with filtering and pagination
   * GET /api/admin/saas/users
   */
  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        role = '',
        status = '',
        workspaceId = '',
        subscriptionPlan = '',
        lastLoginAfter = '',
        lastLoginBefore = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      logger.info('Fetching users for SaaS management', {
        adminId: req.user?._id,
        filters: { search, role, status, workspaceId },
        pagination: { page, limit, sortBy, sortOrder }
      });

      // Build filters
      const filters: UserFilters = {};
      if (search) filters.search = search as string;
      if (role) filters.role = role as string;
      if (status && ['active', 'inactive', 'suspended'].includes(status as string)) {
        filters.status = status as 'active' | 'inactive' | 'suspended';
      }
      if (workspaceId) filters.workspaceId = workspaceId as string;
      if (subscriptionPlan) filters.subscriptionPlan = subscriptionPlan as string;
      if (lastLoginAfter) filters.lastLoginAfter = new Date(lastLoginAfter as string);
      if (lastLoginBefore) filters.lastLoginBefore = new Date(lastLoginBefore as string);

      // Build pagination
      const pagination: Pagination = {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100), // Max 100 per page
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.userManagementService.getAllUsers(filters, pagination);

      sendSuccess(
        res,
        {
          users: result.users,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: result.total,
            pages: Math.ceil(result.total / pagination.limit),
            hasNext: pagination.page * pagination.limit < result.total,
            hasPrev: pagination.page > 1
          },
          filters: filters,
          summary: {
            totalUsers: result.total,
            activeUsers: result.users.filter(u => u.status === 'active').length,
            suspendedUsers: result.users.filter(u => u.status === 'suspended').length,
            pendingUsers: result.users.filter(u => u.status === 'pending').length
          }
        },
        'Users retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching users:', error);
      sendError(
        res,
        'USER_FETCH_ERROR',
        'Failed to retrieve users',
        500
      );
    }
  }

  /**
   * Get user by ID with detailed information
   * GET /api/admin/saas/users/:userId
   */
  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      logger.info('Fetching user details', {
        adminId: req.user?._id,
        targetUserId: userId
      });

      const user = await this.userManagementService.getUserById(userId);

      if (!user) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
        return;
      }

      // Get user activity logs
      const activityLogs = await this.userManagementService.getUserActivityLogs(userId);

      sendSuccess(
        res,
        {
          user,
          activityLogs: activityLogs.slice(0, 10), // Last 10 activities
          totalActivities: activityLogs.length
        },
        'User details retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      sendError(
        res,
        'USER_DETAIL_ERROR',
        'Failed to retrieve user details',
        500
      );
    }
  }

  /**
   * Update user role
   * PUT /api/admin/saas/users/:userId/role
   */
  async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { roleId, workspaceId, reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      if (!roleId) {
        sendError(res, 'INVALID_ROLE_ID', 'Role ID is required', 400);
        return;
      }

      // Validate roleId format - accept both ObjectId and role name
      if (!mongoose.Types.ObjectId.isValid(roleId) &&
        (typeof roleId !== 'string' || !/^[a-z0-9_-]+$/.test(roleId))) {
        sendError(res, 'INVALID_ROLE_ID', 'Invalid role ID format', 400);
        return;
      }

      logger.info('Updating user role', {
        adminId: req.user?._id,
        targetUserId: userId,
        roleId,
        workspaceId,
        reason
      });

      await this.userManagementService.updateUserRole(
        userId,
        roleId,
        workspaceId
      );

      // Log the role change
      logger.info('User role updated successfully', {
        adminId: req.user?._id,
        targetUserId: userId,
        roleId,
        workspaceId,
        reason: reason || 'No reason provided'
      });

      sendSuccess(
        res,
        {
          userId,
          roleId,
          workspaceId,
          updatedBy: req.user?._id,
          updatedAt: new Date(),
          reason: reason || 'No reason provided'
        },
        'User role updated successfully'
      );
    } catch (error) {
      logger.error('Error updating user role:', error);

      if (error instanceof Error) {
        if (error.message.includes('User not found')) {
          sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
        } else if (error.message.includes('Role not found')) {
          sendError(res, 'ROLE_NOT_FOUND', 'Role not found', 404);
        } else if (error.message.includes('already has this role')) {
          sendError(res, 'ROLE_ALREADY_ASSIGNED', 'User already has this role', 400);
        } else {
          sendError(res, 'ROLE_UPDATE_ERROR', 'Failed to update user role', 500);
        }
      } else {
        sendError(res, 'ROLE_UPDATE_ERROR', 'Failed to update user role', 500);
      }
    }
  }

  /**
   * Suspend user account
   * PUT /api/admin/saas/users/:userId/suspend
   */
  async suspendUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        sendError(res, 'REASON_REQUIRED', 'Suspension reason is required', 400);
        return;
      }

      logger.info('Suspending user account', {
        adminId: req.user?._id,
        targetUserId: userId,
        reason
      });

      await this.userManagementService.suspendUser(userId, reason);

      sendSuccess(
        res,
        {
          userId,
          status: 'suspended',
          reason,
          suspendedBy: req.user?._id,
          suspendedAt: new Date()
        },
        'User account suspended successfully'
      );
    } catch (error) {
      logger.error('Error suspending user:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('already suspended')) {
        sendError(res, 'USER_ALREADY_SUSPENDED', 'User is already suspended', 400);
      } else {
        sendError(res, 'SUSPEND_ERROR', 'Failed to suspend user', 500);
      }
    }
  }

  /**
   * Reactivate user account
   * PUT /api/admin/saas/users/:userId/reactivate
   */
  async reactivateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      logger.info('Reactivating user account', {
        adminId: req.user?._id,
        targetUserId: userId
      });

      await this.userManagementService.reactivateUser(userId);

      sendSuccess(
        res,
        {
          userId,
          status: 'active',
          reactivatedBy: req.user?._id,
          reactivatedAt: new Date()
        },
        'User account reactivated successfully'
      );
    } catch (error) {
      logger.error('Error reactivating user:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('not suspended')) {
        sendError(res, 'USER_NOT_SUSPENDED', 'User is not suspended', 400);
      } else {
        sendError(res, 'REACTIVATE_ERROR', 'Failed to reactivate user', 500);
      }
    }
  }

  /**
   * Bulk assign roles to multiple users
   * POST /api/admin/saas/users/bulk-assign-roles
   */
  async bulkAssignRoles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userIds, roleId, workspaceId } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        sendError(res, 'INVALID_USER_IDS', 'User IDs array is required and cannot be empty', 400);
        return;
      }

      if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
        sendError(res, 'INVALID_ROLE_ID', 'Invalid role ID format', 400);
        return;
      }

      // Validate all user IDs
      const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        sendError(res, 'INVALID_USER_IDS', `Invalid user IDs: ${invalidIds.join(', ')}`, 400);
        return;
      }

      logger.info('Bulk assigning roles', {
        adminId: req.user?._id,
        userIds,
        roleId,
        workspaceId
      });

      const result = await this.userManagementService.bulkAssignRoles(
        userIds,
        roleId,
        workspaceId
      );

      sendSuccess(
        res,
        {
          totalUsers: userIds.length,
          successfulAssignments: result.success,
          failedAssignments: result.failed,
          assignedBy: req.user?._id,
          assignedAt: new Date(),
          errors: result.errors
        },
        'Bulk role assignment completed'
      );
    } catch (error) {
      logger.error('Error in bulk role assignment:', error);
      sendError(
        res,
        'BULK_ASSIGN_ERROR',
        'Failed to perform bulk role assignment',
        500
      );
    }
  }

  /**
   * Impersonate user for support purposes
   * POST /api/admin/saas/users/:userId/impersonate
   */
  async impersonateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { duration = 3600 } = req.body; // Default 1 hour

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      // Validate duration (max 24 hours)
      const maxDuration = 24 * 60 * 60; // 24 hours in seconds
      const sessionDuration = Math.min(parseInt(duration, 10), maxDuration);

      logger.info('Creating impersonation session', {
        adminId: req.user?._id,
        targetUserId: userId,
        duration: sessionDuration
      });

      const impersonationSession = await this.userManagementService.impersonateUser(
        req.user!._id.toString(),
        userId
      );

      // Log the impersonation for audit purposes
      logger.warn('User impersonation initiated', {
        adminId: req.user?._id,
        adminEmail: req.user?.email,
        targetUserId: userId,
        sessionToken: impersonationSession.sessionToken.substring(0, 10) + '...',
        expiresAt: impersonationSession.expiresAt
      });

      sendSuccess(
        res,
        {
          sessionToken: impersonationSession.sessionToken,
          expiresAt: impersonationSession.expiresAt,
          targetUserId: userId,
          duration: sessionDuration,
          warning: 'This session is being logged for security purposes'
        },
        'Impersonation session created successfully'
      );
    } catch (error) {
      logger.error('Error creating impersonation session:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'Target user not found', 404);
      } else if (error instanceof Error && error.message.includes('cannot impersonate')) {
        sendError(res, 'IMPERSONATION_FORBIDDEN', 'Cannot impersonate this user', 403);
      } else {
        sendError(res, 'IMPERSONATION_ERROR', 'Failed to create impersonation session', 500);
      }
    }
  }

  /**
   * Get user statistics and analytics
   * GET /api/admin/saas/users/statistics
   */
  async getUserStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { timeRange = '30d' } = req.query;

      logger.info('Fetching user statistics', {
        adminId: req.user?._id,
        timeRange
      });

      const statistics = await this.userManagementService.getUserStatistics();

      sendSuccess(
        res,
        {
          statistics,
          timeRange,
          generatedAt: new Date()
        },
        'User statistics retrieved successfully'
      );
    } catch (error) {
      logger.error('Error fetching user statistics:', error);
      sendError(
        res,
        'STATISTICS_ERROR',
        'Failed to retrieve user statistics',
        500
      );
    }
  }

  /**
   * Search users with advanced filters
   * POST /api/admin/saas/users/search
   */
  async searchUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        query,
        filters = {},
        pagination = { page: 1, limit: 20 },
        includeInactive = false
      } = req.body;

      logger.info('Searching users with advanced filters', {
        adminId: req.user?._id,
        query,
        filters,
        includeInactive
      });

      // Build search filters
      const searchFilters: UserFilters = {
        ...filters,
        search: query
      };

      const searchPagination: Pagination = {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        sortBy: pagination.sortBy || 'createdAt',
        sortOrder: pagination.sortOrder || 'desc'
      };

      const result = await this.userManagementService.getAllUsers(
        searchFilters,
        searchPagination
      );

      sendSuccess(
        res,
        {
          users: result.users,
          total: result.total,
          pagination: {
            ...searchPagination,
            pages: Math.ceil(result.total / searchPagination.limit)
          },
          searchQuery: query,
          appliedFilters: filters
        },
        'User search completed successfully'
      );
    } catch (error) {
      logger.error('Error searching users:', error);
      sendError(
        res,
        'SEARCH_ERROR',
        'Failed to search users',
        500
      );
    }
  }

  /**
   * Approve pending user
   * PUT /api/admin/saas/users/:userId/approve
   */
  async approveUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      logger.info('Approving user', {
        adminId: req.user?._id,
        targetUserId: userId
      });

      await this.userManagementService.approveUser(userId, req.user?._id.toString());

      sendSuccess(
        res,
        {
          userId,
          status: 'active',
          approvedBy: req.user?._id,
          approvedAt: new Date()
        },
        'User approved successfully'
      );
    } catch (error) {
      logger.error('Error approving user:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('not in pending status')) {
        sendError(res, 'USER_NOT_PENDING', 'User is not in pending status', 400);
      } else {
        sendError(res, 'APPROVE_ERROR', 'Failed to approve user', 500);
      }
    }
  }

  /**
   * Reject pending user
   * PUT /api/admin/saas/users/:userId/reject
   */
  async rejectUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        sendError(res, 'INVALID_USER_ID', 'Invalid user ID format', 400);
        return;
      }

      logger.info('Rejecting user', {
        adminId: req.user?._id,
        targetUserId: userId,
        reason
      });

      await this.userManagementService.rejectUser(userId, reason, req.user?._id.toString());

      sendSuccess(
        res,
        {
          userId,
          status: 'rejected',
          reason,
          rejectedBy: req.user?._id,
          rejectedAt: new Date()
        },
        'User rejected successfully'
      );
    } catch (error) {
      logger.error('Error rejecting user:', error);

      if (error instanceof Error && error.message.includes('User not found')) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      } else if (error instanceof Error && error.message.includes('not in pending status')) {
        sendError(res, 'USER_NOT_PENDING', 'User is not in pending status', 400);
      } else {
        sendError(res, 'REJECT_ERROR', 'Failed to reject user', 500);
      }
    }
  }

  /**
   * Bulk approve users
   * POST /api/admin/saas/users/bulk-approve
   */
  async bulkApproveUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        sendError(res, 'INVALID_USER_IDS', 'User IDs array is required and cannot be empty', 400);
        return;
      }

      logger.info('Bulk approving users', {
        adminId: req.user?._id,
        userIds
      });

      const result = await this.userManagementService.bulkApproveUsers(
        userIds,
        req.user?._id.toString()
      );

      sendSuccess(
        res,
        {
          totalUsers: userIds.length,
          successfulApprovals: result.success,
          failedApprovals: result.failed,
          approvedBy: req.user?._id,
          approvedAt: new Date(),
          errors: result.errors
        },
        'Bulk user approval completed'
      );
    } catch (error) {
      logger.error('Error in bulk user approval:', error);
      sendError(
        res,
        'BULK_APPROVE_ERROR',
        'Failed to perform bulk user approval',
        500
      );
    }
  }

  /**
   * Bulk reject users
   * POST /api/admin/saas/users/bulk-reject
   */
  async bulkRejectUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userIds, reason } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        sendError(res, 'INVALID_USER_IDS', 'User IDs array is required and cannot be empty', 400);
        return;
      }

      logger.info('Bulk rejecting users', {
        adminId: req.user?._id,
        userIds,
        reason
      });

      const result = await this.userManagementService.bulkRejectUsers(
        userIds,
        reason,
        req.user?._id.toString()
      );

      sendSuccess(
        res,
        {
          totalUsers: userIds.length,
          successfulRejections: result.success,
          failedRejections: result.failed,
          rejectedBy: req.user?._id,
          rejectedAt: new Date(),
          errors: result.errors
        },
        'Bulk user rejection completed'
      );
    } catch (error) {
      logger.error('Error in bulk user rejection:', error);
      sendError(
        res,
        'BULK_REJECT_ERROR',
        'Failed to perform bulk user rejection',
        500
      );
    }
  }

  /**
   * Bulk suspend users
   * POST /api/admin/saas/users/bulk-suspend
   */
  async bulkSuspendUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userIds, reason } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        sendError(res, 'INVALID_USER_IDS', 'User IDs array is required and cannot be empty', 400);
        return;
      }

      if (!reason || reason.trim().length === 0) {
        sendError(res, 'REASON_REQUIRED', 'Suspension reason is required', 400);
        return;
      }

      logger.info('Bulk suspending users', {
        adminId: req.user?._id,
        userIds,
        reason
      });

      const result = await this.userManagementService.bulkSuspendUsers(
        userIds,
        reason,
        req.user?._id.toString()
      );

      sendSuccess(
        res,
        {
          totalUsers: userIds.length,
          successfulSuspensions: result.success,
          failedSuspensions: result.failed,
          suspendedBy: req.user?._id,
          suspendedAt: new Date(),
          errors: result.errors
        },
        'Bulk user suspension completed'
      );
    } catch (error) {
      logger.error('Error in bulk user suspension:', error);
      sendError(
        res,
        'BULK_SUSPEND_ERROR',
        'Failed to perform bulk user suspension',
        500
      );
    }
  }

  /**
   * Create new user
   * POST /api/admin/saas/users
   */
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, firstName, lastName, password, role, workplaceId, phone } = req.body;

      if (!email || !firstName || !lastName || !password || !role) {
        sendError(res, 'MISSING_FIELDS', 'Email, first name, last name, password, and role are required', 400);
        return;
      }

      logger.info('Creating new user', {
        adminId: req.user?._id,
        email,
        role,
        workplaceId
      });

      const newUser = await this.userManagementService.createUser(
        {
          email,
          firstName,
          lastName,
          password,
          role,
          workplaceId,
          phone
        },
        req.user?._id.toString()
      );

      sendSuccess(
        res,
        {
          user: {
            _id: newUser._id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
            status: newUser.status,
            workplaceId: newUser.workplaceId
          },
          createdBy: req.user?._id,
          createdAt: new Date()
        },
        'User created successfully'
      );
    } catch (error) {
      logger.error('Error creating user:', error);

      if (error instanceof Error && error.message.includes('already exists')) {
        sendError(res, 'USER_EXISTS', 'User with this email already exists', 409);
      } else {
        sendError(res, 'CREATE_ERROR', 'Failed to create user', 500);
      }
    }
  }
}

// Create and export controller instance
export const saasUserManagementController = new SaaSUserManagementController();
