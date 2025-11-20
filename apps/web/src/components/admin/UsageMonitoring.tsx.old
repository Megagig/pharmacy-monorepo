import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Alert,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { adminService } from '../../services/adminService';
import { useUIStore } from '../../stores';

interface UsageData {
  period: string;
  users: number;
  activeUsers: number;
  subscriptions: number;
  activeSubscriptions: number;
  revenue: number;
  apiCalls: number;
  storageUsed: number;
}

interface UsageMetrics {
  currentPeriod: UsageData;
  previousPeriod: UsageData;
  growth: {
    users: number;
    activeUsers: number;
    subscriptions: number;
    revenue: number;
    apiCalls: number;
  };
}

const UsageMonitoring: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>(
    'month'
  );
  const [error, setError] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call the adminService
      // For now, we'll mock the data structure
      const mockMetrics: UsageMetrics = {
        currentPeriod: {
          period: 'This Month',
          users: 1240,
          activeUsers: 980,
          subscriptions: 850,
          activeSubscriptions: 720,
          revenue: 45000,
          apiCalls: 125000,
          storageUsed: 245,
        },
        previousPeriod: {
          period: 'Last Month',
          users: 1120,
          activeUsers: 890,
          subscriptions: 780,
          activeSubscriptions: 650,
          revenue: 38000,
          apiCalls: 110000,
          storageUsed: 210,
        },
        growth: {
          users: 10.7,
          activeUsers: 10.1,
          subscriptions: 9.0,
          revenue: 18.4,
          apiCalls: 13.6,
        },
      };

      setUsageMetrics(mockMetrics);
    } catch (err) {
      setError('Failed to load usage data');
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load usage monitoring data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsageData();
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getGrowthIcon = (value: number) => {
    if (value > 0) {
      return (
        <TrendingUpIcon sx={{ color: 'success.main', fontSize: '1rem' }} />
      );
    } else if (value < 0) {
      return (
        <TrendingDownIcon sx={{ color: 'error.main', fontSize: '1rem' }} />
      );
    }
    return null;
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'success.main';
    if (value < 0) return 'error.main';
    return 'text.primary';
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" component="h1">
            Usage Monitoring & Analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <MenuItem value="day">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadUsageData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Usage Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary">
                  Total Users
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {usageMetrics?.currentPeriod.users.toLocaleString() || '0'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getGrowthIcon(usageMetrics?.growth.users || 0)}
                <Typography
                  variant="body2"
                  sx={{
                    color: getGrowthColor(usageMetrics?.growth.users || 0),
                    ml: 0.5,
                  }}
                >
                  {usageMetrics?.growth.users.toFixed(1) || '0'}%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs {usageMetrics?.previousPeriod.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="textSecondary">
                  Active Users
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {usageMetrics?.currentPeriod.activeUsers.toLocaleString() ||
                  '0'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getGrowthIcon(usageMetrics?.growth.activeUsers || 0)}
                <Typography
                  variant="body2"
                  sx={{
                    color: getGrowthColor(
                      usageMetrics?.growth.activeUsers || 0
                    ),
                    ml: 0.5,
                  }}
                >
                  {usageMetrics?.growth.activeUsers.toFixed(1) || '0'}%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs {usageMetrics?.previousPeriod.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StorageIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="body2" color="textSecondary">
                  Subscriptions
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {usageMetrics?.currentPeriod.subscriptions.toLocaleString() ||
                  '0'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getGrowthIcon(usageMetrics?.growth.subscriptions || 0)}
                <Typography
                  variant="body2"
                  sx={{
                    color: getGrowthColor(
                      usageMetrics?.growth.subscriptions || 0
                    ),
                    ml: 0.5,
                  }}
                >
                  {usageMetrics?.growth.subscriptions.toFixed(1) || '0'}%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs {usageMetrics?.previousPeriod.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="body2" color="textSecondary">
                  Revenue
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(usageMetrics?.currentPeriod.revenue || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getGrowthIcon(usageMetrics?.growth.revenue || 0)}
                <Typography
                  variant="body2"
                  sx={{
                    color: getGrowthColor(usageMetrics?.growth.revenue || 0),
                    ml: 0.5,
                  }}
                >
                  {usageMetrics?.growth.revenue.toFixed(1) || '0'}%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs {usageMetrics?.previousPeriod.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AnalyticsIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="body2" color="textSecondary">
                  API Calls
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatNumber(usageMetrics?.currentPeriod.apiCalls || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getGrowthIcon(usageMetrics?.growth.apiCalls || 0)}
                <Typography
                  variant="body2"
                  sx={{
                    color: getGrowthColor(usageMetrics?.growth.apiCalls || 0),
                    ml: 0.5,
                  }}
                >
                  {usageMetrics?.growth.apiCalls.toFixed(1) || '0'}%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs {usageMetrics?.previousPeriod.period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Usage Table */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Detailed Usage Statistics"
              subheader="Comprehensive breakdown of system usage"
            />
            <Divider />
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.period}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.period}
                      </TableCell>
                      <TableCell align="right">Change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Total Users
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.users.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.users.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(usageMetrics?.growth.users || 0)}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                usageMetrics?.growth.users || 0
                              ),
                              ml: 0.5,
                            }}
                          >
                            {usageMetrics?.growth.users.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Active Users
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.activeUsers.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.activeUsers.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(usageMetrics?.growth.activeUsers || 0)}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                usageMetrics?.growth.activeUsers || 0
                              ),
                              ml: 0.5,
                            }}
                          >
                            {usageMetrics?.growth.activeUsers.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Subscriptions
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.subscriptions.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.subscriptions.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(
                            usageMetrics?.growth.subscriptions || 0
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                usageMetrics?.growth.subscriptions || 0
                              ),
                              ml: 0.5,
                            }}
                          >
                            {usageMetrics?.growth.subscriptions.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Active Subscriptions
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.activeSubscriptions.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.activeSubscriptions.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(
                            (((usageMetrics?.currentPeriod
                              .activeSubscriptions || 0) -
                              (usageMetrics?.previousPeriod
                                .activeSubscriptions || 0)) /
                              (usageMetrics?.previousPeriod
                                .activeSubscriptions || 1)) *
                              100
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                (((usageMetrics?.currentPeriod
                                  .activeSubscriptions || 0) -
                                  (usageMetrics?.previousPeriod
                                    .activeSubscriptions || 0)) /
                                  (usageMetrics?.previousPeriod
                                    .activeSubscriptions || 1)) *
                                  100
                              ),
                              ml: 0.5,
                            }}
                          >
                            {(
                              (((usageMetrics?.currentPeriod
                                .activeSubscriptions || 0) -
                                (usageMetrics?.previousPeriod
                                  .activeSubscriptions || 0)) /
                                (usageMetrics?.previousPeriod
                                  .activeSubscriptions || 1)) *
                              100
                            ).toFixed(1)}
                            %
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Revenue
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(
                          usageMetrics?.currentPeriod.revenue || 0
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(
                          usageMetrics?.previousPeriod.revenue || 0
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(usageMetrics?.growth.revenue || 0)}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                usageMetrics?.growth.revenue || 0
                              ),
                              ml: 0.5,
                            }}
                          >
                            {usageMetrics?.growth.revenue.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        API Calls
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(
                          usageMetrics?.currentPeriod.apiCalls || 0
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(
                          usageMetrics?.previousPeriod.apiCalls || 0
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(usageMetrics?.growth.apiCalls || 0)}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                usageMetrics?.growth.apiCalls || 0
                              ),
                              ml: 0.5,
                            }}
                          >
                            {usageMetrics?.growth.apiCalls.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell component="th" scope="row">
                        Storage Used (GB)
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.currentPeriod.storageUsed.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {usageMetrics?.previousPeriod.storageUsed.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {getGrowthIcon(
                            (((usageMetrics?.currentPeriod.storageUsed || 0) -
                              (usageMetrics?.previousPeriod.storageUsed || 0)) /
                              (usageMetrics?.previousPeriod.storageUsed || 1)) *
                              100
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              color: getGrowthColor(
                                (((usageMetrics?.currentPeriod.storageUsed ||
                                  0) -
                                  (usageMetrics?.previousPeriod.storageUsed ||
                                    0)) /
                                  (usageMetrics?.previousPeriod.storageUsed ||
                                    1)) *
                                  100
                              ),
                              ml: 0.5,
                            }}
                          >
                            {(
                              (((usageMetrics?.currentPeriod.storageUsed || 0) -
                                (usageMetrics?.previousPeriod.storageUsed ||
                                  0)) /
                                (usageMetrics?.previousPeriod.storageUsed ||
                                  1)) *
                              100
                            ).toFixed(1)}
                            %
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UsageMonitoring;
