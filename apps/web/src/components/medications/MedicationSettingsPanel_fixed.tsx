import * as React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { 
  usePatientMedicationSettings, 
  useUpdatePatientMedicationSettings,
  useTestNotification
} from '../../queries/medicationManagementQueries';

interface MedicationSettingsPanelProps {
  patientId: string;
}

const MedicationSettingsPanel: React.FC<MedicationSettingsPanelProps> = ({ patientId }) => {
  const [testContactInfo, setTestContactInfo] = React.useState('');
  const [testNotificationType, setTestNotificationType] = React.useState<'email' | 'sms'>('email');

  // Fetch patient medication settings
  const { 
    data: settings, 
    isLoading: isLoadingSettings, 
    error: settingsError 
  } = usePatientMedicationSettings(patientId);

  // Update patient medication settings mutation
  const updateSettingsMutation = useUpdatePatientMedicationSettings();
  
  // Test notification mutation
  const testNotificationMutation = useTestNotification();

  // State for settings form
  const [reminderSettings, setReminderSettings] = React.useState({
    enabled: false,
    defaultReminderTimes: ['09:00', '13:00', '19:00'],
    reminderMethod: 'email' as 'email' | 'sms' | 'both',
    defaultNotificationLeadTime: 15,
  });

  // State for monitoring settings form
  const [monitoringSettings, setMonitoringSettings] = React.useState({
    adherenceMonitoring: false,
    refillReminders: false,
    interactionChecking: true,
  });

  // Initialize form with data when it loads
  React.useEffect(() => {
    if (settings) {
      setReminderSettings({
        enabled: settings.reminderSettings.enabled,
        defaultReminderTimes: settings.reminderSettings.defaultReminderTimes,
        reminderMethod: settings.reminderSettings.reminderMethod,
        defaultNotificationLeadTime: settings.reminderSettings.defaultNotificationLeadTime,
      });

      setMonitoringSettings({
        adherenceMonitoring: settings.monitoringSettings.adherenceMonitoring,
        refillReminders: settings.monitoringSettings.refillReminders,
        interactionChecking: settings.monitoringSettings.interactionChecking,
      });
    }
  }, [settings]);

  // Handle form submission
  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        patientId,
        settings: {
          reminderSettings,
          monitoringSettings,
        },
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Handle reminder time change
  const handleReminderTimeChange = (index: number, value: string) => {
    const newTimes = [...reminderSettings.defaultReminderTimes];
    newTimes[index] = value;
    setReminderSettings({
      ...reminderSettings,
      defaultReminderTimes: newTimes,
    });
  };

  // Add a reminder time
  const handleAddReminderTime = () => {
    setReminderSettings({
      ...reminderSettings,
      defaultReminderTimes: [...reminderSettings.defaultReminderTimes, '12:00'],
    });
  };

  // Remove a reminder time
  const handleRemoveReminderTime = (index: number) => {
    const newTimes = [...reminderSettings.defaultReminderTimes];
    newTimes.splice(index, 1);
    setReminderSettings({
      ...reminderSettings,
      defaultReminderTimes: newTimes,
    });
  };

  // Handle notification test
  const handleTestNotification = async () => {
    try {
      await testNotificationMutation.mutateAsync({
        patientId,
        type: testNotificationType,
        contact: testContactInfo,
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  if (isLoadingSettings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (settingsError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading medication settings: {(settingsError as Error).message || 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Medication Reminder Settings
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} component="div">
            <FormControlLabel
              control={
                <Switch
                  checked={reminderSettings.enabled}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      enabled: e.target.checked,
                    })
                  }
                  name="enabled"
                />
              }
              label="Enable Medication Reminders"
            />
            <FormHelperText>
              When enabled, reminders will be sent based on the schedule below
            </FormHelperText>
          </Grid>

          <Grid item xs={12} sm={6} component="div">
            <FormControl fullWidth>
              <InputLabel id="reminder-method-label">Reminder Method</InputLabel>
              <Select
                labelId="reminder-method-label"
                id="reminder-method"
                value={reminderSettings.reminderMethod}
                label="Reminder Method"
                onChange={(e) =>
                  setReminderSettings({
                    ...reminderSettings,
                    reminderMethod: e.target.value as 'email' | 'sms' | 'both',
                  })
                }
                disabled={!reminderSettings.enabled}
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="both">Both Email and SMS</MenuItem>
              </Select>
              <FormHelperText>
                Choose how you want to receive medication reminders
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} component="div">
            <TextField
              fullWidth
              type="number"
              label="Default Notification Lead Time (minutes)"
              value={reminderSettings.defaultNotificationLeadTime}
              onChange={(e) =>
                setReminderSettings({
                  ...reminderSettings,
                  defaultNotificationLeadTime: parseInt(e.target.value) || 0,
                })
              }
              disabled={!reminderSettings.enabled}
              InputProps={{ inputProps: { min: 0, max: 120 } }}
              helperText="How many minutes before the scheduled time to send reminders"
            />
          </Grid>

          <Grid item xs={12} component="div">
            <Typography variant="subtitle1" gutterBottom>
              Default Reminder Times
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                These times will be used as defaults when setting up medication schedules
              </Typography>
            </Box>

            {reminderSettings.defaultReminderTimes.map((time, index) => (
              <Box
                key={index}
                sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
              >
                <TextField
                  type="time"
                  value={time}
                  onChange={(e) => handleReminderTimeChange(index, e.target.value)}
                  disabled={!reminderSettings.enabled}
                  sx={{ mr: 2 }}
                />
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleRemoveReminderTime(index)}
                  disabled={!reminderSettings.enabled || reminderSettings.defaultReminderTimes.length <= 1}
                >
                  Remove
                </Button>
              </Box>
            ))}

            <Button
              variant="outlined"
              onClick={handleAddReminderTime}
              disabled={!reminderSettings.enabled}
              sx={{ mt: 1 }}
            >
              Add Reminder Time
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h6" component="h2" gutterBottom>
        Monitoring Settings
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} component="div">
            <FormControlLabel
              control={
                <Switch
                  checked={monitoringSettings.adherenceMonitoring}
                  onChange={(e) =>
                    setMonitoringSettings({
                      ...monitoringSettings,
                      adherenceMonitoring: e.target.checked,
                    })
                  }
                />
              }
              label="Enable Adherence Monitoring"
            />
            <FormHelperText>
              Track and analyze medication adherence patterns
            </FormHelperText>
          </Grid>

          <Grid item xs={12} component="div">
            <FormControlLabel
              control={
                <Switch
                  checked={monitoringSettings.refillReminders}
                  onChange={(e) =>
                    setMonitoringSettings({
                      ...monitoringSettings,
                      refillReminders: e.target.checked,
                    })
                  }
                />
              }
              label="Enable Refill Reminders"
            />
            <FormHelperText>
              Send reminders when medications need to be refilled
            </FormHelperText>
          </Grid>

          <Grid item xs={12} component="div">
            <FormControlLabel
              control={
                <Switch
                  checked={monitoringSettings.interactionChecking}
                  onChange={(e) =>
                    setMonitoringSettings({
                      ...monitoringSettings,
                      interactionChecking: e.target.checked,
                    })
                  }
                />
              }
              label="Enable Medication Interaction Checking"
            />
            <FormHelperText>
              Check for potential interactions between medications
            </FormHelperText>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h6" component="h2" gutterBottom>
        Test Notifications
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4} component="div">
            <FormControl fullWidth>
              <InputLabel id="test-notification-type-label">Notification Type</InputLabel>
              <Select
                labelId="test-notification-type-label"
                id="test-notification-type"
                value={testNotificationType}
                label="Notification Type"
                onChange={(e) => setTestNotificationType(e.target.value as 'email' | 'sms')}
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={8} component="div">
            <TextField
              fullWidth
              label={testNotificationType === 'email' ? 'Email Address' : 'Phone Number'}
              value={testContactInfo}
              onChange={(e) => setTestContactInfo(e.target.value)}
              placeholder={
                testNotificationType === 'email'
                  ? 'patient@example.com'
                  : '+1234567890'
              }
            />
          </Grid>

          <Grid item xs={12} component="div">
            <Button
              variant="contained"
              onClick={handleTestNotification}
              disabled={!testContactInfo || testNotificationMutation.isPending}
            >
              Send Test Notification
              {testNotificationMutation.isPending && (
                <CircularProgress size={20} sx={{ ml: 1 }} />
              )}
            </Button>
            {testNotificationMutation.isSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Test notification sent successfully!
              </Alert>
            )}
            {testNotificationMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Failed to send test notification: {(testNotificationMutation.error as Error)?.message || 'Unknown error'}
              </Alert>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveSettings}
          disabled={updateSettingsMutation.isPending}
        >
          Save Settings
          {updateSettingsMutation.isPending && (
            <CircularProgress size={20} sx={{ ml: 1 }} />
          )}
        </Button>
      </Box>
      
      {updateSettingsMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      {updateSettingsMutation.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save settings: {(updateSettingsMutation.error as Error)?.message || 'Unknown error'}
        </Alert>
      )}
    </Box>
  );
};

export default MedicationSettingsPanel;
