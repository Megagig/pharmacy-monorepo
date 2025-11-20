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
    Tab,
    Tabs,
    Alert,
    CircularProgress,
    FormControlLabel,
    Switch,
    Divider,
    Paper,
    Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PreviewIcon from '@mui/icons-material/Preview';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { apiHelpers } from '../../utils/apiHelpers';

interface VisitSummaryDialogProps {
    open: boolean;
    onClose: () => void;
    visitId: string;
    onSuccess?: () => void;
}

interface PatientSummary {
    summary: string;
    keyPoints: string[];
    nextSteps: string[];
    visibleToPatient: boolean;
    summarizedBy?: {
        firstName: string;
        lastName: string;
    };
    summarizedAt?: string;
}

interface VisitData {
    visitId: string;
    visitDate: string;
    patient: {
        firstName: string;
        lastName: string;
        patientId: string;
    };
    createdBy: {
        firstName: string;
        lastName: string;
    };
    soap: {
        subjective?: string;
        objective?: string;
        assessment?: string;
        plan?: string;
    };
    patientSummary?: PatientSummary;
    hasSummary: boolean;
    isVisible: boolean;
}

const VisitSummaryDialog: React.FC<VisitSummaryDialogProps> = ({
    open,
    onClose,
    visitId,
    onSuccess,
}) => {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Visit data
    const [visitData, setVisitData] = useState<VisitData | null>(null);

    // Form state
    const [summary, setSummary] = useState('');
    const [keyPoints, setKeyPoints] = useState<string[]>(['']);
    const [nextSteps, setNextSteps] = useState<string[]>(['']);
    const [visibleToPatient, setVisibleToPatient] = useState(false);

    // Fetch visit data
    useEffect(() => {
        if (open && visitId) {
            fetchVisitData();
        }
    }, [open, visitId]);

    const fetchVisitData = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiHelpers.get(
                `/api/pharmacist/visit-summaries/${visitId}`
            );

            if (response.success) {
                setVisitData(response.data);

                // Populate form if summary exists
                if (response.data.patientSummary) {
                    setSummary(response.data.patientSummary.summary || '');
                    setKeyPoints(
                        response.data.patientSummary.keyPoints?.length > 0
                            ? response.data.patientSummary.keyPoints
                            : ['']
                    );
                    setNextSteps(
                        response.data.patientSummary.nextSteps?.length > 0
                            ? response.data.patientSummary.nextSteps
                            : ['']
                    );
                    setVisibleToPatient(response.data.patientSummary.visibleToPatient || false);
                } else {
                    // Reset form for new summary
                    setSummary('');
                    setKeyPoints(['']);
                    setNextSteps(['']);
                    setVisibleToPatient(false);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch visit data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddKeyPoint = () => {
        if (keyPoints.length < 10) {
            setKeyPoints([...keyPoints, '']);
        }
    };

    const handleRemoveKeyPoint = (index: number) => {
        const newKeyPoints = keyPoints.filter((_, i) => i !== index);
        setKeyPoints(newKeyPoints.length > 0 ? newKeyPoints : ['']);
    };

    const handleKeyPointChange = (index: number, value: string) => {
        const newKeyPoints = [...keyPoints];
        newKeyPoints[index] = value;
        setKeyPoints(newKeyPoints);
    };

    const handleAddNextStep = () => {
        if (nextSteps.length < 10) {
            setNextSteps([...nextSteps, '']);
        }
    };

    const handleRemoveNextStep = (index: number) => {
        const newNextSteps = nextSteps.filter((_, i) => i !== index);
        setNextSteps(newNextSteps.length > 0 ? newNextSteps : ['']);
    };

    const handleNextStepChange = (index: number, value: string) => {
        const newNextSteps = [...nextSteps];
        newNextSteps[index] = value;
        setNextSteps(newNextSteps);
    };

    const handleSave = async () => {
        if (!summary.trim()) {
            setError('Summary is required');
            return;
        }

        if (summary.length > 1000) {
            setError('Summary must not exceed 1000 characters');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Filter out empty key points and next steps
            const filteredKeyPoints = keyPoints.filter((kp) => kp.trim() !== '');
            const filteredNextSteps = nextSteps.filter((ns) => ns.trim() !== '');

            const response = await apiHelpers.post(
                `/api/pharmacist/visit-summaries/${visitId}`,
                {
                    summary: summary.trim(),
                    keyPoints: filteredKeyPoints,
                    nextSteps: filteredNextSteps,
                }
            );

            if (response.success) {
                setSuccess('Visit summary saved successfully');
                await fetchVisitData(); // Refresh data
                if (onSuccess) onSuccess();

                setTimeout(() => {
                    setSuccess('');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save visit summary');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleVisibility = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await apiHelpers.put(
                `/api/pharmacist/visit-summaries/${visitId}/visibility`,
                {
                    visible: !visibleToPatient,
                }
            );

            if (response.success) {
                setVisibleToPatient(!visibleToPatient);
                setSuccess(
                    `Visit summary ${!visibleToPatient ? 'made visible' : 'hidden'} to patient`
                );
                await fetchVisitData();
                if (onSuccess) onSuccess();

                setTimeout(() => {
                    setSuccess('');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to toggle visibility');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setActiveTab(0);
        setError('');
        setSuccess('');
        onClose();
    };

    const renderSOAPNotes = () => {
        if (!visitData?.soap) return null;

        return (
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    SOAP Notes (For Reference)
                </Typography>
                <Box sx={{ mt: 2 }}>
                    {visitData.soap.subjective && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" fontWeight="bold" color="primary">
                                Subjective:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {visitData.soap.subjective}
                            </Typography>
                        </Box>
                    )}
                    {visitData.soap.objective && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" fontWeight="bold" color="primary">
                                Objective:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {visitData.soap.objective}
                            </Typography>
                        </Box>
                    )}
                    {visitData.soap.assessment && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" fontWeight="bold" color="primary">
                                Assessment:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {visitData.soap.assessment}
                            </Typography>
                        </Box>
                    )}
                    {visitData.soap.plan && (
                        <Box>
                            <Typography variant="caption" fontWeight="bold" color="primary">
                                Plan:
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {visitData.soap.plan}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>
        );
    };

    const renderEditTab = () => {
        return (
            <Box>
                {renderSOAPNotes()}

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Patient-Friendly Summary"
                    placeholder="Write a clear, jargon-free summary of the visit that the patient can easily understand..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    helperText={`${summary.length}/1000 characters`}
                    error={summary.length > 1000}
                    sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" gutterBottom>
                    Key Points
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (Maximum 10, 300 characters each)
                    </Typography>
                </Typography>
                {keyPoints.map((keyPoint, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={`Key point ${index + 1}`}
                            value={keyPoint}
                            onChange={(e) => handleKeyPointChange(index, e.target.value)}
                            helperText={
                                keyPoint.length > 0 ? `${keyPoint.length}/300 characters` : ''
                            }
                            error={keyPoint.length > 300}
                        />
                        {keyPoints.length > 1 && (
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveKeyPoint(index)}
                            >
                                <DeleteIcon />
                            </IconButton>
                        )}
                    </Box>
                ))}
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddKeyPoint}
                    disabled={keyPoints.length >= 10}
                    sx={{ mb: 3 }}
                >
                    Add Key Point
                </Button>

                <Typography variant="subtitle2" gutterBottom>
                    Next Steps
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (Maximum 10, 300 characters each)
                    </Typography>
                </Typography>
                {nextSteps.map((nextStep, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={`Next step ${index + 1}`}
                            value={nextStep}
                            onChange={(e) => handleNextStepChange(index, e.target.value)}
                            helperText={
                                nextStep.length > 0 ? `${nextStep.length}/300 characters` : ''
                            }
                            error={nextStep.length > 300}
                        />
                        {nextSteps.length > 1 && (
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveNextStep(index)}
                            >
                                <DeleteIcon />
                            </IconButton>
                        )}
                    </Box>
                ))}
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddNextStep}
                    disabled={nextSteps.length >= 10}
                >
                    Add Next Step
                </Button>
            </Box>
        );
    };

    const renderPreviewTab = () => {
        const filteredKeyPoints = keyPoints.filter((kp) => kp.trim() !== '');
        const filteredNextSteps = nextSteps.filter((ns) => ns.trim() !== '');

        return (
            <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                    This is how the patient will see the visit summary.
                </Alert>

                <Paper elevation={1} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Visit Summary
                    </Typography>

                    {summary.trim() ? (
                        <Typography variant="body1" sx={{ mb: 3 }}>
                            {summary}
                        </Typography>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            No summary provided
                        </Typography>
                    )}

                    {filteredKeyPoints.length > 0 && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                                Key Points
                            </Typography>
                            <Stack spacing={1}>
                                {filteredKeyPoints.map((point, index) => (
                                    <Chip
                                        key={index}
                                        label={point}
                                        color="primary"
                                        variant="outlined"
                                        sx={{ height: 'auto', py: 1, '& .MuiChip-label': { whiteSpace: 'normal' } }}
                                    />
                                ))}
                            </Stack>
                        </>
                    )}

                    {filteredNextSteps.length > 0 && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" gutterBottom>
                                Next Steps
                            </Typography>
                            <Stack spacing={1}>
                                {filteredNextSteps.map((step, index) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                                            {index + 1}.
                                        </Typography>
                                        <Typography variant="body2">{step}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                        </>
                    )}

                    {!summary.trim() && filteredKeyPoints.length === 0 && filteredNextSteps.length === 0 && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            No content to display. Please fill in at least the summary in the Edit tab.
                        </Alert>
                    )}
                </Paper>
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Visit Summary</Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
                {visitData && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Patient: {visitData.patient?.firstName} {visitData.patient?.lastName} (
                            {visitData.patient?.patientId})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Visit Date: {new Date(visitData.visitDate).toLocaleDateString()}
                        </Typography>
                        {visitData.patientSummary?.summarizedBy && (
                            <Typography variant="body2" color="text.secondary">
                                Summarized by: {visitData.patientSummary.summarizedBy.firstName}{' '}
                                {visitData.patientSummary.summarizedBy.lastName}
                            </Typography>
                        )}
                    </Box>
                )}
            </DialogTitle>

            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
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

                        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                            <Tab icon={<EditIcon />} label="Edit" iconPosition="start" />
                            <Tab icon={<PreviewIcon />} label="Preview" iconPosition="start" />
                        </Tabs>

                        {activeTab === 0 && renderEditTab()}
                        {activeTab === 1 && renderPreviewTab()}
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', px: 2 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={visibleToPatient}
                                onChange={handleToggleVisibility}
                                disabled={saving || !visitData?.hasSummary}
                                icon={<VisibilityOffIcon />}
                                checkedIcon={<VisibilityIcon />}
                            />
                        }
                        label={
                            <Typography variant="body2">
                                {visibleToPatient ? 'Visible to Patient' : 'Hidden from Patient'}
                            </Typography>
                        }
                    />

                    <Box>
                        <Button onClick={handleClose} disabled={saving}>
                            Close
                        </Button>
                        <Button
                            onClick={handleSave}
                            variant="contained"
                            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                            disabled={saving || loading}
                        >
                            {saving ? 'Saving...' : 'Save Summary'}
                        </Button>
                    </Box>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default VisitSummaryDialog;
