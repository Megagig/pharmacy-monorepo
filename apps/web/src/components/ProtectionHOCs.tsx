import React from 'react';
import ProtectedRoute from './ProtectedRoute';

// Higher-order component for protecting components with role-based access control
export const withRoleProtection = <P extends object>(
  Component: React.ComponentType<P>,
  requiredRole: string | string[]
) => {
  const WithRoleProtection: React.FC<P> = (props) => (
    <ProtectedRoute requiredRole={requiredRole}>
      <Component {...props} />
    </ProtectedRoute>
  );

  // Set display name for better debugging
  WithRoleProtection.displayName = `withRoleProtection(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WithRoleProtection;
};

// Higher-order component for feature protection
export const withFeatureProtection = <P extends object>(
  Component: React.ComponentType<P>,
  requiredFeature: string
) => {
  const WithFeatureProtection: React.FC<P> = (props) => (
    <ProtectedRoute requiredFeature={requiredFeature}>
      <Component {...props} />
    </ProtectedRoute>
  );

  // Set display name for better debugging
  WithFeatureProtection.displayName = `withFeatureProtection(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WithFeatureProtection;
};

export default { withRoleProtection, withFeatureProtection };
