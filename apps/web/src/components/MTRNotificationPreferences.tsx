import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Button,
  Alert,
  Divider,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  PhoneAndroid as PushIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Assessment as ReportIcon,
  TestTube as TestIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mtrNotificationService } from '../services/mtrNotificationService';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  followUpReminders: boolean;
  criticalAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

const MTRNotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    sms: false,
    push: true,
    followUpReminders: true,
    criticalAlerts: true,
    dailyDigest: false,
    weeklyReport: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState<
    string | null
  >(null);

  const queryClient = useQueryClient();

  // Fetch current preferences
  const { data: currentPreferences, isLoading } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: mtrNotificationService.getNotificationPreferences,
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: mtrNotificationService.updateNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      setHasChanges(false);
    },
  });

  // Send test notification mutation
  const sendTestNotificationMutation = useMutation({
    mutationFn: (type: 'email' | 'sms') =>
      mtrNotificationService.sendTestNotification(type),
    onSuccess: (_, type) => {
      setTestNotificationSent(type);
      setTimeout(() => setTestNotificationSent(null), 5000);
    },
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
    }
  }, [currentPreferences]);

  const handlePreferenceChange =
    (key: keyof NotificationPreferences) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newPreferences = {
        ...preferences,
        [key]: event.target.checked,
      };
      setPreferences(newPreferences);
      setHasChanges(true);
    };

  const handleSave = () => {
    updatePreferencesMutation.mutate(preferences);
  };

  const handleReset = () => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
      setHasChanges(false);
    }
  };

  const handleTestNotification = (type: 'email' | 'sms') => {
    sendTestNotificationMutation.mutate(type);
  };

  if (isLoading) {
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

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={3}>
          <NotificationsIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            MTR Notification Preferences
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Configure how you want to receive notifications for Medication Therapy
          Review activities.
        </Typography>

        {updatePreferencesMutation.isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to update notification preferences. Please try again.
          </Alert>
        )}

        {updatePreferencesMutation.isSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Notification preferences updated successfully!
          </Alert>
        )}

        {testNotificationSent && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Test {testNotificationSent} notification sent! Check your{' '}
            {testNotificationSent === 'email' ? 'inbox' : 'phone'}.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Communication Channels */}
          <Grid item xs={12} md={6}>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Communication Channels
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Choose how you want to receive notifications
              </Typography>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.email}
                      onChange={handlePreferenceChange('email')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <EmailIcon sx={{ mr: 1, fontSize: 20 }} />
                      Email Notifications
                      <Tooltip title="Test email notification">
                        <IconButton
                          size="small"
                          onClick={() => handleTestNotification('email')}
                          disabled={
                            !preferences.email ||
                            sendTestNotificationMutation.isPending
                          }
                          sx={{ ml: 1 }}
                        >
                          <TestIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.sms}
                      onChange={handlePreferenceChange('sms')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <SmsIcon sx={{ mr: 1, fontSize: 20 }} />
                      SMS Notifications
                      <Tooltip title="Test SMS notification">
                        <IconButton
                          size="small"
                          onClick={() => handleTestNotification('sms')}
                          disabled={
                            !preferences.sms ||
                            sendTestNotificationMutation.isPending
                          }
                          sx={{ ml: 1 }}
                        >
                          <TestIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.push}
                      onChange={handlePreferenceChange('push')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <PushIcon sx={{ mr: 1, fontSize: 20 }} />
                      Push Notifications
                      <Chip
                        label="Coming Soon"
                        size="small"
                        color="secondary"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  }
                />
              </FormGroup>
            </Box>
          </Grid>

          {/* Notification Types */}
          <Grid item xs={12} md={6}>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Notification Types
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Select which types of notifications you want to receive
              </Typography>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.followUpReminders}
                      onChange={handlePreferenceChange('followUpReminders')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <ScheduleIcon sx={{ mr: 1, fontSize: 20 }} />
                      Follow-up Reminders
                      <Tooltip title="Reminders for scheduled MTR follow-ups">
                        <InfoIcon
                          sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                        />
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.criticalAlerts}
                      onChange={handlePreferenceChange('criticalAlerts')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <WarningIcon
                        sx={{ mr: 1, fontSize: 20, color: 'error.main' }}
                      />
                      Critical Alerts
                      <Tooltip title="Immediate alerts for critical drug interactions and high-severity problems">
                        <InfoIcon
                          sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                        />
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.dailyDigest}
                      onChange={handlePreferenceChange('dailyDigest')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <ReportIcon sx={{ mr: 1, fontSize: 20 }} />
                      Daily Digest
                      <Tooltip title="Daily summary of MTR activities and pending tasks">
                        <InfoIcon
                          sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                        />
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={preferences.weeklyReport}
                      onChange={handlePreferenceChange('weeklyReport')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      <ReportIcon sx={{ mr: 1, fontSize: 20 }} />
                      Weekly Report
                      <Tooltip title="Weekly performance and statistics report">
                        <InfoIcon
                          sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                        />
                      </Tooltip>
                    </Box>
                  }
                />
              </FormGroup>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Important Notes */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Important:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>
                Critical alerts will always be sent via email regardless of your
                preferences for urgent safety issues.
              </li>
              <li>
                SMS notifications require a valid phone number in your profile.
              </li>
              <li>
                You can test your notification settings using the test buttons
                above.
              </li>
            </ul>
          </Typography>
        </Alert>

        {/* Action Buttons */}
        <Box display="flex" gap={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!hasChanges || updatePreferencesMutation.isPending}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasChanges || updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MTRNotificationPreferences;
