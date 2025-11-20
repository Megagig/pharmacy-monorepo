import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Medication as MedicationIcon,
  CheckCircle as ResolveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { prescriptionDiscussionApi } from '../../services/api/prescriptionDiscussionApi';

interface PrescriptionDiscussionHeaderProps {
  conversationId: string;
  prescriptionDetails: {
    medicationName: string;
    rxNumber?: string;
    prescriptionId: string;
  };
  status: 'active' | 'resolved' | 'archived';
  onStatusChange?: (newStatus: string) => void;
}

export const PrescriptionDiscussionHeader: React.FC<PrescriptionDiscussionHeaderProps> = ({
  conversationId,
  prescriptionDetails,
  status,
  onStatusChange,
}) => {
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    setLoading(true);
    setError(null);

    try {
      await prescriptionDiscussionApi.resolveDiscussion(conversationId, resolutionNote);

      if (onStatusChange) {
        onStatusChange('resolved');
      }

      setResolveDialogOpen(false);
      setResolutionNote('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resolve discussion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): 'success' | 'default' | 'warning' => {
    switch (status) {
      case 'resolved':
        return 'success';
      case 'archived':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Box
        sx={{
          bgcolor: 'primary.lighter',
          p: 2,
          borderRadius: 1,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <MedicationIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h6" color="primary">
              {prescriptionDetails.medicationName}
            </Typography>
            {prescriptionDetails.rxNumber && (
              <Typography variant="caption" color="text.secondary">
                Rx Number: {prescriptionDetails.rxNumber}
              </Typography>
            )}
          </Box>
          <Chip
            label={status.toUpperCase()}
            size="small"
            color={getStatusColor(status)}
            icon={status === 'resolved' ? <ResolveIcon /> : <InfoIcon />}
          />
        </Box>

        {status === 'active' && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResolveIcon />}
            onClick={() => setResolveDialogOpen(true)}
          >
            Mark as Resolved
          </Button>
        )}
      </Box>

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => !loading && setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Prescription Discussion</DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mark this prescription discussion as resolved. All participants will be notified.
          </Typography>

          <TextField
            label="Resolution Note (Optional)"
            multiline
            rows={3}
            fullWidth
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="e.g., All questions answered, patient understands dosing instructions..."
            disabled={loading}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            variant="contained"
            color="success"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <ResolveIcon />}
          >
            {loading ? 'Resolving...' : 'Mark as Resolved'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrescriptionDiscussionHeader;
