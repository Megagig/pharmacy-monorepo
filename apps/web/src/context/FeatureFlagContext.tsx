import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import featureFlagService, {
  FeatureFlag,
} from '../services/featureFlagService';
import FeatureFlagUtil from '../utils/featureFlagUtil';
import { useAuth } from '../hooks/useAuth';

interface FeatureFlagContextType {
  featureFlags: FeatureFlag[];
  isLoading: boolean;
  error: Error | null;
  refreshFlags: () => Promise<void>;
  isFeatureEnabled: (key: string) => boolean;
  hasFeature: (key: string) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(
  undefined
);

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export const FeatureFlagProvider: React.FC<FeatureFlagProviderProps> = ({
  children,
}) => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatureFlags = async () => {
    try {
      setIsLoading(true);
      const response = await featureFlagService.getAllFeatureFlags();

      if (Array.isArray(response.data)) {
        setFeatureFlags(response.data);
        // Update the feature flag utility cache
        FeatureFlagUtil.setFeatureFlags(response.data);
      } else {
        console.warn('Unexpected feature flag response format:', response);
        setFeatureFlags([]);
        FeatureFlagUtil.setFeatureFlags([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching feature flags:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureFlags();
  }, []);

  const isFeatureEnabled = (key: string): boolean => {
    if (isLoading) return false; // Default to disabled while loading

    const flag = featureFlags.find((f) => f.key === key);
    return flag ? flag.isActive : false;
  };

  const refreshFlags = async (): Promise<void> => {
    return fetchFeatureFlags();
  };

  return (
    <FeatureFlagContext.Provider
      value={{
        featureFlags,
        isLoading,
        error,
        refreshFlags,
        isFeatureEnabled,
        hasFeature: isFeatureEnabled, // Alias for consistency
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
};

/**
 * Custom hook to use the feature flag context with user-specific permissions
 * This checks the user's actual workspace permissions from the backend
 * rather than just the global feature flag status
 */
export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  const auth = useAuth();

  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }

  // Override hasFeature to check user's actual permissions
  const hasFeature = (key: string): boolean => {
    if (context.isLoading) return false;

    // Super admin has access to all features
    if (auth.user?.role === 'super_admin') return true;

    // Check user's workspace permissions (authoritative source from backend)
    if (auth.user?.permissions && auth.user.permissions.length > 0) {
      return auth.user.permissions.includes(key);
    }

    // Fallback to global feature flag status for backward compatibility
    const flag = context.featureFlags.find((f) => f.key === key);
    return flag ? flag.isActive : false;
  };

  return {
    ...context,
    hasFeature,
    isFeatureEnabled: hasFeature, // Keep both for consistency
  };
};

export default FeatureFlagContext;
