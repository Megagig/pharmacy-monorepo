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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  LinearProgress,
  Paper,
  Divider,
  InputAdornment,
  FormHelperText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';

import {
  ManualLabOrder,
  LabResultValue,
  LabResultInterpretation,
  AddLabResultData,
} from '../types/manualLabOrder';

// Mock reference ranges and normal values
const REFERENCE_RANGES: Record<
  string,
  { min?: number; max?: number; unit: string; qualitative?: string[] }
> = {
  CBC: {
    min: 4.5,
    max: 11.0,
    unit: 'x10³/μL',
  },
  BMP: {
    unit: 'mmol/L',
    qualitative: ['Normal', 'Abnormal'],
  },
  LIPID: {
    unit: 'mg/dL',
    qualitative: ['Normal', 'Borderline', 'High'],
  },
  UA: {
    unit: 'Various',
    qualitative: ['Normal', 'Abnormal', 'Trace', 'Positive', 'Negative'],
  },
  TFT: {
    min: 0.4,
    max: 4.0,
    unit: 'mIU/L',
  },
};

interface ResultFormData {
  values: LabResultValue[];
  comment: string;
}

interface ResultEntryFormProps {
  order: ManualLabOrder;
  onResultsSubmitted?: (results: any) => void;
  onCancel?: () => void;
  readonly?: boolean;
}

const ResultEntryForm: React.FC<ResultEntryFormProps> = ({
  order,
  onResultsSubmitted,
  onCancel,
  readonly = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [interpretations, setInterpretations] = useState<
    LabResultInterpretation[]
  >([]);

  // Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid, isDirty },
    reset,
  } = useForm<ResultFormData>({
    defaultValues: {
      values: order.tests.map((test) => ({
        testCode: test.code,
        testName: test.name,
        numericValue: undefined,
        unit: test.unit || '',
        stringValue: '',
        comment: '',
        abnormalFlag: false,
      })),
      comment: '',
    },
    mode: 'onChange',
  });

  // Field arrays
  const { fields: valueFields, update: updateValue } = useFieldArray({
    control,
    name: 'values',
  });

  // Watch form values for real-time validation
  const watchedValues = watch('values');

  // Real-time interpretation calculation
  useEffect(() => {
    const newInterpretations: LabResultInterpretation[] = [];

    watchedValues.forEach((value, index) => {
      if (value.numericValue !== undefined && value.numericValue !== null) {
        const refRange = REFERENCE_RANGES[value.testCode];
        if (
          refRange &&
          refRange.min !== undefined &&
          refRange.max !== undefined
        ) {
          let interpretation: 'low' | 'normal' | 'high' | 'critical' = 'normal';

          if (value.numericValue < refRange.min) {
            interpretation =
              value.numericValue < refRange.min * 0.5 ? 'critical' : 'low';
          } else if (value.numericValue > refRange.max) {
            interpretation =
              value.numericValue > refRange.max * 2 ? 'critical' : 'high';
          }

          newInterpretations.push({
            testCode: value.testCode,
            interpretation,
            note: `Reference range: ${refRange.min}-${refRange.max} ${refRange.unit}`,
          });

          // Update abnormal flag
          const updatedValue = {
            ...value,
            abnormalFlag: interpretation !== 'normal',
          };
          updateValue(index, updatedValue);
        }
      }
    });

    setInterpretations(newInterpretations);
  }, [watchedValues, updateValue]);

  // Validation function
  const validateResults = (data: ResultFormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    data.values.forEach((value, index) => {
      const hasNumeric =
        value.numericValue !== undefined &&
        value.numericValue !== null &&
        value.numericValue !== '';
      const hasString = value.stringValue && value.stringValue.trim() !== '';

      if (!hasNumeric && !hasString) {
        errors[`values.${index}`] = 'Please enter a result value';
      }

      if (hasNumeric && value.numericValue! < 0) {
        errors[`values.${index}`] = 'Value cannot be negative';
      }

      if (hasNumeric && value.numericValue! > 999999) {
        errors[`values.${index}`] = 'Value seems unreasonably high';
      }
    });

    return errors;
  };

  // Real-time validation
  useEffect(() => {
    const data = getValues();
    const errors = validateResults(data);
    setValidationErrors(errors);
  }, [watchedValues, getValues]);

  // Get interpretation info
  const getInterpretationInfo = (interpretation: string) => {
    switch (interpretation) {
      case 'low':
        return { color: '#2196f3', icon: <TrendingDownIcon />, label: 'Low' };
      case 'high':
        return { color: '#ff9800', icon: <TrendingUpIcon />, label: 'High' };
      case 'critical':
        return { color: '#f44336', icon: <ErrorIcon />, label: 'Critical' };
      case 'normal':
      default:
        return { color: '#4caf50', icon: <CheckCircleIcon />, label: 'Normal' };
    }
  };

  // Handle form submission
  const onSubmit = async (data: ResultFormData) => {
    const errors = validateResults(data);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setShowConfirmDialog(true);
  };

  // Confirm submission
  const handleConfirmSubmission = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    setAiProcessing(true);

    try {
      const data = getValues();
      const resultData: AddLabResultData = {
        values: data.values.filter(
          (v) =>
            (v.numericValue !== undefined && v.numericValue !== null) ||
            (v.stringValue && v.stringValue.trim() !== '')
        ),
        comment: data.comment || undefined,
      };

      // Mock API call for result submission
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock AI processing
      setAiProcessing(true);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Mock successful response
      const mockResult = {
        _id: 'result_123',
        orderId: order.orderId,
        values: resultData.values,
        interpretation: interpretations,
        aiProcessed: true,
        diagnosticResult: {
          differentialDiagnoses: [
            {
              condition: 'Normal findings',
              probability: 85,
              reasoning: 'All values within normal range',
              severity: 'low',
            },
          ],
          redFlags: [],
          recommendedTests: [],
          therapeuticOptions: [],
          confidenceScore: 90,
        },
      };

      if (onResultsSubmitted) {
        onResultsSubmitted(mockResult);
      } else {
        navigate(`/lab-orders/${order.orderId}/interpretation`);
      }
    } catch (error) {
      console.error('Failed to submit results:', error);
    } finally {
      setIsSubmitting(false);
      setAiProcessing(false);
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

  // Get test reference info
  const getTestReferenceInfo = (testCode: string) => {
    return REFERENCE_RANGES[testCode] || { unit: '', qualitative: [] };
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleCancel} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Enter Lab Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Order: {order.orderId} | Patient: {order.patient?.firstName}{' '}
            {order.patient?.lastName}
          </Typography>
        </Box>
      </Box>

      {/* Progress Indicator */}
      {(isSubmitting || aiProcessing) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={20} sx={{ mr: 2 }} />
              <Typography variant="body1">
                {aiProcessing
                  ? 'Processing results with AI interpretation...'
                  : 'Submitting results...'}
              </Typography>
            </Box>
            <LinearProgress />
            {aiProcessing && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This may take a few moments while our AI analyzes the results
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Test Results */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Test Results ({order.tests.length} tests)
            </Typography>

            {valueFields.map((field, index) => {
              const test = order.tests[index];
              const refInfo = getTestReferenceInfo(test.code);
              const interpretation = interpretations.find(
                (i) => i.testCode === test.code
              );
              const interpretationInfo = interpretation
                ? getInterpretationInfo(interpretation.interpretation)
                : null;
              const hasError = validationErrors[`values.${index}`];

              return (
                <Accordion key={field.id} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'between',
                        width: '100%',
                        mr: 2,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {test.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={test.code}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={test.specimenType}
                            size="small"
                            color="primary"
                          />
                        </Box>
                      </Box>
                      {interpretationInfo && (
                        <Chip
                          icon={interpretationInfo.icon}
                          label={interpretationInfo.label}
                          size="small"
                          sx={{
                            bgcolor: interpretationInfo.color,
                            color: 'white',
                          }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      {/* Numeric Value */}
                      {refInfo.min !== undefined ||
                      refInfo.max !== undefined ? (
                        <Grid item xs={12} md={6}>
                          <Controller
                            name={`values.${index}.numericValue`}
                            control={control}
                            render={({ field: inputField }) => (
                              <TextField
                                {...inputField}
                                type="number"
                                label="Numeric Value"
                                fullWidth
                                error={!!hasError}
                                helperText={
                                  hasError ||
                                  (refInfo.min !== undefined &&
                                    refInfo.max !== undefined &&
                                    `Reference: ${refInfo.min}-${refInfo.max}`)
                                }
                                InputProps={{
                                  endAdornment: refInfo.unit && (
                                    <InputAdornment position="end">
                                      {refInfo.unit}
                                    </InputAdornment>
                                  ),
                                }}
                                inputProps={{
                                  step: 0.01,
                                  min: 0,
                                }}
                                disabled={readonly}
                              />
                            )}
                          />
                        </Grid>
                      ) : null}

                      {/* Qualitative Value */}
                      {refInfo.qualitative && refInfo.qualitative.length > 0 ? (
                        <Grid item xs={12} md={6}>
                          <Controller
                            name={`values.${index}.stringValue`}
                            control={control}
                            render={({ field: inputField }) => (
                              <FormControl fullWidth error={!!hasError}>
                                <InputLabel>Result</InputLabel>
                                <Select
                                  {...inputField}
                                  label="Result"
                                  disabled={readonly}
                                >
                                  <MenuItem value="">
                                    <em>Select result</em>
                                  </MenuItem>
                                  {refInfo.qualitative!.map((option) => (
                                    <MenuItem key={option} value={option}>
                                      {option}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {hasError && (
                                  <FormHelperText>{hasError}</FormHelperText>
                                )}
                              </FormControl>
                            )}
                          />
                        </Grid>
                      ) : (
                        <Grid item xs={12} md={6}>
                          <Controller
                            name={`values.${index}.stringValue`}
                            control={control}
                            render={({ field: inputField }) => (
                              <TextField
                                {...inputField}
                                label="Text Result"
                                fullWidth
                                error={!!hasError}
                                helperText={
                                  hasError || 'Enter qualitative result'
                                }
                                disabled={readonly}
                              />
                            )}
                          />
                        </Grid>
                      )}

                      {/* Unit (if not predefined) */}
                      {!refInfo.unit && (
                        <Grid item xs={12} md={6}>
                          <Controller
                            name={`values.${index}.unit`}
                            control={control}
                            render={({ field: inputField }) => (
                              <TextField
                                {...inputField}
                                label="Unit"
                                fullWidth
                                helperText="Unit of measurement"
                                disabled={readonly}
                              />
                            )}
                          />
                        </Grid>
                      )}

                      {/* Comments */}
                      <Grid item xs={12}>
                        <Controller
                          name={`values.${index}.comment`}
                          control={control}
                          render={({ field: inputField }) => (
                            <TextField
                              {...inputField}
                              label="Comments"
                              multiline
                              rows={2}
                              fullWidth
                              helperText="Additional notes or observations"
                              disabled={readonly}
                            />
                          )}
                        />
                      </Grid>

                      {/* Reference Information */}
                      <Grid item xs={12}>
                        <Paper
                          variant="outlined"
                          sx={{ p: 2, bgcolor: 'background.default' }}
                        >
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Reference Information
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Specimen:</strong> {test.specimenType}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Reference Range:</strong> {test.refRange}
                          </Typography>
                          {test.loincCode && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>LOINC Code:</strong> {test.loincCode}
                            </Typography>
                          )}
                          {interpretation && (
                            <Box
                              sx={{
                                mt: 1,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {interpretationInfo?.icon}
                              <Typography
                                variant="body2"
                                sx={{
                                  ml: 1,
                                  color: interpretationInfo?.color,
                                  fontWeight: 600,
                                }}
                              >
                                Interpretation: {interpretationInfo?.label}
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </CardContent>
        </Card>

        {/* Overall Comments */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Overall Comments
            </Typography>
            <Controller
              name="comment"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="General Comments"
                  multiline
                  rows={4}
                  fullWidth
                  helperText="Any additional observations or notes about the overall results"
                  disabled={readonly}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Validation Summary */}
        {Object.keys(validationErrors).length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Please correct the following errors:
            </Typography>
            {Object.entries(validationErrors).map(([field, error]) => (
              <Typography key={field} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Critical Values Alert */}
        {interpretations.some((i) => i.interpretation === 'critical') && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WarningIcon sx={{ mr: 1 }} />
              <Typography variant="body2">
                <strong>Critical values detected!</strong> These results require
                immediate attention and may trigger urgent notifications.
              </Typography>
            </Box>
          </Alert>
        )}

        {/* AI Processing Info */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PsychologyIcon sx={{ mr: 1 }} />
            <Typography variant="body2">
              After submitting, these results will be automatically analyzed by
              our AI system to provide diagnostic insights and recommendations.
            </Typography>
          </Box>
        </Alert>

        {/* Form Actions */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            pt: 3,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button
            variant="outlined"
            onClick={handleCancel}
            startIcon={<CancelIcon />}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={
              !isValid ||
              isSubmitting ||
              Object.keys(validationErrors).length > 0 ||
              readonly
            }
            size="large"
          >
            {isSubmitting ? 'Processing...' : 'Submit Results'}
          </Button>
        </Box>
      </form>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircleIcon color="primary" sx={{ mr: 1 }} />
            Confirm Result Submission
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You are about to submit results for {order.tests.length} tests. This
            action cannot be undone.
          </Typography>

          {/* Summary of results */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Results Summary:
            </Typography>
            {watchedValues.map((value, index) => {
              const hasValue =
                (value.numericValue !== undefined &&
                  value.numericValue !== null) ||
                (value.stringValue && value.stringValue.trim() !== '');

              if (!hasValue) return null;

              return (
                <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                  • {value.testName}: {value.numericValue || value.stringValue}{' '}
                  {value.unit}
                </Typography>
              );
            })}
          </Paper>

          {interpretations.some((i) => i.interpretation === 'critical') && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Warning:</strong> Critical values detected. Urgent
                notifications will be sent to relevant healthcare providers.
              </Typography>
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            The results will be processed by our AI system for diagnostic
            insights and recommendations.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSubmission}
            startIcon={<SaveIcon />}
          >
            Confirm & Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResultEntryForm;
