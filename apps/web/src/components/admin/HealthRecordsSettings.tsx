import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Grid,
    Alert,
    CircularProgress,
    Button,
    Divider,
    Chip,
    Paper,
    Stack,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteOutlinedIcon from '@mui/icons-material/FavoriteOutlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { apiHelpers } from '../../utils/apiHelpers';

interface HealthRecordsFeatures {
    labResults: boolean;
    vitalsTracking: boolean;
    visitHistory: boolean;
    downloadRecords: boolean;
    vitalsVerification: boolean;
    visitSummaries: boolean;
}

interface FeatureConfig {
    key: keyof HealthRecordsFeatures;
    label: string;
    description: string;
    icon: React.ReactElement;
    category: 'Core' | 'Enhanced';
}

const featureConfigs: FeatureConfig[] = [
    {
        key: 'labResults',
        label: 'Lab Results',
        description: 'Allow patients to view their laboratory test results',
        icon: <ScienceIcon />,
        category: 'Core',
    },
    {
        key: 'vitalsTracking',
        label: 'Vitals Tracking',
        description: 'Enable patients to log and track their vital signs',
        icon: <FavoriteOutlinedIcon />,
        category: 'Core',
    },
    {
        key: 'visitHistory',
        label: 'Visit History',
        description: 'Show patients their past consultation records',
        icon: <EventNoteIcon />,
        category: 'Core',
    },
    {
        key: 'downloadRecords',
        label: 'Download Records',
        description: 'Allow patients to download their medical records as PDF',
        icon: <DownloadIcon />,
        category: 'Core',
    },
    {
        key: 'vitalsVerification',
        label: 'Vitals Verification',
        description: 'Show pharmacist verification status on patient vitals',
        icon: <FavoriteOutlinedIcon />,
        category: 'Enhanced',
    },
    {
        key: 'visitSummaries',
        label: 'Visit Summaries',
        description: 'Display pharmacist-written summaries for consultations',
        icon: <EventNoteIcon />,
        category: 'Enhanced',
    },
];

const HealthRecordsSettings: React.FC = () => {
    const [features, setFeatures] = useState<HealthRecordsFeatures | null>(null);
    const [workplaceName, setWorkplaceName] = useState('');
    const [patientPortalEnabled, setPatientPortalEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiHelpers.get('/api/workplace/health-records-features');

            if (response.success) {
                setFeatures(response.data.features);
                setWorkplaceName(response.data.workplaceName);
                setPatientPortalEnabled(response.data.patientPortalEnabled);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch health records settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFeature = async (featureKey: keyof HealthRecordsFeatures) => {
        if (!features) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await apiHelpers.put(
                `/api/workplace/health-records-features/${featureKey}/toggle`,
                {}
            );

            if (response.success) {
                setFeatures(response.data.allFeatures);
                setSuccess(response.message);
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to toggle feature');
        } finally {
            setSaving(false);
        }
    };

    const handleResetToDefault = async () => {
        if (!window.confirm('Reset all features to default (all enabled)?')) {
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await apiHelpers.post(
                '/api/workplace/health-records-features/reset',
                {}
            );

            if (response.success) {
                setFeatures(response.data.features);
                setSuccess(response.message);
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to reset features');
        } finally {
            setSaving(false);
        }
    };

    const getEnabledCount = () => {
        if (!features) return 0;
        return Object.values(features).filter(Boolean).length;
    };

    const getCategoryFeatures = (category: 'Core' | 'Enhanced') => {
        return featureConfigs.filter((config) => config.category === category);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!patientPortalEnabled) {
        return (
            <Alert severity="warning">
                Patient Portal is disabled for this workplace. Enable it first to configure health
                records features.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom>
                    Patient Health Records Settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Control which health records features are available to patients in your workplace.
                </Typography>
                {workplaceName && (
                    <Chip
                        label={workplaceName}
                        color="primary"
                        size="small"
                        sx={{ mt: 1 }}
                    />
                )}
            </Box>

            {/* Status and Actions */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Status: {getEnabledCount()} of {featureConfigs.length} features enabled
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            startIcon={<RefreshIcon />}
                            onClick={fetchFeatures}
                            disabled={saving}
                        >
                            Refresh
                        </Button>
                        <Button
                            size="small"
                            startIcon={<RestartAltIcon />}
                            onClick={handleResetToDefault}
                            disabled={saving}
                            color="warning"
                        >
                            Reset to Default
                        </Button>
                    </Stack>
                </Box>
            </Paper>

            {/* Alerts */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Core Features */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Core Features
                        <Chip label="Essential" size="small" color="primary" />
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Basic health records functionality for patient portal
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                        {getCategoryFeatures('Core').map((config) => (
                            <Grid item xs={12} md={6} key={config.key}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        bgcolor: features?.[config.key] ? 'primary.50' : 'grey.50',
                                        borderColor: features?.[config.key] ? 'primary.main' : 'grey.300',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                                            <Box sx={{ color: features?.[config.key] ? 'primary.main' : 'text.secondary' }}>
                                                {config.icon}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    {config.label}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {config.description}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={features?.[config.key] || false}
                                                    onChange={() => handleToggleFeature(config.key)}
                                                    disabled={saving}
                                                    color="primary"
                                                />
                                            }
                                            label=""
                                            sx={{ ml: 1 }}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Enhanced Features */}
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Enhanced Features
                        <Chip label="Advanced" size="small" color="secondary" />
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Additional patient-friendly features with pharmacist oversight
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                        {getCategoryFeatures('Enhanced').map((config) => (
                            <Grid item xs={12} md={6} key={config.key}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        bgcolor: features?.[config.key] ? 'secondary.50' : 'grey.50',
                                        borderColor: features?.[config.key] ? 'secondary.main' : 'grey.300',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                                            <Box sx={{ color: features?.[config.key] ? 'secondary.main' : 'text.secondary' }}>
                                                {config.icon}
                                            </Box>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    {config.label}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {config.description}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={features?.[config.key] || false}
                                                    onChange={() => handleToggleFeature(config.key)}
                                                    disabled={saving}
                                                    color="secondary"
                                                />
                                            }
                                            label=""
                                            sx={{ ml: 1 }}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Info Box */}
            <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                    <strong>Note:</strong> Disabling a feature will hide it from the patient portal immediately.
                    Existing data is not deleted and will be visible again if the feature is re-enabled.
                </Typography>
            </Alert>
        </Box>
    );
};

export default HealthRecordsSettings;
