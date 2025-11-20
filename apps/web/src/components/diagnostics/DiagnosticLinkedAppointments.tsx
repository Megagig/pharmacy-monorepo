import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Appointment {
  _id: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    visitCreated: boolean;
    visitId?: string;
  };
  completedAt?: string;
  createdAt: string;
}

interface FollowUpTask {
  _id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'converted_to_appointment';
  dueDate: string;
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  outcome?: {
    status: 'successful' | 'partially_successful' | 'unsuccessful';
    notes: string;
    nextActions: string[];
    appointmentCreated: boolean;
    appointmentId?: string;
  };
  completedAt?: string;
  createdAt: string;
}

interface DiagnosticLinkedAppointmentsProps {
  appointments: Appointment[];
  followUpTasks: FollowUpTask[];
  loading?: boolean;
}

const DiagnosticLinkedAppointments: React.FC<DiagnosticLinkedAppointmentsProps> = ({
  appointments,
  followUpTasks,
  loading = false,
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'scheduled':
      case 'confirmed':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'cancelled':
      case 'no_show':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'urgent':
        return 'warning';
      case 'high':
        return 'info';
      case 'medium':
        return 'primary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'cancelled':
      case 'no_show':
        return <CancelIcon color="error" />;
      case 'in_progress':
        return <AccessTimeIcon color="warning" />;
      default:
        return <ScheduleIcon color="info" />;
    }
  };

  const handleViewAppointment = (appointmentId: string) => {
    navigate(`/pharmacy/appointments/${appointmentId}`);
  };

  const handleViewFollowUpTask = (taskId: string) => {
    navigate(`/pharmacy/follow-ups/${taskId}`);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading engagement data...
        </Typography>
      </Box>
    );
  }

  const hasEngagementData = appointments.length > 0 || followUpTasks.length > 0;

  if (!hasEngagementData) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        <Typography variant="body2">
          No follow-up tasks or appointments have been created for this diagnostic case yet.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <EventIcon sx={{ mr: 1 }} />
        Engagement Timeline
      </Typography>

      <Stack spacing={2}>
        {/* Follow-up Tasks */}
        {followUpTasks.map((task) => (
          <Card key={task._id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    <AssignmentIcon sx={{ mr: 1, fontSize: 18 }} />
                    {task.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {task.description}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={task.priority}
                    color={getPriorityColor(task.priority) as any}
                    size="small"
                  />
                  <Chip
                    label={task.status}
                    color={getStatusColor(task.status) as any}
                    size="small"
                  />
                  <Tooltip title="View Task Details">
                    <IconButton size="small" onClick={() => handleViewFollowUpTask(task._id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  Assigned to: {task.assignedTo.firstName} {task.assignedTo.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Created: {format(new Date(task.createdAt), 'MMM dd, yyyy')}
                </Typography>
              </Box>

              {task.outcome && (
                <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Outcome: {task.outcome.status}
                  </Typography>
                  {task.outcome.notes && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Notes: {task.outcome.notes}
                    </Typography>
                  )}
                  {task.outcome.appointmentCreated && (
                    <Chip
                      label="Appointment Created"
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Appointments */}
        {appointments.map((appointment) => (
          <Card key={appointment._id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(appointment.status)}
                    <Box sx={{ ml: 1 }}>
                      {appointment.title}
                    </Box>
                  </Typography>
                  {appointment.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {appointment.description}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={appointment.type.replace('_', ' ')}
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    label={appointment.status}
                    color={getStatusColor(appointment.status) as any}
                    size="small"
                  />
                  <Tooltip title="View Appointment Details">
                    <IconButton size="small" onClick={() => handleViewAppointment(appointment._id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {appointment.assignedTo.firstName} {appointment.assignedTo.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  <ScheduleIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {format(new Date(appointment.scheduledDate), 'MMM dd, yyyy')} at {appointment.scheduledTime}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Duration: {appointment.duration} min
                </Typography>
              </Box>

              {appointment.outcome && (
                <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Outcome: {appointment.outcome.status}
                  </Typography>
                  {appointment.outcome.notes && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Notes: {appointment.outcome.notes}
                    </Typography>
                  )}
                  {appointment.outcome.visitCreated && (
                    <Chip
                      label="Visit Record Created"
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                  {appointment.outcome.nextActions && appointment.outcome.nextActions.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Next Actions:
                      </Typography>
                      <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                        {appointment.outcome.nextActions.map((action, index) => (
                          <li key={index}>
                            <Typography variant="caption">{action}</Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default DiagnosticLinkedAppointments;