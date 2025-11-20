// @ts-nocheck - Grid item prop type definition issue in MUI v7
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    TextField,
    Button,
    Typography,
    Divider,
    MenuItem,
    CircularProgress,
    Alert,
    FormControlLabel,
    Switch,
    Stack,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AutoModeIcon from '@mui/icons-material/SettingsBrightness';
import SaveIcon from '@mui/icons-material/Save';
import { useUserPreferences, useUpdateUserPreferences } from '../../queries/userSettingsQueries';
import { useThemeStore } from '../../stores/themeStore';

const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'pt', label: 'Portuguese' },
];

const timezones = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
];

const PreferencesTab: React.FC = () => {
    const { data: preferences, isLoading, error } = useUserPreferences();
    const updatePreferencesMutation = useUpdateUserPreferences();
    const { setTheme } = useThemeStore();

    const [formData, setFormData] = useState({
        themePreference: 'system' as 'light' | 'dark' | 'system',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h' as '12h' | '24h',
        notificationPreferences: {
            email: true,
            sms: false,
            push: true,
            followUpReminders: true,
            criticalAlerts: true,
            dailyDigest: false,
            weeklyReport: false,
        },
    });

    const [hasChanges, setHasChanges] = useState(false);

    React.useEffect(() => {
        if (preferences) {
            setFormData({
                themePreference: preferences.themePreference || 'system',
                language: preferences.language || 'en',
                timezone: preferences.timezone || 'UTC',
                dateFormat: preferences.dateFormat || 'DD/MM/YYYY',
                timeFormat: preferences.timeFormat || '12h',
                notificationPreferences: preferences.notificationPreferences || {
                    email: true,
                    sms: false,
                    push: true,
                    followUpReminders: true,
                    criticalAlerts: true,
                    dailyDigest: false,
                    weeklyReport: false,
                },
            });
        }
    }, [preferences]);

    const handleThemeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newTheme: 'light' | 'dark' | 'system' | null
    ) => {
        if (newTheme !== null) {
            setFormData((prev) => ({ ...prev, themePreference: newTheme }));
            setHasChanges(true);
            // Update theme immediately for better UX
            setTheme(newTheme);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setHasChanges(true);
    };

    const handleNotificationChange = (key: string) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData((prev) => ({
            ...prev,
            notificationPreferences: {
                ...prev.notificationPreferences,
                [key]: event.target.checked,
            },
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        updatePreferencesMutation.mutate(formData, {
            onSuccess: () => {
                setHasChanges(false);
            },
        });
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load preferences. Please try again later.
            </Alert>
        );
    }

    return (
        <Box>
            <Stack spacing={3}>
                {/* Theme Settings */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Theme Preference
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Choose your preferred theme for the application
                        </Typography>

                        <ToggleButtonGroup
                            value={formData.themePreference}
                            exclusive
                            onChange={handleThemeChange}
                            aria-label="theme preference"
                            fullWidth
                            sx={{ mt: 2 }}
                        >
                            <ToggleButton value="light" aria-label="light theme">
                                <LightModeIcon sx={{ mr: 1 }} />
                                Light
                            </ToggleButton>
                            <ToggleButton value="dark" aria-label="dark theme">
                                <DarkModeIcon sx={{ mr: 1 }} />
                                Dark
                            </ToggleButton>
                            <ToggleButton value="system" aria-label="system theme">
                                <AutoModeIcon sx={{ mr: 1 }} />
                                System
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </CardContent>
                </Card>

                {/* Language & Region */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Language & Region
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Customize your language, timezone, and date/time formats
                        </Typography>

                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Language"
                                    name="language"
                                    value={formData.language}
                                    onChange={handleInputChange}
                                >
                                    {languages.map((lang) => (
                                        <MenuItem key={lang.value} value={lang.value}>
                                            {lang.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Timezone"
                                    name="timezone"
                                    value={formData.timezone}
                                    onChange={handleInputChange}
                                >
                                    {timezones.map((tz) => (
                                        <MenuItem key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Date Format"
                                    name="dateFormat"
                                    value={formData.dateFormat}
                                    onChange={handleInputChange}
                                >
                                    {dateFormats.map((format) => (
                                        <MenuItem key={format.value} value={format.value}>
                                            {format.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Time Format"
                                    name="timeFormat"
                                    value={formData.timeFormat}
                                    onChange={handleInputChange}
                                >
                                    <MenuItem value="12h">12-hour (3:30 PM)</MenuItem>
                                    <MenuItem value="24h">24-hour (15:30)</MenuItem>
                                </TextField>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Notification Preferences */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Notification Preferences
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Manage how you receive notifications
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Stack spacing={2}>
                            <Typography variant="subtitle2" fontWeight="bold">
                                Delivery Methods
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.email}
                                        onChange={handleNotificationChange('email')}
                                    />
                                }
                                label="Email Notifications"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.sms}
                                        onChange={handleNotificationChange('sms')}
                                    />
                                }
                                label="SMS Notifications"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.push}
                                        onChange={handleNotificationChange('push')}
                                    />
                                }
                                label="Push Notifications"
                            />

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" fontWeight="bold">
                                Notification Types
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.criticalAlerts}
                                        onChange={handleNotificationChange('criticalAlerts')}
                                    />
                                }
                                label="Critical Alerts"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.followUpReminders}
                                        onChange={handleNotificationChange('followUpReminders')}
                                    />
                                }
                                label="Follow-up Reminders"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.dailyDigest}
                                        onChange={handleNotificationChange('dailyDigest')}
                                    />
                                }
                                label="Daily Digest"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.notificationPreferences.weeklyReport}
                                        onChange={handleNotificationChange('weeklyReport')}
                                    />
                                }
                                label="Weekly Report"
                            />
                        </Stack>
                    </CardContent>
                </Card>

                {/* Save Button */}
                {hasChanges && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={updatePreferencesMutation.isPending}
                        >
                            {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                        </Button>
                    </Box>
                )}
            </Stack>
        </Box>
    );
};

export default PreferencesTab;
