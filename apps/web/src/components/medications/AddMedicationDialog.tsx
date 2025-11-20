import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  CircularProgress,
  Chip,
  Typography,
  Autocomplete,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

interface AddMedicationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (medication: MedicationFormData) => Promise<void>;
  patientId: string;
  existingMedications?: Array<{ name: string; rxcui?: string }>;
}

export interface MedicationFormData {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate?: string;
  indication: string;
  prescriber: string;
  cost?: number;
  sellingPrice?: number;
  allergyCheck: {
    status: boolean;
    details: string;
  };
  specialInstructions?: string;
}

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed',
  'Weekly',
  'Monthly',
];

const ROUTE_OPTIONS = [
  'Oral',
  'Sublingual',
  'Topical',
  'Intravenous',
  'Intramuscular',
  'Subcutaneous',
  'Inhalation',
  'Rectal',
  'Ophthalmic',
  'Otic',
  'Nasal',
];

const AddMedicationDialog: React.FC<AddMedicationDialogProps> = ({
  open,
  onClose,
  onSubmit,
  patientId,
  existingMedications = [],
}) => {
  const [formData, setFormData] = useState<MedicationFormData>({
    name: '',
    genericName: '',
    dosage: '',
    frequency: 'Once daily',
    route: 'Oral',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    indication: '',
    prescriber: '',
    cost: undefined,
    sellingPrice: undefined,
    allergyCheck: {
      status: false,
      details: '',
    },
    specialInstructions: '',
  });

  const [loading, setLoading] = useState(false);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionWarnings, setInteractionWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof MedicationFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAllergyCheckChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      allergyCheck: {
        ...prev.allergyCheck,
        status: checked,
      },
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Medication name is required';
    }
    if (!formData.dosage.trim()) {
      newErrors.dosage = 'Dosage is required';
    }
    if (!formData.frequency) {
      newErrors.frequency = 'Frequency is required';
    }
    if (!formData.route) {
      newErrors.route = 'Route is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkInteractions = async () => {
    if (!formData.name || existingMedications.length === 0) {
      return;
    }

    setCheckingInteractions(true);
    try {
      // TODO: Implement actual interaction checking API call
      // For now, simulate with a delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulated warnings - replace with actual API call
      const warnings: string[] = [];

      // Example: Check if medication name contains common interaction keywords
      const interactionKeywords = ['warfarin', 'aspirin', 'ibuprofen', 'metformin'];
      const hasInteraction = interactionKeywords.some(keyword =>
        formData.name.toLowerCase().includes(keyword)
      );

      if (hasInteraction && existingMedications.length > 0) {
        warnings.push(
          `Potential interaction detected with existing medications. Please review carefully.`
        );
      }

      setInteractionWarnings(warnings);
    } catch (error) {
      console.error('Error checking interactions:', error);
    } finally {
      setCheckingInteractions(false);
    }
  };

  // Check interactions when medication name changes
  React.useEffect(() => {
    if (formData.name.length > 3) {
      const timer = setTimeout(() => {
        checkInteractions();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setInteractionWarnings([]);
    }
  }, [formData.name, existingMedications]);

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error adding medication:', error);
      // Error handling is done in parent component
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        genericName: '',
        dosage: '',
        frequency: 'Once daily',
        route: 'Oral',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        indication: '',
        prescriber: '',
        cost: undefined,
        sellingPrice: undefined,
        allergyCheck: {
          status: false,
          details: '',
        },
        specialInstructions: '',
      });
      setErrors({});
      setInteractionWarnings([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add New Medication</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Interaction Warnings */}
          {checkingInteractions && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Checking for drug interactions...
                </Typography>
              </Box>
            </Alert>
          )}

          {interactionWarnings.length > 0 && (
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Drug Interaction Warnings:
              </Typography>
              {interactionWarnings.map((warning, index) => (
                <Typography key={index} variant="body2">
                  • {warning}
                </Typography>
              ))}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Medication Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Medication Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>

            {/* Generic Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Generic Name"
                value={formData.genericName}
                onChange={(e) => handleChange('genericName', e.target.value)}
              />
            </Grid>

            {/* Dosage */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Dosage"
                placeholder="e.g., 500mg, 10ml"
                value={formData.dosage}
                onChange={(e) => handleChange('dosage', e.target.value)}
                error={!!errors.dosage}
                helperText={errors.dosage || 'Include strength and unit'}
                required
              />
            </Grid>

            {/* Frequency */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                fullWidth
                options={FREQUENCY_OPTIONS}
                value={formData.frequency}
                onChange={(_, newValue) => handleChange('frequency', newValue || '')}
                freeSolo
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Frequency"
                    error={!!errors.frequency}
                    helperText={errors.frequency}
                    required
                  />
                )}
              />
            </Grid>

            {/* Route */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Route"
                value={formData.route}
                onChange={(e) => handleChange('route', e.target.value)}
                error={!!errors.route}
                helperText={errors.route}
                required
              >
                {ROUTE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Indication */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Indication"
                placeholder="Reason for medication"
                value={formData.indication}
                onChange={(e) => handleChange('indication', e.target.value)}
              />
            </Grid>

            {/* Start Date */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                error={!!errors.startDate}
                helperText={errors.startDate}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            {/* End Date */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="End Date (Optional)"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Prescriber */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prescriber"
                placeholder="Doctor's name"
                value={formData.prescriber}
                onChange={(e) => handleChange('prescriber', e.target.value)}
              />
            </Grid>

            {/* Cost */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Cost Price (₦)"
                value={formData.cost || ''}
                onChange={(e) =>
                  handleChange('cost', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
              />
            </Grid>

            {/* Selling Price */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Selling Price (₦)"
                value={formData.sellingPrice || ''}
                onChange={(e) =>
                  handleChange(
                    'sellingPrice',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
              />
            </Grid>

            {/* Special Instructions */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Special Instructions"
                placeholder="e.g., Take with food, Avoid alcohol"
                value={formData.specialInstructions}
                onChange={(e) => handleChange('specialInstructions', e.target.value)}
              />
            </Grid>

            {/* Allergy Check */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.allergyCheck.status}
                    onChange={(e) => handleAllergyCheckChange(e.target.checked)}
                  />
                }
                label="Allergy check performed"
              />
            </Grid>

            {formData.allergyCheck.status && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Allergy Check Details"
                  placeholder="Document allergy check results"
                  value={formData.allergyCheck.details}
                  onChange={(e) =>
                    handleChange('allergyCheck', {
                      ...formData.allergyCheck,
                      details: e.target.value,
                    })
                  }
                />
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || checkingInteractions}
          startIcon={loading && <CircularProgress size={16} />}
        >
          {loading ? 'Adding...' : 'Add Medication'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMedicationDialog;
