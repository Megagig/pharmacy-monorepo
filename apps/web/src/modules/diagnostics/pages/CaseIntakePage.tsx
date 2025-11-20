import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Button,
  Alert,
  LinearProgress,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Avatar,
  Stack,
  Fade,
  Slide,
  Zoom,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ScienceIcon from '@mui/icons-material/Science';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import DiagnosticFeatureGuard from '../middlewares/diagnosticFeatureGuard';
import { aiDiagnosticService } from '../../../services/aiDiagnosticService';
import { toast } from 'react-hot-toast';

// Use the stable version of patient store
import { usePatientStore } from '../../../stores';

// Form validation schema - updated to match new form structure
const caseIntakeSchema = z.object({
  patientId: z.string().min(1, 'Patient selection is required'),
  symptoms: z.object({
    subjective: z.string().min(1, 'At least one subjective symptom is required (comma-separated)'),
    objective: z.string().optional(),
    duration: z.string().min(1, 'Symptom duration is required (e.g., "3 days", "2 weeks")'),
    severity: z.enum(['mild', 'moderate', 'severe'], {
      errorMap: () => ({ message: 'Please select symptom severity' })
    }),
    onset: z.enum(['acute', 'chronic', 'subacute'], {
      errorMap: () => ({ message: 'Please select symptom onset type' })
    }),
  }),
  vitals: z
    .object({
      bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, 'Format: systolic/diastolic (e.g., 120/80)').optional().or(z.literal('')),
      heartRate: z.number().min(30, 'Heart rate too low (min: 30)').max(250, 'Heart rate too high (max: 250)').optional(),
      temperature: z.number().min(30, 'Temperature too low (min: 30°C)').max(45, 'Temperature too high (max: 45°C)').optional(),
      bloodGlucose: z.number().min(20, 'Blood glucose too low (min: 20)').max(600, 'Blood glucose too high (max: 600)').optional(),
      respiratoryRate: z.number().min(8, 'Respiratory rate too low (min: 8)').max(60, 'Respiratory rate too high (max: 60)').optional(),
    })
    .optional(),
  currentMedications: z.any().optional(), // Accept any format (string or object array)
  allergies: z.string().optional(),
  medicalHistory: z.string().min(1, 'Medical history is required (one item per line)'),
  labResults: z.array(z.string()).optional(),
  consent: z.boolean().refine((val) => val === true, 'Patient consent is required to proceed'),
});

type CaseIntakeFormData = z.infer<typeof caseIntakeSchema>;

const STEPS = [
  {
    label: 'Patient Selection',
    description: 'Select the patient for this diagnostic case',
    icon: PersonIcon,
    color: '#1976d2',
  },
  {
    label: 'Symptom Assessment',
    description: 'Document patient symptoms and clinical findings',
    icon: AssignmentIcon,
    color: '#2e7d32',
  },
  {
    label: 'Vital Signs & History',
    description: 'Record vital signs, medications, and medical history',
    icon: MonitorHeartIcon,
    color: '#ed6c02',
  },
  {
    label: 'Review & Consent',
    description: 'Review information and obtain AI analysis consent',
    icon: VerifiedUserIcon,
    color: '#9c27b0',
  },
];

const CaseIntakePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeStep, setActiveStep] = useState(0);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    email: '',
  });

  // State for medications management
  const [medications, setMedications] = useState<Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>>([]);
  const [currentMed, setCurrentMed] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily'
  });

  // State for lab results management
  const [labResults, setLabResults] = useState<Array<{
    testName: string;
    value: string;
    unit: string;
    status: string;
  }>>([]);
  const [currentLab, setCurrentLab] = useState({
    testName: '',
    value: '',
    unit: '',
    status: 'Normal'
  });

  // Use individual selectors to avoid object recreation
  const patients = usePatientStore((state) => state.patients);
  const loading = usePatientStore(
    (state) => state.loading.fetchPatients || false
  );
  const createLoading = usePatientStore(
    (state) => state.loading.createPatient || false
  );
  const fetchPatients = usePatientStore((state) => state.fetchPatients);
  const createPatient = usePatientStore((state) => state.createPatient);

  // Fetch patients only once when component mounts (no dependencies to avoid infinite loop)
  React.useEffect(() => {
    const loadPatients = async () => {
      try {
        await fetchPatients();
      } catch (error) {
        console.error('Failed to fetch patients:', error);
      }
    };
    loadPatients();
  }, [fetchPatients]); // Empty dependency array - only run once on mount

  // Initialize react-hook-form with zod validation
  const methods = useForm<CaseIntakeFormData>({
    resolver: zodResolver(caseIntakeSchema),
    defaultValues: {
      patientId: '',
      symptoms: {
        subjective: '',
        objective: '',
        duration: '',
        severity: 'mild',
        onset: 'acute',
      },
      vitals: {},
      currentMedications: [],
      allergies: '',
      medicalHistory: '',
      labResults: [],
      consent: false,
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    setValue,
  } = methods;

  // Handle patient selection from URL parameters (when returning from patients page)
  React.useEffect(() => {
    const selectedPatientId = searchParams.get('selectedPatient');
    if (selectedPatientId) {
      if (patients.length > 0) {
        // Verify the patient exists in the loaded patients
        const patientExists = patients.some((p) => p._id === selectedPatientId);
        if (patientExists) {
          setValue('patientId', selectedPatientId, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          });

          // Manually trigger validation for this field
          setTimeout(() => {
            trigger('patientId');
          }, 100);

          // Clear the URL parameter to avoid re-selecting on refresh
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('selectedPatient');
          const newUrl = `/pharmacy/diagnostics/case/new${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''
            }`;
          navigate(newUrl, { replace: true });
        }
      }
    }
  }, [searchParams, setValue, navigate, patients, trigger]);

  // Additional effect to handle the case where URL param exists but patients aren't loaded yet
  React.useEffect(() => {
    const selectedPatientId = searchParams.get('selectedPatient');
    if (selectedPatientId && patients.length > 0 && !watch('patientId')) {
      const patientExists = patients.some((p) => p._id === selectedPatientId);
      if (patientExists) {
        setValue('patientId', selectedPatientId, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });

        // Manually trigger validation for this field
        setTimeout(() => {
          trigger('patientId');
        }, 100);
      }
    }
  }, [patients, searchParams, setValue, trigger, watch]);

  const handleNext = async () => {
    // Validate current step before proceeding
    const fieldsToValidate = getFieldsForStep(activeStep);
    const isValid = await trigger(fieldsToValidate);

    if (!isValid) {
      // Show error message indicating which fields need to be filled
      const stepErrors = fieldsToValidate
        .filter(field => errors[field])
        .map(field => {
          if (field === 'patientId') return 'Patient selection';
          if (field === 'symptoms') return 'Subjective symptoms';
          if (field === 'medicalHistory') return 'Medical history';
          if (field === 'consent') return 'Consent agreement';
          return field;
        });

      if (stepErrors.length > 0) {
        toast.error(`Please fill required fields: ${stepErrors.join(', ')}`);
      }
      return;
    }

    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleCancel = () => {
    navigate('/diagnostics');
  };

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: CaseIntakeFormData) => {
    try {
      setSubmitting(true);


      // First validate patient access

      const accessValidation = await aiDiagnosticService.validatePatientAccess(data.patientId);

      if (!accessValidation.hasAccess) {
        toast.error(`Patient Access Error: ${accessValidation.error}`);
        setSubmitting(false);
        return;
      }

      // Show loading message with time expectation
      toast.loading(
        'Submitting case for AI analysis... This may take up to 3 minutes.',
        {
          id: 'ai-analysis-loading',
        }
      );

      // Transform medications to proper format
      let transformedMedications: any[] = [];
      if (data.currentMedications) {
        if (Array.isArray(data.currentMedications)) {
          transformedMedications = data.currentMedications
            .map((med: any) => {
              if (typeof med === 'string') {
                const parts = med.split('-').map(p => p.trim());
                return {
                  name: parts[0] || med,
                  dosage: parts[1] || 'As prescribed',
                  frequency: parts[2] || 'As directed'
                };
              }
              // If it's already an object, ensure dosage and frequency are not empty
              return {
                name: med.name || 'Unknown medication',
                dosage: med.dosage || 'As prescribed',
                frequency: med.frequency || 'As directed'
              };
            })
            .filter((med: any) => med.name && med.name.trim()); // Only include meds with names
        }
      }

      // Transform form data to match API expectations
      const caseData = {
        patientId: data.patientId,
        symptoms: {
          subjective:
            data.symptoms?.subjective && data.symptoms.subjective.trim()
              ? data.symptoms.subjective
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
              : [],
          objective:
            data.symptoms?.objective && data.symptoms.objective.trim()
              ? data.symptoms.objective
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
              : [],
          duration: data.symptoms?.duration && data.symptoms.duration.trim()
            ? data.symptoms.duration.trim()
            : 'Not specified',
          severity: data.symptoms?.severity || 'mild' as const,
          onset: data.symptoms?.onset || 'acute' as const,
        },
        vitalSigns: {
          bloodPressure: data.vitals?.bloodPressure || undefined,
          heartRate: data.vitals?.heartRate
            ? Number(data.vitals.heartRate)
            : undefined,
          temperature: data.vitals?.temperature
            ? Number(data.vitals.temperature)
            : undefined,
          respiratoryRate: data.vitals?.respiratoryRate
            ? Number(data.vitals.respiratoryRate)
            : undefined,
          bloodGlucose: data.vitals?.bloodGlucose
            ? Number(data.vitals.bloodGlucose)
            : undefined,
        },
        currentMedications: transformedMedications,
        labResults: [], // Lab results should be ObjectIds - for now send empty array
        medicalHistory: data.medicalHistory
          ? data.medicalHistory.split('\n').filter(h => h.trim()).map(h => h.trim())
          : [],
        allergies: data.allergies
          ? data.allergies.split('\n').filter(a => a.trim()).map(a => a.trim())
          : [],
        patientConsent: {
          provided: true,
          method: 'electronic',
        },
      };

      // Debug: Log the transformed data

      // Validate required fields before submission
      if (!caseData.patientId) {
        toast.error('Patient selection is required');
        setSubmitting(false);
        return;
      }

      if (
        !caseData.symptoms.subjective ||
        caseData.symptoms.subjective.length === 0
      ) {
        toast.error('At least one subjective symptom is required');
        setSubmitting(false);
        return;
      }

      // Submit case for AI analysis

      const diagnosticCase = await aiDiagnosticService.submitCase(caseData);

      // Dismiss loading toast and show success message
      toast.dismiss('ai-analysis-loading');
      toast.success('AI analysis completed successfully!');

      // Navigate to results page with the completed analysis
      const navUrl = `/pharmacy/diagnostics/case/${diagnosticCase.id}/results`;

      navigate(navUrl);
    } catch (error: unknown) {
      console.error('Failed to submit case:', error);

      // Dismiss loading toast
      toast.dismiss('ai-analysis-loading');

      // Extract and display error message
      let errorMessage = 'Failed to submit case. Please try again.';

      // Check for 409 Conflict (Active request exists)
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response &&
        error.response.status === 409
      ) {
        toast.error(
          'An active diagnostic request already exists for this patient. Please wait for the current request to complete before submitting a new one.',
          {
            duration: 8000,
            icon: '⏳',
            style: {
              background: '#FFF3E0',
              color: '#E65100',
              border: '2px solid #FF9800',
            },
          }
        );
        setSubmitting(false);
        return;
      }

      // Check if it's an Error object with our validation message
      if (error && typeof error === 'object' && 'message' in error) {
        const err = error as Error;
        errorMessage = err.message;

        // If it's a validation error with multiple lines, show each as separate toast
        if (errorMessage.includes('Validation failed:')) {
          const lines = errorMessage.split('\n').filter(line => line.trim());
          const title = lines[0]; // "Validation failed:"
          const errors = lines.slice(1); // Individual error messages

          // Show title
          toast.error(title, { duration: 5000 });

          // Show each validation error
          errors.forEach((err, index) => {
            setTimeout(() => {
              toast.error(err.replace('• ', ''), {
                duration: 6000,
                icon: '⚠️'
              });
            }, index * 100); // Stagger the toasts slightly
          });

          setSubmitting(false);
          return;
        }
      }

      // Fallback: check for axios response errors
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'errors' in error.response.data &&
        Array.isArray(error.response.data.errors)
      ) {
        // Show specific validation errors
        const validationErrors = error.response.data.errors
          .map((err: unknown) => {
            if (err && typeof err === 'object') {
              const errObj = err as {
                path?: string;
                param?: string;
                msg?: string;
                message?: string;
              };
              return `${errObj.path || errObj.param}: ${errObj.msg || errObj.message
                }`;
            }
            return String(err);
          })
          .join(', ');
        errorMessage = `Validation failed: ${validationErrors}`;
      } else if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'message' in error.response.data
      ) {
        const responseData = error.response.data as { message: string };
        errorMessage = responseData.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message: string };
        errorMessage = errorObj.message;
      }

      // Debug: Log the full error
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response
      ) {
        console.error('Full error details:', error.response.data);
      }

      // Show error toast (only if not already shown as validation errors)
      if (!errorMessage.includes('Validation failed:')) {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePatient = async () => {
    if (
      !newPatientData.firstName ||
      !newPatientData.lastName ||
      !newPatientData.phone ||
      !newPatientData.dateOfBirth
    ) {
      return;
    }

    const createdPatient = await createPatient(newPatientData);
    if (createdPatient) {
      // Auto-select the newly created patient
      methods.setValue('patientId', createdPatient._id);
      setCreatePatientOpen(false);
      setNewPatientData({
        firstName: '',
        lastName: '',
        phone: '',
        dateOfBirth: '',
        email: '',
      });
    }
  };

  const handleCloseCreatePatient = () => {
    setCreatePatientOpen(false);
    setNewPatientData({
      firstName: '',
      lastName: '',
      phone: '',
      dateOfBirth: '',
      email: '',
    });
  };

  // Helper function to determine which fields to validate for each step
  const getFieldsForStep = (step: number): (keyof CaseIntakeFormData)[] => {
    switch (step) {
      case 0:
        return ['patientId'];
      case 1:
        return ['symptoms'];
      case 2:
        return ['medicalHistory'];
      case 3:
        return ['consent'];
      default:
        return [];
    }
  };

  // Helper function to sort patients with selected patient first
  const getSortedPatients = () => {
    const selectedPatientId = watch('patientId');
    if (!selectedPatientId) {
      return patients;
    }

    const selectedPatient = patients.find((p) => p._id === selectedPatientId);
    const otherPatients = patients.filter((p) => p._id !== selectedPatientId);

    return selectedPatient ? [selectedPatient, ...otherPatients] : patients;
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            {/* Action Buttons */}
            <Box sx={{ mb: 4 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="outlined"
                  onClick={() => fetchPatients()}
                  disabled={loading}
                  startIcon={loading ? <RefreshIcon className="animate-spin" /> : <RefreshIcon />}
                  sx={{
                    borderRadius: 3,
                    textTransform: 'none',
                    fontWeight: 600,
                    flex: 1
                  }}
                >
                  {loading ? 'Refreshing...' : 'Refresh Patients'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/patients?for=diagnostics')}
                  startIcon={<SearchIcon />}
                  sx={{
                    borderRadius: 3,
                    textTransform: 'none',
                    fontWeight: 600,
                    flex: 1
                  }}
                >
                  Browse Patients
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreatePatientOpen(true)}
                  sx={{
                    borderRadius: 3,
                    textTransform: 'none',
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #1976d2, #1565c0)',
                    flex: 1
                  }}
                >
                  New Patient
                </Button>
              </Stack>
            </Box>

            {/* Selected Patient Display */}
            {watch('patientId') && (
              <Zoom in timeout={500}>
                <Paper
                  elevation={0}
                  sx={{
                    mb: 4,
                    p: 3,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #e8f5e8, #f1f8e9)',
                    border: '2px solid #4caf50',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar
                      sx={{
                        bgcolor: 'success.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      <CheckCircleIcon />
                    </Avatar>
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, color: 'success.dark', mb: 0.5 }}
                      >
                        Selected Patient
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {(() => {
                          const selectedPatient = patients.find(
                            (p) => p._id === watch('patientId')
                          );
                          return selectedPatient
                            ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                            : 'Loading patient details...';
                        })()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(() => {
                          const selectedPatient = patients.find(
                            (p) => p._id === watch('patientId')
                          );
                          return selectedPatient
                            ? `DOB: ${selectedPatient.dateOfBirth}`
                            : '';
                        })()}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Zoom>
            )}

            {/* Patient Selection */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: errors.patientId ? 'error.main' : 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    width: 40,
                    height: 40,
                    mr: 2,
                  }}
                >
                  <PersonIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Choose Patient
                    </Typography>
                    <Chip
                      label="REQUIRED"
                      size="small"
                      color="error"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Select the patient for this diagnostic case
                  </Typography>
                </Box>
              </Box>

              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.patientId}>
                    <InputLabel>Select Patient</InputLabel>
                    <Select
                      {...field}
                      label="Select Patient"
                      disabled={loading}
                      sx={{ borderRadius: 2 }}
                    >
                      {loading ? (
                        <MenuItem disabled>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <RefreshIcon className="animate-spin" sx={{ mr: 1 }} />
                            Loading patients...
                          </Box>
                        </MenuItem>
                      ) : patients.length === 0 ? (
                        <MenuItem disabled>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            No patients found. Please add patients first.
                          </Box>
                        </MenuItem>
                      ) : (
                        getSortedPatients().map((patient, index) => (
                          <MenuItem key={patient._id} value={patient._id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <Avatar
                                sx={{
                                  bgcolor: index === 0 && watch('patientId') === patient._id
                                    ? 'success.main'
                                    : 'grey.300',
                                  width: 32,
                                  height: 32,
                                  mr: 2,
                                }}
                              >
                                {index === 0 && watch('patientId') === patient._id ? (
                                  <CheckCircleIcon sx={{ fontSize: 18 }} />
                                ) : (
                                  <PersonIcon sx={{ fontSize: 18 }} />
                                )}
                              </Avatar>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {patient.firstName} {patient.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  DOB: {patient.dateOfBirth}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                    {errors.patientId && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, ml: 1 }}>
                        {errors.patientId.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />

              {/* Empty State */}
              {!loading && patients.length === 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 3,
                    p: 4,
                    borderRadius: 3,
                    bgcolor: 'grey.50',
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: 'grey.300'
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: 'grey.200',
                      width: 64,
                      height: 64,
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 32 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    No Patients Found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    You need to add patients before creating a diagnostic case
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                    <Button
                      variant="contained"
                      onClick={() => navigate('/patients?for=diagnostics')}
                      startIcon={<SearchIcon />}
                      sx={{
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      Browse Patients
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setCreatePatientOpen(true)}
                      sx={{
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      Create New Patient
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Paper>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Grid container spacing={4}>
              {/* Subjective Symptoms */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: errors.symptoms?.subjective ? 'error.main' : 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.50',
                        color: 'primary.main',
                        width: 40,
                        height: 40,
                        mr: 2,
                      }}
                    >
                      <AssignmentIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Subjective Symptoms
                        </Typography>
                        <Chip
                          label="REQUIRED"
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Patient's reported symptoms and complaints
                      </Typography>
                    </Box>
                  </Box>

                  <Controller
                    name="symptoms.subjective"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={6}
                        placeholder="List patient's reported symptoms (comma-separated)... 
                        
Examples:
• Severe headache, nausea, sensitivity to light
• Chest pain, shortness of breath, sweating
• Fever, cough, fatigue, body aches
• Abdominal pain, diarrhea, loss of appetite"
                        error={!!errors.symptoms?.subjective}
                        helperText={errors.symptoms?.subjective?.message || "Enter symptoms separated by commas"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    )}
                  />
                </Paper>
              </Grid>

              {/* Objective Symptoms */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'secondary.50',
                        color: 'secondary.main',
                        width: 40,
                        height: 40,
                        mr: 2,
                      }}
                    >
                      <MedicalInformationIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Objective Symptoms
                        <Chip label="Optional" size="small" sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Observable signs and clinical findings
                      </Typography>
                    </Box>
                  </Box>

                  <Controller
                    name="symptoms.objective"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={4}
                        placeholder="Document observable signs and clinical findings...

Examples:
• Physical examination findings
• Visible symptoms or abnormalities
• Measurable clinical signs
• Laboratory or diagnostic results"
                        error={!!errors.symptoms?.objective}
                        helperText={errors.symptoms?.objective?.message}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    )}
                  />
                </Paper>
              </Grid>

              {/* Symptom Characteristics */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'warning.50',
                        color: 'warning.main',
                        width: 40,
                        height: 40,
                        mr: 2,
                      }}
                    >
                      <LocalHospitalIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Symptom Characteristics
                        </Typography>
                        <Chip
                          label="OPTIONAL"
                          size="small"
                          color="default"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Duration, severity, and onset details
                      </Typography>
                    </Box>
                  </Box>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Controller
                        name="symptoms.duration"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Duration"
                            placeholder="e.g., 3 days, 2 weeks, 6 months"
                            error={!!errors.symptoms?.duration}
                            helperText={errors.symptoms?.duration?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Controller
                        name="symptoms.severity"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Severity</InputLabel>
                            <Select
                              {...field}
                              label="Severity"
                              sx={{ borderRadius: 2 }}
                            >
                              <MenuItem value="mild">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'success.main',
                                      mr: 1,
                                    }}
                                  />
                                  Mild
                                </Box>
                              </MenuItem>
                              <MenuItem value="moderate">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'warning.main',
                                      mr: 1,
                                    }}
                                  />
                                  Moderate
                                </Box>
                              </MenuItem>
                              <MenuItem value="severe">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'error.main',
                                      mr: 1,
                                    }}
                                  />
                                  Severe
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Controller
                        name="symptoms.onset"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Onset</InputLabel>
                            <Select
                              {...field}
                              label="Onset"
                              sx={{ borderRadius: 2 }}
                            >
                              <MenuItem value="acute">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'error.main',
                                      mr: 1,
                                    }}
                                  />
                                  Acute (sudden onset)
                                </Box>
                              </MenuItem>
                              <MenuItem value="subacute">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'warning.main',
                                      mr: 1,
                                    }}
                                  />
                                  Subacute (gradual onset)
                                </Box>
                              </MenuItem>
                              <MenuItem value="chronic">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: 'info.main',
                                      mr: 1,
                                    }}
                                  />
                                  Chronic (long-term)
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Grid container spacing={4}>
              {/* Section 1: Medical History */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: errors.medicalHistory ? 'error.main' : 'primary.main',
                    bgcolor: 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      <MedicalInformationIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          1. Medical History
                        </Typography>
                        <Chip
                          label="REQUIRED"
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Patient's medical background and history
                      </Typography>
                    </Box>
                  </Box>

                  <Controller
                    name="medicalHistory"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={5}
                        placeholder="Document patient's medical history (one item per line)...&#10;&#10;Examples:&#10;• Hypertension - diagnosed 2015&#10;• Type 2 Diabetes - managed with metformin&#10;• Previous appendectomy - 2018&#10;• Family history of heart disease"
                        error={!!errors.medicalHistory}
                        helperText={errors.medicalHistory?.message || "Enter relevant medical history - one item per line"}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            bgcolor: 'grey.50'
                          }
                        }}
                      />
                    )}
                  />
                </Paper>
              </Grid>

              {/* Section 2: Current Medications */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: 'success.main',
                    bgcolor: 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'success.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      💊
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                        2. Current Medications
                        <Chip label="Optional" size="small" color="success" variant="outlined" sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add medications with structured fields for accuracy
                      </Typography>
                    </Box>
                  </Box>

                  {/* Medication Input Form */}
                  <Box sx={{ mb: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={5}>
                        <TextField
                          fullWidth
                          label="Medication Name"
                          placeholder="e.g., Metformin, Lisinopril"
                          value={currentMed.name}
                          onChange={(e) => setCurrentMed({ ...currentMed, name: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="Dosage"
                          placeholder="e.g., 500mg, 10mg"
                          value={currentMed.dosage}
                          onChange={(e) => setCurrentMed({ ...currentMed, dosage: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Frequency</InputLabel>
                          <Select
                            value={currentMed.frequency}
                            label="Frequency"
                            onChange={(e) => setCurrentMed({ ...currentMed, frequency: e.target.value })}
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="Once daily">Once daily</MenuItem>
                            <MenuItem value="Twice daily">Twice daily</MenuItem>
                            <MenuItem value="Three times daily">Three times daily</MenuItem>
                            <MenuItem value="Four times daily">Four times daily</MenuItem>
                            <MenuItem value="Every 4 hours">Every 4 hours</MenuItem>
                            <MenuItem value="Every 6 hours">Every 6 hours</MenuItem>
                            <MenuItem value="Every 8 hours">Every 8 hours</MenuItem>
                            <MenuItem value="Every 12 hours">Every 12 hours</MenuItem>
                            <MenuItem value="At bedtime">At bedtime</MenuItem>
                            <MenuItem value="As needed">As needed (PRN)</MenuItem>
                            <MenuItem value="Weekly">Weekly</MenuItem>
                            <MenuItem value="Monthly">Monthly</MenuItem>
                            <MenuItem value="As directed">As directed</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={1}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          onClick={() => {
                            if (currentMed.name.trim()) {
                              const newMed = {
                                name: currentMed.name.trim(),
                                dosage: currentMed.dosage.trim() || 'As prescribed',
                                frequency: currentMed.frequency
                              };
                              setMedications([...medications, newMed]);
                              setValue('currentMedications', [...medications, newMed]);
                              setCurrentMed({ name: '', dosage: '', frequency: 'Once daily' });
                            }
                          }}
                          disabled={!currentMed.name.trim()}
                          sx={{ height: 56, borderRadius: 2 }}
                        >
                          <AddIcon />
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Added Medications List */}
                  {medications.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Added Medications ({medications.length})
                      </Typography>
                      <Stack spacing={1}>
                        {medications.map((med, index) => (
                          <Paper
                            key={index}
                            sx={{
                              p: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              bgcolor: 'success.50',
                              border: '1px solid',
                              borderColor: 'success.main',
                            }}
                          >
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {med.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {med.dosage} • {med.frequency}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                const newMeds = medications.filter((_, i) => i !== index);
                                setMedications(newMeds);
                                setValue('currentMedications', newMeds);
                              }}
                            >
                              ✕
                            </IconButton>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {medications.length === 0 && (
                    <Alert severity="info" icon="ℹ️">
                      No medications added yet. Use the form above to add medications.
                    </Alert>
                  )}
                </Paper>
              </Grid>

              {/* Section 3: Allergies & Adverse Reactions */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: 'warning.main',
                    bgcolor: 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'warning.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      <LocalHospitalIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                        3. Allergies & Adverse Reactions
                        <Chip label="Optional" size="small" color="warning" variant="outlined" sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Document known allergies and previous adverse reactions
                      </Typography>
                    </Box>
                  </Box>

                  <Controller
                    name="allergies"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="List any known allergies (one per line)...&#10;&#10;Examples:&#10;• Penicillin - Rash and hives&#10;• Sulfa drugs - Severe reaction&#10;• Peanuts - Anaphylaxis&#10;• Latex - Contact dermatitis&#10;&#10;Leave blank if no known allergies"
                        helperText="Enter allergies one per line (optional - leave blank if none)"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            bgcolor: 'grey.50'
                          }
                        }}
                      />
                    )}
                  />
                </Paper>
              </Grid>

              {/* Section 4: Laboratory Results */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: 'info.main',
                    bgcolor: 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'info.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      🔬
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.main' }}>
                        4. Laboratory Results
                        <Chip label="Optional" size="small" color="info" variant="outlined" sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add lab test results with structured fields
                      </Typography>
                    </Box>
                  </Box>

                  {/* Lab Results Input Form */}
                  <Box sx={{ mb: 3 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Test Name</InputLabel>
                          <Select
                            value={currentLab.testName}
                            label="Test Name"
                            onChange={(e) => setCurrentLab({ ...currentLab, testName: e.target.value })}
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="WBC">WBC (White Blood Cells)</MenuItem>
                            <MenuItem value="Hemoglobin">Hemoglobin</MenuItem>
                            <MenuItem value="Hematocrit">Hematocrit</MenuItem>
                            <MenuItem value="Platelets">Platelets</MenuItem>
                            <MenuItem value="Glucose">Glucose (Blood Sugar)</MenuItem>
                            <MenuItem value="HbA1c">HbA1c (Glycated Hemoglobin)</MenuItem>
                            <MenuItem value="Cholesterol">Total Cholesterol</MenuItem>
                            <MenuItem value="LDL">LDL Cholesterol</MenuItem>
                            <MenuItem value="HDL">HDL Cholesterol</MenuItem>
                            <MenuItem value="Triglycerides">Triglycerides</MenuItem>
                            <MenuItem value="Creatinine">Creatinine</MenuItem>
                            <MenuItem value="BUN">BUN (Blood Urea Nitrogen)</MenuItem>
                            <MenuItem value="ALT">ALT (Liver Function)</MenuItem>
                            <MenuItem value="AST">AST (Liver Function)</MenuItem>
                            <MenuItem value="TSH">TSH (Thyroid)</MenuItem>
                            <MenuItem value="T3">T3 (Thyroid)</MenuItem>
                            <MenuItem value="T4">T4 (Thyroid)</MenuItem>
                            <MenuItem value="Sodium">Sodium</MenuItem>
                            <MenuItem value="Potassium">Potassium</MenuItem>
                            <MenuItem value="Calcium">Calcium</MenuItem>
                            <MenuItem value="Other">Other (Custom)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label={currentLab.testName === 'Other' ? 'Custom Test Name' : 'Value'}
                          placeholder={currentLab.testName === 'Other' ? 'Enter test name' : 'e.g., 7.2, 14.5'}
                          value={currentLab.value}
                          onChange={(e) => setCurrentLab({ ...currentLab, value: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <TextField
                          fullWidth
                          label="Unit"
                          placeholder="e.g., mg/dL, g/dL"
                          value={currentLab.unit}
                          onChange={(e) => setCurrentLab({ ...currentLab, unit: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={currentLab.status}
                            label="Status"
                            onChange={(e) => setCurrentLab({ ...currentLab, status: e.target.value })}
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="Normal">Normal</MenuItem>
                            <MenuItem value="Low">Low</MenuItem>
                            <MenuItem value="High">High</MenuItem>
                            <MenuItem value="Critical">Critical</MenuItem>
                            <MenuItem value="Borderline">Borderline</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={1}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="info"
                          onClick={() => {
                            if (currentLab.testName && currentLab.value.trim()) {
                              const newLab = {
                                testName: currentLab.testName,
                                value: currentLab.value.trim(),
                                unit: currentLab.unit.trim() || 'N/A',
                                status: currentLab.status
                              };
                              setLabResults([...labResults, newLab]);
                              // Store as formatted strings for submission
                              const formattedLab = `${newLab.testName}: ${newLab.value} ${newLab.unit} - ${newLab.status}`;
                              setValue('labResults', [...(watch('labResults') || []), formattedLab]);
                              setCurrentLab({ testName: '', value: '', unit: '', status: 'Normal' });
                            }
                          }}
                          disabled={!currentLab.testName || !currentLab.value.trim()}
                          sx={{ height: 56, borderRadius: 2 }}
                        >
                          <AddIcon />
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Added Lab Results List */}
                  {labResults.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Added Lab Results ({labResults.length})
                      </Typography>
                      <Grid container spacing={1}>
                        {labResults.map((lab, index) => (
                          <Grid item xs={12} md={6} key={index}>
                            <Paper
                              sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor:
                                  lab.status === 'Critical' ? 'error.50' :
                                    lab.status === 'High' ? 'warning.50' :
                                      lab.status === 'Low' ? 'info.50' :
                                        'success.50',
                                border: '1px solid',
                                borderColor:
                                  lab.status === 'Critical' ? 'error.main' :
                                    lab.status === 'High' ? 'warning.main' :
                                      lab.status === 'Low' ? 'info.main' :
                                        'success.main',
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {lab.testName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {lab.value} {lab.unit} • <Chip
                                    label={lab.status}
                                    size="small"
                                    color={
                                      lab.status === 'Critical' ? 'error' :
                                        lab.status === 'High' ? 'warning' :
                                          lab.status === 'Low' ? 'info' :
                                            'success'
                                    }
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  const newLabs = labResults.filter((_, i) => i !== index);
                                  setLabResults(newLabs);
                                  const formattedLabs = newLabs.map(l =>
                                    `${l.testName}: ${l.value} ${l.unit} - ${l.status}`
                                  );
                                  setValue('labResults', formattedLabs);
                                }}
                              >
                                ✕
                              </IconButton>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {labResults.length === 0 && (
                    <Alert severity="info" icon="📋">
                      No lab results added yet. Lab results are optional but can help improve diagnostic accuracy.
                    </Alert>
                  )}
                </Paper>
              </Grid>

              {/* Section 5: Vital Signs */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: 'secondary.main',
                    bgcolor: 'background.paper',
                    transition: 'all 0.3s',
                    '&:hover': {
                      boxShadow: 4,
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'secondary.main',
                        width: 48,
                        height: 48,
                        mr: 2,
                      }}
                    >
                      <MonitorHeartIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                        5. Vital Signs
                        <Chip label="Optional" size="small" color="secondary" variant="outlined" sx={{ ml: 1 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Current physiological measurements
                      </Typography>
                    </Box>
                  </Box>

                  <Alert severity="info" icon="📊" sx={{ mb: 3 }}>
                    <strong>Reference Ranges:</strong> BP: 90-140/60-90 mmHg | HR: 60-100 bpm | Temp: 36.1-37.2°C | RR: 12-20/min | Glucose: 70-100 mg/dL
                  </Alert>

                  <Grid container spacing={3}>
                    {/* Blood Pressure */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Controller
                        name="vitals.bloodPressure"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Blood Pressure"
                            placeholder="120/80"
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, fontSize: '1.5rem' }}>
                                  🩸
                                </Box>
                              ),
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  mmHg
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  bgcolor: 'white',
                                }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Heart Rate */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Controller
                        name="vitals.heartRate"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Heart Rate"
                            placeholder="72"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, fontSize: '1.5rem' }}>
                                  💓
                                </Box>
                              ),
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  bpm
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  bgcolor: 'white',
                                }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Temperature */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Controller
                        name="vitals.temperature"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Temperature"
                            placeholder="36.5"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, fontSize: '1.5rem' }}>
                                  🌡️
                                </Box>
                              ),
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  °C
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  bgcolor: 'white',
                                }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Respiratory Rate */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Controller
                        name="vitals.respiratoryRate"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Respiratory Rate"
                            placeholder="16"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, fontSize: '1.5rem' }}>
                                  🫁
                                </Box>
                              ),
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  /min
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  bgcolor: 'white',
                                }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Blood Glucose */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Controller
                        name="vitals.bloodGlucose"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Blood Glucose"
                            placeholder="95"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                            InputProps={{
                              startAdornment: (
                                <Box sx={{ mr: 1, fontSize: '1.5rem' }}>
                                  💉
                                </Box>
                              ),
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  mg/dL
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                '&:hover': {
                                  bgcolor: 'white',
                                }
                              }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box>
            {/* Review Header */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #e3f2fd, #f3e5f5)',
                border: '1px solid',
                borderColor: 'primary.200',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 48,
                    height: 48,
                    mr: 2,
                  }}
                >
                  <VerifiedUserIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Review & Submit for AI Analysis
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please review all information before submitting for AI-powered diagnostic analysis
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Grid container spacing={3}>
              {/* Patient Information */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.50',
                        color: 'primary.main',
                        width: 32,
                        height: 32,
                        mr: 1.5,
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Patient Information
                    </Typography>
                  </Box>
                  <Box sx={{ pl: 5 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {watch('patientId')
                        ? (() => {
                          const selectedPatient = patients.find(
                            (p) => p._id === watch('patientId')
                          );
                          return selectedPatient
                            ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                            : 'Patient not found';
                        })()
                        : 'None selected'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {watch('patientId')
                        ? (() => {
                          const selectedPatient = patients.find(
                            (p) => p._id === watch('patientId')
                          );
                          return selectedPatient
                            ? `DOB: ${selectedPatient.dateOfBirth}`
                            : '';
                        })()
                        : ''}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Symptom Summary */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'secondary.50',
                        color: 'secondary.main',
                        width: 32,
                        height: 32,
                        mr: 1.5,
                      }}
                    >
                      <AssignmentIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Symptom Summary
                    </Typography>
                  </Box>
                  <Box sx={{ pl: 5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Duration: {watch('symptoms.duration') || 'Not specified'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Severity: {watch('symptoms.severity') || 'Not specified'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Onset: {watch('symptoms.onset') || 'Not specified'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Subjective Symptoms */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'info.50',
                        color: 'info.main',
                        width: 32,
                        height: 32,
                        mr: 1.5,
                      }}
                    >
                      <AssignmentIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Subjective Symptoms
                    </Typography>
                  </Box>
                  <Box sx={{ pl: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {watch('symptoms.subjective') || 'None specified'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Objective Symptoms */}
              {watch('symptoms.objective') && (
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: 'warning.50',
                          color: 'warning.main',
                          width: 32,
                          height: 32,
                          mr: 1.5,
                        }}
                      >
                        <MedicalInformationIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Objective Symptoms
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {watch('symptoms.objective')}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Medical History */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'success.50',
                        color: 'success.main',
                        width: 32,
                        height: 32,
                        mr: 1.5,
                      }}
                    >
                      <LocalHospitalIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Medical History
                    </Typography>
                  </Box>
                  <Box sx={{ pl: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {watch('medicalHistory') || 'None specified'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Consent Section */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: '2px solid',
                    borderColor: errors.consent ? 'error.main' : 'primary.main',
                    background: errors.consent
                      ? 'linear-gradient(135deg, #ffebee, #fce4ec)'
                      : 'linear-gradient(135deg, #e3f2fd, #f3e5f5)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: errors.consent ? 'error.main' : 'primary.main',
                        width: 40,
                        height: 40,
                        mr: 2,
                      }}
                    >
                      <VerifiedUserIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          AI Analysis Consent
                        </Typography>
                        <Chip
                          label="REQUIRED"
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Must be checked before submitting
                      </Typography>
                    </Box>
                  </Box>

                  <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    <Typography variant="body2">
                      🤖 Our AI system will analyze the provided clinical data to generate diagnostic insights,
                      differential diagnoses, and treatment recommendations. This analysis is intended to assist
                      healthcare professionals and should not replace clinical judgment.
                    </Typography>
                  </Alert>

                  <Controller
                    name="consent"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={field.value}
                            onChange={field.onChange}
                            sx={{
                              '&.Mui-checked': {
                                color: 'primary.main',
                              },
                            }}
                          />
                        }
                        label={
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            I consent to AI-powered diagnostic analysis of this case and understand
                            that the results are for clinical decision support only.
                          </Typography>
                        }
                        sx={{ alignItems: 'flex-start' }}
                      />
                    )}
                  />
                  {errors.consent && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 1, ml: 4 }}>
                      {errors.consent.message}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <FormProvider {...methods}>
        <Box
          sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            py: 4,
          }}
        >
          <Container maxWidth="xl">
            {/* Modern Header */}
            <Fade in timeout={800}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  mb: 4,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <IconButton
                    onClick={handleCancel}
                    sx={{
                      mr: 2,
                      bgcolor: 'primary.50',
                      '&:hover': { bgcolor: 'primary.100' }
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 700,
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1
                      }}
                    >
                      New Diagnostic Case
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                      Complete the form to create a comprehensive diagnostic case
                    </Typography>
                  </Box>
                </Box>

                {/* Modern Progress Bar */}
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(activeStep / (STEPS.length - 1)) * 100}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: -20,
                      fontWeight: 600,
                      color: 'primary.main'
                    }}
                  >
                    Step {activeStep + 1} of {STEPS.length}
                  </Typography>
                </Box>

                {/* Step Indicators */}
                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  {STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index === activeStep;
                    const isCompleted = index < activeStep;

                    return (
                      <Zoom in timeout={600 + index * 100} key={step.label}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flex: 1,
                            p: 2,
                            borderRadius: 3,
                            bgcolor: isActive ? `${step.color}15` : isCompleted ? 'success.50' : 'grey.50',
                            border: `2px solid ${isActive ? step.color : isCompleted ? 'success.main' : 'transparent'}`,
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: 2,
                            }
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: isActive ? step.color : isCompleted ? 'success.main' : 'grey.400',
                              width: 40,
                              height: 40,
                              mr: 2,
                            }}
                          >
                            {isCompleted ? <CheckCircleIcon /> : <StepIcon />}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: isActive ? 700 : 500,
                                color: isActive ? step.color : isCompleted ? 'success.main' : 'text.primary',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {step.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: { xs: 'none', md: 'block' },
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {step.description}
                            </Typography>
                          </Box>
                        </Box>
                      </Zoom>
                    );
                  })}
                </Stack>
              </Paper>
            </Fade>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={4}>
                {/* Modern Stepper Sidebar */}
                <Grid item xs={12} lg={3}>
                  <Slide in direction="right" timeout={1000}>
                    <Paper
                      elevation={0}
                      sx={{
                        position: 'sticky',
                        top: 24,
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        overflow: 'hidden',
                      }}
                    >
                      <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Progress Overview
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Track your diagnostic case creation
                        </Typography>
                      </Box>

                      <Box sx={{ p: 3 }}>
                        <Stack spacing={3}>
                          {STEPS.map((step, index) => {
                            const StepIcon = step.icon;
                            const isActive = index === activeStep;
                            const isCompleted = index < activeStep;

                            return (
                              <Box
                                key={step.label}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  p: 2,
                                  borderRadius: 2,
                                  bgcolor: isActive ? `${step.color}10` : 'transparent',
                                  border: isActive ? `1px solid ${step.color}30` : '1px solid transparent',
                                  transition: 'all 0.3s ease',
                                }}
                              >
                                <Avatar
                                  sx={{
                                    bgcolor: isActive ? step.color : isCompleted ? 'success.main' : 'grey.300',
                                    width: 32,
                                    height: 32,
                                    mr: 2,
                                  }}
                                >
                                  {isCompleted ? (
                                    <CheckCircleIcon sx={{ fontSize: 18 }} />
                                  ) : (
                                    <StepIcon sx={{ fontSize: 18 }} />
                                  )}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: isActive ? 600 : 400,
                                      color: isActive ? step.color : isCompleted ? 'success.main' : 'text.primary'
                                    }}
                                  >
                                    {step.label}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mt: 0.5 }}
                                  >
                                    {step.description}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    </Paper>
                  </Slide>
                </Grid>

                {/* Modern Step Content */}
                <Grid item xs={12} lg={9}>
                  <Fade in timeout={1200}>
                    <Paper
                      elevation={0}
                      sx={{
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Step Header */}
                      <Box
                        sx={{
                          p: 4,
                          background: `linear-gradient(135deg, ${STEPS[activeStep].color}15, ${STEPS[activeStep].color}05)`,
                          borderBottom: `1px solid ${STEPS[activeStep].color}20`
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              bgcolor: STEPS[activeStep].color,
                              width: 56,
                              height: 56,
                              mr: 3,
                            }}
                          >
                            {React.createElement(STEPS[activeStep].icon, { sx: { fontSize: 28 } })}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="h4"
                              sx={{
                                fontWeight: 700,
                                color: STEPS[activeStep].color,
                                mb: 1
                              }}
                            >
                              {STEPS[activeStep].label}
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              {STEPS[activeStep].description}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Step Content */}
                      <Box sx={{ p: 4, minHeight: 500 }}>
                        {renderStepContent()}
                      </Box>

                      {/* Modern Navigation */}
                      <Box
                        sx={{
                          p: 4,
                          borderTop: 1,
                          borderColor: 'divider',
                          background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Button
                            onClick={handleBack}
                            disabled={activeStep === 0}
                            variant="outlined"
                            size="large"
                            sx={{
                              borderRadius: 3,
                              px: 4,
                              py: 1.5,
                              textTransform: 'none',
                              fontWeight: 600
                            }}
                          >
                            Back
                          </Button>

                          {activeStep === STEPS.length - 1 ? (
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  mb: 2,
                                  fontStyle: 'italic',
                                }}
                              >
                                🤖 AI analysis may take up to 5 minutes to complete
                              </Typography>

                              {/* Show validation errors if any */}
                              {Object.keys(errors).length > 0 && (
                                <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
                                  <Typography variant="body2" fontWeight={600} gutterBottom>
                                    Please fix the following errors:
                                  </Typography>
                                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    {errors.patientId && <li>{errors.patientId.message}</li>}
                                    {errors.symptoms?.subjective && <li>{errors.symptoms.subjective.message}</li>}
                                    {errors.medicalHistory && <li>{errors.medicalHistory.message}</li>}
                                    {errors.consent && <li>{errors.consent.message}</li>}
                                  </ul>
                                </Alert>
                              )}

                              <Button
                                type="submit"
                                variant="contained"
                                disabled={!watch('consent') || submitting || Object.keys(errors).length > 0}
                                size="large"
                                onClick={() => {



                                }}
                                sx={{
                                  borderRadius: 3,
                                  px: 4,
                                  py: 1.5,
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                                  '&:hover': {
                                    background: 'linear-gradient(45deg, #5a6fd8, #6a4190)',
                                  },
                                  '&:disabled': {
                                    background: 'grey.300',
                                    color: 'grey.600',
                                  }
                                }}
                                startIcon={submitting ? <ScienceIcon /> : <CheckCircleIcon />}
                              >
                                {submitting
                                  ? 'Analyzing with AI...'
                                  : 'Submit for AI Analysis'}
                              </Button>
                            </Box>
                          ) : (
                            <Button
                              variant="contained"
                              onClick={handleNext}
                              size="large"
                              sx={{
                                borderRadius: 3,
                                px: 4,
                                py: 1.5,
                                textTransform: 'none',
                                fontWeight: 600,
                                background: `linear-gradient(45deg, ${STEPS[activeStep].color}, ${STEPS[activeStep].color}cc)`,
                              }}
                            >
                              Next Step
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  </Fade>
                </Grid>
              </Grid>
            </form>
          </Container>
        </Box>
      </FormProvider>

      {/* Modern Create Patient Dialog */}
      <Dialog
        open={createPatientOpen}
        onClose={handleCloseCreatePatient}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 40,
                height: 40,
                mr: 2,
              }}
            >
              <AddIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Create New Patient
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add a new patient to the system
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={newPatientData.firstName}
                onChange={(e) =>
                  setNewPatientData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={newPatientData.lastName}
                onChange={(e) =>
                  setNewPatientData((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={newPatientData.phone}
                onChange={(e) =>
                  setNewPatientData((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={newPatientData.dateOfBirth}
                onChange={(e) =>
                  setNewPatientData((prev) => ({
                    ...prev,
                    dateOfBirth: e.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address (Optional)"
                type="email"
                value={newPatientData.email}
                onChange={(e) =>
                  setNewPatientData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleCloseCreatePatient}
            variant="outlined"
            sx={{
              borderRadius: 3,
              px: 3,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreatePatient}
            variant="contained"
            disabled={
              createLoading ||
              !newPatientData.firstName ||
              !newPatientData.lastName ||
              !newPatientData.phone ||
              !newPatientData.dateOfBirth
            }
            sx={{
              borderRadius: 3,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #1976d2, #1565c0)',
            }}
            startIcon={createLoading ? <RefreshIcon className="animate-spin" /> : <AddIcon />}
          >
            {createLoading ? 'Creating Patient...' : 'Create Patient'}
          </Button>
        </DialogActions>
      </Dialog>
    </ErrorBoundary>
  );
};

// Wrap with feature guard
const CaseIntakePageWithGuard: React.FC = () => (
  <DiagnosticFeatureGuard>
    <CaseIntakePage />
  </DiagnosticFeatureGuard>
);

export default CaseIntakePageWithGuard;
