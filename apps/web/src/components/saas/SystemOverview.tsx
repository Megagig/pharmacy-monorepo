import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Badge,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Storage as StorageIcon,
  Timeline as MonitoringIcon,
  Notifications as NotificationsIcon,
  AdminPanelSettings as AdminIcon,
  Shield as ShieldIcon,
  Tune as TuneIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as StableIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useSystemMetrics } from '../../queries/useSaasSettings';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  subtitle: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  gradient,
  subtitle,
  trend,
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      case 'stable':
        return <StableIcon sx={{ fontSize: 16, color: 'grey.500' }} />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'inherit';
    
    switch (trend.direction) {
      case 'up':
        return 'success.main';
      case 'down':
        return 'error.main';
      case 'stable':
        return 'grey.500';
      default:
        return 'inherit';
    }
  };

  return (
    <Card
      sx={{
        background: gradient,
        color: 'white',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h3" component="div" sx={{ mb: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            {subtitle}
          </Typography>
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getTrendIcon()}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: getTrendColor(),
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                }}
              >
                {trend.percentage > 0 ? '+' : ''}{trend.percentage}%
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const SystemOverview: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useSystemMetrics();

  if (metricsError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Error Loading System Overview
        </Typography>
        <Typography variant="body2">
          There was an error loading the system overview data. Please try refreshing the page.
        </Typography>
      </Alert>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* System Metrics Cards */}
      <Grid item xs={12} sm={6} md={3}>
        {metricsLoading ? (
          <Skeleton variant="rectangular" height={140} />
        ) : (
          <MetricCard
            title="Total Users"
            value={metrics?.totalUsers || 0}
            icon={<PeopleIcon />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            subtitle="Registered users"
            trend={{ direction: 'up', percentage: 12 }}
          />
        )}
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        {metricsLoading ? (
          <Skeleton variant="rectangular" height={140} />
        ) : (
          <MetricCard
            title="Active Subscriptions"
            value={metrics?.activeSubscriptions || 0}
            icon={<AssessmentIcon />}
            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            subtitle="Paid subscribers"
            trend={{ direction: 'up', percentage: 8 }}
          />
        )}
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        {metricsLoading ? (
          <Skeleton variant="rectangular" height={140} />
        ) : (
          <MetricCard
            title="Monthly Revenue"
            value={`₦${((metrics?.monthlyRevenue || 0) / 1000000).toFixed(1)}M`}
            icon={<StorageIcon />}
            gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            subtitle="This month"
            trend={{ direction: 'up', percentage: 15 }}
          />
        )}
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        {metricsLoading ? (
          <Skeleton variant="rectangular" height={140} />
        ) : (
          <MetricCard
            title="System Uptime"
            value={metrics?.systemUptime || '0%'}
            icon={<MonitoringIcon />}
            gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
            subtitle="Last 30 days"
            trend={{ direction: 'stable', percentage: 0 }}
          />
        )}
      </Grid>

      {/* Quick Actions */}
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title="Quick Actions"
            avatar={<TuneIcon />}
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PeopleIcon />}
                  component={RouterLink}
                  to="/saas-settings?tab=users"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">User Management</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {metrics?.totalUsers || 0} total users
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={
                    <Badge
                      badgeContent={metrics?.supportTickets?.open || 0}
                      color="error"
                    >
                      <NotificationsIcon />
                    </Badge>
                  }
                  component={RouterLink}
                  to="/saas-settings?tab=support"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">Support Tickets</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {metrics?.supportTickets?.open || 0} open tickets
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AdminIcon />}
                  component={RouterLink}
                  to="/admin/feature-management"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">Feature Management</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Manage system features
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ShieldIcon />}
                  component={RouterLink}
                  to="/saas-settings?tab=security"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">Audit Logs</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Security & compliance logs
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  component={RouterLink}
                  to="/saas-settings?tab=analytics"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">System Analytics</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Reports & insights
                    </Typography>
                  </Box>
                </Button>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<StorageIcon />}
                  component={RouterLink}
                  to="/saas-settings?tab=billing"
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  <Box sx={{ textAlign: 'left', ml: 1 }}>
                    <Typography variant="subtitle2">Subscription Management</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {metrics?.activeSubscriptions || 0} active subscriptions
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default SystemOverview;