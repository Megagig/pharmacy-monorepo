import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Chip,
    IconButton,
    Alert,
    Divider,
    Stack,
    Paper,
    Switch,
    FormControlLabel,
    CircularProgress,
    Tabs,
    Tab,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PreviewIcon from '@mui/icons-material/Preview';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { apiHelpers } from '../../utils/apiHelpers';

interface LabInterpretationData {
    summary: string;
    keyFindings: string[];
    whatThisMeans: string;
    recommendations: string[];
    whenToSeekCare: string;
    visibleToPatient: boolean;
}

interface LabInterpretationDialogProps {
    open: boolean;
    onClose: () => void;
    caseId: string;
    patientName?: string;
    existingInterpretation?: LabInterpretationData | null;
    onSuccess?: () => void;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`interpretation-tabpanel-${index}`}
            aria-labelledby={`interpretation-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

const LabInterpretationDialog: React.FC<LabInterpretationDialogProps> = ({
    open,
    onClose,
    caseId,
    patientName,
    existingInterpretation,
    onSuccess,
}) => {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState<LabInterpretationData>({
        summary: '',
        keyFindings: [],
        whatThisMeans: '',
        recommendations: [],
        whenToSeekCare: '',
        visibleToPatient: false,
    });

    const [tempKeyFinding, setTempKeyFinding] = useState('');
    const [tempRecommendation, setTempRecommendation] = useState('');

    useEffect(() => {
        if (existingInterpretation) {
            setFormData(existingInterpretation);
        } else {
            // Reset form
            setFormData({
                summary: '',
                keyFindings: [],
                whatThisMeans: '',
                recommendations: [],
                whenToSeekCare: '',
                visibleToPatient: false,
            });
        }
        setError(null);
        setSuccess(null);
        setTabValue(0);
    }, [open, existingInterpretation]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleAddKeyFinding = () => {
        if (tempKeyFinding.trim() && formData.keyFindings.length < 10) {
            setFormData((prev) => ({
                ...prev,
                keyFindings: [...prev.keyFindings, tempKeyFinding.trim()],
            }));
            setTempKeyFinding('');
        }
    };

    const handleRemoveKeyFinding = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            keyFindings: prev.keyFindings.filter((_, i) => i !== index),
        }));
    };

    const handleAddRecommendation = () => {
        if (tempRecommendation.trim() && formData.recommendations.length < 15) {
            setFormData((prev) => ({
                ...prev,
                recommendations: [...prev.recommendations, tempRecommendation.trim()],
            }));
            setTempRecommendation('');
        }
    };

    const handleRemoveRecommendation = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            recommendations: prev.recommendations.filter((_, i) => i !== index),
        }));
    };

    const validateForm = (): boolean => {
        if (!formData.summary.trim()) {
            setError('Summary is required');
            return false;
        }
        if (formData.summary.length > 500) {
            setError('Summary must be 500 characters or less');
            return false;
        }
        if (formData.keyFindings.length === 0) {
            setError('At least one key finding is required');
            return false;
        }
        if (!formData.whatThisMeans.trim()) {
            setError('"What This Means" section is required');
            return false;
        }
        if (formData.whatThisMeans.length > 1000) {
            setError('"What This Means" section must be 1000 characters or less');
            return false;
        }
        if (formData.recommendations.length === 0) {
            setError('At least one recommendation is required');
            return false;
        }
        if (!formData.whenToSeekCare.trim()) {
            setError('"When to Seek Care" section is required');
            return false;
        }
        if (formData.whenToSeekCare.length > 500) {
            setError('"When to Seek Care" section must be 500 characters or less');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            await apiHelpers.post(`/pharmacist/lab-results/${caseId}/interpretation`, formData);

            setSuccess('Interpretation saved successfully!');
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save interpretation');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleVisibility = async () => {
        setLoading(true);
        setError(null);

        try {
            await apiHelpers.put(`/pharmacist/lab-results/${caseId}/visibility`, {
                visibleToPatient: !formData.visibleToPatient,
            });

            setFormData((prev) => ({
                ...prev,
                visibleToPatient: !prev.visibleToPatient,
            }));

            setSuccess(
                `Interpretation is now ${!formData.visibleToPatient ? 'visible' : 'hidden'} to patient`
            );

            setTimeout(() => {
                onSuccess?.();
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update visibility');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h6">
                            {existingInterpretation ? 'Edit' : 'Add'} Patient-Friendly Interpretation
                        </Typography>
                        {patientName && (
                            <Typography variant="caption" color="text.secondary">
                                For: {patientName}
                            </Typography>
                        )}
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <Tabs value={tabValue} onChange={handleTabChange} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Edit" icon={<SaveIcon />} iconPosition="start" />
                <Tab label="Preview" icon={<PreviewIcon />} iconPosition="start" />
            </Tabs>

            <DialogContent dividers>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {success}
                    </Alert>
                )}

                <TabPanel value={tabValue} index={0}>
                    {/* EDIT MODE */}
                    <Stack spacing={3}>
                        {/* Summary */}
                        <Box>
                            <TextField
                                fullWidth
                                label="Brief Summary"
                                placeholder="Example: Your test results are generally good with a few minor concerns we should monitor."
                                multiline
                                rows={2}
                                value={formData.summary}
                                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                helperText={`${formData.summary.length}/500 characters`}
                                inputProps={{ maxLength: 500 }}
                            />
                        </Box>

                        {/* Key Findings */}
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Key Findings (max 10)
                            </Typography>
                            <Box display="flex" gap={1} mb={1}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Add a key finding..."
                                    value={tempKeyFinding}
                                    onChange={(e) => setTempKeyFinding(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddKeyFinding();
                                        }
                                    }}
                                    disabled={formData.keyFindings.length >= 10}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddKeyFinding}
                                    disabled={!tempKeyFinding.trim() || formData.keyFindings.length >= 10}
                                    startIcon={<AddIcon />}
                                >
                                    Add
                                </Button>
                            </Box>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {formData.keyFindings.map((finding, index) => (
                                    <Chip
                                        key={index}
                                        label={finding}
                                        onDelete={() => handleRemoveKeyFinding(index)}
                                        color="primary"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* What This Means */}
                        <Box>
                            <TextField
                                fullWidth
                                label="What This Means (Patient-Friendly Explanation)"
                                placeholder="Explain the results in simple terms the patient can understand..."
                                multiline
                                rows={4}
                                value={formData.whatThisMeans}
                                onChange={(e) => setFormData({ ...formData, whatThisMeans: e.target.value })}
                                helperText={`${formData.whatThisMeans.length}/1000 characters`}
                                inputProps={{ maxLength: 1000 }}
                            />
                        </Box>

                        {/* Recommendations */}
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Recommendations (max 15)
                            </Typography>
                            <Box display="flex" gap={1} mb={1}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Add a recommendation..."
                                    value={tempRecommendation}
                                    onChange={(e) => setTempRecommendation(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddRecommendation();
                                        }
                                    }}
                                    disabled={formData.recommendations.length >= 15}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleAddRecommendation}
                                    disabled={!tempRecommendation.trim() || formData.recommendations.length >= 15}
                                    startIcon={<AddIcon />}
                                >
                                    Add
                                </Button>
                            </Box>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                                {formData.recommendations.map((rec, index) => (
                                    <Chip
                                        key={index}
                                        label={rec}
                                        onDelete={() => handleRemoveRecommendation(index)}
                                        color="success"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* When to Seek Care */}
                        <Box>
                            <TextField
                                fullWidth
                                label="When to Seek Care"
                                placeholder="Example: Contact your healthcare provider if you experience persistent headaches, dizziness, or unusual fatigue."
                                multiline
                                rows={3}
                                value={formData.whenToSeekCare}
                                onChange={(e) => setFormData({ ...formData, whenToSeekCare: e.target.value })}
                                helperText={`${formData.whenToSeekCare.length}/500 characters`}
                                inputProps={{ maxLength: 500 }}
                            />
                        </Box>
                    </Stack>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {/* PREVIEW MODE */}
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom color="primary">
                            📋 Your Lab Results Interpretation
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Box mb={3}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Summary
                            </Typography>
                            <Typography variant="body1">{formData.summary || 'No summary provided'}</Typography>
                        </Box>

                        <Box mb={3}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                🔍 Key Findings
                            </Typography>
                            {formData.keyFindings.length > 0 ? (
                                <ul style={{ marginTop: 8 }}>
                                    {formData.keyFindings.map((finding, index) => (
                                        <li key={index}>
                                            <Typography variant="body2">{finding}</Typography>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No key findings provided
                                </Typography>
                            )}
                        </Box>

                        <Box mb={3}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                💡 What This Means
                            </Typography>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                {formData.whatThisMeans || 'No explanation provided'}
                            </Typography>
                        </Box>

                        <Box mb={3}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                ✅ Recommendations
                            </Typography>
                            {formData.recommendations.length > 0 ? (
                                <ul style={{ marginTop: 8 }}>
                                    {formData.recommendations.map((rec, index) => (
                                        <li key={index}>
                                            <Typography variant="body2">{rec}</Typography>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No recommendations provided
                                </Typography>
                            )}
                        </Box>

                        <Box mb={2}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                ⚠️ When to Seek Care
                            </Typography>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                {formData.whenToSeekCare || 'No guidance provided'}
                            </Typography>
                        </Box>
                    </Paper>
                </TabPanel>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                    <FormControlLabel
                        control={
                            <Switch
                                checked={formData.visibleToPatient}
                                onChange={handleToggleVisibility}
                                disabled={loading || !existingInterpretation}
                            />
                        }
                        label={
                            <Box display="flex" alignItems="center" gap={1}>
                                {formData.visibleToPatient ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                <Typography variant="body2">
                                    {formData.visibleToPatient ? 'Visible to Patient' : 'Hidden from Patient'}
                                </Typography>
                            </Box>
                        }
                    />

                    <Box display="flex" gap={1}>
                        <Button onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                        >
                            {loading ? 'Saving...' : 'Save Interpretation'}
                        </Button>
                    </Box>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default LabInterpretationDialog;
