import express from 'express';
import { register, updateAllMetrics } from '../utils/metrics';

const router = express.Router();

/**
 * Prometheus metrics endpoint
 * GET /metrics
 */
router.get('/', async (req, res) => {
    try {
        // Update all metrics before serving
        await updateAllMetrics();

        // Set content type for Prometheus
        res.set('Content-Type', register.contentType);

        // Return metrics
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (error) {
        console.error('Error serving metrics:', error);
        res.status(500).end('Error serving metrics');
    }
});

/**
 * Custom metrics endpoint for application-specific metrics
 * GET /custom-metrics
 */
router.get('/custom-metrics', async (req, res) => {
    try {
        const mongoose = require('mongoose');

        // Get database models
        const Workplace = mongoose.model('Workplace');
        const Subscription = mongoose.model('Subscription');
        const Invitation = mongoose.model('Invitation');
        const User = mongoose.model('User');
        const Patient = mongoose.model('Patient');

        // Collect custom metrics
        const metrics = {
            timestamp: new Date().toISOString(),

            // Subscription metrics
            subscriptions: {
                total: await Subscription.countDocuments(),
                active: await Subscription.countDocuments({ status: 'active' }),
                trial: await Subscription.countDocuments({ status: 'trial' }),
                expired: await Subscription.countDocuments({ status: 'expired' }),
                past_due: await Subscription.countDocuments({ status: 'past_due' }),
                canceled: await Subscription.countDocuments({ status: 'canceled' }),

                // By tier
                by_tier: await Subscription.aggregate([
                    {
                        $group: {
                            _id: '$tier',
                            count: { $sum: 1 },
                        },
                    },
                ]),
            },

            // Workspace metrics
            workspaces: {
                total: await Workplace.countDocuments(),
                active: await Workplace.countDocuments({
                    subscriptionStatus: { $in: ['trial', 'active'] },
                }),
                trial: await Workplace.countDocuments({ subscriptionStatus: 'trial' }),
                expired: await Workplace.countDocuments({ subscriptionStatus: 'expired' }),

                // Trial expiry in next 7 days
                trial_expiring_soon: await Workplace.countDocuments({
                    subscriptionStatus: 'trial',
                    trialEndDate: {
                        $gte: new Date(),
                        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                }),
            },

            // Invitation metrics
            invitations: {
                total: await Invitation.countDocuments(),
                active: await Invitation.countDocuments({
                    status: 'active',
                    expiresAt: { $gt: new Date() },
                }),
                expired: await Invitation.countDocuments({ status: 'expired' }),
                used: await Invitation.countDocuments({ status: 'used' }),
                canceled: await Invitation.countDocuments({ status: 'canceled' }),

                // Acceptance rate (last 30 days)
                recent_sent: await Invitation.countDocuments({
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                }),
                recent_accepted: await Invitation.countDocuments({
                    status: 'used',
                    usedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                }),

                // By role
                by_role: await Invitation.aggregate([
                    {
                        $group: {
                            _id: '$role',
                            count: { $sum: 1 },
                        },
                    },
                ]),
            },

            // User metrics
            users: {
                total: await User.countDocuments(),
                active: await User.countDocuments({ status: 'active' }),
                suspended: await User.countDocuments({ status: 'suspended' }),
                license_rejected: await User.countDocuments({ status: 'license_rejected' }),

                // By role
                by_role: await User.aggregate([
                    {
                        $group: {
                            _id: '$role',
                            count: { $sum: 1 },
                        },
                    },
                ]),

                // New users (last 30 days)
                new_users_30d: await User.countDocuments({
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                }),
            },

            // Patient metrics
            patients: {
                total: await Patient.countDocuments(),

                // New patients (last 30 days)
                new_patients_30d: await Patient.countDocuments({
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                }),

                // By workspace (top 10)
                by_workspace: await Patient.aggregate([
                    {
                        $group: {
                            _id: '$workspaceId',
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                    {
                        $lookup: {
                            from: 'workplaces',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'workspace',
                        },
                    },
                    {
                        $project: {
                            workspaceId: '$_id',
                            workspaceName: { $arrayElemAt: ['$workspace.name', 0] },
                            patientCount: '$count',
                        },
                    },
                ]),
            },

            // System metrics
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                node_version: process.version,
                environment: process.env.NODE_ENV,
            },

            // Business metrics
            business: {
                // Revenue metrics (if available)
                mrr: await calculateMRR(),
                arr: await calculateARR(),

                // Conversion metrics
                trial_to_paid_rate: await calculateTrialConversionRate(),
                churn_rate: await calculateChurnRate(),

                // Growth metrics
                workspace_growth_rate: await calculateWorkspaceGrowthRate(),
                user_growth_rate: await calculateUserGrowthRate(),
            },
        };

        res.json(metrics);
    } catch (error) {
        console.error('Error collecting custom metrics:', error);
        res.status(500).json({
            error: 'Failed to collect custom metrics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// Helper functions for business metrics
async function calculateMRR(): Promise<number> {
    try {
        const mongoose = require('mongoose');
        const Subscription = mongoose.model('Subscription');

        const activeSubscriptions = await Subscription.find({
            status: 'active',
            billingInterval: 'monthly',
        });

        return activeSubscriptions.reduce((total: number, sub: any) => total + (sub.priceAtPurchase || 0), 0);
    } catch (error) {
        console.error('Error calculating MRR:', error);
        return 0;
    }
}

async function calculateARR(): Promise<number> {
    try {
        const mrr = await calculateMRR();

        const mongoose = require('mongoose');
        const Subscription = mongoose.model('Subscription');

        const yearlySubscriptions = await Subscription.find({
            status: 'active',
            billingInterval: 'yearly',
        });

        const yearlyRevenue = yearlySubscriptions.reduce((total: number, sub: any) => total + (sub.priceAtPurchase || 0), 0);

        return (mrr * 12) + yearlyRevenue;
    } catch (error) {
        console.error('Error calculating ARR:', error);
        return 0;
    }
}

async function calculateTrialConversionRate(): Promise<number> {
    try {
        const mongoose = require('mongoose');
        const Subscription = mongoose.model('Subscription');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Count trials that started in the last 30 days
        const trialsStarted = await Subscription.countDocuments({
            status: { $in: ['trial', 'active', 'expired', 'canceled'] },
            createdAt: { $gte: thirtyDaysAgo },
        });

        // Count trials that converted to paid
        const trialsConverted = await Subscription.countDocuments({
            status: 'active',
            createdAt: { $gte: thirtyDaysAgo },
            tier: { $ne: 'free_trial' },
        });

        return trialsStarted > 0 ? (trialsConverted / trialsStarted) * 100 : 0;
    } catch (error) {
        console.error('Error calculating trial conversion rate:', error);
        return 0;
    }
}

async function calculateChurnRate(): Promise<number> {
    try {
        const mongoose = require('mongoose');
        const Subscription = mongoose.model('Subscription');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Count active subscriptions at the beginning of the period
        const activeAtStart = await Subscription.countDocuments({
            status: 'active',
            createdAt: { $lt: thirtyDaysAgo },
        });

        // Count subscriptions that churned in the last 30 days
        const churned = await Subscription.countDocuments({
            status: { $in: ['canceled', 'expired'] },
            updatedAt: { $gte: thirtyDaysAgo },
        });

        return activeAtStart > 0 ? (churned / activeAtStart) * 100 : 0;
    } catch (error) {
        console.error('Error calculating churn rate:', error);
        return 0;
    }
}

async function calculateWorkspaceGrowthRate(): Promise<number> {
    try {
        const mongoose = require('mongoose');
        const Workplace = mongoose.model('Workplace');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        const currentPeriod = await Workplace.countDocuments({
            createdAt: { $gte: thirtyDaysAgo },
        });

        const previousPeriod = await Workplace.countDocuments({
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        });

        return previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;
    } catch (error) {
        console.error('Error calculating workspace growth rate:', error);
        return 0;
    }
}

async function calculateUserGrowthRate(): Promise<number> {
    try {
        const mongoose = require('mongoose');
        const User = mongoose.model('User');

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        const currentPeriod = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo },
        });

        const previousPeriod = await User.countDocuments({
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        });

        return previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;
    } catch (error) {
        console.error('Error calculating user growth rate:', error);
        return 0;
    }
}

export default router;