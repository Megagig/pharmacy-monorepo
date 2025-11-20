import { FeatureFlag, IFeatureFlag, ITargetingRules, IUsageMetrics } from '../models/FeatureFlag';
import User from '../models/User';
import Workplace from '../models/Workplace';
import Subscription from '../models/Subscription';
import mongoose from 'mongoose';

export class EnhancedFeatureFlagService {
  /**
   * Check if a user has access to a feature based on advanced targeting rules
   */
  static async hasAdvancedFeatureAccess(
    userId: string,
    featureKey: string,
    workspaceId?: string
  ): Promise<{
    hasAccess: boolean;
    reason: string;
    targetingApplied: boolean;
  }> {
    try {
      const featureFlag = await FeatureFlag.findOne({
        key: featureKey,
        isActive: true,
      });

      if (!featureFlag) {
        return {
          hasAccess: false,
          reason: 'Feature flag not found or inactive',
          targetingApplied: false,
        };
      }

      const user = await User.findById(userId).populate('workplaceId');
      if (!user) {
        return {
          hasAccess: false,
          reason: 'User not found',
          targetingApplied: false,
        };
      }

      // Check basic tier and role access first
      const subscription = workspaceId 
        ? await Subscription.findOne({ workspaceId, status: { $in: ['active', 'trial'] } })
        : null;

      const userTier = subscription?.tier || 'free_trial';
      const hasBasicAccess = 
        featureFlag.allowedTiers.includes(userTier) &&
        featureFlag.allowedRoles.includes(user.role as string);

      if (!hasBasicAccess) {
        return {
          hasAccess: false,
          reason: `User tier (${userTier}) or role (${user.role}) not allowed`,
          targetingApplied: false,
        };
      }

      // Apply advanced targeting rules if they exist
      const targetingRules = featureFlag.targetingRules;
      if (!targetingRules) {
        return {
          hasAccess: true,
          reason: 'Basic access granted, no targeting rules',
          targetingApplied: false,
        };
      }

      // Check pharmacy targeting
      if (targetingRules.pharmacies && targetingRules.pharmacies.length > 0) {
        const workplace = user.workplaceId as any;
        if (!workplace || !targetingRules.pharmacies.includes(workplace._id.toString())) {
          return {
            hasAccess: false,
            reason: 'Pharmacy not in targeting list',
            targetingApplied: true,
          };
        }
      }

      // Check user group targeting
      if (targetingRules.userGroups && targetingRules.userGroups.length > 0) {
        if (!targetingRules.userGroups.includes(user.role as string)) {
          return {
            hasAccess: false,
            reason: 'User group not in targeting list',
            targetingApplied: true,
          };
        }
      }

      // Check percentage rollout
      if (targetingRules.percentage !== undefined && targetingRules.percentage < 100) {
        const userHash = this.generateUserHash(userId, featureKey);
        const userPercentile = userHash % 100;
        
        if (userPercentile >= targetingRules.percentage) {
          return {
            hasAccess: false,
            reason: `User not in ${targetingRules.percentage}% rollout`,
            targetingApplied: true,
          };
        }
      }

      // Check date range conditions
      if (targetingRules.conditions?.dateRange) {
        const now = new Date();
        const { startDate, endDate } = targetingRules.conditions.dateRange;
        
        if (startDate && now < startDate) {
          return {
            hasAccess: false,
            reason: 'Feature not yet available (date range)',
            targetingApplied: true,
          };
        }
        
        if (endDate && now > endDate) {
          return {
            hasAccess: false,
            reason: 'Feature no longer available (date range)',
            targetingApplied: true,
          };
        }
      }

      return {
        hasAccess: true,
        reason: 'Advanced targeting rules passed',
        targetingApplied: true,
      };

    } catch (error) {
      console.error('Error checking advanced feature access:', error);
      return {
        hasAccess: false,
        reason: 'Error checking feature access',
        targetingApplied: false,
      };
    }
  }

  /**
   * Update targeting rules for a feature flag
   */
  static async updateTargetingRules(
    featureKey: string,
    targetingRules: ITargetingRules,
    updatedBy: string
  ): Promise<IFeatureFlag | null> {
    try {
      const featureFlag = await FeatureFlag.findOneAndUpdate(
        { key: featureKey },
        {
          $set: {
            targetingRules,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

      return featureFlag;
    } catch (error) {
      console.error('Error updating targeting rules:', error);
      throw error;
    }
  }

  /**
   * Calculate usage metrics for a feature flag
   */
  static async calculateUsageMetrics(featureKey: string): Promise<IUsageMetrics> {
    try {
      // This would typically query your analytics/usage tracking system
      // For now, we'll return mock data that can be replaced with real analytics
      
      const featureFlag = await FeatureFlag.findOne({ key: featureKey });
      if (!featureFlag) {
        throw new Error('Feature flag not found');
      }

      // Get total users who have access to this feature
      const allowedTiers = featureFlag.allowedTiers;
      const subscriptions = await Subscription.find({
        tier: { $in: allowedTiers },
        status: { $in: ['active', 'trial'] },
      });

      const workspaceIds = subscriptions.map(s => s.workspaceId);
      const totalUsers = await User.countDocuments({
        workplaceId: { $in: workspaceIds },
        role: { $in: featureFlag.allowedRoles },
        status: 'active',
      });

      // Calculate usage by plan
      const usageByPlan = await Promise.all(
        allowedTiers.map(async (tier) => {
          const tierSubscriptions = await Subscription.find({ tier, status: { $in: ['active', 'trial'] } });
          const tierWorkspaceIds = tierSubscriptions.map(s => s.workspaceId);
          const tierUserCount = await User.countDocuments({
            workplaceId: { $in: tierWorkspaceIds },
            role: { $in: featureFlag.allowedRoles },
            status: 'active',
          });

          return {
            plan: tier,
            userCount: tierUserCount,
            percentage: totalUsers > 0 ? Math.round((tierUserCount / totalUsers) * 100) : 0,
          };
        })
      );

      // Calculate usage by workspace (top 10)
      const usageByWorkspace = await Promise.all(
        workspaceIds.slice(0, 10).map(async (wsId) => {
          const workspace = await Workplace.findById(wsId);
          const workspaceUserCount = await User.countDocuments({
            workplaceId: wsId,
            role: { $in: featureFlag.allowedRoles },
            status: 'active',
          });

          return {
            workspaceId: wsId.toString(),
            workspaceName: workspace?.name || 'Unknown Workspace',
            userCount: workspaceUserCount,
          };
        })
      );

      // For now, assume 70% of eligible users are "active" users
      const activeUsers = Math.round(totalUsers * 0.7);
      const usagePercentage = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

      const usageMetrics: IUsageMetrics = {
        totalUsers,
        activeUsers,
        usagePercentage,
        lastUsed: new Date(),
        usageByPlan: usageByPlan.filter(p => p.userCount > 0),
        usageByWorkspace: usageByWorkspace.filter(w => w.userCount > 0),
      };

      // Update the feature flag with the calculated metrics
      await FeatureFlag.findOneAndUpdate(
        { key: featureKey },
        { $set: { usageMetrics } }
      );

      return usageMetrics;
    } catch (error) {
      console.error('Error calculating usage metrics:', error);
      throw error;
    }
  }

  /**
   * Get feature flags for marketing/pricing display
   */
  static async getMarketingFeatures(tier?: string): Promise<IFeatureFlag[]> {
    try {
      const query: any = {
        isActive: true,
        'metadata.isMarketingFeature': true,
      };

      if (tier) {
        query.allowedTiers = tier;
      }

      const features = await FeatureFlag.find(query)
        .sort({ 'metadata.displayOrder': 1, name: 1 })
        .lean();

      return features;
    } catch (error) {
      console.error('Error fetching marketing features:', error);
      throw error;
    }
  }

  /**
   * Generate a consistent hash for percentage rollouts
   */
  private static generateUserHash(userId: string, featureKey: string): number {
    const str = `${userId}-${featureKey}`;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Validate targeting rules
   */
  static validateTargetingRules(rules: ITargetingRules): { isValid: boolean; error?: string } {
    if (rules.percentage !== undefined) {
      if (rules.percentage < 0 || rules.percentage > 100) {
        return { isValid: false, error: 'Percentage must be between 0 and 100' };
      }
    }

    if (rules.conditions?.dateRange) {
      const { startDate, endDate } = rules.conditions.dateRange;
      if (startDate && endDate && startDate >= endDate) {
        return { isValid: false, error: 'Start date must be before end date' };
      }
    }

    return { isValid: true };
  }
}

export default EnhancedFeatureFlagService;