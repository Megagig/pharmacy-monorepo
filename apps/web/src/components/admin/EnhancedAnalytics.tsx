import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  alpha,
  useTheme,
  Fade,
  Grow,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { getSystemAnalytics } from '../../services/rbacService';

interface AnalyticsData {
  period: string;
  userAnalytics: {
    total: number;
    active: number;
    new: number;
    byRole: Array<{ _id: string; count: number }>;
    byStatus: Array<{ _id: string; count: number }>;
    growth: Array<{
      _id: { year: number; month: number; day: number };
      count: number;
    }>;
  };
  roleAnalytics: {
    total: number;
    active: number;
    assignments: number;
    byCategory: Array<{ _id: string; count: number }>;
  };
  permissionAnalytics: {
    total: number;
    active: number;
    byCategory: Array<{ _id: string; count: number }>;
    byRiskLevel: Array<{ _id: string; count: number }>;
  };
  activityAnalytics: {
    total: number;
    byAction: Array<{ _id: string; count: number }>;
    byUser: Array<{ _id: string; count: number }>;
    daily: Array<{
      _id: { year: number; month: number; day: number };
      count: number;
    }>;
  };
}

// Enhanced color schemes with gradients
const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
];

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  pending: '#f59e0b',
  suspended: '#ef4444',
  inactive: '#6b7280',
};

const GRADIENT_COLORS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
];

const EnhancedAnalytics: React.FC = () => {
  const theme = useTheme();
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSystemAnalytics(period);
      if (response.success) {
        setAnalytics(response.data as AnalyticsData);
      } else {
        setError('Failed to load analytics data');
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Format growth data for line chart
  const formatGrowthData = () => {
    if (!analytics?.userAnalytics.growth) return [];
    return analytics.userAnalytics.growth.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      users: item.count,
    }));
  };

  // Format activity data for line chart
  const formatActivityData = () => {
    if (!analytics?.activityAnalytics.daily) return [];
    return analytics.activityAnalytics.daily.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
      activities: item.count,
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !analytics) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error || 'No analytics data available'}
      </Alert>
    );
  }

  // Calculate growth percentage
  const calculateGrowth = (current: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  };

  return (
    <Box sx={{
      width: '100%',
      maxWidth: '1600px',
      minWidth: 0,
      mx: 'auto',
      px: { xs: 1, sm: 2, md: 3 },
    }}>
      {/* Header with gradient background */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          width: '100%',
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white',
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              System Analytics Dashboard
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Comprehensive insights into system performance and user activity
            </Typography>
          </Box>
          <FormControl
            sx={{
              minWidth: 200,
              bgcolor: 'white',
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
              onChange={(e) => setPeriod(e.target.value)}
              label="Time Period"
            >
              <MenuItem value="7d">📅 Last 7 Days</MenuItem>
              <MenuItem value="30d">📊 Last 30 Days</MenuItem>
              <MenuItem value="90d">📈 Last 90 Days</MenuItem>
              <MenuItem value="1y">🗓️ Last Year</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Modern Summary Cards with Icons and Gradients */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', px: 0 }}>
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
                      label={`${analytics.userAnalytics.active} Active`}
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
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.15)}`,
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
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[1][0], 0.1)} 0%, ${alpha(GRADIENT_COLORS[1][1], 0.1)} 100%)`,
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
                      label={`${calculateGrowth(analytics.userAnalytics.new, analytics.userAnalytics.total)}% of total`}
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
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[1][0]} 0%, ${GRADIENT_COLORS[1][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <PersonAddIcon fontSize="large" />
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
                      Total Roles
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {analytics.roleAnalytics.total.toLocaleString()}
                    </Typography>
                    <Chip
                      icon={<TrendingUpIcon />}
                      label={`${analytics.roleAnalytics.active} Active`}
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
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[2][0]} 0%, ${GRADIENT_COLORS[2][1]} 100%)`,
                      color: 'white',
                    }}
                  >
                    <SecurityIcon fontSize="large" />
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
                      Total Activities
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {analytics.activityAnalytics.total.toLocaleString()}
                    </Typography>
                    <Chip
                      label="In selected period"
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
                      background: `linear-gradient(135deg, ${GRADIENT_COLORS[3][0]} 0%, ${GRADIENT_COLORS[3][1]} 100%)`,
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

      {/* Charts Row 1 - Trend Charts (Full Width) */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', px: 0 }}>
        {/* User Growth Chart */}
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
                  Daily user registration over selected period
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={formatGrowthData()}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GRADIENT_COLORS[0][0]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={GRADIENT_COLORS[0][1]} stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
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

        {/* Activity Trend Chart */}
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
                  🚀 Activity Trend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  System activities and user interactions
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={formatActivityData()}>
                    <defs>
                      <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GRADIENT_COLORS[3][0]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={GRADIENT_COLORS[3][1]} stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
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

      {/* Charts Row 2 - Distribution Charts (Full Width) */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', px: 0 }}>
        {/* Users by Role - Pie Chart */}
        <Grid item xs={12}>
          <Fade in timeout={1700}>
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
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[1][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[1][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  👥 Users by Role
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Role distribution across all users
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={analytics.userAnalytics.byRole}
                      dataKey="count"
                      nameKey="_id"
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      label={(entry) => `${entry._id}: ${entry.count}`}
                      labelLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                    >
                      {analytics.userAnalytics.byRole.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Users by Status - Pie Chart */}
        <Grid item xs={12}>
          <Fade in timeout={1900}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[2][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[2][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  ✅ Users by Status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current status of all user accounts
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={analytics.userAnalytics.byStatus}
                      dataKey="count"
                      nameKey="_id"
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      label={(entry) => `${entry._id}: ${entry.count}`}
                      labelLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                    >
                      {analytics.userAnalytics.byStatus.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STATUS_COLORS[entry._id] || COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Charts Row 3 - Activity & Risk Analysis (Full Width) */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', px: 0 }}>
        {/* Top Activities - Bar Chart */}
        <Grid item xs={12}>
          <Fade in timeout={2100}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[4][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[4][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  🎯 Top Activities
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Most frequent system activities
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.activityAnalytics.byAction.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis
                      dataKey="_id"
                      tick={{ fontSize: 11 }}
                      stroke={theme.palette.text.secondary}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                      cursor={{ fill: alpha(GRADIENT_COLORS[4][0], 0.1) }}
                    />
                    <Bar
                      dataKey="count"
                      fill={GRADIENT_COLORS[4][0]}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Permissions by Risk Level - Bar Chart */}
        <Grid item xs={12}>
          <Fade in timeout={2300}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[5][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[5][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  ⚠️ Permissions by Risk Level
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Security risk distribution analysis
                </Typography>
              </Box>
              <CardContent sx={{ pt: 3 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.permissionAnalytics.byRiskLevel}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis
                      dataKey="_id"
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 8,
                        boxShadow: theme.shadows[4],
                      }}
                      cursor={{ fill: alpha('#ef4444', 0.1) }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#ef4444"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Additional Stats Cards - Modern Design */}
      <Grid container spacing={2} sx={{ width: '100%', px: 0, pb: 3 }}>
        <Grid item xs={12} md={4}>
          <Fade in timeout={2500}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                      mr: 2,
                    }}
                  >
                    <Typography variant="h5">🏆</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Role Assignments
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {analytics.roleAnalytics.assignments.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  New assignments in selected period
                </Typography>
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        <Grid item xs={12} md={4}>
          <Fade in timeout={2700}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.02)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.1)}`,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                      mr: 2,
                    }}
                  >
                    <Typography variant="h5">🔒</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Total Permissions
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {analytics.permissionAnalytics.total.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={`${analytics.permissionAnalytics.active} Active`}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 600 }}
                />
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        <Grid item xs={12} md={4}>
          <Fade in timeout={2900}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.02)} 0%, ${alpha(theme.palette.error.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.warning.main, 0.1)}`,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.1)} 100%)`,
                      mr: 2,
                    }}
                  >
                    <Typography variant="h5">📂</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Permission Categories
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {analytics.permissionAnalytics.byCategory.length}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Distinct permission groups
                </Typography>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EnhancedAnalytics;
