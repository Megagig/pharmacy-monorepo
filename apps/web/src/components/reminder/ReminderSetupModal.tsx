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
  Checkbox,
  FormGroup,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Alarm as AlarmIcon,
} from '@mui/icons-material';
import { reminderApi } from '../../services/api/reminderApi';

interface ReminderSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (reminder: any) => void;
  patientId: string;
  medicationId?: string;
  medicationName?: string;
  dosage?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export const ReminderSetupModal: React.FC<ReminderSetupModalProps> = ({
  open,
  onClose,
  onSuccess,
  patientId,
  medicationId,
  medicationName: initialMedicationName = '',
  dosage: initialDosage = '',
}) => {
  const [medicationName, setMedicationName] = useState(initialMedicationName);
  const [dosage, setDosage] = useState(initialDosage);
  const [instructions, setInstructions] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom'>('daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notifyPharmacist, setNotifyPharmacist] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFrequencyChange = (newFrequency: typeof frequency) => {
    setFrequency(newFrequency);
    
    // Set default times based on frequency
    switch (newFrequency) {
      case 'daily':
        setTimes(['08:00']);
        break;
      case 'twice_daily':
        setTimes(['08:00', '20:00']);
        break;
      case 'three_times_daily':
        setTimes(['08:00', '14:00', '20:00']);
        break;
      case 'weekly':
        setTimes(['08:00']);
        setDaysOfWeek([1]); // Monday by default
        break;
      case 'custom':
        setTimes(['08:00']);
        break;
    }
  };

  const handleAddTime = () => {
    setTimes([...times, '08:00']);
  };

  const handleRemoveTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!medicationName.trim()) {
      setError('Please enter medication name');
      return;
    }

    if (!dosage.trim()) {
      setError('Please enter dosage');
      return;
    }

    if (times.length === 0) {
      setError('Please add at least one reminder time');
      return;
    }

    if (frequency === 'weekly' && daysOfWeek.length === 0) {
      setError('Please select at least one day of the week');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reminderData = {
        patientId,
        medicationId,
        medicationName: medicationName.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim() || undefined,
        frequency,
        times,
        daysOfWeek: frequency === 'weekly' ? daysOfWeek : undefined,
        startDate,
        endDate: endDate || undefined,
        notifyPharmacistOnMissed: notifyPharmacist,
      };

      const response = await reminderApi.createReminder(reminderData);

      setSuccess(true);

      // Show success message for 2 seconds before closing
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.data);
        }
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create reminder. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMedicationName(initialMedicationName);
      setDosage(initialDosage);
      setInstructions('');
      setFrequency('daily');
      setTimes(['08:00']);
      setDaysOfWeek([]);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setNotifyPharmacist(true);
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth disableEscapeKeyDown={loading}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlarmIcon color="primary" />
          Set Up Medication Reminder
        </Box>
      </DialogTitle>

      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Reminder Set Up Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You will receive reminders at the scheduled times.
            </Typography>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Medication Details */}
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Medication Name"
                fullWidth
                required
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                disabled={loading}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Dosage"
                fullWidth
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 10mg, 1 tablet"
                disabled={loading}
                sx={{ mb: 2 }}
              />

              <TextField
                label="Instructions (Optional)"
                fullWidth
                multiline
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Take with food, Avoid alcohol"
                disabled={loading}
              />
            </Box>

            {/* Frequency */}
            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset" disabled={loading}>
                <FormLabel component="legend">Frequency</FormLabel>
                <RadioGroup
                  value={frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value as typeof frequency)}
                >
                  <FormControlLabel value="daily" control={<Radio />} label="Once daily" />
                  <FormControlLabel value="twice_daily" control={<Radio />} label="Twice daily" />
                  <FormControlLabel value="three_times_daily" control={<Radio />} label="Three times daily" />
                  <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
                  <FormControlLabel value="custom" control={<Radio />} label="Custom schedule" />
                </RadioGroup>
              </FormControl>
            </Box>

            {/* Days of Week (for weekly) */}
            {frequency === 'weekly' && (
              <Box sx={{ mb: 3 }}>
                <FormLabel component="legend">Days of Week</FormLabel>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Chip
                      key={day.value}
                      label={day.label}
                      onClick={() => handleDayToggle(day.value)}
                      color={daysOfWeek.includes(day.value) ? 'primary' : 'default'}
                      variant={daysOfWeek.includes(day.value) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Times */}
            <Box sx={{ mb: 3 }}>
              <FormLabel component="legend">Reminder Times</FormLabel>
              {times.map((time, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(index, e.target.value)}
                    disabled={loading}
                    fullWidth
                  />
                  {times.length > 1 && (
                    <IconButton
                      onClick={() => handleRemoveTime(index)}
                      disabled={loading}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddTime}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                Add Time
              </Button>
            </Box>

            {/* Duration */}
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <TextField
                label="End Date (Optional)"
                type="date"
                fullWidth
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                helperText="Leave empty for ongoing reminders"
              />
            </Box>

            {/* Options */}
            <Box sx={{ mb: 2 }}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={notifyPharmacist}
                      onChange={(e) => setNotifyPharmacist(e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Notify pharmacist if dose is missed"
                />
              </FormGroup>
            </Box>
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
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Setting Up...' : 'Set Up Reminder'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ReminderSetupModal;
