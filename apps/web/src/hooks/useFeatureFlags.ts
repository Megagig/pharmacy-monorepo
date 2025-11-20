/**
 * Feature Flags Hook for Frontend
 * Provides access to feature flag state and real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  environments: string[];
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

interface FeatureFlagContext {
  userId?: string;
  workplaceId?: string;
  environment?: string;
  userAgent?: string;
}

interface FeatureFlagsResponse {
  flags: Record<string, FeatureFlag>;
  enabledFeatures: string[];
}

interface UseFeatureFlagsReturn {
  isFeatureEnabled: (flagKey: string) => boolean;
  getEnabledFeatures: () => string[];
  getFeatureFlag: (flagKey: string) => FeatureFlag | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Feature flags API service
 */
const featureFlagsApi = {
  async getFeatureFlags(context?: FeatureFlagContext): Promise<FeatureFlagsResponse> {
    const params = new URLSearchParams();
    if (context?.userId) params.append('userId', context.userId);
    if (context?.workplaceId) params.append('workplaceId', context.workplaceId);
    if (context?.environment) params.append('environment', context.environment);

    const baseURL = import.meta.env.MODE === 'development'
      ? 'http://localhost:5000'
      : '';
    const response = await fetch(`${baseURL}/api/feature-flags?${params}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch feature flags');
    }

    return response.json();
  },

  async updateFeatureFlag(flagKey: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const baseURL = import.meta.env.MODE === 'development'
      ? 'http://localhost:5000'
      : '';
    const response = await fetch(`${baseURL}/api/feature-flags/${flagKey}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update feature flag');
    }

    return response.json();
  }
};

/**
 * Default feature flags for offline/fallback scenarios
 */
const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  manual_lab_orders: true,
  manual_lab_pdf_generation: true,
  manual_lab_qr_scanning: true,
  manual_lab_ai_interpretation: true,
  manual_lab_fhir_integration: false,
  manual_lab_mobile_features: true,
  manual_lab_enhanced_security: true,
  manual_lab_performance_optimizations: true,
  manual_lab_notifications: false,
  manual_lab_analytics: true,
};

/**
 * Feature flags hook
 */
export const useFeatureFlags = (): UseFeatureFlagsReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [localFlags, setLocalFlags] = useState<Record<string, FeatureFlag>>({});

  // Build context for feature flag evaluation
  const context: FeatureFlagContext = {
    userId: (user as any)?._id,
    workplaceId: (user as any)?.workplaceId,
    environment: process.env.NODE_ENV || 'development',
    userAgent: navigator.userAgent,
  };

  // Fetch feature flags from server
  const {
    data: featureFlagsData,
    isLoading,
    error,
    refetch
  } = useQuery<FeatureFlagsResponse, Error>({
    queryKey: ['feature-flags', context.userId, context.workplaceId],
    queryFn: () => featureFlagsApi.getFeatureFlags(context),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Handle success/error responses with useEffect
  useEffect(() => {
    if (featureFlagsData?.flags) {
      setLocalFlags(featureFlagsData.flags);
    }
  }, [featureFlagsData]);

  useEffect(() => {
    if (error) {
      console.warn('Failed to fetch feature flags, using defaults:', error);
      // Use default flags as fallback
      const defaultFlags: Record<string, FeatureFlag> = {};
      Object.entries(DEFAULT_FEATURE_FLAGS).forEach(([key, enabled]) => {
        defaultFlags[key] = {
          key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Default ${key} feature flag`,
          enabled,
          rolloutPercentage: enabled ? 100 : 0,
          environments: ['development', 'staging', 'production'],
        };
      });
      setLocalFlags(defaultFlags);
    }
  }, [error]);

  // Check if a feature is enabled
  const isFeatureEnabled = useCallback((flagKey: string): boolean => {
    // Use server data if available
    if (featureFlagsData?.enabledFeatures) {
      return featureFlagsData.enabledFeatures.includes(flagKey);
    }

    // Fallback to local evaluation
    const flag = localFlags[flagKey];
    if (!flag) {
      // Use default if flag not found
      return DEFAULT_FEATURE_FLAGS[flagKey] ?? false;
    }

    return flag.enabled;
  }, [featureFlagsData, localFlags]);

  // Get all enabled features
  const getEnabledFeatures = useCallback((): string[] => {
    if (featureFlagsData?.enabledFeatures) {
      return featureFlagsData.enabledFeatures;
    }

    // Fallback to local evaluation
    return Object.entries(localFlags)
      .filter(([_, flag]) => flag.enabled)
      .map(([key, _]) => key);
  }, [featureFlagsData, localFlags]);

  // Get specific feature flag
  const getFeatureFlag = useCallback((flagKey: string): FeatureFlag | undefined => {
    if (featureFlagsData?.flags) {
      return featureFlagsData.flags[flagKey];
    }

    return localFlags[flagKey];
  }, [featureFlagsData, localFlags]);

  // Set up real-time updates via WebSocket or polling
  useEffect(() => {
    if (!user) return;

    // Poll for feature flag updates every 5 minutes
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, queryClient]);

  // Listen for storage events (for cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'feature-flags-update') {
        queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [queryClient]);

  return {
    isFeatureEnabled,
    getEnabledFeatures,
    getFeatureFlag,
    isLoading,
    error: error as Error | null,
    refetch
  };
};

/**
 * Feature flag component wrapper
 */
interface FeatureFlagProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureFlag: React.FC<FeatureFlagProps> = ({
  flag,
  children,
  fallback = null
}) => {
  const { isFeatureEnabled } = useFeatureFlags();

  if (isFeatureEnabled(flag)) {
    return React.createElement(React.Fragment, null, children);
  }

  return React.createElement(React.Fragment, null, fallback);
};

/**
 * Multiple feature flags wrapper (AND logic)
 */
interface MultipleFeatureFlagsProps {
  flags: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  mode?: 'all' | 'any'; // 'all' = AND logic, 'any' = OR logic
}

export const MultipleFeatureFlags: React.FC<MultipleFeatureFlagsProps> = ({
  flags,
  children,
  fallback = null,
  mode = 'all'
}) => {
  const { isFeatureEnabled } = useFeatureFlags();

  const isEnabled = mode === 'all'
    ? flags.every(flag => isFeatureEnabled(flag))
    : flags.some(flag => isFeatureEnabled(flag));

  if (isEnabled) {
    return React.createElement(React.Fragment, null, children);
  }

  return React.createElement(React.Fragment, null, fallback);
};

/**
 * Hook for feature flag debugging (development only)
 */
export const useFeatureFlagDebug = () => {
  const { getEnabledFeatures, getFeatureFlag } = useFeatureFlags();

  const debugInfo = {
    enabledFeatures: getEnabledFeatures(),
    allFlags: {} as Record<string, FeatureFlag | undefined>
  };

  // Get all manual lab related flags for debugging
  const manualLabFlags = [
    'manual_lab_orders',
    'manual_lab_pdf_generation',
    'manual_lab_qr_scanning',
    'manual_lab_ai_interpretation',
    'manual_lab_fhir_integration',
    'manual_lab_mobile_features',
    'manual_lab_enhanced_security',
    'manual_lab_performance_optimizations',
    'manual_lab_notifications',
    'manual_lab_analytics'
  ];

  manualLabFlags.forEach(flag => {
    debugInfo.allFlags[flag] = getFeatureFlag(flag);
  });

  return debugInfo;
};

export default useFeatureFlags;