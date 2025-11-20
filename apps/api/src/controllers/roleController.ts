import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Role, { IRole } from '../models/Role';
import Permission, { IPermission } from '../models/Permission';
import UserRole, { IUserRole } from '../models/UserRole';
import RolePermission, { IRolePermission } from '../models/RolePermission';
import User from '../models/User';
import RoleHierarchyService from '../services/RoleHierarchyService';
import DynamicPermissionService from '../services/DynamicPermissionService';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export class RoleController {
    private roleHierarchyService: RoleHierarchyService;
    private dynamicPermissionService: DynamicPermissionService;

    constructor() {
        this.roleHierarchyService = RoleHierarchyService.getInstance();
        this.dynamicPermissionService = DynamicPermissionService.getInstance();
    }

    /**
     * Create a new role with hierarchy validation
     * POST /api/admin/roles
     */
    async createRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const {
                name,
                displayName,
                description,
                category = 'custom',
                parentRoleId,
                permissions = [],
                workspaceId,
                isDefault = false
            } = req.body;

            // Validate required fields
            if (!name || !displayName || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, display name, and description are required',
                });
            }

            // Sanitize role name: lowercase and replace spaces with underscores
            const sanitizedName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');

            // Check if role name already exists
            const existingRole = await Role.findOne({ name: sanitizedName });
            if (existingRole) {
                return res.status(409).json({
                    success: false,
                    message: 'Role with this name already exists',
                });
            }

            // Validate parent role if provided
            let parentRole: IRole | null = null;
            if (parentRoleId) {
                parentRole = await Role.findById(parentRoleId);
                if (!parentRole) {
                    return res.status(404).json({
                        success: false,
                        message: 'Parent role not found',
                    });
                }

                if (!parentRole.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: 'Parent role is not active',
                    });
                }

                // Check for circular dependency
                const hasCircularDependency = await this.roleHierarchyService.detectCircularDependency(
                    new mongoose.Types.ObjectId(), // Temporary ID for validation
                    parentRoleId
                );

                if (hasCircularDependency) {
                    return res.status(400).json({
                        success: false,
                        message: 'Creating this role would create a circular dependency',
                    });
                }
            }

            // Validate permissions exist
            if (permissions.length > 0) {
                const validPermissions = await Permission.find({
                    action: { $in: permissions },
                    isActive: true
                });

                const validPermissionActions = validPermissions.map(p => p.action);
                const invalidPermissions = permissions.filter(
                    (p: string) => !validPermissionActions.includes(p)
                );

                if (invalidPermissions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid permissions found',
                        invalidPermissions,
                    });
                }
            }

            // Calculate hierarchy level
            const hierarchyLevel = parentRole ? parentRole.hierarchyLevel + 1 : 0;

            // Create the role
            const role = new Role({
                name: sanitizedName,
                displayName,
                description,
                category,
                parentRole: parentRoleId || undefined,
                hierarchyLevel,
                permissions,
                workspaceId: workspaceId || undefined,
                isDefault,
                isActive: true,
                isSystemRole: false,
                createdBy: req.user!._id,
                lastModifiedBy: req.user!._id,
            });

            await role.save();

            // Update parent role's children array if parent exists
            if (parentRole) {
                await Role.findByIdAndUpdate(
                    parentRoleId,
                    { $addToSet: { childRoles: role._id } }
                );
            }

            // Create role-permission mappings
            if (permissions.length > 0) {
                const rolePermissions = permissions.map((permission: string) => ({
                    roleId: role._id,
                    permissionAction: permission,
                    granted: true,
                    grantedBy: req.user!._id,
                    lastModifiedBy: req.user!._id,
                }));

                await RolePermission.insertMany(rolePermissions);
            }

            // Populate the response
            const populatedRole = await Role.findById(role._id)
                .populate('parentRole', 'name displayName')
                .populate('childRoles', 'name displayName')
                .populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            logger.info('Role created successfully', {
                roleId: role._id,
                roleName: role.name,
                createdBy: req.user!._id,
                parentRoleId: parentRoleId || null,
            });

            res.status(201).json({
                success: true,
                message: 'Role created successfully',
                data: populatedRole,
            });

        } catch (error) {
            logger.error('Error creating role:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get all roles with filtering and pagination
     * GET /api/admin/roles
     */
    async getRoles(req: AuthRequest, res: Response): Promise<any> {
        try {
            const {
                page = 1,
                limit = 20,
                category,
                isActive,
                isSystemRole,
                workspaceId,
                search,
                sortBy = 'name',
                sortOrder = 'asc'
            } = req.query;

            // Build query
            const query: any = {};

            if (category) {
                query.category = category;
            }

            if (isActive !== undefined) {
                query.isActive = isActive === 'true';
            }

            if (isSystemRole !== undefined) {
                query.isSystemRole = isSystemRole === 'true';
            }

            // Modified logic: If workspaceId is provided, show both system roles and workspace-specific roles
            if (workspaceId) {
                // Show system roles (for cloning) + workspace-specific roles
                query.$or = [
                    { workspaceId: null, category: 'system' }, // System roles
                    { workspaceId: workspaceId }, // Workspace-specific roles
                ];
            }

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { displayName: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort object
            const sort: any = {};
            sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

            // Execute query with pagination
            const pageNum = parseInt(page as string);
            const limitNum = parseInt(limit as string);
            const skip = (pageNum - 1) * limitNum;

            const [roles, total] = await Promise.all([
                Role.find(query)
                    .populate('parentRole', 'name displayName category')
                    .populate('childRoles', 'name displayName category')
                    .populate('createdBy', 'firstName lastName')
                    .populate('lastModifiedBy', 'firstName lastName')
                    .sort(sort)
                    .skip(skip)
                    .limit(limitNum),
                Role.countDocuments(query)
            ]);

            // Add permission counts and user counts for each role
            const rolesWithCounts = await Promise.all(
                roles.map(async (role) => {
                    const [permissionCount, userCount] = await Promise.all([
                        RolePermission.countDocuments({
                            roleId: role._id,
                            granted: true,
                            isActive: true
                        }),
                        UserRole.countDocuments({
                            roleId: role._id,
                            isActive: true
                        })
                    ]);

                    return {
                        ...role.toObject(),
                        permissionCount,
                        userCount
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    roles: rolesWithCounts,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum),
                    },
                    filters: {
                        category,
                        isActive,
                        isSystemRole,
                        workspaceId,
                        search
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching roles:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching roles',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get a specific role by ID
     * GET /api/admin/roles/:id
     */
    async getRoleById(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;

            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID format',
                });
            }

            const role = await Role.findById(id)
                .populate('parentRole', 'name displayName category hierarchyLevel')
                .populate('childRoles', 'name displayName category hierarchyLevel')
                .populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found',
                });
            }

            // Get role permissions with details
            const rolePermissions = await RolePermission.find({
                roleId: role._id,
                isActive: true
            }).populate('permissionAction');

            // Get users assigned to this role
            const userAssignments = await UserRole.find({
                roleId: role._id,
                isActive: true
            }).populate('userId', 'firstName lastName email role status');

            // Get hierarchy path
            const hierarchyPath = await this.roleHierarchyService.getRoleInheritancePath(role._id);

            // Get all permissions (including inherited)
            const allPermissions = await this.roleHierarchyService.getAllRolePermissions(role._id);

            res.json({
                success: true,
                data: {
                    role,
                    permissions: {
                        direct: rolePermissions,
                        all: allPermissions.permissions,
                        sources: allPermissions.sources,
                        conflicts: allPermissions.conflicts
                    },
                    userAssignments,
                    hierarchyPath,
                    statistics: {
                        directPermissionCount: rolePermissions.length,
                        totalPermissionCount: allPermissions.permissions.length,
                        userCount: userAssignments.length,
                        childRoleCount: role.childRoles.length
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching role:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }    /**
 
    * Update a role with conflict checking
     * PUT /api/admin/roles/:id
     */
    async updateRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const {
                displayName,
                description,
                category,
                parentRoleId,
                permissions,
                isActive,
                isDefault
            } = req.body;

            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID format',
                });
            }

            const role = await Role.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found',
                });
            }

            // Prevent modification of system roles
            if (role.isSystemRole) {
                return res.status(403).json({
                    success: false,
                    message: 'System roles cannot be modified',
                });
            }

            // Validate parent role change if provided
            if (parentRoleId !== undefined) {
                if (parentRoleId && parentRoleId !== role.parentRole?.toString()) {
                    // Validate new parent role
                    const newParentRole = await Role.findById(parentRoleId);
                    if (!newParentRole) {
                        return res.status(404).json({
                            success: false,
                            message: 'Parent role not found',
                        });
                    }

                    if (!newParentRole.isActive) {
                        return res.status(400).json({
                            success: false,
                            message: 'Parent role is not active',
                        });
                    }

                    // Check for circular dependency
                    const hasCircularDependency = await this.roleHierarchyService.detectCircularDependency(
                        role._id,
                        parentRoleId
                    );

                    if (hasCircularDependency) {
                        return res.status(400).json({
                            success: false,
                            message: 'Changing parent would create a circular dependency',
                        });
                    }
                }
            }

            // Validate permissions if provided
            if (permissions && permissions.length > 0) {
                const validPermissions = await Permission.find({
                    action: { $in: permissions },
                    isActive: true
                });

                const validPermissionActions = validPermissions.map(p => p.action);
                const invalidPermissions = permissions.filter(
                    (p: string) => !validPermissionActions.includes(p)
                );

                if (invalidPermissions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid permissions found',
                        invalidPermissions,
                    });
                }
            }

            // Store old parent for cleanup
            const oldParentRoleId = role.parentRole;

            // Update role fields
            const updateData: any = {
                lastModifiedBy: req.user!._id,
            };

            if (displayName !== undefined) updateData.displayName = displayName;
            if (description !== undefined) updateData.description = description;
            if (category !== undefined) updateData.category = category;
            if (isActive !== undefined) updateData.isActive = isActive;
            if (isDefault !== undefined) updateData.isDefault = isDefault;

            // Handle parent role change
            if (parentRoleId !== undefined) {
                updateData.parentRole = parentRoleId || undefined;

                // Calculate new hierarchy level
                if (parentRoleId) {
                    const newParentRole = await Role.findById(parentRoleId);
                    updateData.hierarchyLevel = newParentRole!.hierarchyLevel + 1;
                } else {
                    updateData.hierarchyLevel = 0;
                }
            }

            // Handle permissions update
            if (permissions !== undefined) {
                updateData.permissions = permissions;
            }

            // Update the role
            const updatedRole = await Role.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).populate('parentRole', 'name displayName')
                .populate('childRoles', 'name displayName')
                .populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            // Handle parent role relationship changes
            if (parentRoleId !== undefined && parentRoleId !== oldParentRoleId?.toString()) {
                // Remove from old parent's children
                if (oldParentRoleId) {
                    await Role.findByIdAndUpdate(
                        oldParentRoleId,
                        { $pull: { childRoles: role._id } }
                    );
                }

                // Add to new parent's children
                if (parentRoleId) {
                    await Role.findByIdAndUpdate(
                        parentRoleId,
                        { $addToSet: { childRoles: role._id } }
                    );
                }

                // Update hierarchy levels for all child roles
                await this.roleHierarchyService.updateHierarchyLevels(role._id);
            }

            // Update role permissions if provided
            if (permissions !== undefined) {
                // Remove existing role permissions
                await RolePermission.updateMany(
                    { roleId: role._id },
                    {
                        isActive: false,
                        lastModifiedBy: req.user!._id
                    }
                );

                // Add new role permissions
                if (permissions.length > 0) {
                    const rolePermissions = permissions.map((permission: string) => ({
                        roleId: role._id,
                        permissionAction: permission,
                        granted: true,
                        grantedBy: req.user!._id,
                        lastModifiedBy: req.user!._id,
                    }));

                    await RolePermission.insertMany(rolePermissions);
                }
            }

            // Invalidate caches for affected users
            await this.invalidateRoleCaches(role._id, 'Role updated', req.user!._id);

            logger.info('Role updated successfully', {
                roleId: role._id,
                roleName: role.name,
                updatedBy: req.user!._id,
                changes: updateData,
            });

            res.json({
                success: true,
                message: 'Role updated successfully',
                data: updatedRole,
            });

        } catch (error) {
            logger.error('Error updating role:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Delete a role with cascade handling
     * DELETE /api/admin/roles/:id
     */
    async deleteRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { force = false } = req.query;

            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID format',
                });
            }

            const role = await Role.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found',
                });
            }

            // Prevent deletion of system roles
            if (role.isSystemRole) {
                return res.status(403).json({
                    success: false,
                    message: 'System roles cannot be deleted',
                });
            }

            // Check for child roles
            const childRoles = await Role.find({ parentRole: role._id, isActive: true });
            if (childRoles.length > 0 && !force) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete role with child roles. Remove child roles first or use force=true',
                    childRoles: childRoles.map(r => ({ id: r._id, name: r.name, displayName: r.displayName })),
                });
            }

            // Check for user assignments
            const userAssignments = await UserRole.find({ roleId: role._id, isActive: true });
            if (userAssignments.length > 0 && !force) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete role with active user assignments. Remove user assignments first or use force=true',
                    assignedUserCount: userAssignments.length,
                });
            }

            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Handle child roles if force delete
                    if (force && childRoles.length > 0) {
                        // Move child roles to this role's parent or make them root roles
                        const newParentId = role.parentRole || null;

                        for (const childRole of childRoles) {
                            await Role.findByIdAndUpdate(
                                childRole._id,
                                {
                                    parentRole: newParentId,
                                    hierarchyLevel: newParentId ?
                                        (await Role.findById(newParentId))!.hierarchyLevel + 1 : 0,
                                    lastModifiedBy: req.user!._id
                                },
                                { session }
                            );

                            // Update new parent's children array
                            if (newParentId) {
                                await Role.findByIdAndUpdate(
                                    newParentId,
                                    { $addToSet: { childRoles: childRole._id } },
                                    { session }
                                );
                            }
                        }
                    }

                    // Handle user assignments if force delete
                    if (force && userAssignments.length > 0) {
                        // Deactivate user role assignments
                        await UserRole.updateMany(
                            { roleId: role._id, isActive: true },
                            {
                                isActive: false,
                                revokedBy: req.user!._id,
                                revokedAt: new Date(),
                                lastModifiedBy: req.user!._id
                            },
                            { session }
                        );

                        // Update users' assignedRoles arrays
                        const userIds = userAssignments.map(ua => ua.userId);
                        await User.updateMany(
                            { _id: { $in: userIds } },
                            {
                                $pull: { assignedRoles: role._id },
                                roleLastModifiedBy: req.user!._id,
                                roleLastModifiedAt: new Date()
                            },
                            { session }
                        );
                    }

                    // Deactivate role permissions
                    await RolePermission.updateMany(
                        { roleId: role._id },
                        {
                            isActive: false,
                            lastModifiedBy: req.user!._id
                        },
                        { session }
                    );

                    // Remove role from parent's children array
                    if (role.parentRole) {
                        await Role.findByIdAndUpdate(
                            role.parentRole,
                            { $pull: { childRoles: role._id } },
                            { session }
                        );
                    }

                    // Soft delete the role
                    await Role.findByIdAndUpdate(
                        role._id,
                        {
                            isActive: false,
                            lastModifiedBy: req.user!._id
                        },
                        { session }
                    );
                });

                // Invalidate caches for affected users
                await this.invalidateRoleCaches(role._id, 'Role deleted', req.user!._id);

                logger.info('Role deleted successfully', {
                    roleId: role._id,
                    roleName: role.name,
                    deletedBy: req.user!._id,
                    force: force === 'true',
                    childRolesCount: childRoles.length,
                    userAssignmentsCount: userAssignments.length,
                });

                res.json({
                    success: true,
                    message: 'Role deleted successfully',
                    data: {
                        deletedRole: {
                            id: role._id,
                            name: role.name,
                            displayName: role.displayName
                        },
                        affectedChildRoles: childRoles.length,
                        affectedUserAssignments: userAssignments.length
                    },
                });

            } finally {
                await session.endSession();
            }

        } catch (error) {
            logger.error('Error deleting role:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get permissions for a specific role
     * GET /api/admin/roles/:id/permissions
     */
    async getRolePermissions(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { includeInherited = true } = req.query;

            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID format',
                });
            }

            const role = await Role.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found',
                });
            }

            // Get direct role permissions
            const directPermissions = await RolePermission.find({
                roleId: role._id,
                isActive: true
            }).populate({
                path: 'permissionAction',
                model: 'Permission',
                match: { action: { $exists: true } }
            });

            let result: any = {
                role: {
                    id: role._id,
                    name: role.name,
                    displayName: role.displayName,
                    hierarchyLevel: role.hierarchyLevel
                },
                directPermissions: directPermissions.map(rp => ({
                    action: rp.permissionAction,
                    granted: rp.granted,
                    grantedBy: rp.grantedBy,
                    grantedAt: rp.grantedAt
                }))
            };

            // Include inherited permissions if requested
            if (includeInherited === 'true') {
                const allPermissions = await this.roleHierarchyService.getAllRolePermissions(role._id);

                result.inheritedPermissions = allPermissions.permissions.filter(
                    perm => allPermissions.sources[perm]?.source === 'inherited'
                ).map(perm => ({
                    action: perm,
                    source: allPermissions.sources[perm]
                }));

                result.allPermissions = allPermissions.permissions;
                result.permissionSources = allPermissions.sources;
                result.conflicts = allPermissions.conflicts;
            }

            // Add legacy permissions from role model
            if (role.permissions && role.permissions.length > 0) {
                result.legacyPermissions = role.permissions;
            }

            res.json({
                success: true,
                data: result,
            });

        } catch (error) {
            logger.error('Error fetching role permissions:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching role permissions',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Clone an existing role
     * POST /api/admin/roles/:roleId/clone
     */
    async cloneRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { roleId } = req.params;
            const { newName, newDisplayName, newDescription, workspaceId } = req.body;

            if (!roleId || !mongoose.Types.ObjectId.isValid(roleId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role ID format',
                });
            }

            if (!newName || !newDisplayName) {
                return res.status(400).json({
                    success: false,
                    message: 'New name and display name are required',
                });
            }

            // Get the source role
            const sourceRole = await Role.findById(roleId);
            if (!sourceRole) {
                return res.status(404).json({
                    success: false,
                    message: 'Source role not found',
                });
            }

            // Sanitize new role name
            const sanitizedName = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');

            // Check if new role name already exists
            const existingRole = await Role.findOne({ name: sanitizedName });
            if (existingRole) {
                return res.status(409).json({
                    success: false,
                    message: 'A role with this name already exists',
                });
            }

            // Create the cloned role
            const clonedRole = new Role({
                name: sanitizedName,
                displayName: newDisplayName,
                description: newDescription || `Cloned from ${sourceRole.displayName}`,
                category: 'custom', // Cloned roles are always custom
                permissions: [...sourceRole.permissions], // Clone permissions
                workspaceId: workspaceId || sourceRole.workspaceId,
                hierarchyLevel: sourceRole.hierarchyLevel,
                isActive: true,
                isSystemRole: false, // Cloned roles are never system roles
                isDefault: false,
                createdBy: req.user!._id,
                lastModifiedBy: req.user!._id,
            });

            await clonedRole.save();

            // Clone role-permission mappings
            const sourcePermissions = await RolePermission.find({
                roleId: sourceRole._id,
                isActive: true,
            });

            if (sourcePermissions.length > 0) {
                const clonedPermissions = sourcePermissions.map(perm => ({
                    roleId: clonedRole._id,
                    permissionAction: perm.permissionAction,
                    granted: perm.granted,
                    grantedBy: req.user!._id,
                    lastModifiedBy: req.user!._id,
                    isActive: true,
                }));

                await RolePermission.insertMany(clonedPermissions);
            }

            // Populate the response
            const populatedRole = await Role.findById(clonedRole._id)
                .populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            logger.info('Role cloned successfully', {
                sourceRoleId: sourceRole._id,
                sourceRoleName: sourceRole.name,
                clonedRoleId: clonedRole._id,
                clonedRoleName: clonedRole.name,
                clonedBy: req.user!._id,
            });

            res.status(201).json({
                success: true,
                message: 'Role cloned successfully',
                data: {
                    role: populatedRole,
                    sourceRole: {
                        id: sourceRole._id,
                        name: sourceRole.name,
                        displayName: sourceRole.displayName,
                    },
                },
            });
        } catch (error) {
            logger.error('Error cloning role:', error);
            res.status(500).json({
                success: false,
                message: 'Error cloning role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get role statistics
     * GET /api/admin/roles/statistics
     */
    async getRoleStatistics(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { workspaceId } = req.query;

            const filter: any = {};
            if (workspaceId) {
                filter.workspaceId = workspaceId;
            }

            const [totalRoles, activeRoles, systemRoles, customRoles, inactiveRoles] = await Promise.all([
                Role.countDocuments(filter),
                Role.countDocuments({ ...filter, isActive: true }),
                Role.countDocuments({ ...filter, isSystemRole: true }),
                Role.countDocuments({ ...filter, isSystemRole: false }),
                Role.countDocuments({ ...filter, isActive: false }),
            ]);

            // Get roles by category
            const categoryCounts = await Role.aggregate([
                { $match: filter },
                { $group: { _id: '$category', count: { $sum: 1 } } },
            ]);

            // Get hierarchy level distribution
            const hierarchyDistribution = await Role.aggregate([
                { $match: { ...filter, isActive: true } },
                { $group: { _id: '$hierarchyLevel', count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);

            res.json({
                success: true,
                data: {
                    total: totalRoles,
                    active: activeRoles,
                    inactive: inactiveRoles,
                    system: systemRoles,
                    custom: customRoles,
                    byCategory: categoryCounts,
                    hierarchyDistribution,
                },
            });
        } catch (error) {
            logger.error('Error fetching role statistics:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching role statistics',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Helper method to invalidate caches for users with this role
     */
    private async invalidateRoleCaches(
        roleId: mongoose.Types.ObjectId,
        reason: string = 'Role modification',
        initiatedBy?: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            // Use the enhanced cache invalidation service
            await this.dynamicPermissionService.invalidateRoleCache(
                roleId,
                reason,
                initiatedBy
            );

        } catch (error) {
            logger.error('Error invalidating role caches:', error);
        }
    }
}

export const roleController = new RoleController();