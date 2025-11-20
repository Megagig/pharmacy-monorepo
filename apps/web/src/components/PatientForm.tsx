import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Autocomplete,
  IconButton,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ContactsIcon from '@mui/icons-material/Contacts';

import {
  useCreatePatient,
  useUpdatePatient,
  usePatient,
} from '../queries/usePatients';
import type {
  CreatePatientData,
  UpdatePatientData,
  Patient,
  NigerianState,
  BloodGroup,
  Genotype,
  Gender,
  MaritalStatus,
} from '../types/patientManagement';

// Nigerian States
import { getNigerianStates, getLGAsForState } from '../utils/nigeriaLocationData';

// Medical constants
const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];
const GENOTYPES: Genotype[] = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC'];
const GENDERS: Gender[] = ['male', 'female', 'other'];
const MARITAL_STATUSES: MaritalStatus[] = [
  'single',
  'married',
  'divorced',
  'widowed',
];

// Form validation schema
interface PatientFormData {
  // Demographics
  firstName: string;
  lastName: string;
  otherNames?: string;
  dob?: Date | null;
  age?: number | string;
  gender?: Gender | string;
  maritalStatus?: MaritalStatus | string;

  // Contact
  phone?: string;
  email?: string;
  address?: string;
  state?: NigerianState | string;
  lga?: string;

  // Medical
  bloodGroup?: BloodGroup | string;
  genotype?: Genotype | string;
  weightKg?: number | string;
}

const steps = [
  { label: 'Demographics', icon: <PersonIcon /> },
  { label: 'Contact Info', icon: <ContactsIcon /> },
  { label: 'Medical Info', icon: <LocalHospitalIcon /> },
];

const PatientForm = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(patientId);

  const [activeStep, setActiveStep] = useState(0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [availableLGAs, setAvailableLGAs] = useState<string[]>([]);

  // Get Nigerian states from the library
  const NIGERIAN_STATES = getNigerianStates();

  // React Query hooks
  const { data: patientResponse, isLoading: patientLoading } = usePatient(
    isEditMode ? patientId || '' : ''
  );
  const createPatientMutation = useCreatePatient();
  const updatePatientMutation = useUpdatePatient();

  const patient =
    'patient' in (patientResponse || {})
      ? (patientResponse as { patient: Patient }).patient
      : 'data' in (patientResponse || {})
        ? (patientResponse as { data: { patient: Patient } }).data?.patient
        : undefined;

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PatientFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      otherNames: '',
      dob: null,
      age: '',
      gender: '',
      maritalStatus: '',
      phone: '',
      email: '',
      address: '',
      state: '',
      lga: '',
      bloodGroup: '',
      genotype: '',
      weightKg: '',
    },
  });

  const watchedState = watch('state');
  const watchedDob = watch('dob');
  const watchedAge = watch('age');

  // Update available LGAs when state changes
  useEffect(() => {
    if (watchedState) {
      const lgas = getLGAsForState(watchedState as string);
      setAvailableLGAs(lgas);
      // Clear LGA if it's not in the new list
      const currentLga = watch('lga');
      if (currentLga && !lgas.includes(currentLga as string)) {
        setValue('lga', '');
      }
    } else {
      setAvailableLGAs([]);
      setValue('lga', '');
    }
  }, [watchedState, watch, setValue]);

  // Load patient data for editing
  useEffect(() => {
    if (isEditMode && patient) {
      reset({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        otherNames: patient.otherNames || '',
        dob: patient.dob ? new Date(patient.dob) : null,
        age: patient.age || '',
        gender: patient.gender || '',
        maritalStatus: patient.maritalStatus || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        state: patient.state || '',
        lga: patient.lga || '',
        bloodGroup: patient.bloodGroup || '',
        genotype: patient.genotype || '',
        weightKg: patient.weightKg || '',
      });
    }
  }, [patient, isEditMode, reset]);

  // Auto-calculate age when DOB changes
  useEffect(() => {
    if (watchedDob && (!watchedAge || watchedAge === '')) {
      const today = new Date();
      const birthDate = new Date(watchedDob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age >= 0 && age <= 150) {
        setValue('age', age);
      }
    }
  }, [watchedDob, watchedAge, setValue]);

  // Validation functions
  const validateNigerianPhone = (phone: string): boolean => {
    const phoneRegex = /^\+234[789]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle form submission
  const onSubmit = async (data: PatientFormData) => {
    try {
      setSubmissionError(null);

      // Validate required fields
      if (!data.firstName || !data.firstName.trim()) {
        setSubmissionError('First name is required');
        return;
      }
      if (!data.lastName || !data.lastName.trim()) {
        setSubmissionError('Last name is required');
        return;
      }

      // Validate phone if provided
      if (
        data.phone &&
        data.phone.trim() &&
        !validateNigerianPhone(data.phone)
      ) {
        setSubmissionError(
          'Please enter a valid Nigerian phone number (+234XXXXXXXXX)'
        );
        return;
      }

      // Validate email if provided
      if (data.email && data.email.trim() && !validateEmail(data.email)) {
        setSubmissionError('Please enter a valid email address');
        return;
      }

      // Prepare patient data - convert empty strings to undefined
      const patientData: CreatePatientData | UpdatePatientData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        otherNames:
          data.otherNames && data.otherNames.trim()
            ? data.otherNames.trim()
            : undefined,
        dob: data.dob?.toISOString(),
        age: typeof data.age === 'number' ? data.age : undefined,
        gender:
          data.gender && data.gender !== ''
            ? (data.gender as Gender)
            : undefined,
        maritalStatus:
          data.maritalStatus && data.maritalStatus !== ''
            ? (data.maritalStatus as MaritalStatus)
            : undefined,
        phone:
          data.phone && data.phone.trim() !== ''
            ? data.phone.trim()
            : undefined,
        email:
          data.email && data.email.trim() !== ''
            ? data.email.trim()
            : undefined,
        address:
          data.address && data.address.trim() !== ''
            ? data.address.trim()
            : undefined,
        state:
          data.state && data.state !== ''
            ? (data.state as NigerianState)
            : undefined,
        lga: data.lga && data.lga.trim() !== '' ? data.lga.trim() : undefined,
        bloodGroup:
          data.bloodGroup && data.bloodGroup !== ''
            ? (data.bloodGroup as BloodGroup)
            : undefined,
        genotype:
          data.genotype && data.genotype !== ''
            ? (data.genotype as Genotype)
            : undefined,
        weightKg: typeof data.weightKg === 'number' ? data.weightKg : undefined,
      };

      if (isEditMode && patientId) {
        await updatePatientMutation.mutateAsync({
          patientId,
          patientData: patientData as UpdatePatientData,
        });
        navigate(`/patients/${patientId}`);
      } else {
        const result = await createPatientMutation.mutateAsync(
          patientData as CreatePatientData
        );
        const newPatientId = result?.data?.patient?._id;
        navigate(newPatientId ? `/patients/${newPatientId}` : '/patients');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'Failed to save patient. Please try again.'
      );
    }
  };

  // Navigation handlers
  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const canProceedToNext = (): boolean => {
    switch (activeStep) {
      case 0: // Demographics
        const firstName = watch('firstName');
        const lastName = watch('lastName');
        return !!(firstName && firstName.trim() && lastName && lastName.trim());
      case 1: {
        // Contact
        const phone = watch('phone');
        const email = watch('email');
        return (
          !phone ||
          phone === '' ||
          (validateNigerianPhone(phone) &&
            (!email || email === '' || validateEmail(email)))
        );
      }
      case 2: // Medical
        return true;
      default:
        return true;
    }
  };

  if (isEditMode && patientLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading patient data...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/patients')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
              {isEditMode ? 'Edit Patient' : 'Add New Patient'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEditMode
                ? 'Update patient information and medical records'
                : 'Create a comprehensive patient profile with medical information'}
            </Typography>
          </Box>
        </Box>

        {/* Progress Stepper */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((step) => (
                <Step key={step.label}>
                  <StepLabel icon={step.icon}>{step.label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {submissionError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submissionError}
          </Alert>
        )}

        {/* Form */}
        <Card>
          <CardContent sx={{ p: 4 }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Only submit if we're on the last step
                if (activeStep === steps.length - 1) {
                  handleSubmit(onSubmit)(e);
                }
              }}
              onKeyDown={(e) => {
                // Prevent Enter key from submitting form unless on last step
                if (e.key === 'Enter' && activeStep !== steps.length - 1) {
                  e.preventDefault();
                  if (canProceedToNext()) {
                    handleNext();
                  }
                }
              }}
            >
              {/* Step 0: Demographics */}
              {activeStep === 0 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Patient Demographics
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="firstName"
                      control={control}
                      rules={{ required: 'First name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="First Name"
                          error={!!errors.firstName}
                          helperText={errors.firstName?.message}
                          required
                        />
                      )}
                    />

                    <Controller
                      name="lastName"
                      control={control}
                      rules={{ required: 'Last name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Last Name"
                          error={!!errors.lastName}
                          helperText={errors.lastName?.message}
                          required
                        />
                      )}
                    />
                  </Box>

                  <Controller
                    name="otherNames"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Other Names"
                        helperText="Middle names or other names (optional)"
                      />
                    )}
                  />

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="dob"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          label="Date of Birth"
                          value={field.value}
                          onChange={(newValue) => field.onChange(newValue)}
                          maxDate={new Date()}
                          slotProps={{
                            textField: {
                              error: !!errors.dob,
                              helperText: errors.dob?.message,
                            },
                          }}
                        />
                      )}
                    />

                    <Controller
                      name="age"
                      control={control}
                      rules={{
                        min: { value: 0, message: 'Age must be positive' },
                        max: { value: 150, message: 'Age must be realistic' },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label="Age (years)"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? Number(value) : '');
                          }}
                          error={!!errors.age}
                          helperText={
                            errors.age?.message || 'Auto-calculated from DOB'
                          }
                        />
                      )}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <FormControl error={!!errors.gender}>
                          <InputLabel>Gender</InputLabel>
                          <Select
                            {...field}
                            label="Gender"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || '')
                            }
                          >
                            <MenuItem value="">
                              <em>Select Gender</em>
                            </MenuItem>
                            {GENDERS.map((gender) => (
                              <MenuItem key={gender} value={gender}>
                                {gender.charAt(0).toUpperCase() +
                                  gender.slice(1)}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.gender && (
                            <FormHelperText>
                              {errors.gender.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="maritalStatus"
                      control={control}
                      render={({ field }) => (
                        <FormControl error={!!errors.maritalStatus}>
                          <InputLabel>Marital Status</InputLabel>
                          <Select
                            {...field}
                            label="Marital Status"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || '')
                            }
                          >
                            <MenuItem value="">
                              <em>Select Marital Status</em>
                            </MenuItem>
                            {MARITAL_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() +
                                  status.slice(1)}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.maritalStatus && (
                            <FormHelperText>
                              {errors.maritalStatus.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>
                </Stack>
              )}

              {/* Step 1: Contact Information */}
              {activeStep === 1 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Contact Information
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="phone"
                      control={control}
                      rules={{
                        validate: (value) =>
                          !value ||
                          validateNigerianPhone(value) ||
                          'Enter valid Nigerian phone (+234XXXXXXXXX)',
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Phone Number"
                          placeholder="+234812345678"
                          error={!!errors.phone}
                          helperText={
                            errors.phone?.message ||
                            'Nigerian format: +234XXXXXXXXX'
                          }
                        />
                      )}
                    />

                    <Controller
                      name="email"
                      control={control}
                      rules={{
                        validate: (value) =>
                          !value ||
                          validateEmail(value) ||
                          'Enter a valid email address',
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="email"
                          label="Email Address"
                          error={!!errors.email}
                          helperText={errors.email?.message}
                        />
                      )}
                    />
                  </Box>

                  <Controller
                    name="address"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Address"
                        multiline
                        rows={2}
                        helperText="Street address or residential area"
                      />
                    )}
                  />

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="state"
                      control={control}
                      render={({ field }) => (
                        <Autocomplete
                          options={NIGERIAN_STATES}
                          value={field.value || null}
                          onChange={(_, value) => field.onChange(value || '')}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="State"
                              error={!!errors.state}
                              helperText={errors.state?.message}
                            />
                          )}
                        />
                      )}
                    />

                    <Controller
                      name="lga"
                      control={control}
                      render={({ field }) => (
                        <Autocomplete
                          options={availableLGAs}
                          value={field.value || null}
                          onChange={(_, value) => field.onChange(value || '')}
                          disabled={!watchedState || availableLGAs.length === 0}
                          freeSolo
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Local Government Area"
                              helperText={
                                !watchedState
                                  ? 'Select a state first'
                                  : availableLGAs.length === 0
                                    ? 'No LGAs available'
                                    : 'Select or type LGA name'
                              }
                              error={!!errors.lga}
                            />
                          )}
                        />
                      )}
                    />
                  </Box>
                </Stack>
              )}

              {/* Step 2: Medical Information */}
              {activeStep === 2 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Medical Information
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 2,
                    }}
                  >
                    <Controller
                      name="bloodGroup"
                      control={control}
                      render={({ field }) => (
                        <FormControl error={!!errors.bloodGroup}>
                          <InputLabel>Blood Group</InputLabel>
                          <Select
                            {...field}
                            label="Blood Group"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || '')
                            }
                          >
                            <MenuItem value="">
                              <em>Select Blood Group</em>
                            </MenuItem>
                            {BLOOD_GROUPS.map((group) => (
                              <MenuItem key={group} value={group}>
                                {group}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.bloodGroup && (
                            <FormHelperText>
                              {errors.bloodGroup.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="genotype"
                      control={control}
                      render={({ field }) => (
                        <FormControl error={!!errors.genotype}>
                          <InputLabel>Genotype</InputLabel>
                          <Select
                            {...field}
                            label="Genotype"
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || '')
                            }
                          >
                            <MenuItem value="">
                              <em>Select Genotype</em>
                            </MenuItem>
                            {GENOTYPES.map((genotype) => (
                              <MenuItem key={genotype} value={genotype}>
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center' }}
                                >
                                  {genotype}
                                  {genotype.includes('S') && (
                                    <Chip
                                      label="Sickle Cell"
                                      size="small"
                                      color="warning"
                                      sx={{ ml: 1, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.genotype && (
                            <FormHelperText>
                              {errors.genotype.message}
                            </FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="weightKg"
                      control={control}
                      rules={{
                        min: { value: 0.5, message: 'Weight must be positive' },
                        max: {
                          value: 500,
                          message: 'Weight must be realistic',
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          type="number"
                          label="Weight (kg)"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? Number(value) : '');
                          }}
                          error={!!errors.weightKg}
                          helperText={errors.weightKg?.message}
                          inputProps={{ step: 0.1, min: 0.5, max: 500 }}
                        />
                      )}
                    />
                  </Box>

                  {/* Medical Information Note */}
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Medical Information:</strong> Blood group and
                      genotype are important for emergency situations and
                      medication compatibility. Weight is used for dosage
                      calculations.
                      {watch('genotype') &&
                        typeof watch('genotype') === 'string' &&
                        watch('genotype').includes('S') && (
                          <Box
                            sx={{
                              mt: 1,
                              fontWeight: 600,
                              color: 'warning.main',
                            }}
                          >
                            ⚠️ Sickle cell genotype detected - requires special
                            medical attention
                          </Box>
                        )}
                    </Typography>
                  </Alert>
                </Stack>
              )}

              {/* Form Actions */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mt: 4,
                  pt: 3,
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Box>
                  {activeStep > 0 && (
                    <Button onClick={handleBack} sx={{ mr: 2 }}>
                      Back
                    </Button>
                  )}
                </Box>

                <Box>
                  {activeStep < steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={!canProceedToNext()}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={isSubmitting}
                      sx={{ minWidth: 120 }}
                      onClick={handleSubmit(onSubmit)}
                    >
                      {isSubmitting
                        ? 'Saving...'
                        : isEditMode
                          ? 'Update Patient'
                          : 'Create Patient'}
                    </Button>
                  )}
                </Box>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default PatientForm;
