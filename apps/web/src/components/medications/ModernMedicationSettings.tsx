import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
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
  Card,
  CardContent,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Slide,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  MonitorHeart as MonitorIcon,
  Schedule as ScheduleIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  usePatientMedicationSettings,
  useUpdatePatientMedicationSettings,
} from '../../queries/medicationManagementQueries';

interface ModernMedicationSettingsProps {
  patientId: string;
}

const ModernMedicationSettings: React.FC<ModernMedicationSettingsProps> = ({
  patientId,
}) => {
  // Fetch patient medication settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = usePatientMedicationSettings(patientId);

  // Update patient medication settings mutation
  const updateSettingsMutation = useUpdatePatientMedicationSettings();

  // State for settings form
  const [reminderSettings, setReminderSettings] = useState({
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
  const [monitoringSettings, setMonitoringSettings] = useState({
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

  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form with data when it loads
  useEffect(() => {
    if (settings) {
      setReminderSettings((prev) => ({
        ...prev,
        ...settings.reminderSettings,
      }));

      setMonitoringSettings((prev) => ({
        ...prev,
        ...settings.monitoringSettings,
      }));
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (settings) {
      const reminderChanged = JSON.stringify(reminderSettings) !== JSON.stringify(settings.reminderSettings);
      const monitoringChanged = JSON.stringify(monitoringSettings) !== JSON.stringify(settings.monitoringSettings);
      setHasChanges(reminderChanged || monitoringChanged);
    }
  }, [reminderSettings, monitoringSettings, settings]);

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
      setHasChanges(false);
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

  if (isLoadingSettings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (settingsError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Error Loading Settings</Typography>
        {(settingsError as Error).message || 'Unable to load medication settings'}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SettingsIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Medication Settings
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Configure medication reminders and monitoring preferences for optimal patient care
        </Typography>
      </Box>

      {/* Save Button - Sticky */}
      <Fade in={hasChanges}>
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1.5,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            {updateSettingsMutation.isPending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              'Save Changes'
            )}
          </Button>
        </Box>
      </Fade>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: '100%' }}>
        {/* Reminder Settings */}
        <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(50% - 16px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'visible',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <NotificationsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight="bold">
                  Reminder Settings
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
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
                      size="medium"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium">
                        Enable Medication Reminders
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Send automated reminders based on medication schedules
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Slide direction="down" in={reminderSettings.enabled} mountOnEnter unmountOnExit>
                <Box>
                  <Divider sx={{ my: 3 }} />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: '100%' }}>
                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' }, minWidth: 0 }}>
                        <FormControl fullWidth>
                          <InputLabel>Reminder Method</InputLabel>
                          <Select
                            value={reminderSettings.reminderMethod}
                            label="Reminder Method"
                            onChange={(e) =>
                              setReminderSettings({
                                ...reminderSettings,
                                reminderMethod: e.target.value as 'email' | 'sms' | 'both',
                              })
                            }
                          >
                            <MenuItem value="email">Email Only</MenuItem>
                            <MenuItem value="sms">SMS Only</MenuItem>
                            <MenuItem value="both">Email & SMS</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>

                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' }, minWidth: 0 }}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Lead Time (minutes)"
                          value={reminderSettings.defaultNotificationLeadTime}
                          onChange={(e) =>
                            setReminderSettings({
                              ...reminderSettings,
                              defaultNotificationLeadTime: parseInt(e.target.value) || 0,
                            })
                          }
                          InputProps={{ inputProps: { min: 0, max: 120 } }}
                          helperText="Minutes before scheduled time"
                        />
                      </Box>
                    </Box>

                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Custom Message"
                      value={reminderSettings.customMessage}
                      onChange={(e) =>
                        setReminderSettings({
                          ...reminderSettings,
                          customMessage: e.target.value,
                        })
                      }
                      helperText="Personalized message for medication reminders"
                    />

                    <Box>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="subtitle1" fontWeight="medium">
                            Default Reminder Times
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Set default times for medication reminders
                        </Typography>

                        {reminderSettings.defaultReminderTimes.map((time, index) => (
                          <Box
                            key={index}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mb: 2,
                              p: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              bgcolor: 'background.paper',
                            }}
                          >
                            <TextField
                              type="time"
                              value={time}
                              onChange={(e) =>
                                handleReminderTimeChange(index, e.target.value)
                              }
                              sx={{ mr: 2, flex: 1 }}
                            />
                            <Tooltip title="Remove time">
                              <IconButton
                                color="error"
                                onClick={() => handleRemoveReminderTime(index)}
                                disabled={reminderSettings.defaultReminderTimes.length <= 1}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}

                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={handleAddReminderTime}
                          sx={{ mt: 1 }}
                        >
                          Add Reminder Time
                        </Button>
                      </Box>
                    </Box>

                    {/* Advanced Options */}
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
                        Advanced Options
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1">Smart Reminders</Typography>
                              <Typography variant="body2" color="text.secondary">
                                AI-powered adaptive reminders based on patient behavior
                              </Typography>
                            </Box>
                          }
                        />

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
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1">Allow Snooze</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Enable snooze functionality for reminders
                              </Typography>
                            </Box>
                          }
                        />

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
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1">Notify Caregiver</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Send notifications to designated caregiver
                              </Typography>
                            </Box>
                          }
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
                            sx={{ ml: 4 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Slide>
            </CardContent>
          </Card>
        </Box>

        {/* Monitoring Settings */}
        <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 calc(50% - 16px)' }, minWidth: 0 }}>
          <Card
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <MonitorIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight="bold">
                  Monitoring Settings
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                <Box
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.default',
                  }}
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
                    label={
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          Adherence Monitoring
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Track and analyze medication adherence patterns
                        </Typography>
                      </Box>
                    }
                  />

                  {monitoringSettings.adherenceMonitoring && (
                    <Box sx={{ mt: 2, ml: 4 }}>
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
                        <FormControl size="small" sx={{ ml: 2, minWidth: 120 }}>
                          <InputLabel>Frequency</InputLabel>
                          <Select
                            value={monitoringSettings.reportFrequency}
                            label="Frequency"
                            onChange={(e) =>
                              setMonitoringSettings({
                                ...monitoringSettings,
                                reportFrequency: e.target.value as 'daily' | 'weekly' | 'monthly',
                              })
                            }
                          >
                            <MenuItem value="daily">Daily</MenuItem>
                            <MenuItem value="weekly">Weekly</MenuItem>
                            <MenuItem value="monthly">Monthly</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    </Box>
                  )}
                </Box>

                <Box
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.default',
                  }}
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
                    label={
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          Refill Reminders
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Automatic reminders when medications need refilling
                        </Typography>
                      </Box>
                    }
                  />

                  {monitoringSettings.refillReminders && (
                    <Box sx={{ mt: 2, ml: 4 }}>
                      <TextField
                        type="number"
                        label="Refill Threshold (%)"
                        value={monitoringSettings.refillThreshold}
                        onChange={(e) =>
                          setMonitoringSettings({
                            ...monitoringSettings,
                            refillThreshold: parseInt(e.target.value) || 0,
                          })
                        }
                        InputProps={{ inputProps: { min: 0, max: 50 } }}
                        size="small"
                        sx={{ maxWidth: 200 }}
                        helperText="Trigger reminder when % remaining"
                      />
                    </Box>
                  )}
                </Box>

                <Box
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.default',
                  }}
                >
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
                    label={
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          Interaction Checking
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Monitor for potential drug interactions
                        </Typography>
                      </Box>
                    }
                  />

                  {monitoringSettings.interactionChecking && (
                    <Box sx={{ mt: 2, ml: 4 }}>
                      <TextField
                        type="number"
                        label="Missed Dose Alert Threshold"
                        value={monitoringSettings.missedDoseThreshold}
                        onChange={(e) =>
                          setMonitoringSettings({
                            ...monitoringSettings,
                            missedDoseThreshold: parseInt(e.target.value) || 0,
                          })
                        }
                        InputProps={{ inputProps: { min: 1, max: 10 } }}
                        size="small"
                        sx={{ maxWidth: 200 }}
                        helperText="Consecutive missed doses to alert"
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Success/Error Messages */}
      {updateSettingsMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 3 }} icon={<CheckIcon />}>
          <Typography variant="subtitle1">Settings Updated Successfully!</Typography>
          Your medication settings have been saved and are now active.
        </Alert>
      )}

      {updateSettingsMutation.isError && (
        <Alert severity="error" sx={{ mt: 3 }} icon={<WarningIcon />}>
          <Typography variant="subtitle1">Failed to Update Settings</Typography>
          {(updateSettingsMutation.error as Error)?.message || 'Please try again or contact support.'}
        </Alert>
      )}
    </Box>
  );
};

export default ModernMedicationSettings;