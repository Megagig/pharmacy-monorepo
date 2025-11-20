import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  GetApp as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useDebounce } from '../hooks/useDebounce';
import { useSearchPatients } from '../queries/usePatients';
import {
  CreateLabOrderData,
  TestDefinition,
  TestCatalogItem,
  LAB_ORDER_PRIORITIES,
  SPECIMEN_TYPES,
  TEST_CATEGORIES,
  LabOrderPriority,
} from '../types/manualLabOrder';
import { Patient } from '../types/patientManagement';

// Mock test catalog data - in real implementation, this would come from API
const MOCK_TEST_CATALOG: TestCatalogItem[] = [
  {
    _id: '1',
    name: 'Complete Blood Count',
    code: 'CBC',
    loincCode: '58410-2',
    specimenType: 'Blood',
    unit: 'cells/μL',
    refRange: '4.5-11.0 x10³',
    category: 'Hematology',
    description: 'Full blood count with differential',
    isActive: true,
  },
  {
    _id: '2',
    name: 'Basic Metabolic Panel',
    code: 'BMP',
    loincCode: '51990-0',
    specimenType: 'Blood',
    unit: 'mmol/L',
    refRange: 'Various',
    category: 'Chemistry',
    description: 'Glucose, electrolytes, kidney function',
    isActive: true,
  },
  {
    _id: '3',
    name: 'Lipid Panel',
    code: 'LIPID',
    loincCode: '57698-3',
    specimenType: 'Blood',
    unit: 'mg/dL',
    refRange: 'Various',
    category: 'Chemistry',
    description: 'Cholesterol, triglycerides, HDL, LDL',
    isActive: true,
  },
  {
    _id: '4',
    name: 'Urinalysis',
    code: 'UA',
    loincCode: '24357-6',
    specimenType: 'Urine',
    unit: 'Various',
    refRange: 'Various',
    category: 'Chemistry',
    description: 'Complete urine analysis',
    isActive: true,
  },
  {
    _id: '5',
    name: 'Thyroid Function Tests',
    code: 'TFT',
    loincCode: '24348-5',
    specimenType: 'Blood',
    unit: 'mIU/L',
    refRange: '0.4-4.0',
    category: 'Chemistry',
    description: 'TSH, T3, T4',
    isActive: true,
  },
];

interface LabOrderFormData {
  patient: string;
  tests: TestDefinition[];
  indication: string;
  priority: LabOrderPriority;
  notes: string;
  consentObtained: boolean;
}

interface LabOrderBuilderProps {
  patientId?: string;
  onOrderCreated?: (order: any) => void;
  onCancel?: () => void;
}

const steps = ['Patient & Tests', 'Order Details', 'Review & Submit'];

const LabOrderBuilder: React.FC<LabOrderBuilderProps> = ({
  patientId,
  onOrderCreated,
  onCancel,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  // Debounced search queries
  const debouncedTestSearch = useDebounce(testSearchQuery, 300);
  const debouncedPatientSearch = useDebounce(patientSearchQuery, 300);

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset,
  } = useForm<LabOrderFormData>({
    defaultValues: {
      patient: patientId || '',
      tests: [],
      indication: '',
      priority: 'routine',
      notes: '',
      consentObtained: false,
    },
    mode: 'onChange',
  });

  // Field arrays
  const {
    fields: testFields,
    append: appendTest,
    remove: removeTest,
  } = useFieldArray({
    control,
    name: 'tests',
  });

  // Watch form values
  const watchedPatient = watch('patient');
  const watchedTests = watch('tests');
  const watchedConsent = watch('consentObtained');

  // Patient search query
  const { data: patientSearchResults, isLoading: patientsLoading } =
    useSearchPatients(debouncedPatientSearch);

  // Filter test catalog based on search and category
  const filteredTests = useMemo(() => {
    let filtered = MOCK_TEST_CATALOG.filter((test) => test.isActive);

    if (debouncedTestSearch) {
      const query = debouncedTestSearch.toLowerCase();
      filtered = filtered.filter(
        (test) =>
          test.name.toLowerCase().includes(query) ||
          test.code.toLowerCase().includes(query) ||
          test.category.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((test) => test.category === selectedCategory);
    }

    return filtered;
  }, [debouncedTestSearch, selectedCategory]);

  // Get patients for autocomplete
  const patients = useMemo(() => {
    return patientSearchResults?.data?.results || [];
  }, [patientSearchResults]);

  // Validation functions
  const canProceedToNext = (): boolean => {
    switch (activeStep) {
      case 0: // Patient & Tests
        return !!(watchedPatient && watchedTests.length > 0);
      case 1: // Order Details
        return !!watch('indication').trim();
      case 2: // Review & Submit
        return watchedConsent;
      default:
        return true;
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (activeStep === 1 && !watchedConsent) {
      setShowConsentDialog(true);
      return;
    }
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // Test management
  const handleAddTest = (test: TestCatalogItem) => {
    const testDefinition: TestDefinition = {
      name: test.name,
      code: test.code,
      loincCode: test.loincCode,
      specimenType: test.specimenType,
      unit: test.unit,
      refRange: test.refRange,
      category: test.category,
    };

    // Check if test already added
    const existingTest = watchedTests.find((t) => t.code === test.code);
    if (!existingTest) {
      appendTest(testDefinition);
    }
  };

  const handleRemoveTest = (index: number) => {
    removeTest(index);
  };

  // Form submission
  const onSubmit = async (data: LabOrderFormData) => {
    if (!data.consentObtained) {
      setShowConsentDialog(true);
      return;
    }

    setIsSubmitting(true);
    setPdfGenerating(true);

    try {
      const orderData: CreateLabOrderData = {
        patientId: data.patient,
        tests: data.tests,
        indication: data.indication,
        priority: data.priority,
        notes: data.notes || undefined,
        consentObtained: data.consentObtained,
      };

      // Mock API call - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock response
      const mockOrder = {
        _id: 'order_123',
        orderId: 'LAB-2024-0001',
        ...orderData,
        status: 'requested',
        createdAt: new Date().toISOString(),
      };

      const mockPdfUrl = '/api/manual-lab-orders/LAB-2024-0001/pdf';
      setPdfUrl(mockPdfUrl);
      setPdfGenerating(false);

      if (onOrderCreated) {
        onOrderCreated(mockOrder);
      } else {
        // Default navigation
        navigate('/lab-orders');
      }
    } catch (error) {
      console.error('Failed to create lab order:', error);
      setPdfGenerating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle consent confirmation
  const handleConsentConfirm = () => {
    setValue('consentObtained', true);
    setShowConsentDialog(false);
    if (activeStep === 1) {
      handleNext();
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Create Lab Order
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a manual lab requisition with printable PDF
          </Typography>
        </Box>

        {/* Progress Stepper */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stepper
              activeStep={activeStep}
              alternativeLabel={!isMobile}
              orientation={isMobile ? 'vertical' : 'horizontal'}
            >
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel
                    error={index === 0 && activeStep > 0 && !canProceedToNext()}
                  >
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 0: Patient & Tests */}
          {activeStep === 0 && (
            <Grid container spacing={3}>
              {/* Patient Selection */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Patient Selection
                    </Typography>
                    <Controller
                      name="patient"
                      control={control}
                      rules={{ required: 'Patient is required' }}
                      render={({ field }) => (
                        <Autocomplete
                          {...field}
                          options={patients}
                          getOptionLabel={(option: Patient) =>
                            `${option.firstName} ${option.lastName} (${option.mrn})`
                          }
                          value={
                            patients.find((p) => p._id === field.value) || null
                          }
                          onChange={(_, value) => {
                            field.onChange(value?._id || '');
                            if (value) {
                              setPatientSearchQuery('');
                            }
                          }}
                          onInputChange={(_, value, reason) => {
                            if (reason === 'input') {
                              setPatientSearchQuery(value);
                            }
                          }}
                          loading={patientsLoading}
                          disabled={!!patientId}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Search Patient *"
                              error={!!errors.patient}
                              helperText={
                                errors.patient?.message ||
                                'Search by name or MRN'
                              }
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
                  </CardContent>
                </Card>
              </Grid>

              {/* Test Selection */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Test Selection
                    </Typography>

                    {/* Test Search and Filters */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Search Tests"
                          value={testSearchQuery}
                          onChange={(e) => setTestSearchQuery(e.target.value)}
                          InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                          }}
                          placeholder="Search by test name or code"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={selectedCategory}
                            onChange={(e) =>
                              setSelectedCategory(e.target.value)
                            }
                            label="Category"
                          >
                            <MenuItem value="">All Categories</MenuItem>
                            {TEST_CATEGORIES.map((category) => (
                              <MenuItem key={category} value={category}>
                                {category}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    {/* Available Tests */}
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Available Tests ({filteredTests.length})
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{ maxHeight: 300, overflow: 'auto', mb: 3 }}
                    >
                      <List>
                        {filteredTests.map((test, index) => (
                          <React.Fragment key={test._id}>
                            <ListItem>
                              <ListItemText
                                primary={
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <Typography variant="subtitle2">
                                      {test.name}
                                    </Typography>
                                    <Chip
                                      label={test.code}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={test.category}
                                      size="small"
                                      color="primary"
                                    />
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="body2">
                                      {test.description}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Specimen: {test.specimenType} | Range:{' '}
                                      {test.refRange}
                                    </Typography>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleAddTest(test)}
                                  disabled={watchedTests.some(
                                    (t) => t.code === test.code
                                  )}
                                >
                                  {watchedTests.some(
                                    (t) => t.code === test.code
                                  )
                                    ? 'Added'
                                    : 'Add'}
                                </Button>
                              </ListItemSecondaryAction>
                            </ListItem>
                            {index < filteredTests.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    </Paper>

                    {/* Selected Tests */}
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Selected Tests ({watchedTests.length})
                    </Typography>
                    {watchedTests.length === 0 ? (
                      <Alert severity="info">
                        No tests selected. Please add tests from the catalog
                        above.
                      </Alert>
                    ) : (
                      <Paper variant="outlined">
                        <List>
                          {testFields.map((test, index) => (
                            <React.Fragment key={test.id}>
                              <ListItem>
                                <ListItemText
                                  primary={
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Typography variant="subtitle2">
                                        {test.name}
                                      </Typography>
                                      <Chip
                                        label={test.code}
                                        size="small"
                                        variant="outlined"
                                      />
                                    </Box>
                                  }
                                  secondary={`${test.specimenType} | ${test.refRange}`}
                                />
                                <ListItemSecondaryAction>
                                  <IconButton
                                    edge="end"
                                    onClick={() => handleRemoveTest(index)}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </ListItemSecondaryAction>
                              </ListItem>
                              {index < testFields.length - 1 && <Divider />}
                            </React.Fragment>
                          ))}
                        </List>
                      </Paper>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Step 1: Order Details */}
          {activeStep === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      Order Details
                    </Typography>

                    <Grid container spacing={3}>
                      {/* Clinical Indication */}
                      <Grid item xs={12}>
                        <Controller
                          name="indication"
                          control={control}
                          rules={{
                            required: 'Clinical indication is required',
                            minLength: {
                              value: 10,
                              message:
                                'Please provide a detailed clinical indication',
                            },
                          }}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Clinical Indication *"
                              multiline
                              rows={4}
                              fullWidth
                              error={!!errors.indication}
                              helperText={
                                errors.indication?.message ||
                                'Provide the clinical reason for ordering these tests'
                              }
                              placeholder="e.g., Routine health screening, Follow-up for diabetes management, Investigation of chest pain..."
                            />
                          )}
                        />
                      </Grid>

                      {/* Priority */}
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="priority"
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel>Priority</InputLabel>
                              <Select {...field} label="Priority">
                                {LAB_ORDER_PRIORITIES.map((priority) => (
                                  <MenuItem
                                    key={priority.value}
                                    value={priority.value}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          bgcolor: priority.color,
                                        }}
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

                      {/* Additional Notes */}
                      <Grid item xs={12}>
                        <Controller
                          name="notes"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Additional Notes"
                              multiline
                              rows={3}
                              fullWidth
                              helperText="Any additional instructions or notes for the laboratory"
                              placeholder="Special handling instructions, patient preparation notes, etc."
                            />
                          )}
                        />
                      </Grid>

                      {/* Consent Checkbox */}
                      <Grid item xs={12}>
                        <Controller
                          name="consentObtained"
                          control={control}
                          render={({ field }) => (
                            <FormControlLabel
                              control={
                                <Checkbox
                                  {...field}
                                  checked={field.value}
                                  color="primary"
                                />
                              }
                              label={
                                <Typography variant="body2">
                                  I confirm that patient consent has been
                                  obtained for these laboratory tests
                                </Typography>
                              }
                            />
                          )}
                        />
                        {!watchedConsent && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <WarningIcon sx={{ mr: 1 }} />
                              Patient consent is required before proceeding
                            </Box>
                          </Alert>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Step 2: Review & Submit */}
          {activeStep === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      Review Order
                    </Typography>

                    {/* Order Summary */}
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                          Patient Information
                        </Typography>
                        {watchedPatient && (
                          <Box sx={{ mb: 3 }}>
                            {(() => {
                              const patient = patients.find(
                                (p) => p._id === watchedPatient
                              );
                              return patient ? (
                                <Box>
                                  <Typography variant="body1">
                                    {patient.firstName} {patient.lastName}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    MRN: {patient.mrn}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    Age: {patient.age || 'Not specified'}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography color="error">
                                  Patient not found
                                </Typography>
                              );
                            })()}
                          </Box>
                        )}

                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                          Order Details
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            <strong>Priority:</strong>{' '}
                            {
                              LAB_ORDER_PRIORITIES.find(
                                (p) => p.value === watch('priority')
                              )?.label
                            }
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Clinical Indication:</strong>
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {watch('indication')}
                          </Typography>
                          {watch('notes') && (
                            <>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Additional Notes:</strong>
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.5 }}
                              >
                                {watch('notes')}
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>
                          Selected Tests ({watchedTests.length})
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          {watchedTests.map((test, index) => (
                            <Box
                              key={index}
                              sx={{
                                mb: index < watchedTests.length - 1 ? 2 : 0,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {test.name} ({test.code})
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {test.specimenType} | {test.refRange}
                              </Typography>
                            </Box>
                          ))}
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Consent Confirmation */}
                    <Box
                      sx={{
                        mt: 3,
                        p: 2,
                        bgcolor: 'success.light',
                        borderRadius: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                        <Typography variant="body2">
                          Patient consent has been obtained and confirmed
                        </Typography>
                      </Box>
                    </Box>

                    {/* PDF Generation Status */}
                    {pdfGenerating && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Generating PDF requisition...
                        </Typography>
                        <LinearProgress />
                      </Box>
                    )}

                    {pdfUrl && (
                      <Box sx={{ mt: 3 }}>
                        <Alert severity="success">
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography variant="body2">
                              PDF requisition generated successfully
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<DownloadIcon />}
                              onClick={() => window.open(pdfUrl, '_blank')}
                            >
                              Download
                            </Button>
                          </Box>
                        </Alert>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
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
            <Button
              variant="outlined"
              onClick={handleCancel}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}

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
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={!isValid || isSubmitting || !watchedConsent}
                >
                  {isSubmitting ? 'Creating Order...' : 'Create Order'}
                </Button>
              )}
            </Box>
          </Box>
        </form>

        {/* Consent Dialog */}
        <Dialog
          open={showConsentDialog}
          onClose={() => setShowConsentDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoIcon color="primary" sx={{ mr: 1 }} />
              Patient Consent Required
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Before proceeding with the lab order, please confirm that you have
              obtained proper consent from the patient for the following tests:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              {watchedTests.map((test, index) => (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  • {test.name} ({test.code})
                </Typography>
              ))}
            </Paper>
            <Typography variant="body2" color="text.secondary">
              This consent confirmation will be logged with your user ID and
              timestamp for audit purposes.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowConsentDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleConsentConfirm}
              startIcon={<CheckCircleIcon />}
            >
              Confirm Consent Obtained
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default LabOrderBuilder;
