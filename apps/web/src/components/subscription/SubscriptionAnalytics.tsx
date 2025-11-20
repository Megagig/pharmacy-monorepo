import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  Stack,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
} from '@mui/material';
// Import our custom Grid components to fix type issues
import { GridContainer, GridItem } from '../common/grid/GridSystem';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SavingsIcon from '@mui/icons-material/Savings';
import AssessmentIcon from '@mui/icons-material/Assessment';
import StorageIcon from '@mui/icons-material/Storage';
import PeopleIcon from '@mui/icons-material/People';
import ApiIcon from '@mui/icons-material/Api';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { paymentService } from '../../services/paymentService';
import { useUIStore } from '../../stores';
import LoadingSpinner from '../LoadingSpinner';

interface UsageMetrics {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  daysRemaining: number;
  features: string[];
  storageUsed: number;
  apiCalls: number;
  teamMembers: number;
}

interface CostOptimization {
  currentMonthlySpend: number;
  projectedAnnualSpend: number;
  savings: {
    yearlyVsMonthly: number;
    downgradeSavings: number;
  };
}

interface Subscription {
  id: string;
  planName: string;
  status: string;
  tier: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  price: number;
  interval: string;
}

interface SubscriptionAnalytics {
  subscription: Subscription;
  usageMetrics: UsageMetrics;
  costOptimization: CostOptimization;
}

const SubscriptionAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await paymentService.getSubscriptionAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load subscription analytics',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
  };

  const getRemainingDaysColor = (days: number) => {
    if (days <= 7) return 'error';
    if (days <= 30) return 'warning';
    return 'success';
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  if (!analytics) {
    return (
      <Alert severity="info">
        No analytics data available. Please ensure you have an active
        subscription.
      </Alert>
    );
  }

  const { subscription, usageMetrics, costOptimization } = analytics;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <AnalyticsIcon />
        <Typography variant="h5">Subscription Analytics</Typography>
      </Stack>

      <GridContainer spacing={3}>
        {/* Current Period Overview */}
        <GridItem xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Billing Period
              </Typography>
              <GridContainer spacing={3}>
                <GridItem xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Period
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(usageMetrics.currentPeriodStart)} -{' '}
                      {formatDate(usageMetrics.currentPeriodEnd)}
                    </Typography>
                  </Box>
                </GridItem>
                <GridItem xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Days Remaining
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">
                        {usageMetrics.daysRemaining}
                      </Typography>
                      <Chip
                        label={
                          usageMetrics.daysRemaining <= 7
                            ? 'Ending Soon'
                            : 'Active'
                        }
                        color={getRemainingDaysColor(
                          usageMetrics.daysRemaining
                        )}
                        size="small"
                        icon={<ScheduleIcon />}
                      />
                    </Stack>
                  </Box>
                </GridItem>
                <GridItem xs={12} md={4}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Current Plan
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {subscription.tier.replace('_', ' ')}
                    </Typography>
                  </Box>
                </GridItem>
              </GridContainer>
            </CardContent>
          </Card>
        </GridItem>

        {/* Usage Metrics */}
        <GridItem xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage Metrics
              </Typography>

              <GridContainer spacing={3}>
                {/* Storage Usage */}
                <GridItem xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 1 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StorageIcon color="primary" />
                        <Typography variant="body2">Storage Usage</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {usageMetrics.storageUsed} GB used
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={getUsagePercentage(usageMetrics.storageUsed, 10)} // Assuming 10GB limit
                      color={getUsageColor(
                        getUsagePercentage(usageMetrics.storageUsed, 10)
                      )}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </GridItem>

                {/* API Calls */}
                <GridItem xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 1 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ApiIcon color="primary" />
                        <Typography variant="body2">
                          API Calls This Month
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {usageMetrics.apiCalls.toLocaleString()} calls
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={getUsagePercentage(usageMetrics.apiCalls, 10000)} // Assuming 10k limit
                      color={getUsageColor(
                        getUsagePercentage(usageMetrics.apiCalls, 10000)
                      )}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </GridItem>

                {/* Team Members */}
                <GridItem xs={12}>
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PeopleIcon color="primary" />
                        <Typography variant="body2">Team Members</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {usageMetrics.teamMembers} members
                      </Typography>
                    </Stack>
                  </Box>
                </GridItem>
              </GridContainer>
            </CardContent>
          </Card>
        </GridItem>

        {/* Cost Overview */}
        <GridItem xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cost Overview
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Current Monthly Cost
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatCurrency(costOptimization.currentMonthlySpend)}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Projected Annual Cost
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(costOptimization.projectedAnnualSpend)}
                  </Typography>
                </Box>

                {costOptimization.savings.yearlyVsMonthly > 0 && (
                  <Alert severity="info" icon={<SavingsIcon />}>
                    <Typography variant="body2">
                      Save{' '}
                      {formatCurrency(costOptimization.savings.yearlyVsMonthly)}{' '}
                      with annual billing
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </GridItem>

        {/* Feature Usage */}
        <GridItem xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Features
              </Typography>

              <List dense>
                {usageMetrics.features.map((feature, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={feature
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </GridItem>

        {/* Optimization Suggestions */}
        <GridItem xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Optimization Suggestions
              </Typography>

              <Stack spacing={2}>
                {usageMetrics.daysRemaining <= 7 && (
                  <Alert severity="warning" icon={<WarningIcon />}>
                    <Typography variant="body2">
                      Your subscription renews in {usageMetrics.daysRemaining}{' '}
                      days. Consider switching to annual billing to save money.
                    </Typography>
                  </Alert>
                )}

                {getUsagePercentage(usageMetrics.storageUsed, 10) > 80 && (
                  <Alert severity="info">
                    <Typography variant="body2">
                      You're using{' '}
                      {Math.round(
                        getUsagePercentage(usageMetrics.storageUsed, 10)
                      )}
                      % of your storage. Consider upgrading your plan if you
                      need more space.
                    </Typography>
                  </Alert>
                )}

                {costOptimization.savings.yearlyVsMonthly > 0 && (
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'success.light',
                      color: 'success.contrastText',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TrendingUpIcon />
                      <Box>
                        <Typography variant="subtitle2">
                          Annual Billing Savings
                        </Typography>
                        <Typography variant="body2">
                          Switch to annual billing and save{' '}
                          {formatCurrency(
                            costOptimization.savings.yearlyVsMonthly
                          )}{' '}
                          per year!
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                )}

                {usageMetrics.storageUsed < 2 &&
                  usageMetrics.apiCalls < 1000 && (
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: 'info.light',
                        color: 'info.contrastText',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TrendingDownIcon />
                        <Box>
                          <Typography variant="subtitle2">
                            Consider Downgrading
                          </Typography>
                          <Typography variant="body2">
                            Based on your usage, you might be able to save money
                            with a lower-tier plan.
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  )}
              </Stack>
            </CardContent>
          </Card>
        </GridItem>

        {/* Quick Actions */}
        <GridItem xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() =>
                    (window.location.href =
                      '/dashboard/subscription/billing-history')
                  }
                >
                  View Billing History
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  onClick={() =>
                    (window.location.href = '/dashboard/subscription/plans')
                  }
                >
                  Upgrade Plan
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SavingsIcon />}
                  onClick={() =>
                    (window.location.href =
                      '/dashboard/subscription/payment-methods')
                  }
                >
                  Manage Payment Methods
                </Button>
                {costOptimization.savings.yearlyVsMonthly > 0 && (
                  <Button
                    variant="contained"
                    startIcon={<StarIcon />}
                    color="success"
                  >
                    Switch to Annual Billing
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </GridItem>
      </GridContainer>
    </Box>
  );
};

export default SubscriptionAnalytics;
