import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Autocomplete,
  Paper,
  CircularProgress,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { FixedGrid } from './common/FixedGrid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useMTRStore } from '../stores/mtrStore';
import type {
  DrugTherapyProblem,
  TherapyPlan,
  TherapyRecommendation,
  MonitoringParameter,
  TherapyGoal,
} from '../types/mtr';

interface PlanDevelopmentProps {
  problems: DrugTherapyProblem[];
  onPlanCreated: (plan: TherapyPlan) => void;
  onPlanUpdated?: (plan: TherapyPlan) => void;
  existingPlan?: TherapyPlan;
}

interface PlanFormData {
  problems: string[];
  recommendations: TherapyRecommendation[];
  monitoringPlan: MonitoringParameter[];
  counselingPoints: string[];
  goals: TherapyGoal[];
  timeline: string;
  pharmacistNotes: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`plan-tabpanel-${index}`}
      aria-labelledby={`plan-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const RECOMMENDATION_TYPES = [
  {
    value: 'discontinue',
    label: 'Discontinue Medication',
    description: 'Stop the medication completely',
    icon: <ErrorIcon />,
    color: 'error',
  },
  {
    value: 'adjust_dose',
    label: 'Adjust Dose',
    description: 'Modify the current dosage',
    icon: <EditIcon />,
    color: 'warning',
  },
  {
    value: 'switch_therapy',
    label: 'Switch Therapy',
    description: 'Change to alternative medication',
    icon: <ContentCopyIcon />,
    color: 'info',
  },
  {
    value: 'add_therapy',
    label: 'Add Therapy',
    description: 'Add new medication to regimen',
    icon: <AddIcon />,
    color: 'success',
  },
  {
    value: 'monitor',
    label: 'Monitor',
    description: 'Continue with enhanced monitoring',
    icon: <MonitorHeartIcon />,
    color: 'primary',
  },
];

const PRIORITY_LEVELS = [
  { value: 'high', label: 'High Priority', color: 'error' },
  { value: 'medium', label: 'Medium Priority', color: 'warning' },
  { value: 'low', label: 'Low Priority', color: 'success' },
];

const MONITORING_PARAMETERS = [
  'Blood Pressure',
  'Heart Rate',
  'Blood Glucose',
  'HbA1c',
  'Lipid Panel',
  'Liver Function Tests',
  'Kidney Function (Creatinine)',
  'Electrolytes',
  'Complete Blood Count',
  'INR/PT',
  'Drug Levels',
  'Symptom Assessment',
  'Adherence Check',
  'Side Effects Monitoring',
  'Quality of Life',
];

const MONITORING_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Bi-weekly',
  'Monthly',
  'Every 3 months',
  'Every 6 months',
  'Annually',
  'As needed',
  'Before next visit',
];

const COUNSELING_TEMPLATES = [
  'Medication administration instructions',
  'Side effects to watch for',
  'Drug-food interactions',
  'Importance of adherence',
  'Storage instructions',
  'When to contact healthcare provider',
  'Lifestyle modifications',
  'Disease state education',
  'Monitoring requirements',
  'Follow-up schedule',
];

const RECOMMENDATION_TEMPLATES = {
  discontinue: [
    'Discontinue due to lack of indication',
    'Discontinue due to adverse effects',
    'Discontinue due to drug interaction',
    'Discontinue due to contraindication',
  ],
  adjust_dose: [
    'Reduce dose due to side effects',
    'Increase dose for better efficacy',
    'Adjust dose based on kidney function',
    'Adjust dose based on age',
  ],
  switch_therapy: [
    'Switch to more effective alternative',
    'Switch to safer alternative',
    'Switch to more cost-effective option',
    'Switch due to patient preference',
  ],
  add_therapy: [
    'Add therapy for untreated condition',
    'Add therapy for better disease control',
    'Add therapy for drug interaction prevention',
    'Add therapy for side effect management',
  ],
  monitor: [
    'Continue with enhanced monitoring',
    'Monitor for therapeutic response',
    'Monitor for adverse effects',
    'Monitor drug levels',
  ],
};

const PlanDevelopment: React.FC<PlanDevelopmentProps> = ({
  problems,
  onPlanCreated,
  onPlanUpdated,
  existingPlan,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isRecommendationDialogOpen, setIsRecommendationDialogOpen] =
    useState(false);
  const [isMonitoringDialogOpen, setIsMonitoringDialogOpen] = useState(false);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<TherapyRecommendation | null>(null);
  const [selectedMonitoring, setSelectedMonitoring] =
    useState<MonitoringParameter | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<TherapyGoal | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { createPlan, updatePlan, loading } = useMTRStore();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isDirty },
  } = useForm<PlanFormData>({
    defaultValues: {
      problems: existingPlan?.problems || [],
      recommendations: existingPlan?.recommendations || [],
      monitoringPlan: existingPlan?.monitoringPlan || [],
      counselingPoints: existingPlan?.counselingPoints || [],
      goals: existingPlan?.goals || [],
      timeline: existingPlan?.timeline || '',
      pharmacistNotes: existingPlan?.pharmacistNotes || '',
    },
  });

  const {
    fields: recommendationFields,
    append: appendRecommendation,
    remove: removeRecommendation,
    update: updateRecommendationField,
  } = useFieldArray({
    control,
    name: 'recommendations',
  });

  const {
    fields: monitoringFields,
    append: appendMonitoring,
    remove: removeMonitoring,
    update: updateMonitoringField,
  } = useFieldArray({
    control,
    name: 'monitoringPlan',
  });

  const {
    fields: goalFields,
    append: appendGoal,
    remove: removeGoal,
    update: updateGoalField,
  } = useFieldArray({
    control,
    name: 'goals',
  });

  const watchedProblems = watch('problems');
  const watchedRecommendations = watch('recommendations');
  const watchedMonitoring = watch('monitoringPlan');
  const watchedGoals = watch('goals');

  // Filter problems by severity for better organization
  const problemsBySeverity = useMemo(() => {
    const grouped = {
      critical: problems.filter((p) => p.severity === 'critical'),
      major: problems.filter((p) => p.severity === 'major'),
      moderate: problems.filter((p) => p.severity === 'moderate'),
      minor: problems.filter((p) => p.severity === 'minor'),
    };
    return grouped;
  }, [problems]);

  // Calculate plan completeness
  const planCompleteness = useMemo(() => {
    const totalSections = 6; // problems, recommendations, monitoring, counseling, goals, notes
    let completedSections = 0;

    if (watchedProblems.length > 0) completedSections++;
    if (watchedRecommendations.length > 0) completedSections++;
    if (watchedMonitoring.length > 0) completedSections++;
    if (getValues('counselingPoints').length > 0) completedSections++;
    if (watchedGoals.length > 0) completedSections++;
    if (getValues('pharmacistNotes').trim()) completedSections++;

    return (completedSections / totalSections) * 100;
  }, [
    watchedProblems,
    watchedRecommendations,
    watchedMonitoring,
    watchedGoals,
    getValues,
  ]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSavePlan = async (formData: PlanFormData) => {
    try {
      const planData: TherapyPlan = {
        ...formData,
      };

      setSaveError(null);
      if (existingPlan) {
        await updatePlan(planData);
        onPlanUpdated?.(planData);
      } else {
        await createPlan(planData);
        onPlanCreated(planData);
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save plan'
      );
    }
  };

  const handleAddRecommendation = (recommendation?: TherapyRecommendation) => {
    setSelectedRecommendation(recommendation || null);
    setIsRecommendationDialogOpen(true);
  };

  const handleSaveRecommendation = (recommendation: TherapyRecommendation) => {
    if (selectedRecommendation) {
      const index = recommendationFields.findIndex(
        (r) =>
          r.id ===
          selectedRecommendation.type + selectedRecommendation.medication
      );
      if (index >= 0) {
        updateRecommendationField(index, recommendation);
      }
    } else {
      appendRecommendation(recommendation);
    }
    setIsRecommendationDialogOpen(false);
    setSelectedRecommendation(null);
  };

  const handleAddMonitoring = (monitoring?: MonitoringParameter) => {
    setSelectedMonitoring(monitoring || null);
    setIsMonitoringDialogOpen(true);
  };

  const handleSaveMonitoring = (monitoring: MonitoringParameter) => {
    if (selectedMonitoring) {
      const index = monitoringFields.findIndex(
        (m) => m.parameter === selectedMonitoring.parameter
      );
      if (index >= 0) {
        updateMonitoringField(index, monitoring);
      }
    } else {
      appendMonitoring(monitoring);
    }
    setIsMonitoringDialogOpen(false);
    setSelectedMonitoring(null);
  };

  const handleAddGoal = (goal?: TherapyGoal) => {
    setSelectedGoal(goal || null);
    setIsGoalDialogOpen(true);
  };

  const handleSaveGoal = (goal: TherapyGoal) => {
    if (selectedGoal) {
      const index = goalFields.findIndex(
        (g) => g.description === selectedGoal.description
      );
      if (index >= 0) {
        updateGoalField(index, goal);
      }
    } else {
      appendGoal(goal);
    }
    setIsGoalDialogOpen(false);
    setSelectedGoal(null);
  };

  const addCounselingPoint = (point: string) => {
    const currentPoints = getValues('counselingPoints');
    if (!currentPoints.includes(point)) {
      setValue('counselingPoints', [...currentPoints, point], {
        shouldDirty: true,
      });
    }
  };

  const removeCounselingPoint = (index: number) => {
    const currentPoints = getValues('counselingPoints');
    setValue(
      'counselingPoints',
      currentPoints.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon />;
      case 'major':
        return <WarningIcon />;
      case 'moderate':
        return <InfoIcon />;
      case 'minor':
        return <CheckCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };

  if (problems.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <AssignmentIcon
            sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
          />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Problems Identified
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please complete the therapy assessment step to identify problems
            before developing a plan
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Plan Development
            </Typography>
            <Chip
              label={`${problems.length} problems`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 2 }}
            />
          </Box>
          <Stack direction="row" spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Plan Completeness: {Math.round(planCompleteness)}%
            </Typography>
            <Button
              variant="contained"
              startIcon={
                loading.savePlan ? <CircularProgress size={16} /> : <SaveIcon />
              }
              onClick={handleSubmit(handleSavePlan)}
              disabled={loading.savePlan || !isDirty}
            >
              {existingPlan ? 'Update Plan' : 'Save Plan'}
            </Button>
          </Stack>
        </Box>

        {/* Error Alert */}
        {saveError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveError}
          </Alert>
        )}

        {/* Main Content */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="plan development tabs"
            >
              <Tab label="Problems & Recommendations" />
              <Tab label="Monitoring Plan" />
              <Tab label="Goals & Counseling" />
              <Tab label="Summary & Notes" />
            </Tabs>
          </Box>

          {/* Tab 1: Problems & Recommendations */}
          <TabPanel value={activeTab} index={0}>
            <FixedGrid container spacing={3}>
              {/* Problems Selection */}
              <FixedGrid item xs={12} md={6}>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                >
                  <FlagIcon sx={{ mr: 1 }} />
                  Identified Problems
                </Typography>

                <Controller
                  name="problems"
                  control={control}
                  render={({ field }) => (
                    <Stack spacing={2}>
                      {Object.entries(problemsBySeverity).map(
                        ([severity, severityProblems]) =>
                          severityProblems.length > 0 && (
                            <Box key={severity}>
                              <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, textTransform: 'capitalize' }}
                              >
                                {severity} Problems ({severityProblems.length})
                              </Typography>
                              {severityProblems.map((problem) => (
                                <FormControlLabel
                                  key={problem._id}
                                  control={
                                    <Checkbox
                                      checked={field.value.includes(
                                        problem._id
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          field.onChange([
                                            ...field.value,
                                            problem._id,
                                          ]);
                                        } else {
                                          field.onChange(
                                            field.value.filter(
                                              (id) => id !== problem._id
                                            )
                                          );
                                        }
                                      }}
                                    />
                                  }
                                  label={
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      {getSeverityIcon(problem.severity)}
                                      <Box sx={{ ml: 1 }}>
                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 500 }}
                                        >
                                          {problem.description}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {problem.clinicalSignificance}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  }
                                />
                              ))}
                            </Box>
                          )
                      )}
                    </Stack>
                  )}
                />
              </FixedGrid>

              {/* Recommendations */}
              <FixedGrid item xs={12} md={6}>
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
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    <LightbulbIcon sx={{ mr: 1 }} />
                    Recommendations
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddRecommendation()}
                  >
                    Add Recommendation
                  </Button>
                </Box>

                <Stack spacing={2}>
                  {recommendationFields.map((recommendation, index) => (
                    <Card key={recommendation.id} variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {
                              RECOMMENDATION_TYPES.find(
                                (t) => t.value === recommendation.type
                              )?.icon
                            }
                            <Typography
                              variant="subtitle2"
                              sx={{ ml: 1, fontWeight: 600 }}
                            >
                              {
                                RECOMMENDATION_TYPES.find(
                                  (t) => t.value === recommendation.type
                                )?.label
                              }
                            </Typography>
                            <Chip
                              label={recommendation.priority}
                              size="small"
                              color={
                                (PRIORITY_LEVELS.find(
                                  (p) => p.value === recommendation.priority
                                )?.color as
                                  | 'primary'
                                  | 'secondary'
                                  | 'success'
                                  | 'info'
                                  | 'default'
                                  | 'error'
                                  | 'warning') || 'default'
                              }
                              sx={{ ml: 1 }}
                            />
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleAddRecommendation(recommendation)
                              }
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => removeRecommendation(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </Box>
                        {recommendation.medication && (
                          <Typography
                            variant="body2"
                            color="primary"
                            sx={{ mb: 1 }}
                          >
                            Medication: {recommendation.medication}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {recommendation.rationale}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Expected Outcome: {recommendation.expectedOutcome}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}

                  {recommendationFields.length === 0 && (
                    <Paper
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        No recommendations added yet. Click "Add Recommendation"
                        to get started.
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              </FixedGrid>
            </FixedGrid>
          </TabPanel>

          {/* Tab 2: Monitoring Plan */}
          <TabPanel value={activeTab} index={1}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <MonitorHeartIcon sx={{ mr: 1 }} />
                Monitoring Parameters
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleAddMonitoring()}
              >
                Add Parameter
              </Button>
            </Box>

            <FixedGrid container spacing={2}>
              {monitoringFields.map((monitoring, index) => (
                <FixedGrid item xs={12} md={6} key={monitoring.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {monitoring.parameter}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="small"
                            onClick={() => handleAddMonitoring(monitoring)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => removeMonitoring(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Frequency: {monitoring.frequency}
                      </Typography>
                      {monitoring.targetValue && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          Target: {monitoring.targetValue}
                        </Typography>
                      )}
                      {monitoring.notes && (
                        <Typography variant="body2">
                          {monitoring.notes}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </FixedGrid>
              ))}

              {monitoringFields.length === 0 && (
                <FixedGrid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary">
                      No monitoring parameters defined. Add parameters to track
                      therapy effectiveness and safety.
                    </Typography>
                  </Paper>
                </FixedGrid>
              )}
            </FixedGrid>
          </TabPanel>

          {/* Tab 3: Goals & Counseling */}
          <TabPanel value={activeTab} index={2}>
            <FixedGrid container spacing={3}>
              {/* Therapy Goals */}
              <FixedGrid item xs={12} md={6}>
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
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    <FlagIcon sx={{ mr: 1 }} />
                    Therapy Goals
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddGoal()}
                  >
                    Add Goal
                  </Button>
                </Box>

                <Stack spacing={2}>
                  {goalFields.map((goal, index) => (
                    <Card key={goal.id} variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, flex: 1 }}
                          >
                            {goal.description}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <IconButton
                              size="small"
                              onClick={() => handleAddGoal(goal)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => removeGoal(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </Box>
                        {goal.targetDate && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                          >
                            Target Date:{' '}
                            {new Date(goal.targetDate).toLocaleDateString()}
                          </Typography>
                        )}
                        <Chip
                          label={goal.achieved ? 'Achieved' : 'In Progress'}
                          size="small"
                          color={goal.achieved ? 'success' : 'default'}
                          variant={goal.achieved ? 'filled' : 'outlined'}
                        />
                      </CardContent>
                    </Card>
                  ))}

                  {goalFields.length === 0 && (
                    <Paper
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        No therapy goals set. Define measurable goals to track
                        treatment success.
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              </FixedGrid>

              {/* Counseling Points */}
              <FixedGrid item xs={12} md={6}>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                >
                  <PsychologyIcon sx={{ mr: 1 }} />
                  Patient Counseling Points
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Quick Add Templates:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {COUNSELING_TEMPLATES.map((template) => (
                      <Chip
                        key={template}
                        label={template}
                        size="small"
                        variant="outlined"
                        onClick={() => addCounselingPoint(template)}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>

                <Controller
                  name="counselingPoints"
                  control={control}
                  render={({ field }) => (
                    <Stack spacing={1}>
                      {field.value.map((point, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: 1,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {point}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => removeCounselingPoint(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}

                      <TextField
                        placeholder="Add custom counseling point..."
                        size="small"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            if (target.value.trim()) {
                              addCounselingPoint(target.value.trim());
                              target.value = '';
                            }
                          }
                        }}
                      />
                    </Stack>
                  )}
                />
              </FixedGrid>
            </FixedGrid>
          </TabPanel>

          {/* Tab 4: Summary & Notes */}
          <TabPanel value={activeTab} index={3}>
            <FixedGrid container spacing={3}>
              <FixedGrid item xs={12} md={8}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Pharmacist Notes
                </Typography>
                <Controller
                  name="pharmacistNotes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      multiline
                      rows={8}
                      fullWidth
                      placeholder="Enter detailed pharmacist notes, clinical reasoning, and additional considerations..."
                      variant="outlined"
                    />
                  )}
                />

                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Implementation Timeline
                  </Typography>
                  <Controller
                    name="timeline"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        multiline
                        rows={4}
                        fullWidth
                        placeholder="Describe the timeline for implementing recommendations..."
                        variant="outlined"
                      />
                    )}
                  />
                </Box>
              </FixedGrid>

              <FixedGrid item xs={12} md={4}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Plan Summary
                </Typography>

                <Stack spacing={2}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Problems Addressed
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {watchedProblems.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        of {problems.length} identified
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Recommendations
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {watchedRecommendations.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        therapeutic interventions
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Monitoring Parameters
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {watchedMonitoring.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        safety & efficacy checks
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Therapy Goals
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {watchedGoals.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        measurable outcomes
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>
              </FixedGrid>
            </FixedGrid>
          </TabPanel>
        </Card>

        {/* Recommendation Dialog */}
        <RecommendationDialog
          open={isRecommendationDialogOpen}
          onClose={() => setIsRecommendationDialogOpen(false)}
          onSave={handleSaveRecommendation}
          recommendation={selectedRecommendation}
        />

        {/* Monitoring Dialog */}
        <MonitoringDialog
          open={isMonitoringDialogOpen}
          onClose={() => setIsMonitoringDialogOpen(false)}
          onSave={handleSaveMonitoring}
          monitoring={selectedMonitoring}
        />

        {/* Goal Dialog */}
        <GoalDialog
          open={isGoalDialogOpen}
          onClose={() => setIsGoalDialogOpen(false)}
          onSave={handleSaveGoal}
          goal={selectedGoal}
        />
      </Box>
    </LocalizationProvider>
  );
};

// Recommendation Dialog Component
interface RecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (recommendation: TherapyRecommendation) => void;
  recommendation?: TherapyRecommendation | null;
}

const RecommendationDialog: React.FC<RecommendationDialogProps> = ({
  open,
  onClose,
  onSave,
  recommendation,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TherapyRecommendation>({
    defaultValues: recommendation || {
      type: 'monitor',
      priority: 'medium',
      medication: '',
      rationale: '',
      expectedOutcome: '',
    },
  });

  const watchedType = watch('type');

  useEffect(() => {
    if (recommendation) {
      reset(recommendation);
    } else {
      reset({
        type: 'monitor',
        priority: 'medium',
        medication: '',
        rationale: '',
        expectedOutcome: '',
      });
    }
  }, [recommendation, reset]);

  const handleSave = (data: TherapyRecommendation) => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {recommendation ? 'Edit Recommendation' : 'Add Recommendation'}
      </DialogTitle>
      <DialogContent>
        <FixedGrid container spacing={2} sx={{ mt: 1 }}>
          <FixedGrid item xs={12} md={6}>
            <Controller
              name="type"
              control={control}
              rules={{ required: 'Recommendation type is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.type}>
                  <InputLabel>Recommendation Type</InputLabel>
                  <Select {...field} label="Recommendation Type">
                    {RECOMMENDATION_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {type.icon}
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body2">
                              {type.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {type.description}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12} md={6}>
            <Controller
              name="priority"
              control={control}
              rules={{ required: 'Priority is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.priority}>
                  <InputLabel>Priority</InputLabel>
                  <Select {...field} label="Priority">
                    {PRIORITY_LEVELS.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        <Chip
                          label={priority.label}
                          size="small"
                          color={
                            priority.color as
                              | 'primary'
                              | 'secondary'
                              | 'success'
                              | 'info'
                              | 'default'
                              | 'error'
                              | 'warning'
                          }
                          sx={{ mr: 1 }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="medication"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Medication (if applicable)"
                  placeholder="Enter medication name..."
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="rationale"
              control={control}
              rules={{ required: 'Rationale is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Rationale"
                  placeholder="Explain the clinical reasoning for this recommendation..."
                  error={!!errors.rationale}
                  helperText={errors.rationale?.message}
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Quick Templates:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {RECOMMENDATION_TEMPLATES[
                watchedType as keyof typeof RECOMMENDATION_TEMPLATES
              ]?.map((template) => (
                <Chip
                  key={template}
                  label={template}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const currentRationale = watch('rationale');
                    if (!currentRationale.includes(template)) {
                      reset({
                        ...watch(),
                        rationale: currentRationale
                          ? `${currentRationale}. ${template}`
                          : template,
                      });
                    }
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="expectedOutcome"
              control={control}
              rules={{ required: 'Expected outcome is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={2}
                  label="Expected Outcome"
                  placeholder="Describe the expected clinical outcome..."
                  error={!!errors.expectedOutcome}
                  helperText={errors.expectedOutcome?.message}
                />
              )}
            />
          </FixedGrid>
        </FixedGrid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(handleSave)}>
          Save Recommendation
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Monitoring Dialog Component
interface MonitoringDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (monitoring: MonitoringParameter) => void;
  monitoring?: MonitoringParameter | null;
}

const MonitoringDialog: React.FC<MonitoringDialogProps> = ({
  open,
  onClose,
  onSave,
  monitoring,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MonitoringParameter>({
    defaultValues: monitoring || {
      parameter: '',
      frequency: '',
      targetValue: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (monitoring) {
      reset(monitoring);
    } else {
      reset({
        parameter: '',
        frequency: '',
        targetValue: '',
        notes: '',
      });
    }
  }, [monitoring, reset]);

  const handleSave = (data: MonitoringParameter) => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {monitoring ? 'Edit Monitoring Parameter' : 'Add Monitoring Parameter'}
      </DialogTitle>
      <DialogContent>
        <FixedGrid container spacing={2} sx={{ mt: 1 }}>
          <FixedGrid item xs={12}>
            <Controller
              name="parameter"
              control={control}
              rules={{ required: 'Parameter is required' }}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  options={MONITORING_PARAMETERS}
                  freeSolo
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Monitoring Parameter"
                      error={!!errors.parameter}
                      helperText={errors.parameter?.message}
                    />
                  )}
                  onChange={(_, value) => field.onChange(value || '')}
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="frequency"
              control={control}
              rules={{ required: 'Frequency is required' }}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  options={MONITORING_FREQUENCIES}
                  freeSolo
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Monitoring Frequency"
                      error={!!errors.frequency}
                      helperText={errors.frequency?.message}
                    />
                  )}
                  onChange={(_, value) => field.onChange(value || '')}
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="targetValue"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Target Value (optional)"
                  placeholder="e.g., <140/90 mmHg, 7-9 mg/dL"
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes (optional)"
                  placeholder="Additional monitoring instructions or considerations..."
                />
              )}
            />
          </FixedGrid>
        </FixedGrid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(handleSave)}>
          Save Parameter
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Goal Dialog Component
interface GoalDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (goal: TherapyGoal) => void;
  goal?: TherapyGoal | null;
}

const GoalDialog: React.FC<GoalDialogProps> = ({
  open,
  onClose,
  onSave,
  goal,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TherapyGoal>({
    defaultValues: goal || {
      description: '',
      targetDate: undefined,
      achieved: false,
      achievedDate: undefined,
    },
  });

  useEffect(() => {
    if (goal) {
      reset({
        ...goal,
        targetDate: goal.targetDate ? goal.targetDate.toString() : undefined,
        achievedDate: goal.achievedDate
          ? goal.achievedDate.toString()
          : undefined,
      });
    } else {
      reset({
        description: '',
        targetDate: undefined,
        achieved: false,
        achievedDate: undefined,
      });
    }
  }, [goal, reset]);

  const handleSave = (data: TherapyGoal) => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {goal ? 'Edit Therapy Goal' : 'Add Therapy Goal'}
      </DialogTitle>
      <DialogContent>
        <FixedGrid container spacing={2} sx={{ mt: 1 }}>
          <FixedGrid item xs={12}>
            <Controller
              name="description"
              control={control}
              rules={{ required: 'Goal description is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Goal Description"
                  placeholder="Describe the specific, measurable therapy goal..."
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12} md={6}>
            <Controller
              name="targetDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Target Date (optional)"
                  value={field.value ? new Date(field.value) : null}
                  onChange={(date) =>
                    field.onChange(date?.toISOString().split('T')[0])
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12} md={6}>
            <Controller
              name="achieved"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Goal Achieved"
                />
              )}
            />
          </FixedGrid>

          <FixedGrid item xs={12}>
            <Controller
              name="achievedDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Achievement Date (if achieved)"
                  value={field.value ? new Date(field.value) : null}
                  onChange={(date) =>
                    field.onChange(date?.toISOString().split('T')[0])
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              )}
            />
          </FixedGrid>
        </FixedGrid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(handleSave)}>
          Save Goal
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlanDevelopment;
