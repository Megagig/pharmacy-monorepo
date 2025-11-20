import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import Role, { IRole } from '../models/Role';
import UserRole, { IUserRole } from '../models/UserRole';
import Permission, { IPermission } from '../models/Permission';
import DynamicPermissionService from '../services/DynamicPermissionService';
import RoleHierarchyService from '../services/RoleHierarchyService';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { WorkspaceContext, PlanLimits } from '../types/auth';
import { emailService } from '../utils/emailService';

export class AdminController {
  private dynamicPermissionService: DynamicPermissionService;
  private roleHierarchyService: RoleHierarchyService;

  constructor() {
    this.dynamicPermissionService = DynamicPermissionService.getInstance();
    this.roleHierarchyService = RoleHierarchyService.getInstance();
  }

  /**
   * Get all users with pagination and filtering
   * GET /api/admin/users
   */
  async getAllUsers(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add search filter if provided
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Add role filter if provided
      if (role) {
        query.role = role;
      }

      // Add status filter if provided
      if (status) {
        query.status = status;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get users with pagination
      const users = await User.find(query)
        .select('-password -verificationToken -resetPasswordToken')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await User.countDocuments(query);

      // Get role details for each user
      const userIds = users.map((user) => user._id);
      const userRoles = await UserRole.find({
        userId: { $in: userIds },
        isActive: true,
      }).populate('roleId', 'name displayName category description');

      // Debug logging
      logger.info(`Found ${userRoles.length} UserRole records for ${userIds.length} users`);
      if (userRoles.length > 0) {
        logger.info('Sample UserRole:', JSON.stringify(userRoles[0]));
      }

      // Create a map of user roles
      const userRolesMap = new Map<string, any[]>();
      userRoles.forEach((ur) => {
        const userId = ur.userId.toString();
        if (!userRolesMap.has(userId)) {
          userRolesMap.set(userId, []);
        }
        userRolesMap.get(userId)!.push(ur.roleId);
      });

      // Format response with all RBAC fields
      const formattedUsers = users.map((user) => {
        const userObj = user.toObject();
        const roles = userRolesMap.get(user._id.toString()) || [];
        return {
          ...userObj,
          roles, // Populated roles from UserRole table
          // Ensure RBAC fields are present
          assignedRoles: userObj.assignedRoles || [],
          directPermissions: userObj.directPermissions || [],
          deniedPermissions: userObj.deniedPermissions || [],
        };
      });

      // Debug: Log first user's role data
      if (formattedUsers.length > 0) {
        logger.info('Sample formatted user:', {
          email: formattedUsers[0].email,
          roles: formattedUsers[0].roles,
          assignedRoles: formattedUsers[0].assignedRoles,
          systemRole: (formattedUsers[0] as any).systemRole,
        });
      }

      res.json({
        success: true,
        data: {
          users: formattedUsers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/admin/users/:userId
   */
  async getUserById(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(userId).select(
        '-password -verificationToken -resetPasswordToken'
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get user roles
      const userRoles = await UserRole.find({
        userId: user._id,
        isActive: true,
      }).populate('roleId', 'name displayName category');

      res.json({
        success: true,
        data: {
          user: {
            ...user.toObject(),
            roles: userRoles.map((ur) => ur.roleId),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user by ID',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update user role
   * PUT /api/admin/users/:userId/role
   */
  async updateUserRole(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;
      const { roleId, workspaceId } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID format',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found',
        });
      }

      // Check if user already has this role
      const existingAssignment = await UserRole.findOne({
        userId,
        roleId,
        workspaceId: workspaceId || { $exists: false },
        isActive: true,
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: 'User already has this role',
        });
      }

      // Assign role to user
      const userRole = new UserRole({
        userId,
        roleId,
        workspaceId: workspaceId || undefined,
        assignedBy: req.user!._id,
        lastModifiedBy: req.user!._id,
        isActive: true,
      });

      await userRole.save();

      // Update user's assignedRoles array
      const currentAssignedRoles = await UserRole.find({
        userId,
        isActive: true,
      }).distinct('roleId');

      await User.findByIdAndUpdate(userId, {
        assignedRoles: currentAssignedRoles,
        roleLastModifiedBy: req.user!._id,
        roleLastModifiedAt: new Date(),
      });

      // Invalidate user permission cache
      await this.dynamicPermissionService.invalidateUserCache(
        new mongoose.Types.ObjectId(userId),
        workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
      );

      logger.info('User role updated', {
        userId,
        roleId,
        workspaceId: workspaceId || null,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user role',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Suspend user
   * POST /api/admin/users/:userId/suspend
   */
  async suspendUser(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.status === 'suspended') {
        return res.status(400).json({
          success: false,
          message: 'User is already suspended',
        });
      }

      // Suspend user
      user.status = 'suspended';
      user.suspensionReason = reason || 'No reason provided';
      user.suspendedAt = new Date();
      user.suspendedBy = req.user!._id;
      await user.save();

      logger.info('User suspended', {
        userId,
        reason: reason || 'No reason provided',
        suspendedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
      });
    } catch (error) {
      logger.error('Error suspending user:', error);
      res.status(500).json({
        success: false,
        message: 'Error suspending user',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Reactivate user
   * POST /api/admin/users/:userId/reactivate
   */
  async reactivateUser(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.status !== 'suspended') {
        return res.status(400).json({
          success: false,
          message: 'User is not suspended',
        });
      }

      // Reactivate user
      user.status = 'active';
      user.reactivatedAt = new Date();
      user.reactivatedBy = req.user!._id;
      await user.save();

      logger.info('User reactivated', {
        userId,
        reactivatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'User reactivated successfully',
      });
    } catch (error) {
      logger.error('Error reactivating user:', error);
      res.status(500).json({
        success: false,
        message: 'Error reactivating user',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Bulk assign roles
   * POST /api/admin/users/bulk-assign-roles
   */
  async bulkAssignRoles(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userIds, roleId, workspaceId } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required and cannot be empty',
        });
      }

      if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID format',
        });
      }

      // Validate all users exist
      const users = await User.find({
        _id: { $in: userIds },
      });

      if (users.length !== userIds.length) {
        const foundUserIds = users.map((u) => u._id.toString());
        const missingUserIds = userIds.filter(
          (id) => !foundUserIds.includes(id)
        );

        return res.status(400).json({
          success: false,
          message: 'Some users not found',
          missingUserIds,
        });
      }

      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found',
        });
      }

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Assign role to each user
          for (const userId of userIds) {
            // Check if user already has this role
            const existingAssignment = await UserRole.findOne({
              userId,
              roleId,
              workspaceId: workspaceId || { $exists: false },
              isActive: true,
            });

            if (!existingAssignment) {
              const userRole = new UserRole({
                userId,
                roleId,
                workspaceId: workspaceId || undefined,
                assignedBy: req.user!._id,
                lastModifiedBy: req.user!._id,
                isActive: true,
              });

              await userRole.save({ session });

              // Update user's assignedRoles array
              const currentAssignedRoles = await UserRole.find({
                userId,
                isActive: true,
              }).distinct('roleId');

              await User.findByIdAndUpdate(
                userId,
                {
                  assignedRoles: currentAssignedRoles,
                  roleLastModifiedBy: req.user!._id,
                  roleLastModifiedAt: new Date(),
                },
                { session }
              );

              // Invalidate user permission cache
              await this.dynamicPermissionService.invalidateUserCache(
                new mongoose.Types.ObjectId(userId),
                workspaceId
                  ? new mongoose.Types.ObjectId(workspaceId)
                  : undefined
              );
            }
          }

          logger.info('Bulk role assignment completed', {
            userIds,
            roleId,
            workspaceId: workspaceId || null,
            assignedBy: req.user!._id,
          });
        });

        res.json({
          success: true,
          message: 'Bulk role assignment completed successfully',
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      logger.error('Error in bulk role assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Error in bulk role assignment',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Bulk revoke roles
   * POST /api/admin/users/bulk-revoke-roles
   */
  async bulkRevokeRoles(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userIds, roleId, workspaceId } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required and cannot be empty',
        });
      }

      if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role ID format',
        });
      }

      // Validate all users exist
      const users = await User.find({
        _id: { $in: userIds },
      });

      if (users.length !== userIds.length) {
        const foundUserIds = users.map((u) => u._id.toString());
        const missingUserIds = userIds.filter(
          (id) => !foundUserIds.includes(id)
        );

        return res.status(400).json({
          success: false,
          message: 'Some users not found',
          missingUserIds,
        });
      }

      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found',
        });
      }

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Revoke role from each user
          for (const userId of userIds) {
            // Find the user role assignment
            const query: any = {
              userId,
              roleId,
              isActive: true,
            };

            if (workspaceId) {
              query.workspaceId = workspaceId;
            }

            const userRole = await UserRole.findOne(query);

            if (userRole) {
              // Revoke the role assignment
              userRole.isActive = false;
              userRole.revokedBy = req.user!._id;
              userRole.revokedAt = new Date();
              userRole.lastModifiedBy = req.user!._id;
              await userRole.save({ session });

              // Update user's assignedRoles array
              const currentAssignedRoles = await UserRole.find({
                userId,
                isActive: true,
              }).distinct('roleId');

              await User.findByIdAndUpdate(
                userId,
                {
                  assignedRoles: currentAssignedRoles,
                  roleLastModifiedBy: req.user!._id,
                  roleLastModifiedAt: new Date(),
                },
                { session }
              );

              // Invalidate user permission cache
              await this.dynamicPermissionService.invalidateUserCache(
                new mongoose.Types.ObjectId(userId),
                workspaceId
                  ? new mongoose.Types.ObjectId(workspaceId)
                  : undefined
              );
            }
          }

          logger.info('Bulk role revocation completed', {
            userIds,
            roleId,
            workspaceId: workspaceId || null,
            revokedBy: req.user!._id,
          });
        });

        res.json({
          success: true,
          message: 'Bulk role revocation completed successfully',
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      logger.error('Error in bulk role revocation:', error);
      res.status(500).json({
        success: false,
        message: 'Error in bulk role revocation',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get pending licenses
   * GET /api/admin/licenses/pending
   */
  async getPendingLicenses(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 50,
        search = '',
        status = 'pending',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query - find users with license documents
      const query: any = {
        licenseStatus: status,
        licenseDocument: { $exists: true },
      };

      // Add search filter if provided
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { licenseNumber: { $regex: search, $options: 'i' } },
        ];
      }

      // Get users with licenses
      const users = await User.find(query)
        .populate('workplaceId', 'name')
        .select('firstName lastName email role licenseNumber licenseStatus licenseDocument pharmacySchool yearOfGraduation licenseExpirationDate workplaceId')
        .sort({ 'licenseDocument.uploadedAt': -1 })
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await User.countDocuments(query);

      // Format response
      const licenses = users.map(user => ({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        userRole: user.role,
        workplaceName: (user.workplaceId as any)?.name,
        licenseNumber: user.licenseNumber,
        licenseStatus: user.licenseStatus,
        pharmacySchool: user.pharmacySchool,
        yearOfGraduation: user.yearOfGraduation,
        expirationDate: user.licenseExpirationDate,
        documentInfo: user.licenseDocument ? {
          fileName: user.licenseDocument.fileName,
          uploadedAt: user.licenseDocument.uploadedAt,
          fileSize: user.licenseDocument.fileSize,
        } : undefined,
      }));

      res.json({
        success: true,
        data: {
          licenses,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching pending licenses:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending licenses',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Approve license
   * POST /api/admin/licenses/:userId/approve
   */
  async approveLicense(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.licenseStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'License is not pending approval',
        });
      }

      if (!user.licenseDocument) {
        return res.status(400).json({
          success: false,
          message: 'No license document found',
        });
      }

      // Approve license
      user.licenseStatus = 'approved';
      user.licenseVerifiedAt = new Date();
      user.licenseVerifiedBy = req.user!._id;
      user.status = 'active'; // Activate user account
      await user.save();

      // Send approval email asynchronously (non-blocking)
      emailService.sendLicenseApprovalNotification(user.email, {
        firstName: user.firstName,
        licenseNumber: user.licenseNumber || '',
      }).catch((emailError) => {
        logger.error('Failed to send approval email:', emailError);
        // Email failure doesn't affect the approval
      });

      logger.info('License approved', {
        userId,
        licenseNumber: user.licenseNumber,
        approvedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'License approved successfully',
      });
    } catch (error) {
      logger.error('Error approving license:', error);
      res.status(500).json({
        success: false,
        message: 'Error approving license',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Reject license
   * POST /api/admin/licenses/:userId/reject
   */
  async rejectLicense(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.licenseStatus !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'License is not pending approval',
        });
      }

      // Reject license
      user.licenseStatus = 'rejected';
      user.licenseVerifiedAt = new Date();
      user.licenseVerifiedBy = req.user!._id;
      user.licenseRejectionReason = reason;
      user.status = 'license_rejected'; // Update user status
      await user.save();

      // Send rejection email asynchronously (non-blocking)
      emailService.sendLicenseRejectionNotification(user.email, {
        firstName: user.firstName,
        reason: reason,
      }).catch((emailError) => {
        logger.error('Failed to send rejection email:', emailError);
        // Email failure doesn't affect the rejection
      });

      logger.info('License rejected', {
        userId,
        licenseNumber: user.licenseNumber,
        reason: reason,
        rejectedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'License rejected successfully',
      });
    } catch (error) {
      logger.error('Error rejecting license:', error);
      res.status(500).json({
        success: false,
        message: 'Error rejecting license',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get all feature flags
   * GET /api/admin/feature-flags
   */
  async getAllFeatureFlags(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        isActive = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add search filter if provided
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Add active filter if provided
      if (isActive !== '') {
        query.isActive = isActive === 'true';
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get feature flags with pagination
      const FeatureFlag = mongoose.model('FeatureFlag');
      const featureFlags = await FeatureFlag.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await FeatureFlag.countDocuments(query);

      res.json({
        success: true,
        data: {
          featureFlags,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching feature flags:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching feature flags',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Create feature flag
   * POST /api/admin/feature-flags
   */
  async createFeatureFlag(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { name, description, isActive, conditions } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Feature flag name is required',
        });
      }

      // Check if feature flag with this name already exists
      const FeatureFlag = mongoose.model('FeatureFlag');
      const existingFlag = await FeatureFlag.findOne({ name });

      if (existingFlag) {
        return res.status(400).json({
          success: false,
          message: 'Feature flag with this name already exists',
        });
      }

      // Create feature flag
      const featureFlag = new FeatureFlag({
        name,
        description,
        isActive: isActive !== undefined ? isActive : true,
        conditions: conditions || {},
        createdBy: req.user!._id,
      });

      await featureFlag.save();

      logger.info('Feature flag created', {
        featureFlagId: featureFlag._id,
        name,
        isActive: featureFlag.isActive,
        createdBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'Feature flag created successfully',
        data: {
          featureFlag,
        },
      });
    } catch (error) {
      logger.error('Error creating feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating feature flag',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update feature flag
   * PUT /api/admin/feature-flags/:flagId
   */
  async updateFeatureFlag(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { flagId } = req.params;
      const { name, description, isActive, conditions } = req.body;

      if (!flagId || !mongoose.Types.ObjectId.isValid(flagId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid feature flag ID format',
        });
      }

      const FeatureFlag = mongoose.model('FeatureFlag');
      const featureFlag = await FeatureFlag.findById(flagId);

      if (!featureFlag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
        });
      }

      // Check if another feature flag with this name already exists
      if (name && name !== featureFlag.name) {
        const existingFlag = await FeatureFlag.findOne({ name });

        if (existingFlag) {
          return res.status(400).json({
            success: false,
            message: 'Feature flag with this name already exists',
          });
        }
      }

      // Update feature flag
      const updateData: any = {
        lastModifiedBy: req.user!._id,
        lastModifiedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (conditions !== undefined) updateData.conditions = conditions;

      const updatedFeatureFlag = await FeatureFlag.findByIdAndUpdate(
        flagId,
        updateData,
        { new: true }
      );

      logger.info('Feature flag updated', {
        featureFlagId: flagId,
        name: updatedFeatureFlag.name,
        isActive: updatedFeatureFlag.isActive,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'Feature flag updated successfully',
        data: {
          featureFlag: updatedFeatureFlag,
        },
      });
    } catch (error) {
      logger.error('Error updating feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating feature flag',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system analytics
   * GET /api/admin/analytics
   */
  async getSystemAnalytics(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      let startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get user analytics
      const userAnalytics = {
        total: await User.countDocuments(),
        active: await User.countDocuments({ status: 'active' }),
        new: await User.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        byRole: await User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        byStatus: await User.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        growth: await User.aggregate([
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
      };

      // Get role analytics
      const roleAnalytics = {
        total: await Role.countDocuments(),
        active: await Role.countDocuments({ isActive: true }),
        assignments: await UserRole.countDocuments({
          isActive: true,
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        byCategory: await Role.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      };

      // Get permission analytics
      const permissionAnalytics = {
        total: await Permission.countDocuments(),
        active: await Permission.countDocuments({ isActive: true }),
        byCategory: await Permission.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        byRiskLevel: await Permission.aggregate([
          { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      };

      // Get activity analytics using AuditLog model
      const AuditLog = mongoose.model('AuditLog');
      const activityAnalytics = {
        total: await AuditLog.countDocuments({
          timestamp: { $gte: startDate, $lte: endDate },
        }),
        byAction: await AuditLog.aggregate([
          {
            $match: {
              timestamp: { $gte: startDate, $lte: endDate },
            },
          },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        byUser: await AuditLog.aggregate([
          {
            $match: {
              timestamp: { $gte: startDate, $lte: endDate },
            },
          },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        daily: await AuditLog.aggregate([
          {
            $match: {
              timestamp: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: '$timestamp' },
                month: { $month: '$timestamp' },
                day: { $dayOfMonth: '$timestamp' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]),
      };

      res.json({
        success: true,
        data: {
          period,
          userAnalytics,
          roleAnalytics,
          permissionAnalytics,
          activityAnalytics,
        },
      });
    } catch (error) {
      logger.error('Error fetching system analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching system analytics',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get all roles with pagination and filtering
   * GET /api/admin/roles
   */
  async getAllRoles(req: AuthRequest, res: Response): Promise<any> {
    try {
      console.log('getAllRoles called with query:', req.query);

      // First, let's test if Role model is accessible
      console.log('Testing Role model...');
      const testCount = await Role.countDocuments({});
      console.log('Total roles in database:', testCount);

      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        isActive = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add search filter if provided
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Add category filter if provided
      if (category) {
        query.category = category;
      }

      // Add active filter if provided
      if (isActive !== '') {
        query.isActive = isActive === 'true';
      }

      console.log('Query built:', query);

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      console.log('Sort object:', sort);

      // Get roles with pagination
      const roles = await Role.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      console.log('Roles found:', roles.length);

      // Get total count for pagination
      const total = await Role.countDocuments(query);

      console.log('Total count:', total);

      res.json({
        success: true,
        data: {
          roles,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error('Error in getAllRoles:', error);
      logger.error('Error fetching roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching roles',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get all permissions with pagination and filtering
   * GET /api/admin/permissions
   */
  async getAllPermissions(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        riskLevel = '',
        isActive = '',
        sortBy = 'action',
        sortOrder = 'asc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add search filter if provided
      if (search) {
        query.$or = [
          { action: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Add category filter if provided
      if (category) {
        query.category = category;
      }

      // Add risk level filter if provided
      if (riskLevel) {
        query.riskLevel = riskLevel;
      }

      // Add active filter if provided
      if (isActive !== '') {
        query.isActive = isActive === 'true';
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get permissions with pagination
      const permissions = await Permission.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await Permission.countDocuments(query);

      res.json({
        success: true,
        data: {
          permissions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching permissions',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system statistics
   * GET /api/admin/statistics
   */
  async getSystemStatistics(req: AuthRequest, res: Response): Promise<any> {
    try {
      // Get user statistics
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ status: 'active' });
      const inactiveUsers = await User.countDocuments({ status: 'inactive' });
      const suspendedUsers = await User.countDocuments({ status: 'suspended' });

      // Get role statistics
      const totalRoles = await Role.countDocuments();
      const activeRoles = await Role.countDocuments({ isActive: true });
      const inactiveRoles = await Role.countDocuments({ isActive: false });

      // Get permission statistics
      const totalPermissions = await Permission.countDocuments();
      const activePermissions = await Permission.countDocuments({
        isActive: true,
      });
      const inactivePermissions = await Permission.countDocuments({
        isActive: false,
      });

      // Get user role assignment statistics
      const totalUserRoleAssignments = await UserRole.countDocuments();
      const activeUserRoleAssignments = await UserRole.countDocuments({
        isActive: true,
      });
      const expiredUserRoleAssignments = await UserRole.countDocuments({
        isTemporary: true,
        expiresAt: { $lt: new Date() },
      });

      // Get role distribution
      const roleDistribution = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Get user status distribution
      const statusDistribution = await User.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Get permission category distribution
      const permissionCategoryDistribution = await Permission.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Get role category distribution
      const roleCategoryDistribution = await Role.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: inactiveUsers,
            suspended: suspendedUsers,
            distribution: roleDistribution,
          },
          roles: {
            total: totalRoles,
            active: activeRoles,
            inactive: inactiveRoles,
            distribution: roleCategoryDistribution,
          },
          permissions: {
            total: totalPermissions,
            active: activePermissions,
            inactive: inactivePermissions,
            distribution: permissionCategoryDistribution,
          },
          assignments: {
            total: totalUserRoleAssignments,
            active: activeUserRoleAssignments,
            expired: expiredUserRoleAssignments,
          },
          statusDistribution,
        },
      });
    } catch (error) {
      logger.error('Error fetching system statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching system statistics',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get audit logs with pagination and filtering
   * GET /api/admin/audit-logs
   */
  async getAuditLogs(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        action = '',
        userId = '',
        entityType = '',
        entityId = '',
        startDate = '',
        endDate = '',
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add action filter if provided
      if (action) {
        query.action = action;
      }

      // Add user filter if provided
      if (userId) {
        query.userId = userId;
      }

      // Add entity type filter if provided
      if (entityType) {
        query.entityType = entityType;
      }

      // Add entity ID filter if provided
      if (entityId) {
        query.entityId = entityId;
      }

      // Add date range filter if provided
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate as string);
        }
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get audit logs with pagination
      const AuditLog = mongoose.model('AuditLog');
      const auditLogs = await AuditLog.find(query)
        .populate('userId', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await AuditLog.countDocuments(query);

      res.json({
        success: true,
        data: {
          auditLogs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching audit logs',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system health status
   * GET /api/admin/system-health
   */
  async getSystemHealth(req: AuthRequest, res: Response): Promise<any> {
    try {
      // Check database connection
      const dbStatus = {
        connected: mongoose.connection.readyState === 1,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      };

      // Get system memory usage
      const memoryUsage = process.memoryUsage();

      // Get system uptime
      const uptime = process.uptime();

      // Get node version
      const nodeVersion = process.version;

      // Get environment
      const environment = process.env.NODE_ENV || 'development';

      // Calculate health score
      let healthScore = 100;

      // Deduct points if database is not connected
      if (!dbStatus.connected) {
        healthScore -= 50;
      }

      // Deduct points if memory usage is high
      const memoryUsagePercentage =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      if (memoryUsagePercentage > 90) {
        healthScore -= 30;
      } else if (memoryUsagePercentage > 70) {
        healthScore -= 15;
      }

      // Determine overall health status
      let healthStatus = 'healthy';
      if (healthScore < 50) {
        healthStatus = 'critical';
      } else if (healthScore < 80) {
        healthStatus = 'warning';
      }

      res.json({
        success: true,
        data: {
          status: healthStatus,
          score: healthScore,
          database: dbStatus,
          memory: {
            usage: memoryUsage,
            percentage: memoryUsagePercentage.toFixed(2) + '%',
          },
          system: {
            uptime: uptime,
            nodeVersion,
            environment,
          },
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error fetching system health:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching system health',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system configuration
   * GET /api/admin/system-config
   */
  async getSystemConfig(req: AuthRequest, res: Response): Promise<any> {
    try {
      // Get system configuration from database or environment variables
      const config = {
        app: {
          name: process.env.APP_NAME || 'PharmacyCopilot SaaS',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          url: process.env.FRONTEND_URL || 'http://localhost:3000',
        },
        auth: {
          jwtExpiration: process.env.JWT_EXPIRATION || '7d',
          bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
          maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
          lockoutDuration: process.env.LOCKOUT_DURATION || '15m',
        },
        email: {
          provider: process.env.EMAIL_PROVIDER || 'sendgrid',
          from: process.env.EMAIL_FROM || 'noreply@PharmacyCopilot.com',
          maxRecipients: parseInt(
            process.env.MAX_EMAIL_RECIPIENTS || '100',
            10
          ),
        },
        upload: {
          maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
          allowedTypes:
            process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx',
          storageProvider: process.env.STORAGE_PROVIDER || 'local',
        },
        pagination: {
          defaultLimit: parseInt(
            process.env.DEFAULT_PAGINATION_LIMIT || '10',
            10
          ),
          maxLimit: parseInt(process.env.MAX_PAGINATION_LIMIT || '100', 10),
        },
        cache: {
          provider: process.env.CACHE_PROVIDER || 'memory',
          ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
        },
      };

      res.json({
        success: true,
        data: {
          config,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error fetching system config:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching system config',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update system configuration
   * PUT /api/admin/system-config
   */
  async updateSystemConfig(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { config } = req.body;

      // Validate configuration
      if (!config || typeof config !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration data',
        });
      }

      // In a real implementation, you would update the configuration in the database
      // or environment variables. For this example, we'll just return a success response.

      logger.info('System configuration updated', {
        config,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'System configuration updated successfully',
        data: {
          config,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating system config:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating system config',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system activity logs
   * GET /api/admin/activity-logs
   */
  async getActivityLogs(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        userId = '',
        action = '',
        entityType = '',
        startDate = '',
        endDate = '',
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add user filter if provided
      if (userId) {
        query.userId = userId;
      }

      // Add action filter if provided
      if (action) {
        query.action = action;
      }

      // Add entity type filter if provided
      if (entityType) {
        query.entityType = entityType;
      }

      // Add date range filter if provided
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate as string);
        }
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get activity logs with pagination
      const ActivityLog = mongoose.model('ActivityLog');
      const activityLogs = await ActivityLog.find(query)
        .populate('userId', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await ActivityLog.countDocuments(query);

      res.json({
        success: true,
        data: {
          activityLogs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching activity logs:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching activity logs',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system notifications
   * GET /api/admin/notifications
   */
  async getSystemNotifications(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        type = '',
        priority = '',
        isRead = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Add type filter if provided
      if (type) {
        query.type = type;
      }

      // Add priority filter if provided
      if (priority) {
        query.priority = priority;
      }

      // Add read status filter if provided
      if (isRead !== '') {
        query.isRead = isRead === 'true';
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get notifications with pagination
      const Notification = mongoose.model('Notification');
      const notifications = await Notification.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await Notification.countDocuments(query);

      // Get unread count
      const unreadCount = await Notification.countDocuments({ isRead: false });

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching system notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching system notifications',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/admin/notifications/:id/read
   */
  async markNotificationAsRead(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid notification ID format',
        });
      }

      const Notification = mongoose.model('Notification');
      const notification = await Notification.findByIdAndUpdate(
        id,
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      logger.info('Notification marked as read', {
        notificationId: id,
        markedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'Notification marked as read successfully',
        data: {
          notification,
        },
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking notification as read',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/admin/notifications/read-all
   */
  async markAllNotificationsAsRead(
    req: AuthRequest,
    res: Response
  ): Promise<any> {
    try {
      const Notification = mongoose.model('Notification');
      const result = await Notification.updateMany(
        { isRead: false },
        { isRead: true, readAt: new Date() }
      );

      logger.info('All notifications marked as read', {
        count: result.modifiedCount,
        markedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'All notifications marked as read successfully',
        data: {
          count: result.modifiedCount,
        },
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking all notifications as read',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/admin/notifications/:id
   */
  async deleteNotification(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid notification ID format',
        });
      }

      const Notification = mongoose.model('Notification');
      const notification = await Notification.findByIdAndDelete(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      logger.info('Notification deleted', {
        notificationId: id,
        deletedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting notification',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system backup status
   * GET /api/admin/backup-status
   */
  async getBackupStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      // In a real implementation, you would check the backup status from your backup service
      // For this example, we'll return a mock response

      const backupStatus = {
        lastBackup: {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          status: 'completed',
          size: '245.6 MB',
          duration: '2m 34s',
        },
        nextBackup: {
          date: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
          scheduled: true,
        },
        backupSchedule: {
          frequency: 'daily',
          time: '02:00 AM',
          retention: '30 days',
        },
        backupStorage: {
          provider: 'aws-s3',
          location: 'us-east-1',
          used: '1.2 GB',
          available: '9.8 GB',
        },
      };

      res.json({
        success: true,
        data: {
          backupStatus,
        },
      });
    } catch (error) {
      logger.error('Error fetching backup status:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching backup status',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Create system backup
   * POST /api/admin/create-backup
   */
  async createBackup(req: AuthRequest, res: Response): Promise<any> {
    try {
      // In a real implementation, you would trigger a backup process
      // For this example, we'll just return a success response

      const backupId = new mongoose.Types.ObjectId().toString();

      logger.info('System backup initiated', {
        backupId,
        initiatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'System backup initiated successfully',
        data: {
          backupId,
          status: 'in-progress',
          estimatedDuration: '5-10 minutes',
        },
      });
    } catch (error) {
      logger.error('Error creating system backup:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating system backup',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system security settings
   * GET /api/admin/security-settings
   */
  async getSecuritySettings(req: AuthRequest, res: Response): Promise<any> {
    try {
      // In a real implementation, you would fetch security settings from the database
      // For this example, we'll return a mock response

      const securitySettings = {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          expireAfterDays: 90,
          preventReuse: 5,
          lockoutAfterAttempts: 5,
          lockoutDurationMinutes: 15,
        },
        sessionPolicy: {
          timeoutMinutes: 30,
          concurrentSessions: 3,
          rememberMeDays: 30,
          requireReauthAfterDays: 7,
        },
        twoFactorAuth: {
          enabled: true,
          requiredForAdmins: true,
          requiredForUsers: false,
          methods: ['app', 'sms', 'email'],
        },
        ipRestrictions: {
          enabled: false,
          allowedIPs: [],
          blockSuspiciousIPs: true,
        },
        auditLogging: {
          enabled: true,
          logLevel: 'detailed',
          retentionDays: 365,
        },
      };

      res.json({
        success: true,
        data: {
          securitySettings,
        },
      });
    } catch (error) {
      logger.error('Error fetching security settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching security settings',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update system security settings
   * PUT /api/admin/security-settings
   */
  async updateSecuritySettings(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { securitySettings } = req.body;

      // Validate security settings
      if (!securitySettings || typeof securitySettings !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid security settings data',
        });
      }

      // In a real implementation, you would update the security settings in the database
      // For this example, we'll just return a success response

      logger.info('System security settings updated', {
        securitySettings,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'System security settings updated successfully',
        data: {
          securitySettings,
        },
      });
    } catch (error) {
      logger.error('Error updating security settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating security settings',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system maintenance status
   * GET /api/admin/maintenance-status
   */
  async getMaintenanceStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      // In a real implementation, you would fetch maintenance status from the database
      // For this example, we'll return a mock response

      const maintenanceStatus = {
        enabled: false,
        scheduled: false,
        nextMaintenance: null,
        lastMaintenance: {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          duration: '2 hours',
          description: 'Scheduled system maintenance',
        },
        maintenanceWindow: {
          startDay: 'sunday',
          startTime: '02:00',
          duration: '4 hours',
        },
        notifications: {
          beforeHours: 24,
          beforeMinutes: 60,
          message:
            'System maintenance is scheduled. Please save your work and log out.',
        },
      };

      res.json({
        success: true,
        data: {
          maintenanceStatus,
        },
      });
    } catch (error) {
      logger.error('Error fetching maintenance status:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching maintenance status',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update system maintenance status
   * PUT /api/admin/maintenance-status
   */
  async updateMaintenanceStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { maintenanceStatus } = req.body;

      // Validate maintenance status
      if (!maintenanceStatus || typeof maintenanceStatus !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid maintenance status data',
        });
      }

      // In a real implementation, you would update the maintenance status in the database
      // For this example, we'll just return a success response

      logger.info('System maintenance status updated', {
        maintenanceStatus,
        updatedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'System maintenance status updated successfully',
        data: {
          maintenanceStatus,
        },
      });
    } catch (error) {
      logger.error('Error updating maintenance status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating maintenance status',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get system API keys
   * GET /api/admin/api-keys
   */
  async getApiKeys(req: AuthRequest, res: Response): Promise<any> {
    try {
      // In a real implementation, you would fetch API keys from the database
      // For this example, we'll return a mock response

      const apiKeys = [
        {
          id: '1',
          name: 'Mobile App',
          key: 'pk_live_1234567890abcdef',
          prefix: 'pk_live',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000), // 335 days from now
          lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          permissions: ['read', 'write'],
          isActive: true,
        },
        {
          id: '2',
          name: 'Web Dashboard',
          key: 'pk_live_0987654321fedcba',
          prefix: 'pk_live',
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          expiresAt: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000), // 305 days from now
          lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          permissions: ['read', 'write', 'delete'],
          isActive: true,
        },
      ];

      res.json({
        success: true,
        data: {
          apiKeys,
        },
      });
    } catch (error) {
      logger.error('Error fetching API keys:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching API keys',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Create API key
   * POST /api/admin/api-keys
   */
  async createApiKey(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { name, permissions, expiresAt } = req.body;

      // Validate input
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'API key name is required',
        });
      }

      if (
        !permissions ||
        !Array.isArray(permissions) ||
        permissions.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'API key permissions are required',
        });
      }

      // In a real implementation, you would create the API key in the database
      // For this example, we'll just return a mock response

      const apiKey = {
        id: new mongoose.Types.ObjectId().toString(),
        name,
        key: 'pk_live_' + Math.random().toString(36).substring(2, 15),
        prefix: 'pk_live',
        createdAt: new Date(),
        expiresAt: expiresAt || null,
        lastUsed: null,
        permissions,
        isActive: true,
      };

      logger.info('API key created', {
        apiKeyId: apiKey.id,
        name,
        permissions,
        createdBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'API key created successfully',
        data: {
          apiKey,
        },
      });
    } catch (error) {
      logger.error('Error creating API key:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating API key',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Revoke API key
   * DELETE /api/admin/api-keys/:id
   */
  async revokeApiKey(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid API key ID format',
        });
      }

      // In a real implementation, you would revoke the API key in the database
      // For this example, we'll just return a success response

      logger.info('API key revoked', {
        apiKeyId: id,
        revokedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error) {
      logger.error('Error revoking API key:', error);
      res.status(500).json({
        success: false,
        message: 'Error revoking API key',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }
}

export const adminController = new AdminController();
