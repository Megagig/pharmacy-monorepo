import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon
} from '@mui/icons-material';
import { MedicationRecord } from '../../types/patientManagement';

interface MedicationCardProps {
  medication: MedicationRecord;
  onRefillRequest?: (medicationId: string, notes: string) => Promise<void>;
  showRefillButton?: boolean;
  isRefillLoading?: boolean;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onRefillRequest,
  showRefillButton = true,
  isRefillLoading = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [refillNotes, setRefillNotes] = useState('');
  const [refillError, setRefillError] = useState<string | null>(null);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleRefillRequest = async () => {
    if (!onRefillRequest) return;

    try {
      setRefillError(null);
      await onRefillRequest(medication._id, refillNotes);
      setRefillDialogOpen(false);
      setRefillNotes('');
    } catch (error: any) {
      setRefillError(error.message || 'Failed to submit refill request');
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'default';
      case 'expired':
        return 'error';
      default:
        return 'primary';
    }
  };

  const getAdherenceColor = (adherence?: string) => {
    switch (adherence) {
      case 'good':
        return 'success';
      case 'poor':
        return 'error';
      case 'unknown':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDaysRemaining = () => {
    if (!medication.endDate) return null;
    const endDate = new Date(medication.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = calculateDaysRemaining();

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
                {medication.medicationName}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {medication.status && (
                  <Chip 
                    label={medication.status.toUpperCase()} 
                    color={getStatusColor(medication.status) as any}
                    size="small"
                  />
                )}
                {medication.adherence && (
                  <Chip 
                    label={`Adherence: ${medication.adherence}`} 
                    color={getAdherenceColor(medication.adherence) as any}
                    size="small"
                  />
                )}
                {medication.phase && (
                  <Chip 
                    label={medication.phase.toUpperCase()} 
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Dosage:</strong> {medication.dose || 'Not specified'} • 
                <strong> Frequency:</strong> {medication.frequency || 'Not specified'} • 
                <strong> Route:</strong> {medication.route || 'Not specified'}
              </Typography>

              {medication.purposeIndication && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Purpose:</strong> {medication.purposeIndication}
                </Typography>
              )}

              {daysRemaining !== null && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ScheduleIcon sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                  <Typography variant="body2" color={daysRemaining <= 7 ? 'error' : 'text.secondary'}>
                    {daysRemaining > 0 
                      ? `${daysRemaining} days remaining`
                      : daysRemaining === 0 
                        ? 'Ends today'
                        : `Ended ${Math.abs(daysRemaining)} days ago`
                    }
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <IconButton
                onClick={handleExpandClick}
                aria-expanded={expanded}
                aria-label="show more"
                size="small"
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  <InfoIcon sx={{ mr: 1, fontSize: '1rem', verticalAlign: 'middle' }} />
                  Treatment Details
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Start Date:</strong> {formatDate(medication.startDate)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>End Date:</strong> {formatDate(medication.endDate)}
                </Typography>
                {medication.duration && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Duration:</strong> {medication.duration}
                  </Typography>
                )}
                {medication.treatmentDurationDays && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Treatment Days:</strong> {medication.treatmentDurationDays} days
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Additional Information
                </Typography>
                {medication.notes && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Notes:</strong> {medication.notes}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Created:</strong> {formatDate(medication.createdAt)}
                </Typography>
                <Typography variant="body2">
                  <strong>Last Updated:</strong> {formatDate(medication.updatedAt)}
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </CardContent>

        {showRefillButton && medication.phase === 'current' && medication.status === 'active' && (
          <CardActions sx={{ px: 2, pb: 2 }}>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={() => setRefillDialogOpen(true)}
              disabled={isRefillLoading}
            >
              Request Refill
            </Button>
          </CardActions>
        )}
      </Card>

      {/* Refill Request Dialog */}
      <Dialog 
        open={refillDialogOpen} 
        onClose={() => setRefillDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Request Refill for {medication.medicationName}
        </DialogTitle>
        <DialogContent>
          {refillError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {refillError}
            </Alert>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Submit a refill request for this medication. Your pharmacist will review and process the request.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (Optional)"
            placeholder="Add any notes about your refill request..."
            value={refillNotes}
            onChange={(e) => setRefillNotes(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Medication Details:
            </Typography>
            <Typography variant="body2">
              <strong>Name:</strong> {medication.medicationName}
            </Typography>
            <Typography variant="body2">
              <strong>Dosage:</strong> {medication.dose}
            </Typography>
            <Typography variant="body2">
              <strong>Frequency:</strong> {medication.frequency}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRefillDialogOpen(false)}
            disabled={isRefillLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRefillRequest}
            variant="contained"
            disabled={isRefillLoading}
          >
            {isRefillLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MedicationCard;