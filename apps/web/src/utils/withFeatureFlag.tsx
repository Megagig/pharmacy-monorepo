import React from 'react';
import { FeatureRender } from '../utils/conditionalRendering';

export default function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  featureKey: string,
  FallbackComponent?: React.ComponentType<P>
) {
  return (props: P) => {
    return (
      <FeatureRender
        featureKey={featureKey}
        whenEnabled={<Component {...props} />}
        whenDisabled={
          FallbackComponent ? <FallbackComponent {...props} /> : null
        }
      />
    );
  };
}
