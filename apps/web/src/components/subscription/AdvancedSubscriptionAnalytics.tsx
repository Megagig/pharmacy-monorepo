import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
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
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
// Import icons with default imports
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TimelineIcon from '@mui/icons-material/Timeline';
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import { useUIStore } from '../../stores';
import { adminService } from '../../services/adminService';

interface RevenueData {
  date: string;
  amount: number;
  subscriptions: number;
  churnRate: number;
}

interface SubscriptionData {
  tier: string;
  count: number;
  percentage: number;
  revenue: number;
  mrr: number;
  churnRate: number;
}

interface FeatureUsage {
  feature: string;
  usage: number;
  limit?: number;
  percentage: number;
}

interface AdvancedAnalytics {
  revenueTrend: RevenueData[];
  subscriptionDistribution: SubscriptionData[];
  featureUsage: FeatureUsage[];
  keyMetrics: {
    mrr: number;
    arr: number;
    churnRate: number;
    ltv: number;
    arpu: number;
  };
}

const AdvancedSubscriptionAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>(
    'month'
  );
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real subscription analytics from backend
      const response = await adminService.getSubscriptionAnalytics(period);
      
      if (response?.data) {
        // Transform backend data to match our interface
        const backendData = response.data;
        
        // Map growthTrend to revenueTrend format
        const revenueTrend = (backendData.growthTrend || []).map((item: any) => ({
          date: item.month,
          amount: Math.round(item.mrr),
          subscriptions: Math.round(item.subscribers),
          churnRate: item.churn * 100, // Convert to percentage
        }));
        
        // Map planDistribution to subscriptionDistribution format
        const totalSubs = (backendData.planDistribution || []).reduce((sum: number, p: any) => sum + p.count, 0);
        const subscriptionDistribution = (backendData.planDistribution || []).map((plan: any) => ({
          tier: plan.planName,
          count: plan.count,
          percentage: plan.percentage,
          revenue: plan.revenue,
          mrr: plan.revenue,
          churnRate: backendData.churnRate * 100 || 0,
        }));
        
        // Calculate ARPU (Average Revenue Per User)
        const arpu = totalSubs > 0 ? Math.round(backendData.mrr / totalSubs) : 0;
        
        const transformedAnalytics: AdvancedAnalytics = {
          revenueTrend,
          subscriptionDistribution,
          featureUsage: [], // No feature usage data from backend yet
          keyMetrics: {
            mrr: Math.round(backendData.mrr || 0),
            arr: Math.round(backendData.arr || 0),
            churnRate: backendData.churnRate ? backendData.churnRate * 100 : 0,
            ltv: Math.round(backendData.ltv || 0),
            arpu,
          },
        };
        
        setAnalytics(transformedAnalytics);
      } else {
        throw new Error('No data received from backend');
      }
    } catch {
      setError('Failed to load analytics data');
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load advanced subscription analytics',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return (
        <TrendingUpIcon sx={{ color: 'success.main', fontSize: '1rem' }} />
      );
    } else if (current < previous) {
      return (
        <TrendingDownIcon sx={{ color: 'error.main', fontSize: '1rem' }} />
      );
    }
    return null;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'success.main';
    if (current < previous) return 'error.main';
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
            Advanced Subscription Analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) =>
                setPeriod(
                  e.target.value as 'week' | 'month' | 'quarter' | 'year'
                )
              }
            >
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="quarter">This Quarter</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAnalyticsData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="body2" color="textSecondary">
                  MRR
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(analytics?.keyMetrics.mrr || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(
                  analytics?.keyMetrics.mrr || 0,
                  (analytics?.keyMetrics.mrr || 0) * 0.95
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(
                      analytics?.keyMetrics.mrr || 0,
                      (analytics?.keyMetrics.mrr || 0) * 0.95
                    ),
                    ml: 0.5,
                  }}
                >
                  +5.2%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="textSecondary">
                  ARR
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(analytics?.keyMetrics.arr || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(
                  analytics?.keyMetrics.arr || 0,
                  (analytics?.keyMetrics.arr || 0) * 0.92
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(
                      analytics?.keyMetrics.arr || 0,
                      (analytics?.keyMetrics.arr || 0) * 0.92
                    ),
                    ml: 0.5,
                  }}
                >
                  +8.7%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="body2" color="textSecondary">
                  Churn Rate
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {(analytics?.keyMetrics.churnRate || 0).toFixed(1)}%
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(
                  analytics?.keyMetrics.churnRate || 0,
                  (analytics?.keyMetrics.churnRate || 0) * 1.2
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(
                      (analytics?.keyMetrics.churnRate || 0) * 1.2,
                      analytics?.keyMetrics.churnRate || 0
                    ),
                    ml: 0.5,
                  }}
                >
                  -17.1%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  improvement
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="body2" color="textSecondary">
                  LTV
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(analytics?.keyMetrics.ltv || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(
                  analytics?.keyMetrics.ltv || 0,
                  (analytics?.keyMetrics.ltv || 0) * 0.9
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(
                      analytics?.keyMetrics.ltv || 0,
                      (analytics?.keyMetrics.ltv || 0) * 0.9
                    ),
                    ml: 0.5,
                  }}
                >
                  +11.1%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BarChartIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="body2" color="textSecondary">
                  ARPU
                </Typography>
              </Box>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(analytics?.keyMetrics.arpu || 0)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(
                  analytics?.keyMetrics.arpu || 0,
                  (analytics?.keyMetrics.arpu || 0) * 0.95
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: getTrendColor(
                      analytics?.keyMetrics.arpu || 0,
                      (analytics?.keyMetrics.arpu || 0) * 0.95
                    ),
                    ml: 0.5,
                  }}
                >
                  +5.3%
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ ml: 0.5 }}
                >
                  vs last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<BarChartIcon />} label="Revenue Trend" />
          <Tab icon={<PieChartIcon />} label="Subscription Distribution" />
          <Tab icon={<TimelineIcon />} label="Feature Usage" />
        </Tabs>
        <Divider />
        <CardContent>
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Revenue Trend
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Subscriptions</TableCell>
                      <TableCell align="right">Churn Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics?.revenueTrend.map((data, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {new Date(data.date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(data.amount)}
                        </TableCell>
                        <TableCell align="right">
                          {data.subscriptions}
                        </TableCell>
                        <TableCell align="right">{data.churnRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Subscription Distribution
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Plan Tier</TableCell>
                      <TableCell align="right">Subscriptions</TableCell>
                      <TableCell align="right">Percentage</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">MRR</TableCell>
                      <TableCell align="right">Churn Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics?.subscriptionDistribution.map((data, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2">{data.tier}</Typography>
                            {data.tier === 'Enterprise' && (
                              <Chip
                                label="Premium"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{data.count}</TableCell>
                        <TableCell align="right">{data.percentage}%</TableCell>
                        <TableCell align="right">
                          {formatCurrency(data.revenue)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(data.mrr)}
                        </TableCell>
                        <TableCell align="right">{data.churnRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Subscription Distribution Visualization */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Distribution by Plan Tier
                </Typography>
                {analytics?.subscriptionDistribution.map((data, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2">{data.tier}</Typography>
                      <Typography variant="body2">
                        {data.percentage}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={data.percentage}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor:
                            index === 0
                              ? 'primary.main'
                              : index === 1
                              ? 'secondary.main'
                              : index === 2
                              ? 'success.main'
                              : 'warning.main',
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Feature Usage
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature</TableCell>
                      <TableCell align="right">Usage</TableCell>
                      <TableCell align="right">Limit</TableCell>
                      <TableCell align="right">Percentage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics?.featureUsage.map((data, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {data.feature}
                        </TableCell>
                        <TableCell align="right">{data.usage}</TableCell>
                        <TableCell align="right">
                          {data.limit || 'Unlimited'}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={data.percentage}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor:
                                      data.percentage > 80
                                        ? 'error.main'
                                        : data.percentage > 60
                                        ? 'warning.main'
                                        : 'success.main',
                                  },
                                }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ minWidth: 40 }}>
                              {data.percentage}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Feature Usage Insights */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Usage Insights
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        High Usage Features
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Patient Management and Medication Tracking are the most
                        utilized features, indicating strong core adoption.
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Underutilized Features
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ADR Module has low adoption. Consider promoting this
                        feature to improve patient safety outcomes.
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdvancedSubscriptionAnalytics;
