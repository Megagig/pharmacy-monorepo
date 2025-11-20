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
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  VpnKey as VpnKeyIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
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
} from 'recharts';
import { saasSecurityService, SecurityAuditLog } from '../../services/saasSecurityService';
import { useUIStore } from '../../stores';

const GRADIENT_COLORS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
];

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

const CATEGORY_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#f97316',
];

const SecurityDashboard: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<SecurityAuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard metrics and analytics in parallel
      const [dashboardResponse, analyticsData, logsResponse] = await Promise.all([
        saasSecurityService.getSecurityDashboard(timeRange),
        saasSecurityService.getSecurityAnalytics(timeRange === '1h' ? '7d' : timeRange === '24h' ? '30d' : '30d'),
        saasSecurityService.getSecurityAuditLogs({ limit: 10, sortBy: 'timestamp', sortOrder: 'desc' }),
      ]);

      if (dashboardResponse.success) {
        setDashboardData(dashboardResponse.data);
      }

      setAnalytics(analyticsData);
      
      if (logsResponse.success) {
        setRecentLogs(logsResponse.data.logs);
      }
    } catch (err: any) {
      console.error('Error loading security data:', err);
      setError(err.message || 'Failed to load security data');
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load security dashboard data',
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange, addNotification]);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  const getSeverityColor = (severity: string) => {
    return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.low;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication':
        return <VpnKeyIcon />;
      case 'authorization':
        return <LockIcon />;
      case 'configuration':
        return <SettingsIcon />;
      default:
        return <SecurityIcon />;
    }
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

  if (!dashboardData) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No security data available
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
          background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.warning.main} 100%)`,
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              🔒 Security Dashboard
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Real-time security monitoring and threat detection
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl
              sx={{
                minWidth: 150,
                bgcolor: 'white',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                },
              }}
            >
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                label="Time Range"
              >
                <MenuItem value="1h">⏱️ Last Hour</MenuItem>
                <MenuItem value="24h">📅 Last 24 Hours</MenuItem>
                <MenuItem value="7d">📊 Last 7 Days</MenuItem>
                <MenuItem value="30d">📈 Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadSecurityData}
              sx={{
                bgcolor: '#ffffff',
                color: theme.palette.error.main,
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
                border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.error.main, 0.15)}`,
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
                      Failed Logins
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {dashboardData.security.failedLogins}
                    </Typography>
                    <Chip
                      icon={<WarningIcon />}
                      label={`${timeRange} period`}
                      size="small"
                      color="error"
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
                    <ErrorIcon fontSize="large" />
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
                      Successful Logins
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {dashboardData.security.successfulLogins}
                    </Typography>
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="Secure"
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
                    <CheckCircleIcon fontSize="large" />
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
                      Active Sessions
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {dashboardData.sessions.active}
                    </Typography>
                    <Chip
                      label={`${dashboardData.sessions.uniqueUsers} users`}
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
                    <ShieldIcon fontSize="large" />
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
                      Suspicious Activities
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                      {dashboardData.security.suspiciousActivities}
                    </Typography>
                    <Chip
                      icon={<WarningIcon />}
                      label="Flagged"
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
                    <WarningIcon fontSize="large" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Charts Row 1 - Security Events Trend */}
      {analytics && (
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
                    📊 Security Events Trend
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Daily security events over selected period
                  </Typography>
                </Box>
                <CardContent sx={{ pt: 3 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={analytics.byDay}>
                      <defs>
                        <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GRADIENT_COLORS[0][0]} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={GRADIENT_COLORS[0][1]} stopOpacity={0.1}/>
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
                        dataKey="events"
                        stroke={GRADIENT_COLORS[0][0]}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorEvents)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      )}

      {/* Charts Row 2 - Category Distribution and Severity */}
      {analytics && (
        <Grid container spacing={3} sx={{ mb: 4, width: '100%' }}>
          <Grid item xs={12} lg={6}>
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
                    background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[1][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[1][1], 0.05)} 100%)`,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    📂 Events by Category
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Distribution across security categories
                  </Typography>
                </Box>
                <CardContent sx={{ pt: 3 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.byCategory}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry._id}: ${entry.count}`}
                        labelLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                      >
                        {analytics.byCategory.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
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
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          <Grid item xs={12} lg={6}>
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
                    background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[2][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[2][1], 0.05)} 100%)`,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    ⚠️ Events by Severity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Risk level distribution
                  </Typography>
                </Box>
                <CardContent sx={{ pt: 3 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.bySeverity}>
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
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {analytics.bySeverity.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getSeverityColor(entry._id)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      )}

      {/* Recent Security Events */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        <Grid item xs={12}>
          <Fade in timeout={1900}>
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
                  background: `linear-gradient(135deg, ${alpha(GRADIENT_COLORS[5][0], 0.05)} 0%, ${alpha(GRADIENT_COLORS[5][1], 0.05)} 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  📋 Recent Security Events
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Latest audit log entries
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                <List>
                  {recentLogs.map((log, index) => (
                    <React.Fragment key={log._id}>
                      <ListItem sx={{ py: 2, px: 3 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {log.action}
                              </Typography>
                              <Chip
                                label={log.severity}
                                size="small"
                                sx={{
                                  bgcolor: alpha(getSeverityColor(log.severity), 0.1),
                                  color: getSeverityColor(log.severity),
                                  fontWeight: 600,
                                }}
                              />
                              {log.success ? (
                                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Resource: {log.resource} • IP: {log.ipAddress}
                                {log.location && ` • ${log.location.city}, ${log.location.country}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(log.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentLogs.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SecurityDashboard;
