import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Alert,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    IconButton
} from '@mui/material';
import {
    Warning as WarningIcon,
    Close as CloseIcon,
    LocalHospital as HospitalIcon
} from '@mui/icons-material';

interface CriticalAlert {
    type: 'critical_value' | 'critical_interpretation' | 'critical_safety_issue';
    severity: 'critical' | 'urgent';
    message: string;
    details: any;
    testName?: string;
    value?: string;
    referenceRange?: string;
}

interface CriticalAlertDialogProps {
    open: boolean;
    onClose: () => void;
    alert: CriticalAlert | null;
    labIntegrationId: string;
    patientName: string;
    onEscalate?: () => void;
}

const CriticalAlertDialog: React.FC<CriticalAlertDialogProps> = ({
    open,
    onClose,
    alert,
    labIntegrationId,
    patientName,
    onEscalate
}) => {
    const navigate = useNavigate();

    if (!alert) return null;

    const getAlertIcon = () => {
        return <WarningIcon sx={{ fontSize: 48, color: '#d32f2f' }} />;
    };

    const getAlertTypeLabel = () => {
        switch (alert.type) {
            case 'critical_value':
                return 'Critical Lab Value';
            case 'critical_interpretation':
                return 'Critical AI Interpretation';
            case 'critical_safety_issue':
                return 'Critical Safety Issue';
            default:
                return 'Critical Alert';
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderTop: '4px solid #d32f2f'
                }
            }}
        >
            <DialogTitle sx={{ bgcolor: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getAlertIcon()}
                    <Box>
                        <Typography variant="h6" color="error" fontWeight="bold">
                            🚨 CRITICAL ALERT
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Patient: {patientName}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ mt: 2 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        {getAlertTypeLabel()}
                    </Typography>
                    <Typography variant="body2">
                        Immediate attention required
                    </Typography>
                </Alert>

                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Alert Message
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                        {alert.message}
                    </Typography>
                </Box>

                {alert.testName && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Test Details
                        </Typography>
                        <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                            <Typography variant="body2">
                                <strong>Test:</strong> {alert.testName}
                            </Typography>
                            {alert.value && (
                                <Typography variant="body2">
                                    <strong>Value:</strong> {alert.value}
                                </Typography>
                            )}
                            {alert.referenceRange && (
                                <Typography variant="body2">
                                    <strong>Reference Range:</strong> {alert.referenceRange}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                )}

                {alert.details && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Additional Details
                        </Typography>
                        <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                            {alert.details.summary && (
                                <Typography variant="body2" paragraph>
                                    {alert.details.summary}
                                </Typography>
                            )}
                            {alert.details.recommendedActions && alert.details.recommendedActions.length > 0 && (
                                <>
                                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                                        Recommended Actions:
                                    </Typography>
                                    <List dense>
                                        {alert.details.recommendedActions.map((action: string, index: number) => (
                                            <ListItem key={index}>
                                                <ListItemText primary={`• ${action}`} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                            {alert.details.safetyChecks && alert.details.safetyChecks.length > 0 && (
                                <>
                                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                                        Safety Issues:
                                    </Typography>
                                    <List dense>
                                        {alert.details.safetyChecks.map((check: any, index: number) => (
                                            <ListItem key={index}>
                                                <ListItemText
                                                    primary={check.description}
                                                    secondary={`Type: ${check.type}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                        </Box>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Alert severity="warning" icon={<HospitalIcon />}>
                    <Typography variant="body2">
                        This case may require physician consultation. Consider escalating if immediate medical intervention is needed.
                    </Typography>
                </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={onClose} variant="outlined">
                    Acknowledge
                </Button>
                {onEscalate && (
                    <Button
                        onClick={() => {
                            onEscalate();
                            onClose();
                        }}
                        variant="contained"
                        color="error"
                        startIcon={<HospitalIcon />}
                    >
                        Escalate to Physician
                    </Button>
                )}
                <Button
                    onClick={() => {
                        onClose();
                        navigate(`/pharmacy/lab-integration/${labIntegrationId}`);
                    }}
                    variant="contained"
                    color="primary"
                >
                    View Full Case
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CriticalAlertDialog;

