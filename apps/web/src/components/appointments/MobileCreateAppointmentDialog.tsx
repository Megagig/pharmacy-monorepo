import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
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
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  AppBar,
  Toolbar,
  Slide,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Fab,
  useTheme,
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
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  CalendarToday as CalendarIcon,
  TouchApp as TouchAppIcon,
} from '@mui/icons-material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, isWeekend, isBefore, startOfDay } from 'date-fns';

import { AppointmentFormData, AppointmentType } from '../../stores/appointmentTypes';
import { useCreateAppointment, useAvailableSlots } from '../../hooks/useAppointments';
import { useSearchPatients } from '../../queries/usePatients';
import { Patient } from '../../types/patientManagement';
import { useResponsive, useSafeAreaInsets } from '../../hooks/useResponsive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import PatientAutocomplete from './PatientAutocomplete';
import PharmacistSelector from './PharmacistSelector';

// Appointment type options with descriptions
const APPOINTMENT_TYPES: Array<{
  value: AppointmentType;
  label: string;
  description: string;
  duration: number;
  color: string;
  icon: string;
}> = [
  {
    value: 'mtm_session',
    label: 'MTM Session',
    description: 'Medication Therapy Management consultation',
    duration: 45,
    color: '#1976d2',
    icon: '💊',
  },
  {
    value: 'chronic_disease_review',
    label: 'Chronic Disease Review',
    description: 'Review and monitoring of chronic conditions',
    duration: 30,
    color: '#d32f2f',
    icon: '🩺',
  },
  {
    value: 'new_medication_consultation',
    label: 'New Medication Consultation',
    description: 'Counseling for newly prescribed medications',
    duration: 20,
    color: '#388e3c',
    icon: '🆕',
  },
  {
    value: 'vaccination',
    label: 'Vaccination',
    description: 'Immunization services',
    duration: 15,
    color: '#f57c00',
    icon: '💉',
  },
  {
    value: 'health_check',
    label: 'Health Check',
    description: 'General health screening and assessment',
    duration: 25,
    color: '#7b1fa2',
    icon: '❤️',
  },
  {
    value: 'smoking_cessation',
    label: 'Smoking Cessation',
    description: 'Support and counseling for smoking cessation',
    duration: 30,
    color: '#5d4037',
    icon: '🚭',
  },
  {
    value: 'general_followup',
    label: 'General Follow-up',
    description: 'General follow-up appointment',
    duration: 20,
    color: '#455a64',
    icon: '📋',
  },
];

// Duration options
const DURATION_OPTIONS = [
  { value: 15, label: '15 min', icon: '⚡' },
  { value: 20, label: '20 min', icon: '🕐' },
  { value: 25, label: '25 min', icon: '🕐' },
  { value: 30, label: '30 min', icon: '🕑' },
  { value: 45, label: '45 min', icon: '🕒' },
  { value: 60, label: '1 hour', icon: '🕓' },
  { value: 90, label: '1.5 hours', icon: '🕔' },
  { value: 120, label: '2 hours', icon: '🕕' },
];

// Communication channels
const COMMUNICATION_CHANNELS = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'sms', label: 'SMS', icon: '📱' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'phone', label: 'Phone Call', icon: '📞' },
];

// Languages
const LANGUAGES = [
  { value: 'en', label: 'English', icon: '🇺🇸' },
  { value: 'yo', label: 'Yoruba', icon: '🇳🇬' },
  { value: 'ig', label: 'Igbo', icon: '🇳🇬' },
  { value: 'ha', label: 'Hausa', icon: '🇳🇬' },
];

interface MobileCreateAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<AppointmentFormData>;
  selectedDate?: Date;
  selectedTime?: string;
}

interface FormData extends AppointmentFormData {
  patientSearch: string;
  selectedPatient: Patient | null;
  pharmacistSearch: string;
  selectedPharmacist: any | null;
}

const steps = [
  'Select Patient',
  'Appointment Type',
  'Date & Time',
  'Preferences',
  'Review & Create',
];

const MobileCreateAppointmentDialog: React.FC<MobileCreateAppointmentDialogProps> = ({
  open,
  onClose,
  initialData,
  selectedDate,
  selectedTime,
}) => {
  const theme = useTheme();
  const { isMobile, isSmallMobile, getSpacing } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();

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
  const watchedSelectedPatient = watch('selectedPatient');
  const watchedSelectedPharmacist = watch('selectedPharmacist');

  // Local state
  const [activeStep, setActiveStep] = useState(0);
  const [availableSlotsDate, setAvailableSlotsDate] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Mutations and queries
  const createAppointmentMutation = useCreateAppointment();

  // Available slots query
  const {
    data: availableSlotsData,
    isLoading: loadingSlots,
  } = useAvailableSlots(
    {
      date: availableSlotsDate,
      pharmacistId: watchedSelectedPharmacist?._id,
      duration: watchedDuration,
      type: watchedType,
    },
    !!availableSlotsDate
  );

  // Touch gesture handlers for step navigation
  const { attachGestures } = useTouchGestures({
    onSwipeLeft: () => {
      if (activeStep < steps.length - 1) {
        handleNext();
      }
    },
    onSwipeRight: () => {
      if (activeStep > 0) {
        handleBack();
      }
    },
  }, {
    swipeThreshold: 80,
  });

  // Update duration when appointment type changes
  useEffect(() => {
    const selectedType = APPOINTMENT_TYPES.find(type => type.value === watchedType);
    if (selectedType) {
      setValue('duration', selectedType.duration);
    }
  }, [watchedType, setValue]);

  // Update available slots date when date changes
  useEffect(() => {
    if (watchedDate) {
      const dateStr = format(watchedDate, 'yyyy-MM-dd');
      setAvailableSlotsDate(dateStr);
    }
  }, [watchedDate]);

  // Get available time slots
  const availableSlots = useMemo(() => {
    return availableSlotsData?.data?.slots || [];
  }, [availableSlotsData]);

  // Generate time slots for selection
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slot = availableSlots.find(s => s.time === timeStr);
        slots.push({
          time: timeStr,
          available: slot?.available !== false,
          pharmacistId: slot?.pharmacistId,
        });
      }
    }
    return slots;
  }, [availableSlots]);

  // Step validation
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0: // Patient selection
        return !!watchedSelectedPatient;
      case 1: // Appointment type
        return !!watchedType;
      case 2: // Date & Time
        return !!watchedDate && !!watchedTime && watchedDuration > 0;
      case 3: // Preferences (optional)
        return true;
      case 4: // Review
        return !!watchedSelectedPatient && !!watchedType && !!watchedDate && !!watchedTime;
      default:
        return false;
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (isStepValid(activeStep) && activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Form submission
  const onSubmit = async (data: FormData) => {
    try {
      if (!data.selectedPatient) {
        throw new Error('Please select a patient');
      }

      const appointmentData: AppointmentFormData = {
        patientId: data.selectedPatient._id,
        type: data.type,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        assignedTo: data.selectedPharmacist?._id || '',
        description: data.description,
        isRecurring: data.isRecurring,
        recurrencePattern: data.isRecurring ? data.recurrencePattern : undefined,
        patientPreferences: data.patientPreferences,
      };

      await createAppointmentMutation.mutateAsync(appointmentData);
      
      // Haptic feedback on success
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      reset();
      onClose();
    } catch (error) {
      console.error('Failed to create appointment:', error);
      // Haptic feedback on error
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  };

  // Handle dialog close
  const handleClose = () => {
    reset();
    setActiveStep(0);
    onClose();
  };

  // Render step content
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Patient Selection
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              Select Patient
            </Typography>
            
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
                  fullWidth
                  sx={{ mt: 2 }}
                />
              )}
            />

            {watchedSelectedPatient && (
              <Card sx={{ mt: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                <CardContent sx={{ py: 1 }}>
                  <Typography variant="body2">
                    ✓ Selected: {watchedSelectedPatient.firstName} {watchedSelectedPatient.lastName}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      case 1: // Appointment Type
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon color="primary" />
              Appointment Type
            </Typography>
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {APPOINTMENT_TYPES.map((type) => (
                <Grid item xs={12} sm={6} key={type.value}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: watchedType === type.value ? 2 : 1,
                      borderColor: watchedType === type.value ? 'primary.main' : 'divider',
                      bgcolor: watchedType === type.value ? 'primary.light' : 'background.paper',
                      '&:hover': {
                        bgcolor: watchedType === type.value ? 'primary.light' : 'action.hover',
                      },
                    }}
                    onClick={() => setValue('type', type.value)}
                  >
                    <CardContent sx={{ py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h5">{type.icon}</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                          {type.label}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {type.description}
                      </Typography>
                      <Chip
                        label={`${type.duration} minutes`}
                        size="small"
                        color={watchedType === type.value ? 'primary' : 'default'}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Duration Selection */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Duration
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {DURATION_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={`${option.icon} ${option.label}`}
                    variant={watchedDuration === option.value ? 'filled' : 'outlined'}
                    color={watchedDuration === option.value ? 'primary' : 'default'}
                    onClick={() => setValue('duration', option.value)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </Box>
          </Box>
        );

      case 2: // Date & Time
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon color="primary" />
              Date & Time
            </Typography>

            {/* Date Selection */}
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
                      sx: { mt: 2 },
                    },
                  }}
                />
              )}
            />

            {/* Time Slots */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Available Time Slots
              </Typography>
              
              {loadingSlots ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  {timeSlots.map((slot) => (
                    <Grid item xs={4} sm={3} key={slot.time}>
                      <Button
                        variant={watchedTime === slot.time ? 'contained' : 'outlined'}
                        color={slot.available ? 'primary' : 'error'}
                        disabled={!slot.available}
                        onClick={() => setValue('scheduledTime', slot.time)}
                        fullWidth
                        size="small"
                        sx={{
                          minHeight: 40,
                          fontSize: '0.75rem',
                        }}
                      >
                        {slot.time}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>

            {/* Pharmacist Assignment */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Assign Pharmacist (Optional)
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
            </Box>

            {/* Validation Warnings */}
            {isWeekend(watchedDate) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                You're scheduling an appointment on a weekend. Please ensure the pharmacy is open.
              </Alert>
            )}
          </Box>
        );

      case 3: // Preferences
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              Preferences
            </Typography>

            {/* Communication Preference */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preferred Communication
              </Typography>
              <Grid container spacing={1}>
                {COMMUNICATION_CHANNELS.map((channel) => (
                  <Grid item xs={6} key={channel.value}>
                    <Controller
                      name="patientPreferences.preferredChannel"
                      control={control}
                      render={({ field }) => (
                        <Button
                          variant={field.value === channel.value ? 'contained' : 'outlined'}
                          onClick={() => field.onChange(channel.value)}
                          fullWidth
                          startIcon={<span>{channel.icon}</span>}
                          size="small"
                        >
                          {channel.label}
                        </Button>
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Language Preference */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Language
              </Typography>
              <Grid container spacing={1}>
                {LANGUAGES.map((lang) => (
                  <Grid item xs={6} key={lang.value}>
                    <Controller
                      name="patientPreferences.language"
                      control={control}
                      render={({ field }) => (
                        <Button
                          variant={field.value === lang.value ? 'contained' : 'outlined'}
                          onClick={() => field.onChange(lang.value)}
                          fullWidth
                          startIcon={<span>{lang.icon}</span>}
                          size="small"
                        >
                          {lang.label}
                        </Button>
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Recurring Appointment */}
            <Box sx={{ mt: 3 }}>
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
                          setShowAdvancedOptions(e.target.checked);
                        }}
                      />
                    }
                    label="Recurring Appointment"
                  />
                )}
              />
            </Box>

            {/* Special Requirements */}
            <Controller
              name="patientPreferences.specialRequirements"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Special Requirements (Optional)"
                  placeholder="Any special accommodations..."
                  multiline
                  rows={2}
                  fullWidth
                  sx={{ mt: 2 }}
                />
              )}
            />

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Additional Notes (Optional)"
                  placeholder="Additional notes about the appointment..."
                  multiline
                  rows={2}
                  fullWidth
                  sx={{ mt: 2 }}
                />
              )}
            />
          </Box>
        );

      case 4: // Review & Create
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckIcon color="primary" />
              Review & Create
            </Typography>

            <List sx={{ mt: 2 }}>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Patient"
                  secondary={watchedSelectedPatient ? 
                    `${watchedSelectedPatient.firstName} ${watchedSelectedPatient.lastName}` : 
                    'Not selected'
                  }
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemIcon>
                  <EventIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Appointment Type"
                  secondary={APPOINTMENT_TYPES.find(t => t.value === watchedType)?.label || 'Not selected'}
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemIcon>
                  <CalendarIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Date & Time"
                  secondary={`${format(watchedDate, 'EEEE, MMMM dd, yyyy')} at ${watchedTime}`}
                />
              </ListItem>
              
              <Divider />
              
              <ListItem>
                <ListItemIcon>
                  <AccessTimeIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Duration"
                  secondary={`${watchedDuration} minutes`}
                />
              </ListItem>
              
              {watchedSelectedPharmacist && (
                <>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Assigned Pharmacist"
                      secondary={watchedSelectedPharmacist.name || 'Auto-assign'}
                    />
                  </ListItem>
                </>
              )}
            </List>

            {/* Final validation */}
            {!isStepValid(4) && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Please complete all required fields before creating the appointment.
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        fullScreen
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        {/* Mobile App Bar */}
        <AppBar position="sticky" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              New Appointment
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {activeStep + 1}/{steps.length}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Progress Indicator */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {steps.map((label, index) => (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  height: 4,
                  bgcolor: index <= activeStep ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {steps[activeStep]}
          </Typography>
        </Box>

        {/* Step Content */}
        <DialogContent 
          sx={{ 
            p: 0, 
            flex: 1,
            paddingBottom: `${safeAreaInsets.bottom + 80}px`,
          }}
        >
          <Box 
            ref={(el) => el && attachGestures(el)}
            sx={{ minHeight: '100%' }}
          >
            {renderStepContent(activeStep)}
          </Box>

          {/* Touch Gesture Hint */}
          <Box
            sx={{
              position: 'fixed',
              bottom: safeAreaInsets.bottom + 90,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999,
              opacity: 0.6,
              pointerEvents: 'none',
            }}
          >
            <Chip
              icon={<TouchAppIcon />}
              label="Swipe to navigate steps"
              size="small"
              variant="outlined"
              sx={{
                bgcolor: 'background.paper',
                backdropFilter: 'blur(8px)',
              }}
            />
          </Box>
        </DialogContent>

        {/* Bottom Navigation */}
        <Paper 
          elevation={8}
          sx={{ 
            position: 'fixed',
            bottom: safeAreaInsets.bottom,
            left: 0,
            right: 0,
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              startIcon={<NavigateBeforeIcon />}
              variant="outlined"
              sx={{ flex: 1 }}
            >
              Back
            </Button>
            
            {activeStep === steps.length - 1 ? (
              <Button
                onClick={handleSubmit(onSubmit)}
                disabled={!isStepValid(activeStep) || isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckIcon />}
                variant="contained"
                sx={{ flex: 2 }}
              >
                {isSubmitting ? 'Creating...' : 'Create Appointment'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!isStepValid(activeStep)}
                endIcon={<NavigateNextIcon />}
                variant="contained"
                sx={{ flex: 2 }}
              >
                Next
              </Button>
            )}
          </Stack>
        </Paper>
      </Dialog>
    </LocalizationProvider>
  );
};

export default MobileCreateAppointmentDialog;