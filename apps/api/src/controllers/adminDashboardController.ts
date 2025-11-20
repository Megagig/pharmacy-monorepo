import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import Workplace from '../models/Workplace';
import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import Invitation from '../models/Invitation';
import User from '../models/User';
import Patient from '../models/Patient';
import { EmailDelivery } from '../models/EmailDelivery';
import mongoose from 'mongoose';

export class AdminDashboardController {
    /**
     * Get admin dashboard overview
     */
    async getDashboardOverview(req: AuthRequest, res: Response): Promise<any> {
        try {
            // Verify admin permissions
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            // Get overview statistics
            const [
                totalWorkspaces,
                activeWorkspaces,
                trialWorkspaces,
                expiredWorkspaces,
                totalSubscriptions,
                activeSubscriptions,
                totalUsers,
                activeUsers,
                totalPatients,
                totalInvitations,
                pendingInvitations,
                recentWorkspaces,
                recentUsers,
                subscriptionsByTier,
                invitationStats,
                emailStats,
            ] = await Promise.all([
                // Workspace stats
                Workplace.countDocuments(),
                Workplace.countDocuments({ subscriptionStatus: 'active' }),
                Workplace.countDocuments({ subscriptionStatus: 'trial' }),
                Workplace.countDocuments({ subscriptionStatus: 'expired' }),

                // Subscription stats
                Subscription.countDocuments(),
                Subscription.countDocuments({ status: 'active' }),

                // User stats
                User.countDocuments(),
                User.countDocuments({ status: 'active' }),

                // Patient stats
                Patient.countDocuments(),

                // Invitation stats
                Invitation.countDocuments(),
                Invitation.countDocuments({
                    status: 'active',
                    expiresAt: { $gt: now },
                }),

                // Recent activity
                Workplace.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
                User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

                // Subscription distribution
                Subscription.aggregate([
                    {
                        $group: {
                            _id: '$tier',
                            count: { $sum: 1 },
                            revenue: { $sum: '$priceAtPurchase' },
                        },
                    },
                ]),

                // Invitation statistics
                Invitation.aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ]),

                // Email delivery statistics
                EmailDelivery.aggregate([
                    {
                        $match: { createdAt: { $gte: sevenDaysAgo } },
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ]),
            ]);

            // Calculate growth rates
            const workspaceGrowthRate = await this.calculateGrowthRate(
                Workplace,
                thirtyDaysAgo,
                now
            );
            const userGrowthRate = await this.calculateGrowthRate(
                User,
                thirtyDaysAgo,
                now
            );

            // Get trial expiry alerts
            const trialExpiryAlerts = await Workplace.find({
                subscriptionStatus: 'trial',
                trialEndDate: {
                    $gte: now,
                    $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                },
            })
                .select('name trialEndDate ownerId')
                .populate('ownerId', 'firstName lastName email')
                .limit(10);

            // Get recent failed payments
            const failedPayments = await Subscription.find({
                status: 'past_due',
                updatedAt: { $gte: sevenDaysAgo },
            })
                .populate('workspaceId', 'name')
                .limit(10);

            const overview = {
                summary: {
                    workspaces: {
                        total: totalWorkspaces,
                        active: activeWorkspaces,
                        trial: trialWorkspaces,
                        expired: expiredWorkspaces,
                        growth: workspaceGrowthRate,
                    },
                    subscriptions: {
                        total: totalSubscriptions,
                        active: activeSubscriptions,
                        byTier: subscriptionsByTier,
                    },
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        growth: userGrowthRate,
                    },
                    patients: {
                        total: totalPatients,
                    },
                    invitations: {
                        total: totalInvitations,
                        pending: pendingInvitations,
                        stats: invitationStats,
                    },
                    emails: {
                        stats: emailStats,
                    },
                },
                recentActivity: {
                    newWorkspaces: recentWorkspaces,
                    newUsers: recentUsers,
                },
                alerts: {
                    trialExpiring: trialExpiryAlerts,
                    failedPayments: failedPayments,
                },
                timestamp: now.toISOString(),
            };

            res.json({
                success: true,
                data: overview,
            });
        } catch (error) {
            console.error('Error getting admin dashboard overview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get dashboard overview',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get workspace management data
     */
    async getWorkspaceManagement(req: AuthRequest, res: Response): Promise<any> {
        try {
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const {
                page = 1,
                limit = 20,
                search,
                status,
                tier,
                sortBy = 'createdAt',
                sortOrder = 'desc',
            } = req.query;

            const skip = (Number(page) - 1) * Number(limit);

            // Build query
            const query: any = {};
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ];
            }
            if (status) {
                query.subscriptionStatus = status;
            }

            // Build sort
            const sort: any = {};
            sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

            const [workspaces, totalCount] = await Promise.all([
                Workplace.find(query)
                    .populate('ownerId', 'firstName lastName email')
                    .populate('currentSubscriptionId')
                    .sort(sort)
                    .skip(skip)
                    .limit(Number(limit)),
                Workplace.countDocuments(query),
            ]);

            // Add subscription plan details
            const workspacesWithDetails = await Promise.all(
                workspaces.map(async (workspace) => {
                    const subscription = workspace.currentSubscriptionId as any;
                    let plan = null;

                    if (subscription?.planId) {
                        plan = await SubscriptionPlan.findById(subscription.planId);
                    }

                    return {
                        ...workspace.toObject(),
                        subscription,
                        plan,
                        stats: workspace.stats || { patientsCount: 0, usersCount: 0 },
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    workspaces: workspacesWithDetails,
                    pagination: {
                        currentPage: Number(page),
                        totalPages: Math.ceil(totalCount / Number(limit)),
                        totalItems: totalCount,
                        itemsPerPage: Number(limit),
                    },
                },
            });
        } catch (error) {
            console.error('Error getting workspace management data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get workspace management data',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Update workspace subscription
     */
    async updateWorkspaceSubscription(req: AuthRequest, res: Response): Promise<any> {
        try {
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const { workspaceId } = req.params;
            const { planId, status, endDate, notes } = req.body;

            if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid workspace ID',
                });
            }

            const workspace = await Workplace.findById(workspaceId);
            if (!workspace) {
                return res.status(404).json({
                    success: false,
                    message: 'Workspace not found',
                });
            }

            // Update subscription
            const subscription = await Subscription.findOne({ workspaceId });
            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    message: 'Subscription not found',
                });
            }

            // Update subscription fields
            if (planId) {
                const plan = await SubscriptionPlan.findById(planId);
                if (!plan) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid plan ID',
                    });
                }
                subscription.planId = planId;
                subscription.tier = plan.tier;
                // Convert plan features object to string array
                subscription.features = Object.keys(plan.features).filter(key =>
                    plan.features[key as keyof typeof plan.features] === true ||
                    typeof plan.features[key as keyof typeof plan.features] === 'number'
                );
                // Map plan features to subscription limits
                subscription.limits = {
                    patients: plan.features.patientLimit || 0,
                    users: plan.features.teamSize || 1,
                    locations: 1, // Default value
                    storage: 1000, // Default value in MB
                    apiCalls: 1000 // Default value
                };
            }

            if (status) {
                subscription.status = status;
                workspace.subscriptionStatus = status;
            }

            if (endDate) {
                subscription.endDate = new Date(endDate);
            }

            // Save changes
            await subscription.save();
            await workspace.save();

            // Log admin action
            console.log(`Admin ${req.user?.email} updated subscription for workspace ${workspace.name}`, {
                workspaceId,
                changes: { planId, status, endDate },
                notes,
                adminId: req.user?._id,
            });

            res.json({
                success: true,
                message: 'Workspace subscription updated successfully',
                data: {
                    workspace: workspace.toObject(),
                    subscription: subscription.toObject(),
                },
            });
        } catch (error) {
            console.error('Error updating workspace subscription:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update workspace subscription',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get invitation management data
     */
    async getInvitationManagement(req: AuthRequest, res: Response): Promise<any> {
        try {
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const {
                page = 1,
                limit = 20,
                search,
                status,
                workspaceId,
                sortBy = 'createdAt',
                sortOrder = 'desc',
            } = req.query;

            const skip = (Number(page) - 1) * Number(limit);

            // Build query
            const query: any = {};
            if (search) {
                query.email = { $regex: search, $options: 'i' };
            }
            if (status) {
                query.status = status;
            }
            if (workspaceId) {
                query.workspaceId = workspaceId;
            }

            // Build sort
            const sort: any = {};
            sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

            const [invitations, totalCount] = await Promise.all([
                Invitation.find(query)
                    .populate('workspaceId', 'name')
                    .populate('invitedBy', 'firstName lastName email')
                    .populate('usedBy', 'firstName lastName email')
                    .sort(sort)
                    .skip(skip)
                    .limit(Number(limit)),
                Invitation.countDocuments(query),
            ]);

            res.json({
                success: true,
                data: {
                    invitations,
                    pagination: {
                        currentPage: Number(page),
                        totalPages: Math.ceil(totalCount / Number(limit)),
                        totalItems: totalCount,
                        itemsPerPage: Number(limit),
                    },
                },
            });
        } catch (error) {
            console.error('Error getting invitation management data:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get invitation management data',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Cancel invitation (admin)
     */
    async cancelInvitation(req: AuthRequest, res: Response): Promise<any> {
        try {
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const { invitationId } = req.params;
            const { reason } = req.body;

            if (!invitationId || !mongoose.Types.ObjectId.isValid(invitationId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid invitation ID',
                });
            }

            const invitation = await Invitation.findById(invitationId);
            if (!invitation) {
                return res.status(404).json({
                    success: false,
                    message: 'Invitation not found',
                });
            }

            if (invitation.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: 'Invitation is not active',
                });
            }

            // Cancel invitation
            invitation.status = 'canceled';
            invitation.metadata = {
                ...invitation.metadata,
                canceledBy: 'admin',
                canceledReason: reason,
                canceledAt: new Date(),
            };

            await invitation.save();

            // Log admin action
            console.log(`Admin ${req.user?.email} canceled invitation ${invitationId}`, {
                invitationId,
                reason,
                adminId: req.user?._id,
            });

            res.json({
                success: true,
                message: 'Invitation canceled successfully',
                data: invitation,
            });
        } catch (error) {
            console.error('Error canceling invitation:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel invitation',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get system health and statistics
     */
    async getSystemHealth(req: AuthRequest, res: Response): Promise<any> {
        try {
            if (req.user?.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            // Get system statistics
            const [
                dbStats,
                recentErrors,
                emailDeliveryStats,
                invitationStats,
                subscriptionStats,
            ] = await Promise.all([
                // Database statistics
                mongoose.connection.db.stats(),

                // Recent errors (if you have error logging)
                // ErrorLog.find({ createdAt: { $gte: oneDayAgo } }).limit(10),
                [],

                // Email delivery statistics
                EmailDelivery.aggregate([
                    {
                        $match: { createdAt: { $gte: oneDayAgo } },
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ]),

                // Invitation statistics
                Invitation.aggregate([
                    {
                        $match: { createdAt: { $gte: oneDayAgo } },
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ]),

                // Subscription statistics
                Subscription.aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ]),
            ]);

            const systemHealth = {
                timestamp: now.toISOString(),
                database: {
                    connected: mongoose.connection.readyState === 1,
                    stats: dbStats,
                },
                application: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV,
                },
                services: {
                    emailDelivery: emailDeliveryStats,
                    invitations: invitationStats,
                    subscriptions: subscriptionStats,
                },
                recentErrors,
            };

            res.json({
                success: true,
                data: systemHealth,
            });
        } catch (error) {
            console.error('Error getting system health:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system health',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Helper method to calculate growth rate
     */
    private async calculateGrowthRate(
        Model: any,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const periodLength = endDate.getTime() - startDate.getTime();
            const previousPeriodStart = new Date(startDate.getTime() - periodLength);

            const [currentPeriod, previousPeriod] = await Promise.all([
                Model.countDocuments({
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
                Model.countDocuments({
                    createdAt: { $gte: previousPeriodStart, $lt: startDate },
                }),
            ]);

            if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;

            return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
        } catch (error) {
            console.error('Error calculating growth rate:', error);
            return 0;
        }
    }
}

export const adminDashboardController = new AdminDashboardController();