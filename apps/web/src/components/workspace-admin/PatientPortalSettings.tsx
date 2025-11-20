/**
 * PatientPortalSettings Component
 * Configuration settings for the patient portal
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { usePatientPortalAdmin } from '../../hooks/usePatientPortalAdmin';

interface PortalSettings {
  general: {
    portalEnabled: boolean;
    requireApproval: boolean;
    allowSelfRegistration: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  features: {
    appointments: boolean;
    messaging: boolean;
    refillRequests: boolean;
    healthRecords: boolean;
    billing: boolean;
    labResults: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    whatsappNotifications: boolean;
    appointmentReminders: boolean;
    refillReminders: boolean;
    labResultNotifications: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    passwordComplexity: 'low' | 'medium' | 'high';
    sessionEncryption: boolean;
    auditLogging: boolean;
  };
  customization: {
    portalTitle: string;
    welcomeMessage: string;
    supportEmail: string;
    supportPhone: string;
    primaryColor: string;
    logoUrl: string;
  };
  businessHours: Array<{
    day: string;
    enabled: boolean;
    openTime: string;
    closeTime: string;
  }>;
}

interface PatientPortalSettingsProps {
  onShowSnackbar: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
  workspaceId?: string; // Optional workspace ID for super admin override
}

const PatientPortalSettings: React.FC<PatientPortalSettingsProps> = ({ onShowSnackbar, workspaceId }) => {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [businessHoursDialog, setBusinessHoursDialog] = useState(false);

  // Fetch current settings
  const {
    data: currentSettings,
    isLoading,
    error,
  } = usePatientPortalAdmin(workspaceId).usePortalSettings();

  // Mutation hooks
  const { mutate: updateSettings, isPending: isUpdating } = usePatientPortalAdmin(workspaceId).useUpdatePortalSettings();
  const { mutate: resetSettings, isPending: isResetting } = usePatientPortalAdmin(workspaceId).useResetPortalSettings();

  // Initialize settings when data loads
  React.useEffect(() => {
    if (currentSettings && !settings) {
      setSettings(currentSettings);
    }
  }, [currentSettings, settings]);

  /**
   * Handle setting change
   */
  const handleSettingChange = (section: keyof PortalSettings, key: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  /**
   * Handle business hours change
   */
  const handleBusinessHoursChange = (index: number, field: string, value: any) => {
    if (!settings) return;

    const updatedHours = [...settings.businessHours];
    updatedHours[index] = {
      ...updatedHours[index],
      [field]: value,
    };

    setSettings({
      ...settings,
      businessHours: updatedHours,
    });
    setHasChanges(true);
  };

  /**
   * Handle save settings
   */
  const handleSaveSettings = () => {
    if (!settings) return;

    updateSettings(settings, {
      onSuccess: () => {
        onShowSnackbar('Portal settings updated successfully', 'success');
        setHasChanges(false);
      },
      onError: (error: any) => {
        onShowSnackbar(error.response?.data?.message || 'Failed to update settings', 'error');
      },
    });
  };

  /**
   * Handle reset settings
   */
  const handleResetSettings = () => {
    resetSettings(undefined, {
      onSuccess: () => {
        onShowSnackbar('Portal settings reset to defaults', 'success');
        setHasChanges(false);
        // Refetch settings
        window.location.reload();
      },
      onError: (error: any) => {
        onShowSnackbar(error.response?.data?.message || 'Failed to reset settings', 'error');
      },
    });
  };

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load portal settings
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  // Loading state
  if (isLoading || !settings) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Actions */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          Portal Settings
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={handleResetSettings}
            disabled={isResetting}
          >
            Reset to Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveSettings}
            disabled={!hasChanges || isUpdating}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have unsaved changes. Don't forget to save your settings.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* General Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="General Settings" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.general.portalEnabled}
                      onChange={(e) => handleSettingChange('general', 'portalEnabled', e.target.checked)}
                    />
                  }
                  label="Enable Patient Portal"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.general.requireApproval}
                      onChange={(e) => handleSettingChange('general', 'requireApproval', e.target.checked)}
                    />
                  }
                  label="Require Admin Approval for New Users"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.general.allowSelfRegistration}
                      onChange={(e) => handleSettingChange('general', 'allowSelfRegistration', e.target.checked)}
                    />
                  }
                  label="Allow Self Registration"
                />
                <TextField
                  label="Session Timeout (minutes)"
                  type="number"
                  value={settings.general.sessionTimeout}
                  onChange={(e) => handleSettingChange('general', 'sessionTimeout', parseInt(e.target.value))}
                  size="small"
                />
                <TextField
                  label="Max Login Attempts"
                  type="number"
                  value={settings.general.maxLoginAttempts}
                  onChange={(e) => handleSettingChange('general', 'maxLoginAttempts', parseInt(e.target.value))}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Feature Settings" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.appointments}
                      onChange={(e) => handleSettingChange('features', 'appointments', e.target.checked)}
                    />
                  }
                  label="Appointment Booking"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.messaging}
                      onChange={(e) => handleSettingChange('features', 'messaging', e.target.checked)}
                    />
                  }
                  label="Secure Messaging"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.refillRequests}
                      onChange={(e) => handleSettingChange('features', 'refillRequests', e.target.checked)}
                    />
                  }
                  label="Refill Requests"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.healthRecords}
                      onChange={(e) => handleSettingChange('features', 'healthRecords', e.target.checked)}
                    />
                  }
                  label="Health Records Access"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.billing}
                      onChange={(e) => handleSettingChange('features', 'billing', e.target.checked)}
                    />
                  }
                  label="Billing & Payments"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.features.labResults}
                      onChange={(e) => handleSettingChange('features', 'labResults', e.target.checked)}
                    />
                  }
                  label="Lab Results"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Notification Settings" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                    />
                  }
                  label="Email Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.smsNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'smsNotifications', e.target.checked)}
                    />
                  }
                  label="SMS Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.whatsappNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'whatsappNotifications', e.target.checked)}
                    />
                  }
                  label="WhatsApp Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.appointmentReminders}
                      onChange={(e) => handleSettingChange('notifications', 'appointmentReminders', e.target.checked)}
                    />
                  }
                  label="Appointment Reminders"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.refillReminders}
                      onChange={(e) => handleSettingChange('notifications', 'refillReminders', e.target.checked)}
                    />
                  }
                  label="Refill Reminders"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.labResultNotifications}
                      onChange={(e) => handleSettingChange('notifications', 'labResultNotifications', e.target.checked)}
                    />
                  }
                  label="Lab Result Notifications"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Security Settings" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.twoFactorAuth}
                      onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
                    />
                  }
                  label="Two-Factor Authentication"
                />
                <FormControl size="small">
                  <InputLabel>Password Complexity</InputLabel>
                  <Select
                    value={settings.security.passwordComplexity}
                    label="Password Complexity"
                    onChange={(e) => handleSettingChange('security', 'passwordComplexity', e.target.value)}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.sessionEncryption}
                      onChange={(e) => handleSettingChange('security', 'sessionEncryption', e.target.checked)}
                    />
                  }
                  label="Session Encryption"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.security.auditLogging}
                      onChange={(e) => handleSettingChange('security', 'auditLogging', e.target.checked)}
                    />
                  }
                  label="Audit Logging"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Customization Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Portal Customization" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Portal Title"
                    value={settings.customization.portalTitle}
                    onChange={(e) => handleSettingChange('customization', 'portalTitle', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Primary Color"
                    type="color"
                    value={settings.customization.primaryColor}
                    onChange={(e) => handleSettingChange('customization', 'primaryColor', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Welcome Message"
                    multiline
                    rows={3}
                    value={settings.customization.welcomeMessage}
                    onChange={(e) => handleSettingChange('customization', 'welcomeMessage', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Support Email"
                    type="email"
                    value={settings.customization.supportEmail}
                    onChange={(e) => handleSettingChange('customization', 'supportEmail', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Support Phone"
                    value={settings.customization.supportPhone}
                    onChange={(e) => handleSettingChange('customization', 'supportPhone', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Logo URL"
                    value={settings.customization.logoUrl}
                    onChange={(e) => handleSettingChange('customization', 'logoUrl', e.target.value)}
                    size="small"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Business Hours */}
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Business Hours"
              action={
                <Button
                  startIcon={<EditIcon />}
                  onClick={() => setBusinessHoursDialog(true)}
                >
                  Edit Hours
                </Button>
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                {settings.businessHours.map((hours, index) => (
                  <Grid item xs={12} sm={6} md={4} key={hours.day}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 80 }}>
                        {hours.day}:
                      </Typography>
                      {hours.enabled ? (
                        <Chip
                          label={`${hours.openTime} - ${hours.closeTime}`}
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          label="Closed"
                          color="default"
                          size="small"
                        />
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Business Hours Dialog */}
      <Dialog
        open={businessHoursDialog}
        onClose={() => setBusinessHoursDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Business Hours</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {settings.businessHours.map((hours, index) => (
              <Box key={hours.day} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 80 }}>
                  {hours.day}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hours.enabled}
                      onChange={(e) => handleBusinessHoursChange(index, 'enabled', e.target.checked)}
                    />
                  }
                  label="Open"
                />
                {hours.enabled && (
                  <>
                    <TextField
                      type="time"
                      label="Open"
                      value={hours.openTime}
                      onChange={(e) => handleBusinessHoursChange(index, 'openTime', e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="time"
                      label="Close"
                      value={hours.closeTime}
                      onChange={(e) => handleBusinessHoursChange(index, 'closeTime', e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBusinessHoursDialog(false)}>Cancel</Button>
          <Button onClick={() => setBusinessHoursDialog(false)} variant="contained">
            Save Hours
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientPortalSettings;