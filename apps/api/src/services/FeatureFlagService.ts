/**
 * Feature Flag Service
 * 
 * Manages feature flag evaluation, user-based rollouts, and overrides
 * for performance optimization features.
 */

import { createHash } from 'crypto';
import { FeatureFlag } from '../models/FeatureFlag';
import { getPerformanceFeatureFlags, PerformanceFeatureFlags } from '../config/featureFlags';
import logger from '../utils/logger';

export interface FeatureFlagEvaluation {
  enabled: boolean;
  reason: string;
  rolloutPercentage: number;
  userPercentile?: number;
  override?: boolean;
  lastEvaluated: Date;
}

export interface FeatureFlagMetrics {
  featureName: string;
  totalEvaluations: number;
  enabledEvaluations: number;
  enabledPercentage: number;
  lastEvaluated: Date;
}

class FeatureFlagService {
  private cache = new Map<string, FeatureFlagEvaluation>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private metrics = new Map<string, FeatureFlagMetrics>();

  /**
   * Evaluate if a feature is enabled for a specific user and workspace
   */
  async isFeatureEnabled(
    featureName: string,
    userId: string,
    workspaceId: string
  ): Promise<FeatureFlagEvaluation> {
    try {
      // Check cache first
      const cacheKey = `${featureName}:${userId}:${workspaceId}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.lastEvaluated.getTime() < this.cacheTimeout) {
        this.updateMetrics(featureName, cached.enabled);
        return cached as any;
      }

      // Check if this is a patient engagement feature flag
      const isPatientEngagementFlag = [
        'patient_engagement_module',
        'appointment_scheduling',
        'followup_task_management',
        'smart_reminder_system',
        'patient_portal',
        'recurring_appointments',
        'clinical_alerts',
        'engagement_analytics',
        'schedule_management',
        'engagement_module_integration'
      ].includes(featureName);

      if (isPatientEngagementFlag) {
        // For patient engagement flags, check database first
        const dbFlag = await this.getDatabaseFeatureFlag(featureName);
        if (dbFlag !== null) {
          const result = {
            enabled: dbFlag,
            reason: dbFlag ? 'Database flag enabled' : 'Database flag disabled',
            rolloutPercentage: 100,
            lastEvaluated: new Date(),
          };
          this.cache.set(cacheKey, result);
          this.updateMetrics(featureName, dbFlag);
          return result;
        }
      }

      // Get global feature flag configuration for performance flags
      const globalFlags = getPerformanceFeatureFlags();
      const isGloballyEnabled = this.getGlobalFeatureFlag(globalFlags, featureName);

      if (!isGloballyEnabled) {
        const result = {
          enabled: false,
          reason: 'Feature globally disabled',
          rolloutPercentage: 0,
          lastEvaluated: new Date(),
        };
        this.cache.set(cacheKey, result);
        this.updateMetrics(featureName, false);
        return result;
      }

      // Check user-specific override
      const userOverride = await this.getUserFeatureOverride(featureName, userId);
      if (userOverride !== null) {
        const result = {
          enabled: userOverride,
          reason: userOverride ? 'User override: enabled' : 'User override: disabled',
          rolloutPercentage: globalFlags.rolloutPercentage,
          override: true,
          lastEvaluated: new Date(),
        };
        this.cache.set(cacheKey, result);
        this.updateMetrics(featureName, userOverride);
        return result;
      }

      // Check workspace-specific override
      const workspaceOverride = await this.getWorkspaceFeatureOverride(featureName, workspaceId);
      if (workspaceOverride !== null) {
        const result = {
          enabled: workspaceOverride,
          reason: workspaceOverride ? 'Workspace override: enabled' : 'Workspace override: disabled',
          rolloutPercentage: globalFlags.rolloutPercentage,
          override: true,
          lastEvaluated: new Date(),
        };
        this.cache.set(cacheKey, result);
        this.updateMetrics(featureName, workspaceOverride);
        return result;
      }

      // Check internal testing
      if (globalFlags.internalTesting) {
        const isInternalUser = await this.isInternalUser(userId);
        if (isInternalUser) {
          const result = {
            enabled: true,
            reason: 'Internal testing user',
            rolloutPercentage: globalFlags.rolloutPercentage,
            lastEvaluated: new Date(),
          };
          this.cache.set(cacheKey, result);
          this.updateMetrics(featureName, true);
          return result;
        }
      }

      // Check beta users
      if (globalFlags.betaUsers) {
        const isBetaUser = await this.isBetaUser(userId, workspaceId);
        if (isBetaUser) {
          const result = {
            enabled: true,
            reason: 'Beta user',
            rolloutPercentage: globalFlags.rolloutPercentage,
            lastEvaluated: new Date(),
          };
          this.cache.set(cacheKey, result);
          this.updateMetrics(featureName, true);
          return result;
        }
      }

      // Check rollout percentage
      if (globalFlags.rolloutPercentage < 100) {
        const userPercentile = this.getUserPercentile(userId, workspaceId, featureName);
        const enabled = userPercentile < globalFlags.rolloutPercentage;

        const result = {
          enabled,
          reason: enabled
            ? `Rollout: user in ${globalFlags.rolloutPercentage}% (percentile: ${userPercentile})`
            : `Rollout: user not in ${globalFlags.rolloutPercentage}% (percentile: ${userPercentile})`,
          rolloutPercentage: globalFlags.rolloutPercentage,
          userPercentile,
          lastEvaluated: new Date(),
        };
        this.cache.set(cacheKey, result);
        this.updateMetrics(featureName, enabled);
        return result;
      }

      // Feature is fully enabled
      const result = {
        enabled: true,
        reason: 'Feature fully enabled',
        rolloutPercentage: globalFlags.rolloutPercentage,
        lastEvaluated: new Date(),
      };
      this.cache.set(cacheKey, result);
      this.updateMetrics(featureName, true);
      return result;

    } catch (error) {
      logger.error('Feature flag evaluation error:', error);

      // Fail safe: return false for unknown features
      const result = {
        enabled: false,
        reason: `Evaluation error: ${error.message}`,
        rolloutPercentage: 0,
        lastEvaluated: new Date(),
      };
      this.updateMetrics(featureName, false);
      return result;
    }
  }

  /**
   * Get global feature flag status
   */
  private getGlobalFeatureFlag(flags: PerformanceFeatureFlags, featureName: string): boolean {
    // Performance feature flags
    switch (featureName) {
      case 'themeOptimization':
        return flags.themeOptimization;
      case 'bundleOptimization':
        return flags.bundleOptimization;
      case 'apiCaching':
        return flags.apiCaching;
      case 'databaseOptimization':
        return flags.databaseOptimization;
      case 'performanceMonitoring':
        return flags.performanceMonitoring;
      case 'cursorPagination':
        return flags.cursorPagination;
      case 'backgroundJobs':
        return flags.backgroundJobs;
      case 'serviceWorker':
        return flags.serviceWorker;
      case 'virtualization':
        return flags.virtualization;
      case 'reactQueryOptimization':
        return flags.reactQueryOptimization;
      
      // Patient engagement feature flags - check database instead of config
      case 'patient_engagement_module':
      case 'appointment_scheduling':
      case 'followup_task_management':
      case 'smart_reminder_system':
      case 'patient_portal':
      case 'recurring_appointments':
      case 'clinical_alerts':
      case 'engagement_analytics':
      case 'schedule_management':
      case 'engagement_module_integration':
        return true; // Let database override handle the actual check
      
      default:
        return false;
    }
  }

  /**
   * Get user-specific feature override
   */
  private async getUserFeatureOverride(featureName: string, userId: string): Promise<boolean | null> {
    try {
      const override = await FeatureFlag.findOne({
        featureName,
        userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      return override ? override.isActive : null;
    } catch (error) {
      logger.error('Error getting user feature override:', error);
      return null;
    }
  }

  /**
   * Get workspace-specific feature override
   */
  private async getWorkspaceFeatureOverride(featureName: string, workspaceId: string): Promise<boolean | null> {
    try {
      const override = await FeatureFlag.findOne({
        featureName,
        workspaceId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      return override ? override.isActive : null;
    } catch (error) {
      logger.error('Error getting workspace feature override:', error);
      return null;
    }
  }

  /**
   * Get database feature flag status (for patient engagement flags)
   */
  private async getDatabaseFeatureFlag(featureName: string): Promise<boolean | null> {
    try {
      const flag = await FeatureFlag.findOne({
        key: featureName,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      return flag ? flag.isActive : null;
    } catch (error) {
      logger.error('Error getting database feature flag:', error);
      return null;
    }
  }

  /**
   * Check if user is internal (for internal testing)
   */
  private async isInternalUser(userId: string): Promise<boolean> {
    try {
      // Implementation depends on your user model
      // This is a placeholder - implement based on your user structure
      const User = require('../models/User').default;
      const user = await User.findById(userId);
      return user?.email?.endsWith('@PharmacyCopilot.com') || false;
    } catch (error) {
      logger.error('Error checking internal user:', error);
      return false;
    }
  }

  /**
   * Check if user is beta user
   */
  private async isBetaUser(userId: string, workspaceId: string): Promise<boolean> {
    try {
      // Implementation depends on your user/workspace model
      // This is a placeholder - implement based on your structure
      const User = require('../models/User').default;
      const user = await User.findById(userId);
      return user?.betaUser === true || false;
    } catch (error) {
      logger.error('Error checking beta user:', error);
      return false;
    }
  }

  /**
   * Calculate user percentile for consistent rollout
   */
  private getUserPercentile(userId: string, workspaceId: string, featureName: string): number {
    const input = `${userId}:${workspaceId}:${featureName}`;
    const hash = createHash('md5').update(input).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % 100;
  }

  /**
   * Update feature flag metrics
   */
  private updateMetrics(featureName: string, enabled: boolean): void {
    const existing = this.metrics.get(featureName) || {
      featureName,
      totalEvaluations: 0,
      enabledEvaluations: 0,
      enabledPercentage: 0,
      lastEvaluated: new Date(),
    };

    existing.totalEvaluations++;
    if (enabled) {
      existing.enabledEvaluations++;
    }
    existing.enabledPercentage = (existing.enabledEvaluations / existing.totalEvaluations) * 100;
    existing.lastEvaluated = new Date();

    this.metrics.set(featureName, existing);
  }

  /**
   * Get feature flag metrics
   */
  getMetrics(): FeatureFlagMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear cache (useful for testing or immediate updates)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set user feature override
   */
  async setUserFeatureOverride(
    featureName: string,
    userId: string,
    enabled: boolean,
    expiresAt?: Date,
    reason?: string
  ): Promise<void> {
    try {
      await FeatureFlag.findOneAndUpdate(
        { featureName, userId },
        {
          featureName,
          userId,
          enabled,
          expiresAt,
          reason,
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      // Clear cache for this user
      const cachePattern = `${featureName}:${userId}:`;
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(cachePattern)) {
          this.cache.delete(key);
        }
      }

      logger.info(`Feature override set: ${featureName} = ${enabled} for user ${userId}`);
    } catch (error) {
      logger.error('Error setting user feature override:', error);
      throw error;
    }
  }

  /**
   * Set workspace feature override
   */
  async setWorkspaceFeatureOverride(
    featureName: string,
    workspaceId: string,
    enabled: boolean,
    expiresAt?: Date,
    reason?: string
  ): Promise<void> {
    try {
      await FeatureFlag.findOneAndUpdate(
        { featureName, workspaceId },
        {
          featureName,
          workspaceId,
          enabled,
          expiresAt,
          reason,
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      // Clear cache for this workspace
      const cachePattern = `${featureName}:`;
      for (const key of Array.from(this.cache.keys())) {
        if (key.includes(`:${workspaceId}`)) {
          this.cache.delete(key);
        }
      }

      logger.info(`Feature override set: ${featureName} = ${enabled} for workspace ${workspaceId}`);
    } catch (error) {
      logger.error('Error setting workspace feature override:', error);
      throw error;
    }
  }

  /**
   * Remove feature override
   */
  async removeFeatureOverride(featureName: string, userId?: string, workspaceId?: string): Promise<void> {
    try {
      const query: any = { featureName };
      if (userId) query.userId = userId;
      if (workspaceId) query.workspaceId = workspaceId;

      await FeatureFlag.deleteMany(query);

      // Clear relevant cache entries
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(`${featureName}:`)) {
          if (!userId && !workspaceId) {
            this.cache.delete(key);
          } else if (userId && key.includes(`:${userId}:`)) {
            this.cache.delete(key);
          } else if (workspaceId && key.includes(`:${workspaceId}`)) {
            this.cache.delete(key);
          }
        }
      }

      logger.info(`Feature override removed: ${featureName}`);
    } catch (error) {
      logger.error('Error removing feature override:', error);
      throw error;
    }
  }

  /**
   * Get all feature overrides
   */
  async getFeatureOverrides(featureName?: string): Promise<any[]> {
    try {
      const query = featureName ? { featureName } : {};
      return await FeatureFlag.find(query).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error getting feature overrides:', error);
      throw error;
    }
  }
}

export default new FeatureFlagService();
