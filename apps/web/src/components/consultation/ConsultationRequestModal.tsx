import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { Warning as WarningIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { consultationApi } from '../../services/api/consultationApi';

interface ConsultationRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (request: any) => void;
  patientId: string;
  workplaceId: string;
}

export const ConsultationRequestModal: React.FC<ConsultationRequestModalProps> = ({
  open,
  onClose,
  onSuccess,
  patientId,
  workplaceId,
}) => {
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'chat' | 'phone' | 'email'>('chat');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for your consultation request');
      return;
    }

    if (reason.length > 500) {
      setError('Reason must be 500 characters or less');
      return;
    }

    if (preferredContactMethod === 'phone' && !patientPhone.trim()) {
      setError('Please provide a phone number for phone consultations');
      return;
    }

    if (preferredContactMethod === 'email' && !patientEmail.trim()) {
      setError('Please provide an email address for email consultations');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestData = {
        patientId,
        reason: reason.trim(),
        priority,
        preferredContactMethod,
        ...(patientPhone && { patientPhone }),
        ...(patientEmail && { patientEmail }),
      };

      const response = await consultationApi.createRequest(requestData);

      setSuccess(true);
      
      // Show success message for 2 seconds before closing
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.data);
        }
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create consultation request. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setPriority('normal');
      setPreferredContactMethod('chat');
      setPatientPhone('');
      setPatientEmail('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const characterCount = reason.length;
  const characterLimit = 500;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        Request Pharmacist Consultation
      </DialogTitle>

      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Request Submitted Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A pharmacist will respond to your request shortly.
            </Typography>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <TextField
                label="Reason for Consultation"
                multiline
                rows={4}
                fullWidth
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe your question or concern..."
                disabled={loading}
                helperText={`${characterCount}/${characterLimit} characters`}
                error={characterCount > characterLimit}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset" disabled={loading}>
                <FormLabel component="legend">Priority</FormLabel>
                <RadioGroup
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                >
                  <FormControlLabel
                    value="normal"
                    control={<Radio />}
                    label="Normal - I can wait for a response"
                  />
                  <FormControlLabel
                    value="urgent"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                        <span>Urgent - I need immediate assistance</span>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset" disabled={loading}>
                <FormLabel component="legend">Preferred Contact Method</FormLabel>
                <RadioGroup
                  value={preferredContactMethod}
                  onChange={(e) => setPreferredContactMethod(e.target.value as 'chat' | 'phone' | 'email')}
                >
                  <FormControlLabel
                    value="chat"
                    control={<Radio />}
                    label="Chat - Message me in the app"
                  />
                  <FormControlLabel
                    value="phone"
                    control={<Radio />}
                    label="Phone - Call me"
                  />
                  <FormControlLabel
                    value="email"
                    control={<Radio />}
                    label="Email - Send me an email"
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            {preferredContactMethod === 'phone' && (
              <Box sx={{ mb: 3 }}>
                <TextField
                  label="Phone Number"
                  fullWidth
                  required
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  disabled={loading}
                  type="tel"
                />
              </Box>
            )}

            {preferredContactMethod === 'email' && (
              <Box sx={{ mb: 3 }}>
                <TextField
                  label="Email Address"
                  fullWidth
                  required
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  disabled={loading}
                  type="email"
                />
              </Box>
            )}

            {priority === 'urgent' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Urgent requests</strong> will be prioritized and you may receive SMS notifications.
                A pharmacist will respond within 2 minutes.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      {!success && (
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !reason.trim() || characterCount > characterLimit}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ConsultationRequestModal;
