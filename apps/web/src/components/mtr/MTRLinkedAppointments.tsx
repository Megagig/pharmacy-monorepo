import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engagementIntegrationApi } from '../../services/api/engagementIntegrationApi';
import { useNotification } from '../../hooks/useNotification';

interface MTRLinkedAppointmentsProps {
  mtrSessionId: string;
  patientId: string;
  onAppointmentCreated?: () => void;
}

interface Appointment {
  _id: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
  confirmationStatus: string;
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface MTRFollowUp {
  _id: string;
  type: string;
  description: string;
  scheduledDate: string;
  status: string;
  priority: string;
  assignedTo: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

const MTRLinkedAppointments: React.FC<MTRLinkedAppointmentsProps> = ({
  mtrSessionId,
  patientId,
  onAppointmentCreated,
}) => {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [appointmentData, setAppointmentData] = useState({
    scheduledDate: new Date(),
    scheduledTime: '10:00',
    duration: 60,
    description: '',
    objectives: [''],
    priority: 'medium' as 'high' | 'medium' | 'low',
  });

  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  // Fetch MTR session with linked appointments
  const {
    data: mtrData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mtr-session-appointments', mtrSessionId],
    queryFn: () => engagementIntegrationApi.getMTRSessionWithAppointment(mtrSessionId),
    enabled: !!mtrSessionId,
  });

  // Create MTR with appointment mutation
  const createMTRWithAppointmentMutation = useMutation({
    mutationFn: (data: any) =>
      engagementIntegrationApi.createMTRWithAppointment(mtrSessionId, data),
    onSuccess: () => {
      showNotification('MTR follow-up with appointment scheduled successfully', 'success');
      setScheduleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mtr-session-appointments', mtrSessionId] });
      onAppointmentCreated?.();
    },
    onError: (error: any) => {
      showNotification(error.message || 'Failed to schedule MTR follow-up', 'error');
    },
  });

  const handleScheduleSubmit = () => {
    if (!appointmentData.description.trim()) {
      showNotification('Description is required', 'error');
      return;
    }

    if (appointmentData.objectives.some(obj => !obj.trim())) {
      showNotification('All objectives must be filled', 'error');
      return;
    }

    const submitData = {
      patientId,
      assignedTo: mtrData?.mtrSession?.pharmacistId || patientId, // Use current user or fallback
      scheduledDate: appointmentData.scheduledDate.toISOString(),
      scheduledTime: appointmentData.scheduledTime,
      duration: appointmentData.duration,
      description: appointmentData.description,
      objectives: appointmentData.objectives.filter(obj => obj.trim()),
      priority: appointmentData.priority,
    };

    createMTRWithAppointmentMutation.mutate(submitData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'scheduled':
      case 'confirmed':
        return 'primary';
      case 'cancelled':
        return 'error';
      case 'no_show':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon />;
      case 'cancelled':
        return <CancelIcon />;
      default:
        return <AccessTimeIcon />;
    }
  };

  const addObjective = () => {
    setAppointmentData(prev => ({
      ...prev,
      objectives: [...prev.objectives, ''],
    }));
  };

  const updateObjective = (index: number, value: string) => {
    setAppointmentData(prev => ({
      ...prev,
      objectives: prev.objectives.map((obj, i) => (i === index ? value : obj)),
    }));
  };

  const removeObjective = (index: number) => {
    if (appointmentData.objectives.length > 1) {
      setAppointmentData(prev => ({
        ...prev,
        objectives: prev.objectives.filter((_, i) => i !== index),
      }));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load linked appointments: {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { linkedAppointments = [], followUps = [] } = mtrData || {};

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <LinkIcon />
              Linked Appointments & Follow-ups
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
              size="small"
            >
              Schedule MTR Follow-up
            </Button>
          </Box>

          {linkedAppointments.length === 0 && followUps.length === 0 ? (
            <Alert severity="info">
              No appointments or follow-ups linked to this MTR session.
              Click "Schedule MTR Follow-up" to create one.
            </Alert>
          ) : (
            <Box>
              {/* Linked Appointments */}
              {linkedAppointments.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    Appointments ({linkedAppointments.length})
                  </Typography>
                  <List dense>
                    {linkedAppointments.map((appointment: Appointment) => (
                      <ListItem key={appointment._id} divider>
                        <ListItemIcon>
                          <EventIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1">
                                {appointment.title}
                              </Typography>
                              <Chip
                                icon={getStatusIcon(appointment.status)}
                                label={appointment.status.replace('_', ' ').toUpperCase()}
                                color={getStatusColor(appointment.status) as any}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                {format(new Date(appointment.scheduledDate), 'MMM dd, yyyy')} at{' '}
                                {appointment.scheduledTime} ({appointment.duration} min)
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Assigned to: {appointment.assignedTo.firstName}{' '}
                                {appointment.assignedTo.lastName}
                              </Typography>
                              {appointment.description && (
                                <Typography variant="body2" color="textSecondary">
                                  {appointment.description}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* MTR Follow-ups */}
              {followUps.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    MTR Follow-ups ({followUps.length})
                  </Typography>
                  <List dense>
                    {followUps.map((followUp: MTRFollowUp) => (
                      <ListItem key={followUp._id} divider>
                        <ListItemIcon>
                          <ScheduleIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1">
                                {followUp.type.replace('_', ' ').toUpperCase()}
                              </Typography>
                              <Chip
                                label={followUp.status.replace('_', ' ').toUpperCase()}
                                color={getStatusColor(followUp.status) as any}
                                size="small"
                              />
                              <Chip
                                label={followUp.priority.toUpperCase()}
                                color={followUp.priority === 'high' ? 'error' : 'default'}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                Due: {format(new Date(followUp.scheduledDate), 'MMM dd, yyyy')}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Assigned to: {followUp.assignedTo.firstName}{' '}
                                {followUp.assignedTo.lastName}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {followUp.description}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Schedule MTR Follow-up Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Schedule MTR Follow-up with Appointment</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box display="flex" flexDirection="column" gap={3} pt={1}>
              <TextField
                label="Description"
                multiline
                rows={3}
                value={appointmentData.description}
                onChange={(e) =>
                  setAppointmentData(prev => ({ ...prev, description: e.target.value }))
                }
                required
                fullWidth
              />

              <Box display="flex" gap={2}>
                <DatePicker
                  label="Scheduled Date"
                  value={appointmentData.scheduledDate}
                  onChange={(date) =>
                    setAppointmentData(prev => ({ ...prev, scheduledDate: date || new Date() }))
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
                <TimePicker
                  label="Scheduled Time"
                  value={new Date(`2000-01-01T${appointmentData.scheduledTime}:00`)}
                  onChange={(time) => {
                    if (time) {
                      const timeString = format(time, 'HH:mm');
                      setAppointmentData(prev => ({ ...prev, scheduledTime: timeString }));
                    }
                  }}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Box>

              <Box display="flex" gap={2}>
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  value={appointmentData.duration}
                  onChange={(e) =>
                    setAppointmentData(prev => ({ ...prev, duration: parseInt(e.target.value) }))
                  }
                  inputProps={{ min: 15, max: 240 }}
                  fullWidth
                />
                <TextField
                  label="Priority"
                  select
                  value={appointmentData.priority}
                  onChange={(e) =>
                    setAppointmentData(prev => ({ ...prev, priority: e.target.value as any }))
                  }
                  fullWidth
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </TextField>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Objectives
                </Typography>
                {appointmentData.objectives.map((objective, index) => (
                  <Box key={index} display="flex" gap={1} mb={1}>
                    <TextField
                      label={`Objective ${index + 1}`}
                      value={objective}
                      onChange={(e) => updateObjective(index, e.target.value)}
                      fullWidth
                      required
                    />
                    {appointmentData.objectives.length > 1 && (
                      <IconButton onClick={() => removeObjective(index)} color="error">
                        <CancelIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addObjective}
                  variant="outlined"
                  size="small"
                >
                  Add Objective
                </Button>
              </Box>
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={createMTRWithAppointmentMutation.isPending}
          >
            {createMTRWithAppointmentMutation.isPending ? (
              <CircularProgress size={20} />
            ) : (
              'Schedule Follow-up'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MTRLinkedAppointments;