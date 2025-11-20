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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Notifications as NotificationsIcon,
  WhatsApp as WhatsAppIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  usePatientNotificationPreferences,
  useUpdatePatientNotificationPreferences,
  usePatientOptOutStatus,
  useUpdatePatientOptOutStatus,
  NotificationPreferencesData,
} from '../../queries/usePatientNotificationPreferences';

interface NotificationPreferencesFormProps {
  patientId: string;
  onSave?: (preferences: NotificationPreferencesData) => void;
  showOptOut?: boolean;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
  { value: 'ha', label: 'Hausa' },
];

const TIMEZONES = [
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT)' },
  { value: 'Africa/Abuja', label: 'West Africa Time (WAT)' },
];

const NOTIFICATION_TYPES = [
  {
    key: 'appointmentReminders',
    label: 'Appointment Reminders',
    description: 'Notifications about upcoming appointments',
    icon: <NotificationsIcon />,
  },
  {
    key: 'medicationRefills',
    label: 'Medication Refills',
    description: 'Reminders when medications need refilling',
    icon: <NotificationsIcon />,
  },
  {
    key: 'adherenceChecks',
    label: 'Adherence Checks',
    description: 'Reminders to take medications as prescribed',
    icon: <NotificationsIcon />,
  },
  {
    key: 'clinicalFollowups',
    label: 'Clinical Follow-ups',
    description: 'Notifications about clinical care follow-ups',
    icon: <NotificationsIcon />,
  },
  {
    key: 'generalNotifications',
    label: 'General Notifications',
    description: 'Other pharmacy-related notifications',
    icon: <NotificationsIcon />,
  },
];

const CHANNELS = [
  { key: 'email', label: 'Email', icon: <EmailIcon /> },
  { key: 'sms', label: 'SMS', icon: <SmsIcon /> },
  { key: 'push', label: 'Push', icon: <NotificationsIcon /> },
  { key: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon /> },
];

const NotificationPreferencesForm: React.FC<NotificationPreferencesFormProps> = ({
  patientId,
  onSave,
  showOptOut = true,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  
  // Query hooks
  const {
    data: preferences,
    isLoading: preferencesLoading,
    error: preferencesError,
  } = usePatientNotificationPreferences(patientId);
  
  const {
    data: optOutStatus,
    isLoading: optOutLoading,
  } = usePatientOptOutStatus(patientId);
  
  const updatePreferencesMutation = useUpdatePatientNotificationPreferences();
  const updateOptOutMutation = useUpdatePatientOptOutStatus();

  // Local state
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferencesData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  // Handle loading states
  if (preferencesLoading || optOutLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  // Handle error states
  if (preferencesError) {
    return (
      <Alert severity="error">
        Failed to load notification preferences. Please try again.
      </Alert>
    );
  }

  if (!localPreferences) {
    return (
      <Alert severity="info">
        No notification preferences found.
      </Alert>
    );
  }

  // Handle global preference changes
  const handleGlobalPreferenceChange = (key: keyof NotificationPreferencesData, value: any) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = { ...prev, [key]: value };
      setHasChanges(true);
      return updated;
    });
  };

  // Handle channel-specific preference changes
  const handleChannelPreferenceChange = (
    notificationType: keyof NotificationPreferencesData['channels'],
    channel: keyof NotificationPreferencesData['channels']['appointmentReminders'],
    value: boolean
  ) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        channels: {
          ...prev.channels,
          [notificationType]: {
            ...prev.channels[notificationType],
            [channel]: value,
          },
        },
      };
      setHasChanges(true);
      return updated;
    });
  };

  // Handle quiet hours changes
  const handleQuietHoursChange = (key: keyof NotificationPreferencesData['quietHours'], value: any) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        quietHours: {
          ...prev.quietHours,
          [key]: value,
        },
      };
      setHasChanges(true);
      return updated;
    });
  };

  // Save preferences
  const handleSave = async () => {
    if (!localPreferences || !hasChanges) return;

    try {
      const result = await updatePreferencesMutation.mutateAsync({
        patientId,
        preferences: localPreferences,
      });

      enqueueSnackbar(result.data.message || 'Preferences updated successfully', {
        variant: 'success',
      });

      setHasChanges(false);
      onSave?.(result.data.preferences);
    } catch (error) {
      enqueueSnackbar('Failed to update preferences', { variant: 'error' });
    }
  };

  // Handle opt-out toggle
  const handleOptOutToggle = async () => {
    if (!optOutStatus) return;

    try {
      const result = await updateOptOutMutation.mutateAsync({
        patientId,
        optOut: !optOutStatus.optedOut,
      });

      enqueueSnackbar(result.data.message, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to update opt-out status', { variant: 'error' });
    }
  };

  const isOptedOut = optOutStatus?.optedOut || false;

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Notification Preferences
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Manage how and when you receive notifications from the pharmacy.
          </Typography>

          {/* Opt-out section */}
          {showOptOut && (
            <>
              <Box mb={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isOptedOut}
                      onChange={handleOptOutToggle}
                      disabled={updateOptOutMutation.isPending}
                      color="warning"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <NotificationsOffIcon />
                      <Typography>
                        Opt out of all notifications
                      </Typography>
                    </Box>
                  }
                />
                <Typography variant="caption" color="text.secondary" display="block" ml={4}>
                  Turn off all notifications from the pharmacy
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
            </>
          )}

          {/* Disabled overlay when opted out */}
          <Box position="relative">
            {isOptedOut && (
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bgcolor="rgba(0, 0, 0, 0.1)"
                zIndex={1}
                borderRadius={1}
              />
            )}

            {/* Global preferences */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Global Settings
              </Typography>
              
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={localPreferences.language}
                    label="Language"
                    onChange={(e) => handleGlobalPreferenceChange('language', e.target.value)}
                    disabled={isOptedOut}
                  >
                    {LANGUAGES.map((lang) => (
                      <MenuItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={localPreferences.timezone}
                    label="Timezone"
                    onChange={(e) => handleGlobalPreferenceChange('timezone', e.target.value)}
                    disabled={isOptedOut}
                  >
                    {TIMEZONES.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Channel-specific preferences */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Notification Types
              </Typography>
              
              {NOTIFICATION_TYPES.map((notificationType) => (
                <Accordion key={notificationType.key} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {notificationType.icon}
                      <Box>
                        <Typography variant="subtitle1">
                          {notificationType.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {notificationType.description}
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormGroup row>
                      {CHANNELS.map((channel) => (
                        <FormControlLabel
                          key={channel.key}
                          control={
                            <Switch
                              checked={
                                localPreferences.channels[
                                  notificationType.key as keyof NotificationPreferencesData['channels']
                                ][channel.key as keyof NotificationPreferencesData['channels']['appointmentReminders']]
                              }
                              onChange={(e) =>
                                handleChannelPreferenceChange(
                                  notificationType.key as keyof NotificationPreferencesData['channels'],
                                  channel.key as keyof NotificationPreferencesData['channels']['appointmentReminders'],
                                  e.target.checked
                                )
                              }
                              disabled={isOptedOut}
                            />
                          }
                          label={
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {channel.icon}
                              <Typography variant="body2">
                                {channel.label}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </FormGroup>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Quiet hours */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Quiet Hours
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localPreferences.quietHours.enabled}
                    onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                    disabled={isOptedOut}
                  />
                }
                label="Enable quiet hours"
              />
              
              {localPreferences.quietHours.enabled && (
                <Stack direction="row" spacing={2} mt={2}>
                  <TextField
                    label="Start Time"
                    type="time"
                    value={localPreferences.quietHours.startTime}
                    onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                    disabled={isOptedOut}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End Time"
                    type="time"
                    value={localPreferences.quietHours.endTime}
                    onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                    disabled={isOptedOut}
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
              )}
              
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                During quiet hours, only urgent notifications will be sent
              </Typography>
            </Box>
          </Box>

          {/* Save button */}
          <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!hasChanges || isOptedOut || updatePreferencesMutation.isPending}
              loading={updatePreferencesMutation.isPending}
            >
              Save Preferences
            </Button>
          </Box>

          {/* Status indicators */}
          {hasChanges && !isOptedOut && (
            <Alert severity="info" sx={{ mt: 2 }}>
              You have unsaved changes. Click "Save Preferences" to apply them.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default NotificationPreferencesForm;