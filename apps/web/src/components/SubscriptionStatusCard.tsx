import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStatus } from '../hooks/useSubscription';

const SubscriptionStatusCard: React.FC = () => {
  const navigate = useNavigate();
  const subscriptionData = useSubscriptionStatus();
  const {
    hasWorkspace,
    hasSubscription,
    status,
    tier,
    isTrialActive,
    daysRemaining,
    loading,
  } = subscriptionData || {};

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Subscription Status
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (!hasWorkspace) return 'warning';
    if (!hasSubscription) return 'error';
    if (isTrialActive && daysRemaining && daysRemaining <= 3) return 'warning';
    if (isTrialActive) return 'info';
    if (status === 'active') return 'success';
    return 'error';
  };

  const getStatusText = () => {
    if (!hasWorkspace) return 'No Workplace';
    if (!hasSubscription) return 'No Subscription';
    if (isTrialActive) return `Free Trial (${daysRemaining} days left)`;
    if (status === 'active') return 'Active Subscription';
    return 'Subscription Expired';
  };

  const getStatusIcon = () => {
    const color = getStatusColor();
    if (color === 'success') return <CheckCircleIcon color="success" />;
    if (color === 'warning') return <WarningIcon color="warning" />;
    return <WarningIcon color="error" />;
  };

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6">Subscription Status</Typography>
          {getStatusIcon()}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip
            label={getStatusText()}
            color={getStatusColor() as 'success' | 'warning' | 'error' | 'info'}
            variant="filled"
          />
          {tier && (
            <Chip
              label={tier.charAt(0).toUpperCase() + tier.slice(1)}
              variant="outlined"
            />
          )}
        </Box>

        {/* No Workspace Alert */}
        {!hasWorkspace && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Create or join a workplace to access full features.
            </Typography>
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate('/dashboard')}
              sx={{ mt: 1 }}
            >
              Set Up Workplace
            </Button>
          </Alert>
        )}

        {/* Trial Warning */}
        {hasWorkspace &&
          isTrialActive &&
          daysRemaining &&
          daysRemaining <= 7 && (
            <Alert
              severity={daysRemaining <= 3 ? 'warning' : 'info'}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" gutterBottom>
                Your free trial expires in {daysRemaining} day
                {daysRemaining !== 1 ? 's' : ''}.
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<UpgradeIcon />}
                onClick={() => navigate('/subscription-management')}
                sx={{ mt: 1 }}
              >
                Upgrade Now
              </Button>
            </Alert>
          )}

        {/* Trial Progress Bar */}
        {hasWorkspace && isTrialActive && daysRemaining !== undefined && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Trial Progress
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((14 - daysRemaining) / 14) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* Expired Subscription */}
        {hasWorkspace && !hasSubscription && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Your subscription has expired. Upgrade to continue using all
              features.
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<UpgradeIcon />}
              onClick={() => navigate('/subscription-management')}
              sx={{ mt: 1 }}
            >
              Renew Subscription
            </Button>
          </Alert>
        )}

        {/* Active Subscription */}
        {hasWorkspace && status === 'active' && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              You have full access to all features.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/subscription-management')}
              sx={{ mt: 1 }}
            >
              Manage Subscription
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatusCard;
