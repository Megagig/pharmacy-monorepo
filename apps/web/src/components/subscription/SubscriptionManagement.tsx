import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  FormControlLabel,
  Switch,
  Container,
  Paper,
  Divider,
  Stack,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import SupportIcon from '@mui/icons-material/Support';
import GroupIcon from '@mui/icons-material/Group';
import { useUIStore } from '../../stores';
import {
  useCurrentSubscriptionQuery,
  useAvailablePlansQuery,
} from '../../queries/useSubscription';
import {
  subscriptionService,
  SubscriptionPlan,
} from '../../services/subscriptionService';

const SubscriptionManagement: React.FC = () => {
  const addNotification = useUIStore((state) => state.addNotification);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>(
    'monthly'
  );
  const [loading, setLoading] = useState<string | null>(null);

  // Queries
  const { data: currentSubscription, isLoading: subscriptionLoading } =
    useCurrentSubscriptionQuery();

  const { data: plans = [], isLoading: plansLoading } =
    useAvailablePlansQuery(billingInterval);

  // Helper function to convert features object to display features array
  const getDisplayFeatures = (plan: SubscriptionPlan): string[] => {
    const features = [];

    if (plan.features.patientLimit) {
      if (plan.features.patientLimit === -1) {
        features.push('Unlimited patients');
      } else {
        features.push(`Up to ${plan.features.patientLimit} patients`);
      }
    } else {
      features.push('Unlimited patients');
    }

    if (plan.features.reminderSmsMonthlyLimit) {
      if (plan.features.reminderSmsMonthlyLimit === -1) {
        features.push('Unlimited SMS reminders');
      } else {
        features.push(
          `${plan.features.reminderSmsMonthlyLimit} SMS reminders/month`
        );
      }
    }

    if (plan.features.reportsExport) features.push('Export reports');
    if (plan.features.careNoteExport) features.push('Export care notes');
    if (plan.features.adrModule) features.push('ADR monitoring');
    if (plan.features.multiUserSupport) features.push('Multi-user support');

    if (plan.features.teamSize) {
      if (plan.features.teamSize === -1) {
        features.push('Unlimited team members');
      } else {
        features.push(`Up to ${plan.features.teamSize} team members`);
      }
    }

    if (plan.features.apiAccess) features.push('API access');
    if (plan.features.customIntegrations) features.push('Custom integrations');
    if (plan.features.prioritySupport) features.push('Priority support');

    // New features for Pharmily and Network tiers
    if (plan.features.adrReporting) features.push('ADR Reporting');
    if (plan.features.drugInteractionChecker)
      features.push('Drug Interaction Checker');
    if (plan.features.doseCalculator) features.push('Dose Calculator');
    if (plan.features.multiLocationDashboard)
      features.push('Multi-location Dashboard');
    if (plan.features.sharedPatientRecords)
      features.push('Shared Patient Records');
    if (plan.features.groupAnalytics) features.push('Group Analytics');
    if (plan.features.cdss) features.push('Clinical Decision Support System');

    return features;
  };

  // Use plans directly from the query (already filtered by billing interval)
  const tierOrder = [
    'free_trial',
    'basic',
    'pro',
    'pharmily',
    'network',
    'enterprise',
  ];
  const filteredPlans = plans.sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  );

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.subscription?.planId?._id === planId;
  };

  const getTrialDaysRemaining = () => {
    if (
      currentSubscription?.subscription?.status === 'trial' &&
      currentSubscription?.subscription?.endDate
    ) {
      const endDate = new Date(currentSubscription.subscription.endDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    return 0;
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    // Handle Enterprise contact sales
    if (plan.isContactSales && plan.whatsappNumber) {
      const message = encodeURIComponent(
        `Hello! I'm interested in the ${plan.name} plan for my pharmacy. Could you please provide more details about pricing and features?`
      );
      const whatsappUrl = `https://wa.me/${plan.whatsappNumber.replace(
        /[^0-9]/g,
        ''
      )}?text=${message}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    if (isCurrentPlan(plan._id)) {
      addNotification({
        type: 'info',
        title: 'Already Subscribed',
        message: 'You are already subscribed to this plan',
        duration: 3000,
      });
      return;
    }

    setLoading(plan._id);
    try {
      const response = await subscriptionService.createCheckoutSession(
        plan._id,
        billingInterval
      );

      if (response.success && response.data?.authorization_url) {
        // Redirect to Paystack checkout
        window.location.href = response.data.authorization_url;
      } else {
        throw new Error(
          response.message || 'Failed to create checkout session'
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to initiate subscription';
      addNotification({
        type: 'error',
        title: 'Subscription Error',
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(null);
    }
  };

  const formatPrice = (price: number, interval: 'monthly' | 'yearly') => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);

    if (interval === 'yearly') {
      const monthlyEquivalent = Math.round(price / 12);
      return `${formatted}/year (₦${monthlyEquivalent.toLocaleString()}/mo)`;
    }

    return `${formatted}/month`;
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'free_trial':
        return <StarIcon color="action" />;
      case 'basic':
        return <SecurityIcon color="primary" />;
      case 'pro':
        return <TrendingUpIcon color="secondary" />;
      case 'pharmily':
        return <GroupIcon color="info" />;
      case 'network':
        return <SupportIcon color="warning" />;
      case 'enterprise':
        return <GroupIcon color="success" />;
      default:
        return <StarIcon color="action" />;
    }
  };

  const getYearlySavings = (monthlyPrice: number) => {
    // 25% discount calculation: Monthly × 12 × 0.75
    const yearlyPrice = monthlyPrice * 12 * 0.75;
    const actualYearlyCost = monthlyPrice * 12;
    const savings = actualYearlyCost - yearlyPrice;
    const savingsPercentage = (savings / actualYearlyCost) * 100;
    return Math.round(savingsPercentage);
  };

  if (subscriptionLoading || plansLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <LinearProgress sx={{ width: '100%' }} />
        </Box>
        <Typography variant="h6" align="center">
          Loading subscription plans...
        </Typography>
      </Container>
    );
  }

  const trialDaysRemaining = getTrialDaysRemaining();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Subscription Plans
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          Choose the perfect plan for your pharmacy needs
        </Typography>

        {/* Current Subscription Status */}
        {currentSubscription?.subscription && (
          <Alert
            severity={
              currentSubscription.subscription.status === 'trial'
                ? 'info'
                : 'success'
            }
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            <Typography variant="body1">
              {currentSubscription.subscription.status === 'trial' ? (
                <>
                  You are currently on a <strong>Free Trial</strong>
                  {trialDaysRemaining > 0 ? (
                    <>
                      {' '}
                      with <strong>{trialDaysRemaining} days remaining</strong>
                    </>
                  ) : (
                    <>
                      {' '}
                      that has <strong>expired</strong>
                    </>
                  )}
                </>
              ) : (
                <>
                  Current Plan:{' '}
                  <strong>
                    {currentSubscription.subscription.planId?.name || 'Unknown'}
                  </strong>
                </>
              )}
            </Typography>
          </Alert>
        )}

        {/* Billing Toggle */}
        <Paper elevation={1} sx={{ display: 'inline-flex', p: 1, mb: 4 }}>
          <FormControlLabel
            control={
              <Switch
                checked={billingInterval === 'yearly'}
                onChange={(e) =>
                  setBillingInterval(e.target.checked ? 'yearly' : 'monthly')
                }
                color="primary"
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">
                  {billingInterval === 'monthly' ? 'Monthly' : 'Yearly'}
                </Typography>
                {billingInterval === 'yearly' && (
                  <Chip
                    label="Save 25%"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </Stack>
            }
          />
        </Paper>
      </Box>

      {/* Plans Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 3,
          mb: 6,
          justifyItems: 'center',
        }}
      >
        {filteredPlans.map((plan) => (
          <Box key={plan._id}>
            <Card
              elevation={plan.popularPlan ? 8 : 2}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: plan.popularPlan ? 2 : 1,
                borderColor: plan.popularPlan ? 'primary.main' : 'divider',
                transform: plan.popularPlan ? 'scale(1.05)' : 'none',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: plan.popularPlan ? 'scale(1.07)' : 'scale(1.02)',
                  boxShadow: (theme) => theme.shadows[8],
                },
              }}
            >
              {plan.popularPlan && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1,
                  }}
                >
                  <Chip
                    label="Most Popular"
                    color="primary"
                    icon={<StarIcon />}
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, pt: plan.popularPlan ? 4 : 2 }}>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box sx={{ mb: 2 }}>{getPlanIcon(plan.tier)}</Box>

                  <Typography
                    variant="h5"
                    component="h2"
                    fontWeight="bold"
                    gutterBottom
                  >
                    {plan.name}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {plan.description}
                  </Typography>

                  {plan.tier === 'free_trial' ? (
                    <Box>
                      <Typography
                        variant="h3"
                        fontWeight="bold"
                        color="primary.main"
                      >
                        Free
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        14-day trial
                      </Typography>
                    </Box>
                  ) : plan.isContactSales ? (
                    <Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="primary.main"
                      >
                        Contact Sales
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Custom pricing
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Typography
                        variant="h3"
                        fontWeight="bold"
                        color="primary.main"
                      >
                        {
                          formatPrice(plan.priceNGN, billingInterval).split(
                            '/'
                          )[0]
                        }
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        /{billingInterval === 'monthly' ? 'month' : 'year'}
                      </Typography>
                      {billingInterval === 'yearly' && (
                        <Typography
                          variant="caption"
                          color="success.main"
                          fontWeight="bold"
                        >
                          Save ₦
                          {getYearlySavings(plan.priceNGN).toLocaleString()}
                          /month
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <List dense sx={{ mb: 3 }}>
                  {getDisplayFeatures(plan)
                    .slice(0, 6)
                    .map((feature, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontSize: '0.875rem',
                          }}
                        />
                      </ListItem>
                    ))}
                </List>

                <Button
                  variant={plan.popularPlan ? 'contained' : 'outlined'}
                  color={plan.popularPlan ? 'primary' : 'inherit'}
                  fullWidth
                  size="large"
                  disabled={loading === plan._id || isCurrentPlan(plan._id)}
                  onClick={() => handleSubscribe(plan)}
                  sx={{
                    mt: 'auto',
                    fontWeight: 'bold',
                    py: 1.5,
                  }}
                >
                  {loading === plan._id
                    ? 'Processing...'
                    : isCurrentPlan(plan._id)
                    ? 'Current Plan'
                    : plan.isContactSales
                    ? 'Contact Sales'
                    : 'Subscribe Now'}
                </Button>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Additional Information */}
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="h6" gutterBottom>
          All plans include
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mt: 2,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SecurityIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="body2">Secure & Compliant</Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SupportIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="body2">24/7 Support</Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="body2">No Setup Fees</Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default SubscriptionManagement;
