import { useState, useEffect } from 'react';
import featureFlagService from '../services/featureFlagService';

interface UseFeatureFlagOptions {
  defaultValue?: boolean;
  fallbackBehavior?: 'allow' | 'deny';
}

/**
 * Custom hook to check if a feature flag is enabled
 *
 * @param {string} featureKey - The key of the feature flag to check
 * @param {UseFeatureFlagOptions} options - Configuration options
 * @returns {boolean} Whether the feature flag is enabled
 */
export const useFeatureFlag = (
  featureKey: string,
  options: UseFeatureFlagOptions = {}
): {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
} => {
  const { defaultValue = false, fallbackBehavior = 'deny' } = options;

  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        setIsLoading(true);
        // We would typically have a specific endpoint for checking single flags
        const response = await featureFlagService.getAllFeatureFlags();

        // Find the specific feature flag
        const featureFlags = Array.isArray(response.data)
          ? response.data
          : [response.data];
        const featureFlag = featureFlags.find(
          (flag) => flag.key === featureKey
        );

        if (featureFlag) {
          setIsEnabled(featureFlag.isActive);
        } else {
          // Use fallback behavior if feature flag doesn't exist
          setIsEnabled(fallbackBehavior === 'allow');
        }
      } catch (err) {
        console.error(`Error checking feature flag ${featureKey}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        // Use fallback behavior on error
        setIsEnabled(fallbackBehavior === 'allow');
      } finally {
        setIsLoading(false);
      }
    };

    checkFeatureFlag();
  }, [featureKey, fallbackBehavior]);

  return { isEnabled, isLoading, error };
};

export default useFeatureFlag;
