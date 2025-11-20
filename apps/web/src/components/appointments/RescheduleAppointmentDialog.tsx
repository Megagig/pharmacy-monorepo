import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Grid,
  Stack,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, isBefore, startOfDay, isWeekend } from 'date-fns';

import { Appointment } from '../../stores/appointmentTypes';
import { useRescheduleAppointment, useAvailableSlots } from '../../hooks/useAppointments';

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSuccess?: (appointment: Appointment) => void;
}

interface FormData {
  newDate: Date;
  newTime: string;
  reason: string;
  notifyPatient: boolean;
}

const RescheduleAppointmentDialog: React.FC<RescheduleAppointmentDialogProps> = ({
  open,
  onClose,
  appointment,
  onSuccess,
}) => {
  // Form state
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      newDate: appointment ? addDays(new Date(appointment.scheduledDate), 1) : addDays(new Date(), 1),
      newTime: appointment?.scheduledTime || '09:00',
      reason: '',
      notifyPatient: true,
    },
    mode: 'onChange',
  });

  // Watch form values
  const watchedNewDate = watch('newDate');
  const watchedNewTime = watch('newTime');
  const watchedReason = watch('reason');

  // Local state
  const [availableSlotsDate, setAvailableSlotsDate] = useState<string>('');
  const [conflictChecked, setConflictChecked] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  // Mutations and queries
  const rescheduleAppointmentMutation = useRescheduleAppointment();

  // Available slots query
  const {
    data: availableSlotsData,
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useAvailableSlots(
    {
      date: availableSlotsDate,
      pharmacistId: appointment?.assignedTo,
      duration: appointment?.duration,
      type: appointment?.type,
    },
    !!availableSlotsDate && !!appointment
  );

  // Update available slots date when date changes
  useEffect(() => {
    if (watchedNewDate) {
      const dateStr = format(watchedNewDate, 'yyyy-MM-dd');
      setAvailableSlotsDate(dateStr);
      setConflictChecked(false);
      setHasConflict(false);
    }
  }, [watchedNewDate]);

  // Check for conflicts when time changes
  useEffect(() => {
    if (watchedNewTime && availableSlotsData?.data?.slots) {
      const slot = availableSlotsData.data.slots.find(s => s.time === watchedNewTime);
      setHasConflict(!slot?.available);
      setConflictChecked(true);
    }
  }, [watchedNewTime, availableSlotsData]);

  // Reset form when appointment changes
  useEffect(() => {
    if (appointment && open) {
      reset({
        newDate: addDays(new Date(appointment.scheduledDate), 1),
        newTime: appointment.scheduledTime,
        reason: '',
        notifyPatient: true,
      });
    }
  }, [appointment, open, reset]);

  // Get available time slots
  const availableSlots = useMemo(() => {
    return availableSlotsData?.data?.slots || [];
  }, [availableSlotsData]);

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    if (!appointment) return;

    try {
      const rescheduleData = {
        newDate: format(data.newDate, 'yyyy-MM-dd'),
        newTime: data.newTime,
        reason: data.reason,
        notifyPatient: data.notifyPatient,
      };

      const response = await rescheduleAppointmentMutation.mutateAsync({
        appointmentId: appointment._id,
        rescheduleData,
      });

      // Reset form and close dialog
      reset();
      onClose();
      
      // Call success callback if provided
      if (onSuccess && response.data?.appointment) {
        onSuccess(response.data.appointment);
      }
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    reset();
    setConflictChecked(false);
    setHasConflict(false);
    onClose();
  };

  // Generate time slots for selection
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }, []);

  // Check if selected time slot is available
  const isTimeSlotAvailable = (time: string) => {
    const slot = availableSlots.find(s => s.time === time);
    return slot?.available !== false;
  };

  // Check if the new date/time is different from current
  const isDateTimeChanged = useMemo(() => {
    if (!appointment) return false;
    
    const currentDate = format(new Date(appointment.scheduledDate), 'yyyy-MM-dd');
    const newDate = format(watchedNewDate, 'yyyy-MM-dd');
    
    return currentDate !== newDate || appointment.scheduledTime !== watchedNewTime;
  }, [appointment, watchedNewDate, watchedNewTime]);

  if (!appointment) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ScheduleIcon color="primary" />
              <Typography variant="h6">
                Reschedule Appointment
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Stack spacing={3}>
              {/* Current Appointment Details */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Current Appointment Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Type
                      </Typography>
                      <Typography variant="body1">
                        {appointment.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Current Date & Time
                      </Typography>
                      <Typography variant="body1">
                        {format(new Date(appointment.scheduledDate), 'MMM d, yyyy')} at {appointment.scheduledTime}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Duration
                      </Typography>
                      <Typography variant="body1">
                        {appointment.duration} minutes
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={appointment.status.replace('_', ' ').toUpperCase()}
                        color="primary"
                        size="small"
                      />
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

              <Divider />

              {/* New Date and Time Selection */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Select New Date & Time
                </Typography>
                
                <Grid container spacing={2}>
                  {/* New Date */}
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="newDate"
                      control={control}
                      rules={{ 
                        required: 'New date is required',
                        validate: (value) => {
                          if (isBefore(startOfDay(value), startOfDay(new Date()))) {
                            return 'Cannot reschedule to a past date';
                          }
                          return true;
                        }
                      }}
                      render={({ field }) => (
                        <DatePicker
                          {...field}
                          label="New Date"
                          minDate={new Date()}
                          maxDate={addDays(new Date(), 365)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.newDate,
                              helperText: errors.newDate?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>

                  {/* New Time */}
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="newTime"
                      control={control}
                      rules={{ required: 'New time is required' }}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.newTime}>
                          <InputLabel>New Time</InputLabel>
                          <Select {...field} label="New Time">
                            {timeSlots.map((time) => {
                              const available = isTimeSlotAvailable(time);
                              return (
                                <MenuItem 
                                  key={time} 
                                  value={time}
                                  disabled={!available}
                                  sx={{
                                    color: available ? 'inherit' : 'text.disabled',
                                  }}
                                >
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <AccessTimeIcon fontSize="small" />
                                    {time}
                                    {!available && (
                                      <Chip 
                                        label="Unavailable" 
                                        size="small" 
                                        color="error" 
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                          {errors.newTime && (
                            <FormHelperText>{errors.newTime.message}</FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                </Grid>

                {/* Date/Time Change Indicator */}
                {isDateTimeChanged && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    New appointment time: {format(watchedNewDate, 'MMM d, yyyy')} at {watchedNewTime}
                  </Alert>
                )}

                {!isDateTimeChanged && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Please select a different date or time to reschedule the appointment.
                  </Alert>
                )}
              </Box>

              {/* Available Slots Display */}
              {availableSlotsDate && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Available Time Slots for {format(watchedNewDate, 'MMMM dd, yyyy')}
                    </Typography>
                    
                    {loadingSlots ? (
                      <Box display="flex" justifyContent="center" p={2}>
                        <CircularProgress />
                      </Box>
                    ) : availableSlots.length > 0 ? (
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {availableSlots.map((slot) => (
                          <Chip
                            key={slot.time}
                            label={slot.time}
                            color={slot.available ? 'success' : 'error'}
                            variant={slot.time === watchedNewTime ? 'filled' : 'outlined'}
                            onClick={() => {
                              if (slot.available) {
                                setValue('newTime', slot.time);
                              }
                            }}
                            sx={{
                              cursor: slot.available ? 'pointer' : 'not-allowed',
                            }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="warning">
                        No available slots found for the selected date.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Conflict Warning */}
              {conflictChecked && hasConflict && (
                <Alert severity="error" icon={<WarningIcon />}>
                  <Typography variant="body2" fontWeight="medium">
                    Time Conflict Detected
                  </Typography>
                  The selected time slot is not available. Please choose a different time or date.
                </Alert>
              )}

              {/* Weekend Warning */}
              {isWeekend(watchedNewDate) && (
                <Alert severity="info">
                  You're rescheduling to a weekend. Please ensure the pharmacy is open on this day.
                </Alert>
              )}

              {/* Reason for Rescheduling */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Reason for Rescheduling
                </Typography>
                <Controller
                  name="reason"
                  control={control}
                  rules={{ 
                    required: 'Reason for rescheduling is required',
                    minLength: { value: 5, message: 'Reason must be at least 5 characters long' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Reason"
                      placeholder="Please provide a reason for rescheduling this appointment..."
                      multiline
                      rows={3}
                      fullWidth
                      error={!!errors.reason}
                      helperText={errors.reason?.message || 'This will be recorded in the appointment history'}
                    />
                  )}
                />
              </Box>

              {/* Patient Notification */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Patient Notification
                </Typography>
                <Controller
                  name="notifyPatient"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          {...field}
                          checked={field.value}
                          color="primary"
                        />
                      }
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <NotificationsIcon fontSize="small" />
                          <Box>
                            <Typography variant="body1">
                              Notify Patient
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Send notification about the rescheduled appointment
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  )}
                />

                {watch('notifyPatient') && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    The patient will be notified via their preferred communication channel about the new appointment time.
                  </Alert>
                )}
              </Box>

              {/* Validation Summary */}
              {Object.keys(errors).length > 0 && (
                <Alert severity="error">
                  <Typography variant="body2" fontWeight="medium">
                    Please fix the following errors:
                  </Typography>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    {errors.newDate && <li>{errors.newDate.message}</li>}
                    {errors.newTime && <li>{errors.newTime.message}</li>}
                    {errors.reason && <li>{errors.reason.message}</li>}
                  </ul>
                </Alert>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={
                isSubmitting || 
                !isDateTimeChanged || 
                (conflictChecked && hasConflict) ||
                !watchedReason.trim()
              }
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <ScheduleIcon />}
            >
              {isSubmitting ? 'Rescheduling...' : 'Reschedule Appointment'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
};

export default RescheduleAppointmentDialog;