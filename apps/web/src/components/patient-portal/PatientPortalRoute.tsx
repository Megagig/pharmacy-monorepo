import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import PatientNavigation from './PatientNavigation';
import AccessibilityProvider from './AccessibilityProvider';

interface PatientPortalRouteProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
}

/**
 * Route guard component for patient portal routes
 * Handles authentication, workspace validation, and layout
 */
const PatientPortalRoute: React.FC<PatientPortalRouteProps> = ({
  children,
  requiresAuth = true,
}) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, loading, isAuthenticated } = usePatientAuth();

  // Show loading spinner while checking authentication
  if (loading) {

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">
          Loading patient portal...
        </Typography>
      </Box>
    );
  }

  // Redirect to authentication if required and not authenticated
  if (requiresAuth && !isAuthenticated) {

    return <Navigate to={`/patient-auth/${workspaceId}`} replace />;
  }

  // Validate workspace access for authenticated users
  if (requiresAuth && isAuthenticated && user && workspaceId) {

    if (user.workspaceId !== workspaceId) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            You don't have access to this workspace. Please contact your pharmacy for assistance.
          </Typography>
        </Box>
      );
    }
  }

  // Check account status for authenticated users
  if (requiresAuth && isAuthenticated && user) {
    if (user.status === 'pending') {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h5" color="warning.main" gutterBottom>
            Account Pending Approval
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            Your account is pending approval from the pharmacy. You will receive an email once your account is approved.
          </Typography>
        </Box>
      );
    }

    if (user.status === 'suspended') {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Account Suspended
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            Your account has been suspended. Please contact the pharmacy for assistance.
          </Typography>
        </Box>
      );
    }
  }

  // Render the patient portal layout
  return (
    <AccessibilityProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <PatientNavigation workspaceId={workspaceId} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - 280px)` },
            ml: { md: '280px' },
            mt: '64px', // Height of AppBar
            minHeight: 'calc(100vh - 64px)',
            bgcolor: 'background.default',
            '&:focus': {
              outline: 'none',
            },
          }}
        >
          {children}
        </Box>
      </Box>
    </AccessibilityProvider>
  );
};

export default PatientPortalRoute;