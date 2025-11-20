import React from 'react';
import { useRBAC } from '../hooks/useRBAC';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import type { RBACPermissions } from '../types/patientManagement';

// Component for conditional rendering based on permissions
interface ConditionalRenderProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: keyof RBACPermissions;
  requiredFeature?: string;
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  children,
  requiredRole,
  requiredPermission,
  requiredFeature,
  fallback = null,
}) => {
  const { role, canAccess, hasRole } = useRBAC();
  const { isFeatureEnabled } = useFeatureAccess();

  let hasAccess = true;

  // Check role requirement
  if (requiredRole) {
    // Use hasRole function which properly checks system roles including super_admin
    hasAccess = hasRole(requiredRole);
  }

  // Check permission requirement
  if (requiredPermission && !canAccess(requiredPermission)) {
    hasAccess = false;
  }

  // Check feature requirement
  if (requiredFeature && !isFeatureEnabled(requiredFeature)) {
    hasAccess = false;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};
