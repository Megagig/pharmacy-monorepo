import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    CircularProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    LocalHospital as HospitalIcon,
    Send as SendIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';

interface PhysicianEscalationDialogProps {
    open: boolean;
    onClose: () => void;
    labIntegrationId: string;
    patientName: string;
    onSuccess?: () => void;
}

const PhysicianEscalationDialog: React.FC<PhysicianEscalationDialogProps> = ({
    open,
    onClose,
    labIntegrationId,
    patientName,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        reason: '',
        physicianEmail: '',
        physicianPhone: '',
        urgency: 'urgent' as 'routine' | 'urgent' | 'critical'
    });

    const handleSubmit = async () => {
        if (!formData.reason.trim()) {
            toast.error('Please provide a reason for escalation');
            return;
        }

        if (!formData.physicianEmail.trim()) {
            toast.error('Please provide physician email');
            return;
        }

        setLoading(true);
        try {
            await apiClient.post(`/api/lab-integration/${labIntegrationId}/escalate`, formData);
            
            toast.success('Case escalated to physician successfully');
            
            // Reset form
            setFormData({
                reason: '',
                physicianEmail: '',
                physicianPhone: '',
                urgency: 'urgent'
            });
            
            if (onSuccess) {
                onSuccess();
            }
            
            onClose();
        } catch (error: any) {
            console.error('Failed to escalate case:', error);
            toast.error(error.response?.data?.message || 'Failed to escalate case');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderTop: '4px solid #ff9800'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HospitalIcon color="warning" />
                    <Typography variant="h6">
                        Escalate to Physician
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small" disabled={loading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                        Escalating case for patient: <strong>{patientName}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        The physician will receive an email notification with case details
                    </Typography>
                </Alert>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth required>
                        <InputLabel>Urgency Level</InputLabel>
                        <Select
                            value={formData.urgency}
                            onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                            label="Urgency Level"
                            disabled={loading}
                        >
                            <MenuItem value="routine">Routine</MenuItem>
                            <MenuItem value="urgent">Urgent</MenuItem>
                            <MenuItem value="critical">Critical (SMS + Email)</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        label="Physician Email"
                        type="email"
                        fullWidth
                        required
                        value={formData.physicianEmail}
                        onChange={(e) => setFormData({ ...formData, physicianEmail: e.target.value })}
                        placeholder="doctor@example.com"
                        disabled={loading}
                        helperText="Email address where the escalation notification will be sent"
                    />

                    <TextField
                        label="Physician Phone (Optional)"
                        type="tel"
                        fullWidth
                        value={formData.physicianPhone}
                        onChange={(e) => setFormData({ ...formData, physicianPhone: e.target.value })}
                        placeholder="+1234567890"
                        disabled={loading}
                        helperText="Required for critical urgency (SMS notification)"
                    />

                    <TextField
                        label="Reason for Escalation"
                        multiline
                        rows={4}
                        fullWidth
                        required
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Describe why this case requires physician consultation..."
                        disabled={loading}
                        helperText={`${formData.reason.length}/500 characters`}
                        inputProps={{ maxLength: 500 }}
                    />
                </Box>

                {formData.urgency === 'critical' && !formData.physicianPhone && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                            Phone number is required for critical urgency to send SMS notification
                        </Typography>
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    color="warning"
                    startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                    disabled={loading || !formData.reason.trim() || !formData.physicianEmail.trim() || 
                             (formData.urgency === 'critical' && !formData.physicianPhone.trim())}
                >
                    {loading ? 'Escalating...' : 'Escalate Case'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PhysicianEscalationDialog;

