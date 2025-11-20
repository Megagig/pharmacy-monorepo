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
  Paper,
} from '@mui/material';
import {
  Campaign as BroadcastIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { broadcastApi } from '../../services/api/broadcastApi';

interface BroadcastComposerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (broadcast: any) => void;
}

const ROLE_OPTIONS = [
  { value: 'pharmacist', label: 'Pharmacists' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'patient', label: 'Patients' },
  { value: 'admin', label: 'Administrators' },
];

export const BroadcastComposer: React.FC<BroadcastComposerProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [audienceType, setAudienceType] = useState<'all' | 'roles' | 'specific'>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleRoleToggle = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const getEstimatedRecipients = (): string => {
    if (audienceType === 'all') return 'All users';
    if (audienceType === 'roles') {
      if (selectedRoles.length === 0) return 'No roles selected';
      return selectedRoles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label).join(', ');
    }
    return 'Specific users';
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (audienceType === 'roles' && selectedRoles.length === 0) {
      setError('Please select at least one role');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const broadcastData: any = {
        title: title.trim(),
        message: message.trim(),
        priority,
        audienceType,
      };

      if (audienceType === 'roles') {
        broadcastData.roles = selectedRoles;
      }

      const response = await broadcastApi.createBroadcast(broadcastData);

      setSuccess(true);

      // Show success message for 2 seconds before closing
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.data);
        }
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send broadcast. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setMessage('');
      setPriority('normal');
      setAudienceType('all');
      setSelectedRoles([]);
      setError(null);
      setSuccess(false);
      setShowPreview(false);
      onClose();
    }
  };

  const characterCount = message.length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth disableEscapeKeyDown={loading}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BroadcastIcon color="primary" />
          Send Broadcast Message
        </Box>
      </DialogTitle>

      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Broadcast Sent Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your message has been delivered to all recipients.
            </Typography>
          </Box>
        ) : showPreview ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              Preview
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {title}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {message}
              </Typography>
            </Paper>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Priority:</strong> {priority.toUpperCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Recipients:</strong> {getEstimatedRecipients()}
              </Typography>
            </Box>
            {priority === 'urgent' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Urgent broadcasts</strong> will send push notifications to all recipients.
              </Alert>
            )}
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
                label="Title"
                fullWidth
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Important Pharmacy Update"
                disabled={loading}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                label="Message"
                multiline
                rows={6}
                fullWidth
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your broadcast message..."
                disabled={loading}
                helperText={`${characterCount} characters`}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset" disabled={loading}>
                <FormLabel component="legend">Priority</FormLabel>
                <RadioGroup
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                >
                  <FormControlLabel value="normal" control={<Radio />} label="Normal" />
                  <FormControlLabel value="high" control={<Radio />} label="High" />
                  <FormControlLabel
                    value="urgent"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                        <span>Urgent (Push notifications)</span>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset" disabled={loading}>
                <FormLabel component="legend">Audience</FormLabel>
                <RadioGroup
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as typeof audienceType)}
                >
                  <FormControlLabel value="all" control={<Radio />} label="All users" />
                  <FormControlLabel value="roles" control={<Radio />} label="Specific roles" />
                </RadioGroup>
              </FormControl>
            </Box>

            {audienceType === 'roles' && (
              <Box sx={{ mb: 3, ml: 4 }}>
                <FormLabel component="legend">Select Roles</FormLabel>
                <FormGroup>
                  {ROLE_OPTIONS.map((role) => (
                    <FormControlLabel
                      key={role.value}
                      control={
                        <Checkbox
                          checked={selectedRoles.includes(role.value)}
                          onChange={() => handleRoleToggle(role.value)}
                          disabled={loading}
                        />
                      }
                      label={role.label}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}

            <Box sx={{ p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Recipients:</strong> {getEstimatedRecipients()}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      {!success && (
        <DialogActions>
          {showPreview ? (
            <>
              <Button onClick={() => setShowPreview(false)} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                variant="contained"
                disabled={loading}
                startIcon={loading && <CircularProgress size={20} />}
              >
                {loading ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={() => setShowPreview(true)}
                variant="contained"
                disabled={loading || !title.trim() || !message.trim()}
              >
                Preview
              </Button>
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default BroadcastComposer;
