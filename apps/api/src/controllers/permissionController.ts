import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Permission, { IPermission } from '../models/Permission';
import Role, { IRole } from '../models/Role';
import RolePermission, { IRolePermission } from '../models/RolePermission';
import RoleHierarchyService from '../services/RoleHierarchyService';
import DynamicPermissionService from '../services/DynamicPermissionService';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export class PermissionController {
    private roleHierarchyService: RoleHierarchyService;
    private dynamicPermissionService: DynamicPermissionService;

    constructor() {
        this.roleHierarchyService = RoleHierarchyService.getInstance();
        this.dynamicPermissionService = DynamicPermissionService.getInstance();
    }

    /**
     * Get all permissions with filtering and categorization
     * GET /api/admin/permissions
     */
    async getPermissions(req: AuthRequest, res: Response): Promise<any> {
        try {
            const {
                page = 1,
                limit = 50,
                category,
                riskLevel,
                isActive,
                isSystemPermission,
                requiredSubscriptionTier,
                search,
                sortBy = 'action',
                sortOrder = 'asc'
            } = req.query;

            // Build query
            const query: any = {};

            if (category) {
                query.category = category;
            }

            if (riskLevel) {
                query.riskLevel = riskLevel;
            }

            if (isActive !== undefined) {
                query.isActive = isActive === 'true';
            }

            if (isSystemPermission !== undefined) {
                query.isSystemPermission = isSystemPermission === 'true';
            }

            if (requiredSubscriptionTier) {
                query.requiredSubscriptionTier = requiredSubscriptionTier;
            }

            if (search) {
                query.$or = [
                    { action: { $regex: search, $options: 'i' } },
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

            const [permissions, total] = await Promise.all([
                Permission.find(query)
                    .populate('createdBy', 'firstName lastName')
                    .populate('lastModifiedBy', 'firstName lastName')
                    .sort(sort)
                    .skip(skip)
                    .limit(limitNum),
                Permission.countDocuments(query)
            ]);

            // Add usage statistics for each permission
            const permissionsWithStats = await Promise.all(
                permissions.map(async (permission) => {
                    const [roleCount, directAssignmentCount] = await Promise.all([
                        RolePermission.countDocuments({
                            permissionAction: permission.action,
                            granted: true,
                            isActive: true
                        }),
                        // Count users with direct permission assignments
                        // This would require querying User model for directPermissions array
                        0 // Placeholder for now
                    ]);

                    return {
                        ...permission.toObject(),
                        usage: {
                            roleCount,
                            directAssignmentCount,
                            totalUsage: roleCount + directAssignmentCount
                        }
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    permissions: permissionsWithStats,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum),
                    },
                    filters: {
                        category,
                        riskLevel,
                        isActive,
                        isSystemPermission,
                        requiredSubscriptionTier,
                        search
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching permissions:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching permissions',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get permission matrix grouped by categories
     * GET /api/admin/permissions/matrix
     */
    async getPermissionMatrix(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { includeInactive = false } = req.query;

            const query: any = {};
            if (includeInactive !== 'true') {
                query.isActive = true;
            }

            const permissions = await Permission.find(query)
                .sort({ category: 1, action: 1 });

            // Group permissions by category
            const matrix: Record<string, IPermission[]> = {};
            const categories = new Set<string>();

            permissions.forEach(permission => {
                const category = permission.category;
                categories.add(category);

                if (!matrix[category]) {
                    matrix[category] = [];
                }
                matrix[category].push(permission);
            });

            // Get category statistics
            const categoryStats = await Promise.all(
                Array.from(categories).map(async (category) => {
                    const [totalCount, activeCount, systemCount] = await Promise.all([
                        Permission.countDocuments({ category }),
                        Permission.countDocuments({ category, isActive: true }),
                        Permission.countDocuments({ category, isSystemPermission: true })
                    ]);

                    return {
                        category,
                        totalCount,
                        activeCount,
                        systemCount
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    matrix,
                    categories: Array.from(categories).sort(),
                    categoryStats,
                    totalPermissions: permissions.length
                },
            });

        } catch (error) {
            logger.error('Error fetching permission matrix:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching permission matrix',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Create a new permission
     * POST /api/admin/permissions
     */
    async createPermission(req: AuthRequest, res: Response): Promise<any> {
        try {
            const {
                action,
                displayName,
                description,
                category,
                requiredSubscriptionTier,
                requiredPlanFeatures = [],
                dependencies = [],
                conflicts = [],
                riskLevel = 'low'
            } = req.body;

            // Validate required fields
            if (!action || !displayName || !description || !category) {
                return res.status(400).json({
                    success: false,
                    message: 'Action, display name, description, and category are required',
                });
            }

            // Validate action format
            if (!/^[a-z0-9_-]+:[a-z0-9_-]+$/.test(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'Action must follow format "resource:action" (e.g., "patient:read")',
                });
            }

            // Check if permission already exists
            const existingPermission = await Permission.findOne({ action });
            if (existingPermission) {
                return res.status(409).json({
                    success: false,
                    message: 'Permission with this action already exists',
                });
            }

            // Validate dependencies exist
            if (dependencies.length > 0) {
                const validDependencies = await Permission.find({
                    action: { $in: dependencies },
                    isActive: true
                });

                const validDependencyActions = validDependencies.map(p => p.action);
                const invalidDependencies = dependencies.filter(
                    (dep: string) => !validDependencyActions.includes(dep)
                );

                if (invalidDependencies.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid dependency permissions found',
                        invalidDependencies,
                    });
                }
            }

            // Validate conflicts exist
            if (conflicts.length > 0) {
                const validConflicts = await Permission.find({
                    action: { $in: conflicts },
                    isActive: true
                });

                const validConflictActions = validConflicts.map(p => p.action);
                const invalidConflicts = conflicts.filter(
                    (conflict: string) => !validConflictActions.includes(conflict)
                );

                if (invalidConflicts.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid conflict permissions found',
                        invalidConflicts,
                    });
                }
            }

            // Create the permission
            const permission = new Permission({
                action: action.toLowerCase(),
                displayName,
                description,
                category: category.toLowerCase(),
                requiredSubscriptionTier,
                requiredPlanFeatures,
                dependencies,
                conflicts,
                riskLevel,
                isActive: true,
                isSystemPermission: false,
                createdBy: req.user!._id,
                lastModifiedBy: req.user!._id,
            });

            await permission.save();

            // Populate the response
            const populatedPermission = await Permission.findById(permission._id)
                .populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            logger.info('Permission created successfully', {
                permissionId: permission._id,
                action: permission.action,
                createdBy: req.user!._id,
            });

            res.status(201).json({
                success: true,
                message: 'Permission created successfully',
                data: populatedPermission,
            });

        } catch (error) {
            logger.error('Error creating permission:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating permission',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Update a permission
     * PUT /api/admin/permissions/:action
     */
    async updatePermission(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { action } = req.params;
            const {
                displayName,
                description,
                category,
                requiredSubscriptionTier,
                requiredPlanFeatures,
                dependencies,
                conflicts,
                riskLevel,
                isActive
            } = req.body;

            const permission = await Permission.findOne({ action });
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    message: 'Permission not found',
                });
            }

            // Prevent modification of system permissions
            if (permission.isSystemPermission) {
                return res.status(403).json({
                    success: false,
                    message: 'System permissions cannot be modified',
                });
            }

            // Validate dependencies if provided
            if (dependencies && dependencies.length > 0) {
                const validDependencies = await Permission.find({
                    action: { $in: dependencies },
                    isActive: true
                });

                const validDependencyActions = validDependencies.map(p => p.action);
                const invalidDependencies = dependencies.filter(
                    (dep: string) => !validDependencyActions.includes(dep)
                );

                if (invalidDependencies.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid dependency permissions found',
                        invalidDependencies,
                    });
                }
            }

            // Validate conflicts if provided
            if (conflicts && conflicts.length > 0) {
                const validConflicts = await Permission.find({
                    action: { $in: conflicts },
                    isActive: true
                });

                const validConflictActions = validConflicts.map(p => p.action);
                const invalidConflicts = conflicts.filter(
                    (conflict: string) => !validConflictActions.includes(conflict)
                );

                if (invalidConflicts.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid conflict permissions found',
                        invalidConflicts,
                    });
                }
            }

            // Update permission fields
            const updateData: any = {
                lastModifiedBy: req.user!._id,
            };

            if (displayName !== undefined) updateData.displayName = displayName;
            if (description !== undefined) updateData.description = description;
            if (category !== undefined) updateData.category = category.toLowerCase();
            if (requiredSubscriptionTier !== undefined) updateData.requiredSubscriptionTier = requiredSubscriptionTier;
            if (requiredPlanFeatures !== undefined) updateData.requiredPlanFeatures = requiredPlanFeatures;
            if (dependencies !== undefined) updateData.dependencies = dependencies;
            if (conflicts !== undefined) updateData.conflicts = conflicts;
            if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
            if (isActive !== undefined) updateData.isActive = isActive;

            const updatedPermission = await Permission.findOneAndUpdate(
                { action },
                updateData,
                { new: true, runValidators: true }
            ).populate('createdBy', 'firstName lastName')
                .populate('lastModifiedBy', 'firstName lastName');

            // Invalidate caches for roles using this permission
            await this.invalidatePermissionCaches(action!);

            logger.info('Permission updated successfully', {
                permissionId: permission._id,
                action: permission.action,
                updatedBy: req.user!._id,
                changes: updateData,
            });

            res.json({
                success: true,
                message: 'Permission updated successfully',
                data: updatedPermission,
            });

        } catch (error) {
            logger.error('Error updating permission:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating permission',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }
    /**
         * Get permission categories with statistics
         * GET /api/admin/permissions/categories
         */
    async getPermissionCategories(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { includeInactive = false } = req.query;

            // Get all unique categories
            const pipeline: any[] = [
                {
                    $match: includeInactive === 'true' ? {} : { isActive: true }
                },
                {
                    $group: {
                        _id: '$category',
                        totalCount: { $sum: 1 },
                        activeCount: {
                            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                        },
                        systemCount: {
                            $sum: { $cond: [{ $eq: ['$isSystemPermission', true] }, 1, 0] }
                        },
                        riskLevels: { $push: '$riskLevel' },
                        subscriptionTiers: { $push: '$requiredSubscriptionTier' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ];

            const categoryStats = await Permission.aggregate(pipeline);

            // Process risk level and subscription tier statistics
            const processedStats = categoryStats.map(stat => {
                const riskLevelCounts = stat.riskLevels.reduce((acc: any, level: string) => {
                    if (level) {
                        acc[level] = (acc[level] || 0) + 1;
                    }
                    return acc;
                }, {});

                const tierCounts = stat.subscriptionTiers.reduce((acc: any, tier: string) => {
                    if (tier) {
                        acc[tier] = (acc[tier] || 0) + 1;
                    }
                    return acc;
                }, {});

                return {
                    category: stat._id,
                    totalCount: stat.totalCount,
                    activeCount: stat.activeCount,
                    systemCount: stat.systemCount,
                    riskLevelDistribution: riskLevelCounts,
                    subscriptionTierDistribution: tierCounts
                };
            });

            // Get sample permissions for each category
            const categoriesWithSamples = await Promise.all(
                processedStats.map(async (stat) => {
                    const samplePermissions = await Permission.find({
                        category: stat.category,
                        isActive: true
                    })
                        .select('action displayName riskLevel')
                        .limit(5)
                        .sort({ action: 1 });

                    return {
                        ...stat,
                        samplePermissions
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    categories: categoriesWithSamples,
                    totalCategories: categoriesWithSamples.length,
                    summary: {
                        totalPermissions: categoriesWithSamples.reduce((sum, cat) => sum + cat.totalCount, 0),
                        activePermissions: categoriesWithSamples.reduce((sum, cat) => sum + cat.activeCount, 0),
                        systemPermissions: categoriesWithSamples.reduce((sum, cat) => sum + cat.systemCount, 0)
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching permission categories:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching permission categories',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get permission dependencies and conflicts mapping
     * GET /api/admin/permissions/dependencies
     */
    async getPermissionDependencies(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { action } = req.query;

            let query: any = { isActive: true };
            if (action) {
                query.action = action;
            }

            const permissions = await Permission.find(query)
                .select('action displayName dependencies conflicts riskLevel category');

            // Build dependency graph
            const dependencyGraph: Record<string, {
                permission: IPermission;
                dependsOn: string[];
                requiredBy: string[];
                conflictsWith: string[];
                conflictedBy: string[];
            }> = {};

            // Initialize graph nodes
            permissions.forEach(permission => {
                dependencyGraph[permission.action] = {
                    permission,
                    dependsOn: permission.dependencies || [],
                    requiredBy: [],
                    conflictsWith: permission.conflicts || [],
                    conflictedBy: []
                };
            });

            // Build reverse relationships
            permissions.forEach(permission => {
                // Build "required by" relationships
                if (permission.dependencies) {
                    permission.dependencies.forEach(dep => {
                        if (dependencyGraph[dep]) {
                            dependencyGraph[dep].requiredBy.push(permission.action);
                        }
                    });
                }

                // Build "conflicted by" relationships
                if (permission.conflicts) {
                    permission.conflicts.forEach(conflict => {
                        if (dependencyGraph[conflict]) {
                            dependencyGraph[conflict].conflictedBy.push(permission.action);
                        }
                    });
                }
            });

            // Detect circular dependencies
            const circularDependencies: string[][] = [];
            const visited = new Set<string>();
            const recursionStack = new Set<string>();

            const detectCircular = (permissionAction: string, path: string[]): void => {
                if (recursionStack.has(permissionAction)) {
                    const cycleStart = path.indexOf(permissionAction);
                    if (cycleStart !== -1) {
                        circularDependencies.push(path.slice(cycleStart));
                    }
                    return;
                }

                if (visited.has(permissionAction)) {
                    return;
                }

                visited.add(permissionAction);
                recursionStack.add(permissionAction);

                const node = dependencyGraph[permissionAction];
                if (node) {
                    node.dependsOn.forEach(dep => {
                        detectCircular(dep, [...path, permissionAction]);
                    });
                }

                recursionStack.delete(permissionAction);
            };

            Object.keys(dependencyGraph).forEach(permissionAction => {
                if (!visited.has(permissionAction)) {
                    detectCircular(permissionAction, []);
                }
            });

            // Find orphaned permissions (no dependencies and not required by others)
            const orphanedPermissions = Object.keys(dependencyGraph).filter(action => {
                const node = dependencyGraph[action];
                return node && node.dependsOn.length === 0 && node.requiredBy.length === 0;
            });

            // Find highly connected permissions
            const highlyConnected = Object.keys(dependencyGraph)
                .map(action => {
                    const node = dependencyGraph[action];
                    return {
                        action,
                        totalConnections: node ? (
                            node.dependsOn.length +
                            node.requiredBy.length +
                            node.conflictsWith.length +
                            node.conflictedBy.length
                        ) : 0
                    };
                })
                .filter(item => item.totalConnections > 0)
                .sort((a, b) => b.totalConnections - a.totalConnections)
                .slice(0, 10);

            res.json({
                success: true,
                data: {
                    dependencyGraph: action ?
                        (dependencyGraph[action as string] ? { [action as string]: dependencyGraph[action as string] } : {}) :
                        dependencyGraph,
                    analysis: {
                        circularDependencies,
                        orphanedPermissions,
                        highlyConnected,
                        totalPermissions: permissions.length,
                        permissionsWithDependencies: Object.values(dependencyGraph).filter(node => node.dependsOn.length > 0).length,
                        permissionsWithConflicts: Object.values(dependencyGraph).filter(node => node.conflictsWith.length > 0).length
                    }
                },
            });

        } catch (error) {
            logger.error('Error fetching permission dependencies:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching permission dependencies',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Get permission usage statistics
     * GET /api/admin/permissions/:action/usage
     */
    async getPermissionUsage(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { action } = req.params;

            const permission = await Permission.findOne({ action });
            if (!permission) {
                return res.status(404).json({
                    success: false,
                    message: 'Permission not found',
                });
            }

            // Get roles that have this permission
            const rolesWithPermission = await this.roleHierarchyService.getRolesWithPermission(action!);

            // Get role assignments for roles with this permission
            const roleIds = rolesWithPermission.map(r => r.role._id);
            const roleAssignments = await mongoose.model('UserRole').find({
                roleId: { $in: roleIds },
                isActive: true
            }).populate('userId', 'firstName lastName email role status');

            // Get users with direct permission assignments
            const usersWithDirectPermission = await mongoose.model('User').find({
                directPermissions: action,
                status: 'active'
            }).select('firstName lastName email role status');

            // Get users with explicit denials
            const usersWithDenial = await mongoose.model('User').find({
                deniedPermissions: action
            }).select('firstName lastName email role status');

            // Calculate usage statistics
            const uniqueUserIds = new Set();
            roleAssignments.forEach((assignment: any) => {
                if (assignment.userId) {
                    uniqueUserIds.add(assignment.userId._id.toString());
                }
            });
            usersWithDirectPermission.forEach(user => {
                uniqueUserIds.add(user._id.toString());
            });

            const usageStats = {
                totalUniqueUsers: uniqueUserIds.size,
                roleBasedUsers: roleAssignments.length,
                directAssignmentUsers: usersWithDirectPermission.length,
                deniedUsers: usersWithDenial.length,
                rolesUsingPermission: rolesWithPermission.length
            };

            res.json({
                success: true,
                data: {
                    permission: {
                        action: permission.action,
                        displayName: permission.displayName,
                        category: permission.category,
                        riskLevel: permission.riskLevel
                    },
                    usage: usageStats,
                    rolesWithPermission: rolesWithPermission.map(r => ({
                        role: {
                            id: r.role._id,
                            name: r.role.name,
                            displayName: r.role.displayName,
                            category: r.role.category
                        },
                        source: r.source,
                        inheritedFrom: r.inheritedFrom ? {
                            id: r.inheritedFrom._id,
                            name: r.inheritedFrom.name,
                            displayName: r.inheritedFrom.displayName
                        } : undefined
                    })),
                    directAssignments: usersWithDirectPermission.map(user => ({
                        id: user._id,
                        name: `${user.firstName} ${user.lastName}`,
                        email: user.email,
                        role: user.role,
                        status: user.status
                    })),
                    denials: usersWithDenial.map(user => ({
                        id: user._id,
                        name: `${user.firstName} ${user.lastName}`,
                        email: user.email,
                        role: user.role,
                        status: user.status
                    }))
                },
            });

        } catch (error) {
            logger.error('Error fetching permission usage:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching permission usage',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Validate permission dependencies and conflicts
     * POST /api/admin/permissions/validate
     */
    async validatePermissions(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { permissions } = req.body;

            if (!permissions || !Array.isArray(permissions)) {
                return res.status(400).json({
                    success: false,
                    message: 'Permissions array is required',
                });
            }

            const validationResults: Array<{
                permission: string;
                isValid: boolean;
                issues: string[];
                suggestions: string[];
            }> = [];

            for (const permissionAction of permissions) {
                const permission = await Permission.findOne({
                    action: permissionAction,
                    isActive: true
                });

                const issues: string[] = [];
                const suggestions: string[] = [];

                if (!permission) {
                    issues.push('Permission does not exist');
                    suggestions.push('Create the permission or check the action name');
                    validationResults.push({
                        permission: permissionAction,
                        isValid: false,
                        issues,
                        suggestions
                    });
                    continue;
                }

                // Check dependencies
                if (permission.dependencies && permission.dependencies.length > 0) {
                    const missingDependencies = [];
                    for (const dep of permission.dependencies) {
                        if (!permissions.includes(dep)) {
                            missingDependencies.push(dep);
                        }
                    }

                    if (missingDependencies.length > 0) {
                        issues.push(`Missing required dependencies: ${missingDependencies.join(', ')}`);
                        suggestions.push(`Add dependencies: ${missingDependencies.join(', ')}`);
                    }
                }

                // Check conflicts
                if (permission.conflicts && permission.conflicts.length > 0) {
                    const conflictingPermissions = permission.conflicts.filter(conflict =>
                        permissions.includes(conflict)
                    );

                    if (conflictingPermissions.length > 0) {
                        issues.push(`Conflicts with: ${conflictingPermissions.join(', ')}`);
                        suggestions.push(`Remove conflicting permissions: ${conflictingPermissions.join(', ')}`);
                    }
                }

                validationResults.push({
                    permission: permissionAction,
                    isValid: issues.length === 0,
                    issues,
                    suggestions
                });
            }

            const overallValid = validationResults.every(result => result.isValid);
            const totalIssues = validationResults.reduce((sum, result) => sum + result.issues.length, 0);

            res.json({
                success: true,
                data: {
                    isValid: overallValid,
                    totalPermissions: permissions.length,
                    validPermissions: validationResults.filter(r => r.isValid).length,
                    totalIssues,
                    results: validationResults,
                    summary: {
                        hasConflicts: validationResults.some(r =>
                            r.issues.some(issue => issue.includes('Conflicts with'))
                        ),
                        hasMissingDependencies: validationResults.some(r =>
                            r.issues.some(issue => issue.includes('Missing required dependencies'))
                        ),
                        hasInvalidPermissions: validationResults.some(r =>
                            r.issues.some(issue => issue.includes('does not exist'))
                        )
                    }
                },
            });

        } catch (error) {
            logger.error('Error validating permissions:', error);
            res.status(500).json({
                success: false,
                message: 'Error validating permissions',
                error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
            });
        }
    }

    /**
     * Helper method to invalidate caches for roles using this permission
     */
    private async invalidatePermissionCaches(permissionAction: string): Promise<void> {
        try {
            // Get all roles that use this permission
            const rolePermissions = await RolePermission.find({
                permissionAction,
                isActive: true
            });

            const roleIds = rolePermissions.map(rp => rp.roleId);

            // Invalidate role caches
            for (const roleId of roleIds) {
                await this.dynamicPermissionService.invalidateRoleCache(roleId);
            }

            // Also check legacy role permissions
            const rolesWithLegacyPermission = await Role.find({
                permissions: permissionAction,
                isActive: true
            });

            for (const role of rolesWithLegacyPermission) {
                await this.dynamicPermissionService.invalidateRoleCache(role._id);
            }

        } catch (error) {
            logger.error('Error invalidating permission caches:', error);
        }
    }
}

export const permissionController = new PermissionController();