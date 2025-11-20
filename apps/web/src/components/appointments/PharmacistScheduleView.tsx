import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Paper,
  LinearProgress,
  Avatar,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Event as EventIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import {
  usePharmacistSchedule,
  useUpdatePharmacistSchedule,
  useRequestTimeOff,
  useUpdateTimeOffStatus,
  useCapacityReport,
} from '../../hooks/usePharmacistSchedule';
import { useUpcomingAppointments } from '../../hooks/useAppointments';
import { useNotification } from '../../hooks/useNotification';
import { PharmacistSchedule, TimeOffRequest } from '../../services/pharmacistScheduleService';
import { usePharmacistSelection } from '../../hooks/usePharmacistSelection';

interface PharmacistScheduleViewProps {
  pharmacistId?: string;
  canEdit?: boolean;
  showCapacityMetrics?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const PharmacistScheduleView: React.FC<PharmacistScheduleViewProps> = ({
  pharmacistId: propPharmacistId,
  canEdit = false,
  showCapacityMetrics = true,
}) => {
  const [internalPharmacistId, setInternalPharmacistId] = useState<string>('');
  
  // Use prop pharmacistId if provided, otherwise use internal state
  const pharmacistId = propPharmacistId || internalPharmacistId;

  // Handle case where no pharmacistId is provided - show selection
  if (!pharmacistId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Schedule Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please select a pharmacist to view their schedule
        </Typography>
        
        {/* Pharmacist Selection */}
        <PharmacistSelector 
          onSelect={setInternalPharmacistId}
          selectedId={internalPharmacistId}
        />
      </Box>
    );
  }

  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PharmacistSchedule | null>(null);
  const [timeOffForm, setTimeOffForm] = useState<TimeOffRequest>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    reason: '',
    type: 'vacation',
  });

  const { showNotification } = useNotification();

  // Queries
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = usePharmacistSchedule(pharmacistId);

  const {
    data: upcomingAppointments,
    isLoading: appointmentsLoading,
  } = useUpcomingAppointments({ pharmacistId, days: 7 });

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  
  const {
    data: capacityData,
    isLoading: capacityLoading,
  } = useCapacityReport(
    {
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      pharmacistId,
    },
    showCapacityMetrics
  );

  // Mutations
  const updateScheduleMutation = useUpdatePharmacistSchedule();
  const requestTimeOffMutation = useRequestTimeOff();
  const updateTimeOffStatusMutation = useUpdateTimeOffStatus();

  const schedule = scheduleData?.data?.schedule;
  const upcomingTimeOff = scheduleData?.data?.upcomingTimeOff || [];
  const utilizationRate = scheduleData?.data?.utilizationRate || 0;

  // Day names for display
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get working hours summary
  const workingHoursSummary = useMemo(() => {
    if (!schedule?.workingHours) return null;

    const workingDays = schedule.workingHours.filter(wh => wh.isWorkingDay);
    const totalHours = workingDays.reduce((total, day) => {
      return total + day.shifts.reduce((dayTotal, shift) => {
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        let shiftMinutes = endMinutes - startMinutes;

        // Subtract break time if provided
        if (shift.breakStart && shift.breakEnd) {
          const [breakStartHour, breakStartMin] = shift.breakStart.split(':').map(Number);
          const [breakEndHour, breakEndMin] = shift.breakEnd.split(':').map(Number);
          const breakStartMinutes = breakStartHour * 60 + breakStartMin;
          const breakEndMinutes = breakEndHour * 60 + breakEndMin;
          shiftMinutes -= (breakEndMinutes - breakStartMinutes);
        }

        return dayTotal + shiftMinutes / 60;
      }, 0);
    }, 0);

    return {
      workingDays: workingDays.length,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHoursPerDay: workingDays.length > 0 ? Math.round((totalHours / workingDays.length) * 10) / 10 : 0,
    };
  }, [schedule?.workingHours]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle edit schedule
  const handleEditSchedule = () => {
    if (schedule) {
      setEditingSchedule({ ...schedule });
      setEditDialogOpen(true);
    }
  };

  // Handle save schedule
  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;

    try {
      await updateScheduleMutation.mutateAsync({
        pharmacistId,
        scheduleData: {
          workingHours: editingSchedule.workingHours,
          appointmentPreferences: editingSchedule.appointmentPreferences,
          isActive: editingSchedule.isActive,
        },
      });

      showNotification('Schedule updated successfully', 'success');
      setEditDialogOpen(false);
      setEditingSchedule(null);
    } catch (error) {
      showNotification('Failed to update schedule', 'error');
    }
  };

  // Handle request time off
  const handleRequestTimeOff = async () => {
    try {
      const response = await requestTimeOffMutation.mutateAsync({
        pharmacistId,
        timeOffData: timeOffForm,
      });

      const affectedCount = response.data?.affectedAppointments?.length || 0;
      let message = 'Time-off request submitted successfully';
      
      if (affectedCount > 0) {
        message += `. ${affectedCount} appointment(s) may need rescheduling.`;
      }

      showNotification(message, 'success');
      setTimeOffDialogOpen(false);
      setTimeOffForm({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        reason: '',
        type: 'vacation',
      });
    } catch (error) {
      showNotification('Failed to submit time-off request', 'error');
    }
  };

  // Handle time-off status update
  const handleTimeOffStatusUpdate = async (
    timeOffId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await updateTimeOffStatusMutation.mutateAsync({
        pharmacistId,
        timeOffId,
        status,
      });

      showNotification(`Time-off request ${status} successfully`, 'success');
    } catch (error) {
      showNotification(`Failed to ${status} time-off request`, 'error');
    }
  };

  // Get status color for time-off
  const getTimeOffStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get status icon for time-off
  const getTimeOffStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon />;
      case 'rejected':
        return <CancelIcon />;
      case 'pending':
        return <PendingIcon />;
      default:
        return null;
    }
  };

  if (scheduleLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (scheduleError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load pharmacist schedule. Please try again.
      </Alert>
    );
  }

  if (!schedule) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No schedule found for this pharmacist.
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: '100%' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <ScheduleIcon color="primary" />
            <Typography variant="h5">
              {schedule.pharmacist ? 
                `${schedule.pharmacist.firstName} ${schedule.pharmacist.lastName}'s Schedule` :
                'Pharmacist Schedule'
              }
            </Typography>
          </Box>
          
          {canEdit && (
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setTimeOffDialogOpen(true)}
                size="small"
              >
                Request Time Off
              </Button>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleEditSchedule}
                size="small"
              >
                Edit Schedule
              </Button>
            </Box>
          )}
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <PersonIcon color="primary" />
                  <Box>
                    <Typography variant="h6">{workingHoursSummary?.workingDays || 0}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Working Days/Week
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <TimeIcon color="primary" />
                  <Box>
                    <Typography variant="h6">{workingHoursSummary?.totalHours || 0}h</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Hours/Week
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <TrendingUpIcon color="primary" />
                  <Box>
                    <Typography variant="h6">{utilizationRate}%</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Utilization Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <EventIcon color="primary" />
                  <Box>
                    <Typography variant="h6">
                      {upcomingAppointments?.data?.summary?.thisWeek || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Appointments This Week
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="schedule tabs">
              <Tab label="Working Hours" />
              <Tab label="Time Off" />
              <Tab label="Capacity" />
              <Tab label="Upcoming Appointments" />
            </Tabs>
          </Box>

          {/* Working Hours Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              {schedule.workingHours.map((daySchedule) => (
                <Grid item xs={12} md={6} lg={4} key={daySchedule.dayOfWeek}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {dayNames[daySchedule.dayOfWeek]}
                    </Typography>
                    
                    {daySchedule.isWorkingDay ? (
                      <Box>
                        {daySchedule.shifts.map((shift, index) => (
                          <Box key={index} mb={1}>
                            <Typography variant="body1">
                              {shift.startTime} - {shift.endTime}
                            </Typography>
                            {shift.breakStart && shift.breakEnd && (
                              <Typography variant="body2" color="textSecondary">
                                Break: {shift.breakStart} - {shift.breakEnd}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Not working
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Appointment Preferences */}
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Appointment Preferences
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Max Appointments/Day
                  </Typography>
                  <Typography variant="body1">
                    {schedule.appointmentPreferences.maxAppointmentsPerDay || 'Unlimited'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Default Duration
                  </Typography>
                  <Typography variant="body1">
                    {schedule.appointmentPreferences.defaultDuration} minutes
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Buffer Between Appointments
                  </Typography>
                  <Typography variant="body1">
                    {schedule.appointmentPreferences.bufferBetweenAppointments || 0} minutes
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="textSecondary">
                    Appointment Types
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                    {schedule.appointmentPreferences.appointmentTypes.map((type) => (
                      <Chip
                        key={type}
                        label={type.replace('_', ' ')}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Time Off Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Time Off Requests</Typography>
              {canEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setTimeOffDialogOpen(true)}
                  size="small"
                >
                  Request Time Off
                </Button>
              )}
            </Box>

            {upcomingTimeOff.length === 0 ? (
              <Alert severity="info">
                No upcoming time-off requests.
              </Alert>
            ) : (
              <List>
                {upcomingTimeOff.map((timeOff, index) => (
                  <React.Fragment key={timeOff._id || index}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">
                              {format(new Date(timeOff.startDate), 'MMM dd')} - {format(new Date(timeOff.endDate), 'MMM dd, yyyy')}
                            </Typography>
                            <Chip
                              icon={getTimeOffStatusIcon(timeOff.status)}
                              label={timeOff.status}
                              color={getTimeOffStatusColor(timeOff.status) as any}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              Type: {timeOff.type.replace('_', ' ')}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Reason: {timeOff.reason}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      {canEdit && timeOff.status === 'pending' && (
                        <ListItemSecondaryAction>
                          <Tooltip title="Approve">
                            <IconButton
                              edge="end"
                              color="success"
                              onClick={() => handleTimeOffStatusUpdate(timeOff._id!, 'approved')}
                              disabled={updateTimeOffStatusMutation.isPending}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              edge="end"
                              color="error"
                              onClick={() => handleTimeOffStatusUpdate(timeOff._id!, 'rejected')}
                              disabled={updateTimeOffStatusMutation.isPending}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                    {index < upcomingTimeOff.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </TabPanel>

          {/* Capacity Tab */}
          <TabPanel value={activeTab} index={2}>
            {capacityLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : capacityData?.data ? (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Capacity Utilization (This Week)
                </Typography>
                
                <Grid container spacing={3} mb={4}>
                  <Grid item xs={12} sm={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {capacityData.data.overall.utilizationRate}%
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Overall Utilization
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={capacityData.data.overall.utilizationRate}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {capacityData.data.overall.bookedSlots}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Booked Slots
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {capacityData.data.overall.totalSlots - capacityData.data.overall.bookedSlots}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Available Slots
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Daily Breakdown */}
                {capacityData.data.byDay && capacityData.data.byDay.length > 0 && (
                  <Box mb={4}>
                    <Typography variant="h6" gutterBottom>
                      Daily Breakdown
                    </Typography>
                    <Grid container spacing={2}>
                      {capacityData.data.byDay.map((day) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={day.date}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              {day.dayName}
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {day.utilizationRate}%
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {day.bookedSlots}/{day.totalSlots} slots
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={day.utilizationRate}
                              sx={{ mt: 1 }}
                            />
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Recommendations */}
                {capacityData.data.recommendations && capacityData.data.recommendations.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Recommendations
                    </Typography>
                    {capacityData.data.recommendations.map((recommendation, index) => (
                      <Alert key={index} severity="info" sx={{ mb: 1 }}>
                        {recommendation}
                      </Alert>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                No capacity data available for the selected period.
              </Alert>
            )}
          </TabPanel>

          {/* Upcoming Appointments Tab */}
          <TabPanel value={activeTab} index={3}>
            {appointmentsLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : upcomingAppointments?.data?.appointments && upcomingAppointments.data.appointments.length > 0 ? (
              <List>
                {upcomingAppointments.data.appointments.map((appointment, index) => (
                  <React.Fragment key={appointment._id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1">
                            {appointment.type.replace('_', ' ')} - {appointment.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {format(new Date(appointment.scheduledDate), 'MMM dd, yyyy')} at {appointment.scheduledTime}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Duration: {appointment.duration} minutes
                            </Typography>
                            {appointment.description && (
                              <Typography variant="body2" color="textSecondary">
                                {appointment.description}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Chip
                        label={appointment.status}
                        color={appointment.status === 'confirmed' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                    {index < upcomingAppointments.data.appointments.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                No upcoming appointments in the next 7 days.
              </Alert>
            )}
          </TabPanel>
        </Card>

        {/* Time Off Request Dialog */}
        <Dialog
          open={timeOffDialogOpen}
          onClose={() => setTimeOffDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={timeOffForm.startDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, startDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={timeOffForm.endDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, endDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={timeOffForm.type}
                    label="Type"
                    onChange={(e) => setTimeOffForm(prev => ({ ...prev, type: e.target.value as any }))}
                  >
                    <MenuItem value="vacation">Vacation</MenuItem>
                    <MenuItem value="sick_leave">Sick Leave</MenuItem>
                    <MenuItem value="personal">Personal</MenuItem>
                    <MenuItem value="training">Training</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason"
                  multiline
                  rows={3}
                  value={timeOffForm.reason}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Please provide a reason for your time-off request..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTimeOffDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestTimeOff}
              variant="contained"
              disabled={requestTimeOffMutation.isPending || !timeOffForm.reason.trim()}
            >
              {requestTimeOffMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

// Pharmacist Selector Component
interface PharmacistSelectorProps {
  onSelect: (pharmacistId: string) => void;
  selectedId: string;
}

const PharmacistSelector: React.FC<PharmacistSelectorProps> = ({ onSelect, selectedId }) => {
  const { pharmacists, isLoading } = usePharmacistSelection();

  if (isLoading) {
    return <CircularProgress size={24} />;
  }

  if (pharmacists.length === 0) {
    return (
      <Alert severity="info">
        No pharmacists found. Please ensure pharmacists are added to your workspace.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto' }}>
      <FormControl fullWidth>
        <InputLabel>Select Pharmacist</InputLabel>
        <Select
          value={selectedId}
          label="Select Pharmacist"
          onChange={(e) => onSelect(e.target.value)}
        >
          {pharmacists.map((pharmacist) => (
            <MenuItem key={pharmacist.id} value={pharmacist.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {pharmacist.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="body1">{pharmacist.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pharmacist.role} • {pharmacist.email}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default PharmacistScheduleView;