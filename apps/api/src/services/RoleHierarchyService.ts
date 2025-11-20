import mongoose from 'mongoose';
import Role, { IRole } from '../models/Role';
import RolePermission, { IRolePermission } from '../models/RolePermission';
import UserRole, { IUserRole } from '../models/UserRole';
import logger from '../utils/logger';

export interface RoleHierarchyNode {
    role: IRole;
    children: RoleHierarchyNode[];
    permissions: string[];
    inheritedPermissions: string[];
    level: number;
}

export interface RoleConflict {
    type: 'circular_dependency' | 'permission_conflict' | 'hierarchy_depth' | 'invalid_parent';
    roleId: mongoose.Types.ObjectId;
    conflictingRoleId?: mongoose.Types.ObjectId;
    message: string;
    severity: 'warning' | 'error' | 'critical';
}

export interface PermissionInheritanceResult {
    permissions: string[];
    sources: Record<string, {
        roleId: mongoose.Types.ObjectId;
        roleName: string;
        source: 'direct' | 'inherited';
        level: number;
    }>;
    conflicts: RoleConflict[];
}

/**
 * Service for managing role hierarchies and permission inheritance
 * Handles role relationships, circular dependency detection, and permission aggregation
 */
class RoleHierarchyService {
    private static instance: RoleHierarchyService;
    private readonly MAX_HIERARCHY_DEPTH = 10;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private hierarchyCache = new Map<string, { data: any; timestamp: number }>();

    private constructor() { }

    public static getInstance(): RoleHierarchyService {
        if (!RoleHierarchyService.instance) {
            RoleHierarchyService.instance = new RoleHierarchyService();
        }
        return RoleHierarchyService.instance;
    }

    /**
     * Get all permissions for a role including inherited ones with recursive traversal
     */
    public async getAllRolePermissions(
        roleId: mongoose.Types.ObjectId,
        visited: Set<string> = new Set()
    ): Promise<PermissionInheritanceResult> {
        try {
            // Check cache first
            const cacheKey = `role_permissions_${roleId.toString()}`;
            const cached = this.hierarchyCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
                return cached.data;
            }

            // Prevent infinite recursion
            if (visited.has(roleId.toString())) {
                return {
                    permissions: [],
                    sources: {},
                    conflicts: [{
                        type: 'circular_dependency',
                        roleId,
                        message: 'Circular dependency detected in role hierarchy',
                        severity: 'critical'
                    }]
                };
            }

            visited.add(roleId.toString());

            const role = await Role.findById(roleId);
            if (!role || !role.isActive) {
                return {
                    permissions: [],
                    sources: {},
                    conflicts: []
                };
            }

            const allPermissions = new Set<string>();
            const sources: Record<string, {
                roleId: mongoose.Types.ObjectId;
                roleName: string;
                source: 'direct' | 'inherited';
                level: number;
            }> = {};
            const conflicts: RoleConflict[] = [];

            // Get direct permissions from RolePermission model
            const rolePermissions = await RolePermission.find({
                roleId: role._id,
                isActive: true,
                granted: true
            });

            rolePermissions.forEach(rp => {
                allPermissions.add(rp.permissionAction);
                sources[rp.permissionAction] = {
                    roleId: role._id,
                    roleName: role.name,
                    source: 'direct',
                    level: role.hierarchyLevel
                };
            });

            // Add legacy direct permissions from role model
            if (role.permissions && role.permissions.length > 0) {
                role.permissions.forEach(permission => {
                    allPermissions.add(permission);
                    if (!sources[permission]) {
                        sources[permission] = {
                            roleId: role._id,
                            roleName: role.name,
                            source: 'direct',
                            level: role.hierarchyLevel
                        };
                    }
                });
            }

            // Get inherited permissions from parent role
            if (role.parentRole) {
                const parentResult = await this.getAllRolePermissions(role.parentRole, visited);

                // Add parent conflicts to our conflicts
                conflicts.push(...parentResult.conflicts);

                // Add inherited permissions
                parentResult.permissions.forEach(permission => {
                    allPermissions.add(permission);

                    // Check for permission conflicts (same permission from different sources)
                    if (sources[permission] && sources[permission].source === 'direct') {
                        // Direct permission takes precedence, but log the conflict
                        conflicts.push({
                            type: 'permission_conflict',
                            roleId: role._id,
                            conflictingRoleId: parentResult.sources[permission]?.roleId,
                            message: `Permission '${permission}' defined in both role and parent role`,
                            severity: 'warning'
                        });
                    } else if (!sources[permission]) {
                        const sourceRoleId = parentResult.sources[permission]?.roleId || role.parentRole!;
                        sources[permission] = {
                            roleId: sourceRoleId,
                            roleName: parentResult.sources[permission]?.roleName || 'Unknown',
                            source: 'inherited',
                            level: parentResult.sources[permission]?.level || role.hierarchyLevel + 1
                        };
                    }
                });
            }

            const result: PermissionInheritanceResult = {
                permissions: Array.from(allPermissions),
                sources,
                conflicts
            };

            // Cache the result
            this.hierarchyCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            logger.error('Error getting all role permissions:', error);
            return {
                permissions: [],
                sources: {},
                conflicts: [{
                    type: 'invalid_parent',
                    roleId,
                    message: 'Error retrieving role permissions',
                    severity: 'error'
                }]
            };
        }
    }

    /**
     * Detect circular dependencies in role hierarchy
     */
    public async detectCircularDependency(
        roleId: mongoose.Types.ObjectId,
        parentRoleId: mongoose.Types.ObjectId
    ): Promise<boolean> {
        try {
            const visited = new Set<string>();
            let currentRoleId: mongoose.Types.ObjectId | undefined = parentRoleId;

            while (currentRoleId) {
                const currentRoleIdStr = currentRoleId.toString();

                // Check if we've reached the original role (circular dependency)
                if (currentRoleIdStr === roleId.toString()) {
                    return true;
                }

                // Check if we've already visited this role (infinite loop)
                if (visited.has(currentRoleIdStr)) {
                    return true;
                }

                visited.add(currentRoleIdStr);

                // Get the parent of the current role
                const currentRole: IRole | null = await Role.findById(currentRoleId);
                if (!currentRole) {
                    break;
                }

                currentRoleId = currentRole.parentRole;
            }

            return false;

        } catch (error) {
            logger.error('Error detecting circular dependency:', error);
            return true; // Assume circular dependency on error for safety
        }
    }

    /**
     * Calculate hierarchy level for efficient queries
     */
    public async calculateHierarchyLevel(roleId: mongoose.Types.ObjectId): Promise<number> {
        try {
            const role = await Role.findById(roleId);
            if (!role) {
                return 0;
            }

            if (!role.parentRole) {
                return 0;
            }

            const parentLevel = await this.calculateHierarchyLevel(role.parentRole);
            return parentLevel + 1;

        } catch (error) {
            logger.error('Error calculating hierarchy level:', error);
            return 0;
        }
    }

    /**
     * Validate role hierarchy constraints
     */
    public async validateRoleHierarchy(
        roleId: mongoose.Types.ObjectId,
        parentRoleId?: mongoose.Types.ObjectId
    ): Promise<RoleConflict[]> {
        const conflicts: RoleConflict[] = [];

        try {
            const role = await Role.findById(roleId);
            if (!role) {
                conflicts.push({
                    type: 'invalid_parent',
                    roleId,
                    message: 'Role not found',
                    severity: 'error'
                });
                return conflicts;
            }

            // Check if parent role exists and is active
            if (parentRoleId) {
                const parentRole = await Role.findById(parentRoleId);
                if (!parentRole) {
                    conflicts.push({
                        type: 'invalid_parent',
                        roleId,
                        conflictingRoleId: parentRoleId,
                        message: 'Parent role not found',
                        severity: 'error'
                    });
                    return conflicts;
                }

                if (!parentRole.isActive) {
                    conflicts.push({
                        type: 'invalid_parent',
                        roleId,
                        conflictingRoleId: parentRoleId,
                        message: 'Parent role is inactive',
                        severity: 'error'
                    });
                }

                // Check for circular dependency
                const hasCircularDependency = await this.detectCircularDependency(roleId, parentRoleId);
                if (hasCircularDependency) {
                    conflicts.push({
                        type: 'circular_dependency',
                        roleId,
                        conflictingRoleId: parentRoleId,
                        message: 'Circular dependency detected',
                        severity: 'critical'
                    });
                }

                // Check hierarchy depth
                const hierarchyLevel = await this.calculateHierarchyLevel(parentRoleId);
                if (hierarchyLevel >= this.MAX_HIERARCHY_DEPTH) {
                    conflicts.push({
                        type: 'hierarchy_depth',
                        roleId,
                        conflictingRoleId: parentRoleId,
                        message: `Hierarchy depth exceeds maximum of ${this.MAX_HIERARCHY_DEPTH}`,
                        severity: 'error'
                    });
                }
            }

            return conflicts;

        } catch (error) {
            logger.error('Error validating role hierarchy:', error);
            conflicts.push({
                type: 'invalid_parent',
                roleId,
                message: 'Error validating role hierarchy',
                severity: 'error'
            });
            return conflicts;
        }
    }

    /**
     * Get complete role hierarchy tree
     */
    public async getRoleHierarchyTree(
        rootRoleId?: mongoose.Types.ObjectId
    ): Promise<RoleHierarchyNode[]> {
        try {
            let rootRoles: IRole[];

            if (rootRoleId) {
                const rootRole = await Role.findById(rootRoleId);
                rootRoles = rootRole ? [rootRole] : [];
            } else {
                // Get all root roles (roles without parents)
                rootRoles = await Role.find({
                    parentRole: { $exists: false },
                    isActive: true
                }).sort({ name: 1 });
            }

            const hierarchyNodes: RoleHierarchyNode[] = [];

            for (const rootRole of rootRoles) {
                const node = await this.buildHierarchyNode(rootRole);
                hierarchyNodes.push(node);
            }

            return hierarchyNodes;

        } catch (error) {
            logger.error('Error getting role hierarchy tree:', error);
            return [];
        }
    }

    /**
     * Build hierarchy node recursively
     */
    private async buildHierarchyNode(
        role: IRole,
        visited: Set<string> = new Set()
    ): Promise<RoleHierarchyNode> {
        // Prevent infinite recursion
        if (visited.has(role._id.toString())) {
            return {
                role,
                children: [],
                permissions: [],
                inheritedPermissions: [],
                level: role.hierarchyLevel
            };
        }

        visited.add(role._id.toString());

        // Get role permissions
        const permissionResult = await this.getAllRolePermissions(role._id, new Set());
        const directPermissions = permissionResult.permissions.filter(
            perm => permissionResult.sources[perm]?.source === 'direct'
        );
        const inheritedPermissions = permissionResult.permissions.filter(
            perm => permissionResult.sources[perm]?.source === 'inherited'
        );

        // Get child roles
        const childRoles = await Role.find({
            parentRole: role._id,
            isActive: true
        }).sort({ name: 1 });

        const children: RoleHierarchyNode[] = [];
        for (const childRole of childRoles) {
            const childNode = await this.buildHierarchyNode(childRole, visited);
            children.push(childNode);
        }

        return {
            role,
            children,
            permissions: directPermissions,
            inheritedPermissions,
            level: role.hierarchyLevel
        };
    }

    /**
     * Resolve role conflicts and provide resolution suggestions
     */
    public async resolveRoleConflicts(
        conflicts: RoleConflict[]
    ): Promise<Array<{
        conflict: RoleConflict;
        resolutions: string[];
    }>> {
        const resolutions: Array<{
            conflict: RoleConflict;
            resolutions: string[];
        }> = [];

        for (const conflict of conflicts) {
            const suggestions: string[] = [];

            switch (conflict.type) {
                case 'circular_dependency':
                    suggestions.push('Remove the parent role assignment that creates the cycle');
                    suggestions.push('Restructure the role hierarchy to eliminate circular references');
                    suggestions.push('Consider creating a new intermediate role to break the cycle');
                    break;

                case 'permission_conflict':
                    suggestions.push('Remove the duplicate permission from one of the roles');
                    suggestions.push('Use explicit permission denial to override inherited permissions');
                    suggestions.push('Restructure the role hierarchy to avoid permission conflicts');
                    break;

                case 'hierarchy_depth':
                    suggestions.push(`Flatten the role hierarchy to stay within ${this.MAX_HIERARCHY_DEPTH} levels`);
                    suggestions.push('Combine similar roles to reduce hierarchy depth');
                    suggestions.push('Create parallel role structures instead of deep nesting');
                    break;

                case 'invalid_parent':
                    suggestions.push('Select a valid, active parent role');
                    suggestions.push('Create the parent role if it doesn\'t exist');
                    suggestions.push('Remove the parent role assignment if not needed');
                    break;
            }

            resolutions.push({
                conflict,
                resolutions: suggestions
            });
        }

        return resolutions;
    }

    /**
     * Get role inheritance path from root to specified role
     */
    public async getRoleInheritancePath(
        roleId: mongoose.Types.ObjectId
    ): Promise<IRole[]> {
        try {
            const path: IRole[] = [];
            let currentRoleId: mongoose.Types.ObjectId | undefined = roleId;
            const visited = new Set<string>();

            while (currentRoleId && !visited.has(currentRoleId.toString())) {
                visited.add(currentRoleId.toString());

                const role: IRole | null = await Role.findById(currentRoleId);
                if (!role) {
                    break;
                }

                path.unshift(role);
                currentRoleId = role.parentRole;
            }

            return path;

        } catch (error) {
            logger.error('Error getting role inheritance path:', error);
            return [];
        }
    }

    /**
     * Update role hierarchy levels after hierarchy changes
     */
    public async updateHierarchyLevels(
        startingRoleId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {
            const role = await Role.findById(startingRoleId);
            if (!role) {
                return;
            }

            // Calculate new hierarchy level
            const newLevel = role.parentRole
                ? await this.calculateHierarchyLevel(role.parentRole) + 1
                : 0;

            // Update this role's level
            await Role.findByIdAndUpdate(startingRoleId, {
                hierarchyLevel: newLevel
            });

            // Recursively update child roles
            const childRoles = await Role.find({
                parentRole: startingRoleId,
                isActive: true
            });

            for (const childRole of childRoles) {
                await this.updateHierarchyLevels(childRole._id);
            }

            // Clear cache for affected roles
            this.clearHierarchyCache(startingRoleId);

        } catch (error) {
            logger.error('Error updating hierarchy levels:', error);
        }
    }

    /**
     * Clear hierarchy cache for a role and its descendants
     */
    public clearHierarchyCache(roleId?: mongoose.Types.ObjectId): void {
        if (roleId) {
            const cacheKey = `role_permissions_${roleId.toString()}`;
            this.hierarchyCache.delete(cacheKey);
        } else {
            // Clear entire cache
            this.hierarchyCache.clear();
        }
    }

    /**
     * Get roles that have a specific permission (direct or inherited)
     */
    public async getRolesWithPermission(
        permission: string
    ): Promise<Array<{
        role: IRole;
        source: 'direct' | 'inherited';
        inheritedFrom?: IRole;
    }>> {
        try {
            const rolesWithPermission: Array<{
                role: IRole;
                source: 'direct' | 'inherited';
                inheritedFrom?: IRole;
            }> = [];

            // Find roles with direct permission
            const directRolePermissions = await RolePermission.find({
                permissionAction: permission,
                granted: true,
                isActive: true
            }).populate('roleId');

            for (const rp of directRolePermissions) {
                const role = rp.roleId as unknown as IRole;
                if (role && role.isActive) {
                    rolesWithPermission.push({
                        role,
                        source: 'direct'
                    });
                }
            }

            // Find roles with legacy direct permissions
            const rolesWithLegacyPermission = await Role.find({
                permissions: permission,
                isActive: true
            });

            for (const role of rolesWithLegacyPermission) {
                // Check if already added from RolePermission
                const alreadyAdded = rolesWithPermission.some(
                    r => r.role._id.equals(role._id)
                );

                if (!alreadyAdded) {
                    rolesWithPermission.push({
                        role,
                        source: 'direct'
                    });
                }
            }

            // Find roles that inherit this permission
            const allRoles = await Role.find({ isActive: true });

            for (const role of allRoles) {
                // Skip if already found as direct
                const alreadyAdded = rolesWithPermission.some(
                    r => r.role._id.equals(role._id)
                );

                if (!alreadyAdded) {
                    const permissionResult = await this.getAllRolePermissions(role._id);

                    if (permissionResult.permissions.includes(permission)) {
                        const source = permissionResult.sources[permission];
                        if (source && source.source === 'inherited') {
                            const inheritedFromRole = await Role.findById(source.roleId);
                            rolesWithPermission.push({
                                role,
                                source: 'inherited',
                                inheritedFrom: inheritedFromRole || undefined
                            });
                        }
                    }
                }
            }

            return rolesWithPermission;

        } catch (error) {
            logger.error('Error getting roles with permission:', error);
            return [];
        }
    }
}

export default RoleHierarchyService;