import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscriptionService } from '../../services/subscriptionService';
import { useSubscriptionStatus } from '../../hooks/useSubscription';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch: refetchSubscription } = useSubscriptionStatus();
  const { refreshUser } = useAuth();
  const addNotification = useUIStore((state) => state.addNotification);

  useEffect(() => {
    const verifyPayment = async () => {
      const reference =
        searchParams.get('reference') || searchParams.get('trxref');

      if (!reference) {
        setError('No payment reference found');
        setLoading(false);
        return;
      }

      try {
        const result = await subscriptionService.verifyPayment(reference);

        if (result.success) {
          setSuccess(true);
          
          // Refresh subscription status and user data
          await Promise.all([refetchSubscription(), refreshUser()]);
          
          addNotification({
            type: 'success',
            title: 'Subscription Activated',
            message: 'Your subscription has been successfully activated!',
            duration: 5000,
          });
        } else {
          throw new Error(result.message || 'Payment verification failed');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Payment verification failed';
        setError(errorMessage);
        addNotification({
          type: 'error',
          title: 'Payment Verification Failed',
          message: errorMessage,
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, addNotification, refetchSubscription, refreshUser]);

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const handleRetry = () => {
    navigate('/subscription-management');
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress size={64} sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            Verifying Payment...
          </Typography>
          <Typography color="text.secondary">
            Please wait while we verify your payment and activate your
            subscription.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        {success ? (
          <>
            <CheckCircleIcon
              sx={{
                fontSize: 80,
                color: 'success.main',
                mb: 3,
              }}
            />
            <Typography variant="h4" gutterBottom color="success.main">
              Payment Successful!
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
              Your subscription has been activated successfully.
            </Typography>
            <Alert severity="success" sx={{ mb: 4 }}>
              You now have full access to all the features included in your
              plan.
            </Alert>
            <Button
              variant="contained"
              size="large"
              onClick={handleContinue}
              sx={{ minWidth: 200 }}
            >
              Continue to Dashboard
            </Button>
          </>
        ) : (
          <>
            <ErrorOutlineIcon
              sx={{
                fontSize: 80,
                color: 'error.main',
                mb: 3,
              }}
            />
            <Typography variant="h4" gutterBottom color="error.main">
              Payment Verification Failed
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
              {error || 'There was an issue verifying your payment.'}
            </Typography>
            <Alert severity="error" sx={{ mb: 4 }}>
              Don't worry! If your payment was processed, it may take a few
              minutes to reflect. If you continue to have issues, please contact
              support.
            </Alert>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="outlined" size="large" onClick={handleRetry}>
                Try Again
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default SubscriptionSuccess;
