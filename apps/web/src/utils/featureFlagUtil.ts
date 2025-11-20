import { FeatureFlag } from '../services/featureFlagService';

/**
 * Cached feature flag values
 * This cache is refreshed when fetchFeatureFlags() is called
 */
let featureFlags: FeatureFlag[] = [];

/**
 * Utility for checking feature flags in non-React contexts
 */
const FeatureFlagUtil = {
  /**
   * Set the feature flags cache
   *
   * @param flags The feature flags to cache
   */
  setFeatureFlags: (flags: FeatureFlag[]): void => {
    featureFlags = flags;
  },

  /**
   * Check if a feature flag is enabled
   *
   * @param key The feature flag key
   * @param defaultValue The default value if the flag is not found
   * @returns Whether the feature flag is enabled
   */
  isFeatureEnabled: (key: string, defaultValue: boolean = false): boolean => {
    const flag = featureFlags.find((f) => f.key === key);
    return flag ? flag.isActive : defaultValue;
  },

  /**
   * Get a feature flag by key
   *
   * @param key The feature flag key
   * @returns The feature flag or undefined if not found
   */
  getFeatureFlag: (key: string): FeatureFlag | undefined => {
    return featureFlags.find((f) => f.key === key);
  },

  /**
   * Get all cached feature flags
   *
   * @returns All cached feature flags
   */
  getAllFeatureFlags: (): FeatureFlag[] => {
    return [...featureFlags];
  },
};

export default FeatureFlagUtil;
