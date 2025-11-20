import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Autocomplete,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Collapse,
  Fab,
  useTheme,
  useMediaQuery,
  SwipeableDrawer,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TouchApp as TouchAppIcon,
  Mic as MicIcon,
} from '@mui/icons-material';

import { useSearchPatients } from '../queries/usePatients';
import {
  useCreateIntervention,
  useUpdateIntervention,
  useStrategyRecommendations,
  useDuplicateInterventions,
} from '../queries/useClinicalInterventions';
import { useClinicalInterventionStore } from '../stores/clinicalInterventionStore';
import { useResponsive, useResponsiveDialog } from '../hooks/useResponsive';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { offlineStorage, offlineUtils } from '../utils/offlineStorage';
import {
  interventionValidator,
  useFormValidation,
  sanitizeFormData,
  ValidationResult,
} from '../utils/clinicalInterventionValidation';
import { ValidationFeedback, ValidationSummary } from './ValidationFeedback';
import ClinicalInterventionErrorBoundary from './ClinicalInterventionErrorBoundary';
import {
  useErrorHandler,
  handleFormError,
} from '../services/errorHandlingService';
import type {
  CreateInterventionData,
  UpdateInterventionData,
  ClinicalIntervention,
  InterventionStrategy,
} from '../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface InterventionFormData {
  patientId: string;
  category: ClinicalIntervention['category'];
  priority: ClinicalIntervention['priority'];
  issueDescription: string;
  strategies: Omit<
    InterventionStrategy,
    '_id' | 'status' | 'implementedAt' | 'implementedBy' | 'notes'
  >[];
  estimatedDuration?: number;
  relatedMTRId?: string;
}

interface InterventionFormProps {
  intervention?: ClinicalIntervention | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (intervention: ClinicalIntervention) => void;
}

// ===============================
// CONSTANTS
// ===============================

const INTERVENTION_CATEGORIES = {
  drug_therapy_problem: {
    label: 'Drug Therapy Problem',
    description:
      'Issues with medication effectiveness, safety, or appropriateness',
    color: '#f44336',
  },
  adverse_drug_reaction: {
    label: 'Adverse Drug Reaction',
    description: 'Unwanted or harmful reactions to medications',
    color: '#ff9800',
  },
  medication_nonadherence: {
    label: 'Medication Non-adherence',
    description: 'Patient not taking medications as prescribed',
    color: '#2196f3',
  },
  drug_interaction: {
    label: 'Drug Interaction',
    description: 'Interactions between medications or with food/supplements',
    color: '#9c27b0',
  },
  dosing_issue: {
    label: 'Dosing Issue',
    description: 'Problems with medication dosage or frequency',
    color: '#4caf50',
  },
  contraindication: {
    label: 'Contraindication',
    description: 'Medication is inappropriate for patient condition',
    color: '#e91e63',
  },
  other: {
    label: 'Other',
    description: 'Other clinical issues requiring intervention',
    color: '#607d8b',
  },
} as const;

const PRIORITY_LEVELS = {
  low: {
    label: 'Low',
    description: 'Non-urgent, can be addressed in routine care',
    color: '#4caf50',
  },
  medium: {
    label: 'Medium',
    description: 'Moderate priority, should be addressed soon',
    color: '#ff9800',
  },
  high: {
    label: 'High',
    description: 'High priority, requires prompt attention',
    color: '#f44336',
  },
  critical: {
    label: 'Critical',
    description: 'Urgent, requires immediate intervention',
    color: '#d32f2f',
  },
} as const;

const STRATEGY_TYPES = {
  medication_review: {
    label: 'Medication Review',
    description: 'Comprehensive review of patient medications',
  },
  dose_adjustment: {
    label: 'Dose Adjustment',
    description: 'Modify medication dosage or frequency',
  },
  alternative_therapy: {
    label: 'Alternative Therapy',
    description: 'Switch to different medication or treatment',
  },
  discontinuation: {
    label: 'Discontinuation',
    description: 'Stop problematic medication',
  },
  additional_monitoring: {
    label: 'Additional Monitoring',
    description: 'Increase monitoring frequency or parameters',
  },
  patient_counseling: {
    label: 'Patient Counseling',
    description: 'Educate patient about medication use',
  },
  physician_consultation: {
    label: 'Physician Consultation',
    description: 'Consult with prescribing physician',
  },
  custom: {
    label: 'Custom Strategy',
    description: 'Custom intervention approach',
  },
} as const;

// ===============================
// MAIN COMPONENT
// ===============================

const InterventionForm: React.FC<InterventionFormProps> = ({
  intervention,
  open,
  onClose,
  onSuccess,
}) => {
  const isEditMode = Boolean(intervention);
  const theme = useTheme();
  const { isMobile, isSmallMobile, shouldUseCardLayout } = useResponsive();
  const { maxWidth, fullScreen, PaperProps } = useResponsiveDialog();

  // State
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInterventions, setDuplicateInterventions] = useState<
    ClinicalIntervention[]
  >([]);

  // Enhanced validation and error handling state
  const [validationErrors, setValidationErrors] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Mobile-specific state
  const [activeStep, setActiveStep] = useState(0);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    patient: true,
    details: false,
    strategies: false,
  });
  const [voiceInputField, setVoiceInputField] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Voice input hook
  const [voiceState, voiceControls] = useVoiceInput({
    onResult: (transcript, confidence) => {
      if (voiceInputField && confidence > 0.7) {
        handleVoiceResult(voiceInputField, transcript);
      }
    },
    onError: (error) => {
      console.error('Voice input error:', error);
      setVoiceInputField(null);
    },
    onEnd: () => {
      setVoiceInputField(null);
    },
  });

  // Enhanced error handling
  const { handleError, getRecoveryInstructions } = useErrorHandler();

  // Form validation
  const formData = {
    patientId: watchedPatientId,
    category: watchedCategory,
    priority: watch('priority'),
    issueDescription: watchedIssueDescription,
    strategies: watchedStrategies,
    estimatedDuration: watch('estimatedDuration'),
    relatedMTRId: watch('relatedMTRId'),
  };

  const formValidation = useFormValidation(formData);

  // Store
  const { selectedPatient: storeSelectedPatient } =
    useClinicalInterventionStore();

  // Mobile form steps
  const formSteps = [
    {
      label: 'Patient Selection',
      description: 'Select the patient for this intervention',
      key: 'patient',
    },
    {
      label: 'Issue Details',
      description: 'Describe the clinical issue',
      key: 'details',
    },
    {
      label: 'Intervention Strategies',
      description: 'Define intervention approaches',
      key: 'strategies',
    },
  ];

  // Queries and mutations
  const { data: patientSearchResults, isLoading: searchingPatients } =
    useSearchPatients(patientSearchQuery);
  const { data: strategyRecommendations } = useStrategyRecommendations(
    // Only fetch if we have a category selected
    ''
  );
  const { data: duplicateCheck } = useDuplicateInterventions(
    selectedPatient?._id || '',
    '' // Will be set when category is selected
  );

  const createMutation = useCreateIntervention();
  const updateMutation = useUpdateIntervention();

  // Form setup
  const defaultValues: InterventionFormData = useMemo(
    () => ({
      patientId: intervention?.patientId || storeSelectedPatient?._id || '',
      category: intervention?.category || 'drug_therapy_problem',
      priority: intervention?.priority || 'medium',
      issueDescription: intervention?.issueDescription || '',
      strategies:
        intervention?.strategies?.map((s) => ({
          type: s.type,
          description: s.description,
          rationale: s.rationale,
          expectedOutcome: s.expectedOutcome,
          priority: s.priority,
        })) || [],
      estimatedDuration: intervention?.estimatedDuration || undefined,
      relatedMTRId: intervention?.relatedMTRId || undefined,
    }),
    [intervention, storeSelectedPatient]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InterventionFormData>({
    defaultValues,
    mode: 'onChange',
  });

  const watchedCategory = watch('category');
  const watchedPatientId = watch('patientId');
  const watchedIssueDescription = watch('issueDescription');
  const watchedStrategies = watch('strategies');

  // Effects
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      if (storeSelectedPatient) {
        setSelectedPatient(storeSelectedPatient);
      }

      // Load form draft if available
      if (!isEditMode) {
        loadFormDraft();
      }
    }
  }, [open, reset, defaultValues, storeSelectedPatient, isEditMode]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time form validation
  useEffect(() => {
    if (open && (submitAttempted || Object.keys(formTouched).length > 0)) {
      setValidationErrors(formValidation);

      // Show validation summary if there are errors or warnings
      setShowValidationSummary(
        !formValidation.isValid || formValidation.warnings.length > 0
      );
    }
  }, [formValidation, open, submitAttempted, formTouched]);

  // Auto-save form draft when data changes (mobile only)
  useEffect(() => {
    if (isMobile && !isEditMode && open) {
      const timeoutId = setTimeout(() => {
        saveFormDraft();
      }, 2000); // Save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [
    watchedPatientId,
    watchedCategory,
    watchedIssueDescription,
    watchedStrategies,
    isMobile,
    isEditMode,
    open,
  ]);

  // Check for duplicates when patient and category change
  useEffect(() => {
    if (watchedPatientId && watchedCategory && duplicateCheck?.data) {
      const duplicates = duplicateCheck.data.filter(
        (d) => d._id !== intervention?._id
      );
      if (duplicates.length > 0) {
        setDuplicateInterventions(duplicates);
        setShowDuplicateWarning(true);
      } else {
        setShowDuplicateWarning(false);
        setDuplicateInterventions([]);
      }
    }
  }, [watchedPatientId, watchedCategory, duplicateCheck, intervention?._id]);

  // ===============================
  // MOBILE & VOICE INPUT HANDLERS
  // ===============================

  const handleStepChange = (step: number) => {
    setActiveStep(step);
  };

  const handleNextStep = () => {
    if (activeStep < formSteps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const startVoiceInput = (fieldName: string) => {
    if (!voiceState.isSupported) {
      alert('Speech recognition is not supported in this browser');
      return;
    }

    setVoiceInputField(fieldName);
    voiceControls.start();
  };

  const handleVoiceResult = (fieldName: string, transcript: string) => {
    // Update the appropriate field based on fieldName
    if (fieldName === 'issueDescription') {
      setValue('issueDescription', transcript);
    } else if (fieldName.startsWith('strategy-')) {
      const [, index, field] = fieldName.split('-');
      const strategyIndex = parseInt(index);
      handleStrategyChange(
        strategyIndex,
        field as keyof InterventionStrategy,
        transcript
      );
    }
  };

  const canProceedToNextStep = () => {
    switch (activeStep) {
      case 0: // Patient selection
        return !!watchedPatientId;
      case 1: // Issue details
        return (
          !!watchedCategory &&
          !!watchedIssueDescription &&
          watchedIssueDescription.length >= 10
        );
      case 2: // Strategies
        return watchedStrategies && watchedStrategies.length > 0;
      default:
        return true;
    }
  };

  // ===============================
  // HANDLERS
  // ===============================

  const handlePatientSelect = (patient: any) => {
    if (patient) {
      setSelectedPatient(patient);
      setValue('patientId', patient._id);
      setPatientSearchQuery('');
    }
  };

  const handleAddStrategy = () => {
    const currentStrategies = watchedStrategies || [];
    setValue('strategies', [
      ...currentStrategies,
      {
        type: 'medication_review',
        description: '',
        rationale: '',
        expectedOutcome: '',
        priority: 'primary',
      },
    ]);
  };

  const handleRemoveStrategy = (index: number) => {
    const currentStrategies = watchedStrategies || [];
    setValue(
      'strategies',
      currentStrategies.filter((_, i) => i !== index)
    );
  };

  const handleStrategyChange = (
    index: number,
    field: keyof InterventionStrategy,
    value: any
  ) => {
    const currentStrategies = [...(watchedStrategies || [])];
    currentStrategies[index] = {
      ...currentStrategies[index],
      [field]: value,
    };
    setValue('strategies', currentStrategies);
  };

  const loadFormDraft = async () => {
    try {
      const draftId = `intervention-form-${Date.now()}`;
      const draft = await offlineStorage.getFormDraft(draftId);

      if (draft) {
        // Restore form data from draft
        Object.keys(draft).forEach((key) => {
          setValue(key as keyof InterventionFormData, draft[key]);
        });
      }
    } catch (error) {
      console.error('Failed to load form draft:', error);
    }
  };

  const saveFormDraft = async () => {
    try {
      const formData = {
        patientId: watchedPatientId,
        category: watchedCategory,
        priority: watch('priority'),
        issueDescription: watchedIssueDescription,
        strategies: watchedStrategies,
        estimatedDuration: watch('estimatedDuration'),
      };

      // Only save if there's meaningful data
      if (formData.patientId || formData.issueDescription) {
        const draftId = `intervention-form-${Date.now()}`;
        await offlineStorage.saveFormDraft(draftId, formData);
      }
    } catch (error) {
      console.error('Failed to save form draft:', error);
    }
  };

  const onSubmit = async (data: InterventionFormData) => {
    setSubmitAttempted(true);

    try {
      // Sanitize form data before submission
      const sanitizedData = sanitizeFormData(data);

      // Final validation check
      const finalValidation = interventionValidator.validateForm(sanitizedData);
      if (!finalValidation.isValid) {
        setValidationErrors(finalValidation);
        setShowValidationSummary(true);

        // Handle validation errors
        handleFormError(
          new Error('Form validation failed'),
          'intervention-form',
          { showToast: true, autoRetry: false }
        );
        return;
      }

      if (isEditMode && intervention) {
        const updateData: UpdateInterventionData = {
          category: sanitizedData.category,
          priority: sanitizedData.priority,
          issueDescription: sanitizedData.issueDescription,
          estimatedDuration: sanitizedData.estimatedDuration,
        };

        if (isOffline) {
          // Store for offline sync
          const authToken = localStorage.getItem('authToken') || '';
          await offlineStorage.storeOfflineIntervention(
            { ...updateData, interventionId: intervention._id },
            authToken,
            'update'
          );

          // Show offline notification
          alert(
            'Intervention saved offline. It will sync when connection is restored.'
          );
          onClose();
          return;
        }

        const result = await updateMutation.mutateAsync({
          interventionId: intervention._id,
          updates: updateData,
        });

        if (result?.data) {
          onSuccess?.(result.data);
          onClose();
        }
      } else {
        const createData: CreateInterventionData = {
          patientId: sanitizedData.patientId,
          category: sanitizedData.category,
          priority: sanitizedData.priority,
          issueDescription: sanitizedData.issueDescription,
          strategies: sanitizedData.strategies,
          estimatedDuration: sanitizedData.estimatedDuration,
          relatedMTRId: sanitizedData.relatedMTRId,
        };

        if (isOffline) {
          // Store for offline sync
          const authToken = localStorage.getItem('authToken') || '';
          await offlineStorage.storeOfflineIntervention(
            createData,
            authToken,
            'create'
          );

          // Request background sync
          await offlineUtils.requestBackgroundSync('intervention-sync');

          // Show offline notification
          alert(
            'Intervention saved offline. It will sync when connection is restored.'
          );
          onClose();
          reset();

          // Clear form draft
          const draftId = `intervention-form-${Date.now()}`;
          await offlineStorage.removeFormDraft(draftId);
          return;
        }

        const result = await createMutation.mutateAsync(createData);

        if (result?.data) {
          onSuccess?.(result.data);
          onClose();
          reset();

          // Clear form draft on successful submission
          const draftId = `intervention-form-${Date.now()}`;
          await offlineStorage.removeFormDraft(draftId);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);

      // Enhanced error handling
      const appError = handleFormError(error, 'intervention-form', {
        showToast: true,
        autoRetry: false,
        logError: true,
      });

      // Show recovery instructions
      const instructions = getRecoveryInstructions(appError);

      // If network error and not already offline, try storing offline
      if (
        !isOffline &&
        (appError.type === 'NETWORK_ERROR' ||
          (error instanceof Error && error.message.includes('network')))
      ) {
        const shouldStoreOffline = confirm(
          'Network error occurred. Would you like to save this intervention offline?'
        );

        if (shouldStoreOffline) {
          try {
            const authToken = localStorage.getItem('authToken') || '';
            await offlineStorage.storeOfflineIntervention(
              data,
              authToken,
              'create'
            );
            await offlineUtils.requestBackgroundSync('intervention-sync');
            alert(
              'Intervention saved offline. It will sync when connection is restored.'
            );
            onClose();
            reset();
          } catch (offlineError) {
            handleError(offlineError, 'offline-storage', {
              showToast: true,
              autoRetry: false,
            });
          }
        }
      }
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  // Field touch tracking for validation
  const handleFieldTouch = (fieldName: string) => {
    setFormTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));
  };

  // Enhanced field change handler with validation
  const handleFieldChange = (fieldName: string, value: any) => {
    handleFieldTouch(fieldName);

    // Update form value
    setValue(fieldName as keyof InterventionFormData, value);

    // Trigger real-time validation for this field
    if (formTouched[fieldName] || submitAttempted) {
      const fieldValidation = interventionValidator.validateField(
        fieldName,
        value,
        formData
      );

      // Update validation state for this specific field
      setValidationErrors((prev) => {
        const updatedErrors = prev.errors.filter((e) => e.field !== fieldName);
        const updatedWarnings = prev.warnings.filter(
          (w) => w.field !== fieldName
        );

        return {
          isValid:
            updatedErrors.length === 0 && fieldValidation.errors.length === 0,
          errors: [...updatedErrors, ...fieldValidation.errors],
          warnings: [...updatedWarnings, ...fieldValidation.warnings],
        };
      });
    }
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderPatientSelection = () => (
    <Grid item xs={12}>
      {isMobile ? (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.50',
            }}
            onClick={() => toggleSection('patient')}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <PersonIcon color="primary" />
              Patient Selection
            </Typography>
            {expandedSections.patient ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <Collapse in={expandedSections.patient}>
            <Box sx={{ pt: 2 }}>{renderPatientSelectionContent()}</Box>
          </Collapse>
        </Box>
      ) : (
        <Box>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PersonIcon color="primary" />
            Patient Selection
          </Typography>
          {renderPatientSelectionContent()}
        </Box>
      )}
    </Grid>
  );

  const renderPatientSelectionContent = () => (
    <Box>
      {selectedPatient ? (
        <Paper
          sx={{
            p: isMobile ? 1.5 : 2,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 1 : 0,
            }}
          >
            <Box>
              <Typography
                variant={isMobile ? 'body1' : 'subtitle1'}
                fontWeight="medium"
              >
                {selectedPatient.firstName} {selectedPatient.lastName}
              </Typography>
              <Typography
                variant={isMobile ? 'caption' : 'body2'}
                color="text.secondary"
                sx={{
                  display: isMobile ? 'block' : 'inline',
                }}
              >
                DOB:{' '}
                {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                {isMobile && <br />}
                {!isMobile && ' | '}
                Phone: {selectedPatient.phoneNumber || 'N/A'}
              </Typography>
            </Box>
            {!isEditMode && (
              <Button
                size={isMobile ? 'small' : 'medium'}
                variant={isMobile ? 'outlined' : 'text'}
                onClick={() => {
                  setSelectedPatient(null);
                  setValue('patientId', '');
                }}
                sx={{ minWidth: isMobile ? 'auto' : undefined }}
              >
                Change
              </Button>
            )}
          </Box>
        </Paper>
      ) : (
        <Controller
          name="patientId"
          control={control}
          rules={{ required: 'Patient selection is required' }}
          render={({ field }) => (
            <Autocomplete
              {...field}
              options={patientSearchResults?.data?.results || []}
              getOptionLabel={(option) =>
                typeof option === 'string'
                  ? option
                  : `${option.firstName} ${option.lastName} - ${
                      option.phoneNumber || 'No phone'
                    }`
              }
              loading={searchingPatients}
              onInputChange={(_, value) => setPatientSearchQuery(value)}
              onChange={(_, value) => {
                handlePatientSelect(value);
                field.onChange(value?._id || '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search and select patient"
                  placeholder={
                    isMobile
                      ? 'Patient name...'
                      : 'Type patient name or phone number...'
                  }
                  error={!!errors.patientId}
                  helperText={errors.patientId?.message}
                  size={isMobile ? 'medium' : 'medium'}
                  InputProps={{
                    ...params.InputProps,
                    sx: {
                      fontSize: isMobile ? '16px' : undefined, // Prevents zoom on iOS
                    },
                    endAdornment: (
                      <>
                        {searchingPatients && (
                          <CircularProgress color="inherit" size={20} />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant={isMobile ? 'body2' : 'body1'}>
                      {option.firstName} {option.lastName}
                    </Typography>
                    <Typography
                      variant={isMobile ? 'caption' : 'body2'}
                      color="text.secondary"
                      sx={{
                        display: isMobile ? 'block' : 'inline',
                      }}
                    >
                      DOB: {new Date(option.dateOfBirth).toLocaleDateString()}
                      {isMobile && <br />}
                      {!isMobile && ' | '}
                      Phone: {option.phoneNumber || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              )}
              noOptionsText={
                patientSearchQuery.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No patients found'
              }
              ListboxProps={{
                sx: {
                  maxHeight: isMobile ? 200 : 300,
                },
              }}
            />
          )}
        />
      )}
    </Box>
  );

  const renderCategorySelection = () => (
    <Grid item xs={12} md={6}>
      <Controller
        name="category"
        control={control}
        rules={{ required: 'Category is required' }}
        render={({ field }) => (
          <FormControl fullWidth error={!!errors.category}>
            <InputLabel>Clinical Issue Category</InputLabel>
            <Select
              {...field}
              label="Clinical Issue Category"
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: isMobile ? 300 : 400,
                  },
                },
              }}
            >
              {Object.entries(INTERVENTION_CATEGORIES).map(
                ([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Box sx={{ py: isMobile ? 0.5 : 1 }}>
                      <Typography
                        variant={isMobile ? 'body2' : 'body1'}
                        sx={{ fontWeight: 'medium' }}
                      >
                        {config.label}
                      </Typography>
                      <Typography
                        variant={isMobile ? 'caption' : 'body2'}
                        color="text.secondary"
                        sx={{
                          display: isMobile ? 'block' : 'block',
                          lineHeight: isMobile ? 1.2 : 1.4,
                        }}
                      >
                        {config.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                )
              )}
            </Select>
            {errors.category && (
              <FormHelperText>{errors.category.message}</FormHelperText>
            )}
          </FormControl>
        )}
      />
    </Grid>
  );

  const renderPrioritySelection = () => (
    <Grid item xs={12} md={6}>
      <Controller
        name="priority"
        control={control}
        rules={{ required: 'Priority is required' }}
        render={({ field }) => (
          <FormControl fullWidth error={!!errors.priority}>
            <InputLabel>Priority Level</InputLabel>
            <Select
              {...field}
              label="Priority Level"
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: isMobile ? 250 : 300,
                  },
                },
              }}
            >
              {Object.entries(PRIORITY_LEVELS).map(([value, config]) => (
                <MenuItem key={value} value={value}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? 0.5 : 1,
                      py: isMobile ? 0.5 : 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: isMobile ? 10 : 12,
                        height: isMobile ? 10 : 12,
                        borderRadius: '50%',
                        bgcolor: config.color,
                        flexShrink: 0,
                      }}
                    />
                    <Box>
                      <Typography
                        variant={isMobile ? 'body2' : 'body1'}
                        sx={{ fontWeight: 'medium' }}
                      >
                        {config.label}
                      </Typography>
                      <Typography
                        variant={isMobile ? 'caption' : 'body2'}
                        color="text.secondary"
                        sx={{
                          lineHeight: isMobile ? 1.2 : 1.4,
                        }}
                      >
                        {config.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.priority && (
              <FormHelperText>{errors.priority.message}</FormHelperText>
            )}
          </FormControl>
        )}
      />
    </Grid>
  );

  const renderIssueDescription = () => (
    <Grid item xs={12}>
      <Controller
        name="issueDescription"
        control={control}
        rules={{
          required: 'Issue description is required',
          minLength: {
            value: 10,
            message: 'Description must be at least 10 characters',
          },
          maxLength: {
            value: 1000,
            message: 'Description must not exceed 1000 characters',
          },
        }}
        render={({ field }) => (
          <Box sx={{ position: 'relative' }}>
            <TextField
              {...field}
              fullWidth
              multiline
              rows={isMobile ? 3 : 4}
              label="Clinical Issue Description"
              placeholder={
                isMobile
                  ? 'Describe the clinical issue...'
                  : 'Describe the clinical issue or problem in detail...'
              }
              error={!!errors.issueDescription}
              helperText={
                errors.issueDescription?.message ||
                `${watchedIssueDescription?.length || 0}/1000 characters`
              }
              onBlur={() => handleFieldTouch('issueDescription')}
              onChange={(e) => {
                field.onChange(e);
                handleFieldChange('issueDescription', e.target.value);
              }}
              InputProps={{
                sx: {
                  fontSize: isMobile ? '16px' : undefined, // Prevents zoom on iOS
                },
                endAdornment: isMobile && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                    }}
                  >
                    <Tooltip title="Voice Input">
                      <IconButton
                        size="small"
                        onClick={() => startVoiceInput('issueDescription')}
                        disabled={voiceState.isListening}
                        sx={{
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                          '&:hover': {
                            bgcolor: 'grey.100',
                          },
                        }}
                      >
                        <MicIcon
                          sx={{
                            fontSize: 18,
                            color:
                              voiceState.isListening &&
                              voiceInputField === 'issueDescription'
                                ? 'error.main'
                                : 'text.secondary',
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ),
              }}
            />
            {voiceState.isListening &&
              voiceInputField === 'issueDescription' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    p: 2,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    zIndex: 10,
                  }}
                >
                  <MicIcon sx={{ color: 'error.main' }} />
                  <Typography variant="body2">Listening...</Typography>
                </Box>
              )}
          </Box>
        )}
      />
    </Grid>
  );

  // Mobile drawer component
  const MobileFormDrawer = () => (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={handleCancel}
      onOpen={() => {}}
      disableSwipeToOpen
      PaperProps={{
        sx: {
          height: '95vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        },
      }}
    >
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {isEditMode ? 'Edit Intervention' : 'New Intervention'}
          </Typography>
          <IconButton onClick={handleCancel}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ p: 2 }}>
          {formSteps.map((step, index) => (
            <Step key={step.key}>
              <StepLabel
                onClick={() => handleStepChange(index)}
                sx={{ cursor: 'pointer' }}
              >
                <Typography variant="subtitle2">{step.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ py: 2 }}>{renderMobileStepContent(index)}</Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  {index > 0 && (
                    <Button
                      size="small"
                      onClick={handlePreviousStep}
                      startIcon={<NavigateBeforeIcon />}
                    >
                      Back
                    </Button>
                  )}
                  {index < formSteps.length - 1 ? (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleNextStep}
                      disabled={!canProceedToNextStep()}
                      endIcon={<NavigateNextIcon />}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSubmit(onSubmit)}
                      disabled={isSubmitting || !canProceedToNextStep()}
                      startIcon={
                        isSubmitting ? (
                          <CircularProgress size={16} />
                        ) : (
                          <SaveIcon />
                        )
                      }
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    </SwipeableDrawer>
  );

  const renderMobileStepContent = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <Box>
            {renderPatientSelectionContent()}
            {showDuplicateWarning && (
              <Alert
                severity="warning"
                icon={<WarningIcon />}
                sx={{ mt: 2 }}
                action={
                  <Button
                    size="small"
                    onClick={() => setShowDuplicateWarning(false)}
                  >
                    Dismiss
                  </Button>
                }
              >
                <Typography variant="body2" fontWeight="medium">
                  Similar interventions found
                </Typography>
                <Typography variant="body2">
                  {duplicateInterventions.length} existing intervention(s) with
                  the same category.
                </Typography>
              </Alert>
            )}
          </Box>
        );
      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              {renderCategorySelection()}
            </Grid>
            <Grid item xs={12}>
              {renderPrioritySelection()}
            </Grid>
            <Grid item xs={12}>
              {renderIssueDescription()}
            </Grid>
          </Grid>
        );
      case 2:
        return renderStrategiesSection();
      default:
        return null;
    }
  };

  // Desktop dialog component
  const DesktopFormDialog = () => (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        ...PaperProps,
        sx: {
          ...PaperProps?.sx,
          minHeight: '70vh',
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          {isEditMode
            ? 'Edit Clinical Intervention'
            : 'Create New Clinical Intervention'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isEditMode
            ? 'Update the intervention details below'
            : 'Document a new clinical issue and intervention strategy'}
        </Typography>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Patient Selection */}
            {renderPatientSelection()}

            {/* Duplicate Warning */}
            {showDuplicateWarning && (
              <Grid item xs={12}>
                <Alert
                  severity="warning"
                  icon={<WarningIcon />}
                  action={
                    <Button
                      size="small"
                      onClick={() => setShowDuplicateWarning(false)}
                    >
                      Dismiss
                    </Button>
                  }
                >
                  <Typography variant="body2" fontWeight="medium">
                    Similar interventions found for this patient
                  </Typography>
                  <Typography variant="body2">
                    {duplicateInterventions.length} existing intervention(s)
                    with the same category. Please review to avoid duplicates.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Category and Priority */}
            {renderCategorySelection()}
            {renderPrioritySelection()}

            {/* Issue Description */}
            {renderIssueDescription()}

            {/* Estimated Duration */}
            <Grid item xs={12} md={6}>
              <Controller
                name="estimatedDuration"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Estimated Duration (minutes)"
                    placeholder="e.g., 30"
                    InputProps={{
                      inputProps: { min: 1, max: 480 },
                      sx: {
                        fontSize: isMobile ? '16px' : undefined,
                      },
                    }}
                    helperText="Optional: Estimated time to complete intervention"
                  />
                )}
              />
            </Grid>

            {/* Strategies Section */}
            {renderStrategiesSection()}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={handleCancel}
            disabled={isSubmitting}
            startIcon={<CancelIcon />}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />
            }
          >
            {isSubmitting
              ? 'Saving...'
              : isEditMode
              ? 'Update Intervention'
              : 'Create Intervention'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );

  const renderStrategiesSection = () => (
    <Grid item xs={12}>
      <Divider sx={{ my: 2 }} />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
          Intervention Strategies
        </Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddStrategy}
          variant="outlined"
          size={isMobile ? 'small' : 'medium'}
        >
          {isMobile ? 'Add' : 'Add Strategy'}
        </Button>
      </Box>

      {watchedStrategies?.map((strategy, index) => (
        <Card
          key={index}
          sx={{
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: isMobile ? 2 : undefined,
          }}
        >
          <CardContent sx={{ p: isMobile ? 2 : 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 2,
              }}
            >
              <Typography
                variant={isMobile ? 'body1' : 'subtitle1'}
                fontWeight="medium"
              >
                Strategy {index + 1}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleRemoveStrategy(index)}
                color="error"
              >
                <CancelIcon />
              </IconButton>
            </Box>

            <Grid container spacing={isMobile ? 1.5 : 2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Strategy Type</InputLabel>
                  <Select
                    value={strategy.type}
                    label="Strategy Type"
                    onChange={(e) =>
                      handleStrategyChange(index, 'type', e.target.value)
                    }
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          maxHeight: isMobile ? 300 : 400,
                        },
                      },
                    }}
                  >
                    {Object.entries(STRATEGY_TYPES).map(([value, config]) => (
                      <MenuItem key={value} value={value}>
                        <Box sx={{ py: isMobile ? 0.5 : 1 }}>
                          <Typography
                            variant={isMobile ? 'body2' : 'body1'}
                            sx={{ fontWeight: 'medium' }}
                          >
                            {config.label}
                          </Typography>
                          <Typography
                            variant={isMobile ? 'caption' : 'body2'}
                            color="text.secondary"
                            sx={{
                              lineHeight: isMobile ? 1.2 : 1.4,
                            }}
                          >
                            {config.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={strategy.priority}
                    label="Priority"
                    onChange={(e) =>
                      handleStrategyChange(index, 'priority', e.target.value)
                    }
                  >
                    <MenuItem value="primary">Primary</MenuItem>
                    <MenuItem value="secondary">Secondary</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={isMobile ? 2 : 2}
                    label="Strategy Description"
                    value={strategy.description}
                    onChange={(e) =>
                      handleStrategyChange(index, 'description', e.target.value)
                    }
                    placeholder={
                      isMobile
                        ? 'Describe the strategy...'
                        : 'Describe the specific intervention strategy...'
                    }
                    InputProps={{
                      sx: {
                        fontSize: isMobile ? '16px' : undefined,
                      },
                      endAdornment: isMobile && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1,
                          }}
                        >
                          <Tooltip title="Voice Input">
                            <IconButton
                              size="small"
                              onClick={() =>
                                startVoiceInput(`strategy-${index}-description`)
                              }
                              disabled={voiceState.isListening}
                              sx={{
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': {
                                  bgcolor: 'grey.100',
                                },
                              }}
                            >
                              <MicIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ),
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={isMobile ? 2 : 2}
                    label="Rationale"
                    value={strategy.rationale}
                    onChange={(e) =>
                      handleStrategyChange(index, 'rationale', e.target.value)
                    }
                    placeholder={
                      isMobile
                        ? 'Why this strategy?'
                        : 'Why is this strategy appropriate?'
                    }
                    inputProps={{ maxLength: 500 }}
                    helperText={`${
                      strategy.rationale?.length || 0
                    }/500 characters`}
                    InputProps={{
                      sx: {
                        fontSize: isMobile ? '16px' : undefined,
                      },
                      endAdornment: isMobile && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1,
                          }}
                        >
                          <Tooltip title="Voice Input">
                            <IconButton
                              size="small"
                              onClick={() =>
                                startVoiceInput(`strategy-${index}-rationale`)
                              }
                              disabled={voiceState.isListening}
                              sx={{
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': {
                                  bgcolor: 'grey.100',
                                },
                              }}
                            >
                              <MicIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ),
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ position: 'relative' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={isMobile ? 2 : 2}
                    label="Expected Outcome"
                    value={strategy.expectedOutcome}
                    onChange={(e) =>
                      handleStrategyChange(
                        index,
                        'expectedOutcome',
                        e.target.value
                      )
                    }
                    placeholder={
                      isMobile
                        ? 'Expected outcome?'
                        : 'What outcome do you expect from this strategy?'
                    }
                    inputProps={{ maxLength: 500 }}
                    helperText={`${
                      strategy.expectedOutcome?.length || 0
                    }/500 characters`}
                    InputProps={{
                      sx: {
                        fontSize: isMobile ? '16px' : undefined,
                      },
                      endAdornment: isMobile && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 1,
                          }}
                        >
                          <Tooltip title="Voice Input">
                            <IconButton
                              size="small"
                              onClick={() =>
                                startVoiceInput(
                                  `strategy-${index}-expectedOutcome`
                                )
                              }
                              disabled={voiceState.isListening}
                              sx={{
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': {
                                  bgcolor: 'grey.100',
                                },
                              }}
                            >
                              <MicIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ),
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}

      {(!watchedStrategies || watchedStrategies.length === 0) && (
        <Paper
          sx={{
            p: isMobile ? 2 : 3,
            textAlign: 'center',
            bgcolor: 'grey.50',
            borderRadius: isMobile ? 2 : undefined,
          }}
        >
          <InfoIcon
            color="disabled"
            sx={{ fontSize: isMobile ? 32 : 48, mb: 1 }}
          />
          <Typography
            variant={isMobile ? 'body2' : 'body1'}
            color="text.secondary"
          >
            No strategies added yet
          </Typography>
          <Typography
            variant={isMobile ? 'caption' : 'body2'}
            color="text.secondary"
          >
            {isMobile
              ? 'Tap "Add" to define approaches'
              : 'Click "Add Strategy" to define intervention approaches'}
          </Typography>
        </Paper>
      )}
    </Grid>
  );

  return (
    <ClinicalInterventionErrorBoundary
      showErrorDetails={process.env.NODE_ENV === 'development'}
      enableErrorReporting={true}
      maxRetries={3}
      resetOnPropsChange={true}
    >
      {isMobile ? <MobileFormDrawer /> : <DesktopFormDialog />}
    </ClinicalInterventionErrorBoundary>
  );
};

export default InterventionForm;
