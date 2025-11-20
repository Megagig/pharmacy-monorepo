import mongoose from 'mongoose';
import { IUser } from '../models/User';
import User from '../models/User';
import Role, { IRole } from '../models/Role';
import Permission, { IPermission } from '../models/Permission';
import UserRole, { IUserRole } from '../models/UserRole';
import RolePermission, { IRolePermission } from '../models/RolePermission';
import { WorkspaceContext, PermissionResult } from '../types/auth';
import RoleHierarchyService from './RoleHierarchyService';
import CacheManager from './CacheManager';
import CacheInvalidationService from './CacheInvalidationService';
import DatabaseOptimizationService from './DatabaseOptimizationService';
import PermissionAggregationService from './PermissionAggregationService';
import logger from '../utils/logger';
import { auditOperations } from '../middlewares/auditLogging';

export interface DynamicPermissionResult extends PermissionResult {
    source?: 'super_admin' | 'direct_permission' | 'direct_denial' | 'role' | 'inherited' | 'legacy' | 'none';
    roleId?: mongoose.Types.ObjectId;
    roleName?: string;
    inheritedFrom?: string;
    requiredPermissions?: string[];
    suggestions?: string[];
}

export interface PermissionContext {
    workspaceId?: mongoose.Types.ObjectId;
    departmentId?: mongoose.Types.ObjectId;
    resourceId?: mongoose.Types.ObjectId;
    clientIP?: string;
    currentTime?: Date;
}

/**
 * Dynamic Permission Service for database-driven RBAC
 * Provides dynamic permission resolution with role hierarchy support
 */
class DynamicPermissionService {
    private static instance: DynamicPermissionService;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private roleHierarchyService: RoleHierarchyService;
    private cacheManager: CacheManager;
    private cacheInvalidationService: any;
    private dbOptimizationService: any;
    private aggregationService: PermissionAggregationService;

    private constructor() {
        this.roleHierarchyService = RoleHierarchyService.getInstance();
        this.cacheManager = CacheManager.getInstance();
        // this.cacheInvalidationService = CacheInvalidationService.getInstance();
        // this.dbOptimizationService = DatabaseOptimizationService.getInstance();
        this.cacheInvalidationService = null; // Service initialization disabled for now
        this.dbOptimizationService = null; // Service initialization disabled for now
        this.aggregationService = PermissionAggregationService.getInstance();
    }

    public static getInstance(): DynamicPermissionService {
        if (!DynamicPermissionService.instance) {
            DynamicPermissionService.instance = new DynamicPermissionService();
        }
        return DynamicPermissionService.instance;
    }

    /**
     * Check if user has permission with dynamic database resolution
     */
    public async checkPermission(
        user: IUser,
        action: string,
        context: WorkspaceContext,
        permissionContext: PermissionContext = {}
    ): Promise<DynamicPermissionResult> {
        const startTime = Date.now();

        try {
            // 1. Check cache first for performance optimization
            const cachedResult = await this.cacheManager.getCachedPermissionCheck(
                user._id,
                action,
                context.workspace?._id
            );

            if (cachedResult) {
                logger.debug(`Cache hit for permission check: ${user._id}:${action}`);
                return {
                    allowed: cachedResult.allowed,
                    source: cachedResult.source as any,
                    reason: cachedResult.allowed ? undefined : 'Cached permission denial'
                };
            }

            // 2. Super admin bypass with audit logging
            if (user.role === 'super_admin') {
                const result: DynamicPermissionResult = {
                    allowed: true,
                    source: 'super_admin'
                };

                // Cache the result
                await this.cacheManager.cachePermissionCheck(
                    user._id,
                    action,
                    true,
                    'super_admin',
                    context.workspace?._id,
                    this.CACHE_TTL / 1000
                );

                await this.auditPermissionCheck(user, action, context, result);
                return result;
            }

            // 2. Check user status first
            const statusCheck = this.checkUserStatus(user);
            if (!statusCheck.allowed) {
                await this.auditPermissionCheck(user, action, context, statusCheck);
                return { ...statusCheck, source: 'none' };
            }

            // 3. Check explicit denials first (highest precedence)
            if (user.deniedPermissions?.includes(action)) {
                const result: DynamicPermissionResult = {
                    allowed: false,
                    reason: 'Permission explicitly denied',
                    source: 'direct_denial'
                };

                // Cache the denial result
                await this.cacheManager.cachePermissionCheck(
                    user._id,
                    action,
                    false,
                    'direct_denial',
                    context.workspace?._id,
                    this.CACHE_TTL / 1000
                );

                await this.auditPermissionCheck(user, action, context, result);
                return result;
            }

            // 4. Check direct permissions
            if (user.directPermissions?.includes(action)) {
                const result: DynamicPermissionResult = {
                    allowed: true,
                    source: 'direct_permission'
                };

                // Cache the result
                await this.cacheManager.cachePermissionCheck(
                    user._id,
                    action,
                    true,
                    'direct_permission',
                    context.workspace?._id,
                    this.CACHE_TTL / 1000
                );

                await this.auditPermissionCheck(user, action, context, result);
                return result;
            }

            // 5. Check role-based permissions with hierarchy
            const rolePermissionResult = await this.resolveRolePermissions(
                user,
                action,
                context,
                permissionContext
            );

            if (rolePermissionResult.allowed) {
                // Cache the successful role permission result
                await this.cacheManager.cachePermissionCheck(
                    user._id,
                    action,
                    true,
                    rolePermissionResult.source || 'role',
                    context.workspace?._id,
                    this.CACHE_TTL / 1000
                );

                await this.auditPermissionCheck(user, action, context, rolePermissionResult);
                return rolePermissionResult;
            }

            // 6. Check legacy static permissions for backward compatibility
            const legacyResult = await this.checkLegacyPermission(user, action, context);
            if (legacyResult.allowed) {
                const result: DynamicPermissionResult = {
                    ...legacyResult,
                    source: 'legacy'
                };

                // Cache the legacy permission result
                await this.cacheManager.cachePermissionCheck(
                    user._id,
                    action,
                    true,
                    'legacy',
                    context.workspace?._id,
                    this.CACHE_TTL / 1000
                );

                await this.auditPermissionCheck(user, action, context, result);
                return result;
            }

            // 7. No permissions found
            const suggestions = await this.getPermissionSuggestions(user, action);
            const result: DynamicPermissionResult = {
                allowed: false,
                reason: 'No matching permissions found',
                source: 'none',
                suggestions
            };

            // Cache the negative result with shorter TTL
            await this.cacheManager.cachePermissionCheck(
                user._id,
                action,
                false,
                'none',
                context.workspace?._id,
                Math.floor(this.CACHE_TTL / 2000) // Half the normal TTL for negative results
            );

            await this.auditPermissionCheck(user, action, context, result);
            return result;

        } catch (error) {
            logger.error('Dynamic permission check error:', error);

            const result: DynamicPermissionResult = {
                allowed: false,
                reason: 'Permission check failed due to system error',
                source: 'none'
            };

            await this.auditPermissionCheck(user, action, context, result);
            return result;
        } finally {
            // Record performance metrics
            const executionTime = Date.now() - startTime;
            if (this.dbOptimizationService) {
                this.dbOptimizationService.recordQueryMetrics({
                    query: `checkPermission:${action}`,
                    executionTime,
                    documentsExamined: 0, // Would need to be tracked per query
                    documentsReturned: 1,
                    indexUsed: true, // Assume cache hit or optimized query
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * Resolve complete list of user permissions from all sources
     */
    public async resolveUserPermissions(
        user: IUser,
        context: WorkspaceContext,
        permissionContext: PermissionContext = {}
    ): Promise<{
        permissions: string[];
        sources: Record<string, string>;
        deniedPermissions: string[];
    }> {
        try {
            // Check cache first
            const cachedPermissions = await this.cacheManager.getCachedUserPermissions(
                user._id,
                context.workspace?._id
            );

            if (cachedPermissions) {
                logger.debug(`Cache hit for user permissions: ${user._id}`);
                return {
                    permissions: cachedPermissions.permissions,
                    sources: cachedPermissions.sources,
                    deniedPermissions: cachedPermissions.deniedPermissions
                };
            }
            const allPermissions = new Set<string>();
            const permissionSources: Record<string, string> = {};
            const deniedPermissions = new Set<string>();

            // 1. Super admin gets all permissions
            if (user.role === 'super_admin') {
                const allSystemPermissions = await Permission.find({ isActive: true }).select('action');
                allSystemPermissions.forEach(perm => {
                    allPermissions.add(perm.action);
                    permissionSources[perm.action] = 'super_admin';
                });

                return {
                    permissions: Array.from(allPermissions),
                    sources: permissionSources,
                    deniedPermissions: []
                };
            }

            // 2. Add legacy permissions for backward compatibility
            if (user.permissions && user.permissions.length > 0) {
                user.permissions.forEach(permission => {
                    allPermissions.add(permission);
                    permissionSources[permission] = 'legacy';
                });
            }

            // 3. Add direct permissions
            if (user.directPermissions && user.directPermissions.length > 0) {
                user.directPermissions.forEach(permission => {
                    allPermissions.add(permission);
                    permissionSources[permission] = 'direct_permission';
                });
            }

            // 4. Get permissions from roles with hierarchy
            const rolePermissions = await this.getAllRolePermissions(
                user,
                context,
                permissionContext
            );

            rolePermissions.forEach(({ permission, source, roleId, roleName }) => {
                allPermissions.add(permission);
                permissionSources[permission] = source;
            });

            // 5. Remove denied permissions (highest precedence)
            if (user.deniedPermissions && user.deniedPermissions.length > 0) {
                user.deniedPermissions.forEach(permission => {
                    allPermissions.delete(permission);
                    deniedPermissions.add(permission);
                    delete permissionSources[permission];
                });
            }

            const result = {
                permissions: Array.from(allPermissions),
                sources: permissionSources,
                deniedPermissions: Array.from(deniedPermissions)
            };

            // Cache the resolved permissions
            await this.cacheManager.cacheUserPermissions(
                user._id,
                result.permissions,
                result.sources,
                result.deniedPermissions,
                context.workspace?._id,
                this.CACHE_TTL / 1000
            );

            return result;

        } catch (error) {
            logger.error('Error resolving user permissions:', error);
            return {
                permissions: [],
                sources: {},
                deniedPermissions: []
            };
        }
    }

    /**
     * Resolve permissions from user's assigned roles with hierarchy
     */
    private async resolveRolePermissions(
        user: IUser,
        action: string,
        context: WorkspaceContext,
        permissionContext: PermissionContext
    ): Promise<DynamicPermissionResult> {
        try {
            // Get active user roles
            const userRoles = await UserRole.find({
                userId: user._id,
                isActive: true,
                $or: [
                    { isTemporary: false },
                    { isTemporary: true, expiresAt: { $gt: new Date() } }
                ]
            }).populate('roleId');

            // Check each role for the permission
            for (const userRole of userRoles) {
                const role = userRole.roleId as unknown as IRole;
                if (!role || !role.isActive) continue;

                // Check role permissions with conditions
                const rolePermissions = await RolePermission.find({
                    roleId: role._id,
                    permissionAction: action,
                    isActive: true
                }).sort({ priority: -1 });

                for (const rolePerm of rolePermissions) {
                    // Evaluate conditional permissions
                    const isAllowed = (rolePerm as any).evaluatePermission({
                        currentTime: permissionContext.currentTime,
                        clientIP: permissionContext.clientIP,
                        workspaceId: permissionContext.workspaceId,
                        departmentId: permissionContext.departmentId,
                        resourceId: permissionContext.resourceId
                    });

                    if (isAllowed) {
                        return {
                            allowed: rolePerm.granted,
                            source: 'role',
                            roleId: role._id,
                            roleName: role.name,
                            reason: rolePerm.granted ? undefined : 'Permission denied by role'
                        };
                    }
                }

                // Check direct role permissions (legacy support)
                if (role.permissions.includes(action)) {
                    return {
                        allowed: true,
                        source: 'role',
                        roleId: role._id,
                        roleName: role.name
                    };
                }

                // Check inherited permissions from parent roles
                const inheritedResult = await this.checkInheritedPermissions(
                    role,
                    action,
                    permissionContext
                );

                if (inheritedResult.allowed) {
                    return inheritedResult;
                }
            }

            return { allowed: false };

        } catch (error) {
            logger.error('Error resolving role permissions:', error);
            return { allowed: false, reason: 'Role permission resolution failed' };
        }
    }

    /**
     * Check permissions inherited from role hierarchy
     */
    private async checkInheritedPermissions(
        role: IRole,
        action: string,
        permissionContext: PermissionContext,
        visited: Set<string> = new Set()
    ): Promise<DynamicPermissionResult> {
        // Prevent infinite recursion
        if (visited.has(role._id.toString())) {
            return { allowed: false };
        }
        visited.add(role._id.toString());

        if (!role.parentRole) {
            return { allowed: false };
        }

        try {
            const parentRole = await Role.findById(role.parentRole);
            if (!parentRole || !parentRole.isActive) {
                return { allowed: false };
            }

            // Check parent role permissions with conditions
            const parentRolePermissions = await RolePermission.find({
                roleId: parentRole._id,
                permissionAction: action,
                isActive: true
            }).sort({ priority: -1 });

            for (const rolePerm of parentRolePermissions) {
                const isAllowed = (rolePerm as any).evaluatePermission({
                    currentTime: permissionContext.currentTime,
                    clientIP: permissionContext.clientIP,
                    workspaceId: permissionContext.workspaceId,
                    departmentId: permissionContext.departmentId,
                    resourceId: permissionContext.resourceId
                });

                if (isAllowed) {
                    return {
                        allowed: rolePerm.granted,
                        source: 'inherited',
                        roleId: parentRole._id,
                        roleName: parentRole.name,
                        inheritedFrom: role.name,
                        reason: rolePerm.granted ? undefined : 'Permission denied by parent role'
                    };
                }
            }

            // Check direct parent role permissions (legacy support)
            if (parentRole.permissions.includes(action)) {
                return {
                    allowed: true,
                    source: 'inherited',
                    roleId: parentRole._id,
                    roleName: parentRole.name,
                    inheritedFrom: role.name
                };
            }

            // Recursively check parent's parents
            return this.checkInheritedPermissions(parentRole, action, permissionContext, visited);

        } catch (error) {
            logger.error('Error checking inherited permissions:', error);
            return { allowed: false };
        }
    }

    /**
     * Get all role permissions for a user with hierarchy
     */
    private async getAllRolePermissions(
        user: IUser,
        context: WorkspaceContext,
        permissionContext: PermissionContext
    ): Promise<Array<{
        permission: string;
        source: string;
        roleId?: mongoose.Types.ObjectId;
        roleName?: string;
    }>> {
        const permissions: Array<{
            permission: string;
            source: string;
            roleId?: mongoose.Types.ObjectId;
            roleName?: string;
        }> = [];

        try {
            // Get active user roles
            const userRoles = await UserRole.find({
                userId: user._id,
                isActive: true,
                $or: [
                    { isTemporary: false },
                    { isTemporary: true, expiresAt: { $gt: new Date() } }
                ]
            }).populate('roleId');

            for (const userRole of userRoles) {
                const role = userRole.roleId as unknown as IRole;
                if (!role || !role.isActive) continue;

                // Get all permissions for this role (including inherited)
                const rolePermissions = await this.getAllPermissionsForRole(
                    role,
                    permissionContext
                );

                permissions.push(...rolePermissions);
            }

            return permissions;

        } catch (error) {
            logger.error('Error getting all role permissions:', error);
            return [];
        }
    }

    /**
     * Get all permissions for a specific role including inherited ones
     */
    private async getAllPermissionsForRole(
        role: IRole,
        permissionContext: PermissionContext,
        visited: Set<string> = new Set()
    ): Promise<Array<{
        permission: string;
        source: string;
        roleId: mongoose.Types.ObjectId;
        roleName: string;
    }>> {
        // Prevent infinite recursion
        if (visited.has(role._id.toString())) {
            return [];
        }
        visited.add(role._id.toString());

        // Check cache for role permissions
        const cachedRolePermissions = await this.cacheManager.getCachedRolePermissions(role._id);
        if (cachedRolePermissions && visited.size === 1) { // Only use cache for top-level call
            logger.debug(`Cache hit for role permissions: ${role._id}`);
            return cachedRolePermissions.permissions.map(permission => ({
                permission,
                source: 'role',
                roleId: role._id,
                roleName: role.name
            }));
        }

        const permissions: Array<{
            permission: string;
            source: string;
            roleId: mongoose.Types.ObjectId;
            roleName: string;
        }> = [];

        try {
            // Get direct role permissions from RolePermission model
            const rolePermissions = await RolePermission.find({
                roleId: role._id,
                isActive: true,
                granted: true
            });

            for (const rolePerm of rolePermissions) {
                const isAllowed = (rolePerm as any).evaluatePermission({
                    currentTime: permissionContext.currentTime,
                    clientIP: permissionContext.clientIP,
                    workspaceId: permissionContext.workspaceId,
                    departmentId: permissionContext.departmentId,
                    resourceId: permissionContext.resourceId
                });

                if (isAllowed) {
                    permissions.push({
                        permission: rolePerm.permissionAction,
                        source: 'role',
                        roleId: role._id,
                        roleName: role.name
                    });
                }
            }

            // Add legacy direct permissions from role model
            if (role.permissions && role.permissions.length > 0) {
                role.permissions.forEach(permission => {
                    permissions.push({
                        permission,
                        source: 'role',
                        roleId: role._id,
                        roleName: role.name
                    });
                });
            }

            // Get inherited permissions from parent role
            if (role.parentRole) {
                const parentRole = await Role.findById(role.parentRole);
                if (parentRole && parentRole.isActive) {
                    const inheritedPermissions = await this.getAllPermissionsForRole(
                        parentRole,
                        permissionContext,
                        visited
                    );

                    // Mark inherited permissions
                    inheritedPermissions.forEach(perm => {
                        permissions.push({
                            ...perm,
                            source: 'inherited'
                        });
                    });
                }
            }

            // Cache the role permissions if this is the top-level call
            if (visited.size === 1 && permissions.length > 0) {
                const allPermissions = permissions.map(p => p.permission);
                const inheritedPermissions = permissions
                    .filter(p => p.source === 'inherited')
                    .map(p => p.permission);

                await this.cacheManager.cacheRolePermissions(
                    role._id,
                    allPermissions,
                    inheritedPermissions,
                    role.hierarchyLevel || 0,
                    role.parentRole,
                    this.CACHE_TTL / 1000
                );
            }

            return permissions;

        } catch (error) {
            logger.error('Error getting permissions for role:', error);
            return [];
        }
    }

    /**
     * Check user status for permission eligibility
     */
    private checkUserStatus(user: IUser): PermissionResult {
        if (user.status === 'suspended') {
            return {
                allowed: false,
                reason: 'User account is suspended'
            };
        }

        if (user.status === 'pending') {
            return {
                allowed: false,
                reason: 'User account is pending activation'
            };
        }

        if (user.licenseStatus === 'rejected' &&
            ['pharmacist', 'intern_pharmacist'].includes(user.role)) {
            return {
                allowed: false,
                reason: 'License verification rejected'
            };
        }

        return { allowed: true };
    }

    /**
     * Check legacy static permissions for backward compatibility
     */
    private async checkLegacyPermission(
        user: IUser,
        action: string,
        context: WorkspaceContext
    ): Promise<PermissionResult> {
        try {
            // Import legacy PermissionService for backward compatibility
            const PermissionService = (await import('./PermissionService')).default;
            const legacyService = PermissionService.getInstance();

            return await legacyService.checkPermission(context, user, action);

        } catch (error) {
            logger.error('Error checking legacy permission:', error);
            return { allowed: false, reason: 'Legacy permission check failed' };
        }
    }

    /**
     * Get permission suggestions for denied access
     */
    public async getPermissionSuggestions(
        user: IUser,
        action: string
    ): Promise<string[]> {
        try {
            const suggestions: string[] = [];

            // Find similar permissions the user has
            const userPermissions = await this.resolveUserPermissions(
                user,
                {} as WorkspaceContext
            );

            // Extract resource and action parts
            const [resource, actionPart] = action.split(':');
            if (!resource || !actionPart) {
                return suggestions;
            }

            // Find permissions with same resource
            const sameResourcePerms = userPermissions.permissions.filter(perm =>
                perm.startsWith(`${resource}:`) && perm !== action
            );

            if (sameResourcePerms.length > 0) {
                suggestions.push(`You have other ${resource} permissions: ${sameResourcePerms.join(', ')}`);
            }

            // Find roles that have this permission
            const rolesWithPermission = await RolePermission.find({
                permissionAction: action,
                granted: true,
                isActive: true
            }).populate('roleId');

            const roleNames = rolesWithPermission
                .map(rp => (rp.roleId as unknown as IRole)?.displayName)
                .filter(Boolean)
                .slice(0, 3);

            if (roleNames.length > 0) {
                suggestions.push(`This permission is available in roles: ${roleNames.join(', ')}`);
            }

            return suggestions;

        } catch (error) {
            logger.error('Error getting permission suggestions:', error);
            return [];
        }
    }

    /**
     * Invalidate user permission cache when roles or permissions change
     */
    public async invalidateUserCache(
        userId: mongoose.Types.ObjectId,
        workspaceId?: mongoose.Types.ObjectId,
        reason: string = 'User permission change',
        initiatedBy?: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await this.cacheInvalidationService.invalidateUserPermissions(userId, {
                workspaceId,
                reason,
                initiatedBy,
                strategy: {
                    immediate: true,
                    cascade: false,
                    selective: true,
                    distributed: true
                }
            });
            logger.debug(`Invalidated permission cache for user ${userId}`);
        } catch (error) {
            logger.error('Error invalidating user cache:', error);
        }
    }

    /**
     * Invalidate role permission cache when role permissions change
     */
    public async invalidateRoleCache(
        roleId: mongoose.Types.ObjectId,
        reason: string = 'Role permission change',
        initiatedBy?: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await this.cacheInvalidationService.invalidateRolePermissions(roleId, {
                reason,
                initiatedBy,
                strategy: {
                    immediate: true,
                    cascade: true,
                    selective: true,
                    distributed: true
                }
            });
            this.roleHierarchyService.clearHierarchyCache(roleId);
            logger.debug(`Invalidated permission cache for role ${roleId}`);
        } catch (error) {
            logger.error('Error invalidating role cache:', error);
        }
    }

    /**
     * Invalidate role hierarchy cache when hierarchy changes
     */
    public async invalidateRoleHierarchyCache(
        roleId: mongoose.Types.ObjectId,
        reason: string = 'Role hierarchy change',
        initiatedBy?: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            await this.cacheInvalidationService.invalidateRoleHierarchy(roleId, {
                reason,
                initiatedBy,
                strategy: {
                    immediate: true,
                    cascade: true,
                    selective: true,
                    distributed: true
                }
            });
            logger.debug(`Invalidated hierarchy cache for role ${roleId}`);
        } catch (error) {
            logger.error('Error invalidating role hierarchy cache:', error);
        }
    }

    /**
     * Bulk update user permissions with cache invalidation
     */
    public async bulkUpdateUserPermissions(
        updates: Array<{
            userId: mongoose.Types.ObjectId;
            roleIds?: mongoose.Types.ObjectId[];
            directPermissions?: string[];
            deniedPermissions?: string[];
        }>,
        modifiedBy: mongoose.Types.ObjectId
    ): Promise<void> {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                for (const update of updates) {
                    // Update user roles
                    if (update.roleIds) {
                        await this.updateUserRoles(
                            update.userId,
                            update.roleIds,
                            modifiedBy,
                            session
                        );
                    }

                    // Update direct permissions
                    if (update.directPermissions || update.deniedPermissions) {
                        await User.findByIdAndUpdate(
                            update.userId,
                            {
                                $set: {
                                    directPermissions: update.directPermissions || [],
                                    deniedPermissions: update.deniedPermissions || [],
                                    roleLastModifiedBy: modifiedBy,
                                    roleLastModifiedAt: new Date(),
                                },
                            },
                            { session }
                        );
                    }

                    // Invalidate cache
                    await this.invalidateUserCache(update.userId);

                    // Create audit log
                    await this.auditPermissionChange({
                        userId: update.userId,
                        modifiedBy,
                        changes: update,
                        timestamp: new Date(),
                    });
                }
            });
        } finally {
            await session.endSession();
        }
    }

    /**
     * Update user roles helper method
     */
    private async updateUserRoles(
        userId: mongoose.Types.ObjectId,
        roleIds: mongoose.Types.ObjectId[],
        modifiedBy: mongoose.Types.ObjectId,
        session: any
    ): Promise<void> {
        // Remove existing active role assignments
        await UserRole.updateMany(
            { userId, isActive: true },
            {
                $set: {
                    isActive: false,
                    revokedBy: modifiedBy,
                    revokedAt: new Date(),
                    lastModifiedBy: modifiedBy
                }
            },
            { session }
        );

        // Add new role assignments
        for (const roleId of roleIds) {
            const userRole = new UserRole({
                userId,
                roleId,
                assignedBy: modifiedBy,
                lastModifiedBy: modifiedBy,
                isActive: true
            });

            await userRole.save({ session });
        }

        // Update user's assignedRoles array
        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    assignedRoles: roleIds,
                    roleLastModifiedBy: modifiedBy,
                    roleLastModifiedAt: new Date(),
                },
            },
            { session }
        );
    }

    /**
     * Audit permission changes
     */
    private async auditPermissionChange(data: {
        userId: mongoose.Types.ObjectId;
        modifiedBy: mongoose.Types.ObjectId;
        changes: any;
        timestamp: Date;
    }): Promise<void> {
        try {
            logger.info('Permission change audit', {
                userId: data.userId,
                modifiedBy: data.modifiedBy,
                changes: data.changes,
                timestamp: data.timestamp
            });
        } catch (error) {
            logger.error('Error auditing permission change:', error);
        }
    }

    /**
     * Warm cache for frequently accessed permissions
     */
    public async warmPermissionCache(options: {
        userIds?: mongoose.Types.ObjectId[];
        roleIds?: mongoose.Types.ObjectId[];
        commonActions?: string[];
        workspaceId?: mongoose.Types.ObjectId;
    }): Promise<void> {
        try {
            logger.info('Starting permission cache warming', options);

            // Warm user permissions
            if (options.userIds && options.userIds.length > 0) {
                for (const userId of options.userIds) {
                    try {
                        const user = await User.findById(userId);
                        if (user) {
                            await this.resolveUserPermissions(
                                user,
                                { workspace: options.workspaceId ? { _id: options.workspaceId } : undefined } as WorkspaceContext
                            );
                        }
                    } catch (error) {
                        logger.error(`Error warming cache for user ${userId}:`, error);
                    }
                }
            }

            // Warm role permissions
            if (options.roleIds && options.roleIds.length > 0) {
                for (const roleId of options.roleIds) {
                    try {
                        const role = await Role.findById(roleId);
                        if (role) {
                            await this.getAllPermissionsForRole(role, {
                                workspaceId: options.workspaceId,
                                currentTime: new Date()
                            });
                        }
                    } catch (error) {
                        logger.error(`Error warming cache for role ${roleId}:`, error);
                    }
                }
            }

            // Warm common permission checks
            if (options.userIds && options.commonActions && options.commonActions.length > 0) {
                for (const userId of options.userIds) {
                    const user = await User.findById(userId);
                    if (user) {
                        for (const action of options.commonActions) {
                            try {
                                await this.checkPermission(
                                    user,
                                    action,
                                    { workspace: options.workspaceId ? { _id: options.workspaceId } : undefined } as WorkspaceContext
                                );
                            } catch (error) {
                                logger.error(`Error warming cache for permission ${userId}:${action}:`, error);
                            }
                        }
                    }
                }
            }

            logger.info('Permission cache warming completed');

        } catch (error) {
            logger.error('Error warming permission cache:', error);
        }
    }

    /**
     * Get cache performance metrics
     */
    public async getCacheMetrics(): Promise<any> {
        try {
            return await this.cacheManager.getMetrics();
        } catch (error) {
            logger.error('Error getting cache metrics:', error);
            return null;
        }
    }

    /**
     * Check cache consistency and repair if needed
     */
    public async checkCacheConsistency(): Promise<{
        consistent: boolean;
        issues: string[];
        repaired: number;
    }> {
        try {
            return await this.cacheManager.checkConsistency();
        } catch (error) {
            logger.error('Error checking cache consistency:', error);
            return {
                consistent: false,
                issues: ['Error checking consistency'],
                repaired: 0
            };
        }
    }

    /**
     * Initialize database optimizations
     */
    public async initializeDatabaseOptimizations(): Promise<void> {
        try {
            await this.dbOptimizationService.createOptimizedIndexes();
            await this.dbOptimizationService.optimizeConnectionPool();
            logger.info('Database optimizations initialized successfully');
        } catch (error) {
            logger.error('Error initializing database optimizations:', error);
        }
    }

    /**
     * Get database optimization report
     */
    public async getDatabaseOptimizationReport(): Promise<any> {
        try {
            return await this.dbOptimizationService.analyzeQueryPerformance();
        } catch (error) {
            logger.error('Error getting database optimization report:', error);
            return null;
        }
    }

    /**
     * Get query performance statistics
     */
    public getQueryPerformanceStats(): any {
        try {
            return this.dbOptimizationService.getQueryStats();
        } catch (error) {
            logger.error('Error getting query performance stats:', error);
            return null;
        }
    }

    /**
     * Audit permission check for security monitoring
     */
    private async auditPermissionCheck(
        user: IUser,
        action: string,
        context: WorkspaceContext,
        result: DynamicPermissionResult
    ): Promise<void> {
        try {
            // Only audit denied permissions and super admin access
            if (!result.allowed || result.source === 'super_admin') {
                // Create a mock request object for audit logging
                const mockReq = {
                    user,
                    workspace: context.workspace,
                    ip: 'system',
                    get: () => 'DynamicPermissionService',
                    method: 'PERMISSION_CHECK',
                    originalUrl: `/permission/${action}`,
                    connection: { remoteAddress: 'system' }
                } as any;

                if (!result.allowed) {
                    await auditOperations.permissionDenied(
                        mockReq,
                        action,
                        result.reason || 'Permission denied'
                    );
                } else if (result.source === 'super_admin') {
                    // Log super admin access for security monitoring
                    logger.info('Super admin permission access', {
                        userId: user._id,
                        action,
                        source: result.source,
                        workspaceId: context.workspace?._id
                    });
                }
            }
        } catch (error) {
            logger.error('Error auditing permission check:', error);
            // Don't fail permission check due to audit error
        }
    }
}

export default DynamicPermissionService;
export { DynamicPermissionService };
