import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import WorkspaceStatsService from '../services/WorkspaceStatsService';
import Workplace from '../models/Workplace';
import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { getWorkspaceUsageStats as getUsageStatsFromMiddleware } from '../middlewares/usageLimits';
import logger from '../utils/logger';

/**
 * Get usage statistics for the current workspace
 */
export const getWorkspaceUsageStats = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { workspace, limits } = req.workspaceContext;

        // Get detailed usage statistics
        const usageWithLimits = await WorkspaceStatsService.getUsageWithLimits(
            workspace._id,
            limits
        );

        // Get usage trends (last 30 days)
        const usageTrends = await getUsageTrends(workspace._id);

        res.json({
            success: true,
            data: {
                workspace: {
                    id: workspace._id,
                    name: workspace.name,
                    subscriptionStatus: workspace.subscriptionStatus
                },
                usage: usageWithLimits.usage,
                stats: usageWithLimits.stats,
                trends: usageTrends,
                lastUpdated: usageWithLimits.stats.lastUpdated
            }
        });

    } catch (error) {
        logger.error('Error getting workspace usage stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve usage statistics'
        });
    }
};

/**
 * Get usage analytics for workspace owners
 */
export const getUsageAnalytics = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        // Only workspace owners can access analytics
        if (req.user?.workplaceRole !== 'Owner' && req.user?.role !== 'super_admin') {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can access usage analytics'
            });
            return;
        }

        const { workspace, limits, plan } = req.workspaceContext;

        // Get comprehensive analytics
        const analytics = await generateUsageAnalytics(workspace._id, limits, plan);

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        logger.error('Error getting usage analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve usage analytics'
        });
    }
};

/**
 * Get usage alerts and warnings
 */
export const getUsageAlerts = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { workspace, limits } = req.workspaceContext;

        // Get current usage statistics
        const usageStats = await getUsageStatsFromMiddleware(workspace, limits);

        // Generate alerts based on usage
        const alerts = generateUsageAlerts(usageStats);

        res.json({
            success: true,
            data: {
                alerts,
                totalAlerts: alerts.length,
                criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length,
                warningAlerts: alerts.filter(alert => alert.severity === 'warning').length
            }
        });

    } catch (error) {
        logger.error('Error getting usage alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve usage alerts'
        });
    }
};

/**
 * Trigger manual usage recalculation
 */
export const recalculateUsageStats = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        // Only workspace owners and super admins can trigger recalculation
        if (req.user?.workplaceRole !== 'Owner' && req.user?.role !== 'super_admin') {
            res.status(403).json({
                success: false,
                message: 'Only workspace owners can trigger usage recalculation'
            });
            return;
        }

        const result = await WorkspaceStatsService.recalculateUsageStats(
            req.workspaceContext.workspace._id
        );

        res.json({
            success: true,
            message: 'Usage statistics recalculated successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error recalculating usage stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recalculate usage statistics'
        });
    }
};

/**
 * Get usage comparison with plan limits
 */
export const getUsageComparison = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.workspaceContext?.workspace) {
            res.status(400).json({
                success: false,
                message: 'Workspace context not found'
            });
            return;
        }

        const { workspace, limits, plan } = req.workspaceContext;

        // Get all available plans for comparison
        const allPlans = await SubscriptionPlan.find({ isActive: true })
            .sort({ priceNGN: 1 });

        // Get current usage
        const currentUsage = await WorkspaceStatsService.getUsageStats(workspace._id);

        // Define tier ranking for comparison
        const tierRanking = {
            'free_trial': 0,
            'basic': 1,
            'pro': 2,
            'pharmily': 3,
            'network': 4,
            'enterprise': 5
        };

        // Generate comparison data
        const comparison = allPlans.map(planOption => {
            const planLimits = {
                patients: planOption.features.patientLimit,
                users: planOption.features.teamSize,
                storage: null, // Not defined in current model
                apiCalls: null // Not defined in current model
            };
            const currentTierRank = plan ? tierRanking[plan.tier as keyof typeof tierRanking] || 0 : 0;
            const planTierRank = tierRanking[planOption.tier as keyof typeof tierRanking] || 0;
            const canUpgrade = planTierRank > currentTierRank;

            return {
                plan: {
                    id: planOption._id,
                    name: planOption.name,
                    tier: planOption.tier,
                    priceNGN: planOption.priceNGN,
                    canUpgrade
                },
                limits: planLimits,
                usage: {
                    patients: {
                        current: currentUsage.patientsCount,
                        limit: planLimits.patients,
                        withinLimit: planLimits.patients === null || currentUsage.patientsCount <= planLimits.patients,
                        percentage: planLimits.patients ? Math.round((currentUsage.patientsCount / planLimits.patients) * 100) : null
                    },
                    users: {
                        current: currentUsage.usersCount,
                        limit: planLimits.users,
                        withinLimit: planLimits.users === null || currentUsage.usersCount <= planLimits.users,
                        percentage: planLimits.users ? Math.round((currentUsage.usersCount / planLimits.users) * 100) : null
                    },
                    storage: {
                        current: currentUsage.storageUsed || 0,
                        limit: planLimits.storage,
                        withinLimit: planLimits.storage === null || (currentUsage.storageUsed || 0) <= planLimits.storage,
                        percentage: planLimits.storage ? Math.round(((currentUsage.storageUsed || 0) / planLimits.storage) * 100) : null
                    }
                }
            };
        });

        res.json({
            success: true,
            data: {
                currentPlan: plan?.name || 'Unknown',
                currentUsage,
                planComparison: comparison,
                recommendedPlan: getRecommendedPlan(comparison, currentUsage)
            }
        });

    } catch (error) {
        logger.error('Error getting usage comparison:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve usage comparison'
        });
    }
};

/**
 * Helper function to get usage trends
 */
async function getUsageTrends(workspaceId: any): Promise<any> {
    // This is a simplified implementation
    // In a real application, you would store historical usage data
    // and calculate trends over time

    try {
        const currentStats = await WorkspaceStatsService.getUsageStats(workspaceId);

        // For now, return current stats as trends
        // TODO: Implement historical data tracking
        return {
            patients: {
                current: currentStats.patientsCount,
                trend: 'stable', // 'increasing', 'decreasing', 'stable'
                changePercent: 0
            },
            users: {
                current: currentStats.usersCount,
                trend: 'stable',
                changePercent: 0
            },
            storage: {
                current: currentStats.storageUsed || 0,
                trend: 'stable',
                changePercent: 0
            }
        };
    } catch (error) {
        logger.error('Error getting usage trends:', error);
        return {};
    }
}

/**
 * Helper function to generate usage analytics
 */
async function generateUsageAnalytics(workspaceId: any, limits: any, plan: any): Promise<any> {
    try {
        const usageWithLimits = await WorkspaceStatsService.getUsageWithLimits(workspaceId, limits);
        const trends = await getUsageTrends(workspaceId);

        return {
            summary: {
                planName: plan?.name || 'Unknown',
                subscriptionTier: plan?.tier || 'unknown',
                totalResources: Object.keys(usageWithLimits.usage).length,
                resourcesAtWarning: Object.values(usageWithLimits.usage).filter((resource: any) =>
                    resource.percentage && resource.percentage >= 90
                ).length,
                resourcesAtLimit: Object.values(usageWithLimits.usage).filter((resource: any) =>
                    resource.percentage && resource.percentage >= 100
                ).length
            },
            usage: usageWithLimits.usage,
            trends,
            recommendations: generateUsageRecommendations(usageWithLimits.usage, plan),
            lastUpdated: usageWithLimits.stats.lastUpdated
        };
    } catch (error) {
        logger.error('Error generating usage analytics:', error);
        throw error;
    }
}

/**
 * Helper function to generate usage alerts
 */
function generateUsageAlerts(usageStats: any): any[] {
    const alerts: any[] = [];

    Object.entries(usageStats).forEach(([resource, stats]: [string, any]) => {
        if (stats.isAtLimit) {
            alerts.push({
                id: `${resource}_limit_exceeded`,
                resource,
                severity: 'critical',
                type: 'limit_exceeded',
                message: `${resource} limit exceeded (${stats.currentUsage}/${stats.limit})`,
                currentUsage: stats.currentUsage,
                limit: stats.limit,
                percentage: Math.round((stats.currentUsage / stats.limit) * 100),
                actionRequired: true,
                suggestedAction: 'Upgrade your plan to increase limits',
                createdAt: new Date()
            });
        } else if (stats.isAtWarning) {
            alerts.push({
                id: `${resource}_warning`,
                resource,
                severity: 'warning',
                type: 'approaching_limit',
                message: `${resource} usage is approaching limit (${stats.currentUsage}/${stats.limit})`,
                currentUsage: stats.currentUsage,
                limit: stats.limit,
                percentage: Math.round((stats.currentUsage / stats.limit) * 100),
                actionRequired: false,
                suggestedAction: 'Consider upgrading your plan soon',
                createdAt: new Date()
            });
        }
    });

    return alerts.sort((a, b) => {
        // Sort by severity (critical first) then by percentage
        if (a.severity !== b.severity) {
            return a.severity === 'critical' ? -1 : 1;
        }
        return b.percentage - a.percentage;
    });
}

/**
 * Helper function to generate usage recommendations
 */
function generateUsageRecommendations(usage: any, plan: any): any[] {
    const recommendations: any[] = [];

    Object.entries(usage).forEach(([resource, stats]: [string, any]) => {
        if (stats.percentage && stats.percentage >= 80) {
            recommendations.push({
                resource,
                type: 'upgrade_suggestion',
                message: `Consider upgrading your plan to avoid ${resource} limits`,
                priority: stats.percentage >= 95 ? 'high' : 'medium',
                currentUsage: stats.current,
                currentLimit: stats.limit
            });
        }
    });

    return recommendations;
}

/**
 * Helper function to get recommended plan
 */
function getRecommendedPlan(comparison: any[], currentUsage: any): any {
    // Find the cheapest plan that can accommodate current usage
    const suitablePlans = comparison.filter(plan => {
        return plan.usage.patients.withinLimit &&
            plan.usage.users.withinLimit &&
            plan.usage.storage.withinLimit;
    });

    if (suitablePlans.length === 0) {
        return null;
    }

    // Return the cheapest suitable plan
    return suitablePlans.reduce((cheapest, current) => {
        return current.plan.priceNGN < cheapest.plan.priceNGN ? current : cheapest;
    });
}