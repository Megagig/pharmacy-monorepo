import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

interface RefillRequestData {
  _id: string;
  medicationId: string;
  medicationName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'denied';
  requestedDate: string;
  completedDate?: string;
  estimatedCompletionDate?: string;
  notes?: string;
  pharmacistNotes?: string;
  quantity?: number;
  refillsRemaining?: number;
  urgency?: 'routine' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

interface RefillRequestProps {
  request: RefillRequestData;
  onCancel?: (requestId: string, reason: string) => Promise<void>;
  canCancel?: boolean;
  isCancelLoading?: boolean;
}

const RefillRequest: React.FC<RefillRequestProps> = ({
  request,
  onCancel,
  canCancel = true,
  isCancelLoading = false
}) => {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelRequest = async () => {
    if (!onCancel || !cancelReason.trim()) return;

    try {
      setCancelError(null);
      await onCancel(request._id, cancelReason);
      setCancelDialogOpen(false);
      setCancelReason('');
    } catch (error: any) {
      setCancelError(error.message || 'Failed to cancel refill request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'cancelled':
      case 'denied':
        return 'error';
      case 'pending':
      default:
        return 'info';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" sx={{ fontSize: '1rem' }} />;
      case 'in_progress':
        return <HourglassEmptyIcon color="warning" sx={{ fontSize: '1rem' }} />;
      case 'cancelled':
      case 'denied':
        return <ErrorIcon color="error" sx={{ fontSize: '1rem' }} />;
      case 'pending':
      default:
        return <ScheduleIcon color="info" sx={{ fontSize: '1rem' }} />;
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    return urgency === 'urgent' ? 'error' : 'default';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCancelRequest = canCancel && 
    (request.status === 'pending' || request.status === 'in_progress') &&
    !isCancelLoading;

  return (
    <>
      <Card 
        variant="outlined" 
        sx={{ 
          mb: 2,
          '&:hover': {
            boxShadow: 2
          }
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                <PharmacyIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1.2rem' }} />
                {request.medicationName}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip 
                  icon={getStatusIcon(request.status)}
                  label={request.status.replace('_', ' ').toUpperCase()} 
                  color={getStatusColor(request.status) as any}
                  size="small"
                />
                {request.urgency && (
                  <Chip 
                    label={request.urgency.toUpperCase()} 
                    color={getUrgencyColor(request.urgency) as any}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Requested:</strong> {formatDate(request.requestedDate || request.createdAt)}
              </Typography>

              {request.estimatedCompletionDate && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Estimated Completion:</strong> {formatDate(request.estimatedCompletionDate)}
                </Typography>
              )}

              {request.completedDate && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Completed:</strong> {formatDate(request.completedDate)}
                </Typography>
              )}

              {request.quantity && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Quantity:</strong> {request.quantity}
                </Typography>
              )}

              {request.refillsRemaining !== undefined && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Refills Remaining:</strong> {request.refillsRemaining}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              {canCancelRequest && (
                <Tooltip title="Cancel Request">
                  <IconButton
                    onClick={() => setCancelDialogOpen(true)}
                    size="small"
                    color="error"
                  >
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {request.notes && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                <InfoIcon sx={{ mr: 1, fontSize: '1rem', verticalAlign: 'middle' }} />
                Your Notes:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {request.notes}
              </Typography>
            </Box>
          )}

          {request.pharmacistNotes && (
            <Box sx={{ mb: 2 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                Pharmacist Notes:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {request.pharmacistNotes}
              </Typography>
            </Box>
          )}

          {/* Status-specific messages */}
          {request.status === 'pending' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Your refill request is pending review by the pharmacy team.
            </Alert>
          )}

          {request.status === 'in_progress' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Your refill is being prepared. You'll be notified when it's ready for pickup.
            </Alert>
          )}

          {request.status === 'completed' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Your refill is ready for pickup! Please contact the pharmacy for pickup instructions.
            </Alert>
          )}

          {request.status === 'denied' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Your refill request was denied. Please contact the pharmacy for more information.
            </Alert>
          )}

          {request.status === 'cancelled' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This refill request was cancelled.
            </Alert>
          )}
        </CardContent>

        {request.status === 'completed' && (
          <CardActions sx={{ px: 2, pb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                // This could open a dialog with pickup instructions
                // or redirect to contact information
              }}
            >
              View Pickup Instructions
            </Button>
          </CardActions>
        )}
      </Card>

      {/* Cancel Request Dialog */}
      <Dialog 
        open={cancelDialogOpen} 
        onClose={() => setCancelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Cancel Refill Request
        </DialogTitle>
        <DialogContent>
          {cancelError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to cancel this refill request for <strong>{request.medicationName}</strong>?
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Cancellation"
            placeholder="Please provide a reason for cancelling this request..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            error={!cancelReason.trim()}
            helperText={!cancelReason.trim() ? 'Please provide a reason for cancellation' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setCancelDialogOpen(false)}
            disabled={isCancelLoading}
          >
            Keep Request
          </Button>
          <Button 
            onClick={handleCancelRequest}
            variant="contained"
            color="error"
            disabled={isCancelLoading || !cancelReason.trim()}
          >
            {isCancelLoading ? 'Cancelling...' : 'Cancel Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RefillRequest;