import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import InfoIcon from '@mui/icons-material/Info';
import StarIcon from '@mui/icons-material/Star';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckIcon from '@mui/icons-material/Check';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import axios from 'axios';

interface Plan {
  _id: string;
  name: string;
  code: string;
  tier: string;
  tierRank: number;
  priceNGN: number;
  billingInterval: 'monthly' | 'yearly';
  popularPlan: boolean;
  isContactSales: boolean;
  whatsappNumber?: string;
  description: string;
  displayFeatures: string[];
  limits: {
    patients: number | null;
    users: number | null;
    locations: number | null;
    storage: number | null;
    apiCalls: number | null;
    clinicalNotes: number | null;
    reminderSms: number | null;
  };
}

interface SubscriptionStatus {
  hasWorkspace: boolean;
  hasSubscription: boolean;
  status: string;
  tier?: string;
  accessLevel: 'basic' | 'limited' | 'full';
  isTrialActive?: boolean;
  daysRemaining?: number;
  endDate?: string;
  message?: string;
}

const SubscriptionManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>(
    'monthly'
  );
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch subscription status
      const statusResponse = await axios.get('/api/subscriptions/status', {
        withCredentials: true, // Use httpOnly cookies for authentication
      });

      if (statusResponse.data.success) {
        setSubscriptionStatus(statusResponse.data.data);
      }

      // Fetch available plans
      const plansResponse = await axios.get(
        `/api/subscriptions/plans?billingInterval=${billingInterval}`,
        {
          withCredentials: true, // Use httpOnly cookies for authentication
        }
      );

      if (plansResponse.data.success) {
        setPlans(plansResponse.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching subscription data:', error);

      if (error.response?.status === 401) {
        // User not authenticated, redirect to login
        window.location.href = '/login';
        return;
      }

      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  }, [billingInterval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (plan: Plan) => {
    if (plan.isContactSales) {
      // Open WhatsApp for enterprise plans
      if (plan.whatsappNumber) {
        const message = encodeURIComponent(
          `Hi! I'm interested in the ${plan.name} plan. Can you provide more information about pricing and features?`
        );
        window.open(
          `https://wa.me/${plan.whatsappNumber.replace(
            '+',
            ''
          )}?text=${message}`,
          '_blank'
        );
      }
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        '/api/subscriptions/checkout',
        {
          planId: plan._id,
          billingInterval,
          callbackUrl: `${window.location.origin}/subscription/success`,
        },
        {
          withCredentials: true, // Use httpOnly cookies for authentication
        }
      );

      if (response.data.success && response.data.data?.authorization_url) {
        // Redirect to payment provider checkout
        window.location.href = response.data.data.authorization_url;
      } else {
        setError(response.data.message || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start upgrade process');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'trial':
        return 'info';
      case 'active':
        return 'success';
      case 'expired':
      case 'no_subscription':
        return 'error';
      case 'no_workspace':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: SubscriptionStatus) => {
    if (!status.hasWorkspace) {
      return 'No Workplace';
    }
    if (!status.hasSubscription) {
      return 'No Subscription';
    }
    if (status.isTrialActive) {
      return `Trial (${status.daysRemaining} days left)`;
    }
    return status.status.charAt(0).toUpperCase() + status.status.slice(1);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Subscription Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your subscription and upgrade your plan to unlock more features
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Current Status Card */}
      {subscriptionStatus && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Current Status
                </Typography>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
                >
                  <Chip
                    label={getStatusText(subscriptionStatus)}
                    color={
                      getStatusColor(subscriptionStatus.status) as
                        | 'success'
                        | 'warning'
                        | 'error'
                        | 'info'
                    }
                    variant="filled"
                  />
                  {subscriptionStatus.tier && (
                    <Chip
                      label={
                        subscriptionStatus.tier.charAt(0).toUpperCase() +
                        subscriptionStatus.tier.slice(1)
                      }
                      variant="outlined"
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {subscriptionStatus.message}
                </Typography>
              </Box>

              {subscriptionStatus.isTrialActive && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Trial Progress
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={
                        ((14 - (subscriptionStatus.daysRemaining || 0)) / 14) *
                        100
                      }
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {subscriptionStatus.daysRemaining} days remaining in your
                    free trial
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* No Workspace Alert */}
      {subscriptionStatus && !subscriptionStatus.hasWorkspace && (
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="body1" gutterBottom>
            You need to create or join a workplace to access subscription
            features.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
              sx={{ mr: 2 }}
            >
              Create Workplace
            </Button>
            <Button variant="outlined" onClick={() => navigate('/dashboard')}>
              Join Workplace
            </Button>
          </Box>
        </Alert>
      )}

      {/* Billing Interval Toggle */}
      {subscriptionStatus?.hasWorkspace && (
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ p: 1, display: 'flex', borderRadius: 2 }}>
            <Button
              variant={billingInterval === 'monthly' ? 'contained' : 'text'}
              onClick={() => setBillingInterval('monthly')}
              sx={{ borderRadius: 1 }}
            >
              Monthly
            </Button>
            <Button
              variant={billingInterval === 'yearly' ? 'contained' : 'text'}
              onClick={() => setBillingInterval('yearly')}
              sx={{ borderRadius: 1 }}
            >
              Yearly
              <Chip
                label="Save 17%"
                size="sm"
                color="success"
                sx={{ ml: 1 }}
              />
            </Button>
          </Paper>
        </Box>
      )}

      {/* Plans Grid */}
      {subscriptionStatus?.hasWorkspace && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {plans.map((plan) => (
            <Card
              key={plan._id}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: plan.popularPlan ? 2 : 1,
                borderColor: plan.popularPlan ? 'primary.main' : 'divider',
                '&:hover': {
                  boxShadow: (theme) => theme.shadows[8],
                  transform: 'translateY(-4px)',
                },
                transition: 'all 0.3s ease-in-out',
              }}
            >
              {plan.popularPlan && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <StarIcon fontSize="small" />
                  <Typography variant="caption" fontWeight="bold">
                    Most Popular
                  </Typography>
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {plan.name}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {plan.description}
                </Typography>

                <Box sx={{ mb: 3 }}>
                  {plan.isContactSales ? (
                    <Typography variant="h4" component="div">
                      Custom
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="h4" component="div">
                        {formatPrice(plan.priceNGN)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        per{' '}
                        {plan.billingInterval === 'yearly' ? 'year' : 'month'}
                      </Typography>
                    </>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <List dense>
                  {plan.displayFeatures.slice(0, 6).map((feature, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2">{feature}</Typography>
                        }
                      />
                    </ListItem>
                  ))}
                  {plan.displayFeatures.length > 6 && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <InfoIcon color="info" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{ fontStyle: 'italic' }}
                          >
                            +{plan.displayFeatures.length - 6} more features
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>

              <Box sx={{ p: 3, pt: 0 }}>
                {plan.isContactSales ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<WhatsAppIcon />}
                    onClick={() => handleUpgrade(plan)}
                    sx={{ py: 1.5 }}
                  >
                    Contact Sales
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant={plan.popularPlan ? 'contained' : 'outlined'}
                    startIcon={<UpgradeIcon />}
                    onClick={() => handleUpgrade(plan)}
                    sx={{ py: 1.5 }}
                  >
                    {subscriptionStatus?.tier === plan.tier
                      ? 'Current Plan'
                      : 'Upgrade'}
                  </Button>
                )}
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Upgrade Confirmation Dialog */}
      <Dialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
      >
        <DialogTitle>Confirm Plan Upgrade</DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Box>
              <Typography variant="body1" gutterBottom>
                You are about to upgrade to the{' '}
                <strong>{selectedPlan.name}</strong> plan.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You will be charged {formatPrice(selectedPlan.priceNGN)}{' '}
                {selectedPlan.billingInterval === 'yearly'
                  ? 'annually'
                  : 'monthly'}
                .
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your new features will be available immediately after payment
                confirmation.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedPlan) {
                handleUpgrade(selectedPlan);
                setSelectedPlan(null);
              }
              setUpgradeDialogOpen(false);
            }}
          >
            Proceed to Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubscriptionManagement;
