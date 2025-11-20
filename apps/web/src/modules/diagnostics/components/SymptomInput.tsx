import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Autocomplete,
  IconButton,
  Divider,
  Alert,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import type { SymptomInputProps } from '../types';

// Common symptoms for quick selection
const COMMON_SYMPTOMS = {
  subjective: [
    'Headache',
    'Nausea',
    'Vomiting',
    'Dizziness',
    'Fatigue',
    'Chest pain',
    'Shortness of breath',
    'Abdominal pain',
    'Back pain',
    'Joint pain',
    'Muscle aches',
    'Fever',
    'Chills',
    'Cough',
    'Sore throat',
    'Runny nose',
    'Congestion',
    'Loss of appetite',
    'Weight loss',
    'Weight gain',
    'Sleep problems',
    'Anxiety',
    'Depression',
    'Confusion',
    'Memory problems',
  ],
  objective: [
    'Elevated temperature',
    'High blood pressure',
    'Low blood pressure',
    'Rapid heart rate',
    'Slow heart rate',
    'Irregular heart rate',
    'Rapid breathing',
    'Shallow breathing',
    'Wheezing',
    'Rales/crackles',
    'Decreased breath sounds',
    'Swelling (edema)',
    'Skin rash',
    'Pale skin',
    'Jaundice',
    'Cyanosis',
    'Dehydration',
    'Enlarged lymph nodes',
    'Abdominal distension',
    'Tenderness',
    'Muscle weakness',
    'Tremor',
    'Altered mental status',
    'Decreased mobility',
  ],
};

const DURATION_OPTIONS = [
  'Less than 1 hour',
  '1-6 hours',
  '6-24 hours',
  '1-3 days',
  '3-7 days',
  '1-2 weeks',
  '2-4 weeks',
  '1-3 months',
  '3-6 months',
  'More than 6 months',
];

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: 'success' as const },
  { value: 'moderate', label: 'Moderate', color: 'warning' as const },
  { value: 'severe', label: 'Severe', color: 'error' as const },
];

const ONSET_OPTIONS = [
  {
    value: 'acute',
    label: 'Acute (sudden)',
    description: 'Symptoms started suddenly',
  },
  {
    value: 'subacute',
    label: 'Subacute (gradual)',
    description: 'Symptoms developed gradually over days',
  },
  {
    value: 'chronic',
    label: 'Chronic (long-term)',
    description: 'Long-standing symptoms',
  },
];

interface SymptomFormData {
  subjective: string[];
  objective: string[];
  duration: string;
  severity: 'mild' | 'moderate' | 'severe';
  onset: 'acute' | 'chronic' | 'subacute';
  newSubjective: string;
  newObjective: string;
}

const SymptomInput: React.FC<SymptomInputProps> = ({
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const [showCommonSymptoms, setShowCommonSymptoms] = useState(false);

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SymptomFormData>({
    defaultValues: {
      subjective: value?.subjective || [],
      objective: value?.objective || [],
      duration: value?.duration || '',
      severity: value?.severity || 'mild',
      onset: value?.onset || 'acute',
      newSubjective: '',
      newObjective: '',
    },
  });

  const watchedValues = watch();

  // Update parent component when form values change
  React.useEffect(() => {
    const { newSubjective, newObjective, ...symptomData } = watchedValues;
    onChange(symptomData);
  }, [watchedValues, onChange]);

  const handleAddSubjective = useCallback(() => {
    const newSymptom = watchedValues.newSubjective.trim();
    if (newSymptom && !watchedValues.subjective.includes(newSymptom)) {
      const updated = [...watchedValues.subjective, newSymptom];
      setValue('subjective', updated);
      setValue('newSubjective', '');
    }
  }, [watchedValues.newSubjective, watchedValues.subjective, setValue]);

  const handleAddObjective = useCallback(() => {
    const newSymptom = watchedValues.newObjective.trim();
    if (newSymptom && !watchedValues.objective.includes(newSymptom)) {
      const updated = [...watchedValues.objective, newSymptom];
      setValue('objective', updated);
      setValue('newObjective', '');
    }
  }, [watchedValues.newObjective, watchedValues.objective, setValue]);

  const handleRemoveSubjective = useCallback(
    (symptom: string) => {
      const updated = watchedValues.subjective.filter((s) => s !== symptom);
      setValue('subjective', updated);
    },
    [watchedValues.subjective, setValue]
  );

  const handleRemoveObjective = useCallback(
    (symptom: string) => {
      const updated = watchedValues.objective.filter((s) => s !== symptom);
      setValue('objective', updated);
    },
    [watchedValues.objective, setValue]
  );

  const handleQuickAddSymptom = useCallback(
    (symptom: string, type: 'subjective' | 'objective') => {
      const currentSymptoms = watchedValues[type];
      if (!currentSymptoms.includes(symptom)) {
        const updated = [...currentSymptoms, symptom];
        setValue(type, updated);
      }
    },
    [watchedValues, setValue]
  );

  const getSeverityColor = (severity: string) => {
    const option = SEVERITY_OPTIONS.find((opt) => opt.value === severity);
    return option?.color || 'default';
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Symptom Assessment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Document patient-reported symptoms and clinical observations
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={4}>
          {/* Subjective Symptoms */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Subjective Symptoms
              </Typography>
              <Tooltip title="Symptoms reported by the patient">
                <InfoIcon
                  sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                />
              </Tooltip>
            </Box>

            {/* Current subjective symptoms */}
            {watchedValues.subjective.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  {watchedValues.subjective.map((symptom) => (
                    <Chip
                      key={symptom}
                      label={symptom}
                      onDelete={
                        disabled
                          ? undefined
                          : () => handleRemoveSubjective(symptom)
                      }
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Add new subjective symptom */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Controller
                name="newSubjective"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    placeholder="Add subjective symptom..."
                    disabled={disabled}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubjective();
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                )}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddSubjective}
                disabled={disabled || !watchedValues.newSubjective.trim()}
                startIcon={<AddIcon />}
              >
                Add
              </Button>
            </Box>

            {/* Common subjective symptoms */}
            <Box>
              <Button
                variant="text"
                size="small"
                onClick={() => setShowCommonSymptoms(!showCommonSymptoms)}
                disabled={disabled}
              >
                {showCommonSymptoms ? 'Hide' : 'Show'} Common Symptoms
              </Button>
              {showCommonSymptoms && (
                <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 1, display: 'block' }}
                  >
                    Click to add common subjective symptoms:
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ flexWrap: 'wrap', gap: 0.5 }}
                  >
                    {COMMON_SYMPTOMS.subjective.map((symptom) => (
                      <Chip
                        key={symptom}
                        label={symptom}
                        size="small"
                        onClick={() =>
                          handleQuickAddSymptom(symptom, 'subjective')
                        }
                        disabled={
                          disabled || watchedValues.subjective.includes(symptom)
                        }
                        sx={{ cursor: 'pointer' }}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Objective Findings */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Objective Findings
              </Typography>
              <Tooltip title="Clinical observations and examination findings">
                <InfoIcon
                  sx={{ ml: 1, fontSize: 16, color: 'text.secondary' }}
                />
              </Tooltip>
            </Box>

            {/* Current objective findings */}
            {watchedValues.objective.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  {watchedValues.objective.map((finding) => (
                    <Chip
                      key={finding}
                      label={finding}
                      onDelete={
                        disabled
                          ? undefined
                          : () => handleRemoveObjective(finding)
                      }
                      color="secondary"
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Add new objective finding */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Controller
                name="newObjective"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    size="small"
                    placeholder="Add objective finding..."
                    disabled={disabled}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddObjective();
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                )}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddObjective}
                disabled={disabled || !watchedValues.newObjective.trim()}
                startIcon={<AddIcon />}
              >
                Add
              </Button>
            </Box>

            {/* Common objective findings */}
            <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                Click to add common objective findings:
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {COMMON_SYMPTOMS.objective.map((finding) => (
                  <Chip
                    key={finding}
                    label={finding}
                    size="small"
                    onClick={() => handleQuickAddSymptom(finding, 'objective')}
                    disabled={
                      disabled || watchedValues.objective.includes(finding)
                    }
                    sx={{ cursor: 'pointer' }}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          </Box>

          <Divider />

          {/* Symptom Characteristics */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Symptom Characteristics
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                gap: 3,
              }}
            >
              {/* Duration */}
              <Box>
                <Controller
                  name="duration"
                  control={control}
                  rules={{ required: 'Duration is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.duration}>
                      <InputLabel>Duration</InputLabel>
                      <Select {...field} label="Duration" disabled={disabled}>
                        {DURATION_OPTIONS.map((duration) => (
                          <MenuItem key={duration} value={duration}>
                            {duration}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.duration && (
                        <FormHelperText>
                          {errors.duration.message}
                        </FormHelperText>
                      )}
                    </FormControl>
                  )}
                />
              </Box>

              {/* Severity */}
              <Box>
                <Controller
                  name="severity"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Severity</InputLabel>
                      <Select {...field} label="Severity" disabled={disabled}>
                        {SEVERITY_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Chip
                                label={option.label}
                                size="small"
                                color={option.color}
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              {/* Onset */}
              <Box>
                <Controller
                  name="onset"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Onset</InputLabel>
                      <Select {...field} label="Onset" disabled={disabled}>
                        {ONSET_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            <Box>
                              <Typography variant="body2">
                                {option.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {option.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>
            </Box>
          </Box>

          {/* Validation Summary */}
          {watchedValues.subjective.length === 0 &&
            watchedValues.objective.length === 0 && (
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2">
                  Please add at least one subjective symptom or objective
                  finding to proceed with the assessment.
                </Typography>
              </Alert>
            )}

          {/* Summary */}
          {(watchedValues.subjective.length > 0 ||
            watchedValues.objective.length > 0) && (
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Assessment Summary:
              </Typography>
              <Typography variant="body2">
                {watchedValues.subjective.length} subjective symptom(s),{' '}
                {watchedValues.objective.length} objective finding(s)
                {watchedValues.duration &&
                  ` • Duration: ${watchedValues.duration}`}
                {watchedValues.severity && (
                  <>
                    {' • Severity: '}
                    <Chip
                      label={
                        SEVERITY_OPTIONS.find(
                          (opt) => opt.value === watchedValues.severity
                        )?.label
                      }
                      size="small"
                      color={getSeverityColor(watchedValues.severity)}
                      variant="outlined"
                      sx={{ ml: 0.5, height: 20 }}
                    />
                  </>
                )}
                {watchedValues.onset &&
                  ` • Onset: ${ONSET_OPTIONS.find((opt) => opt.value === watchedValues.onset)?.label}`}
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SymptomInput;
