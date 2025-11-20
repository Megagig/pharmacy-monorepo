import express from 'express';
import { CompatibilityRequest, compatibilityAuth, legacyEndpointWrapper } from '../middlewares/compatibilityLayer';
import logger from '../utils/logger';

const router = express.Router();

/**
 * Legacy API route mappings
 * These routes maintain backward compatibility with old API endpoints
 */

// Legacy pharmacy endpoints -> workspace endpoints
router.use('/pharmacy/:pharmacyId/*', (req, res, next) => {
    const originalUrl = req.originalUrl;
    const newUrl = originalUrl.replace('/pharmacy/', '/workspace/').replace('/pharmacyId/', '/workspaceId/');

    console.log('Legacy API redirect:', originalUrl, '->', newUrl, req.method);

    // Redirect to new endpoint
    req.url = newUrl.replace('/api/legacy', '/api');
    (req.params as any).workspaceId = req.params.pharmacyId;
    next();
});

// Legacy user subscription endpoints
router.get('/user/subscription', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const user = req.user!;
        let subscription = null;
        let plan = null;

        // Check workspace subscription first (new approach)
        if (req.workplace?.currentSubscriptionId) {
            subscription = req.subscription;
            plan = req.plan;
        } else if (user.currentSubscriptionId) {
            // Fallback to user subscription (old approach)
            const Subscription = require('../models/Subscription').default;
            subscription = await Subscription.findById(user.currentSubscriptionId).populate('planId');
            plan = subscription?.planId;
        }

        return res.json({
            success: true,
            subscription: subscription ? {
                id: subscription._id,
                status: subscription.status,
                tier: subscription.tier,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                trialEndDate: subscription.trialEndDate,
                features: subscription.features,
                limits: subscription.limits,
                plan: plan ? {
                    id: plan._id,
                    name: plan.name,
                    tier: plan.tier,
                    priceNGN: plan.priceNGN,
                    features: plan.features,
                    limits: plan.limits,
                } : null,
            } : null,
            // Legacy fields
            userSubscription: subscription,
            currentPlan: plan,
        });

    } catch (error) {
        console.error('Legacy user subscription endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy user profile endpoint with workspace context
router.get('/user/profile', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const user = req.user!;

        return res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                emailVerified: user.emailVerified,
                licenseStatus: user.licenseStatus,
                features: user.features,
                permissions: user.permissions,

                // Workspace context
                workplaceId: user.workplaceId,
                workplaceRole: user.workplaceRole,
                workplace: req.workplace ? {
                    id: req.workplace._id,
                    name: req.workplace.name,
                    type: req.workplace.type,
                    subscriptionStatus: req.workplace.subscriptionStatus,
                } : null,

                // Legacy fields
                pharmacyId: user.workplaceId, // Old field name
                pharmacy: req.workplace, // Old field name
            },
            subscription: req.subscription,
            plan: req.plan,
        });

    } catch (error) {
        console.error('Legacy user profile endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy pharmacy/workspace info endpoint
router.get('/pharmacy/:pharmacyId', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const workspaceId = req.params.workspaceId || req.params.pharmacyId;

        const Workplace = require('../models/Workplace').default;
        const workplace = await Workplace.findById(workspaceId)
            .populate('ownerId', 'firstName lastName email')
            .populate('teamMembers', 'firstName lastName email role workplaceRole')
            .populate('currentSubscriptionId');

        if (!workplace) {
            return res.status(404).json({
                success: false,
                message: 'Workspace not found',
                code: 'WORKSPACE_NOT_FOUND',
            });
        }

        // Check if user has access to this workspace
        const hasAccess =
            workplace.ownerId._id.toString() === req.user!._id.toString() ||
            workplace.teamMembers.some((member: any) => member._id.toString() === req.user!._id.toString()) ||
            req.user!.role === 'super_admin';

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this workspace',
                code: 'ACCESS_DENIED',
            });
        }

        return res.json({
            success: true,
            workspace: workplace,
            // Legacy field
            pharmacy: workplace,
        });

    } catch (error) {
        console.error('Legacy pharmacy endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch workspace',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy team members endpoint
router.get('/pharmacy/:pharmacyId/team', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const workspaceId = req.params.workspaceId || req.params.pharmacyId;

        const User = require('../models/User').default;
        const teamMembers = await User.find({
            workplaceId: workspaceId,
        }).select('-passwordHash -resetToken -verificationToken');

        return res.json({
            success: true,
            teamMembers,
            // Legacy field
            pharmacyTeam: teamMembers,
        });

    } catch (error) {
        console.error('Legacy team endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch team members',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy subscription management endpoints
router.post('/user/subscription/upgrade', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const { planId } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'Plan ID is required',
                code: 'PLAN_ID_REQUIRED',
            });
        }

        // If user has workspace, upgrade workspace subscription
        if (req.workplace) {
            // Redirect to new workspace subscription endpoint
            const subscriptionController = require('../controllers/subscriptionManagementController');
            (req.params as any).workspaceId = req.workplace._id.toString();
            req.body.workspaceId = req.workplace._id;

            return await subscriptionController.upgradeWorkspaceSubscription(req, res);
        } else {
            // Handle legacy user subscription upgrade
            console.warn('Legacy user subscription upgrade attempted:', req.user!._id, planId);

            return res.status(400).json({
                success: false,
                message: 'User must be migrated to workspace-based subscription',
                code: 'MIGRATION_REQUIRED',
                migrationRequired: true,
            });
        }

    } catch (error) {
        console.error('Legacy subscription upgrade error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upgrade subscription',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy feature check endpoint
router.get('/user/features/:feature', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const { feature } = req.params;
        const user = req.user!;

        if (!feature) {
            return res.status(400).json({
                success: false,
                message: 'Feature parameter is required',
            });
        }

        // Check feature access in multiple ways for compatibility
        const hasAccess =
            user.role === 'super_admin' ||
            user.features?.includes(feature) ||
            req.subscription?.features?.includes(feature) ||
            req.subscription?.customFeatures?.includes(feature) ||
            req.plan?.features?.includes(feature);

        return res.json({
            success: true,
            feature,
            hasAccess,
            source: user.role === 'super_admin' ? 'super_admin' :
                user.features?.includes(feature) ? 'user' :
                    req.subscription?.features?.includes(feature) ? 'subscription' :
                        req.subscription?.customFeatures?.includes(feature) ? 'custom' :
                            req.plan?.features?.includes(feature) ? 'plan' : 'none',
            currentTier: req.subscription?.tier || 'free_trial',
        });

    } catch (error) {
        console.error('Legacy feature check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check feature access',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Legacy usage stats endpoint
router.get('/user/usage', compatibilityAuth, legacyEndpointWrapper(async (req: CompatibilityRequest, res) => {
    try {
        const user = req.user!;
        let usage = {};
        let limits = {};

        if (req.workplace?.stats) {
            // New workspace-based usage
            usage = {
                patients: req.workplace.stats.patientsCount,
                users: req.workplace.stats.usersCount,
                storage: req.workplace.stats.storageUsed || 0,
                apiCalls: req.workplace.stats.apiCallsThisMonth || 0,
            };
        }

        if (req.subscription?.limits) {
            limits = req.subscription.limits;
        } else if (req.plan?.limits) {
            limits = req.plan.limits;
        }

        return res.json({
            success: true,
            usage,
            limits,
            // Legacy fields
            userUsage: usage,
            planLimits: limits,
        });

    } catch (error) {
        console.error('Legacy usage stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch usage statistics',
            error: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
}));

// Health check endpoint for legacy API
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Legacy API compatibility layer is active',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

export default router;