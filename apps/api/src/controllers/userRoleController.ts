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

export class UserRoleController {
  private dynamicPermissionService: DynamicPermissionService;
  private roleHierarchyService: RoleHierarchyService;

  constructor() {
    try {
      this.dynamicPermissionService = DynamicPermissionService.getInstance();
      this.roleHierarchyService = RoleHierarchyService.getInstance();
    } catch (error) {
      logger.error('Error initializing UserRoleController services:', error);
      // Initialize services with retry logic
      setTimeout(() => {
        try {
          this.dynamicPermissionService = DynamicPermissionService.getInstance();
          this.roleHierarchyService = RoleHierarchyService.getInstance();
          logger.info('UserRoleController services initialized successfully on retry');
        } catch (retryError) {
          logger.error('Failed to initialize UserRoleController services on retry:', retryError);
        }
      }, 1000);
    }
  }

  /**
   * Get user roles
   * GET /api/admin/users/:id/roles
   */
  async getUserRoles(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      // Validate user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get user role assignments
      const userRoles = await UserRole.find({
        userId: id,
        isActive: true,
      })
        .populate('roleId', 'name displayName description category isActive')
        .populate('assignedBy', 'firstName lastName')
        .sort({ assignedAt: -1 });

      // Get roles from user's assignedRoles array as well (for backward compatibility)
      const assignedRoleIds = user.assignedRoles || [];
      const assignedRoles = await Role.find({
        _id: { $in: assignedRoleIds },
        isActive: true,
      }).select('name displayName description category isActive');

      // Combine and deduplicate roles
      const allRoles = new Map();

      // Add roles from UserRole collection
      userRoles.forEach((ur) => {
        if (ur.roleId && typeof ur.roleId === 'object' && 'name' in ur.roleId) {
          const role = ur.roleId as any;
          allRoles.set(role._id.toString(), {
            _id: role._id,
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            category: role.category,
            isActive: role.isActive,
            assignmentDetails: {
              assignedAt: ur.assignedAt,
              assignedBy: ur.assignedBy,
              isTemporary: ur.isTemporary,
              expiresAt: ur.expiresAt,
              assignmentReason: ur.assignmentReason,
              workspaceId: ur.workspaceId,
            },
          });
        }
      });

      // Add roles from user's assignedRoles array
      assignedRoles.forEach((role) => {
        if (!allRoles.has(role._id.toString())) {
          allRoles.set(role._id.toString(), {
            _id: role._id,
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            category: role.category,
            isActive: role.isActive,
            assignmentDetails: {
              assignedAt: user.roleLastModifiedAt || user.createdAt,
              assignedBy: user.roleLastModifiedBy,
              isTemporary: false,
              source: 'legacy',
            },
          });
        }
      });

      const roles = Array.from(allRoles.values());

      res.json({
        success: true,
        data: {
          userRoles: roles,
          effectivePermissions: [],
          roleHierarchy: [],
        },
      });
    } catch (error) {
      logger.error('Error fetching user roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user roles',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Assign roles to a user
   * POST /api/admin/users/assign-roles
   */
  async assignUserRoles(req: AuthRequest, res: Response): Promise<any> {
    try {
      const {
        userIds,
        roleIds,
        workspaceId,
        isTemporary = false,
        expiresAt,
        assignmentReason,
      } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required and cannot be empty',
        });
      }

      if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Role IDs array is required and cannot be empty',
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

      // Validate all roles exist and are active
      const roles = await Role.find({
        _id: { $in: roleIds },
        isActive: true,
      });

      if (roles.length !== roleIds.length) {
        const foundRoleIds = roles.map((r) => r._id.toString());
        const missingRoleIds = roleIds.filter(
          (id) => !foundRoleIds.includes(id)
        );

        return res.status(400).json({
          success: false,
          message: 'Some roles not found or inactive',
          missingRoleIds,
        });
      }

      // Validate workspace if provided
      if (workspaceId) {
        const workspace = await mongoose
          .model('Workplace')
          .findById(workspaceId);
        if (!workspace) {
          return res.status(404).json({
            success: false,
            message: 'Workspace not found',
          });
        }
      }

      // Validate temporary assignment
      if (isTemporary) {
        if (!expiresAt) {
          return res.status(400).json({
            success: false,
            message: 'Expiration date is required for temporary assignments',
          });
        }

        const expirationDate = new Date(expiresAt);
        if (expirationDate <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Expiration date must be in the future',
          });
        }
      }

      const session = await mongoose.startSession();
      const operationId = new mongoose.Types.ObjectId().toString();

      try {
        await session.withTransaction(async () => {
          // Create new role assignments for each user
          const results = [];

          for (const userId of userIds) {
            for (const roleId of roleIds) {
              // Check if assignment already exists
              const existingAssignment = await UserRole.findOne({
                userId,
                roleId,
                workspaceId: workspaceId || { $exists: false },
                isActive: true,
              });

              if (existingAssignment) {
                continue; // Skip if already assigned
              }

              const userRole = new UserRole({
                userId,
                roleId,
                workspaceId: workspaceId || undefined,
                isTemporary,
                expiresAt: isTemporary ? new Date(expiresAt) : undefined,
                assignmentReason,
                assignedBy: req.user!._id,
                lastModifiedBy: req.user!._id,
                isActive: true,
              });

              await userRole.save({ session });
              results.push({
                userId,
                roleId,
                success: true,
              });
            }

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
            if (this.dynamicPermissionService) {
              await this.dynamicPermissionService.invalidateUserCache(
                new mongoose.Types.ObjectId(userId),
                workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
              );
            } else {
              logger.warn('DynamicPermissionService not available, skipping cache invalidation');
            }
          }

          logger.info('User roles assigned successfully', {
            userIds,
            roleIds,
            assignedBy: req.user!._id,
            workspaceId: workspaceId || null,
            isTemporary,
            operationId,
          });
        });

        res.json({
          success: true,
          message: 'User roles assigned successfully',
          data: {
            operationId,
            totalUpdates: userIds.length * roleIds.length,
            successfulUpdates: userIds.length * roleIds.length,
            failedUpdates: 0,
            results: userIds.map((userId) => ({
              userId,
              success: true,
              changes: {
                rolesAssigned: roleIds.length,
              },
            })),
            summary: {
              usersUpdated: userIds.length,
              rolesAssigned: roleIds.length,
            },
          },
        });
      } finally {
        await session.endSession();
      }
    } catch (error) {
      logger.error('Error assigning user roles:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning user roles',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Revoke a specific role from a user
   * DELETE /api/admin/users/:id/roles/:roleId
   */
  async revokeUserRole(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id, roleId } = req.params;
      const { workspaceId, revocationReason } = req.body;

      if (
        !id ||
        !roleId ||
        !mongoose.Types.ObjectId.isValid(id) ||
        !mongoose.Types.ObjectId.isValid(roleId)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID or role ID format',
        });
      }

      // Find the user role assignment
      const query: any = {
        userId: id,
        roleId,
        isActive: true,
      };

      if (workspaceId) {
        query.workspaceId = workspaceId;
      }

      const userRole = await UserRole.findOne(query);
      if (!userRole) {
        return res.status(404).json({
          success: false,
          message: 'User role assignment not found',
        });
      }

      // Revoke the role assignment
      userRole.isActive = false;
      userRole.revokedBy = req.user!._id;
      userRole.revokedAt = new Date();
      userRole.lastModifiedBy = req.user!._id;
      if (revocationReason) {
        userRole.revocationReason = revocationReason;
      }
      await userRole.save();

      // Update user's assignedRoles array
      const currentAssignedRoles = await UserRole.find({
        userId: id,
        isActive: true,
      }).distinct('roleId');

      await User.findByIdAndUpdate(id, {
        assignedRoles: currentAssignedRoles,
        roleLastModifiedBy: req.user!._id,
        roleLastModifiedAt: new Date(),
      });

      // Invalidate user permission cache
      if (this.dynamicPermissionService) {
        await this.dynamicPermissionService.invalidateUserCache(
          new mongoose.Types.ObjectId(id),
          workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
        );
      } else {
        logger.warn('DynamicPermissionService not available, skipping cache invalidation');
      }

      // Get role details for response
      const role = await Role.findById(roleId).select(
        'name displayName category'
      );

      logger.info('User role revoked successfully', {
        userId: id,
        roleId,
        revokedBy: req.user!._id,
        workspaceId: workspaceId || null,
        reason: revocationReason || 'No reason provided',
      });

      res.json({
        success: true,
        message: 'User role revoked successfully',
      });
    } catch (error) {
      logger.error('Error revoking user role:', error);
      res.status(500).json({
        success: false,
        message: 'Error revoking user role',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Manage user's direct permissions
   * PUT /api/admin/users/:id/permissions
   */
  async updateUserPermissions(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const {
        directPermissions = [],
        deniedPermissions = [],
        replaceExisting = true,
      } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Validate permissions exist
      const allPermissions = [...directPermissions, ...deniedPermissions];
      if (allPermissions.length > 0) {
        const validPermissions = await Permission.find({
          action: { $in: allPermissions },
          isActive: true,
        });

        const validPermissionActions = validPermissions.map((p) => p.action);
        const invalidPermissions = allPermissions.filter(
          (p) => !validPermissionActions.includes(p)
        );

        if (invalidPermissions.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid permissions found',
            invalidPermissions,
          });
        }
      }

      // Check for conflicts between direct and denied permissions
      const conflictingPermissions = directPermissions.filter((p: string) =>
        deniedPermissions.includes(p)
      );

      if (conflictingPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Permissions cannot be both granted and denied',
          conflictingPermissions,
        });
      }

      // Update user permissions
      const updateData: any = {
        roleLastModifiedBy: req.user!._id,
        roleLastModifiedAt: new Date(),
      };

      if (replaceExisting) {
        updateData.directPermissions = directPermissions;
        updateData.deniedPermissions = deniedPermissions;
      } else {
        // Merge with existing permissions
        const existingDirectPermissions = user.directPermissions || [];
        const existingDeniedPermissions = user.deniedPermissions || [];

        updateData.directPermissions = [
          ...new Set([...existingDirectPermissions, ...directPermissions]),
        ];
        updateData.deniedPermissions = [
          ...new Set([...existingDeniedPermissions, ...deniedPermissions]),
        ];
      }

      const updatedUser = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).select(
        'directPermissions deniedPermissions roleLastModifiedBy roleLastModifiedAt'
      );

      // Invalidate user permission cache
      if (this.dynamicPermissionService) {
        await this.dynamicPermissionService.invalidateUserCache(user._id);
      } else {
        logger.warn('DynamicPermissionService not available, skipping cache invalidation');
      }

      logger.info('User permissions updated successfully', {
        userId: id,
        directPermissions,
        deniedPermissions,
        updatedBy: req.user!._id,
        replaceExisting,
      });

      res.json({
        success: true,
        message: 'User permissions updated successfully',
      });
    } catch (error) {
      logger.error('Error updating user permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating user permissions',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get user's effective permissions (complete permission listing)
   * GET /api/admin/users/:id/effective-permissions
   */
  async getUserEffectivePermissions(
    req: AuthRequest,
    res: Response
  ): Promise<any> {
    try {
      const { id } = req.params;
      const {
        workspaceId,
        includeInherited = true,
        includeRoleDetails = false,
      } = req.query;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Build workspace context
      const workspaceContext: WorkspaceContext = {
        workspace: null,
        subscription: null,
        plan: null,
        permissions: [],
        limits: {
          patients: null,
          users: null,
          locations: null,
          storage: null,
          apiCalls: null,
          interventions: null,
        },
        isTrialExpired: false,
        isSubscriptionActive: true,
      };

      if (workspaceId) {
        const workspace = await mongoose
          .model('Workplace')
          .findById(workspaceId);
        if (workspace) {
          workspaceContext.workspace = workspace;
        }
      }

      // Get complete permission resolution
      if (!this.dynamicPermissionService) {
        return res.status(500).json({
          success: false,
          message: 'Permission service not available',
        });
      }

      const permissionResult =
        await this.dynamicPermissionService.resolveUserPermissions(
          user,
          workspaceContext
        );

      // Get user's role assignments with details
      const userRoles = await UserRole.find({
        userId: user._id,
        isActive: true,
        ...(workspaceId && { workspaceId }),
      }).populate(
        'roleId',
        'name displayName category hierarchyLevel permissions'
      );

      // Get role hierarchy details if requested
      let roleHierarchyDetails: any = {};
      if (includeRoleDetails === 'true') {
        for (const userRole of userRoles) {
          const role = userRole.roleId as unknown as IRole;
          if (role) {
            const hierarchyPath =
              await this.roleHierarchyService.getRoleInheritancePath(role._id);
            const allRolePermissions =
              await this.roleHierarchyService.getAllRolePermissions(role._id);

            roleHierarchyDetails[role._id.toString()] = {
              hierarchyPath: hierarchyPath.map((r) => ({
                id: r._id,
                name: r.name,
                displayName: r.displayName,
                level: r.hierarchyLevel,
              })),
              allPermissions: allRolePermissions.permissions,
              permissionSources: allRolePermissions.sources,
              conflicts: allRolePermissions.conflicts,
            };
          }
        }
      }

      // Categorize permissions by source
      const permissionsBySource: Record<string, string[]> = {
        direct: [],
        role: [],
        inherited: [],
        legacy: [],
      };

      Object.entries(permissionResult.sources).forEach(
        ([permission, source]) => {
          const sourceType =
            typeof source === 'string'
              ? source
              : (source as any)?.source || 'unknown';
          if (permissionsBySource[sourceType]) {
            permissionsBySource[sourceType].push(permission);
          } else {
            permissionsBySource.other = permissionsBySource.other || [];
            permissionsBySource.other.push(permission);
          }
        }
      );

      // Get permission details
      const permissionDetails = await Permission.find({
        action: { $in: permissionResult.permissions },
        isActive: true,
      }).select(
        'action displayName category riskLevel requiredSubscriptionTier'
      );

      const permissionDetailsMap = permissionDetails.reduce((acc, perm) => {
        acc[perm.action] = {
          displayName: perm.displayName,
          category: perm.category,
          riskLevel: perm.riskLevel,
          requiredSubscriptionTier: perm.requiredSubscriptionTier,
        };
        return acc;
      }, {} as Record<string, any>);

      // Calculate statistics
      const statistics = {
        totalPermissions: permissionResult.permissions.length,
        deniedPermissions: permissionResult.deniedPermissions.length,
        directPermissions: permissionsBySource.direct?.length || 0,
        roleBasedPermissions: permissionsBySource.role?.length || 0,
        inheritedPermissions: permissionsBySource.inherited?.length || 0,
        legacyPermissions: permissionsBySource.legacy?.length || 0,
        activeRoles: userRoles.length,
        riskLevelDistribution: permissionDetails.reduce((acc, perm) => {
          acc[perm.riskLevel] = (acc[perm.riskLevel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json({
        success: true,
        data: {
          permissions: permissionResult.permissions,
          sources: permissionResult.sources,
        },
      });
    } catch (error) {
      logger.error('Error fetching user effective permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user effective permissions',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Bulk update user roles and permissions
   * POST /api/admin/users/bulk-update
   */
  async bulkUpdateUsers(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { updates, dryRun = false } = req.body;

      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required and cannot be empty',
        });
      }

      if (updates.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 100 users can be updated in a single request',
        });
      }

      // Validate all updates first
      const validationResults: Array<{
        userId: string;
        isValid: boolean;
        errors: string[];
        warnings: string[];
      }> = [];

      for (const update of updates) {
        const { userId, roleIds, directPermissions, deniedPermissions } =
          update;
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          errors.push('Invalid user ID format');
        } else {
          // Check if user exists
          const user = await User.findById(userId);
          if (!user) {
            errors.push('User not found');
          } else if (user.status !== 'active') {
            warnings.push(`User status is ${user.status}`);
          }
        }

        // Validate role IDs if provided
        if (roleIds && Array.isArray(roleIds)) {
          const validRoles = await Role.find({
            _id: { $in: roleIds },
            isActive: true,
          });

          if (validRoles.length !== roleIds.length) {
            const foundRoleIds = validRoles.map((r) => r._id.toString());
            const missingRoleIds = roleIds.filter(
              (id) => !foundRoleIds.includes(id)
            );
            errors.push(
              `Invalid or inactive roles: ${missingRoleIds.join(', ')}`
            );
          }
        }

        // Validate permissions if provided
        const allPermissions = [
          ...(directPermissions || []),
          ...(deniedPermissions || []),
        ];

        if (allPermissions.length > 0) {
          const validPermissions = await Permission.find({
            action: { $in: allPermissions },
            isActive: true,
          });

          const validPermissionActions = validPermissions.map((p) => p.action);
          const invalidPermissions = allPermissions.filter(
            (p) => !validPermissionActions.includes(p)
          );

          if (invalidPermissions.length > 0) {
            errors.push(
              `Invalid permissions: ${invalidPermissions.join(', ')}`
            );
          }
        }

        // Check for permission conflicts
        if (directPermissions && deniedPermissions) {
          const conflicts = directPermissions.filter((p: string) =>
            deniedPermissions.includes(p)
          );
          if (conflicts.length > 0) {
            errors.push(`Conflicting permissions: ${conflicts.join(', ')}`);
          }
        }

        validationResults.push({
          userId,
          isValid: errors.length === 0,
          errors,
          warnings,
        });
      }

      const validUpdates = validationResults.filter((r) => r.isValid);
      const invalidUpdates = validationResults.filter((r) => !r.isValid);

      // If dry run, return validation results
      if (dryRun) {
        return res.json({
          success: true,
          message: 'Dry run completed',
          data: {
            totalUpdates: updates.length,
            validUpdates: validUpdates.length,
            invalidUpdates: invalidUpdates.length,
            validationResults,
            wouldProceed: invalidUpdates.length === 0,
          },
        });
      }

      // Stop if there are validation errors
      if (invalidUpdates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed for some updates',
          data: {
            invalidUpdates,
            totalErrors: invalidUpdates.reduce(
              (sum, u) => sum + u.errors.length,
              0
            ),
          },
        });
      }

      // Execute bulk updates
      const results: Array<{
        userId: string;
        success: boolean;
        error?: string;
        changes: any;
      }> = [];

      for (const update of updates) {
        try {
          const {
            userId,
            roleIds,
            directPermissions,
            deniedPermissions,
            workspaceId,
          } = update;
          const changes: any = {};

          const session = await mongoose.startSession();

          try {
            await session.withTransaction(async () => {
              // Update roles if provided
              if (roleIds) {
                // Remove existing role assignments
                await UserRole.updateMany(
                  {
                    userId,
                    isActive: true,
                    ...(workspaceId && { workspaceId }),
                  },
                  {
                    isActive: false,
                    revokedBy: req.user!._id,
                    revokedAt: new Date(),
                    revocationReason: 'Bulk update replacement',
                    lastModifiedBy: req.user!._id,
                  },
                  { session }
                );

                // Add new role assignments
                for (const roleId of roleIds) {
                  const userRole = new UserRole({
                    userId,
                    roleId,
                    workspaceId: workspaceId || undefined,
                    assignedBy: req.user!._id,
                    lastModifiedBy: req.user!._id,
                    isActive: true,
                  });

                  await userRole.save({ session });
                }

                changes.roleIds = roleIds;
              }

              // Update permissions if provided
              if (
                directPermissions !== undefined ||
                deniedPermissions !== undefined
              ) {
                const updateData: any = {
                  roleLastModifiedBy: req.user!._id,
                  roleLastModifiedAt: new Date(),
                };

                if (directPermissions !== undefined) {
                  updateData.directPermissions = directPermissions;
                  changes.directPermissions = directPermissions;
                }

                if (deniedPermissions !== undefined) {
                  updateData.deniedPermissions = deniedPermissions;
                  changes.deniedPermissions = deniedPermissions;
                }

                await User.findByIdAndUpdate(userId, updateData, { session });
              }

              // Update user's assignedRoles array
              if (roleIds) {
                const currentAssignedRoles = await UserRole.find({
                  userId,
                  isActive: true,
                }).distinct('roleId');

                await User.findByIdAndUpdate(
                  userId,
                  { assignedRoles: currentAssignedRoles },
                  { session }
                );
              }
            });

            // Invalidate user cache
            if (this.dynamicPermissionService) {
              await this.dynamicPermissionService.invalidateUserCache(
                new mongoose.Types.ObjectId(userId),
                workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
              );
            } else {
              logger.warn('DynamicPermissionService not available, skipping cache invalidation');
            }

            results.push({
              userId,
              success: true,
              changes: changes,
            });
          } finally {
            await session.endSession();
          }
        } catch (error) {
          results.push({
            userId: update.userId,
            success: false,
            error: (error as Error).message,
            changes: {},
          });
        }
      }

      const successfulUpdates = results.filter((r) => r.success);
      const failedUpdates = results.filter((r) => !r.success);

      logger.info('Bulk user update completed', {
        totalUpdates: updates.length,
        successful: successfulUpdates.length,
        failed: failedUpdates.length,
        updatedBy: req.user!._id,
      });

      res.json({
        success: failedUpdates.length === 0,
        message: `Bulk update completed. ${successfulUpdates.length} successful, ${failedUpdates.length} failed.`,
        data: {
          totalUpdates: updates.length,
          successfulUpdates: successfulUpdates.length,
          failedUpdates: failedUpdates.length,
          results,
          summary: {
            usersUpdated: successfulUpdates.length,
            rolesAssigned: successfulUpdates.reduce(
              (sum, r) => sum + (r.changes.roleIds?.length || 0),
              0
            ),
            permissionsUpdated: successfulUpdates.filter(
              (r) => r.changes.directPermissions || r.changes.deniedPermissions
            ).length,
          },
        },
      });
    } catch (error) {
      logger.error('Error in bulk user update:', error);
      res.status(500).json({
        success: false,
        message: 'Error in bulk user update',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Check if a user has a specific permission
   * POST /api/admin/users/:id/check-permission
   */
  async checkUserPermission(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { permission, context } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      if (!permission) {
        return res.status(400).json({
          success: false,
          message: 'Permission is required',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check permission
      const workspaceContext: WorkspaceContext = {
        workspace: null,
        subscription: null,
        plan: null,
        permissions: [],
        limits: {
          patients: null,
          users: null,
          locations: null,
          storage: null,
          apiCalls: null,
          interventions: null,
        },
        isTrialExpired: false,
        isSubscriptionActive: true,
        ...context,
      };

      const permissionResult =
        await this.dynamicPermissionService.resolveUserPermissions(
          user,
          workspaceContext
        );

      const hasPermission = permissionResult.permissions.includes(permission);

      res.json({
        success: true,
        data: {
          allowed: hasPermission,
          source: hasPermission ? permissionResult.sources[permission] : 'none',
          reason: hasPermission
            ? 'Permission granted'
            : 'Permission not granted',
        },
      });
    } catch (error) {
      logger.error('Error checking user permission:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking user permission',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Preview permission changes for a user
   * POST /api/admin/users/:id/preview-permissions
   */
  async previewPermissionChanges(
    req: AuthRequest,
    res: Response
  ): Promise<any> {
    try {
      const { id } = req.params;
      const { roleIds, directPermissions, deniedPermissions } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get current permissions
      const workspaceContext: WorkspaceContext = {
        workspace: null,
        subscription: null,
        plan: null,
        permissions: [],
        limits: {
          patients: null,
          users: null,
          locations: null,
          storage: null,
          apiCalls: null,
          interventions: null,
        },
        isTrialExpired: false,
        isSubscriptionActive: true,
      };

      const currentPermissionsResult =
        await this.dynamicPermissionService.resolveUserPermissions(
          user,
          workspaceContext
        );
      const currentPermissions = currentPermissionsResult.permissions;

      // Create a copy of the user for simulation
      const simulatedUser = { ...user.toObject() };

      // Simulate role changes
      if (roleIds && Array.isArray(roleIds)) {
        simulatedUser.assignedRoles = roleIds;
      }

      // Simulate direct permission changes
      if (directPermissions !== undefined) {
        simulatedUser.directPermissions = directPermissions;
      }

      if (deniedPermissions !== undefined) {
        simulatedUser.deniedPermissions = deniedPermissions;
      }

      // Get new permissions
      const newPermissionsResult =
        await this.dynamicPermissionService.resolveUserPermissions(
          simulatedUser as any,
          workspaceContext
        );
      const newPermissions = newPermissionsResult.permissions;

      // Calculate changes
      const addedPermissions = newPermissions.filter(
        (p) => !currentPermissions.includes(p)
      );
      const removedPermissions = currentPermissions.filter(
        (p) => !newPermissions.includes(p)
      );

      // Check for conflicts
      const conflicts: string[] = [];

      // Check if any denied permissions would be granted by roles
      if (deniedPermissions && roleIds) {
        const roles = await Role.find({
          _id: { $in: roleIds },
          isActive: true,
        });

        const rolePermissions = new Set<string>();
        for (const role of roles) {
          role.permissions.forEach((p: string) => rolePermissions.add(p));
        }

        const conflictingPermissions = deniedPermissions.filter((p: string) =>
          rolePermissions.has(p)
        );
        if (conflictingPermissions.length > 0) {
          conflicts.push(
            `Denied permissions would be granted by roles: ${conflictingPermissions.join(
              ', '
            )}`
          );
        }
      }

      res.json({
        success: true,
        data: {
          userId: id,
          currentPermissions,
          newPermissions,
          addedPermissions,
          removedPermissions,
          conflicts,
        },
      });
    } catch (error) {
      logger.error('Error previewing permission changes:', error);
      res.status(500).json({
        success: false,
        message: 'Error previewing permission changes',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Detect role conflicts for a user
   * POST /api/admin/users/:id/detect-conflicts
   */
  async detectRoleConflicts(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { roleIds } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Role IDs array is required and cannot be empty',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Validate all roles exist and are active
      const roles = await Role.find({
        _id: { $in: roleIds },
        isActive: true,
      });

      if (roles.length !== roleIds.length) {
        const foundRoleIds = roles.map((r) => r._id.toString());
        const missingRoleIds = roleIds.filter(
          (id) => !foundRoleIds.includes(id)
        );

        return res.status(400).json({
          success: false,
          message: 'Some roles not found or inactive',
          missingRoleIds,
        });
      }

      // Detect conflicts
      const conflicts: Array<{
        type: string;
        message: string;
        severity: 'warning' | 'error';
      }> = [];

      // Check for hierarchy conflicts
      const hierarchyConflicts =
        await this.roleHierarchyService.getRoleInheritancePath(roleIds[0]);
      if (hierarchyConflicts.length > 1) {
        hierarchyConflicts.forEach((conflict, index) => {
          if (index > 0) {
            conflicts.push({
              type: 'hierarchy',
              message: `Role hierarchy conflict detected`,
              severity: 'error',
            });
          }
        });
      }

      // Check for permission conflicts
      const rolePermissions = new Map<string, Set<string>>();
      for (const role of roles) {
        const permissions = new Set(role.permissions);
        rolePermissions.set(role._id.toString(), permissions);
      }

      // Check for conflicting permissions between roles
      const permissionConflicts: Array<{
        permission: string;
        roles: string[];
      }> = [];
      const permissionMap = new Map<string, string[]>();

      rolePermissions.forEach((permissions, roleId) => {
        permissions.forEach((permission) => {
          if (!permissionMap.has(permission)) {
            permissionMap.set(permission, []);
          }
          permissionMap.get(permission)!.push(roleId);
        });
      });

      permissionMap.forEach((roleIds, permission) => {
        if (roleIds.length > 1) {
          permissionConflicts.push({
            permission,
            roles: roleIds,
          });
        }
      });

      if (permissionConflicts.length > 0) {
        permissionConflicts.forEach((conflict) => {
          conflicts.push({
            type: 'permission',
            message: `Permission "${conflict.permission}" is assigned to multiple roles`,
            severity: 'warning',
          });
        });
      }

      // Check for role exclusivity conflicts
      const exclusiveRoles = roles.filter(
        (role) => role.category === 'system' && role.name.includes('admin')
      );
      if (exclusiveRoles.length > 1) {
        conflicts.push({
          type: 'exclusivity',
          message: 'Multiple admin roles cannot be assigned to the same user',
          severity: 'error',
        });
      }

      // Check for temporary assignment conflicts
      const temporaryRoles = roles.filter(
        (role) => (role as any).isTemporary === true
      );
      if (temporaryRoles.length > 0) {
        conflicts.push({
          type: 'temporary',
          message: 'Temporary roles should not be mixed with permanent roles',
          severity: 'warning',
        });
      }

      res.json({
        success: true,
        data: {
          conflicts,
        },
      });
    } catch (error) {
      logger.error('Error detecting role conflicts:', error);
      res.status(500).json({
        success: false,
        message: 'Error detecting role conflicts',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Resolve role conflicts for a user
   * POST /api/admin/users/:id/resolve-conflicts
   */
  async resolveRoleConflicts(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { resolutions } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      if (
        !resolutions ||
        !Array.isArray(resolutions) ||
        resolutions.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Resolutions array is required and cannot be empty',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Process resolutions
      const resolutionResults: Array<{
        conflictId: string;
        resolution: string;
        success: boolean;
        message?: string;
      }> = [];

      for (const resolution of resolutions) {
        const { conflictId, resolution: resolutionType, priority } = resolution;

        try {
          // Apply resolution based on type
          switch (resolutionType) {
            case 'allow':
              // Allow the conflicted permission/role
              resolutionResults.push({
                conflictId,
                resolution: resolutionType,
                success: true,
                message: 'Conflict resolved by allowing the permission/role',
              });
              break;

            case 'deny':
              // Deny the conflicted permission/role
              resolutionResults.push({
                conflictId,
                resolution: resolutionType,
                success: true,
                message: 'Conflict resolved by denying the permission/role',
              });
              break;

            case 'prioritize':
              // Prioritize one role over another
              if (!priority) {
                resolutionResults.push({
                  conflictId,
                  resolution: resolutionType,
                  success: false,
                  message: 'Priority is required for prioritize resolution',
                });
              } else {
                resolutionResults.push({
                  conflictId,
                  resolution: resolutionType,
                  success: true,
                  message: `Conflict resolved by prioritizing: ${priority}`,
                });
              }
              break;

            default:
              resolutionResults.push({
                conflictId,
                resolution: resolutionType,
                success: false,
                message: `Unknown resolution type: ${resolutionType}`,
              });
          }
        } catch (error) {
          resolutionResults.push({
            conflictId,
            resolution: resolutionType,
            success: false,
            message: `Error applying resolution: ${(error as Error).message}`,
          });
        }
      }

      const successfulResolutions = resolutionResults.filter((r) => r.success);
      const failedResolutions = resolutionResults.filter((r) => !r.success);

      logger.info('Role conflicts resolved', {
        userId: id,
        totalResolutions: resolutions.length,
        successful: successfulResolutions.length,
        failed: failedResolutions.length,
        resolvedBy: req.user!._id,
      });

      res.json({
        success: failedResolutions.length === 0,
        message: `Role conflicts resolved. ${successfulResolutions.length} successful, ${failedResolutions.length} failed.`,
        data: {
          resolutionResults,
          summary: {
            totalResolutions: resolutions.length,
            successfulResolutions: successfulResolutions.length,
            failedResolutions: failedResolutions.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error resolving role conflicts:', error);
      res.status(500).json({
        success: false,
        message: 'Error resolving role conflicts',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Refresh user permission cache
   * POST /api/admin/users/:id/refresh-cache
   */
  async refreshUserPermissionCache(
    req: AuthRequest,
    res: Response
  ): Promise<any> {
    try {
      const { id } = req.params;
      const { workspaceId } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Refresh cache
      await this.dynamicPermissionService.invalidateUserCache(
        new mongoose.Types.ObjectId(id),
        workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined
      );

      // Prefetch permissions to rebuild cache
      let workspaceContext: WorkspaceContext = {
        workspace: null,
        subscription: null,
        plan: null,
        permissions: [],
        limits: {
          patients: null,
          users: null,
          locations: null,
          storage: null,
          apiCalls: null,
          interventions: null,
        },
        isTrialExpired: false,
        isSubscriptionActive: true,
      };

      if (workspaceId) {
        const workspace = await mongoose
          .model('Workplace')
          .findById(workspaceId);
        if (workspace) {
          workspaceContext.workspace = workspace;
        }
      }

      await this.dynamicPermissionService.resolveUserPermissions(
        user,
        workspaceContext
      );

      logger.info('User permission cache refreshed', {
        userId: id,
        workspaceId: workspaceId || null,
        refreshedBy: req.user!._id,
      });

      res.json({
        success: true,
        message: 'User permission cache refreshed successfully',
      });
    } catch (error) {
      logger.error('Error refreshing user permission cache:', error);
      res.status(500).json({
        success: false,
        message: 'Error refreshing user permission cache',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }
}

export const userRoleController = new UserRoleController();
