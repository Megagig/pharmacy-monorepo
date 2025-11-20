import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  mtrNotificationService,
  NotificationStatistics,
} from '../services/mtrNotificationService';
import MTRNotificationPreferences from './MTRNotificationPreferences';

const MTRNotificationDashboard: React.FC = () => {
  const [showPreferences, setShowPreferences] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  const queryClient = useQueryClient();

  // Fetch notification statistics
  const {
    data: statistics,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['notificationStatistics'],
    queryFn: mtrNotificationService.getNotificationStatistics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Check overdue follow-ups mutation
  const checkOverdueMutation = useMutation({
    mutationFn: mtrNotificationService.checkOverdueFollowUps,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationStatistics'] });
    },
  });

  // Process pending reminders mutation
  const processPendingMutation = useMutation({
    mutationFn: mtrNotificationService.processPendingReminders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationStatistics'] });
    },
  });

  const handleRefreshStats = () => {
    queryClient.invalidateQueries({ queryKey: ['notificationStatistics'] });
  };

  const getSuccessRate = (stats: NotificationStatistics) => {
    if (stats.totalScheduled === 0) return 0;
    return Math.round((stats.sent / stats.totalScheduled) * 100);
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box display="flex" alignItems="center">
          <NotificationsIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            MTR Notification Dashboard
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Statistics">
            <IconButton onClick={handleRefreshStats} disabled={statsLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowPreferences(true)}
          >
            Preferences
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {statsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load notification statistics. Please try refreshing the
          page.
        </Alert>
      )}

      {/* Success Alerts */}
      {checkOverdueMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Overdue follow-ups checked successfully!
        </Alert>
      )}

      {processPendingMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Pending reminders processed successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Overview Cards */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Sent</Typography>
              </Box>
              <Typography variant="h3" color="success.main">
                {statistics?.sent || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Successfully delivered
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PendingIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Pending</Typography>
              </Box>
              <Typography variant="h3" color="warning.main">
                {statistics?.pending || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Awaiting delivery
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ErrorIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6">Failed</Typography>
              </Box>
              <Typography variant="h3" color="error.main">
                {statistics?.failed || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delivery failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Success Rate</Typography>
              </Box>
              <Typography
                variant="h3"
                color={`${getStatusColor(
                  statistics ? getSuccessRate(statistics) : 0
                )}.main`}
              >
                {statistics ? getSuccessRate(statistics) : 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delivery success rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Types Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifications by Type
              </Typography>
              {statistics?.byType &&
              Object.keys(statistics.byType).length > 0 ? (
                <List dense>
                  {Object.entries(statistics.byType).map(([type, count]) => (
                    <ListItem key={type}>
                      <ListItemIcon>
                        {type.includes('critical') ? (
                          <WarningIcon color="error" />
                        ) : type.includes('reminder') ? (
                          <ScheduleIcon color="primary" />
                        ) : (
                          <NotificationsIcon color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={type.replace('_', ' ').toUpperCase()}
                        secondary={`${count} notifications`}
                      />
                      <Chip
                        label={count}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  py={3}
                >
                  No notifications sent yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Channels Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifications by Channel
              </Typography>
              {statistics?.byChannel &&
              Object.keys(statistics.byChannel).length > 0 ? (
                <List dense>
                  {Object.entries(statistics.byChannel).map(
                    ([channel, count]) => (
                      <ListItem key={channel}>
                        <ListItemIcon>
                          {channel === 'email' ? (
                            <EmailIcon color="primary" />
                          ) : channel === 'sms' ? (
                            <SmsIcon color="secondary" />
                          ) : (
                            <NotificationsIcon color="action" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={channel.toUpperCase()}
                          secondary={`${count} notifications`}
                        />
                        <Chip
                          label={count}
                          size="small"
                          color={channel === 'email' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </ListItem>
                    )
                  )}
                </List>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  py={3}
                >
                  No notifications sent yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* System Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Actions
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Manually trigger notification system tasks
              </Typography>

              <Box display="flex" gap={2} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<WarningIcon />}
                  onClick={() => checkOverdueMutation.mutate()}
                  disabled={checkOverdueMutation.isPending}
                >
                  {checkOverdueMutation.isPending
                    ? 'Checking...'
                    : 'Check Overdue Follow-ups'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  onClick={() => processPendingMutation.mutate()}
                  disabled={processPendingMutation.isPending}
                >
                  {processPendingMutation.isPending
                    ? 'Processing...'
                    : 'Process Pending Reminders'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  onClick={() => setShowStatistics(true)}
                >
                  View Detailed Statistics
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notification Preferences Dialog */}
      <Dialog
        open={showPreferences}
        onClose={() => setShowPreferences(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Notification Preferences</DialogTitle>
        <DialogContent>
          <MTRNotificationPreferences />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreferences(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Detailed Statistics Dialog */}
      <Dialog
        open={showStatistics}
        onClose={() => setShowStatistics(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Detailed Statistics</DialogTitle>
        <DialogContent>
          {statistics && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Overall Performance
              </Typography>

              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  Success Rate: {getSuccessRate(statistics)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={getSuccessRate(statistics)}
                  color={getStatusColor(getSuccessRate(statistics))}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Total Scheduled"
                    secondary={statistics.totalScheduled}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Successfully Sent"
                    secondary={statistics.sent}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Pending Delivery"
                    secondary={statistics.pending}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Failed Delivery"
                    secondary={statistics.failed}
                  />
                </ListItem>
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStatistics(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MTRNotificationDashboard;
