import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  usePatientNotificationPreferences,
  useUpdatePatientNotificationPreferences,
  NotificationPreferencesData,
} from '../../queries/usePatientNotificationPreferences';
import NotificationChannelSelector, { NotificationChannels } from '../patient-portal/NotificationChannelSelector';

interface PatientNotificationPreferencesProps {
  patientId: string;
  onSave?: (preferences: NotificationPreferencesData) => void;
  embedded?: boolean;
  defaultExpanded?: boolean;
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

const PatientNotificationPreferences: React.FC<PatientNotificationPreferencesProps> = ({
  patientId,
  onSave,
  embedded = false,
  defaultExpanded = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  
  // Query hooks
  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = usePatientNotificationPreferences(patientId);
  
  const updatePreferencesMutation = useUpdatePatientNotificationPreferences();

  // Local state
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferencesData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Initialize local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  // Handle loading states
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Handle error states
  if (error) {
    return (
      <Alert 
        severity="error"
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Failed to load notification preferences
      </Alert>
    );
  }

  if (!localPreferences) {
    return (
      <Alert severity="info">
        No notification preferences found for this patient.
      </Alert>
    );
  }

  // Handle preference changes
  const handleLanguageChange = (language: string) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = { ...prev, language: language as 'en' | 'yo' | 'ig' | 'ha' };
      setHasChanges(true);
      return updated;
    });
  };

  const handleTimezoneChange = (timezone: string) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = { ...prev, timezone };
      setHasChanges(true);
      return updated;
    });
  };

  const handleChannelChange = (
    notificationType: keyof NotificationPreferencesData['channels'],
    channels: NotificationChannels
  ) => {
    setLocalPreferences(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        channels: {
          ...prev.channels,
          [notificationType]: channels,
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

      enqueueSnackbar('Notification preferences updated successfully', {
        variant: 'success',
      });

      setHasChanges(false);
      onSave?.(result.data.preferences);
    } catch (error) {
      enqueueSnackbar('Failed to update notification preferences', { 
        variant: 'error' 
      });
    }
  };

  const content = (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <SettingsIcon color="primary" />
          <Typography variant={embedded ? "subtitle1" : "h6"}>
            Notification Preferences
          </Typography>
        </Box>
        
        <Box display="flex" alignItems="center" gap={1}>
          {hasChanges && (
            <Typography variant="caption" color="warning.main">
              Unsaved changes
            </Typography>
          )}
          
          {embedded && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      <Collapse in={!embedded || expanded}>
        <Stack spacing={3}>
          {/* Basic settings */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Basic Settings
            </Typography>
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel size="small">Language</InputLabel>
                <Select
                  size="small"
                  value={localPreferences.language}
                  label="Language"
                  onChange={(e) => handleLanguageChange(e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel size="small">Timezone</InputLabel>
                <Select
                  size="small"
                  value={localPreferences.timezone}
                  label="Timezone"
                  onChange={(e) => handleTimezoneChange(e.target.value)}
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

          <Divider />

          {/* Notification channels */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Notification Channels
            </Typography>
            
            <Stack spacing={2}>
              <NotificationChannelSelector
                title="Appointment Reminders"
                channels={localPreferences.channels.appointmentReminders}
                onChange={(channels) => handleChannelChange('appointmentReminders', channels)}
                compact
              />
              
              <NotificationChannelSelector
                title="Medication Refills"
                channels={localPreferences.channels.medicationRefills}
                onChange={(channels) => handleChannelChange('medicationRefills', channels)}
                compact
              />
              
              <NotificationChannelSelector
                title="Clinical Follow-ups"
                channels={localPreferences.channels.clinicalFollowups}
                onChange={(channels) => handleChannelChange('clinicalFollowups', channels)}
                compact
              />
              
              <NotificationChannelSelector
                title="General Notifications"
                channels={localPreferences.channels.generalNotifications}
                onChange={(channels) => handleChannelChange('generalNotifications', channels)}
                compact
              />
            </Stack>
          </Box>

          {/* Save button */}
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              disabled={updatePreferencesMutation.isPending}
            >
              Refresh
            </Button>
            
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!hasChanges || updatePreferencesMutation.isPending}
            >
              {updatePreferencesMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Stack>
      </Collapse>
    </Box>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default PatientNotificationPreferences;