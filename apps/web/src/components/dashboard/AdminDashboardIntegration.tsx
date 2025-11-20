import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Alert,
  Skeleton,
  Chip,
  useTheme,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  BusinessOutlined as BusinessIcon,
  People as PeopleIcon,
  CreditCard as CreditCardIcon,
  SecurityOutlined as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircleOutlined as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import DashboardChart from './DashboardChart';

interface AdminDashboardData {
  summary: {
    workspaces: {
      total: number;
      active: number;
      trial: number;
      expired: number;
      growth: number;
    };
    subscriptions: {
      total: number;
      active: number;
      byTier: Array<{ _id: string; count: number; revenue: number }>;
    };
    users: {
      total: number;
      active: number;
      growth: number;
    };
    patients: {
      total: number;
    };
    invitations: {
      total: number;
      pending: number;
      stats: Array<{ _id: string; count: number }>;
    };
    emails: {
      stats: Array<{ _id: string; count: number }>;
    };
  };
  recentActivity: {
    newWorkspaces: number;
    newUsers: number;
  };
  alerts: {
    trialExpiring: Array<{
      _id: string;
      name: string;
      trialEndDate: string;
      ownerId: { firstName: string; lastName: string; email: string };
    }>;
    failedPayments: Array<{
      _id: string;
      workspaceId: { name: string };
      status: string;
      updatedAt: string;
    }>;
  };
  timestamp: string;
}

interface SystemHealthData {
  timestamp: string;
  database: {
    connected: boolean;
    stats: any;
  };
  application: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      used: number;
    };
    nodeVersion: string;
    environment: string;
  };
  services: {
    emailDelivery: Array<{ _id: string; count: number }>;
    invitations: Array<{ _id: string; count: number }>;
    subscriptions: Array<{ _id: string; count: number }>;
  };
  recentErrors: unknown[];
}

const AdminDashboardIntegration: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(
    null
  );
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, healthResponse] = await Promise.all([
        adminService.getDashboardOverview(),
        adminService.getSystemHealth(),
      ]);

      setDashboardData(dashboardResponse.data);
      setSystemHealth(healthResponse.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load admin data'
      );
    } finally {
      setLoading(false);
    }
  };

  // Don't render for non-admin users
  if (user?.role !== 'super_admin') {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Admin Overview
        </Typography>
        <Grid container spacing={3}>
          {[...Array(4)].map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Skeleton
                variant="rectangular"
                height={120}
                sx={{ borderRadius: 2 }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 4 }}>
        Error loading admin data: {error}
      </Alert>
    );
  }

  if (!dashboardData || !systemHealth) {
    return null;
  }

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Format memory usage
  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  // Prepare chart data
  const subscriptionTierData = dashboardData.summary.subscriptions.byTier.map(
    (tier) => ({
      name: tier._id || 'Unknown',
      value: tier.count,
      revenue: tier.revenue,
    })
  );

  const invitationStatusData = dashboardData.summary.invitations.stats.map(
    (stat) => ({
      name: stat._id,
      value: stat.count,
    })
  );

  const emailDeliveryData = systemHealth.services.emailDelivery.map((stat) => ({
    name: stat._id,
    value: stat.count,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Admin Overview
        </Typography>

        {/* Admin KPIs */}
        <Box
          className="admin-kpis-grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(4, 1fr)',
            },
            gap: 3,
            mb: 4,
            width: '100%',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Typography variant="h6">Workspaces</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {dashboardData.summary.workspaces.total}
                </Typography>
                <Box display="flex" gap={1} mb={1}>
                  <Chip
                    label={`${dashboardData.summary.workspaces.active} Active`}
                    color="success"
                    size="small"
                  />
                  <Chip
                    label={`${dashboardData.summary.workspaces.trial} Trial`}
                    color="info"
                    size="small"
                  />
                  <Chip
                    label={`${dashboardData.summary.workspaces.expired} Expired`}
                    color="error"
                    size="small"
                  />
                </Box>
                {dashboardData.summary.workspaces.growth !== 0 && (
                  <Box display="flex" alignItems="center">
                    <TrendingUpIcon
                      sx={{
                        fontSize: 16,
                        color:
                          dashboardData.summary.workspaces.growth > 0
                            ? 'success.main'
                            : 'error.main',
                        mr: 0.5,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {dashboardData.summary.workspaces.growth > 0 ? '+' : ''}
                      {dashboardData.summary.workspaces.growth.toFixed(1)}%
                      growth
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <PeopleIcon />
                  </Avatar>
                  <Typography variant="h6">Users</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {dashboardData.summary.users.total}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {dashboardData.summary.users.active} active users
                </Typography>
                {dashboardData.summary.users.growth !== 0 && (
                  <Box display="flex" alignItems="center">
                    <TrendingUpIcon
                      sx={{
                        fontSize: 16,
                        color:
                          dashboardData.summary.users.growth > 0
                            ? 'success.main'
                            : 'error.main',
                        mr: 0.5,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {dashboardData.summary.users.growth > 0 ? '+' : ''}
                      {dashboardData.summary.users.growth.toFixed(1)}% growth
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <CreditCardIcon />
                  </Avatar>
                  <Typography variant="h6">Subscriptions</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {dashboardData.summary.subscriptions.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dashboardData.summary.subscriptions.active} active
                  subscriptions
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar
                    sx={{
                      bgcolor: systemHealth.database.connected
                        ? 'success.main'
                        : 'error.main',
                      mr: 2,
                    }}
                  >
                    <SecurityIcon />
                  </Avatar>
                  <Typography variant="h6">System Health</Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} />
                  <Typography variant="body2">Database Connected</Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Uptime: {formatUptime(systemHealth.application.uptime)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Memory: {formatMemory(systemHealth.application.memory.used)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Charts */}
        <Grid container spacing={3} sx={{ mb: 4, width: '100%', maxWidth: '1600px', mx: 'auto' }}>
          <Grid item xs={12} md={4}>
            <DashboardChart
              title="Subscriptions by Tier"
              data={subscriptionTierData}
              type="pie"
              height={300}
              colors={[
                theme.palette.primary.main,
                theme.palette.secondary.main,
                theme.palette.warning.main,
              ]}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <DashboardChart
              title="Invitation Status"
              data={invitationStatusData}
              type="pie"
              height={300}
              colors={[
                theme.palette.success.main,
                theme.palette.info.main,
                theme.palette.error.main,
              ]}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <DashboardChart
              title="Email Delivery (7 days)"
              data={emailDeliveryData}
              type="bar"
              height={300}
              colors={[theme.palette.info.main]}
            />
          </Grid>
        </Grid>

        {/* Alerts */}
        {(dashboardData.alerts.trialExpiring.length > 0 ||
          dashboardData.alerts.failedPayments.length > 0) && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
              width: '100%',
            }}
          >
            {dashboardData.alerts.trialExpiring.length > 0 && (
              <Box sx={{ width: '100%' }}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <WarningIcon sx={{ color: 'warning.main', mr: 1 }} />
                      <Typography variant="h6">Trials Expiring Soon</Typography>
                    </Box>
                    <List dense>
                      {dashboardData.alerts.trialExpiring
                        .slice(0, 5)
                        .map((workspace) => (
                          <ListItem key={workspace._id}>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: 'warning.main' }}>
                                <ScheduleIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={workspace.name}
                              secondary={`Expires: ${new Date(
                                workspace.trialEndDate
                              ).toLocaleDateString()}`}
                            />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Box>
            )}

            {dashboardData.alerts.failedPayments.length > 0 && (
              <Box sx={{ width: '100%' }}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <WarningIcon sx={{ color: 'error.main', mr: 1 }} />
                      <Typography variant="h6">Failed Payments</Typography>
                    </Box>
                    <List dense>
                      {dashboardData.alerts.failedPayments
                        .slice(0, 5)
                        .map((payment) => (
                          <ListItem key={payment._id}>
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: 'error.main' }}>
                                <CreditCardIcon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={payment.workspaceId.name}
                              secondary={`Status: ${
                                payment.status
                              } - ${new Date(
                                payment.updatedAt
                              ).toLocaleDateString()}`}
                            />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default AdminDashboardIntegration;
