import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
  Grid,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Slider,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Rating,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Calculate as CalculateIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';

import type { InterventionOutcome } from '../../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface OutcomeTrackingData {
  outcome: InterventionOutcome;
}

interface OutcomeTrackingStepProps {
  onNext: (data: OutcomeTrackingData) => void;
  onBack?: () => void;
  onCancel?: () => void;
  initialData?: {
    outcome?: InterventionOutcome;
  };
  isLoading?: boolean;
}

interface ClinicalParameter {
  parameter: string;
  beforeValue?: string;
  afterValue?: string;
  unit?: string;
  improvementPercentage?: number;
}

// ===============================
// CONSTANTS
// ===============================

const PATIENT_RESPONSE_OPTIONS = {
  improved: {
    label: 'Improved',
    description: 'Patient condition or symptoms have improved',
    icon: <TrendingUpIcon />,
    color: '#4caf50',
  },
  no_change: {
    label: 'No Change',
    description: 'No significant change in patient condition',
    icon: <TrendingFlatIcon />,
    color: '#ff9800',
  },
  worsened: {
    label: 'Worsened',
    description: 'Patient condition has deteriorated',
    icon: <TrendingDownIcon />,
    color: '#f44336',
  },
  unknown: {
    label: 'Unknown',
    description: 'Unable to determine patient response',
    icon: <InfoIcon />,
    color: '#9e9e9e',
  },
} as const;

const SUCCESS_METRICS = [
  {
    key: 'problemResolved',
    label: 'Clinical Problem Resolved',
    description:
      'The identified clinical issue has been successfully addressed',
  },
  {
    key: 'medicationOptimized',
    label: 'Medication Regimen Optimized',
    description: "Patient's medication therapy has been improved",
  },
  {
    key: 'adherenceImproved',
    label: 'Medication Adherence Improved',
    description: 'Patient compliance with medication regimen has increased',
  },
  {
    key: 'qualityOfLifeImproved',
    label: 'Quality of Life Improved',
    description: "Patient's overall quality of life has been enhanced",
  },
] as const;

const COMMON_PARAMETERS = [
  { name: 'Blood Pressure (Systolic)', unit: 'mmHg', type: 'numeric' },
  { name: 'Blood Pressure (Diastolic)', unit: 'mmHg', type: 'numeric' },
  { name: 'Heart Rate', unit: 'bpm', type: 'numeric' },
  { name: 'Blood Glucose', unit: 'mg/dL', type: 'numeric' },
  { name: 'HbA1c', unit: '%', type: 'numeric' },
  { name: 'Total Cholesterol', unit: 'mg/dL', type: 'numeric' },
  { name: 'LDL Cholesterol', unit: 'mg/dL', type: 'numeric' },
  { name: 'HDL Cholesterol', unit: 'mg/dL', type: 'numeric' },
  { name: 'Triglycerides', unit: 'mg/dL', type: 'numeric' },
  { name: 'Creatinine', unit: 'mg/dL', type: 'numeric' },
  { name: 'eGFR', unit: 'mL/min/1.73m²', type: 'numeric' },
  { name: 'Pain Scale', unit: '0-10', type: 'numeric' },
  { name: 'Weight', unit: 'kg', type: 'numeric' },
  { name: 'BMI', unit: 'kg/m²', type: 'numeric' },
  { name: 'Medication Adherence', unit: '%', type: 'numeric' },
] as const;

const SEVERITY_LEVELS = {
  mild: {
    label: 'Mild',
    description: 'Minor discomfort or inconvenience',
    color: '#4caf50',
  },
  moderate: {
    label: 'Moderate',
    description: 'Noticeable impact on daily activities',
    color: '#ff9800',
  },
  severe: {
    label: 'Severe',
    description: 'Significant impact requiring intervention',
    color: '#f44336',
  },
  life_threatening: {
    label: 'Life-threatening',
    description: 'Immediate medical attention required',
    color: '#d32f2f',
  },
} as const;

// ===============================
// MAIN COMPONENT
// ===============================

const OutcomeTrackingStep: React.FC<OutcomeTrackingStepProps> = ({
  onNext,
  onBack,
  onCancel,
  initialData,
  isLoading = false,
}) => {
  // State
  const [showPreview, setShowPreview] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('response');

  // Form setup
  const defaultValues: OutcomeTrackingData = useMemo(
    () => ({
      outcome: {
        patientResponse: initialData?.outcome?.patientResponse || 'unknown',
        clinicalParameters: initialData?.outcome?.clinicalParameters || [],
        adverseEffects: initialData?.outcome?.adverseEffects || '',
        additionalIssues: initialData?.outcome?.additionalIssues || '',
        successMetrics: {
          problemResolved:
            initialData?.outcome?.successMetrics?.problemResolved || false,
          medicationOptimized:
            initialData?.outcome?.successMetrics?.medicationOptimized || false,
          adherenceImproved:
            initialData?.outcome?.successMetrics?.adherenceImproved || false,
          costSavings:
            initialData?.outcome?.successMetrics?.costSavings || undefined,
          qualityOfLifeImproved:
            initialData?.outcome?.successMetrics?.qualityOfLifeImproved ||
            false,
        },
      },
    }),
    [initialData?.outcome]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<OutcomeTrackingData>({
    defaultValues,
    mode: 'onChange',
  });

  const {
    fields: parameterFields,
    append: appendParameter,
    remove: removeParameter,
  } = useFieldArray({
    control,
    name: 'outcome.clinicalParameters',
  });

  const watchedOutcome = watch('outcome');
  const watchedResponse = watch('outcome.patientResponse');
  const watchedParameters = watch('outcome.clinicalParameters');

  // Calculate overall improvement percentage
  const overallImprovement = useMemo(() => {
    if (!watchedParameters || watchedParameters.length === 0) return 0;

    const validParameters = watchedParameters.filter(
      (p) =>
        p.improvementPercentage !== undefined &&
        p.improvementPercentage !== null
    );

    if (validParameters.length === 0) return 0;

    const total = validParameters.reduce(
      (sum, p) => sum + (p.improvementPercentage || 0),
      0
    );
    return Math.round(total / validParameters.length);
  }, [watchedParameters]);

  // ===============================
  // HANDLERS
  // ===============================

  const handleAddParameter = (parameterName?: string, unit?: string) => {
    appendParameter({
      parameter: parameterName || '',
      beforeValue: '',
      afterValue: '',
      unit: unit || '',
      improvementPercentage: undefined,
    });
  };

  const handleRemoveParameter = (index: number) => {
    removeParameter(index);
  };

  const calculateImprovement = (
    beforeValue: string,
    afterValue: string,
    parameter: string
  ) => {
    const before = parseFloat(beforeValue);
    const after = parseFloat(afterValue);

    if (isNaN(before) || isNaN(after)) return undefined;

    // For parameters where lower is better (e.g., blood pressure, cholesterol, pain)
    const lowerIsBetter = [
      'blood pressure',
      'cholesterol',
      'pain',
      'glucose',
      'hba1c',
      'triglycerides',
      'creatinine',
      'weight',
      'bmi',
    ].some((term) => parameter.toLowerCase().includes(term));

    let improvement;
    if (lowerIsBetter) {
      improvement = ((before - after) / before) * 100;
    } else {
      // For parameters where higher is better (e.g., HDL, eGFR, adherence)
      improvement = ((after - before) / before) * 100;
    }

    return Math.round(improvement);
  };

  const handleParameterChange = (
    index: number,
    field: keyof ClinicalParameter,
    value: string
  ) => {
    setValue(`outcome.clinicalParameters.${index}.${field}`, value);

    // Auto-calculate improvement percentage when both values are present
    if (field === 'beforeValue' || field === 'afterValue') {
      const parameter = watchedParameters[index];
      if (parameter) {
        const beforeValue =
          field === 'beforeValue' ? value : parameter.beforeValue;
        const afterValue =
          field === 'afterValue' ? value : parameter.afterValue;

        if (beforeValue && afterValue) {
          const improvement = calculateImprovement(
            beforeValue,
            afterValue,
            parameter.parameter
          );
          setValue(
            `outcome.clinicalParameters.${index}.improvementPercentage`,
            improvement
          );
        }
      }
    }
  };

  const onSubmit = (data: OutcomeTrackingData) => {
    onNext(data);
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderPatientResponse = () => (
    <Accordion
      expanded={expandedSection === 'response'}
      onChange={() =>
        setExpandedSection(expandedSection === 'response' ? '' : 'response')
      }
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <AssessmentIcon color="primary" />
          Patient Response Assessment
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Evaluate the overall patient response to the intervention
        </Typography>

        <Controller
          name="outcome.patientResponse"
          control={control}
          rules={{ required: 'Patient response is required' }}
          render={({ field }) => (
            <Grid container spacing={2}>
              {Object.entries(PATIENT_RESPONSE_OPTIONS).map(
                ([value, config]) => (
                  <Grid item xs={12} sm={6} md={3} key={value}>
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
                        textAlign: 'center',
                        '&:hover': {
                          borderColor: config.color,
                          bgcolor: `${config.color}05`,
                        },
                      }}
                      onClick={() => field.onChange(value)}
                    >
                      <Box sx={{ color: config.color, mb: 1 }}>
                        {config.icon}
                      </Box>
                      <Typography
                        variant="subtitle1"
                        fontWeight="medium"
                        sx={{ mb: 1 }}
                      >
                        {config.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {config.description}
                      </Typography>
                    </Paper>
                  </Grid>
                )
              )}
            </Grid>
          )}
        />
        {errors.outcome?.patientResponse && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {errors.outcome.patientResponse.message}
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );

  const renderClinicalParameters = () => (
    <Accordion
      expanded={expandedSection === 'parameters'}
      onChange={() =>
        setExpandedSection(expandedSection === 'parameters' ? '' : 'parameters')
      }
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <TimelineIcon color="primary" />
          Clinical Parameters
          {watchedParameters.length > 0 && (
            <Chip
              size="small"
              label={`${watchedParameters.length} parameters`}
            />
          )}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Track measurable clinical parameters before and after intervention
        </Typography>

        {overallImprovement !== 0 && (
          <Alert
            severity={overallImprovement > 0 ? 'success' : 'warning'}
            sx={{ mb: 2 }}
            icon={
              overallImprovement > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />
            }
          >
            <Typography variant="body2" fontWeight="medium">
              Overall Improvement: {overallImprovement > 0 ? '+' : ''}
              {overallImprovement}%
            </Typography>
          </Alert>
        )}

        {parameterFields.map((field, index) => {
          const parameter = watchedParameters[index];
          const improvement = parameter?.improvementPercentage;

          return (
            <Card
              key={field.id}
              sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="medium">
                    Parameter {index + 1}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {improvement !== undefined && (
                      <Chip
                        size="small"
                        label={`${improvement > 0 ? '+' : ''}${improvement}%`}
                        color={
                          improvement > 0
                            ? 'success'
                            : improvement < 0
                            ? 'error'
                            : 'default'
                        }
                        icon={
                          improvement > 0 ? (
                            <TrendingUpIcon />
                          ) : improvement < 0 ? (
                            <TrendingDownIcon />
                          ) : (
                            <TrendingFlatIcon />
                          )
                        }
                      />
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveParameter(index)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Controller
                      name={`outcome.clinicalParameters.${index}.parameter`}
                      control={control}
                      rules={{ required: 'Parameter name is required' }}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Parameter</InputLabel>
                          <Select
                            {...field}
                            label="Parameter"
                            onChange={(e) => {
                              field.onChange(e);
                              const selected = COMMON_PARAMETERS.find(
                                (p) => p.name === e.target.value
                              );
                              if (selected) {
                                setValue(
                                  `outcome.clinicalParameters.${index}.unit`,
                                  selected.unit
                                );
                              }
                            }}
                          >
                            {COMMON_PARAMETERS.map((param) => (
                              <MenuItem key={param.name} value={param.name}>
                                {param.name} ({param.unit})
                              </MenuItem>
                            ))}
                            <MenuItem value="custom">Custom Parameter</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Controller
                      name={`outcome.clinicalParameters.${index}.unit`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Unit"
                          placeholder="e.g., mg/dL"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Controller
                      name={`outcome.clinicalParameters.${index}.beforeValue`}
                      control={control}
                      rules={{ required: 'Before value is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Before Value"
                          placeholder="0.0"
                          onChange={(e) => {
                            field.onChange(e);
                            handleParameterChange(
                              index,
                              'beforeValue',
                              e.target.value
                            );
                          }}
                          error={
                            !!errors.outcome?.clinicalParameters?.[index]
                              ?.beforeValue
                          }
                          helperText={
                            errors.outcome?.clinicalParameters?.[index]
                              ?.beforeValue?.message
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Controller
                      name={`outcome.clinicalParameters.${index}.afterValue`}
                      control={control}
                      rules={{ required: 'After value is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="After Value"
                          placeholder="0.0"
                          onChange={(e) => {
                            field.onChange(e);
                            handleParameterChange(
                              index,
                              'afterValue',
                              e.target.value
                            );
                          }}
                          error={
                            !!errors.outcome?.clinicalParameters?.[index]
                              ?.afterValue
                          }
                          helperText={
                            errors.outcome?.clinicalParameters?.[index]
                              ?.afterValue?.message
                          }
                        />
                      )}
                    />
                  </Grid>
                </Grid>

                {improvement !== undefined && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Improvement: {improvement}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(Math.abs(improvement), 100)}
                      color={improvement > 0 ? 'success' : 'error'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {COMMON_PARAMETERS.slice(0, 5).map((param) => (
            <Button
              key={param.name}
              size="small"
              variant="outlined"
              onClick={() => handleAddParameter(param.name, param.unit)}
            >
              Add {param.name}
            </Button>
          ))}
        </Box>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleAddParameter()}
          fullWidth
        >
          Add Custom Parameter
        </Button>
      </AccordionDetails>
    </Accordion>
  );

  const renderSuccessMetrics = () => (
    <Accordion
      expanded={expandedSection === 'metrics'}
      onChange={() =>
        setExpandedSection(expandedSection === 'metrics' ? '' : 'metrics')
      }
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <CheckCircleIcon color="primary" />
          Success Metrics
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Evaluate the success of the intervention across different dimensions
        </Typography>

        <FormGroup>
          {SUCCESS_METRICS.map((metric) => (
            <Controller
              key={metric.key}
              name={`outcome.successMetrics.${metric.key}`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      {...field}
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {metric.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metric.description}
                      </Typography>
                    </Box>
                  }
                />
              )}
            />
          ))}
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Controller
          name="outcome.successMetrics.costSavings"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              type="number"
              label="Estimated Cost Savings (Optional)"
              placeholder="0.00"
              InputProps={{
                startAdornment: '$',
              }}
              helperText="Estimated cost savings from this intervention"
            />
          )}
        />
      </AccordionDetails>
    </Accordion>
  );

  const renderAdverseEffects = () => (
    <Accordion
      expanded={expandedSection === 'adverse'}
      onChange={() =>
        setExpandedSection(expandedSection === 'adverse' ? '' : 'adverse')
      }
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <WarningIcon color="primary" />
          Adverse Effects & Issues
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Controller
              name="outcome.adverseEffects"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Adverse Effects (Optional)"
                  placeholder="Document any adverse effects or complications that occurred..."
                  helperText="Include severity, duration, and any corrective actions taken"
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="outcome.additionalIssues"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Additional Issues (Optional)"
                  placeholder="Document any new issues or concerns that emerged..."
                  helperText="Include any new clinical problems or complications"
                />
              )}
            />
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  const renderOutcomeSummary = () => {
    const successCount = Object.values(watchedOutcome.successMetrics).filter(
      Boolean
    ).length;
    const responseConfig = PATIENT_RESPONSE_OPTIONS[watchedResponse];

    return (
      <Card
        sx={{
          mb: 3,
          bgcolor: 'primary.50',
          border: '1px solid',
          borderColor: 'primary.200',
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CalculateIcon color="primary" />
            Outcome Summary
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Box sx={{ color: responseConfig.color, mb: 1 }}>
                  {responseConfig.icon}
                </Box>
                <Typography variant="h6">{responseConfig.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Patient Response
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {watchedParameters.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Parameters Tracked
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {successCount}/4
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Success Metrics
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  color={
                    overallImprovement > 0
                      ? 'success.main'
                      : overallImprovement < 0
                      ? 'error.main'
                      : 'text.secondary'
                  }
                >
                  {overallImprovement > 0 ? '+' : ''}
                  {overallImprovement}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Improvement
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderPreviewDialog = () => (
    <Dialog
      open={showPreview}
      onClose={() => setShowPreview(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Outcome Preview</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review the complete outcome assessment before finalizing
        </Typography>

        {renderOutcomeSummary()}

        <Typography variant="h6" gutterBottom>
          Patient Response
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {PATIENT_RESPONSE_OPTIONS[watchedResponse].label}:{' '}
          {PATIENT_RESPONSE_OPTIONS[watchedResponse].description}
        </Typography>

        {watchedParameters.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>
              Clinical Parameters
            </Typography>
            <List dense>
              {watchedParameters.map((param, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${param.parameter}: ${param.beforeValue} → ${param.afterValue} ${param.unit}`}
                    secondary={
                      param.improvementPercentage !== undefined
                        ? `Improvement: ${
                            param.improvementPercentage > 0 ? '+' : ''
                          }${param.improvementPercentage}%`
                        : 'No improvement calculated'
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Success Metrics
        </Typography>
        <List dense>
          {SUCCESS_METRICS.map((metric) => (
            <ListItem key={metric.key}>
              <ListItemIcon>
                {watchedOutcome.successMetrics[metric.key] ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <CancelIcon color="disabled" />
                )}
              </ListItemIcon>
              <ListItemText primary={metric.label} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowPreview(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 4: Outcome Tracking
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Document and measure the outcomes of the clinical intervention
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderOutcomeSummary()}

        <Box sx={{ mb: 3 }}>
          {renderPatientResponse()}
          {renderClinicalParameters()}
          {renderSuccessMetrics()}
          {renderAdverseEffects()}
        </Box>

        {renderPreviewDialog()}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Box>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={isLoading}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button variant="outlined" onClick={onBack} disabled={isLoading}>
              Back
            </Button>
          </Box>
          <Box>
            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={() => setShowPreview(true)}
              sx={{ mr: 1 }}
            >
              Preview
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!isValid || isLoading}
              startIcon={
                isLoading ? <CircularProgress size={20} /> : <SaveIcon />
              }
            >
              {isLoading ? 'Saving...' : 'Complete Intervention'}
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default OutcomeTrackingStep;
