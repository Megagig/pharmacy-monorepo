import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import AIUsageTrackingService from '../services/AIUsageTrackingService';
import AIUsageLimits from '../models/AIUsageLimits';
import AIUsageRecord from '../models/AIUsageTracking';
import Workplace from '../models/Workplace';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const aiUsageService = AIUsageTrackingService.getInstance();

/**
 * Get comprehensive AI usage dashboard data
 */
export const getAIUsageDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only super admins can access this endpoint
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { startDate, endDate } = req.query;
    let dateRange: { start: Date; end: Date } | undefined;

    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string),
      };
    }

    const [usageStats, globalBudget, suspendedWorkspaces, alerts] = await Promise.all([
      aiUsageService.getUsageStats(dateRange),
      getGlobalBudgetInfo(),
      getSuspendedWorkspaces(),
      getUsageAlerts(),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalRequests: usageStats.totalRequests,
          totalCost: usageStats.totalCost,
          averageCost: usageStats.averageCost,
          successRate: usageStats.successRate,
          budgetRemaining: globalBudget.remaining,
          budgetUsedPercent: globalBudget.usedPercent,
        },
        topWorkspaces: usageStats.topWorkspaces,
        featureBreakdown: usageStats.featureBreakdown,
        dailyTrends: usageStats.dailyTrends,
        suspendedWorkspaces,
        alerts,
        globalBudget,
      },
    });
  } catch (error) {
    logger.error('Failed to get AI usage dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get AI usage dashboard',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

/**
 * Get detailed workspace usage information
 */
export const getWorkspaceUsageDetails = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace ID',
      });
      return;
    }

    const workspaceDetails = await aiUsageService.getWorkspaceUsageDetails(workspaceId);

    res.json({
      success: true,
      data: workspaceDetails,
    });
  } catch (error) {
    logger.error('Failed to get workspace usage details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceId: req.params.workspaceId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get workspace usage details',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

/**
 * Suspend workspace AI features
 */
export const suspendWorkspaceAI = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { workspaceId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace ID',
      });
      return;
    }

    if (!reason || typeof reason !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Suspension reason is required',
      });
      return;
    }

    await aiUsageService.suspendWorkspace(workspaceId, reason, req.user!._id);

    res.json({
      success: true,
      message: 'Workspace AI features suspended successfully',
    });
  } catch (error) {
    logger.error('Failed to suspend workspace AI features', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceId: req.params.workspaceId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to suspend workspace AI features',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

/**
 * Restore workspace AI features
 */
export const restoreWorkspaceAI = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace ID',
      });
      return;
    }

    await aiUsageService.restoreWorkspace(workspaceId);

    res.json({
      success: true,
      message: 'Workspace AI features restored successfully',
    });
  } catch (error) {
    logger.error('Failed to restore workspace AI features', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceId: req.params.workspaceId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to restore workspace AI features',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

/**
 * Update workspace AI usage limits
 */
export const updateWorkspaceLimits = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { workspaceId } = req.params;
    const { requestsPerMonth, costBudgetPerMonth, dailyRequestLimit } = req.body;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid workspace ID',
      });
      return;
    }

    const updateData: any = {};
    if (requestsPerMonth !== undefined) {
      updateData['customLimits.requestsPerMonth'] = requestsPerMonth;
      updateData['limits.requestsPerMonth'] = requestsPerMonth;
    }
    if (costBudgetPerMonth !== undefined) {
      updateData['customLimits.costBudgetPerMonth'] = costBudgetPerMonth;
      updateData['limits.costBudgetPerMonth'] = costBudgetPerMonth;
    }
    if (dailyRequestLimit !== undefined) {
      updateData['customLimits.dailyRequestLimit'] = dailyRequestLimit;
      updateData['limits.dailyRequestLimit'] = dailyRequestLimit;
    }

    await AIUsageLimits.findOneAndUpdate(
      { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      { $set: updateData },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Workspace limits updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update workspace limits', {
      error: error instanceof Error ? error.message : 'Unknown error',
      workspaceId: req.params.workspaceId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update workspace limits',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

/**
 * Get AI usage analytics with advanced filtering
 */
export const getAIUsageAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const { 
      startDate, 
      endDate, 
      workspaceId, 
      feature, 
      tier,
      groupBy = 'day' 
    } = req.query;

    const matchStage: any = {};
    
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    if (workspaceId) {
      matchStage.workspaceId = new mongoose.Types.ObjectId(workspaceId as string);
    }

    if (feature) {
      matchStage.feature = feature;
    }

    // Build aggregation pipeline
    const pipeline: any[] = [{ $match: matchStage }];

    // Add workspace filtering by tier if specified
    if (tier) {
      pipeline.push(
        {
          $lookup: {
            from: 'aiusagelimits',
            localField: 'workspaceId',
            foreignField: 'workspaceId',
            as: 'limits',
          },
        },
        {
          $match: {
            'limits.subscriptionTier': tier,
          },
        }
      );
    }

    // Group by specified period
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'hour') dateFormat = '%Y-%m-%d %H:00:00';
    else if (groupBy === 'week') dateFormat = '%Y-%U';
    else if (groupBy === 'month') dateFormat = '%Y-%m';

    pipeline.push(
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          requests: { $sum: 1 },
          cost: { $sum: '$cost' },
          avgDuration: { $avg: '$requestDuration' },
          successRate: {
            $avg: { $cond: ['$success', 1, 0] },
          },
          uniqueWorkspaces: { $addToSet: '$workspaceId' },
          features: { $addToSet: '$feature' },
        },
      },
      {
        $project: {
          period: '$_id',
          requests: 1,
          cost: { $round: ['$cost', 4] },
          avgDuration: { $round: ['$avgDuration', 2] },
          successRate: { $round: [{ $multiply: ['$successRate', 100] }, 2] },
          uniqueWorkspaces: { $size: '$uniqueWorkspaces' },
          features: 1,
        },
      },
      { $sort: { period: 1 } }
    );

    const analytics = await AIUsageRecord.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        analytics,
        filters: {
          startDate,
          endDate,
          workspaceId,
          feature,
          tier,
          groupBy,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get AI usage analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get AI usage analytics',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error',
    });
  }
};

// Helper functions
async function getGlobalBudgetInfo() {
  const monthlyBudget = parseFloat(process.env.OPENROUTER_MONTHLY_BUDGET || '10');
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const totalUsage = await AIUsageRecord.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(currentMonth + '-01'),
          $lt: new Date(new Date(currentMonth + '-01').getFullYear(), 
                       new Date(currentMonth + '-01').getMonth() + 1, 1),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$cost' },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  const usage = totalUsage[0] || { totalCost: 0, totalRequests: 0 };
  const usedPercent = (usage.totalCost / monthlyBudget) * 100;

  return {
    monthlyBudget,
    used: Math.round(usage.totalCost * 100) / 100,
    remaining: Math.max(0, monthlyBudget - usage.totalCost),
    usedPercent: Math.round(usedPercent * 100) / 100,
    totalRequests: usage.totalRequests,
    currentMonth,
  };
}

async function getSuspendedWorkspaces() {
  const suspended = await AIUsageLimits.find({ suspended: true })
    .populate('workspaceId', 'name')
    .populate('suspendedBy', 'firstName lastName email')
    .select('workspaceId suspensionReason suspendedAt suspendedBy subscriptionTier')
    .lean();

  return suspended.map((item) => ({
    workspaceId: item.workspaceId._id,
    workspaceName: (item.workspaceId as any).name,
    tier: item.subscriptionTier,
    reason: item.suspensionReason,
    suspendedAt: item.suspendedAt,
    suspendedBy: item.suspendedBy ? {
      name: `${(item.suspendedBy as any).firstName} ${(item.suspendedBy as any).lastName}`,
      email: (item.suspendedBy as any).email,
    } : null,
  }));
}

async function getUsageAlerts() {
  const alerts: Array<{
    type: 'budget_warning' | 'limit_exceeded' | 'suspicious_activity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    workspaceId?: string;
    workspaceName?: string;
    data?: any;
  }> = [];

  // Check global budget alerts
  const globalBudget = await getGlobalBudgetInfo();
  if (globalBudget.usedPercent >= 90) {
    alerts.push({
      type: 'budget_warning',
      severity: 'critical',
      message: `Global budget ${globalBudget.usedPercent.toFixed(1)}% used (${globalBudget.used}/${globalBudget.monthlyBudget} USD)`,
      data: globalBudget,
    });
  } else if (globalBudget.usedPercent >= 75) {
    alerts.push({
      type: 'budget_warning',
      severity: 'high',
      message: `Global budget ${globalBudget.usedPercent.toFixed(1)}% used (${globalBudget.used}/${globalBudget.monthlyBudget} USD)`,
      data: globalBudget,
    });
  }

  // Check workspace limit alerts
  const workspacesNearLimit = await AIUsageLimits.find({
    suspended: false,
    'limits.requestsPerMonth': { $ne: -1 },
  }).populate('workspaceId', 'name');

  for (const workspace of workspacesNearLimit) {
    const usagePercent = (workspace.currentUsage.requestCount / workspace.limits.requestsPerMonth) * 100;
    
    if (usagePercent >= 90) {
      alerts.push({
        type: 'limit_exceeded',
        severity: 'high',
        message: `Workspace "${(workspace.workspaceId as any).name}" at ${usagePercent.toFixed(1)}% of request limit`,
        workspaceId: workspace.workspaceId._id.toString(),
        workspaceName: (workspace.workspaceId as any).name,
        data: {
          current: workspace.currentUsage.requestCount,
          limit: workspace.limits.requestsPerMonth,
          percentage: usagePercent,
        },
      });
    }
  }

  return alerts;
}