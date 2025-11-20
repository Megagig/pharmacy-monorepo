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
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';

import { useStrategyRecommendations } from '../../queries/useClinicalInterventions';
import type {
  ClinicalIntervention,
  InterventionStrategy,
  StrategyRecommendation,
} from '../../stores/clinicalInterventionStore';

// ===============================
// TYPES AND INTERFACES
// ===============================

interface StrategyFormData {
  type: InterventionStrategy['type'];
  description: string;
  rationale: string;
  expectedOutcome: string;
  priority: InterventionStrategy['priority'];
}

interface StrategyRecommendationData {
  strategies: StrategyFormData[];
}

interface StrategyRecommendationStepProps {
  onNext: (data: StrategyRecommendationData) => void;
  onBack?: () => void;
  onCancel?: () => void;
  initialData?: {
    category: ClinicalIntervention['category'];
    strategies?: StrategyFormData[];
  };
  isLoading?: boolean;
}

// ===============================
// CONSTANTS
// ===============================

const STRATEGY_TYPES = {
  medication_review: {
    label: 'Medication Review',
    description: 'Comprehensive review of patient medications',
    icon: '📋',
    color: '#2196f3',
    defaultRationale:
      'Systematic evaluation of all medications to identify potential issues',
    defaultOutcome:
      'Optimized medication regimen with improved safety and efficacy',
  },
  dose_adjustment: {
    label: 'Dose Adjustment',
    description: 'Modify medication dosage or frequency',
    icon: '⚖️',
    color: '#4caf50',
    defaultRationale:
      'Current dosing may not be optimal for patient condition or response',
    defaultOutcome:
      'Improved therapeutic response with reduced adverse effects',
  },
  alternative_therapy: {
    label: 'Alternative Therapy',
    description: 'Switch to different medication or treatment',
    icon: '🔄',
    color: '#ff9800',
    defaultRationale:
      'Current therapy is not suitable or effective for this patient',
    defaultOutcome: 'Better tolerated and more effective treatment option',
  },
  discontinuation: {
    label: 'Discontinuation',
    description: 'Stop problematic medication',
    icon: '🛑',
    color: '#f44336',
    defaultRationale: 'Medication is causing harm or no longer indicated',
    defaultOutcome:
      'Elimination of adverse effects and improved patient safety',
  },
  additional_monitoring: {
    label: 'Additional Monitoring',
    description: 'Increase monitoring frequency or parameters',
    icon: '📊',
    color: '#9c27b0',
    defaultRationale:
      'Enhanced monitoring needed to ensure safety and efficacy',
    defaultOutcome: 'Early detection and prevention of potential complications',
  },
  patient_counseling: {
    label: 'Patient Counseling',
    description: 'Educate patient about medication use',
    icon: '👥',
    color: '#00bcd4',
    defaultRationale:
      'Patient education needed to improve understanding and adherence',
    defaultOutcome: 'Improved medication adherence and patient outcomes',
  },
  physician_consultation: {
    label: 'Physician Consultation',
    description: 'Consult with prescribing physician',
    icon: '🩺',
    color: '#795548',
    defaultRationale: 'Physician input needed for optimal patient management',
    defaultOutcome:
      'Collaborative care approach with improved clinical decisions',
  },
  custom: {
    label: 'Custom Strategy',
    description: 'Custom intervention approach',
    icon: '✏️',
    color: '#607d8b',
    defaultRationale: 'Unique intervention approach tailored to patient needs',
    defaultOutcome:
      'Customized solution addressing specific patient requirements',
  },
} as const;

const CATEGORY_STRATEGY_MAPPING = {
  drug_therapy_problem: [
    'medication_review',
    'dose_adjustment',
    'alternative_therapy',
    'discontinuation',
    'additional_monitoring',
  ],
  adverse_drug_reaction: [
    'discontinuation',
    'dose_adjustment',
    'alternative_therapy',
    'additional_monitoring',
    'patient_counseling',
  ],
  medication_nonadherence: [
    'patient_counseling',
    'medication_review',
    'alternative_therapy',
    'additional_monitoring',
  ],
  drug_interaction: [
    'medication_review',
    'dose_adjustment',
    'alternative_therapy',
    'discontinuation',
    'additional_monitoring',
  ],
  dosing_issue: [
    'dose_adjustment',
    'medication_review',
    'additional_monitoring',
    'patient_counseling',
  ],
  contraindication: [
    'discontinuation',
    'alternative_therapy',
    'physician_consultation',
    'additional_monitoring',
  ],
  other: [
    'custom',
    'medication_review',
    'patient_counseling',
    'physician_consultation',
  ],
};

// ===============================
// MAIN COMPONENT
// ===============================

const StrategyRecommendationStep: React.FC<StrategyRecommendationStepProps> = ({
  onNext,
  onBack,
  onCancel,
  initialData,
  isLoading = false,
}) => {
  // State
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [selectedRecommendations, setSelectedRecommendations] = useState<
    string[]
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(null);

  // Queries
  const { data: recommendationsData, isLoading: loadingRecommendations } =
    useStrategyRecommendations(initialData?.category || '');

  // Get recommended strategies for the category
  const recommendedStrategies = useMemo(() => {
    if (!initialData?.category) return [];
    return CATEGORY_STRATEGY_MAPPING[initialData.category] || [];
  }, [initialData?.category]);

  // Form setup
  const defaultValues: StrategyRecommendationData = useMemo(
    () => ({
      strategies: initialData?.strategies || [
        {
          type: 'medication_review',
          description: '',
          rationale: '',
          expectedOutcome: '',
          priority: 'primary',
        },
      ],
    }),
    [initialData?.strategies]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<StrategyRecommendationData>({
    defaultValues,
    mode: 'onChange',
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'strategies',
  });

  const watchedStrategies = watch('strategies');

  // ===============================
  // HANDLERS
  // ===============================

  const handleAddRecommendedStrategy = (strategyType: string) => {
    const strategyConfig =
      STRATEGY_TYPES[strategyType as keyof typeof STRATEGY_TYPES];
    if (!strategyConfig) return;

    append({
      type: strategyType as InterventionStrategy['type'],
      description: '',
      rationale: strategyConfig.defaultRationale,
      expectedOutcome: strategyConfig.defaultOutcome,
      priority: 'primary',
    });

    setSelectedRecommendations((prev) => [...prev, strategyType]);
  };

  const handleAddCustomStrategy = () => {
    append({
      type: 'custom',
      description: '',
      rationale: '',
      expectedOutcome: '',
      priority: 'secondary',
    });
  };

  const handleRemoveStrategy = (index: number) => {
    const strategy = watchedStrategies[index];
    if (strategy) {
      setSelectedRecommendations((prev) =>
        prev.filter((type) => type !== strategy.type)
      );
    }
    remove(index);
  };

  const handleStrategyTypeChange = (index: number, newType: string) => {
    const strategyConfig =
      STRATEGY_TYPES[newType as keyof typeof STRATEGY_TYPES];
    if (!strategyConfig) return;

    setValue(
      `strategies.${index}.type`,
      newType as InterventionStrategy['type']
    );
    setValue(`strategies.${index}.rationale`, strategyConfig.defaultRationale);
    setValue(
      `strategies.${index}.expectedOutcome`,
      strategyConfig.defaultOutcome
    );
  };

  const handleMoveStrategy = (fromIndex: number, toIndex: number) => {
    move(fromIndex, toIndex);
  };

  const onSubmit = (data: StrategyRecommendationData) => {
    onNext(data);
  };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderRecommendations = () => {
    if (!showRecommendations) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <LightbulbIcon color="primary" />
              Recommended Strategies
            </Typography>
            <Button size="small" onClick={() => setShowRecommendations(false)}>
              Hide Recommendations
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Based on the selected category, these strategies are commonly
            effective:
          </Typography>

          {loadingRecommendations ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recommendedStrategies.map((strategyType) => {
                const config =
                  STRATEGY_TYPES[strategyType as keyof typeof STRATEGY_TYPES];
                const isSelected =
                  selectedRecommendations.includes(strategyType);

                return (
                  <Grid item xs={12} sm={6} md={4} key={strategyType}>
                    <Paper
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isSelected ? config.color : 'divider',
                        bgcolor: isSelected
                          ? `${config.color}10`
                          : 'background.paper',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          borderColor: config.color,
                          bgcolor: `${config.color}05`,
                        },
                      }}
                      onClick={() =>
                        !isSelected &&
                        handleAddRecommendedStrategy(strategyType)
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
                        <Typography variant="subtitle2" fontWeight="medium">
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
                          label={isSelected ? 'Added' : 'Add'}
                          color={isSelected ? 'success' : 'primary'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          icon={isSelected ? <CheckCircleIcon /> : <AddIcon />}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddCustomStrategy}
            >
              Add Custom Strategy
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderStrategyForm = (index: number) => {
    const strategy = watchedStrategies[index];
    if (!strategy) return null;

    const strategyConfig = STRATEGY_TYPES[strategy.type];
    const isExpanded = expandedStrategy === index;

    return (
      <Card
        key={index}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" sx={{ cursor: 'grab' }}>
                <DragIcon />
              </IconButton>
              <Typography variant="h6" component="span">
                {strategyConfig?.icon}
              </Typography>
              <Typography variant="subtitle1" fontWeight="medium">
                Strategy {index + 1}
              </Typography>
              <Chip
                size="small"
                label={strategy.priority}
                color={strategy.priority === 'primary' ? 'primary' : 'default'}
              />
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={() => setExpandedStrategy(isExpanded ? null : index)}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleRemoveStrategy(index)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Controller
                name={`strategies.${index}.type`}
                control={control}
                rules={{ required: 'Strategy type is required' }}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!errors.strategies?.[index]?.type}
                  >
                    <InputLabel>Strategy Type</InputLabel>
                    <Select
                      {...field}
                      label="Strategy Type"
                      onChange={(e) => {
                        field.onChange(e);
                        handleStrategyTypeChange(index, e.target.value);
                      }}
                    >
                      {Object.entries(STRATEGY_TYPES).map(([value, config]) => (
                        <MenuItem key={value} value={value}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography variant="body2">
                              {config.icon}
                            </Typography>
                            <Box>
                              <Typography variant="body1">
                                {config.label}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {config.description}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.strategies?.[index]?.type && (
                      <FormHelperText>
                        {errors.strategies[index]?.type?.message}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name={`strategies.${index}.priority`}
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select {...field} label="Priority">
                      <MenuItem value="primary">Primary Strategy</MenuItem>
                      <MenuItem value="secondary">Secondary Strategy</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name={`strategies.${index}.description`}
                control={control}
                rules={{
                  required: 'Strategy description is required',
                  minLength: {
                    value: 10,
                    message: 'Description must be at least 10 characters',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="Strategy Description"
                    placeholder="Describe the specific intervention strategy in detail..."
                    error={!!errors.strategies?.[index]?.description}
                    helperText={
                      errors.strategies?.[index]?.description?.message
                    }
                  />
                )}
              />
            </Grid>

            <Collapse in={isExpanded} sx={{ width: '100%' }}>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name={`strategies.${index}.rationale`}
                    control={control}
                    rules={{
                      required: 'Rationale is required',
                      maxLength: {
                        value: 500,
                        message: 'Rationale must not exceed 500 characters',
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={3}
                        label="Clinical Rationale"
                        placeholder="Why is this strategy appropriate for this patient?"
                        error={!!errors.strategies?.[index]?.rationale}
                        helperText={
                          errors.strategies?.[index]?.rationale?.message ||
                          `${field.value?.length || 0}/500 characters`
                        }
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name={`strategies.${index}.expectedOutcome`}
                    control={control}
                    rules={{
                      required: 'Expected outcome is required',
                      minLength: {
                        value: 20,
                        message:
                          'Expected outcome must be at least 20 characters',
                      },
                      maxLength: {
                        value: 500,
                        message:
                          'Expected outcome must not exceed 500 characters',
                      },
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={3}
                        label="Expected Outcome"
                        placeholder="What outcome do you expect from this strategy?"
                        error={!!errors.strategies?.[index]?.expectedOutcome}
                        helperText={
                          errors.strategies?.[index]?.expectedOutcome
                            ?.message ||
                          `${field.value?.length || 0}/500 characters`
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Collapse>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderStrategiesList = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">Intervention Strategies</Typography>
          <Box>
            <Button
              size="small"
              startIcon={<PreviewIcon />}
              onClick={() => setShowPreview(true)}
              sx={{ mr: 1 }}
            >
              Preview
            </Button>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddCustomStrategy}
              variant="outlined"
            >
              Add Strategy
            </Button>
          </Box>
        </Box>

        {fields.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
            <InfoIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No strategies added yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add strategies from recommendations or create custom ones
            </Typography>
          </Paper>
        ) : (
          <Box>{fields.map((field, index) => renderStrategyForm(index))}</Box>
        )}
      </CardContent>
    </Card>
  );

  const renderPreviewDialog = () => (
    <Dialog
      open={showPreview}
      onClose={() => setShowPreview(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Strategy Preview</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review your intervention strategies before proceeding
        </Typography>

        {watchedStrategies.map((strategy, index) => {
          const config = STRATEGY_TYPES[strategy.type];
          return (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <Typography variant="h6" component="span">
                    {config.icon}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {config.label}
                  </Typography>
                  <Chip
                    size="small"
                    label={strategy.priority}
                    color={
                      strategy.priority === 'primary' ? 'primary' : 'default'
                    }
                  />
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Description:</strong>{' '}
                  {strategy.description || 'Not specified'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Rationale:</strong>{' '}
                  {strategy.rationale || 'Not specified'}
                </Typography>
                <Typography variant="body2">
                  <strong>Expected Outcome:</strong>{' '}
                  {strategy.expectedOutcome || 'Not specified'}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowPreview(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Step 2: Strategy Recommendation
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select and customize intervention strategies based on the clinical issue
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderRecommendations()}
        {renderStrategiesList()}
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
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || fields.length === 0 || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Processing...' : 'Next: Team Collaboration'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default StrategyRecommendationStep;
