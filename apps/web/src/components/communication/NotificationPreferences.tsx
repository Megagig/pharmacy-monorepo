import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  VolumeUp as SoundIcon,
  VolumeOff as SoundOffIcon,
  Notifications as NotificationIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Restore as ResetIcon,
} from '@mui/icons-material';

interface NotificationPreferences {
  // General settings
  enabled: boolean;
  soundEnabled: boolean;
  soundVolume: number;

  // Delivery channels
  inAppNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  desktopNotifications: boolean;

  // Notification types
  newMessageNotifications: boolean;
  mentionNotifications: boolean;
  therapyUpdateNotifications: boolean;
  clinicalAlertNotifications: boolean;
  conversationInviteNotifications: boolean;
  fileSharedNotifications: boolean;
  interventionAssignedNotifications: boolean;
  patientQueryNotifications: boolean;
  urgentMessageNotifications: boolean;
  systemNotifications: boolean;

  // Timing and frequency
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  batchNotifications: boolean;
  batchInterval: number; // minutes

  // Priority settings
  urgentBypassQuietHours: boolean;
  highPrioritySound: boolean;
  groupSimilarNotifications: boolean;

  // Advanced settings
  maxNotificationsPerHour: number;
  autoMarkReadAfter: number; // minutes, 0 = disabled
  showPreview: boolean;
}

interface NotificationPreferencesDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (preferences: NotificationPreferences) => void;
  initialPreferences?: Partial<NotificationPreferences>;
}

const defaultPreferences: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 50,

  inAppNotifications: true,
  emailNotifications: false,
  smsNotifications: false,
  desktopNotifications: true,

  newMessageNotifications: true,
  mentionNotifications: true,
  therapyUpdateNotifications: true,
  clinicalAlertNotifications: true,
  conversationInviteNotifications: true,
  fileSharedNotifications: true,
  interventionAssignedNotifications: true,
  patientQueryNotifications: true,
  urgentMessageNotifications: true,
  systemNotifications: false,

  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  batchNotifications: false,
  batchInterval: 15,

  urgentBypassQuietHours: true,
  highPrioritySound: true,
  groupSimilarNotifications: true,

  maxNotificationsPerHour: 20,
  autoMarkReadAfter: 0,
  showPreview: true,
};

const NotificationPreferencesDialog: React.FC<
  NotificationPreferencesDialogProps
> = ({ open, onClose, onSave, initialPreferences = {} }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...defaultPreferences,
    ...initialPreferences,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [testSoundPlaying, setTestSoundPlaying] = useState(false);

  // Update preferences when initial preferences change
  useEffect(() => {
    setPreferences({
      ...defaultPreferences,
      ...initialPreferences,
    });
    setHasChanges(false);
  }, [initialPreferences]);

  // Handle preference changes
  const handlePreferenceChange = useCallback(
    (key: keyof NotificationPreferences, value: boolean | number | string) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
      setHasChanges(true);
    },
    []
  );

  // Handle save
  const handleSave = useCallback(() => {
    onSave(preferences);
    setHasChanges(false);
    onClose();
  }, [preferences, onSave, onClose]);

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    setPreferences(defaultPreferences);
    setHasChanges(true);
  }, []);

  // Test notification sound
  const testSound = useCallback(async () => {
    if (!preferences.soundEnabled) return;

    setTestSoundPlaying(true);
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = preferences.soundVolume / 100;
      await audio.play();
    } catch (error) {
      console.warn('Could not play test sound:', error);
    } finally {
      setTimeout(() => setTestSoundPlaying(false), 1000);
    }
  }, [preferences.soundEnabled, preferences.soundVolume]);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        handlePreferenceChange('desktopNotifications', true);
      }
    }
  }, [handlePreferenceChange]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <NotificationIcon sx={{ mr: 1 }} />
          Notification Preferences
        </Box>
        <Box>
          <Tooltip title="Reset to defaults">
            <IconButton onClick={handleReset}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* General Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            General Settings
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.enabled}
                  onChange={(e) =>
                    handlePreferenceChange('enabled', e.target.checked)
                  }
                />
              }
              label="Enable notifications"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.soundEnabled}
                  onChange={(e) =>
                    handlePreferenceChange('soundEnabled', e.target.checked)
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {preferences.soundEnabled ? (
                    <SoundIcon sx={{ mr: 1 }} />
                  ) : (
                    <SoundOffIcon sx={{ mr: 1 }} />
                  )}
                  Sound notifications
                  {preferences.soundEnabled && (
                    <Button
                      size="small"
                      onClick={testSound}
                      disabled={testSoundPlaying}
                      sx={{ ml: 1 }}
                    >
                      {testSoundPlaying ? 'Playing...' : 'Test'}
                    </Button>
                  )}
                </Box>
              }
            />
          </FormGroup>

          {preferences.soundEnabled && (
            <Box sx={{ mt: 2, px: 2 }}>
              <Typography gutterBottom>Sound Volume</Typography>
              <Slider
                value={preferences.soundVolume}
                onChange={(_, value) =>
                  handlePreferenceChange('soundVolume', value as number)
                }
                min={0}
                max={100}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Delivery Channels */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Delivery Channels
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.inAppNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'inAppNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <NotificationIcon sx={{ mr: 1 }} />
                  In-app notifications
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.desktopNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'desktopNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <NotificationIcon sx={{ mr: 1 }} />
                  Desktop notifications
                  {Notification.permission === 'default' && (
                    <Button
                      size="small"
                      onClick={requestDesktopPermission}
                      sx={{ ml: 1 }}
                    >
                      Enable
                    </Button>
                  )}
                  {Notification.permission === 'denied' && (
                    <Chip
                      label="Blocked"
                      size="small"
                      color="error"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.emailNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'emailNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <EmailIcon sx={{ mr: 1 }} />
                  Email notifications
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.smsNotifications}
                  onChange={(e) =>
                    handlePreferenceChange('smsNotifications', e.target.checked)
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SmsIcon sx={{ mr: 1 }} />
                  SMS notifications
                </Box>
              }
            />
          </FormGroup>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Notification Types */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Notification Types
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.newMessageNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'newMessageNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="New messages"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.mentionNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'mentionNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="@Mentions"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.therapyUpdateNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'therapyUpdateNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Therapy updates"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.clinicalAlertNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'clinicalAlertNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Clinical alerts"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.urgentMessageNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'urgentMessageNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Urgent messages"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.patientQueryNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'patientQueryNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Patient queries"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.systemNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'systemNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="System notifications"
            />
          </FormGroup>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Timing and Frequency */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Timing & Frequency
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.quietHoursEnabled}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'quietHoursEnabled',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon sx={{ mr: 1 }} />
                  Quiet hours
                </Box>
              }
            />
          </FormGroup>

          {preferences.quietHoursEnabled && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small">
                <InputLabel>Start</InputLabel>
                <Select
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    handlePreferenceChange('quietHoursStart', e.target.value)
                  }
                  label="Start"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <MenuItem key={hour} value={`${hour}:00`}>
                        {hour}:00
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              <Typography>to</Typography>

              <FormControl size="small">
                <InputLabel>End</InputLabel>
                <Select
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    handlePreferenceChange('quietHoursEnd', e.target.value)
                  }
                  label="End"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <MenuItem key={hour} value={`${hour}:00`}>
                        {hour}:00
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={preferences.urgentBypassQuietHours}
                onChange={(e) =>
                  handlePreferenceChange(
                    'urgentBypassQuietHours',
                    e.target.checked
                  )
                }
                disabled={
                  !preferences.enabled || !preferences.quietHoursEnabled
                }
              />
            }
            label="Urgent notifications bypass quiet hours"
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.batchNotifications}
                onChange={(e) =>
                  handlePreferenceChange('batchNotifications', e.target.checked)
                }
                disabled={!preferences.enabled}
              />
            }
            label="Batch similar notifications"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Advanced Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Advanced Settings
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.groupSimilarNotifications}
                  onChange={(e) =>
                    handlePreferenceChange(
                      'groupSimilarNotifications',
                      e.target.checked
                    )
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Group similar notifications"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.showPreview}
                  onChange={(e) =>
                    handlePreferenceChange('showPreview', e.target.checked)
                  }
                  disabled={!preferences.enabled}
                />
              }
              label="Show message preview"
            />
          </FormGroup>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>
              Maximum notifications per hour:{' '}
              {preferences.maxNotificationsPerHour}
            </Typography>
            <Slider
              value={preferences.maxNotificationsPerHour}
              onChange={(_, value) =>
                handlePreferenceChange(
                  'maxNotificationsPerHour',
                  value as number
                )
              }
              min={1}
              max={100}
              step={5}
              valueLabelDisplay="auto"
              disabled={!preferences.enabled}
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>
              Auto-mark as read after:{' '}
              {preferences.autoMarkReadAfter === 0
                ? 'Disabled'
                : `${preferences.autoMarkReadAfter} minutes`}
            </Typography>
            <Slider
              value={preferences.autoMarkReadAfter}
              onChange={(_, value) =>
                handlePreferenceChange('autoMarkReadAfter', value as number)
              }
              min={0}
              max={60}
              step={5}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) =>
                value === 0 ? 'Disabled' : `${value}m`
              }
              disabled={!preferences.enabled}
            />
          </Box>
        </Box>

        {hasChanges && (
          <Alert severity="info" sx={{ mt: 2 }}>
            You have unsaved changes. Click "Save" to apply them.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!hasChanges}>
          Save Preferences
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationPreferencesDialog;
