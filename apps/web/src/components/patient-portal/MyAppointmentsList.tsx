import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Collapse,
  Paper,
  Stack,
} from '@mui/material';
import {
  Schedule,
  Person,
  LocationOn,
  Edit,
  Cancel,
  Visibility,
  ExpandMore,
  ExpandLess,
  CalendarToday,
  AccessTime,
  Notes,
  Phone,
  Email,
  CheckCircle,
  Warning,
  Error,
  Info,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, isAfter, isBefore, isToday, isTomorrow, addDays } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';

import { 
  useMyAppointments, 
  useRescheduleAppointment, 
  useCancelAppointment,
  useAvailableSlots,
} from '../../hooks/usePatientPortal';
import { PatientAppointment } from '../../services/patientPortalService';

interface MyAppointmentsListProps {
  workplaceId: string;
  patientId: string;
  onAppointmentUpdate?: (appointment: PatientAppointment) => void;
}

interface RescheduleFormData {
  newDate: Date;
  newTime: string;
  reason: string;
}

interface CancelFormData {
  reason: string;
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
      id={`appointments-tabpanel-${index}`}
      aria-labelledby={`appointments-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const MyAppointmentsList: React.FC<MyAppointmentsListProps> = ({
  workplaceId,
  patientId,
  onAppointmentUpdate,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState<PatientAppointment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);

  // Form management
  const rescheduleForm = useForm<RescheduleFormData>({
    defaultValues: {
      newDate: new Date(),
      newTime: '',
      reason: '',
    },
  });

  const cancelForm = useForm<CancelFormData>({
    defaultValues: {
      reason: '',
    },
  });

  // API hooks
  const { 
    data: appointmentsResponse, 
    isLoading, 
    error,
    refetch 
  } = useMyAppointments({
    includeCompleted: true,
    includeCancelled: true,
    limit: 50,
  });

  const { 
    data: availableSlotsResponse, 
    isLoading: loadingSlots 
  } = useAvailableSlots(
    {
      workplaceId,
      date: format(rescheduleForm.watch('newDate'), 'yyyy-MM-dd'),
      type: selectedAppointment?.type,
      duration: selectedAppointment?.duration,
    },
    showRescheduleDialog && !!selectedAppointment
  );

  const rescheduleAppointmentMutation = useRescheduleAppointment();
  const cancelAppointmentMutation = useCancelAppointment();

  // Extract data
  const appointments = appointmentsResponse?.data?.appointments || [];
  const availableSlots = availableSlotsResponse?.data?.slots || [];

  // Categorize appointments
  const { upcomingAppointments, pastAppointments } = useMemo(() => {
    const now = new Date();
    const upcoming: PatientAppointment[] = [];
    const past: PatientAppointment[] = [];

    appointments.forEach(appointment => {
      const appointmentDateTime = parseISO(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
      
      if (isAfter(appointmentDateTime, now) && appointment.status !== 'cancelled') {
        upcoming.push(appointment);
      } else {
        past.push(appointment);
      }
    });

    // Sort upcoming by date (earliest first)
    upcoming.sort((a, b) => 
      parseISO(`${a.scheduledDate}T${a.scheduledTime}`).getTime() - 
      parseISO(`${b.scheduledDate}T${b.scheduledTime}`).getTime()
    );

    // Sort past by date (most recent first)
    past.sort((a, b) => 
      parseISO(`${b.scheduledDate}T${b.scheduledTime}`).getTime() - 
      parseISO(`${a.scheduledDate}T${a.scheduledTime}`).getTime()
    );

    return { upcomingAppointments: upcoming, pastAppointments: past };
  }, [appointments]);

  // Status badge configuration
  const getStatusBadge = (appointment: PatientAppointment) => {
    const statusConfig = {
      scheduled: { color: 'info' as const, icon: <Schedule />, label: 'Scheduled' },
      confirmed: { color: 'success' as const, icon: <CheckCircle />, label: 'Confirmed' },
      in_progress: { color: 'warning' as const, icon: <AccessTime />, label: 'In Progress' },
      completed: { color: 'success' as const, icon: <CheckCircle />, label: 'Completed' },
      cancelled: { color: 'error' as const, icon: <Cancel />, label: 'Cancelled' },
      no_show: { color: 'error' as const, icon: <Error />, label: 'No Show' },
      rescheduled: { color: 'warning' as const, icon: <Edit />, label: 'Rescheduled' },
    };

    const config = statusConfig[appointment.status as keyof typeof statusConfig] || 
                   statusConfig.scheduled;

    return (
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
      />
    );
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d, yyyy');
  };

  // Handle appointment actions
  const handleViewDetails = (appointment: PatientAppointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsDialog(true);
  };

  const handleReschedule = (appointment: PatientAppointment) => {
    setSelectedAppointment(appointment);
    rescheduleForm.reset({
      newDate: addDays(new Date(), 1), // Default to tomorrow
      newTime: '',
      reason: '',
    });
    setShowRescheduleDialog(true);
  };

  const handleCancel = (appointment: PatientAppointment) => {
    setSelectedAppointment(appointment);
    cancelForm.reset({ reason: '' });
    setShowCancelDialog(true);
  };

  const handleToggleExpand = (appointmentId: string) => {
    setExpandedAppointment(
      expandedAppointment === appointmentId ? null : appointmentId
    );
  };

  // Form submissions
  const onRescheduleSubmit = async (data: RescheduleFormData) => {
    if (!selectedAppointment) return;

    try {
      const response = await rescheduleAppointmentMutation.mutateAsync({
        appointmentId: selectedAppointment._id,
        rescheduleData: {
          newDate: format(data.newDate, 'yyyy-MM-dd'),
          newTime: data.newTime,
          reason: data.reason,
          notifyPharmacist: true,
        },
      });

      onAppointmentUpdate?.(response.data.appointment);
      setShowRescheduleDialog(false);
      setSelectedAppointment(null);
      refetch();
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
    }
  };

  const onCancelSubmit = async (data: CancelFormData) => {
    if (!selectedAppointment) return;

    try {
      const response = await cancelAppointmentMutation.mutateAsync({
        appointmentId: selectedAppointment._id,
        cancelData: {
          reason: data.reason,
          notifyPharmacist: true,
        },
      });

      onAppointmentUpdate?.(response.data.appointment);
      setShowCancelDialog(false);
      setSelectedAppointment(null);
      refetch();
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    }
  };

  // Render appointment card
  const renderAppointmentCard = (appointment: PatientAppointment) => {
    const isExpanded = expandedAppointment === appointment._id;
    const appointmentDateTime = parseISO(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
    const isUpcoming = isAfter(appointmentDateTime, new Date());

    return (
      <Card 
        key={appointment._id} 
        sx={{ 
          mb: 2,
          border: isUpcoming ? `1px solid ${theme.palette.primary.main}` : undefined,
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
        }}
      >
        <CardContent>
          <Grid container spacing={2} alignItems="flex-start">
            {/* Main appointment info */}
            <Grid item xs={12} sm={8}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h6" component="h3">
                  {appointment.title || appointment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Typography>
                {getStatusBadge(appointment)}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarToday fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {formatDateDisplay(appointment.scheduledDate)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {appointment.scheduledTime} ({appointment.duration} min)
                  </Typography>
                </Box>
              </Box>

              {appointment.pharmacistName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {appointment.pharmacistName}
                  </Typography>
                </Box>
              )}

              {appointment.locationName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {appointment.locationName}
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* Action buttons */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                justifyContent: isMobile ? 'flex-start' : 'flex-end',
                flexWrap: 'wrap',
              }}>
                <Tooltip title="View Details">
                  <IconButton 
                    size="small" 
                    onClick={() => handleViewDetails(appointment)}
                  >
                    <Visibility />
                  </IconButton>
                </Tooltip>

                {appointment.canReschedule && isUpcoming && (
                  <Tooltip title="Reschedule">
                    <IconButton 
                      size="small" 
                      onClick={() => handleReschedule(appointment)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                )}

                {appointment.canCancel && isUpcoming && (
                  <Tooltip title="Cancel">
                    <IconButton 
                      size="small" 
                      onClick={() => handleCancel(appointment)}
                      color="error"
                    >
                      <Cancel />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title={isExpanded ? "Show Less" : "Show More"}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleToggleExpand(appointment._id)}
                  >
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>

          {/* Expanded details */}
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {appointment.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {appointment.description}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Appointment Type
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {appointment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Confirmation Status
                </Typography>
                <Chip
                  label={appointment.confirmationStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  size="small"
                  color={appointment.confirmationStatus === 'confirmed' ? 'success' : 'default'}
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  // Render empty state
  const renderEmptyState = (type: 'upcoming' | 'past') => (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Schedule sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No {type} appointments
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {type === 'upcoming' 
          ? "You don't have any upcoming appointments scheduled."
          : "You don't have any past appointments to show."
        }
      </Typography>
    </Paper>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load appointments. Please try again.
        <Button onClick={() => refetch()} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        My Appointments
      </Typography>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {upcomingAppointments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upcoming
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="text.secondary">
                {pastAppointments.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Past
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="appointment tabs"
        >
          <Tab 
            label={`Upcoming (${upcomingAppointments.length})`} 
            id="appointments-tab-0"
            aria-controls="appointments-tabpanel-0"
          />
          <Tab 
            label={`Past (${pastAppointments.length})`} 
            id="appointments-tab-1"
            aria-controls="appointments-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Tab panels */}
      <TabPanel value={activeTab} index={0}>
        {upcomingAppointments.length === 0 ? (
          renderEmptyState('upcoming')
        ) : (
          <Box>
            {upcomingAppointments.map(renderAppointmentCard)}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {pastAppointments.length === 0 ? (
          renderEmptyState('past')
        ) : (
          <Box>
            {pastAppointments.map(renderAppointmentCard)}
          </Box>
        )}
      </TabPanel>

      {/* Appointment Details Dialog */}
      <Dialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule color="primary" />
            Appointment Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAppointment && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {selectedAppointment.title || selectedAppointment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Typography>
                {getStatusBadge(selectedAppointment)}
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Date & Time
                </Typography>
                <Typography variant="body1">
                  {formatDateDisplay(selectedAppointment.scheduledDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedAppointment.scheduledTime} ({selectedAppointment.duration} minutes)
                </Typography>
              </Grid>

              {selectedAppointment.pharmacistName && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Pharmacist
                  </Typography>
                  <Typography variant="body1">
                    {selectedAppointment.pharmacistName}
                  </Typography>
                </Grid>
              )}

              {selectedAppointment.locationName && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Location
                  </Typography>
                  <Typography variant="body1">
                    {selectedAppointment.locationName}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Confirmation Status
                </Typography>
                <Chip
                  label={selectedAppointment.confirmationStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  color={selectedAppointment.confirmationStatus === 'confirmed' ? 'success' : 'default'}
                  variant="outlined"
                />
              </Grid>

              {selectedAppointment.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {selectedAppointment.description}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={showRescheduleDialog}
        onClose={() => setShowRescheduleDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit color="primary" />
            Reschedule Appointment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  New Date
                </Typography>
                <Controller
                  name="newDate"
                  control={rescheduleForm.control}
                  rules={{ required: 'Please select a new date' }}
                  render={({ field, fieldState: { error } }) => (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        {...field}
                        minDate={new Date()}
                        maxDate={addDays(new Date(), 90)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            error: !!error,
                            helperText: error?.message,
                          },
                        }}
                      />
                    </LocalizationProvider>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Available Time Slots
                </Typography>
                {loadingSlots ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : availableSlots.length === 0 ? (
                  <Alert severity="info">
                    No available slots for the selected date. Please choose a different date.
                  </Alert>
                ) : (
                  <Controller
                    name="newTime"
                    control={rescheduleForm.control}
                    rules={{ required: 'Please select a time slot' }}
                    render={({ field, fieldState: { error } }) => (
                      <FormControl component="fieldset" error={!!error} fullWidth>
                        <RadioGroup {...field} row>
                          {availableSlots.map((slot) => (
                            <FormControlLabel
                              key={slot.time}
                              value={slot.time}
                              control={<Radio />}
                              label={slot.time}
                              disabled={!slot.available}
                            />
                          ))}
                        </RadioGroup>
                        {error && (
                          <Typography variant="caption" color="error">
                            {error.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                )}
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="reason"
                  control={rescheduleForm.control}
                  rules={{ required: 'Please provide a reason for rescheduling' }}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      {...field}
                      label="Reason for Rescheduling"
                      multiline
                      rows={3}
                      fullWidth
                      error={!!error}
                      helperText={error?.message}
                      placeholder="Please explain why you need to reschedule..."
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRescheduleDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={rescheduleForm.handleSubmit(onRescheduleSubmit)}
            disabled={rescheduleAppointmentMutation.isPending}
          >
            {rescheduleAppointmentMutation.isPending ? 'Rescheduling...' : 'Reschedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Cancel color="error" />
            Cancel Appointment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Are you sure you want to cancel this appointment? This action cannot be undone.
          </Typography>
          
          <Controller
            name="reason"
            control={cancelForm.control}
            rules={{ required: 'Please provide a reason for cancellation' }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Reason for Cancellation"
                multiline
                rows={3}
                fullWidth
                error={!!error}
                helperText={error?.message}
                placeholder="Please explain why you need to cancel..."
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)}>
            Keep Appointment
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={cancelForm.handleSubmit(onCancelSubmit)}
            disabled={cancelAppointmentMutation.isPending}
          >
            {cancelAppointmentMutation.isPending ? 'Cancelling...' : 'Cancel Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyAppointmentsList;