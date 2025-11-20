import React, { useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  IconButton,
  Alert,
  Autocomplete,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import MedicationIcon from '@mui/icons-material/Medication';
import CloseIcon from '@mui/icons-material/Close';
import type { MedicationHistoryInputProps } from '../types';

// Common medications for quick selection
const COMMON_MEDICATIONS = [
  'Acetaminophen',
  'Ibuprofen',
  'Aspirin',
  'Lisinopril',
  'Amlodipine',
  'Metformin',
  'Atorvastatin',
  'Omeprazole',
  'Levothyroxine',
  'Metoprolol',
  'Hydrochlorothiazide',
  'Losartan',
  'Simvastatin',
  'Gabapentin',
  'Sertraline',
  'Prednisone',
  'Amoxicillin',
  'Ciprofloxacin',
  'Warfarin',
  'Insulin',
];

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
  'Other',
];

const DOSAGE_UNITS = [
  'mg',
  'g',
  'mcg',
  'mL',
  'tablets',
  'capsules',
  'drops',
  'puffs',
  'units',
  'patches',
];

interface MedicationFormData {
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
}

interface MedicationDialogData {
  name: string;
  dosage: string;
  dosageAmount: string;
  dosageUnit: string;
  frequency: string;
  customFrequency: string;
}

const MedicationHistoryInput: React.FC<MedicationHistoryInputProps> = ({
  value = [],
  onChange,
  error,
  disabled = false,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { control, watch } = useForm<MedicationFormData>({
    defaultValues: {
      medications: value,
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'medications',
  });

  const watchedMedications = watch('medications');

  // Update parent component when medications change
  React.useEffect(() => {
    onChange(watchedMedications);
  }, [watchedMedications, onChange]);

  // Dialog form for adding/editing medications
  const {
    control: dialogControl,
    handleSubmit: handleDialogSubmit,
    reset: resetDialog,
    watch: watchDialog,
    formState: { errors: dialogErrors },
  } = useForm<MedicationDialogData>({
    defaultValues: {
      name: '',
      dosage: '',
      dosageAmount: '',
      dosageUnit: 'mg',
      frequency: 'Once daily',
      customFrequency: '',
    },
  });

  const watchedDialogValues = watchDialog();

  const handleOpenDialog = useCallback(
    (medication?: (typeof value)[0], index?: number) => {
      if (medication) {
        // Parse existing dosage
        const dosageMatch = medication.dosage.match(
          /^(\d+(?:\.\d+)?)\s*(\w+)$/
        );
        const dosageAmount = dosageMatch ? dosageMatch[1] : '';
        const dosageUnit = dosageMatch ? dosageMatch[2] : 'mg';

        resetDialog({
          name: medication.name,
          dosage: medication.dosage,
          dosageAmount,
          dosageUnit,
          frequency: FREQUENCY_OPTIONS.includes(medication.frequency)
            ? medication.frequency
            : 'Other',
          customFrequency: FREQUENCY_OPTIONS.includes(medication.frequency)
            ? ''
            : medication.frequency,
        });
        setEditingIndex(index ?? null);
      } else {
        resetDialog({
          name: '',
          dosage: '',
          dosageAmount: '',
          dosageUnit: 'mg',
          frequency: 'Once daily',
          customFrequency: '',
        });
        setEditingIndex(null);
      }
      setIsDialogOpen(true);
    },
    [resetDialog]
  );

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingIndex(null);
    resetDialog();
  }, [resetDialog]);

  const handleSaveMedication = useCallback(
    (data: MedicationDialogData) => {
      const dosage =
        data.dosageAmount && data.dosageUnit
          ? `${data.dosageAmount} ${data.dosageUnit}`
          : data.dosage;

      const frequency =
        data.frequency === 'Other' ? data.customFrequency : data.frequency;

      const medication = {
        name: data.name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
      };

      if (editingIndex !== null) {
        // Update existing medication
        update(editingIndex, medication);
      } else {
        // Add new medication
        append(medication);
      }

      handleCloseDialog();
    },
    [editingIndex, update, append, handleCloseDialog]
  );

  const handleRemoveMedication = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
  );

  const handleQuickAddMedication = useCallback(
    (medicationName: string) => {
      append({
        name: medicationName,
        dosage: '',
        frequency: 'Once daily',
      });
    },
    [append]
  );

  // Filter medications based on search
  const filteredCommonMedications = COMMON_MEDICATIONS.filter(
    (med) =>
      med.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !watchedMedications.some(
        (existing) => existing.name.toLowerCase() === med.toLowerCase()
      )
  );

  // Validation
  const validateMedicationName = (name: string): string | true => {
    if (!name.trim()) {
      return 'Medication name is required';
    }
    if (name.trim().length < 2) {
      return 'Medication name must be at least 2 characters';
    }
    return true;
  };

  const validateDosage = (
    dosageAmount: string,
    dosageUnit: string
  ): string | true => {
    if (!dosageAmount && !dosageUnit) {
      return true; // Optional
    }
    if (dosageAmount && !dosageUnit) {
      return 'Please select a dosage unit';
    }
    if (!dosageAmount && dosageUnit) {
      return 'Please enter dosage amount';
    }
    const amount = parseFloat(dosageAmount);
    if (isNaN(amount) || amount <= 0) {
      return 'Dosage amount must be a positive number';
    }
    return true;
  };

  const validateFrequency = (
    frequency: string,
    customFrequency: string
  ): string | true => {
    if (frequency === 'Other' && !customFrequency.trim()) {
      return 'Please specify custom frequency';
    }
    return true;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Current Medications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Document all current medications, supplements, and over-the-counter
            drugs
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Current Medications List */}
        {fields.length > 0 ? (
          <Box sx={{ mb: 3 }}>
            <Stack spacing={2}>
              {fields.map((field, index) => (
                <Card key={field.id} variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <MedicationIcon
                          sx={{ mr: 1, color: 'primary.main', fontSize: 20 }}
                        />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {field.name}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 2,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          <strong>Dosage:</strong>{' '}
                          {field.dosage || 'Not specified'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Frequency:</strong> {field.frequency}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit medication">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(field, index)}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove medication">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveMedication(index)}
                          disabled={disabled}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Stack>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              No medications recorded. Add current medications to help with drug
              interaction checking and clinical assessment.
            </Typography>
          </Alert>
        )}

        {/* Add Medication Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={disabled}
          >
            Add Medication
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Quick Add Common Medications */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            Quick Add Common Medications
          </Typography>

          <TextField
            size="small"
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              ),
            }}
            sx={{ mb: 2, maxWidth: 300 }}
            disabled={disabled}
          />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {filteredCommonMedications.slice(0, 15).map((medication) => (
              <Chip
                key={medication}
                label={medication}
                onClick={() => handleQuickAddMedication(medication)}
                disabled={disabled}
                sx={{ cursor: 'pointer' }}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>

          {filteredCommonMedications.length === 0 && searchTerm && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No medications found matching "{searchTerm}"
            </Typography>
          )}
        </Box>

        {/* Medication Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <MedicationIcon sx={{ mr: 1 }} />
              {editingIndex !== null ? 'Edit Medication' : 'Add Medication'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleDialogSubmit(handleSaveMedication)}>
              <Stack spacing={3}>
                {/* Medication Name */}
                <Controller
                  name="name"
                  control={dialogControl}
                  rules={{ validate: validateMedicationName }}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      options={COMMON_MEDICATIONS}
                      freeSolo
                      value={field.value}
                      onChange={(_, value) => field.onChange(value || '')}
                      onInputChange={(_, value) => field.onChange(value)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Medication Name"
                          placeholder="Enter or search medication name"
                          error={!!dialogErrors.name}
                          helperText={dialogErrors.name?.message}
                          required
                        />
                      )}
                    />
                  )}
                />

                {/* Dosage */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Dosage (Optional)
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="dosageAmount"
                      control={dialogControl}
                      rules={{
                        validate: (value) =>
                          validateDosage(value, watchedDialogValues.dosageUnit),
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Amount"
                          placeholder="10"
                          type="number"
                          slotProps={{
                            htmlInput: { min: 0, step: 0.1 },
                          }}
                          error={!!dialogErrors.dosageAmount}
                          helperText={dialogErrors.dosageAmount?.message}
                          fullWidth
                        />
                      )}
                    />
                    <Controller
                      name="dosageUnit"
                      control={dialogControl}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Unit</InputLabel>
                          <Select {...field} label="Unit">
                            {DOSAGE_UNITS.map((unit) => (
                              <MenuItem key={unit} value={unit}>
                                {unit}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Box>
                </Box>

                {/* Frequency */}
                <Box>
                  <Controller
                    name="frequency"
                    control={dialogControl}
                    rules={{
                      validate: (value) =>
                        validateFrequency(
                          value,
                          watchedDialogValues.customFrequency
                        ),
                    }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!dialogErrors.frequency}>
                        <InputLabel>Frequency</InputLabel>
                        <Select {...field} label="Frequency">
                          {FREQUENCY_OPTIONS.map((freq) => (
                            <MenuItem key={freq} value={freq}>
                              {freq}
                            </MenuItem>
                          ))}
                        </Select>
                        {dialogErrors.frequency && (
                          <FormHelperText>
                            {dialogErrors.frequency.message}
                          </FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />

                  {watchedDialogValues.frequency === 'Other' && (
                    <Controller
                      name="customFrequency"
                      control={dialogControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Custom Frequency"
                          placeholder="e.g., Every other day, Before meals"
                          fullWidth
                          sx={{ mt: 2 }}
                          error={!!dialogErrors.customFrequency}
                          helperText={dialogErrors.customFrequency?.message}
                        />
                      )}
                    />
                  )}
                </Box>

                {/* Information */}
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Tip:</strong> Include all medications, supplements,
                    vitamins, and over-the-counter drugs. This information is
                    crucial for checking drug interactions and ensuring patient
                    safety.
                  </Typography>
                </Alert>
              </Stack>
            </form>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleDialogSubmit(handleSaveMedication)}
              variant="contained"
            >
              {editingIndex !== null ? 'Update' : 'Add'} Medication
            </Button>
          </DialogActions>
        </Dialog>

        {/* Summary */}
        {fields.length > 0 && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Medication Summary:</strong> {fields.length} medication
              {fields.length > 1 ? 's' : ''} recorded. This information will be
              used for drug interaction checking during the diagnostic process.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MedicationHistoryInput;
