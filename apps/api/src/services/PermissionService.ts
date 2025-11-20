import { IUser } from '../models/User';
import { IWorkplace } from '../models/Workplace';
import { ISubscriptionPlan } from '../models/SubscriptionPlan';
import {
    AuthRequest,
    PermissionResult,
    WorkspaceContext,
    PermissionMatrix,
    UserRole,
    WorkplaceRole,
    SubscriptionTier
} from '../types/auth';
import {
    PERMISSION_MATRIX,
    ROLE_HIERARCHY,
    WORKPLACE_ROLE_HIERARCHY
} from '../config/permissionMatrix';
import logger from '../utils/logger';

class PermissionService {
    private static instance: PermissionService;
    private cachedMatrix: PermissionMatrix | null = null;
    private lastLoadTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    public static getInstance(): PermissionService {
        if (!PermissionService.instance) {
            PermissionService.instance = new PermissionService();
        }
        return PermissionService.instance;
    }

    /**
     * Check if user has permission to perform an action
     */
    public async checkPermission(
        context: WorkspaceContext,
        user: IUser,
        action: string
    ): Promise<PermissionResult> {
        try {
            // Super admin bypass (except for system-level restrictions)
            if (user.role === 'super_admin') {
                return { allowed: true };
            }

            const matrix = await this.loadPermissionMatrix();
            const permission = matrix[action];

            if (!permission) {
                logger.warn(`Permission not found for action: ${action}`);
                return {
                    allowed: false,
                    reason: 'Permission not defined',
                };
            }

            // Check user status
            const statusCheck = this.checkUserStatus(user);
            if (!statusCheck.allowed) {
                return statusCheck;
            }

            // Check system roles first (user-level permissions)
            const systemRoleCheck = this.checkSystemRoles(user, permission);
            if (!systemRoleCheck.allowed) {
                return systemRoleCheck;
            }

            // Check workplace roles (workspace-level permissions)
            const workplaceRoleCheck = this.checkWorkplaceRoles(user, permission);
            if (!workplaceRoleCheck.allowed) {
                return workplaceRoleCheck;
            }

            // Check subscription requirements
            const subscriptionCheck = this.checkSubscriptionRequirements(
                context,
                permission
            );
            if (!subscriptionCheck.allowed) {
                return subscriptionCheck;
            }

            // Check plan features
            const featureCheck = this.checkPlanFeatures(context, permission);
            if (!featureCheck.allowed) {
                return featureCheck;
            }

            // Check plan tiers
            const tierCheck = this.checkPlanTiers(context, permission);
            if (!tierCheck.allowed) {
                return tierCheck;
            }

            return { allowed: true };

        } catch (error) {
            logger.error('Error checking permission:', error);
            return {
                allowed: false,
                reason: 'Permission check failed',
            };
        }
    }

    /**
     * Resolve all permissions for a user in their workspace context
     */
    public async resolveUserPermissions(
        user: IUser,
        context: WorkspaceContext
    ): Promise<string[]> {
        const matrix = await this.loadPermissionMatrix();
        const allowedActions: string[] = [];

        for (const action of Object.keys(matrix)) {
            const result = await this.checkPermission(context, user, action);
            if (result.allowed) {
                allowedActions.push(action);
            }
        }

        return allowedActions;
    }

    /**
     * Load permission matrix (with caching)
     */
    private async loadPermissionMatrix(): Promise<PermissionMatrix> {
        const now = Date.now();

        // Return cached matrix if still valid
        if (this.cachedMatrix && (now - this.lastLoadTime) < this.CACHE_DURATION) {
            return this.cachedMatrix;
        }

        // Load from configuration file
        this.cachedMatrix = PERMISSION_MATRIX;
        this.lastLoadTime = now;

        logger.info(`Permission matrix loaded with ${Object.keys(this.cachedMatrix).length} actions`);

        return this.cachedMatrix;
    }

    /**
     * Check user status
     */
    private checkUserStatus(user: IUser): PermissionResult {
        if (user.status === 'suspended') {
            return {
                allowed: false,
                reason: 'User account is suspended',
            };
        }

        if (user.licenseStatus === 'rejected' &&
            ['pharmacist', 'intern_pharmacist'].includes(user.role)) {
            return {
                allowed: false,
                reason: 'License verification rejected',
            };
        }

        return { allowed: true };
    }

    /**
     * Check subscription requirements
     */
    private checkSubscriptionRequirements(
        context: WorkspaceContext,
        permission: PermissionMatrix[string]
    ): PermissionResult {
        if (!permission.requiresActiveSubscription) {
            return { allowed: true };
        }

        // Check if trial access is allowed
        if (permission.allowTrialAccess && context.workspace?.subscriptionStatus === 'trial') {
            // Check if trial is not expired
            if (!context.isTrialExpired) {
                return { allowed: true };
            }
        }

        // Check if subscription is active
        if (!context.isSubscriptionActive) {
            return {
                allowed: false,
                reason: 'Active subscription required',
                upgradeRequired: true,
            };
        }

        return { allowed: true };
    }

    /**
     * Check plan features
     */
    private checkPlanFeatures(
        context: WorkspaceContext,
        permission: PermissionMatrix[string]
    ): PermissionResult {
        if (!permission.features || permission.features.length === 0) {
            return { allowed: true };
        }

        const planFeatures = context.permissions || [];

        // Check if user has wildcard permission (all features)
        const hasWildcard = planFeatures.includes('*');

        const hasRequiredFeatures = hasWildcard || permission.features.every(feature =>
            planFeatures.includes(feature)
        );

        // Debug logging for development
        if (process.env.NODE_ENV === 'development' && !hasRequiredFeatures) {
            logger.warn('Plan feature check failed:', {
                requiredFeatures: permission.features,
                availableFeatures: planFeatures.length,
                hasAiDiagnostics: planFeatures.includes('ai_diagnostics'),
                firstFiveAvailable: planFeatures.slice(0, 5),
                subscriptionTier: context.subscription?.tier,
                planId: context.plan?._id,
            });
        }

        if (!hasRequiredFeatures) {
            return {
                allowed: false,
                reason: 'Required plan features not available',
                requiredFeatures: permission.features,
                upgradeRequired: true,
            };
        }

        return { allowed: true };
    }

    /**
     * Check plan tiers
     */
    private checkPlanTiers(
        context: WorkspaceContext,
        permission: PermissionMatrix[string]
    ): PermissionResult {
        if (!permission.planTiers || permission.planTiers.length === 0) {
            return { allowed: true };
        }

        const currentTier = context.plan?.tier || context.subscription?.tier;

        // Allow free_trial tier if trial access is enabled for this permission
        if (currentTier === 'free_trial' && permission.allowTrialAccess) {
            return { allowed: true };
        }

        if (!currentTier || !permission.planTiers.includes(currentTier)) {
            return {
                allowed: false,
                reason: 'Plan tier not sufficient',
                upgradeRequired: true,
            };
        }

        return { allowed: true };
    }

    /**
     * Check system roles
     */
    private checkSystemRoles(
        user: IUser,
        permission: PermissionMatrix[string]
    ): PermissionResult {
        if (!permission.systemRoles || permission.systemRoles.length === 0) {
            return { allowed: true };
        }

        const userRole = user.role as UserRole;
        const allowedRoles = ROLE_HIERARCHY[userRole] || [userRole];

        const hasRequiredRole = permission.systemRoles.some(role =>
            allowedRoles.includes(role)
        );

        if (!hasRequiredRole) {
            return {
                allowed: false,
                reason: 'Insufficient system role',
                requiredRoles: permission.systemRoles,
            };
        }

        return { allowed: true };
    }

    /**
     * Check workplace roles
     */
    private checkWorkplaceRoles(
        user: IUser,
        permission: PermissionMatrix[string]
    ): PermissionResult {
        if (!permission.workplaceRoles || permission.workplaceRoles.length === 0) {
            return { allowed: true };
        }

        const userWorkplaceRole = user.workplaceRole as WorkplaceRole;
        if (!userWorkplaceRole) {
            return {
                allowed: false,
                reason: 'No workplace role assigned',
            };
        }

        const allowedRoles = WORKPLACE_ROLE_HIERARCHY[userWorkplaceRole] || [userWorkplaceRole];

        const hasRequiredRole = permission.workplaceRoles.some(role =>
            allowedRoles.includes(role)
        );

        if (!hasRequiredRole) {
            return {
                allowed: false,
                reason: 'Insufficient workplace role',
                requiredRoles: permission.workplaceRoles,
            };
        }

        return { allowed: true };
    }

    /**
     * Refresh permission matrix cache
     */
    public async refreshCache(): Promise<void> {
        this.cachedMatrix = null;
        this.lastLoadTime = 0;
        await this.loadPermissionMatrix();
    }
}

export default PermissionService;