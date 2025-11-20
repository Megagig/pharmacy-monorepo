import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  IconButton,
  Stack,
  Alert,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Event as EventIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  EventAvailable as EventAvailableIcon,
  EventBusy as EventBusyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format, isToday, isTomorrow, isPast, isFuture } from 'date-fns';

import { usePatientAppointments, useCancelAppointment } from '../hooks/useAppointments';
import { Appointment, AppointmentType } from '../stores/appointmentTypes';
import CreateAppointmentDialog from './appointments/CreateAppointmentDialog';
import RescheduleAppointmentDialog from './appointments/RescheduleAppointmentDialog';

// Appointment type configurations
const APPOINTMENT_TYPE_CONFIG: Record<AppointmentType, {
  label: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactNode;
}> = {
  mtm_session: {
    label: 'MTM Session',
    color: 'primary',
    icon: <PersonIcon />,
  },
  chronic_disease_review: {
    label: 'Chronic Disease Review',
    color: 'error',
    icon: <WarningIcon />,
  },
  new_medication_consultation: {
    label: 'New Medication',
    color: 'success',
    icon: <EventIcon />,
  },
  vaccination: {
    label: 'Vaccination',
    color: 'warning',
    icon: <EventAvailableIcon />,
  },
  health_check: {
    label: 'Health Check',
    color: 'info',
    icon: <CheckCircleIcon />,
  },
  smoking_cessation: {
    label: 'Smoking Cessation',
    color: 'secondary',
    icon: <EventIcon />,
  },
  general_followup: {
    label: 'General Follow-up',
    color: 'primary',
    icon: <ScheduleIcon />,
  },
};

// Status configurations
const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'primary' as const, icon: <ScheduleIcon /> },
  confirmed: { label: 'Confirmed', color: 'success' as const, icon: <CheckCircleIcon /> },
  in_progress: { label: 'In Progress', color: 'warning' as const, icon: <AccessTimeIcon /> },
  completed: { label: 'Completed', color: 'success' as const, icon: <CheckCircleIcon /> },
  cancelled: { label: 'Cancelled', color: 'error' as const, icon: <CancelIcon /> },
  no_show: { label: 'No Show', color: 'error' as const, icon: <EventBusyIcon /> },
  rescheduled: { label: 'Rescheduled', color: 'warning' as const, icon: <ScheduleIcon /> },
};

interface PatientAppointmentsListProps {
  patientId: string;
  maxAppointments?: number;
  showCreateButton?: boolean;
  showHeader?: boolean;
  onCreateAppointment?: () => void;
  onViewAppointment?: (appointmentId: string) => void;
  onEditAppointment?: (appointmentId: string) => void;
}

const PatientAppointmentsList: React.FC<PatientAppointmentsListProps> = ({
  patientId,
  maxAppointments = 10,
  showCreateButton = true,
  showHeader = true,
  onCreateAppointment,
  onViewAppointment,
  onEditAppointment,
}) => {
  const navigate = useNavigate();

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Hooks
  const {
    data: appointmentsResponse,
    isLoading,
    isError,
    error,
  } = usePatientAppointments(patientId, { limit: maxAppointments });

  const cancelAppointmentMutation = useCancelAppointment();

  // Extract appointments from response
  const appointments = appointmentsResponse?.data?.appointments || [];
  const upcomingCount = appointments.filter(apt => 
    isFuture(new Date(`${apt.scheduledDate}T${apt.scheduledTime}`)) && 
    apt.status !== 'cancelled'
  ).length;

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, appointment: Appointment) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedAppointment(appointment);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedAppointment(null);
  };

  // Handle appointment actions
  const handleViewAppointment = (appointment: Appointment) => {
    if (onViewAppointment) {
      onViewAppointment(appointment._id);
    } else {
      navigate(`/appointments/${appointment._id}`);
    }
    handleMenuClose();
  };

  const handleEditAppointment = (appointment: Appointment) => {
    if (onEditAppointment) {
      onEditAppointment(appointment._id);
    } else {
      navigate(`/appointments/${appointment._id}/edit`);
    }
    handleMenuClose();
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDialogOpen(true);
    handleMenuClose();
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCancelDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;

    try {
      await cancelAppointmentMutation.mutateAsync({
        appointmentId: selectedAppointment._id,
        cancelData: {
          reason: cancelReason || 'Cancelled by pharmacist',
          notifyPatient: true,
        },
      });
      setCancelDialogOpen(false);
      setCancelReason('');
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  const handleCreateAppointment = () => {
    if (onCreateAppointment) {
      onCreateAppointment();
    } else {
      setCreateDialogOpen(true);
    }
  };

  // Format appointment date/time
  const formatAppointmentDateTime = (appointment: Appointment) => {
    try {
      const appointmentDate = new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
      
      // Check if date is valid
      if (isNaN(appointmentDate.getTime())) {
        return `${appointment.scheduledDate} at ${appointment.scheduledTime}`;
      }
      
      if (isToday(appointmentDate)) {
        return `Today at ${format(appointmentDate, 'h:mm a')}`;
      } else if (isTomorrow(appointmentDate)) {
        return `Tomorrow at ${format(appointmentDate, 'h:mm a')}`;
      } else {
        return format(appointmentDate, 'MMM dd, yyyy \'at\' h:mm a');
      }
    } catch (error) {
      // Fallback for invalid dates
      return `${appointment.scheduledDate} at ${appointment.scheduledTime}`;
    }
  };

  // Get appointment urgency
  const getAppointmentUrgency = (appointment: Appointment) => {
    try {
      const appointmentDate = new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
      
      // Check if date is valid
      if (isNaN(appointmentDate.getTime())) {
        return 'future';
      }
      
      if (isPast(appointmentDate) && appointment.status === 'scheduled') {
        return 'overdue';
      } else if (isToday(appointmentDate)) {
        return 'today';
      } else if (isTomorrow(appointmentDate)) {
        return 'tomorrow';
      }
      return 'future';
    } catch (error) {
      return 'future';
    }
  };

  // Render appointment item
  const renderAppointmentItem = (appointment: Appointment) => {
    const typeConfig = APPOINTMENT_TYPE_CONFIG[appointment.type];
    const statusConfig = STATUS_CONFIG[appointment.status];
    const urgency = getAppointmentUrgency(appointment);

    return (
      <ListItem
        key={appointment._id}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          mb: 1,
          bgcolor: urgency === 'overdue' ? 'error.light' : 
                  urgency === 'today' ? 'warning.light' : 'background.paper',
          '&:hover': {
            bgcolor: urgency === 'overdue' ? 'error.main' : 
                     urgency === 'today' ? 'warning.main' : 'action.hover',
          },
          cursor: 'pointer',
        }}
        onClick={() => handleViewAppointment(appointment)}
      >
        <ListItemIcon>
          <Badge
            color={urgency === 'overdue' ? 'error' : urgency === 'today' ? 'warning' : 'default'}
            variant="dot"
            invisible={urgency === 'future'}
          >
            {typeConfig.icon}
          </Badge>
        </ListItemIcon>
        
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                {typeConfig.label}
              </Typography>
              <Chip
                label={statusConfig.label}
                size="small"
                color={statusConfig.color}
                variant="outlined"
              />
            </Box>
          }
          secondary={
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {formatAppointmentDateTime(appointment)}
              </Typography>
              {appointment.description && (
                <Typography variant="caption" color="text.secondary">
                  {appointment.description}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Duration: {appointment.duration} minutes
              </Typography>
            </Stack>
          }
        />

        <ListItemSecondaryAction>
          <IconButton
            edge="end"
            onClick={(e) => handleMenuOpen(e, appointment)}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader
            title="Appointments"
            avatar={<EventIcon color="primary" />}
            action={
              showCreateButton && (
                <Skeleton variant="rectangular" width={120} height={36} />
              )
            }
          />
        )}
        <CardContent>
          <Stack spacing={1}>
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={80} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        {showHeader && (
          <CardHeader
            title="Appointments"
            avatar={<EventIcon color="primary" />}
          />
        )}
        <CardContent>
          <Alert severity="error">
            <Typography variant="h6">Failed to load appointments</Typography>
            <Typography variant="body2">
              {error instanceof Error ? error.message : 'An unexpected error occurred.'}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        {showHeader && (
          <CardHeader
            title={
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6">Appointments</Typography>
                {upcomingCount > 0 && (
                  <Badge badgeContent={upcomingCount} color="primary">
                    <EventIcon />
                  </Badge>
                )}
              </Box>
            }
            avatar={<EventIcon color="primary" />}
            action={
              showCreateButton && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateAppointment}
                  size="small"
                >
                  Schedule
                </Button>
              )
            }
          />
        )}
        
        <CardContent>
          {appointments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No appointments scheduled
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Schedule the first appointment for this patient
              </Typography>
              {showCreateButton && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateAppointment}
                >
                  Schedule Appointment
                </Button>
              )}
            </Box>
          ) : (
            <List disablePadding>
              {appointments.map(renderAppointmentItem)}
              
              {appointments.length >= maxAppointments && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box textAlign="center">
                    <Button
                      variant="outlined"
                      onClick={() => navigate(`/patients/${patientId}/appointments`)}
                    >
                      View All Appointments
                    </Button>
                  </Box>
                </>
              )}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedAppointment && handleViewAppointment(selectedAppointment)}>
          <VisibilityIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => selectedAppointment && handleEditAppointment(selectedAppointment)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedAppointment && handleRescheduleAppointment(selectedAppointment)}>
          <ScheduleIcon sx={{ mr: 1 }} />
          Reschedule
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => selectedAppointment && handleCancelAppointment(selectedAppointment)}
          sx={{ color: 'error.main' }}
        >
          <CancelIcon sx={{ mr: 1 }} />
          Cancel
        </MenuItem>
      </Menu>

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        initialData={{ patientId }}
      />

      {/* Reschedule Appointment Dialog */}
      {selectedAppointment && (
        <RescheduleAppointmentDialog
          open={rescheduleDialogOpen}
          onClose={() => {
            setRescheduleDialogOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Appointment</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to cancel this appointment?
          </Typography>
          {selectedAppointment && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2">
                {APPOINTMENT_TYPE_CONFIG[selectedAppointment.type].label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAppointmentDateTime(selectedAppointment)}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The patient will be notified of the cancellation.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Keep Appointment
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color="error"
            variant="contained"
            disabled={cancelAppointmentMutation.isPending}
          >
            {cancelAppointmentMutation.isPending ? 'Cancelling...' : 'Cancel Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PatientAppointmentsList;