import { Response, NextFunction } from 'express';
import { AuthRequest, UsageLimitResult } from '../types/auth';
import { IWorkplace } from '../models/Workplace';
import WorkspaceStatsService from '../services/WorkspaceStatsService';
import logger from '../utils/logger';

/**
 * Usage limit enforcement middleware
 * Checks workspace usage against plan limits and enforces restrictions
 */
export const enforcePlanLimit = (resource: string) => {
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

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded. Ensure authWithWorkspace middleware is used.',
                });
                return;
            }

            // Super admin bypasses usage limits
            if (req.user.role === 'super_admin') {
                return next();
            }

            const usageResult = await checkUsageLimit(
                req.workspaceContext.workspace,
                req.workspaceContext.limits,
                resource
            );

            // If at hard limit, block the request
            if (usageResult.isAtLimit) {
                res.status(409).json({
                    success: false,
                    message: `${resource} limit exceeded`,
                    code: 'USAGE_LIMIT_EXCEEDED',
                    currentUsage: usageResult.currentUsage,
                    limit: usageResult.limit,
                    upgradeRequired: true,
                    suggestedPlan: usageResult.suggestedPlan,
                    upgradeUrl: '/subscriptions/upgrade',
                });
                return;
            }

            // If at warning threshold, add warning to response headers
            if (usageResult.isAtWarning) {
                res.setHeader('X-Usage-Warning', 'true');
                res.setHeader('X-Usage-Current', usageResult.currentUsage.toString());
                res.setHeader('X-Usage-Limit', (usageResult.limit || 'unlimited').toString());
                res.setHeader('X-Usage-Percentage', Math.round((usageResult.currentUsage / (usageResult.limit || 1)) * 100).toString());
            }

            // Attach usage info to request for potential use in controllers
            req.usageInfo = usageResult;

            next();
        } catch (error) {
            logger.error('Usage limit middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Usage limit check failed',
            });
        }
    };
};

/**
 * Middleware that enforces multiple resource limits
 */
export const enforceMultipleLimits = (...resources: string[]) => {
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

            if (!req.workspaceContext) {
                res.status(500).json({
                    success: false,
                    message: 'Workspace context not loaded',
                });
                return;
            }

            // Super admin bypasses usage limits
            if (req.user.role === 'super_admin') {
                return next();
            }

            const limitResults: { [resource: string]: UsageLimitResult } = {};
            let hasLimitExceeded = false;
            let hasWarning = false;

            for (const resource of resources) {
                const usageResult = await checkUsageLimit(
                    req.workspaceContext.workspace,
                    req.workspaceContext.limits,
                    resource
                );

                limitResults[resource] = usageResult;

                if (usageResult.isAtLimit) {
                    hasLimitExceeded = true;
                }

                if (usageResult.isAtWarning) {
                    hasWarning = true;
                }
            }

            // If any resource is at limit, block the request
            if (hasLimitExceeded) {
                const exceededResources = Object.entries(limitResults)
                    .filter(([, result]) => result.isAtLimit)
                    .map(([resource]) => resource);

                res.status(409).json({
                    success: false,
                    message: `Resource limits exceeded: ${exceededResources.join(', ')}`,
                    code: 'MULTIPLE_LIMITS_EXCEEDED',
                    limitResults,
                    upgradeRequired: true,
                    upgradeUrl: '/subscriptions/upgrade',
                });
                return;
            }

            // Add warning headers if any resource is at warning threshold
            if (hasWarning) {
                res.setHeader('X-Usage-Warning', 'true');
                res.setHeader('X-Usage-Details', JSON.stringify(limitResults));
            }

            // Attach usage info to request
            req.usageInfo = limitResults;

            next();
        } catch (error) {
            logger.error('Multiple usage limits middleware error:', error);
            res.status(500).json({
                success: false,
                message: 'Usage limit check failed',
            });
        }
    };
};

/**
 * Middleware that only warns about usage but doesn't block
 */
export const warnOnUsageLimit = (resource: string) => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            if (!req.user || !req.workspaceContext) {
                return next();
            }

            // Super admin bypasses usage limits
            if (req.user.role === 'super_admin') {
                return next();
            }

            const usageResult = await checkUsageLimit(
                req.workspaceContext.workspace,
                req.workspaceContext.limits,
                resource
            );

            // Add usage info to headers for client awareness
            res.setHeader('X-Usage-Current', usageResult.currentUsage.toString());
            res.setHeader('X-Usage-Limit', (usageResult.limit || 'unlimited').toString());

            if (usageResult.isAtWarning || usageResult.isAtLimit) {
                res.setHeader('X-Usage-Warning', 'true');
                res.setHeader('X-Usage-Percentage', Math.round((usageResult.currentUsage / (usageResult.limit || 1)) * 100).toString());

                if (usageResult.isAtLimit) {
                    res.setHeader('X-Usage-Exceeded', 'true');
                }
            }

            req.usageInfo = usageResult;
            next();
        } catch (error) {
            logger.error('Usage warning middleware error:', error);
            // Don't block request on warning middleware errors
            next();
        }
    };
};

/**
 * Check usage limit for a specific resource
 */
async function checkUsageLimit(
    workspace: IWorkplace | null,
    limits: any,
    resource: string
): Promise<UsageLimitResult> {
    if (!workspace || !limits) {
        return {
            allowed: true,
            currentUsage: 0,
            limit: null,
            isAtWarning: false,
            isAtLimit: false,
        };
    }

    const limit = limits[resource];

    // If limit is null or undefined, it's unlimited
    if (limit === null || limit === undefined) {
        return {
            allowed: true,
            currentUsage: await getCurrentUsage(workspace, resource),
            limit: null,
            isAtWarning: false,
            isAtLimit: false,
        };
    }

    const currentUsage = await getCurrentUsage(workspace, resource);
    const warningThreshold = Math.floor(limit * 0.9); // 90% threshold

    const isAtWarning = currentUsage >= warningThreshold;
    const isAtLimit = currentUsage >= limit;

    return {
        allowed: !isAtLimit,
        currentUsage,
        limit,
        warningThreshold,
        isAtWarning,
        isAtLimit,
        upgradeRequired: isAtLimit,
        suggestedPlan: getSuggestedPlan(resource, currentUsage),
    };
}

/**
 * Get current usage for a resource from workspace stats
 */
async function getCurrentUsage(workspace: IWorkplace, resource: string): Promise<number> {
    try {
        // Get fresh stats from the service
        const stats = await WorkspaceStatsService.getUsageStats(workspace._id);

        switch (resource) {
            case 'patients':
                return stats?.patientsCount || 0;
            case 'users':
                return stats?.usersCount || 0;
            case 'locations':
                return workspace.locations?.length || 0;
            case 'storage':
                return stats?.storageUsed || 0;
            case 'apiCalls':
                return stats?.apiCallsThisMonth || 0;
            default:
                logger.warn(`Unknown resource type for usage check: ${resource}`);
                return 0;
        }
    } catch (error) {
        logger.error(`Error getting current usage for ${resource}:`, error);
        // Fallback to workspace stats if service fails
        const stats = workspace.stats;

        switch (resource) {
            case 'patients':
                return stats?.patientsCount || 0;
            case 'users':
                return stats?.usersCount || 0;
            case 'locations':
                return workspace.locations?.length || 0;
            case 'storage':
                return stats?.storageUsed || 0;
            case 'apiCalls':
                return stats?.apiCallsThisMonth || 0;
            default:
                return 0;
        }
    }
}

/**
 * Get suggested plan based on current usage
 */
function getSuggestedPlan(resource: string, currentUsage: number): string {
    // Simple logic to suggest next tier based on usage
    // This could be made more sophisticated based on business rules

    if (resource === 'patients') {
        if (currentUsage <= 100) return 'basic';
        if (currentUsage <= 500) return 'pro';
        if (currentUsage <= 2000) return 'pharmily';
        return 'network';
    }

    if (resource === 'users') {
        if (currentUsage <= 1) return 'basic';
        if (currentUsage <= 5) return 'pro';
        if (currentUsage <= 20) return 'pharmily';
        return 'network';
    }

    if (resource === 'locations') {
        if (currentUsage <= 1) return 'pro';
        return 'network';
    }

    return 'pro'; // Default suggestion
}

/**
 * Middleware to update usage stats after successful resource creation
 */
export const updateUsageAfterCreation = (resource: string, delta: number = 1) => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        // Store original res.json to intercept successful responses
        const originalJson = res.json;

        res.json = function (body: any) {
            // Only update usage if the response indicates success
            if (res.statusCode >= 200 && res.statusCode < 300 && req.workspaceContext?.workspace) {
                // Update usage stats asynchronously (don't block response)
                WorkspaceStatsService.updateUsageStats({
                    workspaceId: req.workspaceContext.workspace._id,
                    resource: resource as 'patients' | 'users' | 'storage' | 'apiCalls',
                    delta,
                    operation: 'increment'
                }).catch(error => {
                    logger.error(`Failed to update usage stats for ${resource}:`, error);
                });
            }

            // Call original json method
            return originalJson.call(this, body);
        };

        next();
    };
};

/**
 * Middleware to update usage stats after successful resource deletion
 */
export const updateUsageAfterDeletion = (resource: string, delta: number = 1) => {
    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        // Store original res.json to intercept successful responses
        const originalJson = res.json;

        res.json = function (body: any) {
            // Only update usage if the response indicates success
            if (res.statusCode >= 200 && res.statusCode < 300 && req.workspaceContext?.workspace) {
                // Update usage stats asynchronously (don't block response)
                WorkspaceStatsService.updateUsageStats({
                    workspaceId: req.workspaceContext.workspace._id,
                    resource: resource as 'patients' | 'users' | 'storage' | 'apiCalls',
                    delta,
                    operation: 'decrement'
                }).catch(error => {
                    logger.error(`Failed to update usage stats for ${resource}:`, error);
                });
            }

            // Call original json method
            return originalJson.call(this, body);
        };

        next();
    };
};

/**
 * Utility function to get usage statistics for a workspace
 */
export const getWorkspaceUsageStats = async (workspace: IWorkplace, limits: any) => {
    const resources = ['patients', 'users', 'locations', 'storage', 'apiCalls'];
    const stats: { [key: string]: UsageLimitResult } = {};

    for (const resource of resources) {
        stats[resource] = await checkUsageLimit(workspace, limits, resource);
    }

    return stats;
};

/**
 * Middleware to attach usage statistics to response
 */
export const attachUsageStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (req.workspaceContext?.workspace && req.workspaceContext?.limits) {
            const usageStats = await getWorkspaceUsageStats(
                req.workspaceContext.workspace,
                req.workspaceContext.limits
            );

            // Attach to response for client consumption
            res.locals.usageStats = usageStats;

            // Add summary headers
            const totalResources = Object.keys(usageStats).length;
            const warningResources = Object.values(usageStats).filter(stat => stat.isAtWarning).length;
            const limitedResources = Object.values(usageStats).filter(stat => stat.isAtLimit).length;

            res.setHeader('X-Usage-Summary', JSON.stringify({
                totalResources,
                warningResources,
                limitedResources,
                hasWarnings: warningResources > 0,
                hasLimits: limitedResources > 0,
            }));
        }

        next();
    } catch (error) {
        logger.error('Usage stats middleware error:', error);
        // Don't block request on stats errors
        next();
    }
};

export default {
    enforcePlanLimit,
    enforceMultipleLimits,
    warnOnUsageLimit,
    attachUsageStats,
    updateUsageAfterCreation,
    updateUsageAfterDeletion,
    getWorkspaceUsageStats,
};