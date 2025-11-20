import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepConnector,
  LinearProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Badge,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  ExpandMore as ExpandMoreIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Flag as FlagIcon,
  Category as CategoryIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Group as GroupIcon,
  Notes as NotesIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import {
  useClinicalIntervention,
  useUpdateIntervention,
  useDeleteIntervention,
} from '../queries/useClinicalInterventions';
import { useClinicalInterventionStore } from '../stores/clinicalInterventionStore';
import type {
  ClinicalIntervention,
  InterventionStrategy,
  TeamAssignment,
  InterventionOutcome,
} from '../stores/clinicalInterventionStore';

// ===============================
// STYLED COMPONENTS
// ===============================

const StyledStepConnector = styled(StepConnector)(({ theme }) => ({
  '&.Mui-active': {
    '& .MuiStepConnector-line': {
      borderColor: theme.palette.primary.main,
    },
  },
  '&.Mui-completed': {
    '& .MuiStepConnector-line': {
      borderColor: theme.palette.success.main,
    },
  },
}));

// ===============================
// TYPES AND INTERFACES
// ===============================

interface InterventionDetailsProps {
  interventionId?: string;
  intervention?: ClinicalIntervention;
  open: boolean;
  onClose: () => void;
  onEdit?: (intervention: ClinicalIntervention) => void;
  onDelete?: (intervention: ClinicalIntervention) => void;
  mode?: 'modal' | 'page';
}

// ===============================
// CONSTANTS
// ===============================

const INTERVENTION_CATEGORIES = {
  drug_therapy_problem: {
    label: 'Drug Therapy Problem',
    color: '#f44336',
    icon: '💊',
  },
  adverse_drug_reaction: {
    label: 'Adverse Drug Reaction',
    color: '#ff9800',
    icon: '⚠️',
  },
  medication_nonadherence: {
    label: 'Medication Non-adherence',
    color: '#2196f3',
    icon: '📋',
  },
  drug_interaction: { label: 'Drug Interaction', color: '#9c27b0', icon: '🔄' },
  dosing_issue: { label: 'Dosing Issue', color: '#4caf50', icon: '⚖️' },
  contraindication: { label: 'Contraindication', color: '#e91e63', icon: '🚫' },
  other: { label: 'Other', color: '#607d8b', icon: '📝' },
} as const;

const PRIORITY_LEVELS = {
  low: { label: 'Low', color: '#4caf50', icon: '🟢' },
  medium: { label: 'Medium', color: '#ff9800', icon: '🟡' },
  high: { label: 'High', color: '#f44336', icon: '🔴' },
  critical: { label: 'Critical', color: '#d32f2f', icon: '🚨' },
} as const;

const STATUS_LABELS = {
  identified: { label: 'Identified', color: '#2196f3', step: 0 },
  planning: { label: 'Planning', color: '#ff9800', step: 1 },
  in_progress: { label: 'In Progress', color: '#9c27b0', step: 2 },
  implemented: { label: 'Implemented', color: '#4caf50', step: 3 },
  completed: { label: 'Completed', color: '#388e3c', step: 4 },
  cancelled: { label: 'Cancelled', color: '#757575', step: -1 },
} as const;

const WORKFLOW_STEPS = [
  { label: 'Issue Identified', description: 'Clinical issue documented' },
  {
    label: 'Strategy Planning',
    description: 'Intervention strategies defined',
  },
  { label: 'Implementation', description: 'Intervention being executed' },
  { label: 'Monitoring', description: 'Tracking patient response' },
  { label: 'Completed', description: 'Intervention successfully completed' },
];

// ===============================
// MAIN COMPONENT
// ===============================

const InterventionDetails: React.FC<InterventionDetailsProps> = ({
  interventionId,
  intervention: propIntervention,
  open,
  onClose,
  onEdit,
  onDelete,
  mode = 'modal',
}) => {
  // State
  const [activeAccordion, setActiveAccordion] = useState<string | false>(
    'overview'
  );
  const [editMode, setEditMode] = useState(false);

  // Store
  const { selectedIntervention, setShowDetailsModal } =
    useClinicalInterventionStore();

  // Determine which intervention to use
  const targetInterventionId =
    interventionId || propIntervention?._id || selectedIntervention?._id;
  const targetIntervention = propIntervention || selectedIntervention;

  // Queries
  const {
    data: interventionResponse,
    isLoading,
    error,
  } = useClinicalIntervention(targetInterventionId || '', {
    enabled: !!targetInterventionId && !targetIntervention,
  });

  const updateMutation = useUpdateIntervention();
  const deleteMutation = useDeleteIntervention();

  // Get intervention data
  const intervention = targetIntervention || interventionResponse?.data;

  // ===============================
  // HANDLERS
  // ===============================

  const handleClose = () => {
    if (mode === 'modal') {
      setShowDetailsModal(false);
    }
    onClose();
  };

  const handleEdit = () => {
    if (intervention) {
      onEdit?.(intervention);
      setEditMode(true);
    }
  };

  const handleDelete = async () => {
    if (!intervention) return;

    if (
      window.confirm(
        `Are you sure you want to delete intervention ${intervention.interventionNumber}?`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(intervention._id);
        onDelete?.(intervention);
        handleClose();
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const handleAccordionChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setActiveAccordion(isExpanded ? panel : false);
    };

  // ===============================
  // RENDER HELPERS
  // ===============================

  const renderHeader = () => {
    if (!intervention) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {intervention.interventionNumber}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Chip
                label={INTERVENTION_CATEGORIES[intervention.category]?.label}
                sx={{
                  bgcolor:
                    INTERVENTION_CATEGORIES[intervention.category]?.color +
                    '20',
                  color: INTERVENTION_CATEGORIES[intervention.category]?.color,
                  fontWeight: 'medium',
                }}
              />
              <Chip
                label={PRIORITY_LEVELS[intervention.priority]?.label}
                sx={{
                  bgcolor: PRIORITY_LEVELS[intervention.priority]?.color + '20',
                  color: PRIORITY_LEVELS[intervention.priority]?.color,
                  fontWeight: 'medium',
                }}
              />
              <Chip
                label={STATUS_LABELS[intervention.status]?.label}
                sx={{
                  bgcolor: STATUS_LABELS[intervention.status]?.color + '20',
                  color: STATUS_LABELS[intervention.status]?.color,
                  fontWeight: 'medium',
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Created on {new Date(intervention.createdAt).toLocaleDateString()}{' '}
              by {intervention.identifiedByUser?.firstName}{' '}
              {intervention.identifiedByUser?.lastName}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Delete
            </Button>
            {mode === 'modal' && (
              <IconButton onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Progress Indicator */}
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Intervention Progress
          </Typography>
          <Stepper
            activeStep={STATUS_LABELS[intervention.status]?.step || 0}
            connector={<StyledStepConnector />}
          >
            {WORKFLOW_STEPS.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>
                  <Typography variant="body2" fontWeight="medium">
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      </Box>
    );
  };

  const renderPatientInfo = () => {
    if (!intervention?.patient) return null;

    const patient = intervention.patient;

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <PersonIcon color="primary" />
            Patient Information
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                {patient.firstName} {patient.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {patient.phoneNumber || 'No phone number'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {patient.email || 'No email address'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderIssueDescription = () => {
    if (!intervention) return null;

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <NotesIcon color="primary" />
            Clinical Issue Description
          </Typography>

          <Typography
            variant="body1"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
          >
            {intervention.issueDescription}
          </Typography>

          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Identified:{' '}
                {new Date(intervention.identifiedDate).toLocaleDateString()}
              </Typography>
            </Box>
            {intervention.estimatedDuration && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Est. Duration: {intervention.estimatedDuration} minutes
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderStrategies = () => {
    if (!intervention?.strategies || intervention.strategies.length === 0) {
      return (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AssessmentIcon color="primary" />
              Intervention Strategies
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No strategies defined yet.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AssessmentIcon color="primary" />
            Intervention Strategies ({intervention.strategies.length})
          </Typography>

          <Stack spacing={2}>
            {intervention.strategies.map((strategy, index) => (
              <Paper
                key={strategy._id || index}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="medium">
                    Strategy {index + 1}:{' '}
                    {strategy.type
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Typography>
                  <Chip
                    label={strategy.priority}
                    size="small"
                    color={
                      strategy.priority === 'primary' ? 'primary' : 'default'
                    }
                  />
                </Box>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Description:</strong> {strategy.description}
                </Typography>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Rationale:</strong> {strategy.rationale}
                </Typography>

                <Typography variant="body2">
                  <strong>Expected Outcome:</strong> {strategy.expectedOutcome}
                </Typography>

                {strategy.status && (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={strategy.status
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                      size="small"
                      color={
                        strategy.status === 'completed' ? 'success' : 'default'
                      }
                    />
                  </Box>
                )}
              </Paper>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  const renderTeamAssignments = () => {
    if (!intervention?.assignments || intervention.assignments.length === 0) {
      return (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <GroupIcon color="primary" />
              Team Assignments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No team members assigned yet.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <GroupIcon color="primary" />
            Team Assignments ({intervention.assignments.length})
          </Typography>

          <List>
            {intervention.assignments.map((assignment, index) => (
              <ListItem
                key={assignment._id || index}
                divider={index < intervention.assignments.length - 1}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {assignment.user?.firstName} {assignment.user?.lastName}
                      </Typography>
                      <Chip
                        label={assignment.role}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Task: {assignment.task}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Assigned:{' '}
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                        {assignment.completedAt && (
                          <>
                            {' '}
                            • Completed:{' '}
                            {new Date(
                              assignment.completedAt
                            ).toLocaleDateString()}
                          </>
                        )}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={assignment.status
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                    size="small"
                    color={
                      assignment.status === 'completed' ? 'success' : 'default'
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  };

  const renderOutcomes = () => {
    if (!intervention?.outcomes) {
      return (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <TrendingUpIcon color="primary" />
              Intervention Outcomes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No outcomes recorded yet.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    const outcomes = intervention.outcomes;

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <TrendingUpIcon color="primary" />
            Intervention Outcomes
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Patient Response
              </Typography>
              <Chip
                label={outcomes.patientResponse
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                color={
                  outcomes.patientResponse === 'improved'
                    ? 'success'
                    : 'default'
                }
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" gutterBottom>
                Success Metrics
              </Typography>
              <Stack spacing={1}>
                {Object.entries(outcomes.successMetrics).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    {typeof value === 'boolean' ? (
                      value ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <RadioButtonUncheckedIcon
                          color="disabled"
                          fontSize="small"
                        />
                      )
                    ) : null}
                    <Typography variant="body2">
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())}
                      {typeof value === 'number' && `: ${value}`}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              {outcomes.clinicalParameters &&
                outcomes.clinicalParameters.length > 0 && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Clinical Parameters
                    </Typography>
                    <Stack spacing={1}>
                      {outcomes.clinicalParameters.map((param, index) => (
                        <Paper key={index} sx={{ p: 1, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {param.parameter}
                          </Typography>
                          {param.beforeValue && param.afterValue && (
                            <Typography variant="body2" color="text.secondary">
                              {param.beforeValue} → {param.afterValue}{' '}
                              {param.unit}
                              {param.improvementPercentage && (
                                <Chip
                                  label={`${
                                    param.improvementPercentage > 0 ? '+' : ''
                                  }${param.improvementPercentage}%`}
                                  size="small"
                                  color={
                                    param.improvementPercentage > 0
                                      ? 'success'
                                      : 'error'
                                  }
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  </>
                )}
            </Grid>

            {(outcomes.adverseEffects || outcomes.additionalIssues) && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                {outcomes.adverseEffects && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Adverse Effects
                    </Typography>
                    <Typography variant="body2">
                      {outcomes.adverseEffects}
                    </Typography>
                  </Box>
                )}
                {outcomes.additionalIssues && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Additional Issues
                    </Typography>
                    <Typography variant="body2">
                      {outcomes.additionalIssues}
                    </Typography>
                  </Box>
                )}
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderFollowUp = () => {
    if (!intervention?.followUp) return null;

    const followUp = intervention.followUp;

    return (
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <ScheduleIcon color="primary" />
            Follow-up Information
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Follow-up Required: {followUp.required ? 'Yes' : 'No'}
              </Typography>
            </Grid>
            {followUp.scheduledDate && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Scheduled:{' '}
                  {new Date(followUp.scheduledDate).toLocaleDateString()}
                </Typography>
              </Grid>
            )}
            {followUp.completedDate && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Completed:{' '}
                  {new Date(followUp.completedDate).toLocaleDateString()}
                </Typography>
              </Grid>
            )}
            {followUp.nextReviewDate && (
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Next Review:{' '}
                  {new Date(followUp.nextReviewDate).toLocaleDateString()}
                </Typography>
              </Grid>
            )}
            {followUp.notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Notes
                </Typography>
                <Typography variant="body2">{followUp.notes}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="rectangular" height={150} />
          <Skeleton variant="rectangular" height={150} />
        </Stack>
      );
    }

    if (error || !intervention) {
      return (
        <Alert severity="error">
          Failed to load intervention details. Please try again.
        </Alert>
      );
    }

    return (
      <Stack spacing={3}>
        {/* Header */}
        {renderHeader()}

        {/* Accordion Sections */}
        <Box>
          <Accordion
            expanded={activeAccordion === 'overview'}
            onChange={handleAccordionChange('overview')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {renderPatientInfo()}
                {renderIssueDescription()}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion
            expanded={activeAccordion === 'strategies'}
            onChange={handleAccordionChange('strategies')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Strategies</Typography>
            </AccordionSummary>
            <AccordionDetails>{renderStrategies()}</AccordionDetails>
          </Accordion>

          <Accordion
            expanded={activeAccordion === 'team'}
            onChange={handleAccordionChange('team')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Team Collaboration</Typography>
            </AccordionSummary>
            <AccordionDetails>{renderTeamAssignments()}</AccordionDetails>
          </Accordion>

          <Accordion
            expanded={activeAccordion === 'outcomes'}
            onChange={handleAccordionChange('outcomes')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Outcomes</Typography>
            </AccordionSummary>
            <AccordionDetails>{renderOutcomes()}</AccordionDetails>
          </Accordion>

          <Accordion
            expanded={activeAccordion === 'followup'}
            onChange={handleAccordionChange('followup')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Follow-up</Typography>
            </AccordionSummary>
            <AccordionDetails>{renderFollowUp()}</AccordionDetails>
          </Accordion>
        </Box>
      </Stack>
    );
  };

  // ===============================
  // MAIN RENDER
  // ===============================

  if (mode === 'page') {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>{renderContent()}</Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh', maxHeight: '90vh' },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>{renderContent()}</Box>
      </DialogContent>
    </Dialog>
  );
};

export default InterventionDetails;
