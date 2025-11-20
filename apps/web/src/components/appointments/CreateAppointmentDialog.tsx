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
  Autocomplete,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Event as EventIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Repeat as RepeatIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, isWeekend, isBefore, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';

import { AppointmentFormData, AppointmentType } from '../../stores/appointmentTypes';
import { useCreateAppointment, useAvailableSlots, useValidateSlot, useNextAvailableSlot } from '../../hooks/useAppointments';
import { useSearchPatients } from '../../queries/usePatients';
import { Patient } from '../../types/patientManagement';
import PatientAutocomplete from './PatientAutocomplete';
import PharmacistSelector from './PharmacistSelector';

// Appointment type options with descriptions
const APPOINTMENT_TYPES: Array<{
  value: AppointmentType;
  label: string;
  description: string;
  duration: number; // default duration in minutes
  color: string;
}> = [
  {
    value: 'mtm_session',
    label: 'MTM Session',
    description: 'Medication Therapy Management consultation',
    duration: 45,
    color: '#1976d2',
  },
  {
    value: 'chronic_disease_review',
    label: 'Chronic Disease Review',
    description: 'Review and monitoring of chronic conditions',
    duration: 30,
    color: '#d32f2f',
  },
  {
    value: 'new_medication_consultation',
    label: 'New Medication Consultation',
    description: 'Counseling for newly prescribed medications',
    duration: 20,
    color: '#388e3c',
  },
  {
    value: 'vaccination',
    label: 'Vaccination',
    description: 'Immunization services',
    duration: 15,
    color: '#f57c00',
  },
  {
    value: 'health_check',
    label: 'Health Check',
    description: 'General health screening and assessment',
    duration: 25,
    color: '#7b1fa2',
  },
  {
    value: 'smoking_cessation',
    label: 'Smoking Cessation',
    description: 'Support and counseling for smoking cessation',
    duration: 30,
    color: '#5d4037',
  },
  {
    value: 'general_followup',
    label: 'General Follow-up',
    description: 'General follow-up appointment',
    duration: 20,
    color: '#455a64',
  },
];

// Duration options
const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 25, label: '25 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

// Recurrence frequency options
const RECURRENCE_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

// Days of week for recurring appointments
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Communication channels
const COMMUNICATION_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone Call' },
];

// Languages
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
  { value: 'ha', label: 'Hausa' },
];

interface CreateAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<AppointmentFormData>;
  selectedDate?: Date;
  selectedTime?: string;
}

interface FormData extends AppointmentFormData {
  // Additional form-specific fields
  patientSearch: string;
  selectedPatient: Patient | null;
  pharmacistSearch: string;
  selectedPharmacist: any | null;
}

const CreateAppointmentDialog: React.FC<CreateAppointmentDialogProps> = ({
  open,
  onClose,
  initialData,
  selectedDate,
  selectedTime,
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
      patientId: '',
      type: 'general_followup',
      scheduledDate: selectedDate || new Date(),
      scheduledTime: selectedTime || '09:00',
      duration: 20,
      assignedTo: '',
      description: '',
      isRecurring: false,
      recurrencePattern: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [],
      },
      patientPreferences: {
        preferredChannel: 'email',
        language: 'en',
        specialRequirements: '',
      },
      // Form-specific fields
      patientSearch: '',
      selectedPatient: null,
      pharmacistSearch: '',
      selectedPharmacist: null,
      ...initialData,
    },
    mode: 'onChange',
  });

  // Watch form values
  const watchedType = watch('type');
  const watchedDate = watch('scheduledDate');
  const watchedTime = watch('scheduledTime');
  const watchedDuration = watch('duration');
  const watchedIsRecurring = watch('isRecurring');
  const watchedPatientSearch = watch('patientSearch');
  const watchedPharmacistSearch = watch('pharmacistSearch');
  const watchedSelectedPatient = watch('selectedPatient');
  const watchedSelectedPharmacist = watch('selectedPharmacist');

  // Local state
  const [showRecurringOptions, setShowRecurringOptions] = useState(false);
  const [showPatientPreferences, setShowPatientPreferences] = useState(false);
  const [availableSlotsDate, setAvailableSlotsDate] = useState<string>('');

  // Mutations and queries
  const createAppointmentMutation = useCreateAppointment();
  const validateSlotMutation = useValidateSlot();

  // Available slots query
  const {
    data: availableSlotsData,
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useAvailableSlots(
    {
      date: availableSlotsDate,
      pharmacistId: watchedSelectedPharmacist?._id,
      duration: watchedDuration,
      type: watchedType,
    },
    !!availableSlotsDate
  );

  // Get available time slots
  const availableSlots = useMemo(() => {
    return availableSlotsData?.data?.slots || [];
  }, [availableSlotsData]);

  // Next available slot query (only when no slots are available)
  const {
    data: nextAvailableSlot,
    isLoading: loadingNextSlot,
  } = useNextAvailableSlot(
    {
      pharmacistId: watchedSelectedPharmacist?._id || '',
      duration: watchedDuration,
      type: watchedType,
      daysAhead: 14
    },
    !!watchedSelectedPharmacist && availableSlots.length === 0 && !loadingSlots
  );

  // Update duration when appointment type changes
  useEffect(() => {
    const selectedType = APPOINTMENT_TYPES.find(type => type.value === watchedType);
    if (selectedType) {
      setValue('duration', selectedType.duration);
    }
  }, [watchedType, setValue]);

  // Update available slots date when date/time changes
  useEffect(() => {
    if (watchedDate) {
      const dateStr = format(watchedDate, 'yyyy-MM-dd');
      setAvailableSlotsDate(dateStr);
    }
  }, [watchedDate]);

  // Handle form submission with enhanced validation
  const onSubmit = async (data: FormData) => {
    try {
      if (!data.selectedPatient) {
        toast.error('Please select a patient');
        return;
      }

      if (!data.selectedPharmacist) {
        toast.error('Please select a pharmacist');
        return;
      }

      // Optionally validate slot availability before creating appointment
      // Skip validation if user doesn't have permission (403 error)
      try {
        const slotValidation = await validateSlotMutation.mutateAsync({
          pharmacistId: data.selectedPharmacist._id,
          date: format(data.scheduledDate, 'yyyy-MM-dd'),
          time: data.scheduledTime,
          duration: data.duration,
          type: data.type
        });

        if (!slotValidation.data.available) {
          toast.error(
            `Time slot is no longer available: ${slotValidation.data.reason || 'Unknown reason'}`
          );
          return;
        }
      } catch (validationError: any) {
        // If validation fails with 403 (permission denied), skip validation and proceed
        if (validationError?.response?.status === 403) {

          // Continue with appointment creation
        } else {
          // Re-throw other errors
          throw validationError;
        }
      }

      const appointmentData: AppointmentFormData = {
        patientId: data.selectedPatient._id,
        type: data.type,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        assignedTo: data.selectedPharmacist._id,
        description: data.description,
        isRecurring: data.isRecurring,
        recurrencePattern: data.isRecurring ? data.recurrencePattern : undefined,
        patientPreferences: data.patientPreferences,
      };

      await createAppointmentMutation.mutateAsync(appointmentData);
      
      toast.success('Appointment created successfully!');
      
      // Reset form and close dialog
      reset();
      onClose();
    } catch (error: any) {
      console.error('Failed to create appointment:', error);
      
      // Extract error message from different error formats
      let errorMessage = 'Failed to create appointment';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    reset();
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <EventIcon color="primary" />
              <Typography variant="h6">
                Create New Appointment
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
              {/* Patient Selection */}
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <PersonIcon color="primary" />
                    <Typography variant="h6">Patient Information</Typography>
                  </Box>
                  
                  <Controller
                    name="selectedPatient"
                    control={control}
                    rules={{ required: 'Patient selection is required' }}
                    render={({ field }) => (
                      <PatientAutocomplete
                        value={field.value}
                        onChange={(patient) => {
                          field.onChange(patient);
                          setValue('patientId', patient?._id || '');
                        }}
                        onInputChange={(searchTerm) => {
                          setValue('patientSearch', searchTerm);
                        }}
                        error={!!errors.selectedPatient}
                        helperText={errors.selectedPatient?.message}
                        required
                      />
                    )}
                  />
                </CardContent>
              </Card>

              {/* Appointment Details */}
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <ScheduleIcon color="primary" />
                    <Typography variant="h6">Appointment Details</Typography>
                  </Box>

                  <Grid container spacing={2}>
                    {/* Appointment Type */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="type"
                        control={control}
                        rules={{ required: 'Appointment type is required' }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.type}>
                            <InputLabel>Appointment Type</InputLabel>
                            <Select {...field} label="Appointment Type">
                              {APPOINTMENT_TYPES.map((type) => (
                                <MenuItem key={type.value} value={type.value}>
                                  <Box>
                                    <Typography variant="body1">{type.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {type.description} ({type.duration} min)
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.type && (
                              <FormHelperText>{errors.type.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Duration */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="duration"
                        control={control}
                        rules={{ required: 'Duration is required', min: { value: 5, message: 'Minimum 5 minutes' } }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.duration}>
                            <InputLabel>Duration</InputLabel>
                            <Select {...field} label="Duration">
                              {DURATION_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.duration && (
                              <FormHelperText>{errors.duration.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Date */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="scheduledDate"
                        control={control}
                        rules={{ 
                          required: 'Date is required',
                          validate: (value) => {
                            if (isBefore(startOfDay(value), startOfDay(new Date()))) {
                              return 'Cannot schedule appointments in the past';
                            }
                            return true;
                          }
                        }}
                        render={({ field }) => (
                          <DatePicker
                            {...field}
                            label="Appointment Date"
                            minDate={new Date()}
                            maxDate={addDays(new Date(), 365)}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.scheduledDate,
                                helperText: errors.scheduledDate?.message,
                              },
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Time */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="scheduledTime"
                        control={control}
                        rules={{ required: 'Time is required' }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.scheduledTime}>
                            <InputLabel>Appointment Time</InputLabel>
                            <Select {...field} label="Appointment Time">
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
                            {errors.scheduledTime && (
                              <FormHelperText>{errors.scheduledTime.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12}>
                      <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Description (Optional)"
                            placeholder="Additional notes about the appointment..."
                            multiline
                            rows={3}
                            fullWidth
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Pharmacist Assignment */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Pharmacist Assignment
                  </Typography>
                  
                  <Controller
                    name="selectedPharmacist"
                    control={control}
                    render={({ field }) => (
                      <PharmacistSelector
                        value={field.value}
                        onChange={(pharmacist) => {
                          field.onChange(pharmacist);
                          setValue('assignedTo', pharmacist?._id || '');
                        }}
                        filterByAvailability={true}
                        appointmentDate={watchedDate}
                        appointmentTime={watchedTime}
                      />
                    )}
                  />
                </CardContent>
              </Card>

              {/* Enhanced Available Slots Display */}
              {availableSlotsDate && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Available Time Slots for {format(watchedDate, 'MMMM dd, yyyy')}
                    </Typography>
                    
                    {loadingSlots ? (
                      <Box display="flex" justifyContent="center" p={2}>
                        <CircularProgress />
                        <Typography variant="body2" sx={{ ml: 2 }}>
                          Loading available slots...
                        </Typography>
                      </Box>
                    ) : availableSlotsData?.data ? (
                      <Box>
                        {/* Slots Summary */}
                        {availableSlotsData.data.summary && (
                          <Box mb={2}>
                            <Typography variant="body2" color="text.secondary">
                              {availableSlotsData.data.summary.availableSlots} of {availableSlotsData.data.summary.totalSlots} slots available
                              {availableSlotsData.data.summary.utilizationRate > 0 && (
                                <> • {availableSlotsData.data.summary.utilizationRate}% utilized</>
                              )}
                            </Typography>
                          </Box>
                        )}

                        {/* Pharmacist Information */}
                        {availableSlotsData.data.pharmacists && availableSlotsData.data.pharmacists.length > 0 && (
                          <Box mb={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Pharmacist Availability:
                            </Typography>
                            {availableSlotsData.data.pharmacists.map((pharmacist) => (
                              <Box key={pharmacist._id} mb={1}>
                                <Typography variant="body2">
                                  <strong>{pharmacist.name}</strong> - {pharmacist.availableSlots} slots available
                                  {pharmacist.workingHours && (
                                    <> • Working hours: {pharmacist.workingHours}</>
                                  )}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Available Slots */}
                        {availableSlots.length > 0 ? (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Select a time slot:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                              {availableSlots.map((slot) => (
                                <Tooltip
                                  key={`${slot.pharmacistId}-${slot.time}`}
                                  title={
                                    slot.available 
                                      ? `Available with ${slot.pharmacistName || 'pharmacist'}`
                                      : slot.conflictReason || 'Not available'
                                  }
                                >
                                  <Chip
                                    label={slot.time}
                                    color={slot.available ? 'success' : 'error'}
                                    variant={slot.time === watchedTime ? 'filled' : 'outlined'}
                                    onClick={() => {
                                      if (slot.available) {
                                        setValue('scheduledTime', slot.time);
                                        // Auto-select pharmacist if not already selected
                                        if (!watchedSelectedPharmacist && slot.pharmacistId) {
                                          // Find pharmacist data and set it
                                          const pharmacistData = availableSlotsData.data.pharmacists?.find(
                                            p => p._id === slot.pharmacistId
                                          );
                                          if (pharmacistData) {
                                            setValue('selectedPharmacist', {
                                              _id: pharmacistData._id,
                                              firstName: pharmacistData.name.split(' ')[0],
                                              lastName: pharmacistData.name.split(' ').slice(1).join(' '),
                                              email: pharmacistData.email
                                            });
                                          }
                                        }
                                      }
                                    }}
                                    sx={{
                                      cursor: slot.available ? 'pointer' : 'not-allowed',
                                      opacity: slot.available ? 1 : 0.6,
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Box>
                            <Alert 
                              severity="warning" 
                              action={
                                <Button 
                                  color="inherit" 
                                  size="small"
                                  onClick={() => refetchSlots()}
                                >
                                  Refresh
                                </Button>
                              }
                            >
                              No available slots found for the selected date and criteria.
                              {availableSlotsData?.data?.message && (
                                <Box mt={1}>
                                  <Typography variant="body2">
                                    {availableSlotsData.data.message}
                                  </Typography>
                                </Box>
                              )}
                            </Alert>

                            {/* Next Available Slot Suggestion */}
                            {watchedSelectedPharmacist && (
                              <Box mt={2}>
                                {loadingNextSlot ? (
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <CircularProgress size={16} />
                                    <Typography variant="body2" color="text.secondary">
                                      Finding next available slot...
                                    </Typography>
                                  </Box>
                                ) : nextAvailableSlot?.data ? (
                                  <Alert 
                                    severity="info"
                                    action={
                                      <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => {
                                          setValue('scheduledDate', new Date(nextAvailableSlot.data.date));
                                          setValue('scheduledTime', nextAvailableSlot.data.time);
                                        }}
                                      >
                                        Use This Slot
                                      </Button>
                                    }
                                  >
                                    <Typography variant="body2">
                                      <strong>Next available:</strong> {format(new Date(nextAvailableSlot.data.date), 'MMMM dd, yyyy')} at {nextAvailableSlot.data.time}
                                      {nextAvailableSlot.data.pharmacistName && (
                                        <> with {nextAvailableSlot.data.pharmacistName}</>
                                      )}
                                    </Typography>
                                  </Alert>
                                ) : (
                                  <Alert severity="error">
                                    No available slots found in the next 14 days. Please try a different pharmacist or contact support.
                                  </Alert>
                                )}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Alert severity="info">
                        Select a date and pharmacist to view available time slots.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recurring Appointment Options */}
              <Accordion 
                expanded={showRecurringOptions} 
                onChange={(_, expanded) => setShowRecurringOptions(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <RepeatIcon color="primary" />
                    <Typography variant="h6">Recurring Appointment</Typography>
                    <Controller
                      name="isRecurring"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              {...field}
                              checked={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.checked);
                                setShowRecurringOptions(e.target.checked);
                              }}
                            />
                          }
                          label="Enable"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {watchedIsRecurring && (
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="recurrencePattern.frequency"
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth>
                              <InputLabel>Frequency</InputLabel>
                              <Select {...field} label="Frequency">
                                {RECURRENCE_FREQUENCIES.map((freq) => (
                                  <MenuItem key={freq.value} value={freq.value}>
                                    {freq.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="recurrencePattern.interval"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Repeat Every"
                              type="number"
                              inputProps={{ min: 1, max: 12 }}
                              helperText="e.g., 2 for every 2 weeks"
                              fullWidth
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Controller
                          name="recurrencePattern.endDate"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              {...field}
                              label="End Date (Optional)"
                              minDate={addDays(watchedDate, 1)}
                              slotProps={{
                                textField: {
                                  fullWidth: true,
                                  helperText: 'Leave empty for indefinite recurrence',
                                },
                              }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Patient Preferences */}
              <Accordion 
                expanded={showPatientPreferences} 
                onChange={(_, expanded) => setShowPatientPreferences(expanded)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Patient Preferences</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="patientPreferences.preferredChannel"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Preferred Communication</InputLabel>
                            <Select {...field} label="Preferred Communication">
                              {COMMUNICATION_CHANNELS.map((channel) => (
                                <MenuItem key={channel.value} value={channel.value}>
                                  {channel.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="patientPreferences.language"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Language</InputLabel>
                            <Select {...field} label="Language">
                              {LANGUAGES.map((lang) => (
                                <MenuItem key={lang.value} value={lang.value}>
                                  {lang.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="patientPreferences.specialRequirements"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Special Requirements"
                            placeholder="Any special accommodations or requirements..."
                            multiline
                            rows={2}
                            fullWidth
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Validation Warnings */}
              {!isTimeSlotAvailable(watchedTime) && (
                <Alert severity="warning" icon={<WarningIcon />}>
                  The selected time slot may not be available. Please check the available slots above or choose a different time.
                </Alert>
              )}

              {isWeekend(watchedDate) && (
                <Alert severity="info">
                  You're scheduling an appointment on a weekend. Please ensure the pharmacy is open.
                </Alert>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button 
              onClick={handleClose} 
              disabled={isSubmitting || validateSlotMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                isSubmitting || 
                validateSlotMutation.isPending ||
                !watchedSelectedPatient ||
                !watchedSelectedPharmacist ||
                !watchedTime
              }
              startIcon={
                isSubmitting || validateSlotMutation.isPending ? 
                  <CircularProgress size={20} /> : 
                  <EventIcon />
              }
            >
              {validateSlotMutation.isPending 
                ? 'Validating...' 
                : isSubmitting 
                  ? 'Creating...' 
                  : 'Create Appointment'
              }
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateAppointmentDialog;