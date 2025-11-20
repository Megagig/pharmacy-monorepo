import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Chip,
  Stack,
  Typography,
  IconButton,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  EventBusy as EventBusyIcon,
  EventAvailable as EventAvailableIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format, isToday, isTomorrow, isPast, differenceInDays, differenceInHours } from 'date-fns';

import { usePatientAppointments } from '../hooks/useAppointments';
import { Appointment } from '../stores/appointmentTypes';

interface PatientAppointmentAlertsProps {
  patientId: string;
  onCreateAppointment?: () => void;
  onViewAppointment?: (appointmentId: string) => void;
  maxAlerts?: number;
}

interface AppointmentAlert {
  id: string;
  type: 'overdue' | 'today' | 'tomorrow' | 'missed' | 'no_recent' | 'follow_up_needed';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  appointment?: Appointment;
  actionLabel?: string;
  onAction?: () => void;
}

const PatientAppointmentAlerts: React.FC<PatientAppointmentAlertsProps> = ({
  patientId,
  onCreateAppointment,
  onViewAppointment,
  maxAlerts = 5,
}) => {
  const navigate = useNavigate();

  // Fetch patient appointments
  const {
    data: appointmentsResponse,
    isLoading,
    isError,
  } = usePatientAppointments(patientId, { limit: 20 });

  const appointments = appointmentsResponse?.data?.appointments || [];

  // Generate alerts based on appointment data
  const generateAlerts = (): AppointmentAlert[] => {
    const alerts: AppointmentAlert[] = [];
    const now = new Date();

    // Check for overdue appointments
    const overdueAppointments = appointments.filter(apt => {
      const appointmentDateTime = new Date(`${apt.scheduledDate}T${apt.scheduledTime}`);
      return isPast(appointmentDateTime) && apt.status === 'scheduled';
    });

    overdueAppointments.forEach(appointment => {
      const appointmentDateTime = new Date(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
      const hoursOverdue = differenceInHours(now, appointmentDateTime);
      
      alerts.push({
        id: `overdue-${appointment._id}`,
        type: 'overdue',
        severity: 'error',
        title: 'Overdue Appointment',
        message: `${appointment.type.replace('_', ' ')} appointment was scheduled ${hoursOverdue > 24 
          ? `${Math.floor(hoursOverdue / 24)} days ago` 
          : `${hoursOverdue} hours ago`}`,
        appointment,
        actionLabel: 'View Details',
        onAction: () => onViewAppointment ? onViewAppointment(appointment._id) : navigate(`/appointments/${appointment._id}`),
      });
    });

    // Check for today's appointments
    const todayAppointments = appointments.filter(apt => {
      const appointmentDate = new Date(apt.scheduledDate);
      return isToday(appointmentDate) && apt.status !== 'cancelled' && apt.status !== 'completed';
    });

    todayAppointments.forEach(appointment => {
      alerts.push({
        id: `today-${appointment._id}`,
        type: 'today',
        severity: 'warning',
        title: 'Appointment Today',
        message: `${appointment.type.replace('_', ' ')} appointment at ${appointment.scheduledTime}`,
        appointment,
        actionLabel: 'View Details',
        onAction: () => onViewAppointment ? onViewAppointment(appointment._id) : navigate(`/appointments/${appointment._id}`),
      });
    });

    // Check for tomorrow's appointments
    const tomorrowAppointments = appointments.filter(apt => {
      const appointmentDate = new Date(apt.scheduledDate);
      return isTomorrow(appointmentDate) && apt.status !== 'cancelled';
    });

    tomorrowAppointments.forEach(appointment => {
      alerts.push({
        id: `tomorrow-${appointment._id}`,
        type: 'tomorrow',
        severity: 'info',
        title: 'Appointment Tomorrow',
        message: `${appointment.type.replace('_', ' ')} appointment at ${appointment.scheduledTime}`,
        appointment,
        actionLabel: 'View Details',
        onAction: () => onViewAppointment ? onViewAppointment(appointment._id) : navigate(`/appointments/${appointment._id}`),
      });
    });

    // Check for missed appointments (no-show)
    const missedAppointments = appointments.filter(apt => apt.status === 'no_show');
    if (missedAppointments.length > 0) {
      const latestMissed = missedAppointments[0]; // Assuming sorted by date
      alerts.push({
        id: `missed-${latestMissed._id}`,
        type: 'missed',
        severity: 'warning',
        title: 'Missed Appointment',
        message: `Patient missed ${latestMissed.type.replace('_', ' ')} appointment on ${format(new Date(latestMissed.scheduledDate), 'MMM dd, yyyy')}`,
        appointment: latestMissed,
        actionLabel: 'Reschedule',
        onAction: () => onCreateAppointment ? onCreateAppointment() : navigate(`/appointments/create?patientId=${patientId}`),
      });
    }

    // Check if patient hasn't had an appointment in a while
    const completedAppointments = appointments.filter(apt => apt.status === 'completed');
    if (completedAppointments.length > 0) {
      const lastCompleted = completedAppointments[0]; // Assuming sorted by date
      const daysSinceLastAppointment = differenceInDays(now, new Date(lastCompleted.scheduledDate));
      
      if (daysSinceLastAppointment > 90) { // 3 months
        alerts.push({
          id: 'no-recent',
          type: 'no_recent',
          severity: 'info',
          title: 'No Recent Appointments',
          message: `Last appointment was ${daysSinceLastAppointment} days ago. Consider scheduling a follow-up.`,
          actionLabel: 'Schedule Appointment',
          onAction: () => onCreateAppointment ? onCreateAppointment() : navigate(`/appointments/create?patientId=${patientId}`),
        });
      }
    } else if (appointments.length === 0) {
      // No appointments at all
      alerts.push({
        id: 'no-appointments',
        type: 'no_recent',
        severity: 'info',
        title: 'No Appointments Scheduled',
        message: 'This patient has no appointment history. Consider scheduling an initial consultation.',
        actionLabel: 'Schedule First Appointment',
        onAction: () => onCreateAppointment ? onCreateAppointment() : navigate(`/appointments/create?patientId=${patientId}`),
      });
    }

    // Check for follow-up needed based on appointment outcomes
    const recentCompletedAppointments = appointments.filter(apt => {
      const appointmentDate = new Date(apt.scheduledDate);
      const daysSince = differenceInDays(now, appointmentDate);
      return apt.status === 'completed' && daysSince <= 30 && apt.outcome?.nextActions?.length > 0;
    });

    recentCompletedAppointments.forEach(appointment => {
      if (appointment.outcome?.nextActions?.some(action => action.toLowerCase().includes('follow'))) {
        alerts.push({
          id: `follow-up-${appointment._id}`,
          type: 'follow_up_needed',
          severity: 'warning',
          title: 'Follow-up Needed',
          message: `Follow-up required from ${appointment.type.replace('_', ' ')} appointment on ${format(new Date(appointment.scheduledDate), 'MMM dd')}`,
          appointment,
          actionLabel: 'Schedule Follow-up',
          onAction: () => onCreateAppointment ? onCreateAppointment() : navigate(`/appointments/create?patientId=${patientId}&type=general_followup`),
        });
      }
    });

    // Sort alerts by priority (error > warning > info) and limit
    return alerts
      .sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, maxAlerts);
  };

  // Don't render anything while loading or if there's an error
  if (isLoading || isError) {
    return null;
  }

  const alerts = generateAlerts();

  // Don't render if no alerts
  if (alerts.length === 0) {
    return null;
  }

  // Get alert icon
  const getAlertIcon = (type: AppointmentAlert['type']) => {
    switch (type) {
      case 'overdue':
        return <ErrorIcon />;
      case 'today':
        return <ScheduleIcon />;
      case 'tomorrow':
        return <EventAvailableIcon />;
      case 'missed':
        return <EventBusyIcon />;
      case 'no_recent':
        return <InfoIcon />;
      case 'follow_up_needed':
        return <WarningIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon color="primary" />
          Appointment Alerts
          <Chip label={alerts.length} size="small" color="primary" />
        </Typography>

        <Stack spacing={2}>
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.severity}
              icon={getAlertIcon(alert.type)}
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  {alert.onAction && alert.actionLabel && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={alert.onAction}
                      startIcon={alert.actionLabel.includes('Schedule') ? <AddIcon /> : <VisibilityIcon />}
                    >
                      {alert.actionLabel}
                    </Button>
                  )}
                </Stack>
              }
            >
              <AlertTitle>{alert.title}</AlertTitle>
              {alert.message}
              {alert.appointment && (
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={`${alert.appointment.duration} min`}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  {alert.appointment.assignedTo && (
                    <Chip
                      label="Assigned"
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  )}
                </Box>
              )}
            </Alert>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default PatientAppointmentAlerts;