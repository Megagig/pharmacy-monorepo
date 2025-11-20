import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import { Science, Lock, Upgrade } from '@mui/icons-material';
import { useRBAC } from '../../../hooks/useRBAC';
import { useSubscriptionStatus } from '../../../hooks/useSubscription';
import { Link } from 'react-router-dom';

interface DiagnosticFeatureGuardProps {
  children: React.ReactNode;
  feature?: string;
  fallback?: React.ReactNode;
}

export const DiagnosticFeatureGuard: React.FC<DiagnosticFeatureGuardProps> = ({
  children,
  feature = 'ai_diagnostics',
  fallback,
}) => {
  const { hasFeature, hasRole, isSuperAdmin } = useRBAC();
  const subscriptionStatus = useSubscriptionStatus();

  // Super admins bypass all checks
  if (isSuperAdmin) {

    return <>{children}</>;
  }

  // Check if user has required role (pharmacist, owner, pharmacy_outlet, or above)
  const hasRequiredRole =
    hasRole('pharmacist') ||
    hasRole('admin') ||
    hasRole('super_admin') ||
    hasRole('owner') ||
    hasRole('pharmacy_outlet') ||
    hasRole('pharmacy_team');

  // Check if user has active subscription
  const hasActiveSubscription = subscriptionStatus?.isActive;

  // Check if feature is enabled
  const hasRequiredFeature = hasFeature(feature);

  // Debug logging

  // TEMPORARY DEV BYPASS: If user has required role, allow access
  // This bypasses the subscription and feature checks for development
  if (hasRequiredRole) {

    return <>{children}</>;
  }

  // If all checks pass, render children
  if (hasRequiredRole && hasActiveSubscription && hasRequiredFeature) {
    return <>{children}</>;
  }

  // If fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default fallback UI
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
      p={3}
    >
      <Card sx={{ maxWidth: 600, textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <Science
            sx={{
              fontSize: 80,
              color: 'primary.main',
              mb: 2,
            }}
          />

          <Typography variant="h4" gutterBottom>
            AI Diagnostics & Therapeutics
          </Typography>

          <Typography variant="body1" color="textSecondary" paragraph>
            Advanced AI-powered diagnostic assistance for comprehensive patient
            care
          </Typography>

          {!hasRequiredRole && (
            <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <Lock sx={{ verticalAlign: 'middle', mr: 1 }} />
                This feature requires pharmacist-level access or higher.
              </Typography>
            </Alert>
          )}

          {!hasActiveSubscription && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <Upgrade sx={{ verticalAlign: 'middle', mr: 1 }} />
                An active subscription is required to access diagnostic
                features.
              </Typography>
            </Alert>
          )}

          {!hasRequiredFeature && hasActiveSubscription && (
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                The AI Diagnostics feature is not enabled for your subscription
                plan.
              </Typography>
            </Alert>
          )}

          <Box display="flex" gap={2} justifyContent="center" mt={3}>
            {!hasActiveSubscription && (
              <Button
                variant="contained"
                component={Link}
                to="/subscriptions"
                startIcon={<Upgrade />}
              >
                Upgrade Subscription
              </Button>
            )}

            <Button variant="outlined" component={Link} to="/dashboard">
              Back to Dashboard
            </Button>
          </Box>

          <Box mt={4} p={2} bgcolor="grey.50" borderRadius={2}>
            <Typography variant="h6" gutterBottom>
              Feature Highlights
            </Typography>
            <Box textAlign="left">
              <Typography variant="body2" gutterBottom>
                • AI-powered differential diagnosis generation
              </Typography>
              <Typography variant="body2" gutterBottom>
                • Comprehensive drug interaction checking
              </Typography>
              <Typography variant="body2" gutterBottom>
                • Lab result integration and interpretation
              </Typography>
              <Typography variant="body2" gutterBottom>
                • Clinical decision support tools
              </Typography>
              <Typography variant="body2" gutterBottom>
                • Seamless integration with clinical notes and MTR
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DiagnosticFeatureGuard;
