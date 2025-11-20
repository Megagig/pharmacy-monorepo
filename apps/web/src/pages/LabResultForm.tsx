import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Science as ScienceIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { usePatientStore } from '../stores';

/**
 * Lab Result Form Page
 * Used for both creating and editing lab results
 * Routes: /laboratory/add, /laboratory/:id/edit
 */

// Validation schema
const labResultSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  testName: z.string().min(1, 'Test name is required'),
  testCode: z.string().optional(),
  loincCode: z.string().optional(),
  testCategory: z.enum(['Hematology', 'Chemistry', 'Microbiology', 'Immunology', 'Pathology', 'Radiology', 'Other']),
  specimenType: z.enum(['Blood', 'Urine', 'Stool', 'Saliva', 'Tissue', 'Swab', 'Other']),
  testValue: z.string().min(1, 'Test value is required'),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  interpretation: z.enum(['Normal', 'Low', 'High', 'Critical', 'Abnormal', 'Pending']),
  isCritical: z.boolean(),
  isAbnormal: z.boolean(),
  status: z.enum(['Pending', 'Completed', 'Reviewed', 'Signed Off', 'Cancelled']),
  testDate: z.string().min(1, 'Test date is required'),
  resultDate: z.string().optional(),
  laboratoryName: z.string().optional(),
  accessionNumber: z.string().optional(),
  orderingPhysician: z.string().optional(),
  performingTechnician: z.string().optional(),
  notes: z.string().optional(),
  clinicalIndication: z.string().optional(),
});

type LabResultFormData = z.infer<typeof labResultSchema>;

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  patientId: string;
  dateOfBirth: string;
}

const LabResultForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId');
  const selectedPatientFromQuery = searchParams.get('selectedPatient');
  const isEditMode = Boolean(id);
  const [autoInterpret, setAutoInterpret] = useState(true);
  const queryClient = useQueryClient();

  // Patient store
  const patients = usePatientStore((state) => state.patients);
  const loading = usePatientStore((state) => state.loading.fetchPatients || false);
  const fetchPatients = usePatientStore((state) => state.fetchPatients);

  // Fetch patients on mount
  useEffect(() => {
    const loadPatients = async () => {
      try {
        await fetchPatients();
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        toast.error('Failed to load patients');
      }
    };
    loadPatients();
  }, [fetchPatients]);

  // Fetch existing lab result if editing
  const { data: labResult, isLoading: loadingLabResult } = useQuery({
    queryKey: ['lab-result', id],
    queryFn: async () => {
      const response = await api.get(`/laboratory/results/${id}`);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LabResultFormData>({
    resolver: zodResolver(labResultSchema),
    defaultValues: {
      patientId: '',
      testName: '',
      testCode: '',
      loincCode: '',
      testCategory: 'Chemistry',
      specimenType: 'Blood',
      testValue: '',
      unit: '',
      referenceRange: '',
      interpretation: 'Pending',
      isCritical: false,
      isAbnormal: false,
      status: 'Pending',
      testDate: new Date().toISOString().split('T')[0],
      resultDate: '',
      laboratoryName: '',
      accessionNumber: '',
      orderingPhysician: '',
      performingTechnician: '',
      notes: '',
      clinicalIndication: '',
    },
  });

  // Watch values for auto-interpretation
  const testValue = watch('testValue');
  const referenceRangeLow = watch('referenceRangeLow');
  const referenceRangeHigh = watch('referenceRangeHigh');

  // Auto-interpret based on reference ranges
  useEffect(() => {
    if (!autoInterpret) return;

    const numericValue = parseFloat(testValue);
    if (isNaN(numericValue)) return;

    if (referenceRangeLow !== undefined && referenceRangeHigh !== undefined) {
      if (numericValue < referenceRangeLow) {
        setValue('interpretation', 'Low');
        setValue('isAbnormal', true);
        setValue('isCritical', numericValue < referenceRangeLow * 0.5);
      } else if (numericValue > referenceRangeHigh) {
        setValue('interpretation', 'High');
        setValue('isAbnormal', true);
        setValue('isCritical', numericValue > referenceRangeHigh * 1.5);
      } else {
        setValue('interpretation', 'Normal');
        setValue('isAbnormal', false);
        setValue('isCritical', false);
      }
    }
  }, [testValue, referenceRangeLow, referenceRangeHigh, autoInterpret, setValue]);

  // Pre-fill patient ID from query params (supports both patientId and selectedPatient)
  useEffect(() => {
    const patientId = patientIdFromQuery || selectedPatientFromQuery;
    if (patientId && !isEditMode && patients.length > 0) {
      const patientExists = patients.some((p) => p._id === patientId);
      if (patientExists) {
        setValue('patientId', patientId);
      }
    }
  }, [patientIdFromQuery, selectedPatientFromQuery, isEditMode, setValue, patients]);

  // Populate form when editing
  useEffect(() => {
    if (labResult && isEditMode) {
      reset({
        patientId: labResult.patientId._id || labResult.patientId,
        testName: labResult.testName,
        testCode: labResult.testCode || '',
        loincCode: labResult.loincCode || '',
        testCategory: labResult.testCategory,
        specimenType: labResult.specimenType,
        testValue: labResult.testValue,
        unit: labResult.unit || '',
        referenceRange: labResult.referenceRange || '',
        referenceRangeLow: labResult.referenceRangeLow,
        referenceRangeHigh: labResult.referenceRangeHigh,
        interpretation: labResult.interpretation,
        isCritical: labResult.isCritical,
        isAbnormal: labResult.isAbnormal,
        status: labResult.status,
        testDate: labResult.testDate?.split('T')[0] || '',
        resultDate: labResult.resultDate?.split('T')[0] || '',
        laboratoryName: labResult.laboratoryName || '',
        accessionNumber: labResult.accessionNumber || '',
        orderingPhysician: labResult.orderingPhysician || '',
        performingTechnician: labResult.performingTechnician || '',
        notes: labResult.notes || '',
        clinicalIndication: labResult.clinicalIndication || '',
      });
    }
  }, [labResult, isEditMode, reset]);

  // Handler functions for patient selection buttons
  const handleRefreshPatients = async () => {
    try {
      await fetchPatients();
      toast.success('Patients refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh patients');
    }
  };

  const handleBrowsePatients = () => {
    const returnPath = isEditMode ? `/laboratory/${id}/edit` : '/laboratory/add';
    navigate(`/patients?mode=select&returnTo=${encodeURIComponent(returnPath)}`);
  };

  const handleNewPatient = () => {
    navigate('/patients/new');
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: LabResultFormData) => {
      const response = await api.post('/laboratory/results', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Lab result created successfully');
      navigate('/laboratory');
    },
    onError: (error: any) => {
      console.error('Create lab result error:', error);

      // Handle validation errors
      if (error.response?.data?.error?.type === 'ValidationError') {
        const validationMessage = error.response.data.error.message;
        toast.error(`Validation Error: ${validationMessage}`, { duration: 6000 });
      }
      // Handle feature access errors
      else if (error.response?.status === 402) {
        const message = error.response?.data?.message || 'Required plan features not available';
        const requiredFeatures = error.response?.data?.requiredFeatures;
        if (requiredFeatures && requiredFeatures.length > 0) {
          toast.error(`${message}. Required features: ${requiredFeatures.join(', ')}`, { duration: 6000 });
        } else {
          toast.error(message, { duration: 6000 });
        }
      }
      // Handle other errors
      else {
        const message = error.response?.data?.message || error.message || 'Failed to create lab result';
        toast.error(message, { duration: 5000 });
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: LabResultFormData) => {
      const response = await api.put(`/laboratory/results/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Lab result updated successfully');
      navigate('/laboratory');
    },
    onError: (error: any) => {
      console.error('Update lab result error:', error);

      // Handle validation errors
      if (error.response?.data?.error?.type === 'ValidationError') {
        const validationMessage = error.response.data.error.message;
        toast.error(`Validation Error: ${validationMessage}`, { duration: 6000 });
      }
      // Handle feature access errors
      else if (error.response?.status === 402) {
        const message = error.response?.data?.message || 'Required plan features not available';
        const requiredFeatures = error.response?.data?.requiredFeatures;
        if (requiredFeatures && requiredFeatures.length > 0) {
          toast.error(`${message}. Required features: ${requiredFeatures.join(', ')}`, { duration: 6000 });
        } else {
          toast.error(message, { duration: 6000 });
        }
      }
      // Handle other errors
      else {
        const message = error.response?.data?.message || error.message || 'Failed to update lab result';
        toast.error(message, { duration: 5000 });
      }
    },
  });

  // Submit handler
  const onSubmit = (data: LabResultFormData) => {
    // Convert numeric values
    const numericValue = parseFloat(data.testValue);
    const payload = {
      ...data,
      numericValue: isNaN(numericValue) ? undefined : numericValue,
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEditMode && loadingLabResult) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ScienceIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {isEditMode ? 'Edit Lab Result' : 'Add Lab Result'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEditMode ? 'Update laboratory test result' : 'Enter new laboratory test result'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Paper sx={{ p: 4 }}>
          {/* Auto-interpretation toggle */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoInterpret}
                  onChange={(e) => setAutoInterpret(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon fontSize="small" />
                  <Typography variant="body2">Auto-interpret results</Typography>
                </Box>
              }
            />
          </Box>

          {autoInterpret && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Auto-interpretation is enabled. Results will be automatically interpreted based on reference ranges.
            </Alert>
          )}

          {/* Patient Selection - Lab Integration Case Style */}
          <Box sx={{ mb: 4 }}>
            {/* Action Buttons */}
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshPatients}
                disabled={loading}
                sx={{
                  borderRadius: 3,
                  textTransform: 'none',
                  fontWeight: 600,
                  flex: 1
                }}
              >
                Refresh Patients
              </Button>
              <Button
                variant="outlined"
                startIcon={<SearchIcon />}
                onClick={handleBrowsePatients}
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
                onClick={handleNewPatient}
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

            {/* Selected Patient Display */}
            <Controller
              name="patientId"
              control={control}
              render={({ field }) => {
                const selectedPatient = patients.find((p) => p._id === field.value);

                return (
                  <>
                    {selectedPatient && (
                      <Paper
                        elevation={0}
                        sx={{
                          mb: 3,
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
                              {`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {`MRN: ${selectedPatient.patientId} • ${selectedPatient.dateOfBirth ? new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear() : 'N/A'}y`}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                    {/* Patient Selection Dropdown */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: !field.value ? 'error.main' : 'divider',
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
                            Select the patient for this lab result
                          </Typography>
                        </Box>
                      </Box>

                      <FormControl fullWidth error={!!errors.patientId}>
                        <InputLabel>Select Patient</InputLabel>
                        <Select
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
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
                            patients.map((patient) => (
                              <MenuItem key={patient._id} value={patient._id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                  <Avatar
                                    sx={{
                                      bgcolor: field.value === patient._id ? 'success.main' : 'grey.300',
                                      width: 32,
                                      height: 32,
                                      mr: 2,
                                    }}
                                  >
                                    <PersonIcon fontSize="small" />
                                  </Avatar>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                      {`${patient.firstName} ${patient.lastName}`}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      MRN: {patient.patientId}
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            ))
                          )}
                        </Select>
                        {errors.patientId && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                            {errors.patientId.message}
                          </Typography>
                        )}
                      </FormControl>
                    </Paper>
                  </>
                );
              }}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Test Information */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Test Information
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Controller
                name="testName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Test Name *"
                    error={!!errors.testName}
                    helperText={errors.testName?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="testCode"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Test Code" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="loincCode"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="LOINC Code" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="testCategory"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth select label="Test Category *">
                    <MenuItem value="Hematology">Hematology</MenuItem>
                    <MenuItem value="Chemistry">Chemistry</MenuItem>
                    <MenuItem value="Microbiology">Microbiology</MenuItem>
                    <MenuItem value="Immunology">Immunology</MenuItem>
                    <MenuItem value="Pathology">Pathology</MenuItem>
                    <MenuItem value="Radiology">Radiology</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="specimenType"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth select label="Specimen Type *">
                    <MenuItem value="Blood">Blood</MenuItem>
                    <MenuItem value="Urine">Urine</MenuItem>
                    <MenuItem value="Stool">Stool</MenuItem>
                    <MenuItem value="Saliva">Saliva</MenuItem>
                    <MenuItem value="Tissue">Tissue</MenuItem>
                    <MenuItem value="Swab">Swab</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Test Results */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Test Results
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Controller
                name="testValue"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Test Value *"
                    error={!!errors.testValue}
                    helperText={errors.testValue?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Unit" placeholder="mg/dL" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="referenceRange"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Reference Range"
                    placeholder="70-100 mg/dL"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="referenceRangeLow"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Reference Low"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="referenceRangeHigh"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Reference High"
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="interpretation"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth select label="Interpretation *">
                    <MenuItem value="Normal">Normal</MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Critical">Critical</MenuItem>
                    <MenuItem value="Abnormal">Abnormal</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth select label="Status *">
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Reviewed">Reviewed</MenuItem>
                    <MenuItem value="Signed Off">Signed Off</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="isCritical"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} color="error" />}
                      label="Critical"
                    />
                  )}
                />
                <Controller
                  name="isAbnormal"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} color="warning" />}
                      label="Abnormal"
                    />
                  )}
                />
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Dates and Laboratory Info */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Dates & Laboratory Information
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Controller
                name="testDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="date"
                    label="Test Date *"
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.testDate}
                    helperText={errors.testDate?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="resultDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="date"
                    label="Result Date"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="laboratoryName"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Laboratory Name" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="accessionNumber"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Accession Number" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="orderingPhysician"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Ordering Physician" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="performingTechnician"
                control={control}
                render={({ field }) => (
                  <TextField {...field} fullWidth label="Performing Technician" />
                )}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Additional Information */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Additional Information
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Controller
                name="clinicalIndication"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Clinical Indication"
                    placeholder="Reason for test..."
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes"
                    placeholder="Additional notes or observations..."
                  />
                )}
              />
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={() => navigate('/laboratory')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Lab Result' : 'Create Lab Result'}
            </Button>
          </Box>
        </Paper>
      </form>
    </Container>
  );
};

export default LabResultForm;

