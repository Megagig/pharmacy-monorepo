import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsOff as NotificationsOffIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useManualLabNotifications } from '../hooks/useManualLabNotifications';
import CriticalAlertBanner from './CriticalAlertBanner';

interface NotificationDashboardProps {
  onViewOrder?: (orderId: string) => void;
  onScheduleReferral?: (alert: any) => void;
  onCreateCarePlan?: (alert: any) => void;
}

const NotificationDashboard: React.FC<NotificationDashboardProps> = ({
  onViewOrder,
  onScheduleReferral,
  onCreateCarePlan,
}) => {
  const {
    alerts,
    preferences,
    stats,
    alertsLoading,
    preferencesLoading,
    statsLoading,
    acknowledgeAlert,
    dismissAlert,
    updatePreferences,
    sendTestNotification,
    refreshAlerts,
    criticalAlertsCount,
    unacknowledgedAlertsCount,
    hasCriticalAlerts,
    notificationsEnabled,
    pollingEnabled,
    enablePolling,
    disablePolling,
  } = useManualLabNotifications();

  const [settingsDialog, setSettingsDialog] = useState(false);
  const [testingNotification, setTestingNotification] = useState<
    'email' | 'sms' | null
  >(null);

  const handleTestNotification = async (type: 'email' | 'sms') => {
    setTestingNotification(type);
    try {
      await sendTestNotification(type);
    } finally {
      setTestingNotification(null);
    }
  };

  const handlePreferenceChange = async (key: string, value: boolean) => {
    await updatePreferences({ [key]: value });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircleIcon color="success" />;
      case 'pending':
        return <ScheduleIcon color="warning" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <ScheduleIcon color="info" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <EmailIcon />;
      case 'sms':
        return <SmsIcon />;
      default:
        return <NotificationsIcon />;
    }
  };

  if (alertsLoading || preferencesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading notifications...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Badge badgeContent={criticalAlertsCount} color="error">
            <NotificationsActiveIcon
              color={hasCriticalAlerts ? 'error' : 'primary'}
            />
          </Badge>
          <Typography variant="h4" component="h1">
            Notification Center
          </Typography>
          {!notificationsEnabled && (
            <Chip
              icon={<NotificationsOffIcon />}
              label="Notifications Disabled"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>

        <Box display="flex" gap={1}>
          <Tooltip
            title={
              pollingEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'
            }
          >
            <IconButton
              onClick={pollingEnabled ? disablePolling : enablePolling}
              color={pollingEnabled ? 'primary' : 'default'}
            >
              <NotificationsActiveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh notifications">
            <IconButton onClick={refreshAlerts}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsDialog(true)}
          >
            Settings
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <ErrorIcon color="error" />
                <Box>
                  <Typography variant="h4" color="error">
                    {criticalAlertsCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Critical Alerts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {unacknowledgedAlertsCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unacknowledged
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="h4" color="success.main">
                    {stats?.sent || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Delivered Today
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <TrendingUpIcon color="info" />
                <Box>
                  <Typography variant="h4" color="info.main">
                    {stats?.pending || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Critical Alerts Banner */}
      {alerts.length > 0 && (
        <CriticalAlertBanner
          alerts={alerts}
          onAlertAcknowledge={acknowledgeAlert}
          onAlertDismiss={dismissAlert}
          onViewOrder={onViewOrder || (() => {})}
          onScheduleReferral={onScheduleReferral}
          onCreateCarePlan={onCreateCarePlan}
          onUpdatePreferences={updatePreferences}
          currentPreferences={preferences}
        />
      )}

      {/* Notification Statistics */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Notifications by Type
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(stats.byType).map(([type, count]) => (
                        <TableRow key={type}>
                          <TableCell>
                            {type
                              .replace('_', ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Delivery Channels
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Channel</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(stats.byChannel).map(
                        ([channel, count]) => (
                          <TableRow key={channel}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                {getChannelIcon(channel)}
                                {channel.toUpperCase()}
                              </Box>
                            </TableCell>
                            <TableCell align="right">{count}</TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialog}
        onClose={() => setSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SettingsIcon />
            Notification Settings
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Alert Types
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.criticalAlerts !== false}
                  onChange={(e) =>
                    handlePreferenceChange('criticalAlerts', e.target.checked)
                  }
                />
              }
              label="Critical Alerts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.resultNotifications !== false}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'resultNotifications',
                      e.target.checked
                    )
                  }
                />
              }
              label="Result Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.orderReminders !== false}
                  onChange={(e) =>
                    handlePreferenceChange('orderReminders', e.target.checked)
                  }
                />
              }
              label="Order Reminders"
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Delivery Channels
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.email !== false}
                  onChange={(e) =>
                    handlePreferenceChange('email', e.target.checked)
                  }
                />
              }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.sms === true}
                  onChange={(e) =>
                    handlePreferenceChange('sms', e.target.checked)
                  }
                />
              }
              label="SMS Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences?.push === true}
                  onChange={(e) =>
                    handlePreferenceChange('push', e.target.checked)
                  }
                  disabled
                />
              }
              label="Push Notifications (Coming Soon)"
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Test Notifications
            </Typography>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={
                  testingNotification === 'email' ? (
                    <CircularProgress size={16} />
                  ) : (
                    <EmailIcon />
                  )
                }
                onClick={() => handleTestNotification('email')}
                disabled={testingNotification !== null}
              >
                Test Email
              </Button>
              <Button
                variant="outlined"
                startIcon={
                  testingNotification === 'sms' ? (
                    <CircularProgress size={16} />
                  ) : (
                    <SmsIcon />
                  )
                }
                onClick={() => handleTestNotification('sms')}
                disabled={testingNotification !== null}
              >
                Test SMS
              </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Critical alerts will always be delivered via email regardless of
              preferences. SMS notifications require a valid phone number in
              your profile.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationDashboard;
