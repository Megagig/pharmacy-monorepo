import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Role, { IRole } from '../models/Role';
import RoleHierarchyService from '../services/RoleHierarchyService';
import DynamicPermissionService from '../services/DynamicPermissionService';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export class RoleHierarchyController {
    private roleHierarchyService: RoleHierarchyService;
    private dynamicPermissionService: DynamicPermissionService;

    constructor() {
        this.roleHierarchyService = RoleHierarchyService.getInstance();
        this.dynamicPermissionService = DynamicPermissionService.getInstance();
    }

    /**
     * Add child roles to a parent role
     * POST /api/admin/roles/:id/children
     */
    async addChildRoles(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { childRoleIds } = req.body;

            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parent role ID format',
                });
            }

            if (!childRoleIds || !Array.isArray(childRoleIds) || childRoleIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Child role IDs array is required and cannot be empty',
                });
            }

            // Validate parent role exists
            const parentRole = await Role.findById(id);
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

            // Validate all child roles exist and are active
            const childRoles = await Role.find({
                _id: { $in: childRoleIds },
                isActive: true
            });

            if (childRoles.length !== childRoleIds.length) {
                const foundRoleIds = childRoles.map(r => r._id.toString());
                const missingRoleIds = childRoleIds.filter(id => !foundRoleIds.includes(id));

                return res.status(400).json({
                    success: false,
                    message: 'Some child roles not found or inactive',
                    missingRoleIds,
                });
            }

            // Validate hierarchy constraints for each child role
            const validationResults = [];
            for (const childRoleId of childRoleIds) {
                // Check if child role already has a parent
                const childRole = childRoles.find(r => r._id.toString() === childRoleId);
                if (childRole && childRole.parentRole) {
                    validationResults.push({
                        roleId: childRoleId,
                        roleName: childRole.name,
                        error: 'Role already has a parent role'
                    });
                    continue;
                }

                // Check for circular dependencies
                const hasCircularDependency = await this.roleHierarchyService.detectCircularDependency(
                    new mongoose.Types.ObjectId(childRoleId),
                    parentRole._id
                );

                if (hasCircularDependency) {
                    validationResults.push({
                        roleId: childRoleId,
                        roleName: childRole?.name,
                        error: 'Would create circular dependency'
                    });
                    continue;
                }

                // Validate hierarchy constraints
                const conflicts = await this.roleHierarchyService.validateRoleHierarchy(
                    new mongoose.Types.ObjectId(childRoleId),
                    parentRole._id
                );

                if (conflicts.length > 0) {
                    validationResults.push({
                        roleId: childRoleId,
                        roleName: childRole?.name,
                        error: conflicts.map(c => c.message).join(', ')
                    });
                }
            }

            if (validationResults.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Hierarchy validation failed',
                    validationErrors: validationResults,
                });
            }

            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Update each child role
                    for (const childRoleId of childRoleIds) {
                        await Role.findByIdAndUpdate(
                            childRoleId,
                            {
                                parentRole: parentRole._id,
                                hierarchyLevel: parentRole.hierarchyLevel + 1,
                                lastModifiedBy: req.user!._id
                            },
                            { session }
                        );
                    }

                    // Update parent role's children array
                    await Role.findByIdAndUpdate(
                        parentRole._id,
                        {
                            $addToSet: { childRoles: { $each: childRoleIds } },
                            lastModifiedBy: req.user!._id
                        },
                        { session }
                    );

                    // Update hierarchy levels for all descendants
                    for (const childRoleId of childRoleIds) {
                        await this.roleHierarchyService.updateHierarchyLevels(
                            new mongoose.Types.ObjectId(childRoleId)
                        );
                    }
                });

                // Invalidate caches for affected roles
                await this.dynamicPermissionService.invalidateRoleCache(parentRole._id);
                for (const childRoleId of childRoleIds) {
                    await this.dynamicPermissionService.invalidateRoleCache(
                        new mongoose.Types.ObjectId(childRoleId)
                    );
                }

                // Get updated parent role with children
                const updatedParentRole = await Role.findById(parentRole._id)
                    .populate('childRoles', 'name displayName category hierarchyLevel');

                logger.info('Child roles added successfully', {
                    parentRoleId: parentRole._id,
                    parentRoleName: parentRole.name,
                    childRoleIds,
                    addedBy: req.user!._id,
                });

                res.json({
                    success: true,
                    message: 'Child roles added successfully',
                    data: {
                        parentRole: {
                            id: updatedParentRole!._id,
                            name: updatedParentRole!.name,
                            displayName: updatedParentRole!.displayName,
                            hierarchyLevel: updatedParentRole!.hierarchyLevel
                        },
                        addedChildren: updatedParentRole!.childRoles,
                        totalChildren: updatedParentRole!.childRoles.length
                    },
                });

            } finally {
                await session.endSession();
            }

        } catch (error) {
            logger.error('Error adding child roles:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding child roles',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Remove child role relationship
     * DELETE /api/admin/roles/:id/children/:childId
     */
    async removeChildRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id, childId } = req.params;

            if (!id || !childId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(childId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid parent or child role ID format',
                });
            }

            // Validate parent role exists
            const parentRole = await Role.findById(id);
            if (!parentRole) {
                return res.status(404).json({
                    success: false,
                    message: 'Parent role not found',
                });
            }

            // Validate child role exists and is actually a child
            const childRole = await Role.findById(childId);
            if (!childRole) {
                return res.status(404).json({
                    success: false,
                    message: 'Child role not found',
                });
            }

            if (!childRole.parentRole || !childRole.parentRole.equals(parentRole._id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Role is not a child of the specified parent role',
                });
            }

            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Remove parent relationship from child role
                    await Role.findByIdAndUpdate(
                        childId,
                        {
                            $unset: { parentRole: 1 },
                            hierarchyLevel: 0,
                            lastModifiedBy: req.user!._id
                        },
                        { session }
                    );

                    // Remove child from parent's children array
                    await Role.findByIdAndUpdate(
                        id,
                        {
                            $pull: { childRoles: childId },
                            lastModifiedBy: req.user!._id
                        },
                        { session }
                    );

                    // Update hierarchy levels for all descendants of the removed child
                    await this.roleHierarchyService.updateHierarchyLevels(
                        new mongoose.Types.ObjectId(childId)
                    );
                });

                // Invalidate caches for affected roles
                await this.dynamicPermissionService.invalidateRoleCache(parentRole._id);
                await this.dynamicPermissionService.invalidateRoleCache(childRole._id);

                logger.info('Child role removed successfully', {
                    parentRoleId: id,
                    parentRoleName: parentRole.name,
                    childRoleId: childId,
                    childRoleName: childRole.name,
                    removedBy: req.user!._id,
                });

                res.json({
                    success: true,
                    message: 'Child role removed successfully',
                    data: {
                        parentRole: {
                            id: parentRole._id,
                            name: parentRole.name,
                            displayName: parentRole.displayName
                        },
                        removedChild: {
                            id: childRole._id,
                            name: childRole.name,
                            displayName: childRole.displayName
                        }
                    },
                });

            } finally {
                await session.endSession();
            }

        } catch (error) {
            logger.error('Error removing child role:', error);
            res.status(500).json({
                success: false,
                message: 'Error removing child role',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get complete role hierarchy for a specific role
     * GET /api/admin/roles/:id/hierarchy
     */
    async getRoleHierarchy(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { includePermissions = false, includeUsers = false } = req.query;

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

            // Get inheritance path (from root to this role)
            const inheritancePath = await this.roleHierarchyService.getRoleInheritancePath(role._id);

            // Get role hierarchy tree starting from this role
            const hierarchyTree = await this.roleHierarchyService.getRoleHierarchyTree(role._id);

            // Get all permissions if requested
            let permissionDetails: any = {};
            if (includePermissions === 'true') {
                const allPermissions = await this.roleHierarchyService.getAllRolePermissions(role._id);
                permissionDetails = {
                    allPermissions: allPermissions.permissions,
                    permissionSources: allPermissions.sources,
                    conflicts: allPermissions.conflicts
                };
            }

            // Get user assignments if requested
            let userAssignments: any = {};
            if (includeUsers === 'true') {
                const userRoles = await mongoose.model('UserRole').find({
                    roleId: role._id,
                    isActive: true
                }).populate('userId', 'firstName lastName email role status');

                userAssignments = {
                    directAssignments: userRoles.length,
                    users: userRoles.map((ur: any) => ({
                        id: ur.userId._id,
                        name: `${ur.userId.firstName} ${ur.userId.lastName}`,
                        email: ur.userId.email,
                        status: ur.userId.status,
                        assignedAt: ur.assignedAt
                    }))
                };
            }

            // Calculate hierarchy statistics
            const calculateTreeStats = (nodes: any[]): any => {
                let totalNodes = 0;
                let maxDepth = 0;
                let leafNodes = 0;

                const traverse = (node: any, depth: number) => {
                    totalNodes++;
                    maxDepth = Math.max(maxDepth, depth);

                    if (node.children.length === 0) {
                        leafNodes++;
                    } else {
                        node.children.forEach((child: any) => traverse(child, depth + 1));
                    }
                };

                nodes.forEach(node => traverse(node, 0));
                return { totalNodes, maxDepth, leafNodes };
            };

            const hierarchyStats = calculateTreeStats(hierarchyTree);

            res.json({
                success: true,
                data: {
                    role: {
                        id: role._id,
                        name: role.name,
                        displayName: role.displayName,
                        category: role.category,
                        hierarchyLevel: role.hierarchyLevel,
                        isSystemRole: role.isSystemRole
                    },
                    inheritancePath: inheritancePath.map(r => ({
                        id: r._id,
                        name: r.name,
                        displayName: r.displayName,
                        hierarchyLevel: r.hierarchyLevel
                    })),
                    hierarchyTree,
                    statistics: {
                        ...hierarchyStats,
                        inheritanceDepth: inheritancePath.length,
                        hasParent: !!role.parentRole,
                        hasChildren: role.childRoles.length > 0
                    },
                    ...(includePermissions === 'true' && { permissions: permissionDetails }),
                    ...(includeUsers === 'true' && { userAssignments })
                },
            });

        } catch (error) {
            logger.error('Error fetching role hierarchy:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching role hierarchy',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Change parent role relationship
     * PUT /api/admin/roles/:id/parent
     */
    async changeParentRole(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { id } = req.params;
            const { parentRoleId } = req.body;

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

            if (role.isSystemRole) {
                return res.status(403).json({
                    success: false,
                    message: 'System roles cannot have their parent changed',
                });
            }

            let newParentRole: IRole | null = null;

            // Validate new parent role if provided
            if (parentRoleId) {
                if (!mongoose.Types.ObjectId.isValid(parentRoleId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid parent role ID format',
                    });
                }

                newParentRole = await Role.findById(parentRoleId);
                if (!newParentRole) {
                    return res.status(404).json({
                        success: false,
                        message: 'New parent role not found',
                    });
                }

                if (!newParentRole.isActive) {
                    return res.status(400).json({
                        success: false,
                        message: 'New parent role is not active',
                    });
                }

                // Check for circular dependency
                const hasCircularDependency = await this.roleHierarchyService.detectCircularDependency(
                    role._id,
                    newParentRole._id
                );

                if (hasCircularDependency) {
                    return res.status(400).json({
                        success: false,
                        message: 'Changing parent would create a circular dependency',
                    });
                }

                // Validate hierarchy constraints
                const conflicts = await this.roleHierarchyService.validateRoleHierarchy(
                    role._id,
                    newParentRole._id
                );

                if (conflicts.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Hierarchy validation failed',
                        conflicts: conflicts.map(c => ({
                            type: c.type,
                            message: c.message,
                            severity: c.severity
                        })),
                    });
                }
            }

            const oldParentRole = role.parentRole;
            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Remove from old parent's children array
                    if (oldParentRole) {
                        await Role.findByIdAndUpdate(
                            oldParentRole,
                            {
                                $pull: { childRoles: role._id },
                                lastModifiedBy: req.user!._id
                            },
                            { session }
                        );
                    }

                    // Update role's parent
                    const updateData: any = {
                        lastModifiedBy: req.user!._id
                    };

                    if (parentRoleId) {
                        updateData.parentRole = newParentRole!._id;
                        updateData.hierarchyLevel = newParentRole!.hierarchyLevel + 1;
                    } else {
                        updateData.$unset = { parentRole: 1 };
                        updateData.hierarchyLevel = 0;
                    }

                    await Role.findByIdAndUpdate(role._id, updateData, { session });

                    // Add to new parent's children array
                    if (parentRoleId) {
                        await Role.findByIdAndUpdate(
                            parentRoleId,
                            {
                                $addToSet: { childRoles: role._id },
                                lastModifiedBy: req.user!._id
                            },
                            { session }
                        );
                    }

                    // Update hierarchy levels for all descendants
                    await this.roleHierarchyService.updateHierarchyLevels(role._id);
                });

                // Invalidate caches for affected roles
                await this.dynamicPermissionService.invalidateRoleCache(role._id);
                if (oldParentRole) {
                    await this.dynamicPermissionService.invalidateRoleCache(oldParentRole);
                }
                if (newParentRole) {
                    await this.dynamicPermissionService.invalidateRoleCache(newParentRole._id);
                }

                logger.info('Role parent changed successfully', {
                    roleId: role._id,
                    roleName: role.name,
                    oldParentRoleId: oldParentRole?.toString() || null,
                    newParentRoleId: parentRoleId || null,
                    changedBy: req.user!._id,
                });

                res.json({
                    success: true,
                    message: 'Role parent changed successfully',
                    data: {
                        role: {
                            id: role._id,
                            name: role.name,
                            displayName: role.displayName
                        },
                        oldParent: oldParentRole ? {
                            id: oldParentRole,
                            // We'd need to fetch the old parent role details if needed
                        } : null,
                        newParent: newParentRole ? {
                            id: newParentRole._id,
                            name: newParentRole.name,
                            displayName: newParentRole.displayName,
                            hierarchyLevel: newParentRole.hierarchyLevel
                        } : null,
                        newHierarchyLevel: newParentRole ? newParentRole.hierarchyLevel + 1 : 0
                    },
                });

            } finally {
                await session.endSession();
            }

        } catch (error) {
            logger.error('Error changing role parent:', error);
            res.status(500).json({
                success: false,
                message: 'Error changing role parent',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }
    /**
      * Get complete role hierarchy tree
      * GET /api/admin/roles/hierarchy-tree
      */
    async getFullRoleHierarchyTree(req: AuthRequest, res: Response): Promise<any> {
        try {
            const {
                includeInactive = false,
                includePermissions = false,
                includeUserCounts = false,
                rootRoleId
            } = req.query;

            // Get the complete role hierarchy tree
            const hierarchyTree = await this.roleHierarchyService.getRoleHierarchyTree(
                rootRoleId ? new mongoose.Types.ObjectId(rootRoleId as string) : undefined
            );

            // Enhance tree with additional information if requested
            const enhanceNode = async (node: any): Promise<any> => {
                const enhancedNode = { ...node };

                // Add permission information
                if (includePermissions === 'true') {
                    const allPermissions = await this.roleHierarchyService.getAllRolePermissions(node.role._id);
                    enhancedNode.permissionSummary = {
                        totalPermissions: allPermissions.permissions.length,
                        directPermissions: node.permissions.length,
                        inheritedPermissions: node.inheritedPermissions.length,
                        hasConflicts: allPermissions.conflicts.length > 0
                    };
                }

                // Add user count information
                if (includeUserCounts === 'true') {
                    const userCount = await mongoose.model('UserRole').countDocuments({
                        roleId: node.role._id,
                        isActive: true
                    });
                    enhancedNode.userCount = userCount;
                }

                // Recursively enhance children
                if (node.children && node.children.length > 0) {
                    enhancedNode.children = await Promise.all(
                        node.children.map((child: any) => enhanceNode(child))
                    );
                }

                return enhancedNode;
            };

            const enhancedTree = await Promise.all(
                hierarchyTree.map(node => enhanceNode(node))
            );

            // Calculate overall statistics
            const calculateOverallStats = (nodes: any[]): any => {
                let totalRoles = 0;
                let totalUsers = 0;
                let maxDepth = 0;
                let rolesWithChildren = 0;
                let leafRoles = 0;
                const categoryDistribution: Record<string, number> = {};

                const traverse = (node: any, depth: number) => {
                    totalRoles++;
                    maxDepth = Math.max(maxDepth, depth);

                    // Count category distribution
                    const category = node.role.category;
                    categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

                    // Count users if available
                    if (node.userCount !== undefined) {
                        totalUsers += node.userCount;
                    }

                    if (node.children.length === 0) {
                        leafRoles++;
                    } else {
                        rolesWithChildren++;
                        node.children.forEach((child: any) => traverse(child, depth + 1));
                    }
                };

                nodes.forEach(node => traverse(node, 0));

                return {
                    totalRoles,
                    totalUsers,
                    maxDepth,
                    rolesWithChildren,
                    leafRoles,
                    rootRoles: nodes.length,
                    categoryDistribution
                };
            };

            const overallStats = calculateOverallStats(enhancedTree);

            // Find potential hierarchy issues
            const hierarchyIssues: Array<{
                type: string;
                roleId: string;
                roleName: string;
                message: string;
                severity: 'warning' | 'error';
            }> = [];

            const checkForIssues = (node: any, depth: number) => {
                // Check for excessive depth
                if (depth > 5) {
                    hierarchyIssues.push({
                        type: 'excessive_depth',
                        roleId: node.role._id.toString(),
                        roleName: node.role.name,
                        message: `Role is at depth ${depth}, consider flattening hierarchy`,
                        severity: 'warning'
                    });
                }

                // Check for roles with many children
                if (node.children.length > 10) {
                    hierarchyIssues.push({
                        type: 'too_many_children',
                        roleId: node.role._id.toString(),
                        roleName: node.role.name,
                        message: `Role has ${node.children.length} children, consider grouping`,
                        severity: 'warning'
                    });
                }

                // Check for permission conflicts
                if (node.permissionSummary?.hasConflicts) {
                    hierarchyIssues.push({
                        type: 'permission_conflicts',
                        roleId: node.role._id.toString(),
                        roleName: node.role.name,
                        message: 'Role has permission conflicts in hierarchy',
                        severity: 'error'
                    });
                }

                // Recursively check children
                node.children.forEach((child: any) => checkForIssues(child, depth + 1));
            };

            enhancedTree.forEach(node => checkForIssues(node, 0));

            res.json({
                success: true,
                data: {
                    hierarchyTree: enhancedTree,
                    statistics: overallStats,
                    issues: hierarchyIssues,
                    metadata: {
                        includeInactive: includeInactive === 'true',
                        includePermissions: includePermissions === 'true',
                        includeUserCounts: includeUserCounts === 'true',
                        rootRoleId: rootRoleId || null,
                        generatedAt: new Date()
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching full role hierarchy tree:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching full role hierarchy tree',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Validate role hierarchy and detect issues
     * POST /api/admin/roles/hierarchy/validate
     */
    async validateRoleHierarchy(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { roleId, parentRoleId, checkType = 'full' } = req.body;

            const validationResults: Array<{
                type: string;
                roleId?: string;
                roleName?: string;
                message: string;
                severity: 'info' | 'warning' | 'error' | 'critical';
                suggestions?: string[];
            }> = [];

            if (checkType === 'single' && roleId) {
                // Validate a specific role hierarchy change
                if (!mongoose.Types.ObjectId.isValid(roleId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid role ID format',
                    });
                }

                const role = await Role.findById(roleId);
                if (!role) {
                    return res.status(404).json({
                        success: false,
                        message: 'Role not found',
                    });
                }

                // Validate hierarchy constraints
                const conflicts = await this.roleHierarchyService.validateRoleHierarchy(
                    role._id,
                    parentRoleId ? new mongoose.Types.ObjectId(parentRoleId) : undefined
                );

                conflicts.forEach(conflict => {
                    validationResults.push({
                        type: conflict.type,
                        roleId: conflict.roleId.toString(),
                        roleName: role.name,
                        message: conflict.message,
                        severity: conflict.severity as any,
                        suggestions: []
                    });
                });

                // Get conflict resolutions
                if (conflicts.length > 0) {
                    const resolutions = await this.roleHierarchyService.resolveRoleConflicts(conflicts);
                    resolutions.forEach((resolution, index) => {
                        if (validationResults[index]) {
                            validationResults[index].suggestions = resolution.resolutions;
                        }
                    });
                }

            } else {
                // Validate entire role hierarchy
                const allRoles = await Role.find({ isActive: true });

                // Check for circular dependencies
                const visited = new Set<string>();
                const recursionStack = new Set<string>();

                const detectCircularDependencies = async (role: IRole, path: string[]): Promise<void> => {
                    const roleIdStr = role._id.toString();

                    if (recursionStack.has(roleIdStr)) {
                        const cycleStart = path.indexOf(role.name);
                        const cyclePath = cycleStart !== -1 ? path.slice(cycleStart) : path;

                        validationResults.push({
                            type: 'circular_dependency',
                            roleId: roleIdStr,
                            roleName: role.name,
                            message: `Circular dependency detected: ${cyclePath.join(' -> ')} -> ${role.name}`,
                            severity: 'critical',
                            suggestions: [
                                'Remove one of the parent-child relationships in the cycle',
                                'Restructure the hierarchy to eliminate the circular reference'
                            ]
                        });
                        return;
                    }

                    if (visited.has(roleIdStr)) {
                        return;
                    }

                    visited.add(roleIdStr);
                    recursionStack.add(roleIdStr);

                    if (role.parentRole) {
                        const parentRole = await Role.findById(role.parentRole);
                        if (parentRole) {
                            await detectCircularDependencies(parentRole, [...path, role.name]);
                        }
                    }

                    recursionStack.delete(roleIdStr);
                };

                // Check each role for circular dependencies
                for (const role of allRoles) {
                    if (!visited.has(role._id.toString())) {
                        await detectCircularDependencies(role, []);
                    }
                }

                // Check for orphaned roles (roles with invalid parent references)
                for (const role of allRoles) {
                    if (role.parentRole) {
                        const parentExists = await Role.findById(role.parentRole);
                        if (!parentExists) {
                            validationResults.push({
                                type: 'orphaned_role',
                                roleId: role._id.toString(),
                                roleName: role.name,
                                message: 'Role references non-existent parent role',
                                severity: 'error',
                                suggestions: [
                                    'Remove the parent role reference',
                                    'Create the missing parent role',
                                    'Assign a different valid parent role'
                                ]
                            });
                        } else if (!parentExists.isActive) {
                            validationResults.push({
                                type: 'inactive_parent',
                                roleId: role._id.toString(),
                                roleName: role.name,
                                message: 'Role references inactive parent role',
                                severity: 'warning',
                                suggestions: [
                                    'Activate the parent role',
                                    'Assign a different active parent role',
                                    'Remove the parent role reference'
                                ]
                            });
                        }
                    }
                }

                // Check for inconsistent hierarchy levels
                for (const role of allRoles) {
                    const expectedLevel = await this.roleHierarchyService.calculateHierarchyLevel(role._id);
                    if (role.hierarchyLevel !== expectedLevel) {
                        validationResults.push({
                            type: 'inconsistent_hierarchy_level',
                            roleId: role._id.toString(),
                            roleName: role.name,
                            message: `Hierarchy level mismatch: expected ${expectedLevel}, actual ${role.hierarchyLevel}`,
                            severity: 'warning',
                            suggestions: [
                                'Run hierarchy level recalculation',
                                'Update the role hierarchy level manually'
                            ]
                        });
                    }
                }

                // Check for excessive hierarchy depth
                const maxDepth = Math.max(...allRoles.map(r => r.hierarchyLevel));
                if (maxDepth > 8) {
                    validationResults.push({
                        type: 'excessive_hierarchy_depth',
                        message: `Maximum hierarchy depth is ${maxDepth}, consider flattening`,
                        severity: 'warning',
                        suggestions: [
                            'Combine similar roles at different levels',
                            'Create parallel role structures instead of deep nesting',
                            'Review if all hierarchy levels are necessary'
                        ]
                    });
                }
            }

            // Categorize results by severity
            const resultsBySeverity = {
                critical: validationResults.filter(r => r.severity === 'critical'),
                error: validationResults.filter(r => r.severity === 'error'),
                warning: validationResults.filter(r => r.severity === 'warning'),
                info: validationResults.filter(r => r.severity === 'info')
            };

            const isValid = resultsBySeverity.critical.length === 0 && resultsBySeverity.error.length === 0;

            res.json({
                success: true,
                data: {
                    isValid,
                    checkType,
                    totalIssues: validationResults.length,
                    issuesBySeverity: {
                        critical: resultsBySeverity.critical.length,
                        error: resultsBySeverity.error.length,
                        warning: resultsBySeverity.warning.length,
                        info: resultsBySeverity.info.length
                    },
                    results: validationResults,
                    resultsBySeverity,
                    recommendations: isValid ?
                        ['Role hierarchy is valid'] :
                        [
                            'Address critical and error issues immediately',
                            'Review warning issues for potential improvements',
                            'Consider running hierarchy maintenance operations'
                        ]
                },
            });

        } catch (error) {
            logger.error('Error validating role hierarchy:', error);
            res.status(500).json({
                success: false,
                message: 'Error validating role hierarchy',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }
}

export const roleHierarchyController = new RoleHierarchyController();