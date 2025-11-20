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
  CircularProgress,
  Grid,
  Paper,
  Chip,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';

import { useSearchPatients } from '../../queries/usePatients';
import { useDuplicateInterventions } from '../../queries/useClinicalInterventions';
import { useClinicalInterventionStore } from '../../stores/clinicalInterventionStore';
import type { ClinicalIntervention } from '../../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface IssueIdentificationData {
  patientId: string;
  category: ClinicalIntervention['category'];
  priority: ClinicalIntervention['priority'];
  issueDescription: string;
  estimatedDuration?: number;
}

interface IssueIdentificationStepProps {
  onNext: (data: IssueIdentificationData) => void;
  onCancel?: () => void;
  initialData?: Partial<IssueIdentificationData>;
  isLoading?: boolean;
}

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber?: string;
  email?: string;
}

// ===============================
// CONSTANTS
// ===============================

const INTERVENTION_CATEGORIES = {
  drug_therapy_problem: {
    label: 'Drug Therapy Problem',
    description:
      'Issues with medication effectiveness, safety, or appropriateness',
    examples: [
      'Ineffective medication for condition',
      'Inappropriate medication selection',
      'Suboptimal dosing regimen',
      'Therapeutic duplication',
    ],
    color: '#f44336',
    icon: '💊',
  },
  adverse_drug_reaction: {
    label: 'Adverse Drug Reaction',
    description: 'Unwanted or harmful reactions to medications',
    examples: [
      'Allergic reactions',
      'Side effects affecting quality of life',
      'Drug-induced organ toxicity',
      'Hypersensitivity reactions',
    ],
    color: '#ff9800',
    icon: '⚠️',
  },
  medication_nonadherence: {
    label: 'Medication Non-adherence',
    description: 'Patient not taking medications as prescribed',
    examples: [
      'Missed doses or irregular timing',
      'Cost-related non-adherence',
      'Complex regimen confusion',
      'Side effect avoidance',
    ],
    color: '#2196f3',
    icon: '📅',
  },
  drug_interaction: {
    label: 'Drug Interaction',
    description: 'Interactions between medications or with food/supplements',
    examples: [
      'Drug-drug interactions',
      'Drug-food interactions',
      'Drug-supplement interactions',
      'Pharmacokinetic interactions',
    ],
    color: '#9c27b0',
    icon: '🔄',
  },
  dosing_issue: {
    label: 'Dosing Issue',
    description: 'Problems with medication dosage or frequency',
    examples: [
      'Dose too high or too low',
      'Incorrect frequency',
      'Renal/hepatic dose adjustment needed',
      'Age-related dosing concerns',
    ],
    color: '#4caf50',
    icon: '⚖️',
  },
  contraindication: {
    label: 'Contraindication',
    description: 'Medication is inappropriate for patient condition',
    examples: [
      'Absolute contraindications',
      'Relative contraindications',
      'Pregnancy/lactation concerns',
      'Comorbidity conflicts',
    ],
    color: '#e91e63',
    icon: '🚫',
  },
  other: {
    label: 'Other',
    description: 'Other clinical issues requiring intervention',
    examples: [
      'Medication reconciliation issues',
      'Patient education needs',
      'Monitoring requirements',
      'Administrative concerns',
    ],
    color: '#607d8b',
    icon: '📋',
  },
} as const;

const PRIORITY_LEVELS = {
  low: {
    label: 'Low Priority',
    description: 'Non-urgent, can be addressed in routine care',
    guidance: 'Schedule for next routine appointment or within 1-2 weeks',
    color: '#4caf50',
    icon: '🟢',
  },
  medium: {
    label: 'Medium Priority',
    description: 'Moderate priority, should be addressed soon',
    guidance: 'Address within 2-3 days or next available appointment',
    color: '#ff9800',
    icon: '🟡',
  },
  high: {
    label: 'High Priority',
    description: 'High priority, requires prompt attention',
    guidance: 'Address within 24 hours or same day if possible',
    color: '#f44336',
    icon: '🟠',
  },
  critical: {
    label: 'Critical Priority',
    description: 'Urgent, requires immediate intervention',
    guidance: 'Address immediately - potential patient safety concern',
    color: '#d32f2f',
    icon: '🔴',
  },
} as const;

// ===============================
// MAIN COMPONENT
// ===============================

const IssueIdentificationStep: React.FC<IssueIdentificationStepProps> = ({
  onNext,
  onCancel,
  initialData,
  isLoading = false,
}) => {
  // State
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showCategoryDetails, setShowCategoryDetails] = useState<string | null>(
    null
  );
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInterventions, setDuplicateInterventions] = useState<
    ClinicalIntervention[]
  >([]);

  // Store
  const { selectedPatient: storeSelectedPatient } =
    useClinicalInterventionStore();

  // Queries
  const { data: patientSearchResults, isLoading: searchingPatients } =
    useSearchPatients(patientSearchQuery, {
      enabled: patientSearchQuery.length >= 2,
    });

  // Form setup
  const defaultValues: IssueIdentificationData = useMemo(
    () => ({
      patientId: initialData?.patientId || storeSelectedPatient?._id || '',
      category: initialData?.category || 'drug_therapy_problem',
      priority: initialData?.priority || 'medium',
      issueDescription: initialData?.issueDescription || '',
      estimatedDuration: initialData?.estimatedDuration || undefined,
    }),
    [initialData, storeSelectedPatient]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<IssueIdentificationData>({
    defaultValues,
    mode: 'onChange',
  });

  const watchedCategory = watch('category');
  const watchedPatientId = watch('patientId');
  const watchedIssueDescription = watch('issueDescription');

  // Duplicate check query
  const { data: duplicateCheck } = useDuplicateInterventions(
    watchedPatientId,
    watchedCategory,
    { enabled: !!watchedPatientId && !!watchedCategory }
  );

  // Effects
  useEffect(() => {
    if (storeSelectedPatient && !selectedPatient) {
      setSelectedPatient(storeSelectedPatient);
      setValue('patientId', storeSelectedPatient._id);
    }
  }, [storeSelectedPatient, selectedPatient, setValue]);

  // Check for duplicates when patient and category change
  useEffect(() => {
    if (duplicateCheck?.data && duplicateCheck.data.length > 0) {
      setDuplicateInterventions(duplicateCheck.data);
      setShowDuplicateWarning(true);
    } else {
      setShowDuplicateWarning(false);
      setDuplicateInterventions([]);
    }
  }, [duplicateCheck]);

  // ===============================
  // HANDLERS
  // ===============================

  const handlePatientSelect = (patient: Patient | null) => {
    if (patient) {
      setSelectedPatient(patient);
      setValue('patientId', patient._id);
      setPatientSearchQuery('');
    }
  };

  const handleCategorySelect = (category: string) => {
    setValue('category', category as ClinicalIntervention['category']);
    setShowCategoryDetails(null);
  };

  const onSubmit = (data: IssueIdentificationData) => {
    onNext(data);
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderPatientSelection = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <PersonIcon color="primary" />
          Patient Selection
        </Typography>

        {selectedPatient ? (
          <Paper
            sx={{
              p: 2,
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.200',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight="medium">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DOB:{' '}
                  {new Date(selectedPatient.dateOfBirth).toLocaleDateString()} |
                  Phone: {selectedPatient.phoneNumber || 'N/A'}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => {
                  setSelectedPatient(null);
                  setValue('patientId', '');
                }}
              >
                Change Patient
              </Button>
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
                    placeholder="Type patient name or phone number..."
                    error={!!errors.patientId}
                    helperText={errors.patientId?.message}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <SearchIcon color="action" sx={{ mr: 1 }} />
                      ),
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
                    <Box>
                      <Typography variant="body1">
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        DOB: {new Date(option.dateOfBirth).toLocaleDateString()}{' '}
                        | Phone: {option.phoneNumber || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                )}
                noOptionsText={
                  patientSearchQuery.length < 2
                    ? 'Type at least 2 characters to search'
                    : 'No patients found'
                }
              />
            )}
          />
        )}
      </CardContent>
    </Card>
  );

  const renderCategorySelection = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Clinical Issue Category
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the category that best describes the clinical issue
        </Typography>

        <Controller
          name="category"
          control={control}
          rules={{ required: 'Category is required' }}
          render={({ field }) => (
            <Grid container spacing={2}>
              {Object.entries(INTERVENTION_CATEGORIES).map(
                ([value, config]) => (
                  <Grid xs={12} sm={6} md={4} key={value}>
                    <Paper
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor:
                          field.value === value ? config.color : 'divider',
                        bgcolor:
                          field.value === value
                            ? `${config.color}10`
                            : 'background.paper',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: config.color,
                          bgcolor: `${config.color}05`,
                        },
                      }}
                      onClick={() => handleCategorySelect(value)}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography variant="h6" component="span">
                          {config.icon}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {config.label}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {config.description}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Chip
                          size="small"
                          label={field.value === value ? 'Selected' : 'Select'}
                          color={field.value === value ? 'primary' : 'default'}
                          variant={
                            field.value === value ? 'filled' : 'outlined'
                          }
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCategoryDetails(
                              showCategoryDetails === value ? null : value
                            );
                          }}
                        >
                          {showCategoryDetails === value ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </Box>
                      <Collapse in={showCategoryDetails === value}>
                        <Box
                          sx={{
                            mt: 2,
                            pt: 2,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{ mb: 1 }}
                          >
                            Common Examples:
                          </Typography>
                          {config.examples.map((example, index) => (
                            <Typography
                              key={index}
                              variant="body2"
                              color="text.secondary"
                              sx={{ ml: 1, mb: 0.5 }}
                            >
                              • {example}
                            </Typography>
                          ))}
                        </Box>
                      </Collapse>
                    </Paper>
                  </Grid>
                )
              )}
            </Grid>
          )}
        />
        {errors.category && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors.category.message}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderPrioritySelection = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Priority Level
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the urgency level based on clinical impact and patient safety
        </Typography>

        <Controller
          name="priority"
          control={control}
          rules={{ required: 'Priority is required' }}
          render={({ field }) => (
            <Grid container spacing={2}>
              {Object.entries(PRIORITY_LEVELS).map(([value, config]) => (
                <Grid xs={12} sm={6} key={value}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor:
                        field.value === value ? config.color : 'divider',
                      bgcolor:
                        field.value === value
                          ? `${config.color}10`
                          : 'background.paper',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        borderColor: config.color,
                        bgcolor: `${config.color}05`,
                      },
                    }}
                    onClick={() =>
                      setValue(
                        'priority',
                        value as ClinicalIntervention['priority']
                      )
                    }
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" component="span">
                        {config.icon}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {config.label}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {config.description}
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {config.guidance}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        />
        {errors.priority && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors.priority.message}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderIssueDescription = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Issue Description
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Provide a detailed description of the clinical issue or problem
        </Typography>

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
            <TextField
              {...field}
              fullWidth
              multiline
              rows={4}
              label="Clinical Issue Description"
              placeholder="Describe the clinical issue, including relevant patient history, current medications, symptoms, or concerns..."
              error={!!errors.issueDescription}
              helperText={
                errors.issueDescription?.message ||
                `${watchedIssueDescription?.length || 0}/1000 characters`
              }
            />
          )}
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
            💡 Tips for effective documentation:
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            • Include relevant patient history and current medications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            • Describe symptoms, timing, and severity
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            • Note any contributing factors or triggers
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            • Reference lab values or clinical parameters if relevant
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const renderDuplicateWarning = () => {
    if (!showDuplicateWarning) return null;

    return (
      <Alert
        severity="warning"
        icon={<WarningIcon />}
        sx={{ mb: 3 }}
        action={
          <Button size="small" onClick={() => setShowDuplicateWarning(false)}>
            Dismiss
          </Button>
        }
      >
        <Typography variant="body2" fontWeight="medium">
          Similar interventions found for this patient
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {duplicateInterventions.length} existing intervention(s) with the same
          category. Please review to avoid duplicates.
        </Typography>
        <Box sx={{ mt: 1 }}>
          {duplicateInterventions.slice(0, 3).map((intervention) => (
            <Chip
              key={intervention._id}
              label={`${intervention.interventionNumber} - ${intervention.status}`}
              size="small"
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
          {duplicateInterventions.length > 3 && (
            <Chip
              label={`+${duplicateInterventions.length - 3} more`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </Alert>
    );
  };

  const renderEstimatedDuration = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Estimated Duration (Optional)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Estimate how long this intervention might take to complete
        </Typography>

        <Controller
          name="estimatedDuration"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              type="number"
              label="Duration in minutes"
              placeholder="e.g., 30"
              sx={{ maxWidth: 200 }}
              InputProps={{
                inputProps: { min: 1, max: 480 },
              }}
              helperText="Leave blank if uncertain"
            />
          )}
        />
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 1: Issue Identification
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Document the clinical issue or problem that requires intervention
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderPatientSelection()}
        {renderDuplicateWarning()}
        {renderCategorySelection()}
        {renderPrioritySelection()}
        {renderIssueDescription()}
        {renderEstimatedDuration()}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Processing...' : 'Next: Strategy Recommendation'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default IssueIdentificationStep;
