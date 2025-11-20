import { Response, NextFunction } from 'express';
import {
    AuthRequest,
    PermissionResult,
    getUserRole,
    getUserWorkplaceRole,
    getUserStatus,
    getUserAssignedRoles,
    getUserCachedPermissions,
    getUserLastPermissionCheck,
    getWorkplaceId,
    hasUserRole,
    hasWorkplaceRole,
    hasUserStatus,
    hasAssignedRoles,
    hasCachedPermissions,
    hasLastPermissionCheck
} from '../types/auth';
import PermissionService from '../services/PermissionService';
import DynamicPermissionService, { DynamicPermissionResult, PermissionContext } from '../services/DynamicPermissionService';
import { auditOperations } from './auditLogging';
import logger from '../utils/logger';

// Extend AuthRequest to include permission context
declare module '../types/auth' {
    interface AuthRequest {
        permissionContext?: {
            action: string;
            source: string;
            roleId?: any;
            roleName?: string;
            inheritedFrom?: string;
        };
    }
}

/**
 * Enhanced RBAC middleware that uses dynamic permission service with database-driven permission checking
 * Provides detailed error responses, permission suggestions, and fallback to legacy checking
 */
export const requireDynamicPermission = (action: string, options: {
    enableLegacyFallback?: boolean;
    enableSuggestions?: boolean;
    enableRealTimeValidation?: boolean;
} = {}) => {
    const {
        enableLegacyFallback = true,
        enableSuggestions = true,
        enableRealTimeValidation = false
    } = options;

    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            // Super admin bypasses all permission checks - check BEFORE workspace context
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action,
                    source: 'super_admin'
                };
                return next();
            }

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded. Ensure authWithWorkspace middleware is used.',
                    code: 'WORKSPACE_CONTEXT_MISSING'
                });
                return;
            }

            // Build permission context from request
            const permissionContext: PermissionContext = {
                workspaceId: req.workspaceContext.workspace?._id,
                clientIP: req.ip || req.connection?.remoteAddress,
                currentTime: new Date()
            };

            // Get dynamic permission service instance
            const dynamicPermissionService = DynamicPermissionService.getInstance();

            // Check permission with dynamic resolution
            const result: DynamicPermissionResult = await dynamicPermissionService.checkPermission(
                req.user as any,
                action,
                req.workspaceContext,
                permissionContext
            );

            if (!result.allowed) {
                // Try legacy fallback if enabled and dynamic check failed
                if (enableLegacyFallback && result.source === 'none') {
                    logger.debug(`Dynamic permission check failed for ${action}, trying legacy fallback`);

                    const legacyPermissionService = PermissionService.getInstance();
                    const legacyResult: PermissionResult = await legacyPermissionService.checkPermission(
                        req.workspaceContext,
                        req.user as any,
                        action
                    );

                    if (legacyResult.allowed) {
                        logger.info(`Legacy permission check succeeded for ${action}`, {
                            userId: req.user._id,
                            action,
                            source: 'legacy_fallback'
                        });

                        // Attach legacy permission context
                        req.permissionContext = {
                            action,
                            source: 'legacy_fallback'
                        };

                        return next();
                    }
                }

                // Log permission denial for audit
                await auditOperations.permissionDenied(
                    req,
                    action,
                    result.reason || 'Permission denied'
                );

                const statusCode = result.upgradeRequired ? 402 : 403;
                const errorCode = result.upgradeRequired ? 'UPGRADE_REQUIRED' : 'PERMISSION_DENIED';

                // Build enhanced error response
                const errorResponse: any = {
                    success: false,
                    message: result.reason || 'Permission denied',
                    code: errorCode,
                    action,
                    source: result.source,
                    timestamp: new Date().toISOString()
                };

                // Add permission source information
                if (result.roleId && result.roleName) {
                    errorResponse.roleContext = {
                        roleId: result.roleId,
                        roleName: result.roleName,
                        inheritedFrom: result.inheritedFrom
                    };
                }

                // Add required permissions if available
                if (result.requiredPermissions && result.requiredPermissions.length > 0) {
                    errorResponse.requiredPermissions = result.requiredPermissions;
                }

                // Add upgrade information if required
                if (result.upgradeRequired) {
                    errorResponse.upgradeRequired = true;
                    errorResponse.currentPlan = req.workspaceContext.plan?.name;
                    errorResponse.subscriptionStatus = req.workspaceContext.workspace?.subscriptionStatus;
                }

                // Add permission suggestions if enabled
                if (enableSuggestions && result.suggestions && result.suggestions.length > 0) {
                    errorResponse.suggestions = result.suggestions;
                }

                // Add user context for debugging
                errorResponse.userContext = {
                    userId: req.user._id,
                    systemRole: getUserRole(req.user),
                    workplaceRole: getUserWorkplaceRole(req.user),
                    status: getUserStatus(req.user)
                };

                res.status(statusCode).json(errorResponse);
                return;
            }

            // Permission granted - attach permission metadata to request
            req.permissionContext = {
                action,
                source: result.source || 'unknown',
                roleId: result.roleId,
                roleName: result.roleName,
                inheritedFrom: result.inheritedFrom
            };

            // Log successful permission check for super admin and sensitive actions
            if (result.source === 'super_admin' || action.includes('admin') || action.includes('delete')) {
                logger.info('Sensitive permission granted', {
                    userId: req.user._id,
                    action,
                    source: result.source,
                    roleId: result.roleId,
                    roleName: result.roleName,
                    workspaceId: req.workspaceContext.workspace?._id
                });
            }

            // Real-time permission validation if enabled
            if (enableRealTimeValidation) {
                // Store permission check timestamp for session validation
                req.user.lastPermissionCheck = new Date();
            }

            next();

        } catch (error) {
            logger.error('Dynamic RBAC middleware error:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?._id,
                action,
                workspaceId: req.workspaceContext?.workspace?._id
            });

            // Try legacy fallback on system error if enabled
            if (enableLegacyFallback) {
                try {
                    logger.debug(`Dynamic permission check failed with error for ${action}, trying legacy fallback`);

                    const legacyPermissionService = PermissionService.getInstance();
                    const legacyResult: PermissionResult = await legacyPermissionService.checkPermission(
                        req.workspaceContext!,
                        req.user! as any,
                        action
                    );

                    if (legacyResult.allowed) {
                        logger.warn(`Legacy permission check succeeded after dynamic error for ${action}`, {
                            userId: req.user!._id,
                            action,
                            error: error instanceof Error ? error.message : String(error)
                        });

                        req.permissionContext = {
                            action,
                            source: 'legacy_error_fallback'
                        };

                        return next();
                    }
                } catch (legacyError) {
                    logger.error('Legacy fallback also failed:', legacyError);
                }
            }

            res.status(500).json({
                success: false,
                message: 'Permission check failed due to system error',
                code: 'PERMISSION_CHECK_ERROR',
                action,
                timestamp: new Date().toISOString()
            });
        }
    };
};

/**
 * RBAC middleware that checks if user has permission to perform an action
 */
export const requirePermission = (action: string, options: {
    useDynamicRBAC?: boolean;
    enableLegacyFallback?: boolean;
} = {}) => {
    const { useDynamicRBAC = false, enableLegacyFallback = true } = options;

    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Super admin bypasses all permission checks
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action,
                    source: 'super_admin'
                };
                return next();
            }

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded. Ensure authWithWorkspace middleware is used.',
                });
                return;
            }

            let result: PermissionResult | DynamicPermissionResult;
            let permissionSource = 'legacy';

            // Use dynamic RBAC if enabled
            if (useDynamicRBAC) {
                try {
                    const dynamicPermissionService = DynamicPermissionService.getInstance();
                    const permissionContext: PermissionContext = {
                        workspaceId: req.workspaceContext.workspace?._id,
                        clientIP: req.ip || req.connection?.remoteAddress,
                        currentTime: new Date()
                    };

                    result = await dynamicPermissionService.checkPermission(
                        req.user as any,
                        action,
                        req.workspaceContext,
                        permissionContext
                    );
                    permissionSource = (result as DynamicPermissionResult).source || 'dynamic';

                    // Attach dynamic permission context
                    if (result.allowed) {
                        req.permissionContext = {
                            action,
                            source: permissionSource,
                            roleId: (result as DynamicPermissionResult).roleId,
                            roleName: (result as DynamicPermissionResult).roleName,
                            inheritedFrom: (result as DynamicPermissionResult).inheritedFrom
                        };
                    }
                } catch (dynamicError) {
                    logger.error('Dynamic permission check failed, falling back to legacy:', dynamicError);

                    if (!enableLegacyFallback) {
                        throw dynamicError;
                    }

                    // Fall back to legacy permission service
                    const permissionService = PermissionService.getInstance();
                    result = await permissionService.checkPermission(
                        req.workspaceContext,
                        req.user as any,
                        action
                    );
                    permissionSource = 'legacy_fallback';
                }
            } else {
                // Use legacy permission service
                const permissionService = PermissionService.getInstance();
                result = await permissionService.checkPermission(
                    req.workspaceContext,
                    req.user as any,
                    action
                );
            }

            if (!result.allowed) {
                const statusCode = result.upgradeRequired ? 402 : 403;

                // Log permission denied event for audit
                await auditOperations.permissionDenied(req, action, result.reason || 'Permission denied');

                const errorResponse: any = {
                    success: false,
                    message: result.reason || 'Permission denied',
                    action,
                    requiredPermissions: result.requiredPermissions,
                    requiredRoles: result.requiredRoles,
                    requiredFeatures: result.requiredFeatures,
                    upgradeRequired: result.upgradeRequired || false,
                    userRole: getUserRole(req.user),
                    workplaceRole: getUserWorkplaceRole(req.user),
                    source: permissionSource
                };

                // Add dynamic RBAC specific information
                if (useDynamicRBAC && (result as DynamicPermissionResult).suggestions) {
                    errorResponse.suggestions = (result as DynamicPermissionResult).suggestions;
                }

                res.status(statusCode).json(errorResponse);
                return;
            }

            // Set permission context if not already set
            if (!req.permissionContext) {
                req.permissionContext = {
                    action,
                    source: permissionSource
                };
            }

            next();
        } catch (error) {
            logger.error('RBAC middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Permission check failed',
            });
        }
    };
};

export const requireRole = (...roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Super admin bypasses role checks
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action: `role:${roles.join('|')}`,
                    source: 'super_admin'
                };
                return next();
            }

            let hasRole = false;
            let matchedRole: string | undefined;
            let roleSource = 'static';

            // Check static role first (backward compatibility)
            if (userRole && roles.includes(userRole)) {
                hasRole = true;
                matchedRole = userRole;
                roleSource = 'static';
            }

            // Check dynamic role assignments if static check fails
            const userAssignedRoles = getUserAssignedRoles(req.user);
            if (!hasRole && userAssignedRoles && userAssignedRoles.length > 0) {
                try {
                    const dynamicPermissionService = DynamicPermissionService.getInstance();

                    // Get user's effective roles including inherited ones
                    const userPermissions = await dynamicPermissionService.resolveUserPermissions(
                        req.user as any,
                        req.workspaceContext || {} as any
                    );

                    // Check if user has any of the required roles through dynamic assignments
                    // This is a simplified check - in a full implementation, you'd want to
                    // query the actual role assignments and check role names
                    for (const role of roles) {
                        // Check if user has permissions that would be granted by this role
                        const rolePermissionAction = `role:${role}`;
                        if (userPermissions.permissions.includes(rolePermissionAction)) {
                            hasRole = true;
                            matchedRole = role;
                            roleSource = 'dynamic';
                            break;
                        }
                    }
                } catch (dynamicError) {
                    logger.error('Dynamic role check failed:', dynamicError);
                    // Continue with static role check result
                }
            }

            if (!hasRole) {
                // Log role denial for audit
                await auditOperations.permissionDenied(
                    req,
                    `role:${roles.join('|')}`,
                    'Insufficient role permissions'
                );

                res.status(403).json({
                    success: false,
                    message: 'Insufficient role permissions',
                    requiredRoles: roles,
                    userRole: getUserRole(req.user),
                    userAssignedRoles: getUserAssignedRoles(req.user) || [],
                    source: roleSource
                });
                return;
            }

            // Set permission context
            req.permissionContext = {
                action: `role:${matchedRole}`,
                source: roleSource
            };

            next();
        } catch (error) {
            logger.error('Role check middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Role check failed',
            });
        }
    };
};

/**
 * RBAC middleware that checks if user has any of the specified workplace roles
 * Enhanced to support dynamic role assignments from database
 */
export const requireWorkplaceRole = (...roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Super admin bypasses role checks
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action: `workplace_role:${roles.join('|')}`,
                    source: 'super_admin'
                };
                return next();
            }

            let hasWorkplaceRole = false;
            let matchedRole: string | undefined;
            let roleSource = 'static';

            // Check static workplace role first (backward compatibility)
            const userWorkplaceRole = getUserWorkplaceRole(req.user);
            if (userWorkplaceRole && roles.includes(userWorkplaceRole)) {
                hasWorkplaceRole = true;
                matchedRole = userWorkplaceRole;
                roleSource = 'static';
            }

            // Check dynamic workplace role assignments if static check fails
            if (!hasWorkplaceRole && req.workspaceContext?.workspace) {
                try {
                    const dynamicPermissionService = DynamicPermissionService.getInstance();

                    // Get user's effective permissions to check for workplace role permissions
                    const userPermissions = await dynamicPermissionService.resolveUserPermissions(
                        req.user as any,
                        req.workspaceContext
                    );

                    // Check if user has workplace role permissions through dynamic assignments
                    for (const role of roles) {
                        const workplaceRoleAction = `workplace_role:${role}`;
                        if (userPermissions.permissions.includes(workplaceRoleAction)) {
                            hasWorkplaceRole = true;
                            matchedRole = role;
                            roleSource = 'dynamic';
                            break;
                        }
                    }

                    // Alternative: Check if user has workspace-specific role assignments
                    if (!hasWorkplaceRole && req.user.assignedRoles && req.user.assignedRoles.length > 0) {
                        // Import UserRole model to check workspace-specific assignments
                        const UserRole = (await import('../models/UserRole')).default;

                        const workspaceRoles = await UserRole.find({
                            userId: req.user._id,
                            workspaceId: req.workspaceContext.workspace._id,
                            isActive: true,
                            $or: [
                                { isTemporary: false },
                                { isTemporary: true, expiresAt: { $gt: new Date() } }
                            ]
                        }).populate('roleId');

                        for (const userRole of workspaceRoles) {
                            const role = userRole.roleId as any;
                            if (role && role.category === 'workplace' && roles.includes(role.name)) {
                                hasWorkplaceRole = true;
                                matchedRole = role.name;
                                roleSource = 'dynamic_workspace';
                                break;
                            }
                        }
                    }
                } catch (dynamicError) {
                    logger.error('Dynamic workplace role check failed:', dynamicError);
                    // Continue with static role check result
                }
            }

            if (!hasWorkplaceRole) {
                // Log workplace role denial for audit
                await auditOperations.permissionDenied(
                    req,
                    `workplace_role:${roles.join('|')}`,
                    'Insufficient workplace role permissions'
                );

                res.status(403).json({
                    success: false,
                    message: 'Insufficient workplace role permissions',
                    requiredWorkplaceRoles: roles,
                    userWorkplaceRole: getUserWorkplaceRole(req.user),
                    workspaceId: req.workspaceContext?.workspace?._id,
                    source: roleSource
                });
                return;
            }

            // Set permission context
            req.permissionContext = {
                action: `workplace_role:${matchedRole}`,
                source: roleSource
            };

            next();
        } catch (error) {
            logger.error('Workplace role check middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Workplace role check failed',
            });
        }
    };
};

/**
 * RBAC middleware that checks if user's plan has specific features
 */
export const requireFeature = (...features: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        // Super admin bypasses feature checks - check BEFORE workspace context
        const userRole = getUserRole(req.user);
        if (userRole === 'super_admin') {
            return next();
        }

        if (!req.workspaceContext) {
            res.status(500).json({
                success: false,
                message: 'Workspace context not loaded',
            });
            return;
        }

        const userFeatures = req.workspaceContext.permissions || [];

        // Check if user has wildcard permission (all features)
        const hasWildcard = userFeatures.includes('*');

        const hasRequiredFeatures = hasWildcard || features.every(feature =>
            userFeatures.includes(feature)
        );

        if (!hasRequiredFeatures) {
            res.status(402).json({
                success: false,
                message: 'Required plan features not available',
                requiredFeatures: features,
                userFeatures,
                upgradeRequired: true,
            });
            return;
        }

        next();
    };
};

/**
 * RBAC middleware that checks if user's plan tier is sufficient
 */
export const requirePlanTier = (...tiers: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
            return;
        }

        // Super admin bypasses tier checks - check BEFORE workspace context
        const userRole = getUserRole(req.user);
        if (userRole === 'super_admin') {
            return next();
        }

        if (!req.workspaceContext) {
            res.status(500).json({
                success: false,
                message: 'Workspace context not loaded',
            });
            return;
        }

        const currentTier = req.workspaceContext.plan?.tier;
        if (!currentTier || !tiers.includes(currentTier)) {
            res.status(402).json({
                success: false,
                message: 'Plan tier not sufficient',
                requiredTiers: tiers,
                currentTier,
                upgradeRequired: true,
            });
            return;
        }

        next();
    };
};

/**
 * RBAC middleware that requires user to be workspace owner
 * This middleware validates that the authenticated user is the owner of their workspace
 * and attaches the workplaceId to the request for easy access in route handlers.
 * 
 * Requirements:
 * - User must be authenticated (req.user exists)
 * - User must have an associated workspace (req.workspaceContext.workspace exists)
 * - User must be the owner of the workspace (ownerId matches user._id)
 * - Super admins bypass ownership checks
 * 
 * @param req - Express request with auth context
 * @param res - Express response
 * @param next - Express next function
 */
export const requireWorkspaceOwner = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    // Check if user is authenticated
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'User not authenticated',
        });
        return;
    }

    // Super admin bypasses ownership checks
    const userRole = getUserRole(req.user);
    if (userRole === 'super_admin') {
        // For super admins, we allow access without specific workspace context
        // The workplaceId will be determined from the member being approved in the route handler
        return next();
    }

    // Check if workspace context is loaded (required for non-super-admins)
    if (!req.workspaceContext?.workspace) {
        res.status(403).json({
            success: false,
            message: 'No workspace associated with user',
            error: 'Access denied',
        });
        return;
    }

    // Verify user is the workspace owner
    const workspaceOwnerId = req.workspaceContext.workspace.ownerId;
    if (!workspaceOwnerId) {
        res.status(403).json({
            success: false,
            message: 'Workspace owner access required',
            error: 'Workspace has no owner assigned',
        });
        return;
    }

    const isOwner = workspaceOwnerId.toString() === req.user._id.toString();
    if (!isOwner) {
        res.status(403).json({
            success: false,
            message: 'Workspace owner access required',
            error: 'Only workspace owners can access this resource',
        });
        return;
    }

    // Attach workplaceId to request for easy access in route handlers
    (req as any).workplaceId = req.workspaceContext.workspace._id;

    next();
};

/**
 * RBAC middleware that requires super admin access
 */
export const requireSuperAdmin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
        return;
    }

    const userRole = getUserRole(req.user);
    if (userRole !== 'super_admin') {
        res.status(403).json({
            success: false,
            message: 'Super administrator access required',
            userRole: userRole,
        });
        return;
    }

    next();
};

/**
 * RBAC middleware that checks multiple permissions (user must have ALL)
 * Enhanced to support dynamic permission checking with fallback
 */
export const requireAllPermissions = (...actions: string[]) => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Super admin bypasses all permission checks - check BEFORE workspace context
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action: `all:${actions.join('|')}`,
                    source: 'super_admin'
                };
                return next();
            }

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded',
                });
                return;
            }

            const failedPermissions: string[] = [];
            const permissionSources: Record<string, string> = {};
            let useDynamicRBAC = true; // Feature flag - could be configurable

            // Try dynamic permission checking first
            if (useDynamicRBAC) {
                try {
                    const dynamicPermissionService = DynamicPermissionService.getInstance();
                    const permissionContext: PermissionContext = {
                        workspaceId: req.workspaceContext.workspace?._id,
                        clientIP: req.ip || req.connection?.remoteAddress,
                        currentTime: new Date()
                    };

                    for (const action of actions) {
                        const result: DynamicPermissionResult = await dynamicPermissionService.checkPermission(
                            req.user as any,
                            action,
                            req.workspaceContext,
                            permissionContext
                        );

                        if (!result.allowed) {
                            failedPermissions.push(action);
                        } else {
                            permissionSources[action] = result.source || 'dynamic';
                        }
                    }
                } catch (dynamicError) {
                    logger.error('Dynamic permission check failed, falling back to legacy:', dynamicError);
                    useDynamicRBAC = false;
                }
            }

            // Fall back to legacy permission checking if dynamic failed or disabled
            if (!useDynamicRBAC) {
                const permissionService = PermissionService.getInstance();

                for (const action of actions) {
                    const result: PermissionResult = await permissionService.checkPermission(
                        req.workspaceContext,
                        req.user as any,
                        action
                    );

                    if (!result.allowed) {
                        failedPermissions.push(action);
                    } else {
                        permissionSources[action] = 'legacy';
                    }
                }
            }

            if (failedPermissions.length > 0) {
                // Log permission denial for audit
                await auditOperations.permissionDenied(
                    req,
                    `all:${actions.join('|')}`,
                    `Failed permissions: ${failedPermissions.join(', ')}`
                );

                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                    failedPermissions,
                    requiredActions: actions,
                    permissionSources,
                    source: useDynamicRBAC ? 'dynamic' : 'legacy'
                });
                return;
            }

            // Set permission context
            req.permissionContext = {
                action: `all:${actions.join('|')}`,
                source: useDynamicRBAC ? 'dynamic' : 'legacy'
            };

            next();
        } catch (error) {
            logger.error('RBAC middleware error (requireAllPermissions):', error);
            res.status(500).json({
                success: false,
                message: 'Permission check failed',
            });
        }
    };
};

/**
 * RBAC middleware that checks multiple permissions (user must have ANY)
 * Enhanced to support dynamic permission checking with fallback
 */
export const requireAnyPermission = (...actions: string[]) => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Super admin bypasses all permission checks - check BEFORE workspace context
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                req.permissionContext = {
                    action: `any:${actions.join('|')}`,
                    source: 'super_admin'
                };
                return next();
            }

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded',
                });
                return;
            }

            let hasAnyPermission = false;
            let grantedAction: string | undefined;
            let permissionSource = 'legacy';
            let useDynamicRBAC = true; // Feature flag - could be configurable

            // Try dynamic permission checking first
            if (useDynamicRBAC) {
                try {
                    const dynamicPermissionService = DynamicPermissionService.getInstance();
                    const permissionContext: PermissionContext = {
                        workspaceId: req.workspaceContext.workspace?._id,
                        clientIP: req.ip || req.connection?.remoteAddress,
                        currentTime: new Date()
                    };

                    for (const action of actions) {
                        const result: DynamicPermissionResult = await dynamicPermissionService.checkPermission(
                            req.user as any,
                            action,
                            req.workspaceContext,
                            permissionContext
                        );

                        if (result.allowed) {
                            hasAnyPermission = true;
                            grantedAction = action;
                            permissionSource = result.source || 'dynamic';
                            break;
                        }
                    }
                } catch (dynamicError) {
                    logger.error('Dynamic permission check failed, falling back to legacy:', dynamicError);
                    useDynamicRBAC = false;
                }
            }

            // Fall back to legacy permission checking if dynamic failed or disabled
            if (!useDynamicRBAC && !hasAnyPermission) {
                const permissionService = PermissionService.getInstance();

                for (const action of actions) {
                    const result: PermissionResult = await permissionService.checkPermission(
                        req.workspaceContext,
                        req.user as any,
                        action
                    );

                    if (result.allowed) {
                        hasAnyPermission = true;
                        grantedAction = action;
                        permissionSource = 'legacy';
                        break;
                    }
                }
            }

            if (!hasAnyPermission) {
                // Log permission denial for audit
                await auditOperations.permissionDenied(
                    req,
                    `any:${actions.join('|')}`,
                    'No matching permissions found'
                );

                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions - requires any of the specified actions',
                    requiredActions: actions,
                    source: useDynamicRBAC ? 'dynamic' : 'legacy'
                });
                return;
            }

            // Set permission context
            req.permissionContext = {
                action: `any:${grantedAction}`,
                source: permissionSource
            };

            next();
        } catch (error) {
            logger.error('RBAC middleware error (requireAnyPermission):', error);
            res.status(500).json({
                success: false,
                message: 'Permission check failed',
            });
        }
    };
};

/**
 * RBAC middleware that checks if user has active subscription
 */
export const requireActiveSubscription = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
        return;
    }

    // Super admin bypasses subscription checks - check BEFORE workspace context
    const userRole = getUserRole(req.user);
    if (userRole === 'super_admin') {
        return next();
    }

    if (!req.workspaceContext) {
        res.status(500).json({
            success: false,
            message: 'Workspace context not loaded',
        });
        return;
    }

    if (!req.workspaceContext.isSubscriptionActive) {
        res.status(402).json({
            success: false,
            message: 'Active subscription required',
            upgradeRequired: true,
            subscriptionStatus: req.workspaceContext.workspace?.subscriptionStatus,
        });
        return;
    }

    next();
};

/**
 * RBAC middleware that allows trial access but requires subscription for full access
 */
export const requireSubscriptionOrTrial = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
        return;
    }

    // Super admin bypasses subscription checks - check BEFORE workspace context
    const userRole = getUserRole(req.user);
    if (userRole === 'super_admin') {
        return next();
    }

    if (!req.workspaceContext) {
        res.status(500).json({
            success: false,
            message: 'Workspace context not loaded',
        });
        return;
    }

    const isTrialActive = req.workspaceContext.workspace?.subscriptionStatus === 'trial' &&
        !req.workspaceContext.isTrialExpired;

    if (!req.workspaceContext.isSubscriptionActive && !isTrialActive) {
        res.status(402).json({
            success: false,
            message: 'Active subscription or trial required',
            upgradeRequired: true,
            subscriptionStatus: req.workspaceContext.workspace?.subscriptionStatus,
            isTrialExpired: req.workspaceContext.isTrialExpired,
        });
        return;
    }

    next();
};

/**
 * Real-time permission validation middleware
 * Validates that user's permissions haven't changed since last check
 */
export const validateSessionPermissions = (options: {
    maxSessionAge?: number; // Maximum session age in minutes
    criticalActions?: string[]; // Actions that require fresh permission check
    enableSessionInvalidation?: boolean;
} = {}) => {
    const {
        maxSessionAge = 30, // 30 minutes default
        criticalActions = [],
        enableSessionInvalidation = true
    } = options;

    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
                return;
            }

            // Super admin bypasses session validation
            const userRole = getUserRole(req.user);
            if (userRole === 'super_admin') {
                return next();
            }

            const currentTime = new Date();
            const sessionAgeMinutes = maxSessionAge;

            // Check if this is a critical action requiring fresh permission check
            const requestedAction = req.permissionContext?.action;
            const isCriticalAction = requestedAction && criticalActions.some(action =>
                requestedAction.includes(action)
            );

            // Check session age
            const lastPermissionCheck = req.user.lastPermissionCheck;
            if (lastPermissionCheck) {
                const sessionAge = (currentTime.getTime() - lastPermissionCheck.getTime()) / (1000 * 60);

                if (sessionAge > sessionAgeMinutes || isCriticalAction) {
                    logger.info('Session permission validation required', {
                        userId: req.user._id,
                        sessionAge,
                        maxAge: sessionAgeMinutes,
                        isCriticalAction,
                        action: requestedAction
                    });

                    // Validate current permissions against cached permissions
                    if (req.workspaceContext) {
                        const dynamicPermissionService = DynamicPermissionService.getInstance();

                        // Get fresh permissions from database
                        const freshPermissions = await dynamicPermissionService.resolveUserPermissions(
                            req.user as any,
                            req.workspaceContext
                        );

                        // Compare with cached permissions if available
                        if (req.user.cachedPermissions) {
                            const cachedPermissions = req.user.cachedPermissions.permissions || [];
                            const currentPermissions = freshPermissions.permissions;

                            // Check for significant permission changes
                            const removedPermissions = cachedPermissions.filter(p =>
                                !currentPermissions.includes(p)
                            );
                            const addedPermissions = currentPermissions.filter(p =>
                                !cachedPermissions.includes(p)
                            );

                            // If critical permissions were removed, invalidate session
                            if (removedPermissions.length > 0 && enableSessionInvalidation) {
                                const hasCriticalPermissionLoss = removedPermissions.some(perm =>
                                    criticalActions.some(action => perm.includes(action))
                                );

                                if (hasCriticalPermissionLoss) {
                                    logger.warn('Critical permissions removed, invalidating session', {
                                        userId: req.user._id,
                                        removedPermissions,
                                        action: requestedAction
                                    });

                                    res.status(401).json({
                                        success: false,
                                        message: 'Session invalidated due to permission changes',
                                        code: 'SESSION_INVALIDATED',
                                        removedPermissions,
                                        requiresReauth: true
                                    });
                                    return;
                                }
                            }

                            // Log permission changes for audit
                            if (removedPermissions.length > 0 || addedPermissions.length > 0) {
                                logger.info('User permissions changed during session', {
                                    userId: req.user._id,
                                    removedPermissions,
                                    addedPermissions,
                                    sessionAge
                                });
                            }
                        }

                        // Update cached permissions and last check time
                        await (req.user as any).updateOne({
                            $set: {
                                'cachedPermissions.permissions': freshPermissions.permissions,
                                'cachedPermissions.lastUpdated': currentTime,
                                'cachedPermissions.expiresAt': new Date(currentTime.getTime() + (sessionAgeMinutes * 60 * 1000)),
                                lastPermissionCheck: currentTime
                            }
                        });
                    }
                }
            } else {
                // First permission check for this session
                req.user.lastPermissionCheck = currentTime;
                await (req.user as any).save();
            }

            next();

        } catch (error) {
            logger.error('Session permission validation error:', error);

            // Don't block request on validation error, but log it
            logger.warn('Continuing request despite session validation error', {
                userId: req.user?._id,
                error: error instanceof Error ? error.message : String(error)
            });

            next();
        }
    };
};

/**
 * Middleware to handle permission change notifications
 * Notifies connected clients when their permissions change
 */
export const notifyPermissionChanges = () => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Store original response methods
            const originalSend = res.send;
            const originalJson = res.json;

            // Override response methods to detect successful permission changes
            res.send = function (body: any) {
                handlePermissionChangeResponse.call(this, req, body);
                return originalSend.call(this, body);
            };

            res.json = function (body: any) {
                handlePermissionChangeResponse.call(this, req, body);
                return originalJson.call(this, body);
            };

            next();

        } catch (error) {
            logger.error('Permission change notification middleware error:', error);
            next();
        }
    };
};

/**
 * Handle permission change response and send notifications
 */
async function handlePermissionChangeResponse(req: AuthRequest, body: any) {
    try {
        // Check if this was a successful permission-related operation
        if (body && body.success && req.method !== 'GET') {
            const isPermissionChange =
                req.originalUrl.includes('/roles') ||
                req.originalUrl.includes('/permissions') ||
                req.originalUrl.includes('/users') && (req.method === 'PUT' || req.method === 'POST');

            if (isPermissionChange && req.user) {
                // Invalidate user's permission cache
                const dynamicPermissionService = DynamicPermissionService.getInstance();
                await dynamicPermissionService.invalidateUserCache((req.user as any)._id);

                // Send real-time notification to affected users
                // This would integrate with your WebSocket/Socket.IO implementation
                logger.info('Permission change detected, cache invalidated', {
                    userId: (req.user as any)._id,
                    action: req.method,
                    url: req.originalUrl,
                    timestamp: new Date()
                });

                // TODO: Implement WebSocket notification
                // socketService.notifyPermissionChange((req.user as any)._id, {
                //     type: 'permission_change',
                //     timestamp: new Date(),
                //     affectedUser: (req.user as any)._id
                // });
            }
        }
    } catch (error) {
        logger.error('Error handling permission change response:', error);
    }
}

/**
 * Middleware for graceful handling of permission changes during request processing
 */
export const gracefulPermissionHandling = () => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            // Store permission context at request start
            const initialPermissionContext = req.permissionContext;

            // Override next function to re-validate permissions before continuing
            const originalNext = next;
            const enhancedNext = async (error?: any) => {
                if (error) {
                    return originalNext(error);
                }

                // Re-validate critical permissions before proceeding
                if (initialPermissionContext && req.user && req.workspaceContext) {
                    const criticalActions = ['delete', 'admin', 'super_admin'];
                    const isCriticalAction = criticalActions.some(action =>
                        initialPermissionContext.action.includes(action)
                    );

                    if (isCriticalAction) {
                        const dynamicPermissionService = DynamicPermissionService.getInstance();
                        const revalidationResult = await dynamicPermissionService.checkPermission(
                            req.user as any,
                            initialPermissionContext.action,
                            req.workspaceContext
                        );

                        if (!revalidationResult.allowed) {
                            logger.warn('Permission revoked during request processing', {
                                userId: req.user._id,
                                action: initialPermissionContext.action,
                                initialSource: initialPermissionContext.source,
                                revalidationResult
                            });

                            return res.status(403).json({
                                success: false,
                                message: 'Permission was revoked during request processing',
                                code: 'PERMISSION_REVOKED_DURING_REQUEST',
                                action: initialPermissionContext.action,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }

                originalNext();
            };

            // Replace next function
            (next as any) = enhancedNext;

            originalNext();

        } catch (error) {
            logger.error('Graceful permission handling error:', error);
            next(error);
        }
    };
};

export default {
    requirePermission,
    requireDynamicPermission,
    requireRole,
    requireWorkplaceRole,
    requireFeature,
    requirePlanTier,
    requireWorkspaceOwner,
    requireSuperAdmin,
    requireAllPermissions,
    requireAnyPermission,
    requireActiveSubscription,
    requireSubscriptionOrTrial,
    validateSessionPermissions,
    notifyPermissionChanges,
    gracefulPermissionHandling,
};
