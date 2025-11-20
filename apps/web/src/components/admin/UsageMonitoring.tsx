import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Paper,
  alpha,
  useTheme,
  Fade,
  Grow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  Api as ApiIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getSystemAnalytics } from '../../services/rbacService';
import { useUIStore } from '../../stores';

const GRADIENT_COLORS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
];

interface AnalyticsData {
  userAnalytics: {
    total: number;
    active: number;
    new: number;
    growth: Array<{ _id: { year: number; month: number; day: number }; count: number }>;
  };
  roleAnalytics: {
    assignments: number;
  };
  activityAnalytics: {
    total: number;
    daily: Array<{ _id: { year: number; month: number; day: number }; count: number }>;
  };
}

const UsageMonitoring: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadUsageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getSystemAnalytics(period);
      if (response.success) {
        setAnalytics(response.data as AnalyticsData);
      } else {
        setError('Failed to load usage data');
      }
    } catch (err: any) {
      console.error('Error loading usage data:', err);
      setError(err.message || 'Failed to load usage monitoring data');
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load usage monitoring data',
      });
    } finally {
      setLoading(false);
    }
  }, [period, addNotification]);

  useEffect(() => {
    loadUsageData();
  }, [loadUsageData]);

  const formatGrowthData = () => {
    if (!analytics?.userAnalytics.growth) return [];
    return analytics.userAnalytics.growth.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      users: item.count,
    }));
  };

  const formatActivityData = () => {
    if (!analytics?.activityAnalytics.daily) return [];
    return analytics.activityAnalytics.daily.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      activities: item.count,
    }));
  };

  const calculateGrowth = (current: number, total: number) => {
    if (total === 0) return 0;
    return ((current / total) * 100).toFixed(1);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No usage data available
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with gradient background */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          width: '100%',
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.main} 100%)`,
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              📊 Usage Monitoring & Analytics
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Track system usage, growth trends, and resource consumption
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl
              sx={{
                minWidth: 150,
                bgcolor: '#ffffff',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                },
              }}
            >
              <InputLabel>Time Period</InputLabel>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                label="Time Period"
              >
                <MenuItem value="7d">📅 Last 7 Days</MenuItem>
                <MenuItem value="30d">📊 Last 30 Days</MenuItem>
                <MenuItem value="90d">📈 Last 90 Days</MenuItem>
                <MenuItem value="1y">🗓️ Last Year</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadUsageData}
              sx={{
                bgcolor: '#ffffff',
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.9),
                },
              }}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Summary Cards with Icons and Gradients */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%' }}>
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={500}>
            <Card
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[0][0], 0.1)} 0%, ${alpha(GRADIENT_COLORS[0][1], 0.1)} 100%)`,
                  borderRadius: '0 0 0 100%',
                }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
                      Total Users
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {analytics.userAnalytics.total.toLocaleString()}
                    </Typography>
                    <Chip
                      icon={<TrendingUpIcon />}
                      label={`${calculateGrowth(analytics.userAnalytics.new, analytics.userAnalytics.total)}% new`}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[0][0]} 0%, ${GRADIENT_COLORS[0][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <PeopleIcon fontSize="large" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={700}>
            <Card
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.success.main, 0.15)}`,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[3][0], 0.1)} 0%, ${alpha(GRADIENT_COLORS[3][1], 0.1)} 100%)`,
                  borderRadius: '0 0 0 100%',
                }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
                      Active Users
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {analytics.userAnalytics.active.toLocaleString()}
                    </Typography>
                    <Chip
                      label={`${calculateGrowth(analytics.userAnalytics.active, analytics.userAnalytics.total)}% of total`}
                      size="small"
                      color="success"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[3][0]} 0%, ${GRADIENT_COLORS[3][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <TrendingUpIcon fontSize="large" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={900}>
            <Card
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.info.main, 0.15)}`,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[2][0], 0.1)} 0%, ${alpha(GRADIENT_COLORS[2][1], 0.1)} 100%)`,
                  borderRadius: '0 0 0 100%',
                }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
                      New Users
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {analytics.userAnalytics.new.toLocaleString()}
                    </Typography>
                    <Chip
                      label={`In ${period}`}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[2][0]} 0%, ${GRADIENT_COLORS[2][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <ApiIcon fontSize="large" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1100}>
            <Card
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.warning.main, 0.15)}`,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[4][0], 0.1)} 0%, ${alpha(GRADIENT_COLORS[4][1], 0.1)} 100%)`,
                  borderRadius: '0 0 0 100%',
                }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
                      Total Activities
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {formatNumber(analytics.activityAnalytics.total)}
                    </Typography>
                    <Chip
                      label="System-wide"
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[4][0]} 0%, ${GRADIENT_COLORS[4][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <AssessmentIcon fontSize="large" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Charts Row 1 - User Growth Trend */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%' }}>
        <Grid item xs={12}>
          <Fade in timeout={1300}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[0][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[0][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  📈 User Growth Trend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daily user registrations over selected period
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={formatGrowthData()}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GRADIENT_COLORS[0][0]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={GRADIENT_COLORS[0][1]} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
                    <YAxis tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="users"
                      stroke={GRADIENT_COLORS[0][0]}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorUsers)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Charts Row 2 - Activity Trend */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        <Grid item xs={12}>
          <Fade in timeout={1500}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[3][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[3][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  🚀 System Activity Trend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daily system activities and user interactions
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={formatActivityData()}>
                    <defs>
                      <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GRADIENT_COLORS[3][0]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={GRADIENT_COLORS[3][1]} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
                    <YAxis tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="activities"
                      stroke={GRADIENT_COLORS[3][0]}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorActivities)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UsageMonitoring;
