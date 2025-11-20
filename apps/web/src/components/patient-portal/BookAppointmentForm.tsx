import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Alert,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  Schedule,
  Person,
  NotificationsActive,
  CheckCircle,
  CalendarToday,
  AccessTime,
  Notes,
  Send,
  Close,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, isToday, isTomorrow } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';

import {
  useAppointmentTypes,
  useAvailableSlots,
  useBookAppointment,
  useReserveSlot,
  useReleaseSlot,
} from '../../hooks/usePatientPortal';
import { AppointmentType, AvailableSlot, BookingData } from '../../services/patientPortalService';

interface BookAppointmentFormProps {
  workplaceId: string;
  patientId: string;
  onSuccess?: (appointment: any) => void;
  onCancel?: () => void;
  preSelectedType?: string;
  preSelectedDate?: Date;
  preSelectedSlot?: {
    date: string;
    time: string;
    pharmacistId?: string;
    pharmacistName?: string;
  };
}

interface FormData {
  appointmentType: string;
  scheduledDate: Date;
  scheduledTime: string;
  pharmacistId?: string;
  patientNotes: string;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

interface ReservedSlot {
  date: string;
  time: string;
  reservationId: string;
  expiresAt: Date;
}

const steps = [
  {
    label: 'Select Service',
    description: 'Choose the type of appointment you need',
    icon: <Schedule />,
  },
  {
    label: 'Choose Date & Time',
    description: 'Pick your preferred date and time slot',
    icon: <CalendarToday />,
  },
  {
    label: 'Add Details',
    description: 'Provide additional information and preferences',
    icon: <Notes />,
  },
  {
    label: 'Confirm Booking',
    description: 'Review and confirm your appointment',
    icon: <CheckCircle />,
  },
];

const BookAppointmentForm: React.FC<BookAppointmentFormProps> = ({
  workplaceId,
  patientId,
  onSuccess,
  onCancel,
  preSelectedType,
  preSelectedDate,
  preSelectedSlot,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [reservedSlot, setReservedSlot] = useState<ReservedSlot | null>(null);
  const [reservationTimer, setReservationTimer] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form management
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      appointmentType: preSelectedType || '',
      scheduledDate: preSelectedDate || new Date(),
      scheduledTime: preSelectedSlot?.time || '',
      pharmacistId: preSelectedSlot?.pharmacistId || '',
      patientNotes: '',
      notificationPreferences: {
        email: true,
        sms: true,
        whatsapp: false,
      },
    },
  });

  const watchedValues = watch();

  // API hooks
  const {
    data: appointmentTypesResponse,
    isLoading: loadingTypes,
    error: typesError
  } = useAppointmentTypes(workplaceId);

  const {
    data: slotsResponse,
    isLoading: loadingSlots,
    error: slotsError,
    refetch: refetchSlots
  } = useAvailableSlots(
    {
      workplaceId,
      date: format(watchedValues.scheduledDate, 'yyyy-MM-dd'),
      type: watchedValues.appointmentType,
      duration: appointmentTypesResponse?.data?.find(t => t.type === watchedValues.appointmentType)?.duration,
    },
    !!workplaceId && !!watchedValues.scheduledDate && !!watchedValues.appointmentType
  );

  const bookAppointmentMutation = useBookAppointment();
  const reserveSlotMutation = useReserveSlot();
  const releaseSlotMutation = useReleaseSlot();

  // Extract data from API responses
  const appointmentTypes = appointmentTypesResponse?.data || [];
  const availableSlots = slotsResponse?.data?.slots || [];
  const pharmacists = slotsResponse?.data?.pharmacists || [];

  // Reservation timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (reservedSlot) {
      interval = setInterval(() => {
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((reservedSlot.expiresAt.getTime() - now.getTime()) / 1000));
        setReservationTimer(timeLeft);

        if (timeLeft === 0) {
          setReservedSlot(null);
          refetchSlots();
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [reservedSlot, refetchSlots]);

  // Format reservation timer
  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format date for display
  const formatDateDisplay = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  // Step navigation
  const handleNext = useCallback(() => {
    if (activeStep === 1 && watchedValues.scheduledTime && !reservedSlot) {
      // Reserve the selected slot before proceeding
      handleSlotReserve();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  }, [activeStep, watchedValues.scheduledTime, reservedSlot]);

  const handleBack = useCallback(() => {
    if (activeStep === 2 && reservedSlot) {
      // Release the reserved slot when going back
      handleSlotRelease();
    }
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  }, [activeStep, reservedSlot]);

  const handleReset = useCallback(() => {
    setActiveStep(0);
    if (reservedSlot) {
      handleSlotRelease();
    }
  }, [reservedSlot]);

  // Slot reservation handlers
  const handleSlotReserve = async () => {
    if (!watchedValues.appointmentType || !watchedValues.scheduledTime) return;

    try {
      const selectedSlot = availableSlots.find(slot => slot.time === watchedValues.scheduledTime);
      if (!selectedSlot) return;

      const response = await reserveSlotMutation.mutateAsync({
        workplaceId,
        date: format(watchedValues.scheduledDate, 'yyyy-MM-dd'),
        time: watchedValues.scheduledTime,
        type: watchedValues.appointmentType,
        pharmacistId: selectedSlot.pharmacistId,
      });

      setReservedSlot({
        date: format(watchedValues.scheduledDate, 'yyyy-MM-dd'),
        time: watchedValues.scheduledTime,
        reservationId: response.data.reservationId,
        expiresAt: new Date(response.data.expiresAt),
      });

      setValue('pharmacistId', selectedSlot.pharmacistId);
      setActiveStep(2); // Move to next step
      refetchSlots();
    } catch (error) {
      console.error('Failed to reserve slot:', error);
    }
  };

  const handleSlotRelease = async () => {
    if (!reservedSlot) return;

    try {
      await releaseSlotMutation.mutateAsync(reservedSlot.reservationId);
      setReservedSlot(null);
      setReservationTimer(0);
      refetchSlots();
    } catch (error) {
      console.error('Failed to release slot:', error);
    }
  };

  // Form submission
  const onSubmit = async (data: FormData) => {
    if (!reservedSlot) return;

    setIsSubmitting(true);
    try {
      const bookingData: BookingData = {
        patientId,
        type: data.appointmentType,
        scheduledDate: format(data.scheduledDate, 'yyyy-MM-dd'),
        scheduledTime: data.scheduledTime,
        duration: appointmentTypes.find(t => t.type === data.appointmentType)?.duration || 30,
        patientNotes: data.patientNotes,
        notificationPreferences: data.notificationPreferences,
      };

      const response = await bookAppointmentMutation.mutateAsync(bookingData);

      // Clear reservation
      setReservedSlot(null);
      setReservationTimer(0);

      onSuccess?.(response.data.appointment);
    } catch (error) {
      console.error('Failed to book appointment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Appointment Type Selection
  const renderAppointmentTypeStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        What type of appointment do you need?
      </Typography>

      {loadingTypes ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : typesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load appointment types. Please try again.
        </Alert>
      ) : (
        <Controller
          name="appointmentType"
          control={control}
          rules={{ required: 'Please select an appointment type' }}
          render={({ field }) => (
            <FormControl component="fieldset" error={!!errors.appointmentType}>
              <RadioGroup
                {...field}
                sx={{ gap: 2 }}
              >
                {appointmentTypes.map((type) => (
                  <Card
                    key={type.type}
                    sx={{
                      cursor: type.available ? 'pointer' : 'not-allowed',
                      opacity: type.available ? 1 : 0.6,
                      border: field.value === type.type ?
                        `2px solid ${theme.palette.primary.main}` :
                        `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': type.available ? {
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows[4],
                      } : {},
                    }}
                    onClick={() => type.available && field.onChange(type.type)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <FormControlLabel
                          value={type.type}
                          control={<Radio />}
                          label=""
                          disabled={!type.available}
                          sx={{ m: 0 }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" gutterBottom>
                            {type.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {type.description}
                          </Typography>
                          <Chip
                            icon={<AccessTime />}
                            label={`${type.duration} minutes`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>
              {errors.appointmentType && (
                <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                  {errors.appointmentType.message}
                </Typography>
              )}
            </FormControl>
          )}
        />
      )}
    </Box>
  );

  // Step 2: Date and Time Selection
  const renderDateTimeStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        When would you like to schedule your appointment?
      </Typography>

      {/* Date Selection */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Select Date
        </Typography>
        <Controller
          name="scheduledDate"
          control={control}
          rules={{ required: 'Please select a date' }}
          render={({ field }) => (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                {...field}
                minDate={new Date()}
                maxDate={addDays(new Date(), 90)}
                slotProps={{
                  textField: {
                    fullWidth: !isMobile,
                    error: !!errors.scheduledDate,
                    helperText: errors.scheduledDate?.message,
                  },
                }}
              />
            </LocalizationProvider>
          )}
        />
      </Box>

      {/* Time Selection */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Available Time Slots for {formatDateDisplay(watchedValues.scheduledDate)}
        </Typography>

        {loadingSlots ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : slotsError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load available slots. Please try again.
          </Alert>
        ) : availableSlots.length === 0 ? (
          <Alert severity="info">
            No available slots for the selected date. Please choose a different date.
          </Alert>
        ) : (
          <Controller
            name="scheduledTime"
            control={control}
            rules={{ required: 'Please select a time slot' }}
            render={({ field }) => (
              <FormControl component="fieldset" error={!!errors.scheduledTime}>
                <RadioGroup
                  {...field}
                  sx={{ gap: 1 }}
                >
                  <Grid container spacing={2}>
                    {availableSlots.map((slot) => {
                      const pharmacist = pharmacists.find(p => p._id === slot.pharmacistId);

                      return (
                        <Grid item xs={6} sm={4} md={3} key={`${slot.time}-${slot.pharmacistId}`}>
                          <Card
                            sx={{
                              cursor: slot.available ? 'pointer' : 'not-allowed',
                              opacity: slot.available ? 1 : 0.5,
                              border: field.value === slot.time ?
                                `2px solid ${theme.palette.primary.main}` :
                                `1px solid ${theme.palette.divider}`,
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': slot.available ? {
                                transform: 'translateY(-2px)',
                                boxShadow: theme.shadows[4],
                              } : {},
                            }}
                            onClick={() => slot.available && field.onChange(slot.time)}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <FormControlLabel
                                  value={slot.time}
                                  control={<Radio size="small" />}
                                  label=""
                                  disabled={!slot.available}
                                  sx={{ m: 0 }}
                                />
                                <Typography variant="h6">
                                  {slot.time}
                                </Typography>
                              </Box>

                              {pharmacist && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Person fontSize="small" color="action" />
                                  <Typography variant="caption" color="text.secondary">
                                    {pharmacist.name}
                                  </Typography>
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </RadioGroup>
                {errors.scheduledTime && (
                  <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                    {errors.scheduledTime.message}
                  </Typography>
                )}
              </FormControl>
            )}
          />
        )}
      </Box>
    </Box>
  );

  // Step 3: Additional Details
  const renderDetailsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Additional Information
      </Typography>

      {/* Reservation Timer */}
      {reservedSlot && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule />
            <Typography>
              Time slot reserved for {formatTimer(reservationTimer)}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Patient Notes */}
      <Box sx={{ mb: 4 }}>
        <Controller
          name="patientNotes"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Notes (Optional)"
              placeholder="Please describe any specific concerns or questions you'd like to discuss..."
              multiline
              rows={4}
              fullWidth
              helperText="This information will help the pharmacist prepare for your appointment"
            />
          )}
        />
      </Box>

      {/* Notification Preferences */}
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          How would you like to receive appointment reminders?
        </Typography>
        <Controller
          name="notificationPreferences"
          control={control}
          render={({ field }) => (
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value.email}
                    onChange={(e) => field.onChange({
                      ...field.value,
                      email: e.target.checked,
                    })}
                  />
                }
                label="Email notifications"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value.sms}
                    onChange={(e) => field.onChange({
                      ...field.value,
                      sms: e.target.checked,
                    })}
                  />
                }
                label="SMS text messages"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value.whatsapp}
                    onChange={(e) => field.onChange({
                      ...field.value,
                      whatsapp: e.target.checked,
                    })}
                  />
                }
                label="WhatsApp messages"
              />
            </FormGroup>
          )}
        />
      </Box>
    </Box>
  );

  // Step 4: Confirmation
  const renderConfirmationStep = () => {
    const selectedType = appointmentTypes.find(t => t.type === watchedValues.appointmentType);
    const selectedPharmacist = pharmacists.find(p => p._id === watchedValues.pharmacistId);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Confirm Your Appointment
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Schedule color="primary" />
                  <Typography variant="subtitle1">Service</Typography>
                </Box>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {selectedType?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Duration: {selectedType?.duration} minutes
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CalendarToday color="primary" />
                  <Typography variant="subtitle1">Date & Time</Typography>
                </Box>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {formatDateDisplay(watchedValues.scheduledDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {watchedValues.scheduledTime}
                </Typography>
              </Grid>

              {selectedPharmacist && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person color="primary" />
                    <Typography variant="subtitle1">Pharmacist</Typography>
                  </Box>
                  <Typography variant="body1">
                    {selectedPharmacist.name}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <NotificationsActive color="primary" />
                  <Typography variant="subtitle1">Reminders</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {watchedValues.notificationPreferences.email && (
                    <Chip label="Email" size="small" />
                  )}
                  {watchedValues.notificationPreferences.sms && (
                    <Chip label="SMS" size="small" />
                  )}
                  {watchedValues.notificationPreferences.whatsapp && (
                    <Chip label="WhatsApp" size="small" />
                  )}
                </Box>
              </Grid>

              {watchedValues.patientNotes && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Notes color="primary" />
                    <Typography variant="subtitle1">Notes</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {watchedValues.patientNotes}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {reservedSlot && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your time slot is reserved for {formatTimer(reservationTimer)}.
            Please confirm your booking to secure the appointment.
          </Alert>
        )}
      </Box>
    );
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderAppointmentTypeStep();
      case 1:
        return renderDateTimeStep();
      case 2:
        return renderDetailsStep();
      case 3:
        return renderConfirmationStep();
      default:
        return null;
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!watchedValues.appointmentType;
      case 1:
        return !!watchedValues.scheduledTime;
      case 2:
        return true; // Optional step
      case 3:
        return !!reservedSlot;
      default:
        return false;
    }
  };

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!watchedValues.appointmentType;
      case 1:
        return !!watchedValues.scheduledTime;
      case 2:
        return !!reservedSlot;
      case 3:
        return !!reservedSlot;
      default:
        return false;
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: isMobile ? 2 : 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        {onCancel && (
          <IconButton onClick={onCancel} size="large">
            <ArrowBack />
          </IconButton>
        )}

        <Typography variant="h4" component="h1">
          Book Appointment
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper
        activeStep={activeStep}
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{ mb: 4 }}
      >
        {steps.map((step, index) => (
          <Step key={step.label} completed={isStepComplete(index)}>
            <StepLabel
              icon={step.icon}
              optional={
                <Typography variant="caption">
                  {step.description}
                </Typography>
              }
            >
              {step.label}
            </StepLabel>
            {isMobile && (
              <StepContent>
                <Box sx={{ py: 2 }}>
                  {renderStepContent(index)}
                </Box>
              </StepContent>
            )}
          </Step>
        ))}
      </Stepper>

      {/* Step Content (Desktop) */}
      {!isMobile && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Fade in key={activeStep}>
              <Box>
                {renderStepContent(activeStep)}
              </Box>
            </Fade>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBack />}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={() => setShowConfirmDialog(true)}
              disabled={!canProceed(activeStep) || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
              size="large"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed(activeStep)}
              endIcon={<ArrowForward />}
              size="large"
            >
              Next
            </Button>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="primary" />
            Confirm Your Appointment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to book this appointment? You will receive a confirmation
            message with all the details.
          </Typography>

          {reservedSlot && (
            <Alert severity="warning">
              Your time slot expires in {formatTimer(reservationTimer)}.
              Please confirm now to secure your appointment.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowConfirmDialog(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {isSubmitting ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookAppointmentForm;