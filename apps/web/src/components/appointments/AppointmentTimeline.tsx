import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Alert,
    CircularProgress,
    Chip,
    Paper,
} from '@mui/material';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineOppositeContent,
} from '@mui/lab';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { apiHelpers } from '../../utils/apiHelpers';

interface AppointmentTimelineProps {
    appointmentId: string;
}

const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({ appointmentId }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<any[]>([]);

    useEffect(() => {
        if (appointmentId) {
            fetchTimeline();
        }
    }, [appointmentId]);

    const fetchTimeline = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiHelpers.get(
                `/api/appointments/${appointmentId}/health-records`
            );
            setTimeline(response.data.timeline || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load timeline');
            console.error('Error fetching appointment timeline:', err);
        } finally {
            setLoading(false);
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'lab_result':
                return <ScienceIcon />;
            case 'vitals':
                return <FavoriteIcon />;
            case 'visit':
                return <EventNoteIcon />;
            default:
                return <DescriptionIcon />;
        }
    };

    const getEventColor = (type: string): 'primary' | 'error' | 'success' | 'warning' | 'info' | 'grey' => {
        switch (type) {
            case 'lab_result':
                return 'primary';
            case 'vitals':
                return 'error';
            case 'visit':
                return 'success';
            default:
                return 'grey';
        }
    };

    const getEventTitle = (event: any) => {
        switch (event.type) {
            case 'lab_result':
                return 'Lab Results Uploaded';
            case 'vitals':
                return 'Vitals Recorded';
            case 'visit':
                return 'Visit Notes Added';
            default:
                return 'Health Event';
        }
    };

    const getEventDescription = (event: any) => {
        switch (event.type) {
            case 'lab_result':
                const labCount = event.data.labResults?.length || 0;
                return `${labCount} test${labCount !== 1 ? 's' : ''} recorded • Case ${event.data.caseId}`;
            case 'vitals':
                const vitalTypes: string[] = [];
                if (event.data.bloodPressure) vitalTypes.push('BP');
                if (event.data.heartRate) vitalTypes.push('HR');
                if (event.data.temperature) vitalTypes.push('Temp');
                if (event.data.weight) vitalTypes.push('Weight');
                if (event.data.glucose) vitalTypes.push('Glucose');
                if (event.data.oxygenSaturation) vitalTypes.push('O2');
                return vitalTypes.join(', ') || 'Vitals recorded';
            case 'visit':
                return event.data.visitType || 'Consultation notes';
            default:
                return '';
        }
    };

    const getEventBadges = (event: any) => {
        const badges: React.ReactNode[] = [];

        if (event.type === 'lab_result') {
            if (event.data.hasInterpretation) {
                badges.push(
                    <Chip
                        key="interpretation"
                        icon={<DescriptionIcon fontSize="small" />}
                        label="Has Interpretation"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mr: 0.5 }}
                    />
                );
            }
            if (event.data.isVisibleToPatient) {
                badges.push(
                    <Chip
                        key="visible"
                        icon={<VisibilityIcon fontSize="small" />}
                        label="Visible to Patient"
                        size="small"
                        color="success"
                        sx={{ mr: 0.5 }}
                    />
                );
            }
            badges.push(
                <Chip
                    key="status"
                    label={event.data.status}
                    size="small"
                    color={event.data.status === 'completed' ? 'success' : 'warning'}
                />
            );
        }

        if (event.type === 'vitals') {
            if (event.data.isVerified) {
                badges.push(
                    <Chip
                        key="verified"
                        icon={<CheckCircleIcon fontSize="small" />}
                        label="Verified"
                        size="small"
                        color="success"
                    />
                );
            } else {
                badges.push(
                    <Chip
                        key="pending"
                        label="Pending Verification"
                        size="small"
                        color="warning"
                        variant="outlined"
                    />
                );
            }
        }

        if (event.type === 'visit') {
            if (event.data.hasSummary) {
                badges.push(
                    <Chip
                        key="summary"
                        icon={<DescriptionIcon fontSize="small" />}
                        label="Has Summary"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mr: 0.5 }}
                    />
                );
            }
            if (event.data.isSummaryVisible) {
                badges.push(
                    <Chip
                        key="visible-summary"
                        icon={<VisibilityIcon fontSize="small" />}
                        label="Summary Visible"
                        size="small"
                        color="success"
                    />
                );
            }
        }

        return badges;
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
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

    if (!timeline || timeline.length === 0) {
        return (
            <Alert severity="info">
                No health events have been recorded for this appointment yet.
            </Alert>
        );
    }

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    Health Event Timeline
                </Typography>

                <Timeline position="right">
                    {timeline.map((event, index) => (
                        <TimelineItem key={index}>
                            <TimelineOppositeContent
                                sx={{ m: 'auto 0', flex: 0.2 }}
                                align="right"
                                variant="body2"
                                color="text.secondary"
                            >
                                {formatTime(event.timestamp)}
                            </TimelineOppositeContent>

                            <TimelineSeparator>
                                <TimelineConnector sx={{ visibility: index === 0 ? 'hidden' : 'visible' }} />
                                <TimelineDot color={getEventColor(event.type)} variant="outlined">
                                    {getEventIcon(event.type)}
                                </TimelineDot>
                                <TimelineConnector sx={{ visibility: index === timeline.length - 1 ? 'hidden' : 'visible' }} />
                            </TimelineSeparator>

                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        bgcolor: 'background.paper',
                                        borderLeft: 3,
                                        borderColor: `${getEventColor(event.type)}.main`,
                                    }}
                                >
                                    <Typography variant="subtitle2" component="h3" fontWeight="medium">
                                        {getEventTitle(event)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {getEventDescription(event)}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                        {getEventBadges(event)}
                                    </Box>

                                    {/* Additional Details */}
                                    {event.type === 'vitals' && event.data.notes && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}
                                        >
                                            Note: {event.data.notes}
                                        </Typography>
                                    )}

                                    {event.type === 'visit' && event.data.chiefComplaint && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ mt: 1, display: 'block' }}
                                        >
                                            Chief Complaint: {event.data.chiefComplaint}
                                        </Typography>
                                    )}
                                </Paper>
                            </TimelineContent>
                        </TimelineItem>
                    ))}
                </Timeline>
            </CardContent>
        </Card>
    );
};

export default AppointmentTimeline;
