import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Grid,
  Alert,
  TextareaAutosize,
  FormHelperText,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';

import {
  ClinicalNoteFormData,
  NOTE_TYPES,
  NOTE_PRIORITIES,
} from '../types/clinicalNote';

// Validation functions
const validateForm = (data: ClinicalNoteFormData) => {
  const errors: any = {};

  if (!data.patient) {
    errors.patient = { message: 'Patient is required' };
  }

  if (!data.title || data.title.trim().length < 3) {
    errors.title = {
      message: 'Title is required and must be at least 3 characters',
    };
  }

  if (!data.type) {
    errors.type = { message: 'Note type is required' };
  }

  // Check if at least one content section is filled
  const hasContent =
    data.content &&
    (data.content.subjective?.trim() ||
      data.content.objective?.trim() ||
      data.content.assessment?.trim() ||
      data.content.plan?.trim());

  if (!hasContent) {
    errors.content = { message: 'At least one content section is required' };
  }

  return errors;
};

interface SimpleClinicalNoteFormProps {
  noteId?: string;
  patientId?: string;
  onSave?: (note: any) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

const SimpleClinicalNoteForm: React.FC<SimpleClinicalNoteFormProps> = ({
  noteId,
  patientId,
  onSave,
  onCancel,
  readonly = false,
}) => {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    formState: { errors, isDirty },
    setError,
    clearErrors,
  } = useForm<ClinicalNoteFormData>({
    defaultValues: {
      patient: patientId || '',
      type: 'consultation',
      title: '',
      content: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
      },
      priority: 'medium',
      isConfidential: false,
      followUpRequired: false,
    },
    mode: 'onChange',
  });

  // Custom validation
  const [isValid, setIsValid] = useState(false);
  const watchedValues = watch();
  const followUpRequired = watch('followUpRequired');

  // Validate form on change
  useEffect(() => {
    const formData = getValues();
    const validationErrors = validateForm(formData);
    const hasErrors = Object.keys(validationErrors).length > 0;

    setIsValid(!hasErrors);

    // Clear existing errors
    clearErrors();

    // Set new errors
    Object.entries(validationErrors).forEach(
      ([field, error]: [string, any]) => {
        setError(field as any, error);
      }
    );
  }, [watchedValues, getValues, setError, clearErrors]);

  // Handle form submission
  const onSubmit = async (data: ClinicalNoteFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onSave?.(data);
    } catch (error) {
      setSubmitError('Failed to save note. Please try again.');
      console.error('Failed to save note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" component="h1">
          {noteId ? 'Edit Clinical Note' : 'Create Clinical Note'}
        </Typography>

        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            onClick={onCancel}
            startIcon={<CancelIcon />}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          {!readonly && (
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Display */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {submitError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Basic Information Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>

              <Grid container spacing={2}>
                {/* Patient ID (simplified) */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="patient"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Patient ID *"
                        fullWidth
                        error={!!errors.patient}
                        helperText={errors.patient?.message}
                        disabled={readonly}
                        placeholder="Enter patient ID"
                      />
                    )}
                  />
                </Grid>

                {/* Note Title */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Note Title *"
                        fullWidth
                        error={!!errors.title}
                        helperText={errors.title?.message}
                        disabled={readonly}
                      />
                    )}
                  />
                </Grid>

                {/* Note Type */}
                <Grid item xs={12} md={4}>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.type}>
                        <InputLabel>Note Type *</InputLabel>
                        <Select
                          {...field}
                          label="Note Type *"
                          disabled={readonly}
                        >
                          {NOTE_TYPES.map((type) => (
                            <MenuItem key={type.value} value={type.value}>
                              {type.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.type && (
                          <FormHelperText>{errors.type.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Priority */}
                <Grid item xs={12} md={4}>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select {...field} label="Priority" disabled={readonly}>
                          {NOTE_PRIORITIES.map((priority) => (
                            <MenuItem
                              key={priority.value}
                              value={priority.value}
                            >
                              <Box display="flex" alignItems="center" gap={1}>
                                <Box
                                  width={12}
                                  height={12}
                                  borderRadius="50%"
                                  bgcolor={priority.color}
                                />
                                {priority.label}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>

                {/* Confidential */}
                <Grid item xs={12} md={4}>
                  <Controller
                    name="isConfidential"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            {...field}
                            checked={field.value}
                            disabled={readonly}
                          />
                        }
                        label="Confidential Note"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* SOAP Content Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SOAP Note Content
              </Typography>

              {errors.content && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.content.message}
                </Alert>
              )}

              <Grid container spacing={3}>
                {/* Subjective */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Subjective
                  </Typography>
                  <Controller
                    name="content.subjective"
                    control={control}
                    render={({ field }) => (
                      <TextareaAutosize
                        {...field}
                        minRows={4}
                        maxRows={8}
                        placeholder="Patient's subjective complaints, symptoms, and history..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                        disabled={readonly}
                      />
                    )}
                  />
                </Grid>

                {/* Objective */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Objective
                  </Typography>
                  <Controller
                    name="content.objective"
                    control={control}
                    render={({ field }) => (
                      <TextareaAutosize
                        {...field}
                        minRows={4}
                        maxRows={8}
                        placeholder="Observable findings, vital signs, physical examination..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                        disabled={readonly}
                      />
                    )}
                  />
                </Grid>

                {/* Assessment */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Assessment
                  </Typography>
                  <Controller
                    name="content.assessment"
                    control={control}
                    render={({ field }) => (
                      <TextareaAutosize
                        {...field}
                        minRows={4}
                        maxRows={8}
                        placeholder="Clinical assessment, diagnosis, and professional judgment..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                        disabled={readonly}
                      />
                    )}
                  />
                </Grid>

                {/* Plan */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Plan
                  </Typography>
                  <Controller
                    name="content.plan"
                    control={control}
                    render={({ field }) => (
                      <TextareaAutosize
                        {...field}
                        minRows={4}
                        maxRows={8}
                        placeholder="Treatment plan, interventions, and follow-up instructions..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                        disabled={readonly}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Follow-up Section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12}>
                  <Controller
                    name="followUpRequired"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            {...field}
                            checked={field.value}
                            disabled={readonly}
                          />
                        }
                        label="Follow-up Required"
                      />
                    )}
                  />
                </Grid>

                {followUpRequired && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      Follow-up scheduling will be available after saving the
                      note.
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimpleClinicalNoteForm;
