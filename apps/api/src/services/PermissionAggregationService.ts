import mongoose from 'mongoose';
import { IUser } from '../models/User';
import { IRole } from '../models/Role';
import Role from '../models/Role';
import Permission, { IPermission } from '../models/Permission';
import UserRole, { IUserRole } from '../models/UserRole';
import RolePermission, { IRolePermission } from '../models/RolePermission';
import RoleHierarchyService from './RoleHierarchyService';
import CacheManager from './CacheManager';
import logger from '../utils/logger';

export interface PermissionSource {
    type: 'direct' | 'role' | 'inherited' | 'legacy';
    roleId?: mongoose.Types.ObjectId;
    roleName?: string;
    inheritedFrom?: string;
    priority: number;
    conditions?: any;
}

export interface AggregatedPermission {
    action: string;
    granted: boolean;
    sources: PermissionSource[];
    conflicts: PermissionConflict[];
    finalDecision: 'allow' | 'deny' | 'conditional';
    conditions?: any;
}

export interface PermissionConflict {
    type: 'explicit_deny_override' | 'role_conflict' | 'dependency_missing' | 'circular_dependency';
    permission: string;
    conflictingSources: PermissionSource[];
    resolution: 'deny_wins' | 'highest_priority' | 'explicit_resolution_required';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionDependency {
    permission: string;
    dependsOn: string[];
    conflicts: string[];
    satisfied: boolean;
    missingSources: string[];
}

export interface PermissionAggregationResult {
    userId: mongoose.Types.ObjectId;
    workspaceId?: mongoose.Types.ObjectId;
    permissions: AggregatedPermission[];
    conflicts: PermissionConflict[];
    dependencies: PermissionDependency[];
    suggestions: string[];
    timestamp: Date;
}

/**
 * Service for aggregating permissions from multiple sources and resolving conflicts
 * Handles permission merging, dependency validation, and conflict resolution
 */
class PermissionAggregationService {
    private static instance: PermissionAggregationService;
    private roleHierarchyService: RoleHierarchyService;
    private cacheManager: CacheManager;

    // Priority levels for different permission sources
    private readonly PRIORITY_LEVELS = {
        EXPLICIT_DENY: 1000,      // Highest priority - explicit denials
        DIRECT_PERMISSION: 900,    // Direct user permissions
        ROLE_PERMISSION: 800,      // Role-based permissions
        INHERITED_PERMISSION: 700, // Inherited from parent roles
        LEGACY_PERMISSION: 600,    // Legacy static permissions
        DEFAULT_DENY: 0            // Lowest priority - default deny
    };

    private constructor() {
        this.roleHierarchyService = RoleHierarchyService.getInstance();
        this.cacheManager = CacheManager.getInstance();
    }

    public static getInstance(): PermissionAggregationService {
        if (!PermissionAggregationService.instance) {
            PermissionAggregationService.instance = new PermissionAggregationService();
        }
        return PermissionAggregationService.instance;
    }

    /**
     * Aggregate all permissions for a user from multiple sources
     */
    public async aggregateUserPermissions(
        user: IUser,
        workspaceId?: mongoose.Types.ObjectId
    ): Promise<PermissionAggregationResult> {
        try {
            const allPermissions = new Map<string, AggregatedPermission>();
            const conflicts: PermissionConflict[] = [];
            const dependencies: PermissionDependency[] = [];

            // 1. Collect permissions from all sources
            await this.collectDirectPermissions(user, allPermissions);
            await this.collectRolePermissions(user, workspaceId, allPermissions);
            await this.collectInheritedPermissions(user, workspaceId, allPermissions);
            await this.collectLegacyPermissions(user, allPermissions);

            // 2. Apply explicit denials (highest priority)
            this.applyExplicitDenials(user, allPermissions, conflicts);

            // 3. Resolve permission conflicts
            this.resolvePermissionConflicts(allPermissions, conflicts);

            // 4. Validate permission dependencies
            await this.validatePermissionDependencies(
                Array.from(allPermissions.values()),
                dependencies
            );

            // 5. Generate suggestions for denied permissions
            const suggestions = await this.generatePermissionSuggestions(
                user,
                Array.from(allPermissions.values()),
                conflicts
            );

            return {
                userId: user._id,
                workspaceId,
                permissions: Array.from(allPermissions.values()),
                conflicts,
                dependencies,
                suggestions,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Error aggregating user permissions:', error);
            return {
                userId: user._id,
                workspaceId,
                permissions: [],
                conflicts: [],
                dependencies: [],
                suggestions: [],
                timestamp: new Date()
            };
        }
    }

    /**
     * Collect direct user permissions
     */
    private async collectDirectPermissions(
        user: IUser,
        allPermissions: Map<string, AggregatedPermission>
    ): Promise<void> {
        if (!user.directPermissions || user.directPermissions.length === 0) {
            return;
        }

        for (const permission of user.directPermissions) {
            const source: PermissionSource = {
                type: 'direct',
                priority: this.PRIORITY_LEVELS.DIRECT_PERMISSION
            };

            this.addOrMergePermission(allPermissions, permission, true, source);
        }
    }

    /**
     * Collect role-based permissions
     */
    private async collectRolePermissions(
        user: IUser,
        workspaceId: mongoose.Types.ObjectId | undefined,
        allPermissions: Map<string, AggregatedPermission>
    ): Promise<void> {
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

                // Get role permissions from RolePermission model
                const rolePermissions = await RolePermission.find({
                    roleId: role._id,
                    isActive: true
                });

                for (const rolePerm of rolePermissions) {
                    const source: PermissionSource = {
                        type: 'role',
                        roleId: role._id,
                        roleName: role.name,
                        priority: this.PRIORITY_LEVELS.ROLE_PERMISSION,
                        conditions: rolePerm.conditions
                    };

                    this.addOrMergePermission(
                        allPermissions,
                        rolePerm.permissionAction,
                        rolePerm.granted,
                        source
                    );
                }

                // Add legacy role permissions
                if (role.permissions && role.permissions.length > 0) {
                    for (const permission of role.permissions) {
                        const source: PermissionSource = {
                            type: 'role',
                            roleId: role._id,
                            roleName: role.name,
                            priority: this.PRIORITY_LEVELS.ROLE_PERMISSION
                        };

                        this.addOrMergePermission(allPermissions, permission, true, source);
                    }
                }
            }

        } catch (error) {
            logger.error('Error collecting role permissions:', error);
        }
    }

    /**
     * Collect inherited permissions from role hierarchy
     */
    private async collectInheritedPermissions(
        user: IUser,
        workspaceId: mongoose.Types.ObjectId | undefined,
        allPermissions: Map<string, AggregatedPermission>
    ): Promise<void> {
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
                if (!role || !role.isActive || !role.parentRole) continue;

                // Get inherited permissions from role hierarchy
                const inheritanceResult = await this.roleHierarchyService.getAllRolePermissions(
                    role._id
                );

                for (const permission of inheritanceResult.permissions) {
                    const permissionSource = inheritanceResult.sources[permission];

                    if (permissionSource && permissionSource.source === 'inherited') {
                        const source: PermissionSource = {
                            type: 'inherited',
                            roleId: permissionSource.roleId,
                            roleName: permissionSource.roleName,
                            inheritedFrom: role.name,
                            priority: this.PRIORITY_LEVELS.INHERITED_PERMISSION - permissionSource.level
                        };

                        this.addOrMergePermission(allPermissions, permission, true, source);
                    }
                }
            }

        } catch (error) {
            logger.error('Error collecting inherited permissions:', error);
        }
    }

    /**
     * Collect legacy permissions for backward compatibility
     */
    private async collectLegacyPermissions(
        user: IUser,
        allPermissions: Map<string, AggregatedPermission>
    ): Promise<void> {
        if (!user.permissions || user.permissions.length === 0) {
            return;
        }

        for (const permission of user.permissions) {
            const source: PermissionSource = {
                type: 'legacy',
                priority: this.PRIORITY_LEVELS.LEGACY_PERMISSION
            };

            this.addOrMergePermission(allPermissions, permission, true, source);
        }
    }

    /**
     * Apply explicit denials with highest priority
     */
    private applyExplicitDenials(
        user: IUser,
        allPermissions: Map<string, AggregatedPermission>,
        conflicts: PermissionConflict[]
    ): void {
        if (!user.deniedPermissions || user.deniedPermissions.length === 0) {
            return;
        }

        for (const permission of user.deniedPermissions) {
            const existingPermission = allPermissions.get(permission);

            if (existingPermission && existingPermission.granted) {
                // Create conflict for explicit deny override
                const conflict: PermissionConflict = {
                    type: 'explicit_deny_override',
                    permission,
                    conflictingSources: [
                        ...existingPermission.sources,
                        {
                            type: 'direct',
                            priority: this.PRIORITY_LEVELS.EXPLICIT_DENY
                        }
                    ],
                    resolution: 'deny_wins',
                    message: `Permission '${permission}' explicitly denied, overriding granted permissions`,
                    severity: 'medium'
                };

                conflicts.push(conflict);
                existingPermission.conflicts.push(conflict);
            }

            // Apply explicit denial
            const denySource: PermissionSource = {
                type: 'direct',
                priority: this.PRIORITY_LEVELS.EXPLICIT_DENY
            };

            this.addOrMergePermission(allPermissions, permission, false, denySource);
        }
    }

    /**
     * Resolve conflicts between different permission sources
     */
    private resolvePermissionConflicts(
        allPermissions: Map<string, AggregatedPermission>,
        conflicts: PermissionConflict[]
    ): void {
        for (const [permission, aggregatedPerm] of allPermissions) {
            if (aggregatedPerm.sources.length <= 1) {
                continue; // No conflicts possible with single source
            }

            // Check for conflicting grant/deny decisions
            const grantingSources = aggregatedPerm.sources.filter(s =>
                this.isGrantingSource(aggregatedPerm, s)
            );
            const denyingSources = aggregatedPerm.sources.filter(s =>
                !this.isGrantingSource(aggregatedPerm, s)
            );

            if (grantingSources.length > 0 && denyingSources.length > 0) {
                // Resolve by highest priority (explicit deny wins)
                const highestPrioritySource = aggregatedPerm.sources.reduce((highest, current) =>
                    current.priority > highest.priority ? current : highest
                );

                const conflict: PermissionConflict = {
                    type: 'role_conflict',
                    permission,
                    conflictingSources: aggregatedPerm.sources,
                    resolution: 'highest_priority',
                    message: `Permission '${permission}' has conflicting sources, resolved by highest priority`,
                    severity: 'low'
                };

                conflicts.push(conflict);
                aggregatedPerm.conflicts.push(conflict);

                // Apply resolution
                aggregatedPerm.granted = this.isGrantingSource(aggregatedPerm, highestPrioritySource);
                aggregatedPerm.finalDecision = aggregatedPerm.granted ? 'allow' : 'deny';
            }
        }
    }

    /**
     * Validate permission dependencies
     */
    private async validatePermissionDependencies(
        permissions: AggregatedPermission[],
        dependencies: PermissionDependency[]
    ): Promise<void> {
        try {
            // Get all permission definitions with dependencies
            const permissionDefs = await Permission.find({
                isActive: true,
                $or: [
                    { dependencies: { $exists: true, $ne: [] } },
                    { conflicts: { $exists: true, $ne: [] } }
                ]
            });

            const grantedPermissions = new Set(
                permissions.filter(p => p.granted).map(p => p.action)
            );

            for (const permDef of permissionDefs) {
                if (!grantedPermissions.has(permDef.action)) {
                    continue; // Skip if permission not granted
                }

                // Check dependencies
                const missingDependencies = permDef.dependencies.filter(
                    dep => !grantedPermissions.has(dep)
                );

                if (missingDependencies.length > 0) {
                    dependencies.push({
                        permission: permDef.action,
                        dependsOn: permDef.dependencies,
                        conflicts: permDef.conflicts,
                        satisfied: false,
                        missingSources: missingDependencies
                    });
                }

                // Check conflicts
                const conflictingPermissions = permDef.conflicts.filter(
                    conflict => grantedPermissions.has(conflict)
                );

                if (conflictingPermissions.length > 0) {
                    dependencies.push({
                        permission: permDef.action,
                        dependsOn: permDef.dependencies,
                        conflicts: permDef.conflicts,
                        satisfied: false,
                        missingSources: conflictingPermissions
                    });
                }
            }

        } catch (error) {
            logger.error('Error validating permission dependencies:', error);
        }
    }

    /**
     * Generate suggestions for denied permissions
     */
    private async generatePermissionSuggestions(
        user: IUser,
        permissions: AggregatedPermission[],
        conflicts: PermissionConflict[]
    ): Promise<string[]> {
        const suggestions: string[] = [];

        try {
            const deniedPermissions = permissions.filter(p => !p.granted);

            for (const deniedPerm of deniedPermissions.slice(0, 5)) { // Limit to 5 suggestions
                // Find roles that have this permission
                const rolesWithPermission = await this.roleHierarchyService.getRolesWithPermission(
                    deniedPerm.action
                );

                if (rolesWithPermission.length > 0) {
                    const roleNames = rolesWithPermission
                        .slice(0, 3)
                        .map(r => r.role.displayName)
                        .join(', ');

                    suggestions.push(
                        `To get '${deniedPerm.action}' permission, consider assigning roles: ${roleNames}`
                    );
                }

                // Check if permission is explicitly denied
                if (user.deniedPermissions?.includes(deniedPerm.action)) {
                    suggestions.push(
                        `Permission '${deniedPerm.action}' is explicitly denied and needs to be removed from denied list`
                    );
                }
            }

            // Add conflict resolution suggestions
            for (const conflict of conflicts.slice(0, 3)) { // Limit to 3 conflict suggestions
                switch (conflict.type) {
                    case 'explicit_deny_override':
                        suggestions.push(
                            `Remove '${conflict.permission}' from denied permissions to allow access`
                        );
                        break;
                    case 'role_conflict':
                        suggestions.push(
                            `Resolve role conflict for '${conflict.permission}' by adjusting role hierarchy`
                        );
                        break;
                    case 'dependency_missing':
                        suggestions.push(
                            `Grant required dependencies for '${conflict.permission}' to enable access`
                        );
                        break;
                }
            }

        } catch (error) {
            logger.error('Error generating permission suggestions:', error);
        }

        return suggestions;
    }

    /**
     * Add or merge permission from a source
     */
    private addOrMergePermission(
        allPermissions: Map<string, AggregatedPermission>,
        permission: string,
        granted: boolean,
        source: PermissionSource
    ): void {
        const existing = allPermissions.get(permission);

        if (existing) {
            // Add source to existing permission
            existing.sources.push(source);

            // Update granted status based on highest priority source
            const highestPrioritySource = existing.sources.reduce((highest, current) =>
                current.priority > highest.priority ? current : highest
            );

            existing.granted = this.isGrantingSource(existing, highestPrioritySource);
            existing.finalDecision = existing.granted ? 'allow' : 'deny';

            // Add conditions if present
            if (source.conditions) {
                existing.conditions = { ...existing.conditions, ...source.conditions };
                existing.finalDecision = 'conditional';
            }
        } else {
            // Create new aggregated permission
            const aggregatedPerm: AggregatedPermission = {
                action: permission,
                granted,
                sources: [source],
                conflicts: [],
                finalDecision: granted ? 'allow' : 'deny',
                conditions: source.conditions
            };

            if (source.conditions) {
                aggregatedPerm.finalDecision = 'conditional';
            }

            allPermissions.set(permission, aggregatedPerm);
        }
    }

    /**
     * Determine if a source is granting permission
     */
    private isGrantingSource(permission: AggregatedPermission, source: PermissionSource): boolean {
        // Explicit denials always deny
        if (source.priority === this.PRIORITY_LEVELS.EXPLICIT_DENY) {
            return false;
        }

        // For role permissions, check if it's a granted role permission
        if (source.type === 'role' && source.roleId) {
            // This would need to be determined from the original RolePermission record
            // For now, assume role permissions are granting unless explicitly denied
            return true;
        }

        // Direct, inherited, and legacy permissions are granting by default
        return true;
    }

    /**
     * Check if user has permission after aggregation and conflict resolution
     */
    public async checkAggregatedPermission(
        user: IUser,
        action: string,
        workspaceId?: mongoose.Types.ObjectId
    ): Promise<{
        allowed: boolean;
        source: string;
        conflicts: PermissionConflict[];
        conditions?: any;
    }> {
        try {
            // Check cache first
            const cached = await this.cacheManager.getCachedPermissionCheck(
                user._id,
                action,
                workspaceId
            );

            if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
                return {
                    allowed: cached.allowed,
                    source: cached.source,
                    conflicts: [],
                    conditions: undefined
                };
            }

            // Aggregate permissions
            const aggregationResult = await this.aggregateUserPermissions(user, workspaceId);
            const permission = aggregationResult.permissions.find(p => p.action === action);

            if (!permission) {
                return {
                    allowed: false,
                    source: 'none',
                    conflicts: [],
                    conditions: undefined
                };
            }

            // Cache the result
            await this.cacheManager.cachePermissionCheck(
                user._id,
                action,
                permission.granted,
                permission.sources[0]?.type || 'unknown',
                workspaceId
            );

            return {
                allowed: permission.granted,
                source: permission.sources[0]?.type || 'unknown',
                conflicts: permission.conflicts,
                conditions: permission.conditions
            };

        } catch (error) {
            logger.error('Error checking aggregated permission:', error);
            return {
                allowed: false,
                source: 'error',
                conflicts: [],
                conditions: undefined
            };
        }
    }
}

export default PermissionAggregationService;