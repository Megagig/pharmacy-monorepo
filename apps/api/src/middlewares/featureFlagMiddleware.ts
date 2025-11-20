import { Request, Response, NextFunction } from 'express';
import { FeatureFlag, IFeatureFlag } from '../models/FeatureFlag';
import { IUser } from '../models/User';
import { ISubscription } from '../models/Subscription';

interface FeatureFlagRequest extends Request {
  user?: IUser;
  subscription?: ISubscription;
  featureFlag?: IFeatureFlag;
}

/**
 * Feature flag registry middleware that centralizes feature access control
 * This middleware loads the feature flag configuration and attaches it to the request
 */
export const loadFeatureFlag = (featureKey: string) => {
  return async (
    req: FeatureFlagRequest,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    try {
      const featureFlag = await FeatureFlag.findOne({
        key: featureKey,
        isActive: true,
      });

      if (!featureFlag) {
        return res.status(404).json({
          success: false,
          message: 'Feature not available or has been disabled',
          feature: featureKey,
        });
      }

      req.featureFlag = featureFlag;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error loading feature flag configuration',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  };
};

/**
 * Feature gate middleware that checks if a user has access to a feature
 * based on their subscription plan, role, and custom rules
 */
export const gateAccess = () => {
  return async (
    req: FeatureFlagRequest,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    try {
      if (!req.user || !req.subscription || !req.featureFlag) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Missing required context.',
        });
      }

      const user = req.user;
      const subscription = req.subscription;
      const featureFlag = req.featureFlag;

      // Super admin bypass
      if (user.role === 'super_admin') {
        return next();
      }

      // Check subscription tier access
      if (!featureFlag.allowedTiers.includes(subscription.tier)) {
        return res.status(403).json({
          success: false,
          message: `This feature is not available in your ${subscription.tier} plan`,
          currentPlan: subscription.tier,
          requiredPlans: featureFlag.allowedTiers,
          feature: featureFlag.name,
          upgradeRequired: true,
        });
      }

      // Check role-based access
      if (featureFlag.allowedRoles.length > 0) {
        const userRole = user.role;
        if (!featureFlag.allowedRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            message: `This feature is not available for ${userRole} role`,
            currentRole: userRole,
            requiredRoles: featureFlag.allowedRoles,
            feature: featureFlag.name,
          });
        }
      }

      // Check custom rules
      if (featureFlag.customRules) {
        // Check license requirement
        if (
          featureFlag.customRules.requiredLicense &&
          ['pharmacist', 'intern_pharmacist'].includes(user.role) &&
          user.licenseStatus !== 'approved'
        ) {
          return res.status(403).json({
            success: false,
            message: 'This feature requires a verified license',
            licenseStatus: user.licenseStatus,
            requiresAction: 'license_verification',
            feature: featureFlag.name,
          });
        }

        // Check max users limit for team features
        if (featureFlag.customRules.maxUsers && user.teamMembers) {
          const teamSize = user.teamMembers.length + 1; // Including the user
          if (teamSize > featureFlag.customRules.maxUsers) {
            return res.status(403).json({
              success: false,
              message: `Your team size (${teamSize}) exceeds the limit for this feature (${featureFlag.customRules.maxUsers})`,
              currentTeamSize: teamSize,
              maxAllowed: featureFlag.customRules.maxUsers,
              feature: featureFlag.name,
              upgradeRequired: true,
            });
          }
        }

        // Future custom logic evaluation can be added here
        // if (featureFlag.customRules.customLogic) { ... }
      }

      // All checks passed, proceed to the next middleware
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error evaluating feature access',
        error:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  };
};

/**
 * Combine feature flag loading and access gating into a single middleware
 * This is the main middleware that should be used in routes
 */
export const requireFeatureAccess = (featureKey: string) => {
  return [loadFeatureFlag(featureKey), gateAccess()];
};

/**
 * Usage tracking middleware to monitor feature usage
 * This middleware increments usage counters for metered features
 */
export const trackFeatureUsage = (featureKey: string) => {
  return async (
    req: FeatureFlagRequest,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    try {
      if (!req.user || !req.subscription) {
        return next();
      }

      const subscription = req.subscription;

      // Find existing usage metric or create a new one
      const metricIndex = subscription.usageMetrics.findIndex(
        (metric) => metric.feature === featureKey
      );

      if (metricIndex !== -1) {
        const metric = subscription.usageMetrics[metricIndex];
        if (metric) {
          metric.count = (metric.count || 0) + 1;
          metric.lastUpdated = new Date();
        }
      } else {
        subscription.usageMetrics.push({
          feature: featureKey,
          count: 1,
          lastUpdated: new Date(),
        });
      }

      // Save the updated usage metrics
      await subscription.save();

      next();
    } catch (error) {
      // Don't block the request if tracking fails, just log the error
      console.error('Feature usage tracking error:', error);
      next();
    }
  };
};
