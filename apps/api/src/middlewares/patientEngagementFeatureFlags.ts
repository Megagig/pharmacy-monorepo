/**
 * Patient Engagement Feature Flag Middleware
 * 
 * Middleware to check if patient engagement features are enabled
 * before allowing access to related endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import FeatureFlagService from '../services/FeatureFlagService';
import logger from '../utils/logger';

// Feature flag keys for patient engagement module
export const PATIENT_ENGAGEMENT_FLAGS = {
  MODULE: 'patient_engagement_module',
  APPOINTMENTS: 'appointment_scheduling',
  FOLLOW_UPS: 'followup_task_management',
  REMINDERS: 'smart_reminder_system',
  PATIENT_PORTAL: 'patient_portal',
  RECURRING_APPOINTMENTS: 'recurring_appointments',
  CLINICAL_ALERTS: 'clinical_alerts',
  ANALYTICS: 'engagement_analytics',
  SCHEDULE_MANAGEMENT: 'schedule_management',
  MODULE_INTEGRATION: 'engagement_module_integration'
} as const;

export type PatientEngagementFlag = typeof PATIENT_ENGAGEMENT_FLAGS[keyof typeof PATIENT_ENGAGEMENT_FLAGS];

/**
 * Check if a specific patient engagement feature is enabled
 */
export const checkFeatureFlag = (featureFlag: PatientEngagementFlag) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const workspaceId = req.user?.workplaceId;

      if (!userId || !workspaceId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if the feature is enabled for this user/workspace
      const evaluation = await FeatureFlagService.isFeatureEnabled(
        featureFlag,
        userId.toString(),
        workspaceId.toString()
      );

      if (!evaluation.enabled) {
        logger.warn(`Feature flag check failed: ${featureFlag}`, {
          userId,
          workspaceId,
          reason: evaluation.reason,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          message: 'This feature is not available',
          featureFlag,
          reason: evaluation.reason
        });
      }

      // Log successful feature access
      logger.info(`Feature flag check passed: ${featureFlag}`, {
        userId,
        workspaceId,
        reason: evaluation.reason,
        endpoint: req.path
      });

      // Add feature flag info to request for downstream use
      req.featureFlags = req.featureFlags || {} as any;
      (req.featureFlags as any)[featureFlag] = evaluation;

      next();
    } catch (error) {
      logger.error(`Feature flag check error: ${featureFlag}`, error);
      
      // Fail safe: deny access on error
      return res.status(500).json({
        success: false,
        message: 'Feature availability check failed'
      });
    }
  };
};

/**
 * Check if the main patient engagement module is enabled
 */
export const requirePatientEngagementModule = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.MODULE);

/**
 * Check if appointment scheduling is enabled
 */
export const requireAppointmentScheduling = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.APPOINTMENTS);

/**
 * Check if follow-up management is enabled
 */
export const requireFollowUpManagement = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.FOLLOW_UPS);

/**
 * Check if reminder system is enabled
 */
export const requireReminderSystem = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.REMINDERS);

/**
 * Check if patient portal is enabled
 */
export const requirePatientPortal = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.PATIENT_PORTAL);

/**
 * Check if recurring appointments are enabled
 */
export const requireRecurringAppointments = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.RECURRING_APPOINTMENTS);

/**
 * Check if clinical alerts are enabled
 */
export const requireClinicalAlerts = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.CLINICAL_ALERTS);

/**
 * Check if engagement analytics are enabled
 */
export const requireEngagementAnalytics = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.ANALYTICS);

/**
 * Check if schedule management is enabled
 */
export const requireScheduleManagement = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.SCHEDULE_MANAGEMENT);

/**
 * Check if module integration is enabled
 */
export const requireModuleIntegration = checkFeatureFlag(PATIENT_ENGAGEMENT_FLAGS.MODULE_INTEGRATION);

/**
 * Middleware to check multiple feature flags (OR logic)
 * Passes if ANY of the specified flags are enabled
 */
export const requireAnyFeature = (featureFlags: PatientEngagementFlag[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const workspaceId = req.user?.workplaceId;

      if (!userId || !workspaceId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const evaluations = await Promise.all(
        featureFlags.map(flag => 
          FeatureFlagService.isFeatureEnabled(
            flag,
            userId.toString(),
            workspaceId.toString()
          )
        )
      );

      const enabledFlags = evaluations.filter(evaluation => evaluation.enabled);

      if (enabledFlags.length === 0) {
        logger.warn(`Multiple feature flag check failed`, {
          userId,
          workspaceId,
          requiredFlags: featureFlags,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          message: 'None of the required features are available',
          requiredFeatures: featureFlags
        });
      }

      // Add all evaluations to request
      req.featureFlags = req.featureFlags || {} as any;
      featureFlags.forEach((flag, index) => {
        (req.featureFlags as any)![flag] = evaluations[index];
      });

      next();
    } catch (error) {
      logger.error('Multiple feature flag check error', error);
      
      return res.status(500).json({
        success: false,
        message: 'Feature availability check failed'
      });
    }
  };
};

/**
 * Middleware to check multiple feature flags (AND logic)
 * Passes only if ALL specified flags are enabled
 */
export const requireAllFeatures = (featureFlags: PatientEngagementFlag[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const workspaceId = req.user?.workplaceId;

      if (!userId || !workspaceId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const evaluations = await Promise.all(
        featureFlags.map(flag => 
          FeatureFlagService.isFeatureEnabled(
            flag,
            userId.toString(),
            workspaceId.toString()
          )
        )
      );

      const disabledFlags = featureFlags.filter((flag, index) => !evaluations[index].enabled);

      if (disabledFlags.length > 0) {
        logger.warn(`All features check failed`, {
          userId,
          workspaceId,
          requiredFlags: featureFlags,
          disabledFlags,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          message: 'Some required features are not available',
          requiredFeatures: featureFlags,
          disabledFeatures: disabledFlags
        });
      }

      // Add all evaluations to request
      req.featureFlags = req.featureFlags || {} as any;
      featureFlags.forEach((flag, index) => {
        (req.featureFlags as any)![flag] = evaluations[index];
      });

      next();
    } catch (error) {
      logger.error('All features check error', error);
      
      return res.status(500).json({
        success: false,
        message: 'Feature availability check failed'
      });
    }
  };
};

/**
 * Utility function to check feature flags in service layer
 */
export const isPatientEngagementFeatureEnabled = async (
  featureFlag: PatientEngagementFlag,
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  try {
    const evaluation = await FeatureFlagService.isFeatureEnabled(
      featureFlag,
      userId,
      workspaceId
    );
    return evaluation.enabled;
  } catch (error) {
    logger.error(`Feature flag check error in service: ${featureFlag}`, error);
    return false; // Fail safe
  }
};

/**
 * Extend AuthRequest type to include feature flag evaluations
 * Note: Using the existing featureFlags property from config/featureFlags.ts
 */

export default {
  checkFeatureFlag,
  requirePatientEngagementModule,
  requireAppointmentScheduling,
  requireFollowUpManagement,
  requireReminderSystem,
  requirePatientPortal,
  requireRecurringAppointments,
  requireClinicalAlerts,
  requireEngagementAnalytics,
  requireScheduleManagement,
  requireModuleIntegration,
  requireAnyFeature,
  requireAllFeatures,
  isPatientEngagementFeatureEnabled,
  PATIENT_ENGAGEMENT_FLAGS
};