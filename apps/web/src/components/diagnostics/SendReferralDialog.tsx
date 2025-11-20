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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';

interface SendReferralDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: {
    physicianName: string;
    physicianEmail: string;
    specialty: string;
    institution: string;
    notes: string;
  }) => Promise<void>;
  loading?: boolean;
  caseId?: string;
}

const SendReferralDialog: React.FC<SendReferralDialogProps> = ({
  open,
  onClose,
  onSend,
  loading = false,
  caseId,
}) => {
  const [formData, setFormData] = useState({
    physicianName: '',
    physicianEmail: '',
    specialty: 'general_medicine',
    institution: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.physicianName.trim()) {
      newErrors.physicianName = 'Physician name is required';
    }

    if (!formData.physicianEmail.trim()) {
      newErrors.physicianEmail = 'Physician email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.physicianEmail)) {
      newErrors.physicianEmail = 'Please enter a valid email address';
    }

    if (!formData.specialty) {
      newErrors.specialty = 'Specialty is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await onSend(formData);
      // Reset form on success
      setFormData({
        physicianName: '',
        physicianEmail: '',
        specialty: 'general_medicine',
        institution: '',
        notes: '',
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to send referral:', error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        physicianName: '',
        physicianEmail: '',
        specialty: 'general_medicine',
        institution: '',
        notes: '',
      });
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Send Referral Electronically
          </Typography>
          <Button onClick={handleClose} color="inherit" disabled={loading}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {caseId && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Sending referral for case: <strong>{caseId}</strong>
          </Alert>
        )}

        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <TextField
              fullWidth
              label="Physician Name"
              value={formData.physicianName}
              onChange={handleChange('physicianName')}
              error={!!errors.physicianName}
              helperText={errors.physicianName}
              disabled={loading}
              required
            />

            <TextField
              fullWidth
              label="Physician Email"
              type="email"
              value={formData.physicianEmail}
              onChange={handleChange('physicianEmail')}
              error={!!errors.physicianEmail}
              helperText={errors.physicianEmail}
              disabled={loading}
              required
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <FormControl fullWidth error={!!errors.specialty} disabled={loading}>
              <InputLabel>Specialty *</InputLabel>
              <Select
                value={formData.specialty}
                onChange={handleChange('specialty')}
                label="Specialty *"
              >
                <MenuItem value="general_medicine">General Medicine</MenuItem>
                <MenuItem value="cardiology">Cardiology</MenuItem>
                <MenuItem value="dermatology">Dermatology</MenuItem>
                <MenuItem value="endocrinology">Endocrinology</MenuItem>
                <MenuItem value="gastroenterology">Gastroenterology</MenuItem>
                <MenuItem value="neurology">Neurology</MenuItem>
                <MenuItem value="oncology">Oncology</MenuItem>
                <MenuItem value="orthopedics">Orthopedics</MenuItem>
                <MenuItem value="psychiatry">Psychiatry</MenuItem>
                <MenuItem value="pulmonology">Pulmonology</MenuItem>
                <MenuItem value="urology">Urology</MenuItem>
              </Select>
              {errors.specialty && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.specialty}
                </Typography>
              )}
            </FormControl>

            <TextField
              fullWidth
              label="Institution/Clinic"
              value={formData.institution}
              onChange={handleChange('institution')}
              disabled={loading}
              placeholder="e.g., City General Hospital"
            />
          </Stack>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Additional Notes"
            value={formData.notes}
            onChange={handleChange('notes')}
            disabled={loading}
            placeholder="Any additional information for the receiving physician..."
          />
        </Stack>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            The referral document will be sent electronically to the specified physician's email address.
            A tracking ID will be generated for follow-up purposes.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Referral'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendReferralDialog;