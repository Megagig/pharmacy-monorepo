import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Alert,
  Chip,
  InputAdornment,
  FormHelperText,
  Tooltip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { VitalSignsInputProps } from '../types';

// Normal ranges for vital signs
const VITAL_RANGES = {
  bloodPressure: {
    systolic: { min: 90, max: 140, unit: 'mmHg' },
    diastolic: { min: 60, max: 90, unit: 'mmHg' },
    format: 'XXX/XX',
    example: '120/80',
  },
  heartRate: {
    min: 60,
    max: 100,
    unit: 'bpm',
    description: 'Resting heart rate',
  },
  temperature: {
    min: 36.1,
    max: 37.2,
    unit: '°C',
    description: 'Body temperature',
  },
  bloodGlucose: {
    fasting: { min: 70, max: 100, unit: 'mg/dL' },
    random: { min: 70, max: 140, unit: 'mg/dL' },
    description: 'Blood glucose level',
  },
  respiratoryRate: {
    min: 12,
    max: 20,
    unit: 'breaths/min',
    description: 'Respiratory rate',
  },
};

interface VitalSignsFormData {
  bloodPressure: string;
  heartRate: number | '';
  temperature: number | '';
  bloodGlucose: number | '';
  respiratoryRate: number | '';
}

const VitalSignsInput: React.FC<VitalSignsInputProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VitalSignsFormData>({
    defaultValues: {
      bloodPressure: value?.bloodPressure || '',
      heartRate: value?.heartRate || '',
      temperature: value?.temperature || '',
      bloodGlucose: value?.bloodGlucose || '',
      respiratoryRate: value?.respiratoryRate || '',
    },
  });

  // Update form when value prop changes (controlled component)
  React.useEffect(() => {
    if (value) {
      setValue('bloodPressure', value.bloodPressure || '');
      setValue('heartRate', value.heartRate || '');
      setValue('temperature', value.temperature || '');
      setValue('bloodGlucose', value.bloodGlucose || '');
      setValue('respiratoryRate', value.respiratoryRate || '');
    }
  }, [value, setValue]);

  const watchedValues = watch();

  // Update parent component when form values change
  React.useEffect(() => {
    const vitals = {
      bloodPressure: watchedValues.bloodPressure || undefined,
      heartRate: watchedValues.heartRate || undefined,
      temperature: watchedValues.temperature || undefined,
      bloodGlucose: watchedValues.bloodGlucose || undefined,
      respiratoryRate: watchedValues.respiratoryRate || undefined,
    };

    // Only include defined values
    const filteredVitals = Object.fromEntries(
      Object.entries(vitals).filter(([_, v]) => v !== undefined && v !== '')
    );

    onChange(
      Object.keys(filteredVitals).length > 0 ? filteredVitals : undefined
    );
  }, [watchedValues, onChange]);

  // Validation functions
  const validateBloodPressure = (bp: string): string | true => {
    if (!bp) return true; // Optional field

    const bpRegex = /^(\d{2,3})\/(\d{2,3})$/;
    const match = bp.match(bpRegex);

    if (!match) {
      return 'Format: XXX/XX (e.g., 120/80)';
    }

    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);

    if (systolic < 70 || systolic > 250) {
      return 'Systolic pressure should be between 70-250 mmHg';
    }

    if (diastolic < 40 || diastolic > 150) {
      return 'Diastolic pressure should be between 40-150 mmHg';
    }

    if (systolic <= diastolic) {
      return 'Systolic pressure should be higher than diastolic';
    }

    return true;
  };

  const validateHeartRate = (hr: number): string | true => {
    if (!hr) return true; // Optional field

    if (hr < 30 || hr > 220) {
      return 'Heart rate should be between 30-220 bpm';
    }

    return true;
  };

  const validateTemperature = (temp: number): string | true => {
    if (!temp) return true; // Optional field

    if (temp < 32 || temp > 45) {
      return 'Temperature should be between 32-45°C';
    }

    return true;
  };

  const validateBloodGlucose = (bg: number): string | true => {
    if (!bg) return true; // Optional field

    if (bg < 20 || bg > 600) {
      return 'Blood glucose should be between 20-600 mg/dL';
    }

    return true;
  };

  const validateRespiratoryRate = (rr: number): string | true => {
    if (!rr) return true; // Optional field

    if (rr < 5 || rr > 60) {
      return 'Respiratory rate should be between 5-60 breaths/min';
    }

    return true;
  };

  // Status indicators
  const getBloodPressureStatus = (bp: string) => {
    const match = bp.match(/^(\d{2,3})\/(\d{2,3})$/);
    if (!match) return null;

    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);

    if (systolic < 90 || diastolic < 60) {
      return { status: 'low', color: 'warning', text: 'Low BP' };
    }

    if (systolic > 140 || diastolic > 90) {
      return { status: 'high', color: 'error', text: 'High BP' };
    }

    if (
      systolic >= 120 &&
      systolic <= 140 &&
      diastolic >= 80 &&
      diastolic <= 90
    ) {
      return { status: 'elevated', color: 'warning', text: 'Elevated' };
    }

    return { status: 'normal', color: 'success', text: 'Normal' };
  };

  const getVitalStatus = (
    value: number,
    range: { min: number; max: number }
  ) => {
    if (!value) return null;

    if (value < range.min) {
      return { status: 'low', color: 'warning', text: 'Low' };
    }

    if (value > range.max) {
      return { status: 'high', color: 'error', text: 'High' };
    }

    return { status: 'normal', color: 'success', text: 'Normal' };
  };

  const getBloodGlucoseStatus = (bg: number) => {
    if (!bg) return null;

    // Assuming random glucose for simplicity
    if (bg < 70) {
      return { status: 'low', color: 'error', text: 'Hypoglycemia' };
    }

    if (bg > 200) {
      return { status: 'high', color: 'error', text: 'Hyperglycemia' };
    }

    if (bg > 140) {
      return { status: 'elevated', color: 'warning', text: 'Elevated' };
    }

    return { status: 'normal', color: 'success', text: 'Normal' };
  };

  const StatusChip = ({ status }: { status: any }) => {
    if (!status) return null;

    const Icon = status.status === 'normal' ? CheckCircleIcon : WarningIcon;

    return (
      <Chip
        icon={<Icon sx={{ fontSize: 16 }} />}
        label={status.text}
        size="small"
        color={status.color}
        variant="outlined"
        sx={{ ml: 1 }}
      />
    );
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Vital Signs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Record current vital signs and physiological measurements
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Blood Pressure */}
          <Box>
            <Controller
              name="bloodPressure"
              control={control}
              rules={{ validate: validateBloodPressure }}
              render={({ field }) => (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Blood Pressure
                    </Typography>
                    <Tooltip title="Normal: 90-140/60-90 mmHg">
                      <InfoIcon
                        sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                      />
                    </Tooltip>
                    <StatusChip status={getBloodPressureStatus(field.value)} />
                  </Box>
                  <TextField
                    {...field}
                    fullWidth
                    label="Blood Pressure"
                    placeholder="120/80"
                    disabled={disabled}
                    error={!!errors.bloodPressure}
                    helperText={
                      errors.bloodPressure?.message ||
                      'Format: systolic/diastolic (e.g., 120/80)'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">mmHg</InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>
              )}
            />
          </Box>

          {/* Heart Rate */}
          <Box>
            <Controller
              name="heartRate"
              control={control}
              rules={{ validate: validateHeartRate }}
              render={({ field }) => (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Heart Rate
                    </Typography>
                    <Tooltip title="Normal: 60-100 bpm (resting)">
                      <InfoIcon
                        sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                      />
                    </Tooltip>
                    <StatusChip
                      status={getVitalStatus(
                        Number(field.value),
                        VITAL_RANGES.heartRate
                      )}
                    />
                  </Box>
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Heart Rate"
                    placeholder="72"
                    disabled={disabled}
                    error={!!errors.heartRate}
                    helperText={
                      errors.heartRate?.message || 'Resting heart rate'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">bpm</InputAdornment>
                        ),
                      },
                      htmlInput: { min: 30, max: 220, step: 1 },
                    }}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  />
                </Box>
              )}
            />
          </Box>

          {/* Temperature */}
          <Box>
            <Controller
              name="temperature"
              control={control}
              rules={{ validate: validateTemperature }}
              render={({ field }) => (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Temperature
                    </Typography>
                    <Tooltip title="Normal: 36.1-37.2°C">
                      <InfoIcon
                        sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                      />
                    </Tooltip>
                    <StatusChip
                      status={getVitalStatus(
                        Number(field.value),
                        VITAL_RANGES.temperature
                      )}
                    />
                  </Box>
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Temperature"
                    placeholder="36.5"
                    disabled={disabled}
                    error={!!errors.temperature}
                    helperText={
                      errors.temperature?.message || 'Body temperature'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">°C</InputAdornment>
                        ),
                      },
                      htmlInput: { min: 32, max: 45, step: 0.1 },
                    }}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  />
                </Box>
              )}
            />
          </Box>

          {/* Respiratory Rate */}
          <Box>
            <Controller
              name="respiratoryRate"
              control={control}
              rules={{ validate: validateRespiratoryRate }}
              render={({ field }) => (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Respiratory Rate
                    </Typography>
                    <Tooltip title="Normal: 12-20 breaths/min">
                      <InfoIcon
                        sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                      />
                    </Tooltip>
                    <StatusChip
                      status={getVitalStatus(
                        Number(field.value),
                        VITAL_RANGES.respiratoryRate
                      )}
                    />
                  </Box>
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Respiratory Rate"
                    placeholder="16"
                    disabled={disabled}
                    error={!!errors.respiratoryRate}
                    helperText={
                      errors.respiratoryRate?.message || 'Breaths per minute'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            breaths/min
                          </InputAdornment>
                        ),
                      },
                      htmlInput: { min: 5, max: 60, step: 1 },
                    }}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  />
                </Box>
              )}
            />
          </Box>

          {/* Blood Glucose */}
          <Box>
            <Controller
              name="bloodGlucose"
              control={control}
              rules={{ validate: validateBloodGlucose }}
              render={({ field }) => (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Blood Glucose
                    </Typography>
                    <Tooltip title="Normal: 70-140 mg/dL (random), 70-100 mg/dL (fasting)">
                      <InfoIcon
                        sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                      />
                    </Tooltip>
                    <StatusChip
                      status={getBloodGlucoseStatus(Number(field.value))}
                    />
                  </Box>
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Blood Glucose"
                    placeholder="95"
                    disabled={disabled}
                    error={!!errors.bloodGlucose}
                    helperText={
                      errors.bloodGlucose?.message ||
                      'Random or fasting glucose level'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">mg/dL</InputAdornment>
                        ),
                      },
                      htmlInput: { min: 20, max: 600, step: 1 },
                    }}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  />
                </Box>
              )}
            />
          </Box>
        </Box>

        {/* Reference Ranges Info */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Normal Reference Ranges:
          </Typography>
          <Typography variant="body2" component="div">
            • Blood Pressure: 90-140/60-90 mmHg
            <br />
            • Heart Rate: 60-100 bpm (resting)
            <br />
            • Temperature: 36.1-37.2°C
            <br />
            • Respiratory Rate: 12-20 breaths/min
            <br />• Blood Glucose: 70-100 mg/dL (fasting), 70-140 mg/dL (random)
          </Typography>
        </Alert>

        {/* Critical Values Warning */}
        {((watchedValues.heartRate &&
          (Number(watchedValues.heartRate) < 50 ||
            Number(watchedValues.heartRate) > 120)) ||
          (watchedValues.temperature &&
            (Number(watchedValues.temperature) < 35 ||
              Number(watchedValues.temperature) > 39)) ||
          (watchedValues.bloodGlucose &&
            (Number(watchedValues.bloodGlucose) < 60 ||
              Number(watchedValues.bloodGlucose) > 250)) ||
          (watchedValues.respiratoryRate &&
            (Number(watchedValues.respiratoryRate) < 10 ||
              Number(watchedValues.respiratoryRate) > 30))) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Critical Values Detected:</strong> Some vital signs are
              outside normal ranges and may require immediate attention.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default VitalSignsInput;
