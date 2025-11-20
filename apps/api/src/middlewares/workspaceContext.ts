import { Response, NextFunction } from 'express';
import { AuthRequest, WorkspaceContext, PlanLimits } from '../types/auth';
import Workplace, { IWorkplace } from '../models/Workplace';
import Subscription, { ISubscription } from '../models/Subscription';
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan';
import PricingPlan, { IPricingPlan } from '../models/PricingPlan';
import logger from '../utils/logger';

// In-memory cache for workspace context
interface CacheEntry {
    context: WorkspaceContext;
    timestamp: number;
    userId: string;
}

class WorkspaceContextCache {
    private cache = new Map<string, CacheEntry>();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    get(userId: string): WorkspaceContext | null {
        const entry = this.cache.get(userId);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > this.CACHE_DURATION) {
            this.cache.delete(userId);
            return null;
        }

        return entry.context;
    }

    set(userId: string, context: WorkspaceContext): void {
        this.cache.set(userId, {
            context,
            timestamp: Date.now(),
            userId,
        });
    }

    clear(userId?: string): void {
        if (userId) {
            this.cache.delete(userId);
        } else {
            this.cache.clear();
        }
    }

    // Clean expired entries periodically
    cleanup(): void {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        for (const [key, entry] of entries) {
            if (now - entry.timestamp > this.CACHE_DURATION) {
                this.cache.delete(key);
            }
        }
    }
}

const workspaceCache = new WorkspaceContextCache();

// Clean cache every 10 minutes
setInterval(() => {
    workspaceCache.cleanup();
}, 10 * 60 * 1000);

/**
 * Load workspace context for authenticated user
 * Attaches workspace, subscription, and plan information to request
 */
export const loadWorkspaceContext = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            logger.warn('loadWorkspaceContext called without authenticated user');
            return next();
        }

        // Super admin gets unlimited access context
        if (req.user.role === 'super_admin') {
            req.workspaceContext = {
                workspace: null, // Super admin can access any workspace
                subscription: null,
                plan: null,
                permissions: ['*'], // All permissions
                limits: {
                    patients: null, // Unlimited
                    users: null,
                    locations: null,
                    storage: null,
                    apiCalls: null,
                },
                isTrialExpired: false,
                isSubscriptionActive: true,
            };
            return next();
        }

        const userId = req.user._id.toString();

        // Try to get from cache first
        const cachedContext = workspaceCache.get(userId);
        if (cachedContext) {
            req.workspaceContext = cachedContext;
            return next();
        }

        // Load workspace context from database
        const context = await loadUserWorkspaceContext(req.user._id);

        // Cache the context
        workspaceCache.set(userId, context);

        // Attach to request
        req.workspaceContext = context;

        next();
    } catch (error) {
        logger.error('Error loading workspace context:', error);

        // Don't fail the request, just log the error and continue
        // Set empty context to prevent undefined errors
        req.workspaceContext = {
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
            },
            isTrialExpired: false,
            isSubscriptionActive: false,
        };

        next();
    }
};

/**
 * Load workspace context from database
 */
async function loadUserWorkspaceContext(userId: any): Promise<WorkspaceContext> {
    let workspace: IWorkplace | null = null;
    let subscription: ISubscription | null = null;
    let plan: ISubscriptionPlan | IPricingPlan | null = null;

    try {
        // Import User model to get workplaceId
        const User = (await import('../models/User')).default;
        const user = await User.findById(userId);

        if (!user) {
            logger.warn(`User not found: ${userId}`);
            throw new Error('User not found');
        }

        // Find user's workplace using workplaceId field (primary method)
        if (user.workplaceId) {
            workspace = await Workplace.findById(user.workplaceId).populate('currentPlanId');
        }

        // Fallback: Try finding by ownerId or teamMembers (for backwards compatibility)
        if (!workspace) {
            workspace = await Workplace.findOne({
                $or: [
                    { ownerId: userId },
                    { teamMembers: userId }
                ]
            }).populate('currentPlanId');
        }

        if (workspace) {
            // Load workspace subscription
            subscription = await Subscription.findOne({
                workspaceId: workspace._id,
                status: { $in: ['trial', 'active', 'past_due', 'expired'] }
            }).populate('planId');

            // Get plan from subscription or workspace
            // Note: subscription.planId references PricingPlan model
            if (subscription && subscription.planId) {
                plan = subscription.planId as unknown as IPricingPlan;
            } else if (workspace.currentPlanId) {
                // Fallback: workspace.currentPlanId might reference SubscriptionPlan
                plan = await SubscriptionPlan.findById(workspace.currentPlanId);
            }
        }

        // Determine subscription status
        const isTrialExpired = checkTrialExpired(workspace, subscription);
        const isSubscriptionActive = checkSubscriptionActive(subscription);

        // Build limits based on plan type
        const limits: PlanLimits = plan ?
            ('features' in plan && typeof plan.features === 'object' && !Array.isArray(plan.features)) ? {
                // SubscriptionPlan has features as object with boolean properties
                patients: (plan as ISubscriptionPlan).features?.patientLimit || null,
                users: (plan as ISubscriptionPlan).features?.teamSize || null,
                locations: (plan as ISubscriptionPlan).features?.multiLocationDashboard ? null : 1,
                storage: null,
                apiCalls: (plan as ISubscriptionPlan).features?.apiAccess ? null : 0,
            } : {
                // PricingPlan has features as string array - use defaults
                patients: null,
                users: null,
                locations: null,
                storage: null,
                apiCalls: null,
            }
            : {
                patients: null,
                users: null,
                locations: null,
                storage: null,
                apiCalls: null,
            };

        // Build permissions array from plan features
        const permissions: string[] = [];
        if (plan?.features) {
            if (Array.isArray(plan.features)) {
                // PricingPlan: features is string[] - use directly
                permissions.push(...plan.features);
            } else if (typeof plan.features === 'object') {
                // SubscriptionPlan: features is object with booleans - convert to strings
                Object.entries(plan.features).forEach(([key, value]) => {
                    if (value === true) {
                        permissions.push(key);
                    }
                });
            }
        }

        // Also add tier-based features from permission matrix
        if (subscription?.tier || plan?.tier) {
            const tier = subscription?.tier || plan?.tier;
            const { TIER_FEATURES } = await import('../config/permissionMatrix');
            const tierFeatures = TIER_FEATURES[tier as keyof typeof TIER_FEATURES];
            if (tierFeatures) {
                tierFeatures.forEach(feature => {
                    if (!permissions.includes(feature)) {
                        permissions.push(feature);
                    }
                });
            }
        }

        // Debug logging for development
        if (process.env.NODE_ENV === 'development') {
            logger.info('Workspace context loaded:', {
                userId,
                workspaceId: workspace?._id,
                subscriptionTier: subscription?.tier,
                planId: plan?._id,
                planType: plan ? (Array.isArray(plan.features) ? 'PricingPlan' : 'SubscriptionPlan') : 'none',
                permissionsCount: permissions.length,
                hasAiDiagnostics: permissions.includes('ai_diagnostics'),
                firstFivePermissions: permissions.slice(0, 5),
            });
        }

        return {
            workspace,
            subscription,
            plan,
            permissions,
            limits,
            isTrialExpired,
            isSubscriptionActive,
        };

    } catch (error) {
        logger.error('Error loading workspace context from database:', error);

        return {
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
            },
            isTrialExpired: false,
            isSubscriptionActive: false,
        };
    }
}

/**
 * Check if trial period has expired
 */
function checkTrialExpired(workspace: IWorkplace | null, subscription: ISubscription | null): boolean {
    if (!workspace) return false;

    const now = new Date();

    // Check workspace trial
    if (workspace.trialEndDate && now > workspace.trialEndDate) {
        return true;
    }

    // Check subscription trial
    if (subscription?.trialEndDate && now > subscription.trialEndDate) {
        return true;
    }

    return false;
}

/**
 * Check if subscription is active
 */
function checkSubscriptionActive(subscription: ISubscription | null): boolean {
    if (!subscription) return false;

    const activeStatuses = ['trial', 'active'];
    return activeStatuses.includes(subscription.status);
}

/**
 * Clear workspace context cache for a user
 * Useful when workspace data changes
 */
export const clearWorkspaceCache = (userId?: string): void => {
    workspaceCache.clear(userId);
};

/**
 * Middleware that requires workspace context to be loaded
 * Use this after loadWorkspaceContext to ensure context exists
 */
export const requireWorkspaceContext = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.workspaceContext) {
        res.status(500).json({
            success: false,
            message: 'Workspace context not loaded. Ensure loadWorkspaceContext middleware is used first.',
        });
        return;
    }

    next();
};

/**
 * Middleware that requires user to have a workspace
 */
export const requireWorkspace = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.workspaceContext?.workspace) {
        res.status(403).json({
            success: false,
            message: 'Access denied. User must be associated with a workspace.',
            requiresAction: 'workspace_creation',
        });
        return;
    }

    next();
};

/**
 * Middleware that requires active subscription
 */
export const requireActiveSubscription = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const context = req.workspaceContext;

    if (!context?.isSubscriptionActive) {
        res.status(402).json({
            success: false,
            message: 'Active subscription required.',
            subscriptionStatus: context?.subscription?.status || 'none',
            isTrialExpired: context?.isTrialExpired || false,
            requiresAction: 'subscription_upgrade',
            upgradeRequired: true,
        });
        return;
    }

    next();
};

export default {
    loadWorkspaceContext,
    requireWorkspaceContext,
    requireWorkspace,
    requireActiveSubscription,
    clearWorkspaceCache,
};