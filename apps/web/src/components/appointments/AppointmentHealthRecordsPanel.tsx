import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Tabs,
    Tab,
    Grid,
    Chip,
    Alert,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    List,
    ListItem,
    Badge,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { apiHelpers } from '../../utils/apiHelpers'; interface TabPanelProps {
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
            id={`health-records-tabpanel-${index}`}
            aria-labelledby={`health-records-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

interface AppointmentHealthRecordsPanelProps {
    appointmentId: string;
}

const AppointmentHealthRecordsPanel: React.FC<AppointmentHealthRecordsPanelProps> = ({
    appointmentId,
}) => {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [healthRecords, setHealthRecords] = useState<any>(null);

    useEffect(() => {
        if (appointmentId) {
            fetchHealthRecords();
        }
    }, [appointmentId]);

    const fetchHealthRecords = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiHelpers.get(
                `/api/appointments/${appointmentId}/health-records`
            );
            setHealthRecords(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load health records');
            console.error('Error fetching appointment health records:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    }; if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
        );
    }

    if (!healthRecords || healthRecords.summary.totalRecords === 0) {
        return (
            <Alert severity="info">
                No health records have been created for this appointment yet.
            </Alert>
        );
    }

    const { summary, labResults, visits, vitals } = healthRecords;

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" component="h2">
                        Health Records
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                            icon={<ScienceIcon fontSize="small" />}
                            label={`${summary.labResults} Lab Result${summary.labResults !== 1 ? 's' : ''}`}
                            size="small"
                            color={summary.labResults > 0 ? 'primary' : 'default'}
                        />
                        <Chip
                            icon={<FavoriteIcon fontSize="small" />}
                            label={`${summary.vitals} Vital${summary.vitals !== 1 ? 's' : ''}`}
                            size="small"
                            color={summary.vitals > 0 ? 'error' : 'default'}
                        />
                        <Chip
                            icon={<EventNoteIcon fontSize="small" />}
                            label={`${summary.visits} Visit${summary.visits !== 1 ? 's' : ''}`}
                            size="small"
                            color={summary.visits > 0 ? 'success' : 'default'}
                        />
                    </Box>
                </Box>

                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="health records tabs"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab
                        label={
                            <Badge badgeContent={summary.labResults} color="primary">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                                    <ScienceIcon fontSize="small" />
                                    Lab Results
                                </Box>
                            </Badge>
                        }
                    />
                    <Tab
                        label={
                            <Badge badgeContent={summary.vitals} color="error">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                                    <FavoriteIcon fontSize="small" />
                                    Vitals
                                </Box>
                            </Badge>
                        }
                    />
                    <Tab
                        label={
                            <Badge badgeContent={summary.visits} color="success">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
                                    <EventNoteIcon fontSize="small" />
                                    Visit Notes
                                </Box>
                            </Badge>
                        }
                    />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    {labResults && labResults.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {labResults.map((labResult: any) => (
                                <Accordion key={labResult._id} defaultExpanded>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="medium">
                                                    Case ID: {labResult.caseId}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {new Date(labResult.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                <Chip
                                                    label={labResult.status}
                                                    size="small"
                                                    color={labResult.status === 'completed' ? 'success' : 'warning'}
                                                />
                                                {labResult.data.hasInterpretation && (
                                                    <Chip
                                                        icon={<CheckCircleIcon fontSize="small" />}
                                                        label="Has Interpretation"
                                                        size="small"
                                                        color="primary"
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Lab Results:
                                        </Typography>
                                        {labResult.labResults && labResult.labResults.length > 0 ? (
                                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                                {labResult.labResults.map((test: any, idx: number) => (
                                                    <Grid item xs={12} sm={6} key={idx}>
                                                        <Card variant="outlined">
                                                            <CardContent sx={{ py: 1.5 }}>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {test.testName}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Value:
                                                                    </Typography>
                                                                    <Typography
                                                                        variant="body2"
                                                                        fontWeight="medium"
                                                                        color={test.abnormal ? 'error.main' : 'success.main'}
                                                                    >
                                                                        {test.value}
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Reference:
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        {test.referenceRange}
                                                                    </Typography>
                                                                </Box>
                                                                {test.abnormal && (
                                                                    <Chip
                                                                        icon={<WarningIcon fontSize="small" />}
                                                                        label="Abnormal"
                                                                        size="small"
                                                                        color="error"
                                                                        sx={{ mt: 1 }}
                                                                    />
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No lab results available
                                            </Typography>
                                        )}

                                        {labResult.data.hasInterpretation && labResult.data.isVisibleToPatient && (
                                            <Box
                                                sx={{
                                                    mt: 2,
                                                    p: 2,
                                                    bgcolor: 'primary.50',
                                                    borderRadius: 1,
                                                    borderLeft: 4,
                                                    borderColor: 'primary.main',
                                                }}
                                            >
                                                <Typography variant="subtitle2" color="primary" gutterBottom>
                                                    📋 Patient Interpretation Available
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    A patient-friendly interpretation has been added by the pharmacist.
                                                </Typography>
                                            </Box>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Box>
                    ) : (
                        <Alert severity="info">No lab results recorded for this appointment.</Alert>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {vitals && vitals.length > 0 ? (
                        <List>
                            {vitals.map((vital: any, idx: number) => (
                                <React.Fragment key={idx}>
                                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {new Date(vital.recordedDate).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Typography>
                                            <Chip
                                                icon={vital.isVerified ? <CheckCircleIcon fontSize="small" /> : undefined}
                                                label={vital.isVerified ? 'Verified' : 'Pending Verification'}
                                                size="small"
                                                color={vital.isVerified ? 'success' : 'warning'}
                                                variant={vital.isVerified ? 'filled' : 'outlined'}
                                            />
                                        </Box>

                                        <Grid container spacing={2}>
                                            {vital.bloodPressure && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Blood Pressure
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg
                                                    </Typography>
                                                </Grid>
                                            )}
                                            {vital.heartRate && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Heart Rate
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.heartRate} bpm
                                                    </Typography>
                                                </Grid>
                                            )}
                                            {vital.temperature && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Temperature
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.temperature}°C
                                                    </Typography>
                                                </Grid>
                                            )}
                                            {vital.weight && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Weight
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.weight} kg
                                                    </Typography>
                                                </Grid>
                                            )}
                                            {vital.glucose && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Glucose
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.glucose} mg/dL
                                                    </Typography>
                                                </Grid>
                                            )}
                                            {vital.oxygenSaturation && (
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        O2 Saturation
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {vital.oxygenSaturation}%
                                                    </Typography>
                                                </Grid>
                                            )}
                                        </Grid>

                                        {vital.notes && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                                Note: {vital.notes}
                                            </Typography>
                                        )}
                                    </ListItem>
                                    {idx < vitals.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    ) : (
                        <Alert severity="info">No vitals recorded for this appointment.</Alert>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    {visits && visits.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {visits.map((visit: any) => (
                                <Card key={visit._id} variant="outlined">
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="medium">
                                                    {visit.visitType || 'Consultation'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {new Date(visit.date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </Typography>
                                            </Box>
                                            {visit.data.hasSummary && (
                                                <Chip
                                                    icon={<CheckCircleIcon fontSize="small" />}
                                                    label={visit.data.isSummaryVisible ? 'Summary Visible' : 'Summary Available'}
                                                    size="small"
                                                    color={visit.data.isSummaryVisible ? 'success' : 'default'}
                                                />
                                            )}
                                        </Box>

                                        {visit.data.chiefComplaint && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                                    Chief Complaint:
                                                </Typography>
                                                <Typography variant="body2">{visit.data.chiefComplaint}</Typography>
                                            </Box>
                                        )}

                                        {visit.data.assessment && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                                    Assessment:
                                                </Typography>
                                                <Typography variant="body2">{visit.data.assessment}</Typography>
                                            </Box>
                                        )}

                                        {visit.data.hasSummary && visit.data.isSummaryVisible && (
                                            <Box
                                                sx={{
                                                    mt: 2,
                                                    p: 2,
                                                    bgcolor: 'success.50',
                                                    borderRadius: 1,
                                                    borderLeft: 4,
                                                    borderColor: 'success.main',
                                                }}
                                            >
                                                <Typography variant="caption" color="success.dark" fontWeight="medium">
                                                    📝 Patient summary has been made visible to the patient
                                                </Typography>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Alert severity="info">No visit notes recorded for this appointment.</Alert>
                    )}
                </TabPanel>
            </CardContent>
        </Card>
    );
};

export default AppointmentHealthRecordsPanel;
