import React, { ReactNode } from 'react';
import useFeatureFlags from '../hooks/useFeatureFlags';

type ConditionalRenderOptions = {
  /**
   * The key of the feature flag to check
   */
  featureKey: string;

  /**
   * Content to render when the feature flag is enabled
   */
  whenEnabled: ReactNode;

  /**
   * Optional content to render when the feature flag is disabled
   */
  whenDisabled?: ReactNode;

  /**
   * Optional content to render while loading the feature flags
   */
  loading?: ReactNode;
};

/**
 * Component for conditionally rendering based on feature flags
 */
export const FeatureRender: React.FC<ConditionalRenderOptions> = ({
  featureKey,
  whenEnabled,
  whenDisabled = null,
  loading = null,
}) => {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();

  if (isLoading) {
    return <>{loading}</>;
  }

  return <>{isFeatureEnabled(featureKey) ? whenEnabled : whenDisabled}</>;
};

export default FeatureRender;
