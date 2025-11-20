import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Alert,
} from '@mui/material';
import { useSubscriptionStatus } from '../hooks/useSubscription';

interface TrialExpiryHandlerProps {
  children: React.ReactNode;
}

const TrialExpiryHandler: React.FC<TrialExpiryHandlerProps> = ({
  children,
}) => {
  const { status, daysRemaining, loading } = useSubscriptionStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show expiry dialog on subscription-related pages
  const isSubscriptionPage = location.pathname.includes('/subscription');

  // Check if user has dismissed the popup recently (within 24 hours)
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('trialWarningDismissedUntil');
    if (dismissedUntil) {
      const dismissedTime = new Date(dismissedUntil);
      const now = new Date();
      if (now < dismissedTime) {
        setIsDismissed(true);
      } else {
        // Clear expired dismissal
        localStorage.removeItem('trialWarningDismissedUntil');
        setIsDismissed(false);
      }
    }
  }, []);

  const handleRemindLater = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem('trialWarningDismissedUntil', dismissUntil.toISOString());
    setIsDismissed(true);
  };

  useEffect(() => {
    // If trial has expired and user is not on a subscription page, redirect
    if (!loading && status === 'expired' && !isSubscriptionPage) {
      navigate('/subscription-management', {
        state: {
          from: location.pathname,
          reason: 'trial_expired',
        },
      });
    }
  }, [status, loading, isSubscriptionPage, navigate, location]);

  // Show warning when trial is about to expire (3 days or less)
  const showTrialWarning =
    !loading &&
    status === 'trial' &&
    daysRemaining !== undefined &&
    daysRemaining <= 3 &&
    daysRemaining > 0 &&
    !isSubscriptionPage &&
    !isDismissed;

  return (
    <>
      {children}

      {/* Trial Warning Dialog */}
      <Dialog
        open={showTrialWarning}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 2 },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" component="div" color="warning.main">
            ⚠️ Trial Ending Soon
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your free trial expires in {daysRemaining} day
            {daysRemaining !== 1 ? 's' : ''}
          </Alert>

          <Typography variant="body1" sx={{ mb: 2 }}>
            To continue using all features without interruption, please upgrade
            to a paid plan.
          </Typography>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              After your trial expires, you'll lose access to:
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Patient management</li>
              <li>Medication tracking</li>
              <li>Advanced reports</li>
              <li>Team collaboration</li>
            </ul>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => navigate('/subscription-management')}
            variant="contained"
            color="primary"
            size="large"
          >
            Upgrade Now
          </Button>
          <Button
            onClick={handleRemindLater}
            variant="text"
          >
            Remind Me Later
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TrialExpiryHandler;
