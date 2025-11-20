import React, { useState } from 'react';
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
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  LinearProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import PhoneIcon from '@mui/icons-material/Phone';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScienceIcon from '@mui/icons-material/Science';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { useMTRStore } from '../stores/mtrStore';
import { useUIStore } from '../stores';
import type { MTRFollowUp, MTRIntervention } from '../types/mtr';

interface FollowUpSchedulerProps {
  reviewId: string;
  interventions: MTRIntervention[];
  onFollowUpScheduled?: (followUp: MTRFollowUp) => void;
  onFollowUpUpdated?: (
    followUpId: string,
    updates: Partial<MTRFollowUp>
  ) => void;
  onFollowUpCompleted?: (
    followUpId: string,
    outcome: Record<string, unknown>
  ) => void;
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
      id={`followup-tabpanel-${index}`}
      aria-labelledby={`followup-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const FollowUpScheduler: React.FC<FollowUpSchedulerProps> = ({
  reviewId,
  interventions,
  onFollowUpScheduled,
  onFollowUpUpdated,
  onFollowUpCompleted,
}) => {
  const {
    followUps,
    scheduleFollowUp,
    updateFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    loading,
    errors,
  } = useMTRStore();

  // Available interventions for linking to follow-ups (for future use)
  const availableInterventions = interventions || [];

  const { addNotification } = useUIStore();

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<MTRFollowUp | null>(
    null
  );
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<MTRFollowUp | null>(
    null
  );
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  // Form state for new/edit follow-up
  const [formData, setFormData] = useState<Partial<MTRFollowUp>>({
    type: 'phone_call',
    priority: 'medium',
    description: '',
    objectives: [],
    scheduledDate: new Date().toISOString(),
    estimatedDuration: 30,
    assignedTo: '',
    status: 'scheduled',
    relatedInterventions: [],
  });

  // Outcome form state
  const [outcomeData, setOutcomeData] = useState({
    status: 'successful' as
      | 'successful'
      | 'partially_successful'
      | 'unsuccessful',
    notes: '',
    nextActions: [] as string[],
    nextFollowUpDate: undefined as string | undefined,
    adherenceImproved: false,
    problemsResolved: [] as string[],
    newProblemsIdentified: [] as string[],
  });

  // Reschedule form state
  const [rescheduleData, setRescheduleData] = useState({
    newDate: new Date().toISOString(),
    reason: '',
  });

  // Filter follow-ups by status
  const scheduledFollowUps = followUps.filter((f) => f.status === 'scheduled');
  const completedFollowUps = followUps.filter((f) => f.status === 'completed');
  const overdueFollowUps = followUps.filter(
    (f) =>
      f.status === 'scheduled' &&
      f.scheduledDate &&
      isBefore(new Date(f.scheduledDate), new Date())
  );
  const upcomingFollowUps = followUps.filter(
    (f) =>
      f.status === 'scheduled' &&
      f.scheduledDate &&
      isAfter(new Date(f.scheduledDate), new Date())
  );

  // Handle form changes
  const handleFormChange = (field: keyof MTRFollowUp, value: unknown) => {
    if (field === 'scheduledDate' && value instanceof Date) {
      setFormData((prev) => ({ ...prev, [field]: value.toISOString() }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Handle objectives array changes
  const handleObjectiveChange = (index: number, value: string) => {
    const newObjectives = [...(formData.objectives || [])];
    newObjectives[index] = value;
    setFormData((prev) => ({ ...prev, objectives: newObjectives }));
  };

  const addObjective = () => {
    setFormData((prev) => ({
      ...prev,
      objectives: [...(prev.objectives || []), ''],
    }));
  };

  const removeObjective = (index: number) => {
    const newObjectives = [...(formData.objectives || [])];
    newObjectives.splice(index, 1);
    setFormData((prev) => ({ ...prev, objectives: newObjectives }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      if (!formData.description?.trim()) {
        addNotification({
          title: 'Validation Error',
          message: 'Description is required',
          type: 'error',
        });
        return;
      }

      if (!formData.scheduledDate) {
        addNotification({
          title: 'Validation Error',
          message: 'Scheduled date is required',
          type: 'error',
        });
        return;
      }

      if (!formData.assignedTo?.trim()) {
        addNotification({
          title: 'Validation Error',
          message: 'Assigned pharmacist is required',
          type: 'error',
        });
        return;
      }

      const followUpData: MTRFollowUp = {
        ...formData,
        reviewId,
        patientId: '', // This would come from the current review
        objectives: formData.objectives?.filter((obj) => obj.trim()) || [],
        reminders: [],
      } as MTRFollowUp;

      if (editingFollowUp) {
        await updateFollowUp(editingFollowUp._id!, followUpData);
        onFollowUpUpdated?.(editingFollowUp._id!, followUpData);
        addNotification({
          title: 'Success',
          message: 'Follow-up updated successfully',
          type: 'success',
        });
      } else {
        await scheduleFollowUp(followUpData);
        onFollowUpScheduled?.(followUpData);
        addNotification({
          title: 'Success',
          message: 'Follow-up scheduled successfully',
          type: 'success',
        });
      }

      handleCloseDialog();
    } catch (error) {
      addNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to save follow-up',
        type: 'error',
      });
    }
  };

  // Handle outcome submission
  const handleOutcomeSubmit = async () => {
    if (!selectedFollowUp) return;

    try {
      if (!outcomeData.notes.trim()) {
        addNotification({
          title: 'Validation Error',
          message: 'Outcome notes are required',
          type: 'error',
        });
        return;
      }

      await completeFollowUp(selectedFollowUp._id!, outcomeData);
      onFollowUpCompleted?.(selectedFollowUp._id!, outcomeData);
      addNotification({
        title: 'Success',
        message: 'Follow-up completed successfully',
        type: 'success',
      });
      setOutcomeDialogOpen(false);
      setSelectedFollowUp(null);
    } catch (error) {
      addNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to complete follow-up',
        type: 'error',
      });
    }
  };

  // Handle reschedule submission
  const handleRescheduleSubmit = async () => {
    if (!selectedFollowUp) return;

    try {
      if (!rescheduleData.reason.trim()) {
        addNotification({
          title: 'Validation Error',
          message: 'Reschedule reason is required',
          type: 'error',
        });
        return;
      }

      await rescheduleFollowUp(
        selectedFollowUp._id!,
        rescheduleData.newDate,
        rescheduleData.reason
      );
      addNotification({
        title: 'Success',
        message: 'Follow-up rescheduled successfully',
        type: 'success',
      });
      setRescheduleDialogOpen(false);
      setSelectedFollowUp(null);
    } catch (error) {
      addNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reschedule follow-up',
        type: 'error',
      });
    }
  };

  // Dialog handlers
  const handleOpenDialog = (followUp?: MTRFollowUp) => {
    if (followUp) {
      setEditingFollowUp(followUp);
      setFormData(followUp);
    } else {
      setEditingFollowUp(null);
      setFormData({
        type: 'phone_call',
        priority: 'medium',
        description: '',
        objectives: [],
        scheduledDate: new Date().toISOString(),
        estimatedDuration: 30,
        assignedTo: '',
        status: 'scheduled',
        relatedInterventions: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFollowUp(null);
    setFormData({});
  };

  const handleOpenOutcomeDialog = (followUp: MTRFollowUp) => {
    setSelectedFollowUp(followUp);
    setOutcomeData({
      status: 'successful',
      notes: '',
      nextActions: [],
      nextFollowUpDate: undefined,
      adherenceImproved: false,
      problemsResolved: [],
      newProblemsIdentified: [],
    });
    setOutcomeDialogOpen(true);
  };

  const handleOpenRescheduleDialog = (followUp: MTRFollowUp) => {
    setSelectedFollowUp(followUp);
    setRescheduleData({
      newDate: addDays(new Date(followUp.scheduledDate), 1).toISOString(),
      reason: '',
    });
    setRescheduleDialogOpen(true);
  };

  // Get follow-up type icon
  const getFollowUpTypeIcon = (type: string) => {
    switch (type) {
      case 'phone_call':
        return <PhoneIcon />;
      case 'appointment':
        return <CalendarIcon />;
      case 'lab_review':
        return <ScienceIcon />;
      case 'adherence_check':
        return <AssignmentIcon />;
      case 'outcome_assessment':
        return <AssessmentIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'missed':
        return 'error';
      case 'cancelled':
        return 'default';
      case 'rescheduled':
        return 'warning';
      default:
        return 'primary';
    }
  };

  // Render follow-up card
  const renderFollowUpCard = (followUp: MTRFollowUp) => {
    const isOverdue =
      followUp.status === 'scheduled' &&
      followUp.scheduledDate &&
      isBefore(new Date(followUp.scheduledDate), new Date());

    const daysUntil = followUp.scheduledDate
      ? differenceInDays(new Date(followUp.scheduledDate), new Date())
      : 0;

    return (
      <Card
        key={followUp._id}
        sx={{
          mb: 2,
          border: isOverdue ? '2px solid #f44336' : 'none',
          backgroundColor: isOverdue ? '#ffebee' : 'inherit',
        }}
      >
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            mb={2}
          >
            <Box display="flex" alignItems="center" gap={1}>
              {getFollowUpTypeIcon(followUp.type)}
              <Typography variant="h6" component="div">
                {followUp.description}
              </Typography>
              <Chip
                label={followUp.priority}
                color={
                  getPriorityColor(followUp.priority) as
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
              <Chip
                label={followUp.status}
                color={
                  getStatusColor(followUp.status) as
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
            <Box>
              {followUp.status === 'scheduled' && (
                <>
                  <Tooltip title="Complete Follow-up">
                    <IconButton
                      onClick={() => handleOpenOutcomeDialog(followUp)}
                      color="success"
                      size="small"
                    >
                      <CheckCircleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reschedule">
                    <IconButton
                      onClick={() => handleOpenRescheduleDialog(followUp)}
                      color="warning"
                      size="small"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Tooltip title="Edit Follow-up">
                <IconButton
                  onClick={() => handleOpenDialog(followUp)}
                  color="primary"
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CalendarIcon fontSize="small" />
                <Typography variant="body2">
                  {followUp.scheduledDate
                    ? format(new Date(followUp.scheduledDate), 'PPP p')
                    : 'No date set'}
                </Typography>
                {isOverdue && (
                  <Chip label="OVERDUE" color="error" size="small" />
                )}
                {daysUntil > 0 && daysUntil <= 7 && (
                  <Chip
                    label={`${daysUntil} days`}
                    color="warning"
                    size="small"
                  />
                )}
              </Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccessTimeIcon fontSize="small" />
                <Typography variant="body2">
                  {followUp.estimatedDuration} minutes
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <PersonIcon fontSize="small" />
                <Typography variant="body2">
                  Assigned to: {followUp.assignedTo}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              {followUp.objectives && followUp.objectives.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Objectives:
                  </Typography>
                  <List dense>
                    {followUp.objectives.map((objective, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemText
                          primary={objective}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          </Box>

          {followUp.outcome && (
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  Outcome ({followUp.outcome.status})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  {followUp.outcome.notes}
                </Typography>
                {followUp.outcome.nextActions &&
                  followUp.outcome.nextActions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Next Actions:
                      </Typography>
                      <List dense>
                        {followUp.outcome.nextActions.map((action, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemText
                              primary={action}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
              </AccordionDetails>
            </Accordion>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h5" component="h2">
            Follow-Up Scheduler
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading.scheduleFollowUp}
          >
            Schedule Follow-Up
          </Button>
        </Box>

        {/* Error Alert */}
        {errors.scheduleFollowUp && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.scheduleFollowUp}
          </Alert>
        )}

        {/* Loading */}
        {loading.scheduleFollowUp && <LinearProgress sx={{ mb: 2 }} />}

        {/* Summary Cards */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {scheduledFollowUps.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scheduled
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error">
                {overdueFollowUps.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overdue
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success">
                {completedFollowUps.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning">
                {upcomingFollowUps.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upcoming
              </Typography>
            </Paper>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
          >
            <Tab
              label={
                <Badge badgeContent={overdueFollowUps.length} color="error">
                  Overdue
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={upcomingFollowUps.length} color="primary">
                  Upcoming
                </Badge>
              }
            />
            <Tab label="All Scheduled" />
            <Tab label="Completed" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          {overdueFollowUps.length === 0 ? (
            <Alert severity="success">No overdue follow-ups</Alert>
          ) : (
            overdueFollowUps.map(renderFollowUpCard)
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {upcomingFollowUps.length === 0 ? (
            <Alert severity="info">No upcoming follow-ups scheduled</Alert>
          ) : (
            upcomingFollowUps.map(renderFollowUpCard)
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {scheduledFollowUps.length === 0 ? (
            <Alert severity="info">No scheduled follow-ups</Alert>
          ) : (
            scheduledFollowUps.map(renderFollowUpCard)
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          {completedFollowUps.length === 0 ? (
            <Alert severity="info">No completed follow-ups</Alert>
          ) : (
            completedFollowUps.map(renderFollowUpCard)
          )}
        </TabPanel>

        {/* Schedule/Edit Follow-Up Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingFollowUp ? 'Edit Follow-Up' : 'Schedule New Follow-Up'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type || 'phone_call'}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="phone_call">Phone Call</MenuItem>
                    <MenuItem value="appointment">Appointment</MenuItem>
                    <MenuItem value="lab_review">Lab Review</MenuItem>
                    <MenuItem value="adherence_check">Adherence Check</MenuItem>
                    <MenuItem value="outcome_assessment">
                      Outcome Assessment
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority || 'medium'}
                    onChange={(e) =>
                      handleFormChange('priority', e.target.value)
                    }
                    label="Priority"
                  >
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description || ''}
                  onChange={(e) =>
                    handleFormChange('description', e.target.value)
                  }
                  multiline
                  rows={2}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                <DateTimePicker
                  label="Scheduled Date & Time"
                  value={
                    formData.scheduledDate
                      ? new Date(formData.scheduledDate)
                      : new Date()
                  }
                  onChange={(date) => handleFormChange('scheduledDate', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
                <TextField
                  fullWidth
                  label="Estimated Duration (minutes)"
                  type="number"
                  value={formData.estimatedDuration || 30}
                  onChange={(e) =>
                    handleFormChange(
                      'estimatedDuration',
                      parseInt(e.target.value)
                    )
                  }
                  inputProps={{ min: 5, max: 480 }}
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Assigned To"
                  value={formData.assignedTo || ''}
                  onChange={(e) =>
                    handleFormChange('assignedTo', e.target.value)
                  }
                  placeholder="Pharmacist name or ID"
                  required
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Objectives
                </Typography>
                {(formData.objectives || []).map((objective, index) => (
                  <Box key={index} display="flex" gap={1} mb={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={objective}
                      onChange={(e) =>
                        handleObjectiveChange(index, e.target.value)
                      }
                      placeholder={`Objective ${index + 1}`}
                    />
                    <IconButton
                      onClick={() => removeObjective(index)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addObjective}
                  size="small"
                >
                  Add Objective
                </Button>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading.scheduleFollowUp}
            >
              {editingFollowUp ? 'Update' : 'Schedule'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Complete Follow-Up Dialog */}
        <Dialog
          open={outcomeDialogOpen}
          onClose={() => setOutcomeDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Complete Follow-Up</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ width: '100%' }}>
                <FormControl fullWidth>
                  <InputLabel>Outcome Status</InputLabel>
                  <Select
                    value={outcomeData.status}
                    onChange={(e) =>
                      setOutcomeData((prev) => ({
                        ...prev,
                        status: e.target.value as
                          | 'successful'
                          | 'partially_successful'
                          | 'unsuccessful',
                      }))
                    }
                    label="Outcome Status"
                  >
                    <MenuItem value="successful">Successful</MenuItem>
                    <MenuItem value="partially_successful">
                      Partially Successful
                    </MenuItem>
                    <MenuItem value="unsuccessful">Unsuccessful</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Outcome Notes"
                  value={outcomeData.notes}
                  onChange={(e) =>
                    setOutcomeData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  multiline
                  rows={4}
                  required
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <DateTimePicker
                  label="Next Follow-Up Date (Optional)"
                  value={
                    outcomeData.nextFollowUpDate
                      ? new Date(outcomeData.nextFollowUpDate)
                      : null
                  }
                  onChange={(date) =>
                    setOutcomeData((prev) => ({
                      ...prev,
                      nextFollowUpDate: date ? date.toISOString() : undefined,
                    }))
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOutcomeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleOutcomeSubmit}
              variant="contained"
              disabled={loading.completeFollowUp}
            >
              Complete Follow-Up
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog
          open={rescheduleDialogOpen}
          onClose={() => setRescheduleDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Reschedule Follow-Up</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
              <Box sx={{ width: '100%' }}>
                <DateTimePicker
                  label="New Date & Time"
                  value={new Date(rescheduleData.newDate)}
                  onChange={(date) =>
                    setRescheduleData((prev) => ({
                      ...prev,
                      newDate: (date || new Date()).toISOString(),
                    }))
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
              </Box>
              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  label="Reason for Rescheduling"
                  value={rescheduleData.reason}
                  onChange={(e) =>
                    setRescheduleData((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  multiline
                  rows={2}
                  required
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRescheduleSubmit}
              variant="contained"
              disabled={loading.rescheduleFollowUp}
            >
              Reschedule
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default FollowUpScheduler;
