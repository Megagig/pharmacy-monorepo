import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  IconButton,
  Grid,
  Divider,
  Stack,
  Avatar,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,

  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  Person as PersonIcon,
  LocalPharmacy as PharmacyIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon,
  Assignment as AssignmentIcon,
  MedicalServices as MedicalServicesIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  EventRepeat as RescheduleIcon,
  Done as DoneIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';

import { Appointment, AppointmentStatus } from '../../stores/appointmentTypes';
import { useAppointment, useUpdateAppointmentStatus, useRescheduleAppointment, useCancelAppointment } from '../../hooks/useAppointments';
import { useCreateVisitFromAppointment } from '../../queries/usePatientResources';
import { Patient } from '../../types/patientManagement';

interface AppointmentDetailsPanelProps {
  appointmentId: string;
  onClose?: () => void;
  onEdit?: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
  onComplete?: (appointment: Appointment) => void;
}

// Status color mapping
const getStatusColor = (status: AppointmentStatus): string => {
  switch (status) {
    case 'scheduled':
      return '#1976d2';
    case 'confirmed':
      return '#388e3c';
    case 'in_progress':
      return '#f57c00';
    case 'completed':
      return '#4caf50';
    case 'cancelled':
      return '#d32f2f';
    case 'no_show':
      return '#9e9e9e';
    case 'rescheduled':
      return '#ff9800';
    default:
      return '#757575';
  }
};

// Status icon mapping
const getStatusIcon = (status: AppointmentStatus) => {
  switch (status) {
    case 'scheduled':
      return <ScheduleIcon />;
    case 'confirmed':
      return <CheckCircleIcon />;
    case 'in_progress':
      return <MedicalServicesIcon />;
    case 'completed':
      return <DoneIcon />;
    case 'cancelled':
      return <CancelIcon />;
    case 'no_show':
      return <WarningIcon />;
    case 'rescheduled':
      return <RescheduleIcon />;
    default:
      return <InfoIcon />;
  }
};

// Appointment type labels
const getAppointmentTypeLabel = (type: string): string => {
  const typeLabels: Record<string, string> = {
    mtm_session: 'MTM Session',
    chronic_disease_review: 'Chronic Disease Review',
    new_medication_consultation: 'New Medication Consultation',
    vaccination: 'Vaccination',
    health_check: 'Health Check',
    smoking_cessation: 'Smoking Cessation',
    general_followup: 'General Follow-up',
  };
  return typeLabels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const AppointmentDetailsPanel: React.FC<AppointmentDetailsPanelProps> = ({
  appointmentId,
  onClose,
  onEdit,
  onReschedule,
  onCancel,
  onComplete,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timeline: true,
    reminders: false,
    related: false,
  });
  const [actionDialogOpen, setActionDialogOpen] = useState<{
    type: 'complete' | 'cancel' | null;
    open: boolean;
  }>({ type: null, open: false });
  const [actionNotes, setActionNotes] = useState('');

  // Hooks
  const { data: appointmentData, isLoading, error } = useAppointment(appointmentId);
  const updateStatusMutation = useUpdateAppointmentStatus();
  const rescheduleAppointmentMutation = useRescheduleAppointment();
  const cancelAppointmentMutation = useCancelAppointment();
  const createVisitMutation = useCreateVisitFromAppointment();

  const appointment = appointmentData?.data?.appointment;
  const patient = appointmentData?.data?.patient;
  const assignedPharmacist = appointmentData?.data?.assignedPharmacist;
  const relatedRecords = appointmentData?.data?.relatedRecords;

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleActionDialogOpen = (type: 'complete' | 'cancel') => {
    setActionDialogOpen({ type, open: true });
    setActionNotes('');
  };

  const handleActionDialogClose = () => {
    setActionDialogOpen({ type: null, open: false });
    setActionNotes('');
  };

  const handleCompleteAppointment = async () => {
    if (!appointment) return;

    try {
      await updateStatusMutation.mutateAsync({
        appointmentId: appointment._id,
        statusData: {
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: actionNotes,
            nextActions: [],
            visitCreated: false,
          },
        },
      });
      handleActionDialogClose();
      onComplete?.(appointment);
    } catch (error) {
      console.error('Failed to complete appointment:', error);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;

    try {
      await cancelAppointmentMutation.mutateAsync({
        appointmentId: appointment._id,
        cancelData: {
          reason: actionNotes,
          notifyPatient: true,
        },
      });
      handleActionDialogClose();
      onCancel?.(appointment);
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleCreateVisit = async () => {
    if (!appointment) return;

    try {
      await createVisitMutation.mutateAsync({
        patientId: appointment.patientId,
        appointmentId: appointment._id,
        appointmentData: {
          type: appointment.type,
          notes: appointment.outcome?.notes || '',
          nextActions: appointment.outcome?.nextActions || [],
          scheduledDate: appointment.scheduledDate.toString(),
          scheduledTime: appointment.scheduledTime,
        },
      });
      // Optionally show success message or navigate to visit
    } catch (error) {
      console.error('Failed to create visit:', error);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !appointment) {
    return (
      <Alert severity="error">
        Failed to load appointment details. Please try again.
      </Alert>
    );
  }

  const isUpcoming = isAfter(new Date(appointment.scheduledDate), new Date());
  const canReschedule = ['scheduled', 'confirmed'].includes(appointment.status) && isUpcoming;
  const canCancel = ['scheduled', 'confirmed'].includes(appointment.status) && isUpcoming;
  const canComplete = ['scheduled', 'confirmed', 'in_progress'].includes(appointment.status);

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="h5" gutterBottom>
              {getAppointmentTypeLabel(appointment.type)}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={getStatusIcon(appointment.status)}
                label={appointment.status.replace('_', ' ').toUpperCase()}
                color={appointment.status === 'completed' ? 'success' : 
                       appointment.status === 'cancelled' ? 'error' : 'primary'}
                size="small"
                sx={{ bgcolor: getStatusColor(appointment.status), color: 'white' }}
              />
              {appointment.confirmationStatus === 'confirmed' && (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Confirmed"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
          {onClose && (
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Appointment Details */}
        <Grid item xs={12} md={8}>
          {/* Basic Information */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Appointment Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Date & Time
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(appointment.scheduledDate), 'EEEE, MMMM d, yyyy')}
                  </Typography>
                  <Typography variant="body1">
                    {appointment.scheduledTime} ({appointment.duration} minutes)
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(appointment.createdAt), 'MMM d, yyyy')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDistanceToNow(new Date(appointment.createdAt), { addSuffix: true })}
                  </Typography>
                </Grid>
                {appointment.description && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {appointment.description}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Patient Information */}
          {patient && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Patient Information
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {patient.firstName?.[0]}{patient.lastName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {patient.firstName} {patient.lastName}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {patient.phone && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <PhoneIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {patient.phone}
                          </Typography>
                        </Stack>
                      )}
                      {patient.email && (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <EmailIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {patient.email}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Assigned Pharmacist */}
          {assignedPharmacist && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <PharmacyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Assigned Pharmacist
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    {assignedPharmacist.firstName?.[0]}{assignedPharmacist.lastName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {assignedPharmacist.firstName} {assignedPharmacist.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignedPharmacist.role || 'Pharmacist'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Appointment Timeline */}
          <Accordion 
            expanded={expandedSections.timeline}
            onChange={() => handleSectionToggle('timeline')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Appointment Timeline
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Timeline>
                {/* Created */}
                <TimelineItem>
                  <TimelineOppositeContent sx={{ flex: 0.3 }}>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(appointment.createdAt), 'MMM d, HH:mm')}
                    </Typography>
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color="primary">
                      <EventIcon />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography variant="body2" fontWeight="medium">
                      Appointment Created
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getAppointmentTypeLabel(appointment.type)} scheduled
                    </Typography>
                  </TimelineContent>
                </TimelineItem>

                {/* Confirmed */}
                {appointment.confirmedAt && (
                  <TimelineItem>
                    <TimelineOppositeContent sx={{ flex: 0.3 }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(appointment.confirmedAt), 'MMM d, HH:mm')}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="success">
                        <CheckCircleIcon />
                      </TimelineDot>
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight="medium">
                        Appointment Confirmed
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Patient confirmed attendance
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}

                {/* Rescheduled */}
                {appointment.rescheduledAt && (
                  <TimelineItem>
                    <TimelineOppositeContent sx={{ flex: 0.3 }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(appointment.rescheduledAt), 'MMM d, HH:mm')}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="warning">
                        <RescheduleIcon />
                      </TimelineDot>
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight="medium">
                        Appointment Rescheduled
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {appointment.rescheduledReason}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}

                {/* Completed */}
                {appointment.completedAt && (
                  <TimelineItem>
                    <TimelineOppositeContent sx={{ flex: 0.3 }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(appointment.completedAt), 'MMM d, HH:mm')}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="success">
                        <DoneIcon />
                      </TimelineDot>
                      {appointment.cancelledAt && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight="medium">
                        Appointment Completed
                      </Typography>
                      {appointment.outcome && (
                        <Typography variant="caption" color="text.secondary">
                          Status: {appointment.outcome.status}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                )}

                {/* Cancelled */}
                {appointment.cancelledAt && (
                  <TimelineItem>
                    <TimelineOppositeContent sx={{ flex: 0.3 }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(appointment.cancelledAt), 'MMM d, HH:mm')}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="error">
                        <CancelIcon />
                      </TimelineDot>
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="body2" fontWeight="medium">
                        Appointment Cancelled
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {appointment.cancellationReason}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}
              </Timeline>
            </AccordionDetails>
          </Accordion>

          {/* Reminder History */}
          {appointment.reminders && appointment.reminders.length > 0 && (
            <Accordion 
              expanded={expandedSections.reminders}
              onChange={() => handleSectionToggle('reminders')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Reminder History ({appointment.reminders.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {appointment.reminders.map((reminder, index) => (
                    <ListItem key={index} divider={index < appointment.reminders.length - 1}>
                      <ListItemIcon>
                        <Chip
                          label={reminder.type.toUpperCase()}
                          size="small"
                          color={reminder.sent ? 'success' : 'default'}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Scheduled for ${format(new Date(reminder.scheduledFor), 'MMM d, HH:mm')}`}
                        secondary={
                          reminder.sent
                            ? `Sent ${reminder.sentAt ? format(new Date(reminder.sentAt), 'MMM d, HH:mm') : 'successfully'} - ${reminder.deliveryStatus || 'delivered'}`
                            : 'Pending'
                        }
                      />
                      {reminder.failureReason && (
                        <Box sx={{ ml: 1 }}>
                          <Tooltip title={reminder.failureReason}>
                            <WarningIcon color="error" fontSize="small" />
                          </Tooltip>
                        </Box>
                      )}
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Related Records */}
          {relatedRecords && Object.keys(relatedRecords).length > 0 && (
            <Accordion 
              expanded={expandedSections.related}
              onChange={() => handleSectionToggle('related')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Related Records
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {relatedRecords.visitId && (
                    <ListItem>
                      <ListItemIcon>
                        <AssignmentIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Visit Record"
                        secondary={`Visit ID: ${relatedRecords.visitId}`}
                      />
                    </ListItem>
                  )}
                  {relatedRecords.mtrSessionId && (
                    <ListItem>
                      <ListItemIcon>
                        <MedicalServicesIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="MTR Session"
                        secondary={`Session ID: ${relatedRecords.mtrSessionId}`}
                      />
                    </ListItem>
                  )}
                  {relatedRecords.clinicalInterventionId && (
                    <ListItem>
                      <ListItemIcon>
                        <MedicalServicesIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Clinical Intervention"
                        secondary={`Intervention ID: ${relatedRecords.clinicalInterventionId}`}
                      />
                    </ListItem>
                  )}
                  {relatedRecords.followUpTaskId && (
                    <ListItem>
                      <ListItemIcon>
                        <AssignmentIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Follow-up Task"
                        secondary={`Task ID: ${relatedRecords.followUpTaskId}`}
                      />
                    </ListItem>
                  )}
                </List>
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>

        {/* Right Column - Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>
              <Stack spacing={2}>
                {onEdit && (
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => onEdit(appointment)}
                    fullWidth
                  >
                    Edit Appointment
                  </Button>
                )}

                {canReschedule && (
                  <Button
                    variant="outlined"
                    startIcon={<RescheduleIcon />}
                    onClick={() => onReschedule?.(appointment)}
                    fullWidth
                    disabled={rescheduleAppointmentMutation.isPending}
                  >
                    Reschedule
                  </Button>
                )}

                {canComplete && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<DoneIcon />}
                    onClick={() => handleActionDialogOpen('complete')}
                    fullWidth
                    disabled={updateStatusMutation.isPending}
                  >
                    Mark Complete
                  </Button>
                )}

                {appointment?.status === 'completed' && !appointment.outcome?.visitCreated && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AssignmentIcon />}
                    onClick={handleCreateVisit}
                    fullWidth
                    disabled={createVisitMutation.isPending}
                  >
                    {createVisitMutation.isPending ? 'Creating Visit...' : 'Create Visit'}
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => handleActionDialogOpen('cancel')}
                    fullWidth
                    disabled={cancelAppointmentMutation.isPending}
                  >
                    Cancel Appointment
                  </Button>
                )}
              </Stack>

              {/* Appointment Status Info */}
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Status Information
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Current Status:</strong> {appointment.status.replace('_', ' ')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Confirmation:</strong> {appointment.confirmationStatus}
                  </Typography>
                  {appointment.outcome && (
                    <Typography variant="body2">
                      <strong>Outcome:</strong> {appointment.outcome.status}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Dialogs */}
      <Dialog
        open={actionDialogOpen.open}
        onClose={handleActionDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialogOpen.type === 'complete' ? 'Complete Appointment' : 'Cancel Appointment'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={actionDialogOpen.type === 'complete' ? 'Completion Notes' : 'Cancellation Reason'}
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder={
              actionDialogOpen.type === 'complete'
                ? 'Enter any notes about the appointment outcome...'
                : 'Please provide a reason for cancellation...'
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleActionDialogClose}>
            Cancel
          </Button>
          <Button
            onClick={actionDialogOpen.type === 'complete' ? handleCompleteAppointment : handleCancelAppointment}
            variant="contained"
            color={actionDialogOpen.type === 'complete' ? 'success' : 'error'}
            disabled={
              !actionNotes.trim() ||
              updateStatusMutation.isPending ||
              cancelAppointmentMutation.isPending
            }
          >
            {actionDialogOpen.type === 'complete' ? 'Complete' : 'Cancel Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AppointmentDetailsPanel;