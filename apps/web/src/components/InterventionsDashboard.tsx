import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
// Grid component removed - using Box with flexbox instead
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InfoIcon from '@mui/icons-material/Info';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import { format, formatDistanceToNow, isAfter } from 'date-fns';
import { useMTRStore } from '../stores/mtrStore';
import {
  MTRIntervention,
  CreateInterventionData,
  UpdateInterventionData,
} from '../types/mtr';
// Grid component removed - using Box with flexbox instead

// Communication templates for common interventions
const COMMUNICATION_TEMPLATES = {
  medication_change: {
    patient:
      'Based on our medication review, I recommend adjusting your [medication] dosage to improve effectiveness and reduce side effects.',
    prescriber:
      'Following MTR assessment, I recommend [specific change] for [patient name] to optimize therapy outcomes.',
    caregiver:
      'Please note the following medication changes for [patient name] and monitor for [specific effects].',
  },
  adherence_support: {
    patient:
      "Let's discuss strategies to help you take your medications as prescribed. Consider using [specific tools/methods].",
    prescriber:
      'Patient would benefit from adherence support interventions including [specific recommendations].',
    caregiver:
      'Please assist [patient name] with medication adherence using these strategies: [specific methods].',
  },
  monitoring_plan: {
    patient:
      'We need to monitor [specific parameters] to ensure your medications are working safely and effectively.',
    prescriber:
      'Recommend monitoring [parameters] at [frequency] to assess therapy response and safety.',
    caregiver:
      'Please ensure [patient name] follows up for [monitoring requirements] as scheduled.',
  },
  patient_education: {
    patient:
      "Here's important information about your medications: [key points]. Please contact us if you have questions.",
    prescriber:
      'Patient has been educated on [topics]. Additional reinforcement may be beneficial.',
    caregiver:
      'Key medication education points for [patient name]: [educational content].',
  },
};

interface InterventionsDashboardProps {
  reviewId: string;
  onInterventionRecorded?: (intervention: MTRIntervention) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`interventions-tabpanel-${index}`}
      aria-labelledby={`interventions-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const InterventionsDashboard: React.FC<InterventionsDashboardProps> = ({
  reviewId,
  onInterventionRecorded,
}) => {
  const {
    interventions,
    currentReview,
    recordIntervention,
    updateIntervention,
    markInterventionComplete,
    loading,
    errors,
  } = useMTRStore();

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntervention, setEditingIntervention] =
    useState<MTRIntervention | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  // Form state for new/edit intervention
  const [formData, setFormData] = useState<Partial<CreateInterventionData>>({
    reviewId,
    patientId: currentReview?.patientId || '',
    type: 'recommendation',
    category: 'medication_change',
    description: '',
    rationale: '',
    targetAudience: 'patient',
    communicationMethod: 'verbal',
    documentation: '',
    priority: 'medium',
    urgency: 'routine',
    followUpRequired: false,
    followUpDate: '',
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setEditingIntervention(null);
      setFormData({
        reviewId,
        patientId: currentReview?.patientId || '',
        type: 'recommendation',
        category: 'medication_change',
        description: '',
        rationale: '',
        targetAudience: 'patient',
        communicationMethod: 'verbal',
        documentation: '',
        priority: 'medium',
        urgency: 'routine',
        followUpRequired: false,
        followUpDate: '',
      });
    }
  }, [isDialogOpen, reviewId, currentReview?.patientId]);

  // Load editing intervention data
  useEffect(() => {
    if (editingIntervention) {
      setFormData({
        reviewId: editingIntervention._id || reviewId,
        patientId: currentReview?.patientId || '',
        type: editingIntervention.type,
        category: editingIntervention.category,
        description: editingIntervention.description,
        rationale: editingIntervention.rationale,
        targetAudience: editingIntervention.targetAudience,
        communicationMethod: editingIntervention.communicationMethod,
        documentation: editingIntervention.documentation,
        priority: editingIntervention.priority,
        urgency: editingIntervention.urgency,
        followUpRequired: editingIntervention.followUpRequired,
        followUpDate: editingIntervention.followUpDate
          ? format(new Date(editingIntervention.followUpDate), 'yyyy-MM-dd')
          : '',
      });
    }
  }, [editingIntervention, reviewId, currentReview?.patientId]);

  // Filter interventions based on current filters
  const filteredInterventions = useMemo(() => {
    return interventions.filter((intervention) => {
      // Show completed filter
      if (!showCompleted && intervention.outcome !== 'pending') {
        return false;
      }

      // Type filter
      if (filterType !== 'all' && intervention.type !== filterType) {
        return false;
      }

      // Outcome filter
      if (filterOutcome !== 'all' && intervention.outcome !== filterOutcome) {
        return false;
      }

      return true;
    });
  }, [interventions, showCompleted, filterType, filterOutcome]);

  // Group interventions by status for progress visualization
  const interventionStats = useMemo(() => {
    const stats = {
      total: interventions.length,
      pending: 0,
      accepted: 0,
      rejected: 0,
      modified: 0,
      followUpRequired: 0,
      overdue: 0,
    };

    interventions.forEach((intervention) => {
      stats[intervention.outcome as keyof typeof stats]++;
      if (intervention.followUpRequired && !intervention.followUpCompleted) {
        stats.followUpRequired++;
      }
      if (
        intervention.followUpDate &&
        isAfter(new Date(), new Date(intervention.followUpDate))
      ) {
        stats.overdue++;
      }
    });

    return stats;
  }, [interventions]);

  // Handle form input changes
  const handleInputChange = (
    field: keyof CreateInterventionData,
    value: unknown
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-populate template when type/category/audience changes
    if (
      field === 'type' ||
      field === 'category' ||
      field === 'targetAudience'
    ) {
      const updatedData = { ...formData, [field]: value };
      const template =
        COMMUNICATION_TEMPLATES[
          updatedData.category as keyof typeof COMMUNICATION_TEMPLATES
        ]?.[
          updatedData.targetAudience as keyof typeof COMMUNICATION_TEMPLATES.medication_change
        ];
      if (template && !formData.description) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
          description: template,
        }));
      }
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      if (editingIntervention) {
        // Update existing intervention
        await updateIntervention(
          editingIntervention._id!,
          formData as UpdateInterventionData
        );
      } else {
        // Create new intervention
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await recordIntervention(formData as any);
        // Create a mock MTRIntervention for the callback
        const mockIntervention = {
          ...formData,
          _id: 'temp-id',
          workplaceId: 'temp-workplace',
          outcome: 'pending' as const,
          outcomeDetails: '',
          followUpDate: formData.followUpDate || new Date().toISOString(),
          followUpRequired: formData.followUpRequired || false,
          followUpCompleted: false,
          attachments: [],
          pharmacistId: 'current-pharmacist',
          performedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user',
          updatedBy: 'current-user',
          isDeleted: false,
        } as unknown as MTRIntervention;
        onInterventionRecorded?.(mockIntervention);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save intervention:', error);
    }
  };

  // Handle intervention completion
  const handleCompleteIntervention = async (
    interventionId: string,
    outcome: string,
    details?: string
  ) => {
    try {
      await markInterventionComplete(interventionId, outcome, details);
    } catch (error) {
      console.error('Failed to complete intervention:', error);
    }
  };

  // Get icon for intervention type
  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'recommendation':
        return <LocalHospitalIcon />;
      case 'counseling':
        return <PersonIcon />;
      case 'monitoring':
        return <AssessmentIcon />;
      case 'communication':
        return <PhoneIcon />;
      case 'education':
        return <DescriptionIcon />;
      default:
        return <InfoIcon />;
    }
  };

  // Get color for intervention outcome
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      case 'modified':
        return 'warning';
      case 'pending':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return 'error';
      case 'within_24h':
        return 'warning';
      case 'within_week':
        return 'info';
      case 'routine':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with stats and actions */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <TimelineIcon />
            Interventions Dashboard
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsDialogOpen(true)}
            disabled={loading.recordIntervention}
          >
            Record Intervention
          </Button>
        </Box>

        {/* Statistics Cards */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {interventionStats.total}
              </Typography>
              <Typography variant="body2">Total</Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {interventionStats.pending}
              </Typography>
              <Typography variant="body2">Pending</Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {interventionStats.accepted}
              </Typography>
              <Typography variant="body2">Accepted</Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {interventionStats.followUpRequired}
              </Typography>
              <Typography variant="body2">Follow-up</Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {interventionStats.overdue}
              </Typography>
              <Typography variant="body2">Overdue</Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="text.secondary">
                {interventionStats.total > 0
                  ? Math.round(
                      (interventionStats.accepted / interventionStats.total) *
                        100
                    )
                  : 0}
                %
              </Typography>
              <Typography variant="body2">Success Rate</Typography>
            </Paper>
          </Box>
        </Box>

        {/* Progress Bar */}
        {interventionStats.total > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Intervention Progress (
              {interventionStats.accepted + interventionStats.modified} of{' '}
              {interventionStats.total} completed)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={
                ((interventionStats.accepted + interventionStats.modified) /
                  interventionStats.total) *
                100
              }
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
      </Box>

      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
        >
          <Tab
            label={
              <Badge badgeContent={interventionStats.pending} color="primary">
                Timeline View
              </Badge>
            }
          />
          <Tab
            label={
              <Badge
                badgeContent={interventionStats.followUpRequired}
                color="warning"
              >
                Progress Tracking
              </Badge>
            }
          />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3 }}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterListIcon />
              Filters & Options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center',
              }}
            >
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filterType}
                    label="Type"
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="recommendation">Recommendation</MenuItem>
                    <MenuItem value="counseling">Counseling</MenuItem>
                    <MenuItem value="monitoring">Monitoring</MenuItem>
                    <MenuItem value="communication">Communication</MenuItem>
                    <MenuItem value="education">Education</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Outcome</InputLabel>
                  <Select
                    value={filterOutcome}
                    label="Outcome"
                    onChange={(e) => setFilterOutcome(e.target.value)}
                  >
                    <MenuItem value="all">All Outcomes</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="accepted">Accepted</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                    <MenuItem value="modified">Modified</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showCompleted}
                      onChange={(e) => setShowCompleted(e.target.checked)}
                    />
                  }
                  label="Show Completed"
                />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Error Display */}
      {errors.recordIntervention && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.recordIntervention}
        </Alert>
      )}

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {/* Timeline View */}
        {filteredInterventions.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <TimelineIcon
              sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary">
              No interventions recorded yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Start by recording your first intervention for this MTR session
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsDialogOpen(true)}
            >
              Record First Intervention
            </Button>
          </Paper>
        ) : (
          <Timeline>
            {filteredInterventions.map((intervention, index) => (
              <TimelineItem key={intervention._id}>
                <TimelineOppositeContent
                  sx={{ m: 'auto 0' }}
                  variant="body2"
                  color="text.secondary"
                >
                  {format(
                    new Date(intervention.performedAt),
                    'MMM dd, yyyy HH:mm'
                  )}
                  <br />
                  <Chip
                    size="small"
                    label={intervention.urgency}
                    color={
                      getUrgencyColor(intervention.urgency) as
                        | 'default'
                        | 'primary'
                        | 'secondary'
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warning'
                    }
                    sx={{ mt: 0.5 }}
                  />
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot
                    color={
                      getOutcomeColor(intervention.outcome) as
                        | 'inherit'
                        | 'primary'
                        | 'secondary'
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warning'
                    }
                  >
                    {getInterventionIcon(intervention.type)}
                  </TimelineDot>
                  {index < filteredInterventions.length - 1 && (
                    <TimelineConnector />
                  )}
                </TimelineSeparator>
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'between',
                          alignItems: 'flex-start',
                          mb: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="h6" component="div">
                            {intervention.type.charAt(0).toUpperCase() +
                              intervention.type.slice(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {intervention.category
                              .replace('_', ' ')
                              .toUpperCase()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Edit Intervention">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingIntervention(intervention);
                                setIsDialogOpen(true);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Chip
                            label={intervention.outcome}
                            color={
                              getOutcomeColor(intervention.outcome) as
                                | 'default'
                                | 'primary'
                                | 'secondary'
                                | 'error'
                                | 'info'
                                | 'success'
                                | 'warning'
                            }
                            size="small"
                          />
                        </Box>
                      </Box>

                      <Typography variant="body1" sx={{ mb: 1 }}>
                        {intervention.description}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        <strong>Rationale:</strong> {intervention.rationale}
                      </Typography>

                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1,
                          mb: 2,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Chip
                          size="small"
                          icon={<PersonIcon />}
                          label={intervention.targetAudience}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          icon={
                            intervention.communicationMethod === 'phone' ? (
                              <PhoneIcon />
                            ) : (
                              <EmailIcon />
                            )
                          }
                          label={intervention.communicationMethod}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Priority: ${intervention.priority}`}
                          color={
                            intervention.priority === 'high'
                              ? 'error'
                              : intervention.priority === 'medium'
                              ? 'warning'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      </Box>

                      {intervention.followUpRequired && (
                        <Alert
                          severity={
                            intervention.followUpCompleted
                              ? 'success'
                              : 'warning'
                          }
                          sx={{ mb: 1 }}
                        >
                          <Typography variant="body2">
                            Follow-up{' '}
                            {intervention.followUpCompleted
                              ? 'completed'
                              : 'required'}
                            {intervention.followUpDate &&
                              ` by ${format(
                                new Date(intervention.followUpDate),
                                'MMM dd, yyyy'
                              )}`}
                          </Typography>
                        </Alert>
                      )}

                      {intervention.outcome === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() =>
                              handleCompleteIntervention(
                                intervention._id!,
                                'accepted'
                              )
                            }
                          >
                            Mark Accepted
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() =>
                              handleCompleteIntervention(
                                intervention._id!,
                                'modified'
                              )
                            }
                          >
                            Mark Modified
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() =>
                              handleCompleteIntervention(
                                intervention._id!,
                                'rejected'
                              )
                            }
                          >
                            Mark Rejected
                          </Button>
                        </Box>
                      )}

                      {intervention.outcomeDetails && (
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            p: 1,
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                          }}
                        >
                          <strong>Outcome Details:</strong>{' '}
                          {intervention.outcomeDetails}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Progress Tracking View */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {/* Follow-up Required */}
          <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <ScheduleIcon />
                  Follow-up Required
                </Typography>
                {interventions
                  .filter((i) => i.followUpRequired && !i.followUpCompleted)
                  .map((intervention) => (
                    <Box
                      key={intervention._id}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="subtitle2">
                        {intervention.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Due:{' '}
                        {intervention.followUpDate
                          ? format(
                              new Date(intervention.followUpDate),
                              'MMM dd, yyyy'
                            )
                          : 'Not specified'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {intervention.followUpDate &&
                          formatDistanceToNow(
                            new Date(intervention.followUpDate),
                            { addSuffix: true }
                          )}
                      </Typography>
                    </Box>
                  ))}
              </CardContent>
            </Card>
          </Box>

          {/* Recent Activity */}
          <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <TrendingUpIcon />
                  Recent Activity
                </Typography>
                {interventions
                  .sort(
                    (a, b) =>
                      new Date(b.performedAt).getTime() -
                      new Date(a.performedAt).getTime()
                  )
                  .slice(0, 5)
                  .map((intervention) => (
                    <Box
                      key={intervention._id}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="subtitle2">
                        {intervention.type}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDistanceToNow(
                          new Date(intervention.performedAt),
                          { addSuffix: true }
                        )}
                      </Typography>
                      <Chip
                        size="small"
                        label={intervention.outcome}
                        color={
                          getOutcomeColor(intervention.outcome) as
                            | 'default'
                            | 'primary'
                            | 'secondary'
                            | 'error'
                            | 'info'
                            | 'success'
                            | 'warning'
                        }
                      />
                    </Box>
                  ))}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {/* Analytics View */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Intervention Types
                </Typography>
                {Object.entries(
                  interventions.reduce((acc, intervention) => {
                    acc[intervention.type] = (acc[intervention.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'between' }}>
                      <Typography variant="body2">{type}</Typography>
                      <Typography variant="body2">{count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(count / interventions.length) * 100}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: '1 1 400px', minWidth: '400px' }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Outcome Distribution
                </Typography>
                {Object.entries(
                  interventions.reduce((acc, intervention) => {
                    acc[intervention.outcome] =
                      (acc[intervention.outcome] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([outcome, count]) => (
                  <Box key={outcome} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'between' }}>
                      <Typography variant="body2">{outcome}</Typography>
                      <Typography variant="body2">{count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(count / interventions.length) * 100}
                      color={
                        getOutcomeColor(outcome) as
                          | 'inherit'
                          | 'primary'
                          | 'secondary'
                          | 'error'
                          | 'info'
                          | 'success'
                          | 'warning'
                      }
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </TabPanel>

      {/* Intervention Recording Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingIntervention
            ? 'Edit Intervention'
            : 'Record New Intervention'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => handleInputChange('type', e.target.value)}
                >
                  <MenuItem value="recommendation">Recommendation</MenuItem>
                  <MenuItem value="counseling">Counseling</MenuItem>
                  <MenuItem value="monitoring">Monitoring</MenuItem>
                  <MenuItem value="communication">Communication</MenuItem>
                  <MenuItem value="education">Education</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) =>
                    handleInputChange('category', e.target.value)
                  }
                >
                  <MenuItem value="medication_change">
                    Medication Change
                  </MenuItem>
                  <MenuItem value="adherence_support">
                    Adherence Support
                  </MenuItem>
                  <MenuItem value="monitoring_plan">Monitoring Plan</MenuItem>
                  <MenuItem value="patient_education">
                    Patient Education
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Target Audience</InputLabel>
                <Select
                  value={formData.targetAudience}
                  label="Target Audience"
                  onChange={(e) =>
                    handleInputChange('targetAudience', e.target.value)
                  }
                >
                  <MenuItem value="patient">Patient</MenuItem>
                  <MenuItem value="prescriber">Prescriber</MenuItem>
                  <MenuItem value="caregiver">Caregiver</MenuItem>
                  <MenuItem value="healthcare_team">Healthcare Team</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Communication Method</InputLabel>
                <Select
                  value={formData.communicationMethod}
                  label="Communication Method"
                  onChange={(e) =>
                    handleInputChange('communicationMethod', e.target.value)
                  }
                >
                  <MenuItem value="verbal">Verbal</MenuItem>
                  <MenuItem value="written">Written</MenuItem>
                  <MenuItem value="phone">Phone</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="fax">Fax</MenuItem>
                  <MenuItem value="in_person">In Person</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 100%', width: '100%' }}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                placeholder="Describe the intervention..."
              />
            </Box>

            <Box sx={{ flex: '1 1 100%', width: '100%' }}>
              <TextField
                fullWidth
                label="Rationale"
                multiline
                rows={2}
                value={formData.rationale}
                onChange={(e) => handleInputChange('rationale', e.target.value)}
                placeholder="Explain the clinical rationale..."
              />
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) =>
                    handleInputChange('priority', e.target.value)
                  }
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
              <FormControl fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={formData.urgency}
                  label="Urgency"
                  onChange={(e) => handleInputChange('urgency', e.target.value)}
                >
                  <MenuItem value="routine">Routine</MenuItem>
                  <MenuItem value="within_week">Within Week</MenuItem>
                  <MenuItem value="within_24h">Within 24h</MenuItem>
                  <MenuItem value="immediate">Immediate</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: '1 1 100%', width: '100%' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.followUpRequired}
                    onChange={(e) =>
                      handleInputChange('followUpRequired', e.target.checked)
                    }
                  />
                }
                label="Follow-up Required"
              />
            </Box>

            {formData.followUpRequired && (
              <Box sx={{ flex: '1 1 250px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Follow-up Date"
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) =>
                    handleInputChange('followUpDate', e.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}

            <Box sx={{ flex: '1 1 100%', width: '100%' }}>
              <TextField
                fullWidth
                label="Documentation"
                multiline
                rows={3}
                value={formData.documentation}
                onChange={(e) =>
                  handleInputChange('documentation', e.target.value)
                }
                placeholder="Additional documentation and notes..."
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              !formData.description ||
              !formData.rationale ||
              loading.recordIntervention
            }
          >
            {editingIntervention ? 'Update' : 'Record'} Intervention
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InterventionsDashboard;
