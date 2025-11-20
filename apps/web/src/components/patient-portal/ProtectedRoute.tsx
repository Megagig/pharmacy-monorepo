import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Alert } from '../common/Alert';
import { AlertCircle, Lock, Clock } from 'lucide-react';
import { usePatientAuth } from '../../hooks/usePatientAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
  requireProfileComplete?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireEmailVerification = true,
  requireProfileComplete = false,
}) => {
  const { user, loading } = usePatientAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Box className="text-center">
          <CircularProgress size={40} className="mb-4" />
          <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
            Checking authentication...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Redirect to login if no user at all
  if (!user) {
    return (
      <Navigate
        to="/patient-portal/auth"
        state={{ from: location }}
        replace
      />
    );
  }

  // Check account status
  if (user.status === 'suspended') {
    return (
      <Box className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Box className="max-w-md w-full">
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-5 w-5" />
            <Box>
              <Typography variant="h6" className="font-semibold mb-2">
                Account Suspended
              </Typography>
              <Typography variant="body2">
                Your account has been suspended. Please contact {user.workspaceName} for assistance.
              </Typography>
            </Box>
          </Alert>
          
          <Box className="text-center">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <Typography variant="h5" className="text-gray-900 dark:text-white font-semibold mb-2">
              Access Restricted
            </Typography>
            <Typography variant="body1" className="text-gray-600 dark:text-gray-400 mb-6">
              You cannot access the patient portal at this time.
            </Typography>
            
            <Box className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <Typography variant="body2" className="text-blue-700 dark:text-blue-300">
                <strong>Need help?</strong> Contact {user.workspaceName} directly for support.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  if (user.status === 'pending') {
    return (
      <Box className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Box className="max-w-md w-full">
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-5 w-5" />
            <Box>
              <Typography variant="h6" className="font-semibold mb-2">
                Account Pending Approval
              </Typography>
              <Typography variant="body2">
                Your account is awaiting approval from {user.workspaceName}. You'll receive an email once approved.
              </Typography>
            </Box>
          </Alert>
          
          <Box className="text-center">
            <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <Typography variant="h5" className="text-gray-900 dark:text-white font-semibold mb-2">
              Approval Pending
            </Typography>
            <Typography variant="body1" className="text-gray-600 dark:text-gray-400 mb-6">
              Your registration is being reviewed by the pharmacy team.
            </Typography>
            
            <Box className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <Typography variant="body2" className="text-yellow-700 dark:text-yellow-300">
                <strong>What's next?</strong> You'll receive an email notification once your account is approved. 
                This usually takes 1-2 business days.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // Check email verification requirement
  if (requireEmailVerification && !user.emailVerified) {
    return (
      <Navigate
        to="/patient-portal/verify-email"
        state={{ from: location }}
        replace
      />
    );
  }

  // Check profile completion requirement
  if (requireProfileComplete && !user.profileComplete) {
    return (
      <Navigate
        to="/patient-portal/complete-profile"
        state={{ from: location }}
        replace
      />
    );
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;