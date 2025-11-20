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
  useTestNotification,
} from '../../queries/medicationManagementQueries';

interface MedicationSettingsPanelProps {
  patientId: string;
}

const MedicationSettingsPanel: React.FC<MedicationSettingsPanelProps> = ({
  patientId,
}) => {
  const [testContactInfo, setTestContactInfo] = React.useState('');
  const [testNotificationType, setTestNotificationType] = React.useState<
    'email' | 'sms'
  >('email');

  // Fetch patient medication settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
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
    customMessage: 'Time to take your medication!',
    repeatReminders: false,
    repeatInterval: 30,
    smartReminders: false,
    allowSnooze: true,
    snoozeOptions: [5, 10, 15, 30],
    notifyCaregiver: false,
    caregiverContact: '',
  });

  // State for monitoring settings form
  const [monitoringSettings, setMonitoringSettings] = React.useState({
    adherenceMonitoring: false,
    refillReminders: false,
    interactionChecking: true,
    refillThreshold: 20,
    missedDoseThreshold: 2,
    adherenceReporting: false,
    reportFrequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    alertOnLowAdherence: false,
    lowAdherenceThreshold: 70,
    stockoutPrediction: false,
  });

  // Initialize form with data when it loads
  React.useEffect(() => {
    if (settings) {
      setReminderSettings((prev) => ({
        ...prev,
        enabled: settings.reminderSettings.enabled,
        defaultReminderTimes: settings.reminderSettings.defaultReminderTimes,
        reminderMethod: settings.reminderSettings.reminderMethod,
        defaultNotificationLeadTime:
          settings.reminderSettings.defaultNotificationLeadTime,
      }));

      setMonitoringSettings((prev) => ({
        ...prev,
        adherenceMonitoring: settings.monitoringSettings.adherenceMonitoring,
        refillReminders: settings.monitoringSettings.refillReminders,
        interactionChecking: settings.monitoringSettings.interactionChecking,
      }));
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

  // State for test message
  const [testMessage, setTestMessage] = React.useState(
    reminderSettings.customMessage || 'Time to take your medication!'
  );

  // Handle notification test
  const handleTestNotification = async () => {
    if (!testContactInfo) {
      alert('Please enter a valid email or phone number.');
      return;
    }

    try {
      const result = await testNotificationMutation.mutateAsync({
        patientId,
        type: testNotificationType,
        contact: testContactInfo,
      });

      // Show success or error message
      if (result.success) {
        alert(`${result.message}\n\n${result.details || ''}`);
      } else {
        alert(`Failed to send test notification: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      alert('Failed to send test notification. Please try again.');
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
        Error loading medication settings:{' '}
        {(settingsError as Error).message || 'Unknown error'}
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
          <Grid sx={{ gridColumn: 'span 12' }} component="div">
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

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
            <FormControl fullWidth>
              <InputLabel id="reminder-method-label">
                Reminder Method
              </InputLabel>
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

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
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

          <Grid sx={{ gridColumn: { xs: 'span 12' } }} component="div">
            <TextField
              fullWidth
              label="Custom Reminder Message"
              value={reminderSettings.customMessage}
              onChange={(e) =>
                setReminderSettings({
                  ...reminderSettings,
                  customMessage: e.target.value,
                })
              }
              disabled={!reminderSettings.enabled}
              helperText="Custom message to include in medication reminders"
            />
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={reminderSettings.repeatReminders}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      repeatReminders: e.target.checked,
                    })
                  }
                  disabled={!reminderSettings.enabled}
                />
              }
              label="Repeat Reminders"
            />
            {reminderSettings.repeatReminders && (
              <TextField
                type="number"
                label="Repeat Interval (minutes)"
                value={reminderSettings.repeatInterval}
                onChange={(e) =>
                  setReminderSettings({
                    ...reminderSettings,
                    repeatInterval: parseInt(e.target.value) || 0,
                  })
                }
                disabled={!reminderSettings.enabled}
                InputProps={{ inputProps: { min: 5, max: 120 } }}
                size="small"
                sx={{ ml: 3, mt: 1 }}
              />
            )}
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={reminderSettings.smartReminders}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      smartReminders: e.target.checked,
                    })
                  }
                  disabled={!reminderSettings.enabled}
                />
              }
              label="Smart Reminders"
            />
            <FormHelperText>
              Adaptive reminders based on patient behavior patterns
            </FormHelperText>
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={reminderSettings.allowSnooze}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      allowSnooze: e.target.checked,
                    })
                  }
                  disabled={!reminderSettings.enabled}
                />
              }
              label="Allow Snooze"
            />
            <FormHelperText>
              Enable snooze functionality for medication reminders
            </FormHelperText>
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={reminderSettings.notifyCaregiver}
                  onChange={(e) =>
                    setReminderSettings({
                      ...reminderSettings,
                      notifyCaregiver: e.target.checked,
                    })
                  }
                  disabled={!reminderSettings.enabled}
                />
              }
              label="Notify Caregiver"
            />
            {reminderSettings.notifyCaregiver && (
              <TextField
                fullWidth
                label="Caregiver Contact"
                value={reminderSettings.caregiverContact}
                onChange={(e) =>
                  setReminderSettings({
                    ...reminderSettings,
                    caregiverContact: e.target.value,
                  })
                }
                placeholder="Email or phone number"
                disabled={!reminderSettings.enabled}
                size="small"
                sx={{ mt: 1 }}
              />
            )}
          </Grid>

          <Grid sx={{ gridColumn: 'span 12' }} component="div">
            <Typography variant="subtitle1" gutterBottom>
              Default Reminder Times
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                These times will be used as defaults when setting up medication
                schedules
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
                  onChange={(e) =>
                    handleReminderTimeChange(index, e.target.value)
                  }
                  disabled={!reminderSettings.enabled}
                  sx={{ mr: 2 }}
                />
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleRemoveReminderTime(index)}
                  disabled={
                    !reminderSettings.enabled ||
                    reminderSettings.defaultReminderTimes.length <= 1
                  }
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
          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
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

            {monitoringSettings.adherenceMonitoring && (
              <Box sx={{ mt: 2, ml: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={monitoringSettings.adherenceReporting}
                      onChange={(e) =>
                        setMonitoringSettings({
                          ...monitoringSettings,
                          adherenceReporting: e.target.checked,
                        })
                      }
                      size="small"
                    />
                  }
                  label="Generate Adherence Reports"
                />

                {monitoringSettings.adherenceReporting && (
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ mt: 1, maxWidth: 200 }}
                  >
                    <InputLabel id="report-frequency-label">
                      Report Frequency
                    </InputLabel>
                    <Select
                      labelId="report-frequency-label"
                      value={monitoringSettings.reportFrequency}
                      label="Report Frequency"
                      onChange={(e) =>
                        setMonitoringSettings({
                          ...monitoringSettings,
                          reportFrequency: e.target.value as
                            | 'daily'
                            | 'weekly'
                            | 'monthly',
                        })
                      }
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={monitoringSettings.alertOnLowAdherence}
                      onChange={(e) =>
                        setMonitoringSettings({
                          ...monitoringSettings,
                          alertOnLowAdherence: e.target.checked,
                        })
                      }
                      size="small"
                    />
                  }
                  label="Alert on Low Adherence"
                  sx={{ mt: 1, display: 'block' }}
                />

                {monitoringSettings.alertOnLowAdherence && (
                  <TextField
                    type="number"
                    label="Low Adherence Threshold %"
                    value={monitoringSettings.lowAdherenceThreshold}
                    onChange={(e) =>
                      setMonitoringSettings({
                        ...monitoringSettings,
                        lowAdherenceThreshold: parseInt(e.target.value) || 0,
                      })
                    }
                    InputProps={{ inputProps: { min: 0, max: 100 } }}
                    size="small"
                    sx={{ mt: 1, maxWidth: 200 }}
                  />
                )}
              </Box>
            )}
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}
            component="div"
          >
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

            {monitoringSettings.refillReminders && (
              <Box sx={{ mt: 2, ml: 3 }}>
                <TextField
                  type="number"
                  label="Refill Threshold %"
                  value={monitoringSettings.refillThreshold}
                  onChange={(e) =>
                    setMonitoringSettings({
                      ...monitoringSettings,
                      refillThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  helperText="Percentage remaining to trigger refill reminder"
                  InputProps={{ inputProps: { min: 0, max: 50 } }}
                  size="small"
                  sx={{ maxWidth: 200 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={monitoringSettings.stockoutPrediction}
                      onChange={(e) =>
                        setMonitoringSettings({
                          ...monitoringSettings,
                          stockoutPrediction: e.target.checked,
                        })
                      }
                      size="small"
                    />
                  }
                  label="Predict Medication Stockouts"
                  sx={{ mt: 1, display: 'block' }}
                />
              </Box>
            )}
          </Grid>

          <Grid sx={{ gridColumn: 'span 12' }} component="div">
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

            {monitoringSettings.interactionChecking && (
              <Box sx={{ mt: 2, ml: 3 }}>
                <TextField
                  type="number"
                  label="Missed Dose Threshold"
                  value={monitoringSettings.missedDoseThreshold}
                  onChange={(e) =>
                    setMonitoringSettings({
                      ...monitoringSettings,
                      missedDoseThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  helperText="Consecutive missed doses to trigger an alert"
                  InputProps={{ inputProps: { min: 1, max: 10 } }}
                  size="small"
                  sx={{ maxWidth: 200 }}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h6" component="h2" gutterBottom>
        Test Notifications
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}
            component="div"
          >
            <FormControl fullWidth>
              <InputLabel id="test-notification-type-label">
                Notification Type
              </InputLabel>
              <Select
                labelId="test-notification-type-label"
                id="test-notification-type"
                value={testNotificationType}
                label="Notification Type"
                onChange={(e) =>
                  setTestNotificationType(e.target.value as 'email' | 'sms')
                }
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid
            sx={{ gridColumn: { xs: 'span 12', sm: 'span 8' } }}
            component="div"
          >
            <TextField
              fullWidth
              label={
                testNotificationType === 'email'
                  ? 'Email Address'
                  : 'Phone Number'
              }
              value={testContactInfo}
              placeholder={
                testNotificationType === 'email'
                  ? 'example@email.com'
                  : '+1 (555) 123-4567'
              }
              onChange={(e) => setTestContactInfo(e.target.value)}
            />
          </Grid>

          <Grid sx={{ gridColumn: 'span 12' }} component="div">
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Test Message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              helperText="Message to include in the test notification"
              placeholder={
                testNotificationType === 'email'
                  ? 'patient@example.com'
                  : '+1234567890'
              }
            />
          </Grid>

          <Grid sx={{ gridColumn: 'span 12' }} component="div">
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
                Failed to send test notification:{' '}
                {(testNotificationMutation.error as Error)?.message ||
                  'Unknown error'}
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
          Failed to save settings:{' '}
          {(updateSettingsMutation.error as Error)?.message || 'Unknown error'}
        </Alert>
      )}
    </Box>
  );
};

export default MedicationSettingsPanel;
