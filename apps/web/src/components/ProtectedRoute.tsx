import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import WarningIcon from '@mui/icons-material/Warning';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useAuth } from '../hooks/useAuth';
import { useRBAC } from '../hooks/useRBAC';
import LoadingSpinner from './LoadingSpinner';
import { useSubscriptionStatus } from '../hooks/useSubscription';

// ProtectedRoute component

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: string;
  requiredFeature?: string;
  requiresLicense?: boolean;
  requiresActiveSubscription?: boolean;
  fallbackPath?: string;
}

interface AccessDeniedProps {
  reason: 'role' | 'permission' | 'feature' | 'license' | 'subscription';
  requiredRole?: string | string[];
  requiredPermission?: string;
  requiredFeature?: string;
  userRole?: string;
  licenseStatus?: string;
  subscriptionStatus?: {
    status: string;
    isActive: boolean;
    tier?: string;
    daysRemaining?: number;
  };
}

const AccessDenied: React.FC<AccessDeniedProps> = ({
  reason,
  requiredRole,
  requiredPermission,
  requiredFeature,
  userRole,
  licenseStatus,
  subscriptionStatus,
}) => {
  const getIcon = () => {
    switch (reason) {
      case 'subscription':
        return <CreditCardIcon sx={{ fontSize: 64, color: 'warning.main' }} />;
      case 'license':
        return <WarningIcon sx={{ fontSize: 64, color: 'error.main' }} />;
      default:
        return <LockIcon sx={{ fontSize: 64, color: 'text.secondary' }} />;
    }
  };

  const getTitle = () => {
    switch (reason) {
      case 'role':
        return 'Insufficient Role Permissions';
      case 'permission':
        return 'Access Permission Required';
      case 'feature':
        return 'Feature Not Available';
      case 'license':
        return 'License Verification Required';
      case 'subscription':
        return 'Subscription Required';
      default:
        return 'Access Denied';
    }
  };

  const getMessage = () => {
    switch (reason) {
      case 'role': {
        const roles = Array.isArray(requiredRole)
          ? requiredRole.join(', ')
          : requiredRole;
        return `This page requires ${roles} role(s). Your current role is ${userRole}.`;
      }
      case 'permission':
        return `You don't have the required permission: ${requiredPermission}`;
      case 'feature':
        return `The feature "${requiredFeature}" is not available in your current plan. Please upgrade to access this feature.`;
      case 'license':
        return `A verified pharmacist license is required to access this feature. Current status: ${licenseStatus}`;
      case 'subscription':
        return `An active subscription is required to access this feature. Current status: ${subscriptionStatus?.status}`;
      default:
        return 'You do not have permission to access this page.';
    }
  };

  const getActionButton = () => {
    switch (reason) {
      case 'subscription':
        return (
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/subscriptions"
            sx={{ mt: 2 }}
          >
            Upgrade Subscription
          </Button>
        );
      case 'license':
        return (
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="primary"
              component={Link}
              to="/license"
              sx={{ mt: 2 }}
            >
              {licenseStatus === 'pending' ? 'View License Status' : 'Upload License'}
            </Button>
            <Button
              variant="outlined"
              component={Link}
              to="/dashboard"
              sx={{ mt: 2 }}
            >
              Back to Dashboard
            </Button>
          </Box>
        );
      default:
        return (
          <Button
            variant="outlined"
            component={Link}
            to="/dashboard"
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        );
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
      p={3}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          maxWidth: 500,
          width: '100%',
        }}
      >
        <Box mb={3}>{getIcon()}</Box>

        <Typography variant="h4" gutterBottom color="text.primary">
          {getTitle()}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {getMessage()}
        </Typography>

        {reason === 'feature' && (
          <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
            Contact your administrator or upgrade your plan to enable this
            feature.
          </Alert>
        )}

        {reason === 'license' && licenseStatus === 'pending' && (
          <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
            Your license is currently under review. You'll be notified once it's
            approved.
          </Alert>
        )}

        {getActionButton()}
      </Paper>
    </Box>
  );
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  requiredFeature,
  requiresLicense = false,
  requiresActiveSubscription = false,
  fallbackPath = '/login',
}) => {
  const { user, loading } = useAuth();
  const {
    hasRole,
    hasPermission,
    hasFeature,
    requiresLicense: userRequiresLicense,
    getLicenseStatus,
  } = useRBAC();
  const subscriptionStatus = useSubscriptionStatus();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!user) {

    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check subscription requirement
  if (requiresActiveSubscription) {
    // Super admins bypass subscription checks
    const isSuperAdmin = user.role === 'super_admin';

    if (!isSuperAdmin) {
      // Allow access during 14-day free trial
      const isTrialActive = subscriptionStatus.status === 'trial' &&
        subscriptionStatus.daysRemaining &&
        subscriptionStatus.daysRemaining > 0;

      // Allow access to subscription pages even without active subscription
      const isSubscriptionPage = location.pathname.includes('/subscription');

      // Allow access if subscription status is loading, has error, or is unauthorized (don't block on loading/error states)
      const isLoadingOrError = subscriptionStatus.loading ||
        subscriptionStatus.status === 'error' ||
        subscriptionStatus.status === 'unauthorized' ||
        subscriptionStatus.status === 'no_subscription';

      // Block access only if we have a definitive negative response (trial expired and no active subscription)
      // and we're not in a loading/error state and not on subscription pages
      const shouldBlock = !isTrialActive &&
        !subscriptionStatus.isActive &&
        !isSubscriptionPage &&
        !isLoadingOrError &&
        subscriptionStatus.status !== 'active';

      if (shouldBlock) {
        return (
          <AccessDenied
            reason="subscription"
            subscriptionStatus={{
              status: subscriptionStatus.status,
              isActive: subscriptionStatus.isActive,
              tier: subscriptionStatus.tier || 'free',
              daysRemaining: subscriptionStatus.daysRemaining || 0,
            }}
          />
        );
      }
    }
  }

  // Check license requirement
  if (requiresLicense && userRequiresLicense()) {
    // Super admins bypass license checks
    const isSuperAdmin = user.role === 'super_admin';

    if (!isSuperAdmin) {
      const licenseStatus = getLicenseStatus();
      if (licenseStatus !== 'approved') {
        return <AccessDenied reason="license" licenseStatus={licenseStatus} />;
      }
    }
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <AccessDenied
        reason="role"
        requiredRole={requiredRole}
        userRole={user.role}
      />
    );
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AccessDenied
        reason="permission"
        requiredPermission={requiredPermission}
      />
    );
  }

  // Check if this is an admin route - block for non-super-admin users
  const isAdminRoute = location.pathname.startsWith('/admin/');
  if (isAdminRoute && user.role !== 'super_admin') {
    return (
      <AccessDenied
        reason="role"
        requiredRole="super_admin"
        userRole={user.role}
      />
    );
  }

  // Check feature requirement
  if (requiredFeature && !hasFeature(requiredFeature)) {
    // Super admins bypass feature checks
    const isSuperAdmin = user.role === 'super_admin';

    if (!isSuperAdmin) {
      return <AccessDenied reason="feature" requiredFeature={requiredFeature} />;
    }
  }

  // All checks passed, render children
  return <>{children}</>;
};

export default ProtectedRoute;
