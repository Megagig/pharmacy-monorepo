/**
 * Patient Engagement Rollout Service
 * 
 * Manages the gradual rollout of patient engagement features across workspaces.
 * Provides functionality to update rollout percentages, monitor metrics, and track adoption.
 */

import mongoose from 'mongoose';
import { FeatureFlag, IFeatureFlag } from '../models/FeatureFlag';
import { PATIENT_ENGAGEMENT_FLAGS } from '../middlewares/patientEngagementFeatureFlags';
import EnhancedFeatureFlagService from './enhancedFeatureFlagService';
import User from '../models/User';
import Workplace from '../models/Workplace';
import Subscription from '../models/Subscription';
import logger from '../utils/logger';

export interface RolloutMetrics {
  totalEligibleWorkspaces: number;
  enabledWorkspaces: number;
  rolloutPercentage: number;
  activeUsers: number;
  totalUsers: number;
  adoptionRate: number;
  errorRate: number;
  usageMetrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    appointmentsCreated: number;
    followUpsCompleted: number;
  };
}

export interface RolloutStatus {
  currentPercentage: number;
  targetPercentage: number;
  phase: 'preparation' | 'rollout' | 'monitoring' | 'complete';
  startDate: Date;
  lastUpdated: Date;
  metrics: RolloutMetrics;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
}

export class PatientEngagementRolloutService {
  /**
   * Update rollout percentage for all patient engagement features
   */
  static async updateRolloutPercentage(
    targetPercentage: number,
    updatedBy: string,
    options: {
      phaseDescription?: string;
      monitoringPeriod?: number; // hours
      rollbackThreshold?: number; // error rate percentage
    } = {}
  ): Promise<void> {
    try {
      logger.info(`Starting rollout update to ${targetPercentage}%`, {
        targetPercentage,
        updatedBy,
        options
      });

      // Validate percentage
      if (targetPercentage < 0 || targetPercentage > 100) {
        throw new Error('Rollout percentage must be between 0 and 100');
      }

      // Get all patient engagement feature flags
      const featureKeys = Object.values(PATIENT_ENGAGEMENT_FLAGS);
      
      // Update each feature flag
      const updatePromises = featureKeys.map(async (featureKey) => {
        const featureFlag = await FeatureFlag.findOne({ key: featureKey });
        
        if (!featureFlag) {
          logger.warn(`Feature flag not found: ${featureKey}`);
          return;
        }

        // Update targeting rules with new percentage
        const updatedTargetingRules = {
          ...featureFlag.targetingRules,
          percentage: targetPercentage,
          conditions: {
            ...featureFlag.targetingRules?.conditions,
            dateRange: {
              startDate: new Date(),
              endDate: undefined
            }
          }
        };

        await EnhancedFeatureFlagService.updateTargetingRules(
          featureKey,
          updatedTargetingRules,
          updatedBy
        );

        logger.info(`Updated rollout for ${featureKey} to ${targetPercentage}%`);
      });

      await Promise.all(updatePromises);

      // Log rollout update
      await this.logRolloutEvent({
        type: 'percentage_update',
        fromPercentage: await this.getCurrentRolloutPercentage(),
        toPercentage: targetPercentage,
        updatedBy,
        phaseDescription: options.phaseDescription,
        timestamp: new Date()
      });

      logger.info(`Rollout update completed successfully to ${targetPercentage}%`);
    } catch (error) {
      logger.error('Error updating rollout percentage:', error);
      throw error;
    }
  }

  /**
   * Get current rollout status and metrics
   */
  static async getRolloutStatus(): Promise<RolloutStatus> {
    try {
      const moduleFlag = await FeatureFlag.findOne({ 
        key: PATIENT_ENGAGEMENT_FLAGS.MODULE 
      });

      if (!moduleFlag) {
        throw new Error('Patient engagement module flag not found');
      }

      const currentPercentage = moduleFlag.targetingRules?.percentage || 0;
      const metrics = await this.calculateRolloutMetrics();

      // Determine phase based on percentage and activity
      let phase: RolloutStatus['phase'] = 'preparation';
      if (currentPercentage === 0) {
        phase = 'preparation';
      } else if (currentPercentage < 100) {
        phase = 'rollout';
      } else if (currentPercentage === 100) {
        phase = 'complete';
      }

      // Get recent issues from logs (this would typically come from a monitoring system)
      const issues = await this.getRecentIssues();

      return {
        currentPercentage,
        targetPercentage: currentPercentage,
        phase,
        startDate: moduleFlag.createdAt,
        lastUpdated: moduleFlag.updatedAt,
        metrics,
        issues
      };
    } catch (error) {
      logger.error('Error getting rollout status:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive rollout metrics
   */
  static async calculateRolloutMetrics(): Promise<RolloutMetrics> {
    try {
      // Get eligible workspaces (those with professional+ subscriptions)
      const eligibleSubscriptions = await Subscription.find({
        tier: { $in: ['professional', 'enterprise', 'premium'] },
        status: { $in: ['active', 'trial'] }
      });

      const totalEligibleWorkspaces = eligibleSubscriptions.length;
      const eligibleWorkspaceIds = eligibleSubscriptions.map(s => s.workspaceId);

      // Calculate how many workspaces would be enabled at current rollout percentage
      const moduleFlag = await FeatureFlag.findOne({ 
        key: PATIENT_ENGAGEMENT_FLAGS.MODULE 
      });
      const rolloutPercentage = moduleFlag?.targetingRules?.percentage || 0;
      const enabledWorkspaces = Math.floor((totalEligibleWorkspaces * rolloutPercentage) / 100);

      // Get total users in eligible workspaces
      const totalUsers = await User.countDocuments({
        workplaceId: { $in: eligibleWorkspaceIds },
        role: { $in: ['pharmacist', 'pharmacy_manager'] },
        status: 'active'
      });

      // Estimate active users (this would come from actual usage analytics)
      const activeUsers = Math.floor(totalUsers * 0.7); // Assume 70% adoption rate

      // Calculate adoption rate
      const adoptionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

      // Mock usage metrics (in production, these would come from actual usage tracking)
      const usageMetrics = {
        dailyActiveUsers: Math.floor(activeUsers * 0.3),
        weeklyActiveUsers: Math.floor(activeUsers * 0.8),
        appointmentsCreated: Math.floor(activeUsers * 2.5), // Avg 2.5 appointments per active user
        followUpsCompleted: Math.floor(activeUsers * 1.8)   // Avg 1.8 follow-ups per active user
      };

      return {
        totalEligibleWorkspaces,
        enabledWorkspaces,
        rolloutPercentage,
        activeUsers,
        totalUsers,
        adoptionRate,
        errorRate: 0.5, // Mock error rate - would come from monitoring
        usageMetrics
      };
    } catch (error) {
      logger.error('Error calculating rollout metrics:', error);
      throw error;
    }
  }

  /**
   * Get current rollout percentage
   */
  static async getCurrentRolloutPercentage(): Promise<number> {
    try {
      const moduleFlag = await FeatureFlag.findOne({ 
        key: PATIENT_ENGAGEMENT_FLAGS.MODULE 
      });
      return moduleFlag?.targetingRules?.percentage || 0;
    } catch (error) {
      logger.error('Error getting current rollout percentage:', error);
      return 0;
    }
  }

  /**
   * Check if rollout should be paused due to high error rates
   */
  static async shouldPauseRollout(errorThreshold: number = 5): Promise<{
    shouldPause: boolean;
    reason?: string;
    errorRate: number;
  }> {
    try {
      const metrics = await this.calculateRolloutMetrics();
      
      if (metrics.errorRate > errorThreshold) {
        return {
          shouldPause: true,
          reason: `Error rate (${metrics.errorRate}%) exceeds threshold (${errorThreshold}%)`,
          errorRate: metrics.errorRate
        };
      }

      // Check for other pause conditions
      if (metrics.adoptionRate < 10 && metrics.rolloutPercentage > 25) {
        return {
          shouldPause: true,
          reason: `Low adoption rate (${metrics.adoptionRate}%) despite ${metrics.rolloutPercentage}% rollout`,
          errorRate: metrics.errorRate
        };
      }

      return {
        shouldPause: false,
        errorRate: metrics.errorRate
      };
    } catch (error) {
      logger.error('Error checking rollout pause conditions:', error);
      return {
        shouldPause: true,
        reason: 'Error checking rollout conditions',
        errorRate: 100
      };
    }
  }

  /**
   * Get workspaces that are currently enabled for patient engagement
   */
  static async getEnabledWorkspaces(): Promise<Array<{
    workspaceId: string;
    workspaceName: string;
    userCount: number;
    subscriptionTier: string;
  }>> {
    try {
      const moduleFlag = await FeatureFlag.findOne({ 
        key: PATIENT_ENGAGEMENT_FLAGS.MODULE 
      });

      if (!moduleFlag || !moduleFlag.targetingRules?.percentage) {
        return [];
      }

      // Get eligible workspaces
      const eligibleSubscriptions = await Subscription.find({
        tier: { $in: ['professional', 'enterprise', 'premium'] },
        status: { $in: ['active', 'trial'] }
      }).populate('workspaceId');

      // Simulate which workspaces are enabled based on percentage rollout
      const rolloutPercentage = moduleFlag.targetingRules.percentage;
      const enabledCount = Math.floor((eligibleSubscriptions.length * rolloutPercentage) / 100);
      
      // Use consistent hashing to determine which workspaces are enabled
      const enabledWorkspaces = eligibleSubscriptions
        .sort((a, b) => a.workspaceId.toString().localeCompare(b.workspaceId.toString()))
        .slice(0, enabledCount);

      // Get user counts for each enabled workspace
      const result = await Promise.all(
        enabledWorkspaces.map(async (subscription) => {
          const workspace = subscription.workspaceId as any;
          const userCount = await User.countDocuments({
            workplaceId: workspace._id,
            role: { $in: ['pharmacist', 'pharmacy_manager'] },
            status: 'active'
          });

          return {
            workspaceId: workspace._id.toString(),
            workspaceName: workspace.name || 'Unknown Workspace',
            userCount,
            subscriptionTier: subscription.tier
          };
        })
      );

      return result;
    } catch (error) {
      logger.error('Error getting enabled workspaces:', error);
      throw error;
    }
  }

  /**
   * Log rollout events for audit trail
   */
  private static async logRolloutEvent(event: {
    type: string;
    fromPercentage?: number;
    toPercentage?: number;
    updatedBy: string;
    phaseDescription?: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      // In production, this would log to a dedicated rollout audit collection
      logger.info('Rollout event logged', {
        module: 'patient_engagement',
        ...event
      });
    } catch (error) {
      logger.error('Error logging rollout event:', error);
    }
  }

  /**
   * Get recent issues from monitoring systems
   */
  private static async getRecentIssues(): Promise<Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>> {
    try {
      // In production, this would query actual monitoring/alerting systems
      // For now, return mock data
      return [
        {
          severity: 'low',
          message: 'Reminder delivery rate slightly below target (94% vs 95%)',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          resolved: false
        }
      ];
    } catch (error) {
      logger.error('Error getting recent issues:', error);
      return [];
    }
  }

  /**
   * Generate rollout report
   */
  static async generateRolloutReport(): Promise<{
    summary: RolloutStatus;
    enabledWorkspaces: Array<{
      workspaceId: string;
      workspaceName: string;
      userCount: number;
      subscriptionTier: string;
    }>;
    recommendations: string[];
  }> {
    try {
      const summary = await this.getRolloutStatus();
      const enabledWorkspaces = await this.getEnabledWorkspaces();
      const pauseCheck = await this.shouldPauseRollout();

      // Generate recommendations based on current state
      const recommendations: string[] = [];

      if (pauseCheck.shouldPause) {
        recommendations.push(`⚠️ Consider pausing rollout: ${pauseCheck.reason}`);
      }

      if (summary.metrics.adoptionRate < 50) {
        recommendations.push('📈 Low adoption rate detected. Consider additional user training or feature improvements.');
      }

      if (summary.metrics.errorRate > 2) {
        recommendations.push('🔧 Error rate is elevated. Review system logs and consider bug fixes.');
      }

      if (summary.currentPercentage < 100 && summary.metrics.errorRate < 1 && summary.metrics.adoptionRate > 70) {
        recommendations.push('✅ Metrics look good. Consider increasing rollout percentage.');
      }

      if (enabledWorkspaces.length > 0) {
        const avgUsersPerWorkspace = enabledWorkspaces.reduce((sum, ws) => sum + ws.userCount, 0) / enabledWorkspaces.length;
        recommendations.push(`📊 Average ${avgUsersPerWorkspace.toFixed(1)} users per enabled workspace.`);
      }

      return {
        summary,
        enabledWorkspaces,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating rollout report:', error);
      throw error;
    }
  }
}

export default PatientEngagementRolloutService;