import mongoose from 'mongoose';
import AIUsageRecord, { IAIUsageRecord } from '../models/AIUsageTracking';
import AIUsageLimits, { IAIUsageLimits } from '../models/AIUsageLimits';
import Workplace from '../models/Workplace';
import User from '../models/User';
import logger from '../utils/logger';

export interface UsageStats {
  totalRequests: number;
  totalCost: number;
  averageCost: number;
  successRate: number;
  topWorkspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    requests: number;
    cost: number;
    tier: string;
  }>;
  featureBreakdown: Array<{
    feature: string;
    requests: number;
    cost: number;
    percentage: number;
  }>;
  dailyTrends: Array<{
    date: string;
    requests: number;
    cost: number;
  }>;
}

export interface WorkspaceUsageDetails {
  workspaceId: string;
  workspaceName: string;
  tier: string;
  limits: {
    requestsPerMonth: number;
    costBudgetPerMonth: number;
    dailyRequestLimit?: number;
  };
  currentUsage: {
    requestCount: number;
    totalCost: number;
    percentage: number;
  };
  suspended: boolean;
  suspensionReason?: string;
  recentActivity: Array<{
    date: string;
    requests: number;
    cost: number;
    features: string[];
  }>;
}

export interface TierLimits {
  free_trial: { requests: number; budget: number; days: number };
  basic: { requests: number; budget: number };
  pro: { requests: number; budget: number };
  pharmily: { requests: number; budget: number };
  network: { requests: number; budget: number };
  enterprise: { requests: number; budget: number };
}

class AIUsageTrackingService {
  private static instance: AIUsageTrackingService;
  
  // Default tier limits based on $10/month budget
  private readonly DEFAULT_TIER_LIMITS: TierLimits = {
    free_trial: { requests: 10, budget: 0.5, days: 14 }, // $0.50 for 14 days
    basic: { requests: 50, budget: 2.0 }, // $2.00/month
    pro: { requests: 100, budget: 3.0 }, // $3.00/month
    pharmily: { requests: 150, budget: 4.0 }, // $4.00/month
    network: { requests: 500, budget: 8.0 }, // $8.00/month
    enterprise: { requests: -1, budget: -1 }, // Unlimited
  };

  public static getInstance(): AIUsageTrackingService {
    if (!AIUsageTrackingService.instance) {
      AIUsageTrackingService.instance = new AIUsageTrackingService();
    }
    return AIUsageTrackingService.instance;
  }

  /**
   * Record AI usage for tracking
   */
  async recordUsage(data: {
    workspaceId: string;
    userId: string;
    feature: string;
    aiModel: string;
    requestType: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requestDuration: number;
    success: boolean;
    errorMessage?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      const usageRecord = new AIUsageRecord({
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        userId: new mongoose.Types.ObjectId(data.userId),
        feature: data.feature,
        aiModel: data.aiModel,
        requestType: data.requestType,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.inputTokens + data.outputTokens,
        cost: data.cost,
        requestDuration: data.requestDuration,
        success: data.success,
        errorMessage: data.errorMessage,
        metadata: data.metadata || {},
      });

      await usageRecord.save();

      // Update workspace usage limits
      await this.updateWorkspaceUsage(data.workspaceId, data.cost);

      logger.info('AI usage recorded successfully', {
        workspaceId: data.workspaceId,
        feature: data.feature,
        cost: data.cost,
      });
    } catch (error) {
      logger.error('Failed to record AI usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId: data.workspaceId,
      });
      throw error;
    }
  }

  /**
   * Check if workspace can make AI requests
   */
  async canMakeRequest(workspaceId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingRequests?: number;
    remainingBudget?: number;
  }> {
    try {
      const limits = await this.getOrCreateWorkspaceLimits(workspaceId);
      
      if (limits.suspended) {
        return {
          allowed: false,
          reason: limits.suspensionReason || 'Workspace AI features suspended',
        };
      }

      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Reset usage if new month
      if (limits.currentUsage.month !== currentMonth) {
        await this.resetMonthlyUsage(workspaceId);
        limits.currentUsage.requestCount = 0;
        limits.currentUsage.totalCost = 0;
      }

      // Check request limits (enterprise has unlimited)
      if (limits.limits.requestsPerMonth !== -1 && 
          limits.currentUsage.requestCount >= limits.limits.requestsPerMonth) {
        return {
          allowed: false,
          reason: 'Monthly request limit exceeded',
          remainingRequests: 0,
        };
      }

      // Check budget limits (enterprise has unlimited)
      if (limits.limits.costBudgetPerMonth !== -1 && 
          limits.currentUsage.totalCost >= limits.limits.costBudgetPerMonth) {
        return {
          allowed: false,
          reason: 'Monthly budget limit exceeded',
          remainingBudget: 0,
        };
      }

      return {
        allowed: true,
        remainingRequests: limits.limits.requestsPerMonth === -1 ? -1 : 
          limits.limits.requestsPerMonth - limits.currentUsage.requestCount,
        remainingBudget: limits.limits.costBudgetPerMonth === -1 ? -1 : 
          limits.limits.costBudgetPerMonth - limits.currentUsage.totalCost,
      };
    } catch (error) {
      logger.error('Failed to check AI request permission', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
      });
      return { allowed: false, reason: 'System error checking permissions' };
    }
  }

  /**
   * Get comprehensive usage statistics
   */
  async getUsageStats(dateRange?: { start: Date; end: Date }): Promise<UsageStats> {
    try {
      const matchStage: any = {};
      if (dateRange) {
        matchStage.createdAt = {
          $gte: dateRange.start,
          $lte: dateRange.end,
        };
      }

      const [totalStats, topWorkspaces, featureBreakdown, dailyTrends] = await Promise.all([
        this.getTotalStats(matchStage),
        this.getTopWorkspaces(matchStage),
        this.getFeatureBreakdown(matchStage),
        this.getDailyTrends(matchStage),
      ]);

      return {
        totalRequests: totalStats.totalRequests,
        totalCost: totalStats.totalCost,
        averageCost: totalStats.averageCost,
        successRate: totalStats.successRate,
        topWorkspaces,
        featureBreakdown,
        dailyTrends,
      };
    } catch (error) {
      logger.error('Failed to get usage statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get workspace-specific usage details
   */
  async getWorkspaceUsageDetails(workspaceId: string): Promise<WorkspaceUsageDetails> {
    try {
      const [limits, workspace, recentActivity] = await Promise.all([
        this.getOrCreateWorkspaceLimits(workspaceId),
        Workplace.findById(workspaceId).select('name'),
        this.getWorkspaceRecentActivity(workspaceId),
      ]);

      const usagePercentage = limits.limits.requestsPerMonth === -1 ? 0 :
        (limits.currentUsage.requestCount / limits.limits.requestsPerMonth) * 100;

      return {
        workspaceId,
        workspaceName: workspace?.name || 'Unknown Workspace',
        tier: limits.subscriptionTier,
        limits: limits.limits,
        currentUsage: {
          requestCount: limits.currentUsage.requestCount,
          totalCost: limits.currentUsage.totalCost,
          percentage: Math.round(usagePercentage * 100) / 100,
        },
        suspended: limits.suspended,
        suspensionReason: limits.suspensionReason,
        recentActivity,
      };
    } catch (error) {
      logger.error('Failed to get workspace usage details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Suspend workspace AI features
   */
  async suspendWorkspace(workspaceId: string, reason: string, suspendedBy: string): Promise<void> {
    try {
      await AIUsageLimits.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
        {
          suspended: true,
          suspensionReason: reason,
          suspendedAt: new Date(),
          suspendedBy: new mongoose.Types.ObjectId(suspendedBy),
        },
        { upsert: true }
      );

      logger.info('Workspace AI features suspended', {
        workspaceId,
        reason,
        suspendedBy,
      });
    } catch (error) {
      logger.error('Failed to suspend workspace', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Restore workspace AI features
   */
  async restoreWorkspace(workspaceId: string): Promise<void> {
    try {
      await AIUsageLimits.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
        {
          suspended: false,
          $unset: {
            suspensionReason: 1,
            suspendedAt: 1,
            suspendedBy: 1,
          },
        }
      );

      logger.info('Workspace AI features restored', { workspaceId });
    } catch (error) {
      logger.error('Failed to restore workspace', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
      });
      throw error;
    }
  }

  // Private helper methods
  private async getOrCreateWorkspaceLimits(workspaceId: string): Promise<IAIUsageLimits> {
    let limits = await AIUsageLimits.findOne({ 
      workspaceId: new mongoose.Types.ObjectId(workspaceId) 
    });

    if (!limits) {
      // Get workspace subscription tier
      const workspace = await Workplace.findById(workspaceId)
        .populate('currentSubscriptionId')
        .select('currentSubscriptionId');
      
      let tier: keyof TierLimits = 'free_trial';
      if (workspace?.currentSubscriptionId) {
        const subscription = workspace.currentSubscriptionId as any;
        tier = subscription.tier || 'free_trial';
      }

      const tierLimits = this.DEFAULT_TIER_LIMITS[tier];
      const currentMonth = new Date().toISOString().slice(0, 7);

      limits = new AIUsageLimits({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        subscriptionTier: tier,
        limits: {
          requestsPerMonth: tierLimits.requests,
          costBudgetPerMonth: tierLimits.budget,
        },
        currentUsage: {
          month: currentMonth,
          requestCount: 0,
          totalCost: 0,
          lastResetDate: new Date(),
        },
        suspended: false,
      });

      await limits.save();
    }

    return limits;
  }

  private async updateWorkspaceUsage(workspaceId: string, cost: number): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    await AIUsageLimits.findOneAndUpdate(
      { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      {
        $inc: {
          'currentUsage.requestCount': 1,
          'currentUsage.totalCost': cost,
        },
        $set: {
          'currentUsage.month': currentMonth,
        },
      },
      { upsert: true }
    );
  }

  private async resetMonthlyUsage(workspaceId: string): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    await AIUsageLimits.findOneAndUpdate(
      { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
      {
        $set: {
          'currentUsage.month': currentMonth,
          'currentUsage.requestCount': 0,
          'currentUsage.totalCost': 0,
          'currentUsage.lastResetDate': new Date(),
        },
      }
    );
  }

  private async getTotalStats(matchStage: any) {
    const result = await AIUsageRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalCost: { $sum: '$cost' },
          successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
        },
      },
    ]);

    const stats = result[0] || { totalRequests: 0, totalCost: 0, successfulRequests: 0 };
    return {
      totalRequests: stats.totalRequests,
      totalCost: Math.round(stats.totalCost * 100) / 100,
      averageCost: stats.totalRequests > 0 ? 
        Math.round((stats.totalCost / stats.totalRequests) * 10000) / 10000 : 0,
      successRate: stats.totalRequests > 0 ? 
        Math.round((stats.successfulRequests / stats.totalRequests) * 10000) / 100 : 0,
    };
  }

  private async getTopWorkspaces(matchStage: any) {
    const result = await AIUsageRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$workspaceId',
          requests: { $sum: 1 },
          cost: { $sum: '$cost' },
        },
      },
      { $sort: { requests: -1 } },
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
        $lookup: {
          from: 'aiusagelimits',
          localField: '_id',
          foreignField: 'workspaceId',
          as: 'limits',
        },
      },
    ]);

    return result.map((item) => ({
      workspaceId: item._id.toString(),
      workspaceName: item.workspace[0]?.name || 'Unknown Workspace',
      requests: item.requests,
      cost: Math.round(item.cost * 100) / 100,
      tier: item.limits[0]?.subscriptionTier || 'free_trial',
    }));
  }

  private async getFeatureBreakdown(matchStage: any) {
    const result = await AIUsageRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$feature',
          requests: { $sum: 1 },
          cost: { $sum: '$cost' },
        },
      },
      { $sort: { requests: -1 } },
    ]);

    const totalRequests = result.reduce((sum, item) => sum + item.requests, 0);

    return result.map((item) => ({
      feature: item._id,
      requests: item.requests,
      cost: Math.round(item.cost * 100) / 100,
      percentage: totalRequests > 0 ? 
        Math.round((item.requests / totalRequests) * 10000) / 100 : 0,
    }));
  }

  private async getDailyTrends(matchStage: any) {
    const result = await AIUsageRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          requests: { $sum: 1 },
          cost: { $sum: '$cost' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      requests: item.requests,
      cost: Math.round(item.cost * 100) / 100,
    }));
  }

  private async getWorkspaceRecentActivity(workspaceId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await AIUsageRecord.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          requests: { $sum: 1 },
          cost: { $sum: '$cost' },
          features: { $addToSet: '$feature' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      requests: item.requests,
      cost: Math.round(item.cost * 100) / 100,
      features: item.features,
    }));
  }
}

export default AIUsageTrackingService;