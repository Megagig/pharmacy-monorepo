import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Typography,
  Box,
} from '@mui/material';
import { Chat as ChatIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { prescriptionDiscussionApi } from '../../services/api/prescriptionDiscussionApi';
import { useNavigate } from 'react-router-dom';

interface PrescriptionDiscussionButtonProps {
  prescriptionId: string;
  patientId: string;
  doctorId: string;
  prescriptionDetails: {
    medicationName: string;
    rxNumber?: string;
  };
  existingConversationId?: string;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
}

export const PrescriptionDiscussionButton: React.FC<PrescriptionDiscussionButtonProps> = ({
  prescriptionId,
  patientId,
  doctorId,
  prescriptionDetails,
  existingConversationId,
  variant = 'outlined',
  size = 'medium',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleStartDiscussion = async () => {
    if (existingConversationId) {
      // Navigate to existing conversation
      navigate(`/chat/${existingConversationId}`);
      return;
    }

    setDialogOpen(true);
  };

  const handleConfirmStart = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await prescriptionDiscussionApi.createDiscussion({
        prescriptionId,
        patientId,
        doctorId,
        prescriptionDetails,
      });

      setSuccess(true);

      // Navigate to conversation after a short delay
      setTimeout(() => {
        navigate(`/chat/${response.data._id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start discussion. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setDialogOpen(false);
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={<ChatIcon />}
        onClick={handleStartDiscussion}
      >
        {existingConversationId ? 'View Discussion' : 'Start Discussion'}
      </Button>

      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {success ? 'Discussion Started!' : 'Start Prescription Discussion'}
        </DialogTitle>

        <DialogContent>
          {success ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Discussion Created Successfully!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Redirecting to conversation...
              </Typography>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <Typography variant="body1" gutterBottom>
                Start a discussion about this prescription:
              </Typography>

              <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, my: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {prescriptionDetails.medicationName}
                </Typography>
                {prescriptionDetails.rxNumber && (
                  <Typography variant="caption" color="text.secondary">
                    Rx Number: {prescriptionDetails.rxNumber}
                  </Typography>
                )}
              </Box>

              <Typography variant="body2" color="text.secondary">
                This will create a conversation with the prescribing doctor and patient. All parties
                will be able to discuss this prescription and receive updates.
              </Typography>
            </>
          )}
        </DialogContent>

        {!success && (
          <DialogActions>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmStart}
              variant="contained"
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} />}
            >
              {loading ? 'Starting...' : 'Start Discussion'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
};

export default PrescriptionDiscussionButton;
