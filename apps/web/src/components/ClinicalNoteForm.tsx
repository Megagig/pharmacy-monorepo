import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
  Chip,
  Button,
  Grid,
  Divider,
  Alert,
  Autocomplete,
  TextareaAutosize,
  FormHelperText,
  CircularProgress,
  Collapse,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ClinicalNotesErrorBoundary from './ClinicalNotesErrorBoundary';
import {
  ClinicalNotesLoadingState,
  LoadingOverlay,
} from './ClinicalNotesLoadingStates';
import {
  ValidationFeedback,
  useRealTimeValidation,
  ValidationInputAdornment,
} from './ClinicalNotesValidation';
import {
  useClinicalNotesErrorHandling,
  useDuplicateSubmissionPrevention,
  useFormValidationFeedback,
} from '../hooks/useClinicalNotesErrorHandling';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Save as AutoSaveIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

import { useSearchPatients, usePatients } from '../queries/usePatients';
import {
  useClinicalNote,
  useCreateClinicalNote,
  useUpdateClinicalNote,
} from '../queries/clinicalNoteQueries';
import {
  ClinicalNoteFormData,
  NOTE_TYPES,
  NOTE_PRIORITIES,
  LAB_RESULT_STATUSES,
  LabResult,
  VitalSigns,
} from '../types/clinicalNote';
import { clinicalNoteUtils } from '../services/clinicalNoteService';
import clinicalNoteService from '../services/clinicalNoteService';
import NoteFileUpload from './NoteFileUpload';

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

  if (data.followUpRequired && !data.followUpDate) {
    errors.followUpDate = {
      message:
        'Follow-up date is required when follow-up is marked as required',
    };
  }

  return errors;
};

interface ClinicalNoteFormProps {
  noteId?: string;
  patientId?: string;
  onSave?: (note: any) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

interface FormSection {
  id: string;
  title: string;
  expanded: boolean;
}

const ClinicalNoteForm: React.FC<ClinicalNoteFormProps> = ({
  noteId: propNoteId,
  patientId: propPatientId,
  onSave,
  onCancel,
  readonly = false,
}) => {
  // Get URL parameters
  const { id: routeNoteId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Determine actual noteId and patientId from props or URL
  const noteId = propNoteId || routeNoteId;
  const patientId = propPatientId || searchParams.get('patientId') || undefined;
  const isEditMode = !!noteId;
  // State management
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Enhanced error handling and validation
  const { handleError, getErrors, clearError, hasErrors } =
    useClinicalNotesErrorHandling();

  const { preventDuplicateSubmission, isSubmitting } =
    useDuplicateSubmissionPrevention();

  const { validateField, hasFieldError, getFieldError, clearFieldValidation } =
    useFormValidationFeedback();
  const [sections, setSections] = useState<FormSection[]>([
    { id: 'basic', title: 'Basic Information', expanded: true },
    { id: 'soap', title: 'SOAP Note Content', expanded: true },
    { id: 'vitals', title: 'Vital Signs', expanded: false },
    { id: 'labs', title: 'Lab Results', expanded: false },
    { id: 'attachments', title: 'Attachments', expanded: false },
    { id: 'additional', title: 'Additional Information', expanded: false },
  ]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Queries and mutations
  const { data: existingNote, isLoading: noteLoading } = useClinicalNote(
    noteId || '',
    { enabled: !!noteId }
  );
  // Form setup - must be declared before using watch
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
    reset,
    setError,
    clearErrors,
  } = useForm<ClinicalNoteFormData>({
    defaultValues: clinicalNoteUtils.createEmptyNoteData(patientId),
    mode: 'onChange',
  });

  // Custom validation
  const [isValid, setIsValid] = useState(false);

  // Watch form values for auto-save
  const watchedValues = watch();
  const followUpRequired = watch('followUpRequired');

  // Load all patients initially, then filter by search query
  // Use a stable empty object to prevent unnecessary re-renders
  const emptyFilters = useMemo(() => ({}), []);
  const { data: allPatientsData, isLoading: allPatientsLoading } =
    usePatients(emptyFilters);

  const { data: patientSearchResults, isLoading: searchLoading } =
    useSearchPatients(debouncedSearchQuery);

  const patientsLoading = debouncedSearchQuery
    ? searchLoading
    : allPatientsLoading;
  const createNoteMutation = useCreateClinicalNote();
  const updateNoteMutation = useUpdateClinicalNote();

  // Store previous validation errors to prevent unnecessary updates
  const previousValidationErrors = useRef<unknown>({});

  // Validate form on change - use a more stable approach to prevent infinite loops
  const validateFormData = useCallback(() => {
    const formData = getValues();
    const validationErrors = validateForm(formData);
    const hasErrors = Object.keys(validationErrors).length > 0;

    setIsValid(!hasErrors);

    // Check if errors have actually changed by comparing with previous errors
    const currentErrorKeys = Object.keys(previousValidationErrors.current);
    const newErrorKeys = Object.keys(validationErrors);

    const errorsChanged =
      currentErrorKeys.length !== newErrorKeys.length ||
      currentErrorKeys.some((key) => !validationErrors[key]) ||
      newErrorKeys.some((key) => {
        const prevError = previousValidationErrors.current[key];
        const newError = validationErrors[key];
        return !prevError || prevError.message !== newError?.message;
      });

    if (errorsChanged) {
      // Store current errors for next comparison
      previousValidationErrors.current = { ...validationErrors };

      // Clear existing errors
      clearErrors();

      // Set new errors
      Object.entries(validationErrors).forEach(
        ([field, error]: [string, unknown]) => {
          setError(field as unknown, error);
        }
      );
    }
  }, [getValues, setError, clearErrors]);

  // Debounced validation to prevent excessive calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateFormData();
    }, 100); // Small delay to debounce validation

    return () => clearTimeout(timeoutId);
  }, [watchedValues, validateFormData]);

  // Debounce patient search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(patientSearchQuery);
    }, 300); // 300ms delay for search

    return () => clearTimeout(timeoutId);
  }, [patientSearchQuery]);

  // Field arrays for dynamic content
  const {
    fields: labFields,
    append: appendLab,
    remove: removeLab,
  } = useFieldArray({
    control,
    name: 'laborResults',
  });

  const {
    fields: recommendationFields,
    append: appendRecommendation,
    remove: removeRecommendation,
  } = useFieldArray({
    control,
    name: 'recommendations',
  });

  const {
    fields: tagFields,
    append: appendTag,
    remove: removeTag,
  } = useFieldArray({
    control,
    name: 'tags',
  });

  // Load existing note data
  useEffect(() => {
    if (existingNote?.note) {
      const note = existingNote.note;
      reset({
        patient: note.patient?._id || '',
        title: note.title,
        type: note.type,
        content: note.content,
        medications: note.medications || [],
        vitalSigns: note.vitalSigns,
        laborResults: note.laborResults || [],
        recommendations: note.recommendations || [],
        followUpRequired: note.followUpRequired,
        followUpDate: note.followUpDate
          ? new Date(note.followUpDate).toISOString()
          : undefined,
        priority: note.priority,
        isConfidential: note.isConfidential,
        tags: note.tags || [],
      });
    }
  }, [existingNote, reset]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!autoSaveEnabled || !isDirty || !isValid || readonly) return;

    try {
      const formData = getValues();
      if (noteId) {
        await updateNoteMutation.mutateAsync({ id: noteId, data: formData });
      } else {
        // For new notes, we might want to save as draft
        // This would require backend support for draft notes
      }
      setLastSaved(new Date());
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [
    autoSaveEnabled,
    isDirty,
    isValid,
    readonly,
    noteId,
    getValues,
    updateNoteMutation,
  ]);

  // Auto-save timer - use isDirty instead of watchedValues to prevent excessive re-renders
  useEffect(() => {
    if (!autoSaveEnabled || readonly || !isDirty) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(timer);
  }, [isDirty, autoSave, autoSaveEnabled, readonly]);

  // Track unsaved changes
  useEffect(() => {
    setUnsavedChanges(isDirty);
  }, [isDirty]);

  // Handle form submission
  const onSubmit = async (data: ClinicalNoteFormData) => {
    try {



      let result;
      if (noteId) {
        result = await updateNoteMutation.mutateAsync({ id: noteId, data });
      } else {
        result = await createNoteMutation.mutateAsync(data);

        // Upload attachments for new notes
        if (result.note && attachments.length > 0) {
          const filesToUpload = attachments
            .filter((att) => att.file && att.uploadStatus === 'pending')
            .map((att) => att.file!);

          if (filesToUpload.length > 0) {
            try {
              await clinicalNoteService.uploadAttachment(
                result.note._id,
                filesToUpload
              );
            } catch (uploadError) {
              console.error('Failed to upload attachments:', uploadError);
              setAttachmentError(
                'Some attachments failed to upload. You can try uploading them again.'
              );
            }
          }
        }
      }

      setLastSaved(new Date());
      setUnsavedChanges(false);

      if (onSave) {
        onSave(result.note);
      } else {
        // Default navigation behavior
        if (patientId) {
          // Navigate back to patient profile if created from patient context
          navigate(`/patients/${patientId}`);
        } else {
          // Navigate to notes dashboard
          navigate('/notes');
        }
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (unsavedChanges && !readonly) {
      setShowUnsavedDialog(true);
    } else {
      if (onCancel) {
        onCancel();
      } else {
        // Default navigation behavior
        if (patientId) {
          navigate(`/patients/${patientId}`);
        } else {
          navigate('/notes');
        }
      }
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, expanded: !section.expanded }
          : section
      )
    );
  };

  // Get patients for autocomplete - optimize to prevent unnecessary re-renders
  const patients = useMemo(() => {
    // If we have search results and a search query, use search results
    if (debouncedSearchQuery && patientSearchResults?.data?.results) {
      return patientSearchResults.data.results;
    }
    // Otherwise use all patients data
    const allPatients = allPatientsData?.data?.results || [];
    return allPatients;
  }, [
    debouncedSearchQuery,
    patientSearchResults?.data?.results,
    allPatientsData?.data?.results,
  ]);

  // Loading state
  if (noteLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box>
            <Typography variant="h5" component="h1">
              {isEditMode ? 'Edit Clinical Note' : 'Create Clinical Note'}
            </Typography>
            {patientId && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Creating note for patient context
              </Typography>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            {/* Back button */}
            <IconButton onClick={handleCancel} sx={{ bgcolor: 'action.hover' }}>
              <ArrowBackIcon />
            </IconButton>

            {/* Auto-save indicator */}
            {!readonly && (
              <Box display="flex" alignItems="center" gap={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoSaveEnabled}
                      onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Auto-save"
                />
                {lastSaved && (
                  <Tooltip
                    title={`Last saved: ${lastSaved.toLocaleTimeString()}`}
                  >
                    <AutoSaveIcon color="success" fontSize="small" />
                  </Tooltip>
                )}
              </Box>
            )}

            {/* Action buttons */}
            <Button
              variant="outlined"
              onClick={handleCancel}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>

            {!readonly && (
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={
                  !isValid ||
                  createNoteMutation.isPending ||
                  updateNoteMutation.isPending
                }
              >
                {createNoteMutation.isPending || updateNoteMutation.isPending
                  ? 'Saving...'
                  : 'Save'}
              </Button>
            )}
          </Box>
        </Box>

        {/* Unsaved changes warning */}
        {unsavedChanges && !readonly && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <WarningIcon fontSize="small" />
              You have unsaved changes. They will be lost if you navigate away.
            </Box>
          </Alert>
        )}

        {/* Form sections */}
        <Grid container spacing={3}>
          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="h6">
                    {sections.find((s) => s.id === 'basic')?.title}
                  </Typography>
                  <IconButton
                    onClick={() => toggleSection('basic')}
                    size="small"
                  >
                    {sections.find((s) => s.id === 'basic')?.expanded ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={sections.find((s) => s.id === 'basic')?.expanded}>
                  <Grid container spacing={2}>
                    {/* Patient Selection */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="patient"
                        control={control}
                        render={({ field }) => (
                          <Autocomplete
                            {...field}
                            options={patients}
                            getOptionLabel={(option: unknown) =>
                              typeof option === 'string'
                                ? option
                                : `${option.firstName} ${option.lastName} (${option.mrn})`
                            }
                            value={
                              patients.find(
                                (p: unknown) => p._id === field.value
                              ) || null
                            }
                            onChange={(_, value) => {
                              field.onChange(value?._id || '');
                              // Clear search query when a patient is selected to prevent continuous searching
                              if (value) {
                                setPatientSearchQuery('');
                              }
                            }}
                            onInputChange={(_, value, reason) => {
                              // Only set search query when user is typing, not when selecting
                              if (reason === 'input') {
                                setPatientSearchQuery(value);
                              }
                            }}
                            loading={patientsLoading}
                            disabled={readonly}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Patient *"
                                error={!!errors.patient}
                                helperText={errors.patient?.message}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {patientsLoading ? (
                                        <CircularProgress
                                          color="inherit"
                                          size={20}
                                        />
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
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
                              <FormHelperText>
                                {errors.type.message}
                              </FormHelperText>
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
                            <Select
                              {...field}
                              label="Priority"
                              disabled={readonly}
                            >
                              {NOTE_PRIORITIES.map((priority) => (
                                <MenuItem
                                  key={priority.value}
                                  value={priority.value}
                                >
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                  >
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
                </Collapse>
              </CardContent>
            </Card>
          </Grid>

          {/* SOAP Content Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="h6">SOAP Note Content</Typography>
                  <IconButton
                    onClick={() => toggleSection('soap')}
                    size="small"
                  >
                    {sections.find((s) => s.id === 'soap')?.expanded ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse in={sections.find((s) => s.id === 'soap')?.expanded}>
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
                </Collapse>
              </CardContent>
            </Card>
          </Grid>

          {/* Follow-up Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
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
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="followUpDate"
                        control={control}
                        render={({ field }) => (
                          <DateTimePicker
                            label="Follow-up Date"
                            value={field.value ? new Date(field.value) : null}
                            onChange={(date) =>
                              field.onChange(date?.toISOString())
                            }
                            disabled={readonly}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.followUpDate,
                                helperText: errors.followUpDate?.message,
                              },
                            }}
                          />
                        )}
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Attachments Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="h6">
                    {sections.find((s) => s.id === 'attachments')?.title}
                  </Typography>
                  <IconButton
                    onClick={() => toggleSection('attachments')}
                    size="small"
                  >
                    {sections.find((s) => s.id === 'attachments')?.expanded ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Box>

                <Collapse
                  in={sections.find((s) => s.id === 'attachments')?.expanded}
                >
                  {attachmentError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {attachmentError}
                    </Alert>
                  )}

                  <NoteFileUpload
                    onFilesUploaded={(files) => {
                      setAttachments(files);
                      setAttachmentError(null);
                    }}
                    onAttachmentDeleted={(attachmentId) => {
                      // Handle attachment deletion
                      if (existingNote?.note?.attachments) {
                        const updatedAttachments =
                          existingNote.note.attachments.filter(
                            (att) => att._id !== attachmentId
                          );
                        // Trigger a refetch or update the note
                      }
                    }}
                    existingAttachments={existingNote?.note?.attachments || []}
                    noteId={noteId}
                    maxFiles={5}
                    maxFileSize={10 * 1024 * 1024} // 10MB
                    disabled={readonly}
                    showPreview={true}
                  />
                </Collapse>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Unsaved Changes Dialog */}
        <Dialog
          open={showUnsavedDialog}
          onClose={() => setShowUnsavedDialog(false)}
        >
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogContent>
            <Typography>
              You have unsaved changes. Are you sure you want to leave without
              saving?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowUnsavedDialog(false)}>
              Continue Editing
            </Button>
            <Button
              onClick={() => {
                setShowUnsavedDialog(false);
                onCancel?.();
              }}
              color="error"
            >
              Discard Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

// Wrap with error boundary and enhanced validation
const ClinicalNoteFormWithErrorBoundary: React.FC<ClinicalNoteFormProps> = (
  props
) => {
  return (
    <ClinicalNotesErrorBoundary context="clinical-note-form">
      <ClinicalNoteForm {...props} />
    </ClinicalNotesErrorBoundary>
  );
};

export default ClinicalNoteFormWithErrorBoundary;
