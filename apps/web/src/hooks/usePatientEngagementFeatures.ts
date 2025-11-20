/**
 * Patient Engagement Feature Flags Hook
 * 
 * Custom hook for checking patient engagement feature availability
 * with caching and real-time updates.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useFeatureFlags } from '../context/FeatureFlagContext';
import featureFlagService from '../services/featureFlagService';

// Patient Engagement Feature Flag Keys
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

interface FeatureEvaluation {
  enabled: boolean;
  reason: string;
  rolloutPercentage: number;
  userPercentile?: number;
  override?: boolean;
  lastEvaluated: Date;
}

interface PatientEngagementFeatures {
  // Core module
  isModuleEnabled: boolean;
  
  // Individual features
  canScheduleAppointments: boolean;
  canManageFollowUps: boolean;
  canUseReminders: boolean;
  canAccessPatientPortal: boolean;
  canCreateRecurringAppointments: boolean;
  canViewClinicalAlerts: boolean;
  canViewAnalytics: boolean;
  canManageSchedules: boolean;
  canUseIntegrations: boolean;
  
  // Utility functions
  isFeatureEnabled: (flag: PatientEngagementFlag) => boolean;
  getFeatureEvaluation: (flag: PatientEngagementFlag) => FeatureEvaluation | null;
  
  // Loading and error states
  isLoading: boolean;
  error: Error | null;
  
  // Refresh function
  refetch: () => void;
}

/**
 * Hook to check patient engagement feature availability
 */
export const usePatientEngagementFeatures = (): PatientEngagementFeatures => {
  const { user } = useAuth();
  const { isFeatureEnabled: isGlobalFeatureEnabled, isLoading: globalLoading } = useFeatureFlags();

  // Fetch detailed feature evaluations for patient engagement features
  const {
    data: featureEvaluations,
    isLoading: evaluationsLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['patientEngagementFeatures', user?.id, user?.workplaceId],
    queryFn: async () => {
      if (!user?.id || !user?.workplaceId) {
        throw new Error('User authentication required');
      }

      const evaluations: Record<string, FeatureEvaluation> = {};
      
      // Check each patient engagement feature
      for (const [key, flagKey] of Object.entries(PATIENT_ENGAGEMENT_FLAGS)) {
        try {
          const evaluation = await featureFlagService.isFeatureEnabled(
            flagKey,
            user.id,
            user.workplaceId
          );
          evaluations[flagKey] = evaluation;
        } catch (error) {
          console.warn(`Failed to evaluate feature flag ${flagKey}:`, error);
          evaluations[flagKey] = {
            enabled: false,
            reason: 'Evaluation failed',
            rolloutPercentage: 0,
            lastEvaluated: new Date()
          };
        }
      }
      
      return evaluations;
    },
    enabled: !!user?.id && !!user?.workplaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });

  const isLoading = globalLoading || evaluationsLoading;

  // Helper function to check if a specific feature is enabled
  const isFeatureEnabled = (flag: PatientEngagementFlag): boolean => {
    // First check global feature flag state
    if (!isGlobalFeatureEnabled(flag)) {
      return false;
    }
    
    // Then check detailed evaluation if available
    const evaluation = featureEvaluations?.[flag];
    return evaluation?.enabled ?? false;
  };

  // Helper function to get detailed feature evaluation
  const getFeatureEvaluation = (flag: PatientEngagementFlag): FeatureEvaluation | null => {
    return featureEvaluations?.[flag] ?? null;
  };

  // Check core module first - all other features depend on this
  const isModuleEnabled = isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.MODULE);

  return {
    // Core module
    isModuleEnabled,
    
    // Individual features (all depend on core module)
    canScheduleAppointments: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.APPOINTMENTS),
    canManageFollowUps: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.FOLLOW_UPS),
    canUseReminders: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.REMINDERS),
    canAccessPatientPortal: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.PATIENT_PORTAL),
    canCreateRecurringAppointments: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.RECURRING_APPOINTMENTS),
    canViewClinicalAlerts: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.CLINICAL_ALERTS),
    canViewAnalytics: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.ANALYTICS),
    canManageSchedules: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.SCHEDULE_MANAGEMENT),
    canUseIntegrations: isModuleEnabled && isFeatureEnabled(PATIENT_ENGAGEMENT_FLAGS.MODULE_INTEGRATION),
    
    // Utility functions
    isFeatureEnabled,
    getFeatureEvaluation,
    
    // Loading and error states
    isLoading,
    error,
    
    // Refresh function
    refetch
  };
};

/**
 * Hook to check if any patient engagement features are available
 */
export const useHasPatientEngagementFeatures = (): boolean => {
  const { isModuleEnabled } = usePatientEngagementFeatures();
  return isModuleEnabled;
};

/**
 * Hook to get patient engagement feature rollout information
 */
export const usePatientEngagementRollout = () => {
  const { getFeatureEvaluation, isLoading } = usePatientEngagementFeatures();

  const getRolloutInfo = (flag: PatientEngagementFlag) => {
    const evaluation = getFeatureEvaluation(flag);
    if (!evaluation) return null;

    return {
      enabled: evaluation.enabled,
      rolloutPercentage: evaluation.rolloutPercentage,
      userPercentile: evaluation.userPercentile,
      reason: evaluation.reason,
      isOverride: evaluation.override,
      lastEvaluated: evaluation.lastEvaluated
    };
  };

  const getAllRolloutInfo = () => {
    const rolloutInfo: Record<string, any> = {};
    
    Object.values(PATIENT_ENGAGEMENT_FLAGS).forEach(flag => {
      rolloutInfo[flag] = getRolloutInfo(flag);
    });
    
    return rolloutInfo;
  };

  return {
    getRolloutInfo,
    getAllRolloutInfo,
    isLoading
  };
};

/**
 * Component wrapper that only renders children if patient engagement module is enabled
 */
export const PatientEngagementFeatureGuard: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredFeatures?: PatientEngagementFlag[];
}> = ({ children, fallback = null, requiredFeatures = [PATIENT_ENGAGEMENT_FLAGS.MODULE] }) => {
  const { isFeatureEnabled } = usePatientEngagementFeatures();

  const hasRequiredFeatures = requiredFeatures.every(feature => isFeatureEnabled(feature));

  if (!hasRequiredFeatures) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Hook for conditional rendering based on feature availability
 */
export const usePatientEngagementConditional = () => {
  const features = usePatientEngagementFeatures();

  const renderIf = (condition: boolean, component: React.ReactNode) => {
    return condition ? component : null;
  };

  const renderIfFeature = (flag: PatientEngagementFlag, component: React.ReactNode) => {
    return features.isFeatureEnabled(flag) ? component : null;
  };

  const renderIfAnyFeature = (flags: PatientEngagementFlag[], component: React.ReactNode) => {
    const hasAnyFeature = flags.some(flag => features.isFeatureEnabled(flag));
    return hasAnyFeature ? component : null;
  };

  const renderIfAllFeatures = (flags: PatientEngagementFlag[], component: React.ReactNode) => {
    const hasAllFeatures = flags.every(flag => features.isFeatureEnabled(flag));
    return hasAllFeatures ? component : null;
  };

  return {
    renderIf,
    renderIfFeature,
    renderIfAnyFeature,
    renderIfAllFeatures,
    ...features
  };
};

export default usePatientEngagementFeatures;