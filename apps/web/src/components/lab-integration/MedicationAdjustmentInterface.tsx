import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Stack,
  Paper,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  LocalPharmacy as LocalPharmacyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useImplementAdjustments } from '../../hooks/useLabIntegration';
import type { MedicationAdjustment, TherapyRecommendation } from '../../services/labIntegrationService';

interface MedicationAdjustmentInterfaceProps {
  labIntegrationId: string;
  adjustments: MedicationAdjustment[];
  recommendations: TherapyRecommendation[];
  status: string;
}

interface AdjustmentFormData {
  medicationId: string;
  medicationName: string;
  adjustmentType: 'dose_change' | 'frequency_change' | 'discontinuation' | 'new_medication';
  previousValue?: string;
  newValue: string;
}

const MedicationAdjustmentInterface: React.FC<MedicationAdjustmentInterfaceProps> = ({
  labIntegrationId,
  adjustments,
  recommendations,
  status,
}) => {
  const [implementDialogOpen, setImplementDialogOpen] = useState(false);
  const [selectedAdjustments, setSelectedAdjustments] = useState<AdjustmentFormData[]>([]);
  const [notifyPatient, setNotifyPatient] = useState(true);

  const implementMutation = useImplementAdjustments();

  const handleOpenImplementDialog = () => {
    // Pre-populate with recommendations
    const initialAdjustments: AdjustmentFormData[] = recommendations
      .filter((rec) => rec.action !== 'monitor' && rec.action !== 'continue')
      .map((rec) => ({
        medicationId: '', // Would need to be fetched from medication records
        medicationName: rec.medicationName,
        adjustmentType:
          rec.action === 'start'
            ? 'new_medication'
            : rec.action === 'stop'
            ? 'discontinuation'
            : 'dose_change',
        previousValue: rec.currentDose,
        newValue: rec.recommendedDose || '',
      }));
    setSelectedAdjustments(initialAdjustments);
    setImplementDialogOpen(true);
  };

  const handleCloseImplementDialog = () => {
    setImplementDialogOpen(false);
    setSelectedAdjustments([]);
    setNotifyPatient(true);
  };

  const handleAddAdjustment = () => {
    setSelectedAdjustments([
      ...selectedAdjustments,
      {
        medicationId: '',
        medicationName: '',
        adjustmentType: 'dose_change',
        newValue: '',
      },
    ]);
  };

  const handleRemoveAdjustment = (index: number) => {
    setSelectedAdjustments(selectedAdjustments.filter((_, i) => i !== index));
  };

  const handleUpdateAdjustment = (index: number, field: keyof AdjustmentFormData, value: string) => {
    const updated = [...selectedAdjustments];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedAdjustments(updated);
  };

  const handleImplement = async () => {
    if (selectedAdjustments.length === 0) {
      toast.error('Please add at least one medication adjustment');
      return;
    }

    // Validate all adjustments have required fields
    const invalid = selectedAdjustments.some(
      (adj) => !adj.medicationName || !adj.newValue
    );
    if (invalid) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await implementMutation.mutateAsync({
        id: labIntegrationId,
        data: {
          adjustments: selectedAdjustments,
          notifyPatient,
        },
      });
      handleCloseImplementDialog();
    } catch (error) {
      console.error('Failed to implement adjustments:', error);
    }
  };

  const getAdjustmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      dose_change: 'Dose Change',
      frequency_change: 'Frequency Change',
      discontinuation: 'Discontinuation',
      new_medication: 'New Medication',
    };
    return labels[type] || type;
  };

  const getAdjustmentTypeColor = (type: string) => {
    const colors: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
      dose_change: 'warning',
      frequency_change: 'info',
      discontinuation: 'error',
      new_medication: 'success',
    };
    return colors[type] || 'default';
  };

  return (
    <Stack spacing={3}>
      {/* Implemented Adjustments */}
      {adjustments.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: 'success.lighter' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
              <CheckCircleIcon />
              Implemented Adjustments ({adjustments.length})
            </Typography>
            <Divider sx={{ my: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Medication</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>Implemented By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Patient Notified</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {adjustments.map((adj, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocalPharmacyIcon fontSize="small" color="primary" />
                          <Typography variant="body2" fontWeight="medium">
                            {adj.medicationName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getAdjustmentTypeLabel(adj.adjustmentType)}
                          color={getAdjustmentTypeColor(adj.adjustmentType) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          {adj.previousValue && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              From: {adj.previousValue}
                            </Typography>
                          )}
                          <Typography variant="caption" fontWeight="medium" display="block">
                            To: {adj.newValue}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{adj.implementedBy}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(adj.implementedAt), 'MMM dd, yyyy HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {adj.patientNotified ? (
                          <Chip icon={<CheckCircleIcon />} label="Yes" color="success" size="small" />
                        ) : (
                          <Chip label="No" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Implement Button */}
      {adjustments.length === 0 && status === 'approved' && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <LocalPharmacyIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Ready to Implement Medication Adjustments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The therapy recommendations have been approved. Click below to implement the medication adjustments.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleOpenImplementDialog}
            disabled={implementMutation.isPending}
            startIcon={<CheckCircleIcon />}
          >
            Implement Adjustments
          </Button>
        </Box>
      )}

      {adjustments.length === 0 && status !== 'approved' && (
        <Alert severity="info">
          Medication adjustments can be implemented once the therapy recommendations have been approved.
        </Alert>
      )}

      {/* Implement Dialog */}
      <Dialog open={implementDialogOpen} onClose={handleCloseImplementDialog} maxWidth="lg" fullWidth>
        <DialogTitle>Implement Medication Adjustments</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info" icon={<NotificationsIcon />}>
              Review and confirm the medication adjustments below. You can add, edit, or remove adjustments as needed.
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Medication Name</TableCell>
                    <TableCell>Adjustment Type</TableCell>
                    <TableCell>Previous Value</TableCell>
                    <TableCell>New Value</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedAdjustments.map((adj, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          size="small"
                          value={adj.medicationName}
                          onChange={(e) => handleUpdateAdjustment(index, 'medicationName', e.target.value)}
                          placeholder="Medication name"
                          fullWidth
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={adj.adjustmentType}
                          onChange={(e) => handleUpdateAdjustment(index, 'adjustmentType', e.target.value)}
                          SelectProps={{ native: true }}
                          fullWidth
                        >
                          <option value="dose_change">Dose Change</option>
                          <option value="frequency_change">Frequency Change</option>
                          <option value="discontinuation">Discontinuation</option>
                          <option value="new_medication">New Medication</option>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={adj.previousValue || ''}
                          onChange={(e) => handleUpdateAdjustment(index, 'previousValue', e.target.value)}
                          placeholder="Previous value"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={adj.newValue}
                          onChange={(e) => handleUpdateAdjustment(index, 'newValue', e.target.value)}
                          placeholder="New value"
                          fullWidth
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleRemoveAdjustment(index)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button startIcon={<AddIcon />} onClick={handleAddAdjustment} variant="outlined">
              Add Adjustment
            </Button>

            <FormControlLabel
              control={
                <Checkbox
                  checked={notifyPatient}
                  onChange={(e) => setNotifyPatient(e.target.checked)}
                />
              }
              label="Notify patient of medication changes"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImplementDialog}>Cancel</Button>
          <Button
            onClick={handleImplement}
            variant="contained"
            disabled={implementMutation.isPending || selectedAdjustments.length === 0}
          >
            Implement Adjustments
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default MedicationAdjustmentInterface;

