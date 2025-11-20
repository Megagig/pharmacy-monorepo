import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Workplace, { IWorkplace } from '../models/Workplace';
import Subscription, { ISubscription } from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import logger from '../utils/logger';

// Extended request interface for backward compatibility
export interface CompatibilityRequest extends Request {
    user?: IUser;
    subscription?: ISubscription | null;
    workplace?: IWorkplace | null;
    plan?: any;

    // Legacy fields for backward compatibility
    pharmacy?: IWorkplace; // Old field name
    userSubscription?: ISubscription; // Old field name
}

/**
 * Compatibility middleware that handles both old user-based and new workspace-based authentication
 * This ensures existing API endpoints continue to work during the transition period
 */
export const compatibilityAuth = async (
    req: CompatibilityRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get token from various sources for maximum compatibility
        const token =
            req.cookies.accessToken ||
            req.cookies.token ||
            req.header('Authorization')?.replace('Bearer ', '') ||
            req.header('x-auth-token');

        if (!token) {
            logger.debug('Compatibility auth - No token provided', {
                url: req.url,
                method: req.method,
            });
            res.status(401).json({
                message: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
            return;
        }

        // Verify and decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId?: string;
            id?: string; // Support old token format
            workspaceId?: string; // New workspace-based tokens
        };

        // Handle both old and new token formats
        const userId = decoded.userId || decoded.id;
        if (!userId) {
            logger.warn('Compatibility auth - Invalid token format', { decoded });
            res.status(401).json({
                message: 'Invalid token format.',
                code: 'INVALID_TOKEN_FORMAT'
            });
            return;
        }

        // Load user with all necessary relationships
        const user = await User.findById(userId)
            .populate('currentPlanId')
            .populate('workplaceId')
            .select('-passwordHash');

        if (!user) {
            logger.warn('Compatibility auth - User not found', { userId });
            res.status(401).json({
                message: 'Invalid token - user not found.',
                code: 'USER_NOT_FOUND'
            });
            return;
        }

        // Check user status
        const allowedStatuses = process.env.NODE_ENV === 'development'
            ? ['active', 'license_pending', 'pending']
            : ['active', 'license_pending'];

        if (!allowedStatuses.includes(user.status)) {
            logger.info('Compatibility auth - User account not active', {
                userId: user._id,
                status: user.status,
            });
            res.status(401).json({
                message: 'Account is not active.',
                status: user.status,
                code: 'ACCOUNT_INACTIVE',
                requiresAction: getRequiredAction(user.status),
            });
            return;
        }

        // Load workspace context
        let workplace: IWorkplace | null = null;
        let subscription: ISubscription | null = null;
        let plan: any = null;

        if (user.workplaceId) {
            // New workspace-based approach
            workplace = await Workplace.findById(user.workplaceId);

            if (workplace && workplace.currentSubscriptionId) {
                subscription = await Subscription.findById(workplace.currentSubscriptionId)
                    .populate('planId');
                plan = subscription?.planId;
            }
        } else {
            // Fallback to old user-based subscription for backward compatibility
            logger.info('Compatibility auth - User has no workspace, checking user subscription', {
                userId: user._id,
            });

            subscription = await Subscription.findOne({
                userId: user._id,
                status: { $in: ['active', 'trial', 'past_due'] },
            }).populate('planId');

            if (subscription) {
                plan = subscription.planId;
            }
        }

        // Attach context to request
        req.user = user;
        req.subscription = subscription;
        req.workplace = workplace;
        req.plan = plan;

        // Legacy field mappings for backward compatibility
        req.pharmacy = workplace || undefined; // Old field name
        req.userSubscription = subscription || undefined; // Old field name

        logger.debug('Compatibility auth - Success', {
            userId: user._id,
            workplaceId: workplace?._id,
            subscriptionId: subscription?._id,
            hasWorkspace: !!workplace,
            hasSubscription: !!subscription,
        });

        next();

    } catch (error) {
        logger.error('Compatibility auth - Error', { error, url: req.url });

        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                message: 'Token expired.',
                code: 'TOKEN_EXPIRED'
            });
        } else if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                message: 'Invalid token.',
                code: 'INVALID_TOKEN'
            });
        } else {
            res.status(500).json({
                message: 'Authentication error.',
                code: 'AUTH_ERROR'
            });
        }
    }
};

/**
 * Compatibility middleware for optional authentication
 * Allows endpoints to work with or without authentication
 */
export const compatibilityAuthOptional = async (
    req: CompatibilityRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token =
            req.cookies.accessToken ||
            req.cookies.token ||
            req.header('Authorization')?.replace('Bearer ', '') ||
            req.header('x-auth-token');

        if (!token) {
            // No token provided, continue without authentication
            next();
            return;
        }

        // If token is provided, try to authenticate
        await compatibilityAuth(req, res, (error) => {
            if (error) {
                // If authentication fails, continue without authentication instead of blocking
                logger.debug('Optional auth failed, continuing without authentication', { error });
                req.user = undefined;
                req.subscription = undefined;
                req.workplace = undefined;
                req.plan = undefined;
                req.pharmacy = undefined;
                req.userSubscription = undefined;
            }
            next();
        });

    } catch (error) {
        // On any error, continue without authentication
        logger.debug('Optional auth error, continuing without authentication', { error });
        next();
    }
};

/**
 * Response transformation middleware to ensure backward compatibility
 * Adds legacy fields to API responses
 */
export const compatibilityResponse = (
    req: CompatibilityRequest,
    res: Response,
    next: NextFunction
): void => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to add compatibility fields
    res.json = function (body: any) {
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            // Add workspace context to responses for backward compatibility
            if (req.workplace && !body.pharmacy) {
                body.pharmacy = req.workplace; // Legacy field name
            }

            if (req.subscription && !body.userSubscription) {
                body.userSubscription = req.subscription; // Legacy field name
            }

            // Add user context if not present
            if (req.user && !body.user && body.success !== false) {
                body.user = {
                    id: req.user._id,
                    email: req.user.email,
                    firstName: req.user.firstName,
                    lastName: req.user.lastName,
                    role: req.user.role,
                    workplaceId: req.user.workplaceId,
                    workplaceRole: req.user.workplaceRole,
                };
            }

            // Add subscription status for frontend compatibility
            if (req.subscription) {
                body.subscriptionStatus = req.subscription.status;
                body.subscriptionTier = req.subscription.tier;
            } else if (req.workplace) {
                body.subscriptionStatus = req.workplace.subscriptionStatus;
            }
        }

        return originalJson.call(this, body);
    };

    next();
};

/**
 * Legacy endpoint wrapper that maps old API patterns to new ones
 */
export const legacyEndpointWrapper = (
    newHandler: (req: CompatibilityRequest, res: Response, next: NextFunction) => void
) => {
    return async (req: CompatibilityRequest, res: Response, next: NextFunction) => {
        try {
            // Map legacy request parameters
            if (req.params.pharmacyId && !req.params.workspaceId) {
                req.params.workspaceId = req.params.pharmacyId;
            }

            if (req.body.pharmacyId && !req.body.workspaceId) {
                req.body.workspaceId = req.body.pharmacyId;
            }

            if (req.query.pharmacyId && !req.query.workspaceId) {
                req.query.workspaceId = req.query.pharmacyId as string;
            }

            // Call the new handler
            await newHandler(req, res, next);

        } catch (error) {
            logger.error('Legacy endpoint wrapper error', { error, url: req.url });
            next(error);
        }
    };
};

/**
 * Subscription compatibility checker
 * Handles both user-based and workspace-based subscriptions
 */
export const checkSubscriptionCompatibility = (
    req: CompatibilityRequest,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({
            message: 'Authentication required.',
            code: 'AUTH_REQUIRED'
        });
        return;
    }

    // Check if user has any form of subscription (workspace or user-based)
    const hasSubscription = req.subscription || req.userSubscription;

    if (!hasSubscription) {
        // For backward compatibility, allow access but include warning
        logger.warn('User has no subscription', {
            userId: req.user._id,
            workplaceId: req.workplace?._id,
        });

        // Add subscription warning to response
        const originalJson = res.json;
        res.json = function (body: any) {
            if (body && typeof body === 'object') {
                body.subscriptionWarning = {
                    message: 'No active subscription found',
                    code: 'NO_SUBSCRIPTION',
                    upgradeRequired: true,
                };
            }
            return originalJson.call(this, body);
        };
    }

    next();
};

/**
 * Feature access compatibility checker
 * Handles both old and new feature checking patterns
 */
export const checkFeatureCompatibility = (featureKey: string) => {
    return (req: CompatibilityRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                message: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        // Super admin bypass
        if (req.user.role === 'super_admin') {
            next();
            return;
        }

        // Check feature access in multiple ways for compatibility
        const hasFeatureAccess =
            // New workspace-based subscription features
            (req.subscription?.features?.includes(featureKey)) ||
            (req.subscription?.customFeatures?.includes(featureKey)) ||
            // Old user-based features
            (req.user.features?.includes(featureKey)) ||
            // Plan-based features (if plan is loaded)
            (req.plan?.features?.includes(featureKey));

        if (!hasFeatureAccess) {
            res.status(403).json({
                message: `Feature '${featureKey}' not available in your current plan.`,
                feature: featureKey,
                code: 'FEATURE_NOT_AVAILABLE',
                upgradeRequired: true,
                currentTier: req.subscription?.tier || 'unknown',
            });
            return;
        }

        next();
    };
};

/**
 * Helper function to determine required action based on user status
 */
function getRequiredAction(status: string): string {
    switch (status) {
        case 'license_pending':
            return 'license_verification';
        case 'pending':
            return 'email_verification';
        case 'suspended':
            return 'account_reactivation';
        case 'license_rejected':
            return 'license_resubmission';
        default:
            return 'account_activation';
    }
}

/**
 * Migration status checker middleware
 * Helps identify which users/workspaces need migration
 */
export const migrationStatusChecker = (
    req: CompatibilityRequest,
    res: Response,
    next: NextFunction
): void => {
    if (req.user) {
        const migrationStatus = {
            userHasWorkspace: !!req.user.workplaceId,
            workspaceHasSubscription: !!(req.workplace?.currentSubscriptionId),
            hasLegacySubscription: !!(req.user.currentSubscriptionId),
            needsMigration: !req.user.workplaceId || !req.workplace?.currentSubscriptionId,
        };

        // Add migration status to response for debugging
        const originalJson = res.json;
        res.json = function (body: any) {
            if (body && typeof body === 'object' && process.env.NODE_ENV === 'development') {
                body._migrationStatus = migrationStatus;
            }
            return originalJson.call(this, body);
        };

        if (migrationStatus.needsMigration) {
            logger.info('User needs migration', {
                userId: req.user._id,
                migrationStatus,
            });
        }
    }

    next();
};

export default {
    compatibilityAuth,
    compatibilityAuthOptional,
    compatibilityResponse,
    legacyEndpointWrapper,
    checkSubscriptionCompatibility,
    checkFeatureCompatibility,
    migrationStatusChecker,
};