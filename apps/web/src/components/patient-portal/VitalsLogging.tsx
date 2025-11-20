import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  Alert,
  InputAdornment,
  FormControl,
  FormLabel,
  Divider,
  Chip,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Validation schema
const vitalsSchema = z.object({
  bloodPressureSystolic: z.number()
    .min(60, 'Systolic pressure too low')
    .max(250, 'Systolic pressure too high')
    .optional()
    .or(z.literal('')),
  bloodPressureDiastolic: z.number()
    .min(40, 'Diastolic pressure too low')
    .max(150, 'Diastolic pressure too high')
    .optional()
    .or(z.literal('')),
  heartRate: z.number()
    .min(30, 'Heart rate too low')
    .max(220, 'Heart rate too high')
    .optional()
    .or(z.literal('')),
  weight: z.number()
    .min(20, 'Weight too low')
    .max(300, 'Weight too high')
    .optional()
    .or(z.literal('')),
  glucose: z.number()
    .min(30, 'Glucose level too low')
    .max(600, 'Glucose level too high')
    .optional()
    .or(z.literal('')),
  temperature: z.number()
    .min(32, 'Temperature too low')
    .max(45, 'Temperature too high')
    .optional()
    .or(z.literal('')),
  oxygenSaturation: z.number()
    .min(70, 'Oxygen saturation too low')
    .max(100, 'Oxygen saturation too high')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(500, 'Notes too long').optional()
}).refine(
  (data) => {
    // At least one vital sign must be provided
    const hasVitals = [
      data.bloodPressureSystolic,
      data.bloodPressureDiastolic,
      data.heartRate,
      data.weight,
      data.glucose,
      data.temperature,
      data.oxygenSaturation
    ].some(value => value !== '' && value !== undefined);
    
    return hasVitals;
  },
  {
    message: 'At least one vital sign measurement is required',
    path: ['root']
  }
).refine(
  (data) => {
    // If systolic is provided, diastolic should also be provided
    const hasSystolic = data.bloodPressureSystolic !== '' && data.bloodPressureSystolic !== undefined;
    const hasDiastolic = data.bloodPressureDiastolic !== '' && data.bloodPressureDiastolic !== undefined;
    
    if (hasSystolic && !hasDiastolic) return false;
    if (hasDiastolic && !hasSystolic) return false;
    
    return true;
  },
  {
    message: 'Both systolic and diastolic blood pressure values are required',
    path: ['bloodPressure']
  }
);

type VitalsFormData = z.infer<typeof vitalsSchema>;

interface VitalsLoggingProps {
  onSubmit: (data: VitalsFormData) => Promise<void>;
  loading?: boolean;
}

const VitalsLogging: React.FC<VitalsLoggingProps> = ({ onSubmit, loading }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isDirty }
  } = useForm<VitalsFormData>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      heartRate: '',
      weight: '',
      glucose: '',
      temperature: '',
      oxygenSaturation: '',
      notes: ''
    },
    mode: 'onChange'
  });

  // Watch values for validation feedback
  const watchedValues = watch();

  const handleFormSubmit = async (data: VitalsFormData) => {
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Convert empty strings to undefined
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? undefined : value
        ])
      ) as VitalsFormData;

      await onSubmit(cleanedData);
      setSubmitSuccess(true);
      reset(); // Clear form after successful submission
      
      // Hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to log vitals');
    }
  };

  const handleClear = () => {
    reset();
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const getValidationStatus = (value: any, min: number, max: number) => {
    if (value === '' || value === undefined) return null;
    const numValue = Number(value);
    if (numValue < min || numValue > max) return 'error';
    if (numValue < min * 1.1 || numValue > max * 0.9) return 'warning';
    return 'success';
  };

  const getValidationMessage = (field: string, value: any) => {
    const ranges = {
      bloodPressureSystolic: { min: 90, max: 140, unit: 'mmHg' },
      bloodPressureDiastolic: { min: 60, max: 90, unit: 'mmHg' },
      heartRate: { min: 60, max: 100, unit: 'bpm' },
      glucose: { min: 70, max: 140, unit: 'mg/dL' },
      temperature: { min: 36.1, max: 37.2, unit: '°C' },
      oxygenSaturation: { min: 95, max: 100, unit: '%' }
    };

    const range = ranges[field as keyof typeof ranges];
    if (!range || value === '' || value === undefined) return null;

    const numValue = Number(value);
    const status = getValidationStatus(value, range.min, range.max);

    if (status === 'error') {
      return {
        type: 'error' as const,
        message: `Value outside normal range (${range.min}-${range.max} ${range.unit})`
      };
    }
    if (status === 'warning') {
      return {
        type: 'warning' as const,
        message: `Value near normal range limits (${range.min}-${range.max} ${range.unit})`
      };
    }
    if (status === 'success') {
      return {
        type: 'success' as const,
        message: `Normal range (${range.min}-${range.max} ${range.unit})`
      };
    }

    return null;
  };

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)}>
      {/* Success Message */}
      {submitSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Vitals logged successfully!
        </Alert>
      )}

      {/* Error Message */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      {/* Form Validation Error */}
      {errors.root && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.root.message}
        </Alert>
      )}

      {errors.bloodPressure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.bloodPressure.message}
        </Alert>
      )}

      {/* Basic Vitals */}
      <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon fontSize="small" />
        Basic Vitals
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Blood Pressure */}
        <Grid item xs={12}>
          <FormControl fullWidth>
            <FormLabel component="legend" sx={{ mb: 1 }}>
              Blood Pressure (mmHg)
            </FormLabel>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Controller
                  name="bloodPressureSystolic"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Systolic"
                      type="number"
                      size="small"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">mmHg</InputAdornment>
                      }}
                      error={!!errors.bloodPressureSystolic}
                      helperText={errors.bloodPressureSystolic?.message}
                      onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  )}
                />
                {getValidationMessage('bloodPressureSystolic', watchedValues.bloodPressureSystolic) && (
                  <Typography 
                    variant="caption" 
                    color={getValidationMessage('bloodPressureSystolic', watchedValues.bloodPressureSystolic)?.type + '.main'}
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {getValidationMessage('bloodPressureSystolic', watchedValues.bloodPressureSystolic)?.message}
                  </Typography>
                )}
              </Grid>
              
              <Grid item xs={6}>
                <Controller
                  name="bloodPressureDiastolic"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Diastolic"
                      type="number"
                      size="small"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">mmHg</InputAdornment>
                      }}
                      error={!!errors.bloodPressureDiastolic}
                      helperText={errors.bloodPressureDiastolic?.message}
                      onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  )}
                />
                {getValidationMessage('bloodPressureDiastolic', watchedValues.bloodPressureDiastolic) && (
                  <Typography 
                    variant="caption" 
                    color={getValidationMessage('bloodPressureDiastolic', watchedValues.bloodPressureDiastolic)?.type + '.main'}
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {getValidationMessage('bloodPressureDiastolic', watchedValues.bloodPressureDiastolic)?.message}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </FormControl>
        </Grid>

        {/* Heart Rate */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="heartRate"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Heart Rate"
                type="number"
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">bpm</InputAdornment>
                }}
                error={!!errors.heartRate}
                helperText={errors.heartRate?.message}
                onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
          {getValidationMessage('heartRate', watchedValues.heartRate) && (
            <Typography 
              variant="caption" 
              color={getValidationMessage('heartRate', watchedValues.heartRate)?.type + '.main'}
              sx={{ display: 'block', mt: 0.5 }}
            >
              {getValidationMessage('heartRate', watchedValues.heartRate)?.message}
            </Typography>
          )}
        </Grid>

        {/* Weight */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="weight"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Weight"
                type="number"
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">kg</InputAdornment>
                }}
                error={!!errors.weight}
                helperText={errors.weight?.message}
                onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Advanced Vitals */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="text"
          onClick={() => setShowAdvanced(!showAdvanced)}
          startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          size="small"
        >
          Advanced Measurements
        </Button>
      </Box>

      <Collapse in={showAdvanced}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Blood Glucose */}
          <Grid item xs={12} sm={6}>
            <Controller
              name="glucose"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Blood Glucose"
                  type="number"
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mg/dL</InputAdornment>
                  }}
                  error={!!errors.glucose}
                  helperText={errors.glucose?.message}
                  onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
              )}
            />
            {getValidationMessage('glucose', watchedValues.glucose) && (
              <Typography 
                variant="caption" 
                color={getValidationMessage('glucose', watchedValues.glucose)?.type + '.main'}
                sx={{ display: 'block', mt: 0.5 }}
              >
                {getValidationMessage('glucose', watchedValues.glucose)?.message}
              </Typography>
            )}
          </Grid>

          {/* Temperature */}
          <Grid item xs={12} sm={6}>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Temperature"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: 0.1 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">°C</InputAdornment>
                  }}
                  error={!!errors.temperature}
                  helperText={errors.temperature?.message}
                  onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
              )}
            />
            {getValidationMessage('temperature', watchedValues.temperature) && (
              <Typography 
                variant="caption" 
                color={getValidationMessage('temperature', watchedValues.temperature)?.type + '.main'}
                sx={{ display: 'block', mt: 0.5 }}
              >
                {getValidationMessage('temperature', watchedValues.temperature)?.message}
              </Typography>
            )}
          </Grid>

          {/* Oxygen Saturation */}
          <Grid item xs={12} sm={6}>
            <Controller
              name="oxygenSaturation"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Oxygen Saturation"
                  type="number"
                  size="small"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                  error={!!errors.oxygenSaturation}
                  helperText={errors.oxygenSaturation?.message}
                  onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
              )}
            />
            {getValidationMessage('oxygenSaturation', watchedValues.oxygenSaturation) && (
              <Typography 
                variant="caption" 
                color={getValidationMessage('oxygenSaturation', watchedValues.oxygenSaturation)?.type + '.main'}
                sx={{ display: 'block', mt: 0.5 }}
              >
                {getValidationMessage('oxygenSaturation', watchedValues.oxygenSaturation)?.message}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Collapse>

      {/* Notes */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Notes (Optional)"
                multiline
                rows={3}
                size="small"
                fullWidth
                placeholder="Add any notes about your measurements, symptoms, or circumstances..."
                error={!!errors.notes}
                helperText={errors.notes?.message}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleClear}
          startIcon={<ClearIcon />}
          disabled={loading || !isDirty}
        >
          Clear
        </Button>
        
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={loading || !isValid || !isDirty}
        >
          {loading ? 'Saving...' : 'Log Vitals'}
        </Button>
      </Box>

      {/* Help Information */}
      <Card variant="outlined" sx={{ mt: 3, bgcolor: 'grey.50' }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon fontSize="small" />
            Measurement Tips
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                • Take blood pressure after 5 minutes of rest
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Measure weight at the same time daily
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                • Check glucose as directed by your pharmacist
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Record any symptoms or unusual circumstances
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VitalsLogging;