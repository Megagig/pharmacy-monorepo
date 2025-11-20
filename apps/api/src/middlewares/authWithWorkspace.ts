import * as jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import Subscription from '../models/Subscription';
import { AuthRequest } from '../types/auth';
import { loadWorkspaceContext } from './workspaceContext';
import logger from '../utils/logger';

/**
 * Enhanced authentication middleware that includes workspace context loading
 * This middleware combines user authentication with workspace context loading
 */
export const authWithWorkspace = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Try to get token from httpOnly cookie first, fallback to Authorization header for API compatibility
        const token =
            req.cookies.accessToken ||
            req.cookies.token ||
            req.header('Authorization')?.replace('Bearer ', '');

        logger.debug('Enhanced auth middleware - checking token:', {
            hasAccessToken: !!req.cookies.accessToken,
            hasToken: !!req.cookies.token,
            hasAuthHeader: !!req.header('Authorization'),
            tokenExists: !!token,
            url: req.url,
            method: req.method,
        });

        if (!token) {
            logger.warn('Enhanced auth middleware - No token provided');
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId?: string;
            id?: string; // Support old token format
        };

        // Handle both old and new token formats
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId)
            .populate('currentPlanId')
            .populate('parentUserId', 'firstName lastName role')
            .populate('teamMembers', 'firstName lastName role status')
            .select('-passwordHash');

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
            return;
        }

        // Check if user account is active with enhanced status validation
        const isValidStatus = await validateUserStatus(user);
        if (!isValidStatus.valid) {
            res.status(401).json({
                success: false,
                message: isValidStatus.message,
                status: user.status,
                requiresAction: isValidStatus.requiresAction,
            });
            return;
        }

        // Attach user to request
        req.user = user;

        // Load workspace context
        await loadWorkspaceContext(req, res, async () => {
            // Handle subscription status validation
            const subscriptionValidation = await validateSubscriptionStatus(req);

            if (!subscriptionValidation.valid && subscriptionValidation.blockAccess) {
                res.status(402).json({
                    success: false,
                    message: subscriptionValidation.message,
                    subscriptionStatus: req.workspaceContext?.subscription?.status || 'none',
                    isTrialExpired: req.workspaceContext?.isTrialExpired || false,
                    requiresAction: 'subscription_upgrade',
                    upgradeRequired: true,
                });
                return;
            }

            // Set legacy subscription for backward compatibility
            if (req.workspaceContext?.subscription) {
                req.subscription = req.workspaceContext.subscription;
            } else {
                // Fallback to user-level subscription for backward compatibility
                try {
                    const legacySubscription = await Subscription.findOne({
                        userId: user._id,
                        status: { $in: ['active', 'trial', 'grace_period'] },
                    }).populate('planId');
                    req.subscription = legacySubscription;
                } catch (error) {
                    logger.error('Error loading legacy subscription:', error);
                    req.subscription = null;
                }
            }

            next();
        });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token expired.'
            });
        } else {
            logger.error('Enhanced auth middleware error:', error);
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
    }
};

/**
 * Enhanced authentication middleware that doesn't enforce subscription requirements
 * Useful for subscription management endpoints where users need access to upgrade
 */
export const authWithWorkspaceOptionalSubscription = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Try to get token from httpOnly cookie first, fallback to Authorization header for API compatibility
        const token =
            req.cookies.accessToken ||
            req.cookies.token ||
            req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId?: string;
            id?: string; // Support old token format
        };

        // Handle both old and new token formats
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId)
            .populate('currentPlanId')
            .populate('parentUserId', 'firstName lastName role')
            .populate('teamMembers', 'firstName lastName role status')
            .select('-passwordHash');

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
            return;
        }

        // Check if user account is active
        const isValidStatus = await validateUserStatus(user);
        if (!isValidStatus.valid) {
            res.status(401).json({
                success: false,
                message: isValidStatus.message,
                status: user.status,
                requiresAction: isValidStatus.requiresAction,
            });
            return;
        }

        // Attach user to request
        req.user = user;

        // Load workspace context (optional - don't block if subscription is expired)
        await loadWorkspaceContext(req, res, () => {
            // Set legacy subscription for backward compatibility (may be undefined)
            if (req.workspaceContext?.subscription) {
                req.subscription = req.workspaceContext.subscription;
            } else {
                req.subscription = undefined;
            }

            next();
        });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token expired.'
            });
        } else {
            logger.error('Enhanced auth optional subscription middleware error:', error);
            res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
    }
};

/**
 * Validate user status with enhanced checks
 */
async function validateUserStatus(user: IUser): Promise<{
    valid: boolean;
    message?: string;
    requiresAction?: string;
}> {
    // Super admin bypasses most status checks
    if (user.role === 'super_admin') {
        return { valid: true };
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
        return {
            valid: false,
            message: 'Account is suspended. Please contact support.',
            requiresAction: 'contact_support',
        };
    }

    // Check if license is rejected for roles that require license
    if (user.licenseStatus === 'rejected' && ['pharmacist', 'intern_pharmacist'].includes(user.role)) {
        return {
            valid: false,
            message: 'License verification was rejected. Please resubmit valid license information.',
            requiresAction: 'license_resubmission',
        };
    }

    // In development, allow pending users to access the system for testing
    const allowedStatuses =
        process.env.NODE_ENV === 'development'
            ? ['active', 'license_pending', 'pending']
            : ['active', 'license_pending'];

    if (!allowedStatuses.includes(user.status)) {
        return {
            valid: false,
            message: 'Account is not active.',
            requiresAction:
                user.status === 'license_pending'
                    ? 'license_verification'
                    : user.status === 'pending'
                        ? 'email_verification'
                        : 'account_activation',
        };
    }

    return { valid: true };
}

/**
 * Validate subscription status and determine if access should be blocked
 */
async function validateSubscriptionStatus(req: AuthRequest): Promise<{
    valid: boolean;
    blockAccess: boolean;
    message?: string;
}> {
    const context = req.workspaceContext;

    if (!context) {
        return {
            valid: false,
            blockAccess: false, // Don't block if context loading failed
            message: 'Unable to load workspace context.',
        };
    }

    // Super admin bypasses subscription checks
    if (req.user?.role === 'super_admin') {
        return { valid: true, blockAccess: false };
    }

    // If no workspace, user needs to create one or join one
    if (!context.workspace) {
        return {
            valid: false,
            blockAccess: false, // Allow access to create/join workspace
            message: 'User must be associated with a workspace.',
        };
    }

    // Check if trial has expired
    if (context.isTrialExpired && !context.isSubscriptionActive) {
        return {
            valid: false,
            blockAccess: true, // Block access for expired trial without active subscription
            message: 'Trial period has expired. Please upgrade to continue using the service.',
        };
    }

    // Check subscription status
    if (context.subscription) {
        const subscription = context.subscription;

        switch (subscription.status) {
            case 'trial':
            case 'active':
                return { valid: true, blockAccess: false };

            case 'past_due':
                // Allow access but with warnings
                return {
                    valid: false,
                    blockAccess: false, // Don't block, but show warnings
                    message: 'Subscription payment is past due. Please update payment method.',
                };

            case 'expired':
            case 'canceled':
                return {
                    valid: false,
                    blockAccess: true,
                    message: 'Subscription has expired. Please renew to continue using the service.',
                };

            case 'suspended':
                return {
                    valid: false,
                    blockAccess: true,
                    message: 'Subscription is suspended. Please contact support.',
                };

            default:
                return {
                    valid: false,
                    blockAccess: false,
                    message: 'Unknown subscription status.',
                };
        }
    }

    // No subscription but has workspace - might be in trial
    if (context.workspace.subscriptionStatus === 'trial') {
        return { valid: true, blockAccess: false };
    }

    return {
        valid: false,
        blockAccess: false,
        message: 'No active subscription found.',
    };
}

export default {
    authWithWorkspace,
    authWithWorkspaceOptionalSubscription,
};