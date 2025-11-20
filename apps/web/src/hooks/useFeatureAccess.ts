import { useCallback } from 'react';
import { useFeatureFlags } from '../queries/featureFlagQueries';

/**
 * Custom hook to manage feature flags in components
 * This provides a simplified interface for components to check feature flags
 */
export const useFeatureAccess = () => {
  const { data: featureFlags, isLoading, error } = useFeatureFlags();

  // Check if a feature flag is enabled
  const isFeatureEnabled = useCallback(
    (key: string) => {
      if (!featureFlags || isLoading || error) {
        return false;
      }

      const flag = featureFlags.find((f) => f.key === key);
      return flag ? flag.isActive : false;
    },
    [featureFlags, isLoading, error]
  );

  // Check if current user's tier has access to a feature
  const hasTierAccess = useCallback(
    (key: string, tier: string) => {
      if (!featureFlags || isLoading || error) {
        return false;
      }

      const flag = featureFlags.find((f) => f.key === key);
      if (!flag || !flag.isActive) {
        return false;
      }

      return flag.allowedTiers.includes(tier);
    },
    [featureFlags, isLoading, error]
  );

  // Check if a role has access to a feature
  const hasRoleAccess = useCallback(
    (key: string, role: string) => {
      if (!featureFlags || isLoading || error) {
        return false;
      }

      const flag = featureFlags.find((f) => f.key === key);
      if (!flag || !flag.isActive) {
        return false;
      }

      // If no roles specified, all roles have access
      if (flag.allowedRoles.length === 0) {
        return true;
      }

      return flag.allowedRoles.includes(role);
    },
    [featureFlags, isLoading, error]
  );

  // Get all features for a specific tier
  const getTierFeatures = useCallback(
    (tier: string) => {
      if (!featureFlags || isLoading || error) {
        return [];
      }

      return featureFlags
        .filter((f) => f.isActive && f.allowedTiers.includes(tier))
        .map((f) => f.key);
    },
    [featureFlags, isLoading, error]
  );

  return {
    isFeatureEnabled,
    hasTierAccess,
    hasRoleAccess,
    getTierFeatures,
    isLoading,
    error,
  };
};

export default useFeatureAccess;
