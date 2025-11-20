import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Fade,
  Zoom,
} from '@mui/material';
import {
  CalendarToday,
  AccessTime,
  Person,
  LocationOn,
  CheckCircle,
  Schedule,
  ArrowBack,
  ArrowForward,
  Refresh,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday, startOfDay } from 'date-fns';
import { useAppointmentTypes, useAvailableSlots, useReserveSlot, useReleaseSlot } from '../../hooks/usePatientPortal';
import { AppointmentType, AvailableSlot } from '../../services/patientPortalService';

interface AvailableSlotsViewProps {
  workplaceId: string;
  onSlotSelect?: (slot: {
    date: string;
    time: string;
    type: string;
    pharmacistId?: string;
    pharmacistName?: string;
  }) => void;
  onBack?: () => void;
  selectedType?: string;
  preSelectedDate?: Date;
}

interface ReservedSlot {
  date: string;
  time: string;
  reservationId: string;
  expiresAt: Date;
}

const AvailableSlotsView: React.FC<AvailableSlotsViewProps> = ({
  workplaceId,
  onSlotSelect,
  onBack,
  selectedType,
  preSelectedDate,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [selectedDate, setSelectedDate] = useState<Date>(preSelectedDate || new Date());
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<string>(selectedType || '');
  const [reservedSlot, setReservedSlot] = useState<ReservedSlot | null>(null);
  const [reservationTimer, setReservationTimer] = useState<number>(0);

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
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: selectedAppointmentType,
      duration: selectedAppointmentType ? 
        appointmentTypesResponse?.data?.find(t => t.type === selectedAppointmentType)?.duration : 
        undefined,
    },
    !!workplaceId && !!selectedDate
  );

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

  // Date navigation handlers
  const handlePreviousDay = useCallback(() => {
    setSelectedDate(prev => subDays(prev, 1));
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate(prev => addDays(prev, 1));
  }, []);

  const handleDateChange = useCallback((newDate: Date | null) => {
    if (newDate) {
      setSelectedDate(newDate);
    }
  }, []);

  // Slot reservation handlers
  const handleSlotReserve = async (slot: AvailableSlot) => {
    if (!selectedAppointmentType) return;

    try {
      const response = await reserveSlotMutation.mutateAsync({
        workplaceId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: slot.time,
        type: selectedAppointmentType,
        pharmacistId: slot.pharmacistId,
      });

      setReservedSlot({
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: slot.time,
        reservationId: response.data.reservationId,
        expiresAt: new Date(response.data.expiresAt),
      });

      // Refetch slots to show updated availability
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

  const handleSlotConfirm = () => {
    if (!reservedSlot || !selectedAppointmentType) return;

    const selectedPharmacist = pharmacists.find(p => 
      availableSlots.find(s => s.time === reservedSlot.time && s.pharmacistId === p._id)
    );

    onSlotSelect?.({
      date: reservedSlot.date,
      time: reservedSlot.time,
      type: selectedAppointmentType,
      pharmacistId: selectedPharmacist?._id,
      pharmacistName: selectedPharmacist?.name,
    });
  };

  // Format date for display
  const formatDateDisplay = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  // Check if date is in the past
  const isPastDate = (date: Date): boolean => {
    return startOfDay(date) < startOfDay(new Date());
  };

  // Render appointment type selection
  const renderAppointmentTypes = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule color="primary" />
          Select Appointment Type
        </Typography>
        
        {loadingTypes ? (
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : typesError ? (
          <Alert severity="error">
            Failed to load appointment types. Please try again.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {appointmentTypes.map((type) => (
              <Grid item xs={12} sm={6} md={4} key={type.type}>
                <Card
                  sx={{
                    cursor: type.available ? 'pointer' : 'not-allowed',
                    opacity: type.available ? 1 : 0.6,
                    border: selectedAppointmentType === type.type ? 
                      `2px solid ${theme.palette.primary.main}` : 
                      `1px solid ${theme.palette.divider}`,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': type.available ? {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    } : {},
                  }}
                  onClick={() => type.available && setSelectedAppointmentType(type.type)}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {type.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {type.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        icon={<AccessTime />}
                        label={`${type.duration} min`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {selectedAppointmentType === type.type && (
                        <CheckCircle color="primary" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );

  // Render date selection
  const renderDateSelection = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarToday color="primary" />
          Select Date
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          flexWrap: isMobile ? 'wrap' : 'nowrap' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={handlePreviousDay}
              disabled={isPastDate(subDays(selectedDate, 1))}
              size="small"
            >
              <ArrowBack />
            </IconButton>
            
            <Typography variant="h6" sx={{ minWidth: 150, textAlign: 'center' }}>
              {formatDateDisplay(selectedDate)}
            </Typography>
            
            <IconButton onClick={handleNextDay} size="small">
              <ArrowForward />
            </IconButton>
          </Box>
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              minDate={new Date()}
              maxDate={addDays(new Date(), 90)} // 3 months ahead
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { minWidth: 150 },
                },
              }}
            />
          </LocalizationProvider>
          
          <Tooltip title="Refresh slots">
            <IconButton onClick={() => refetchSlots()} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );

  // Render available slots
  const renderAvailableSlots = () => {
    if (!selectedAppointmentType) {
      return (
        <Card>
          <CardContent>
            <Alert severity="info">
              Please select an appointment type to view available time slots.
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime color="primary" />
              Available Time Slots
            </Typography>
            
            {reservedSlot && (
              <Chip
                label={`Reserved: ${formatTimer(reservationTimer)}`}
                color="warning"
                variant="filled"
                sx={{ fontWeight: 'bold' }}
              />
            )}
          </Box>
          
          {loadingSlots ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Grid item xs={6} sm={4} md={3} key={i}>
                  <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : slotsError ? (
            <Alert severity="error">
              Failed to load available slots. Please try again.
            </Alert>
          ) : availableSlots.length === 0 ? (
            <Alert severity="info">
              No available slots for the selected date and appointment type. 
              Please try a different date.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {availableSlots.map((slot) => {
                const isReserved = reservedSlot?.time === slot.time;
                const pharmacist = pharmacists.find(p => p._id === slot.pharmacistId);
                
                return (
                  <Grid item xs={6} sm={4} md={3} key={`${slot.time}-${slot.pharmacistId}`}>
                    <Zoom in timeout={300}>
                      <Card
                        sx={{
                          cursor: slot.available && !isReserved ? 'pointer' : 'not-allowed',
                          opacity: slot.available ? 1 : 0.5,
                          border: isReserved ? 
                            `2px solid ${theme.palette.warning.main}` : 
                            `1px solid ${theme.palette.divider}`,
                          backgroundColor: isReserved ? 
                            theme.palette.warning.light : 
                            'inherit',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': slot.available && !isReserved ? {
                            transform: 'translateY(-2px)',
                            boxShadow: theme.shadows[4],
                          } : {},
                        }}
                        onClick={() => slot.available && !isReserved && handleSlotReserve(slot)}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {slot.time}
                          </Typography>
                          
                          {pharmacist && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                              <Person fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {pharmacist.name}
                              </Typography>
                            </Box>
                          )}
                          
                          {isReserved && (
                            <Chip
                              label="Reserved"
                              size="small"
                              color="warning"
                              variant="filled"
                            />
                          )}
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render reservation confirmation
  const renderReservationConfirmation = () => {
    if (!reservedSlot) return null;

    return (
      <Fade in timeout={300}>
        <Card sx={{ mt: 3, border: `2px solid ${theme.palette.warning.main}` }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="warning" />
              Slot Reserved
            </Typography>
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              You have reserved a time slot. Please confirm your booking within {formatTimer(reservationTimer)} 
              or the slot will be released automatically.
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSlotConfirm}
                sx={{ minWidth: 120 }}
              >
                Confirm Booking
              </Button>
              
              <Button
                variant="outlined"
                color="warning"
                onClick={handleSlotRelease}
                sx={{ minWidth: 120 }}
              >
                Release Slot
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 2 : 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        {onBack && (
          <IconButton onClick={onBack} size="large">
            <ArrowBack />
          </IconButton>
        )}
        
        <Typography variant="h4" component="h1">
          Book an Appointment
        </Typography>
      </Box>

      {/* Appointment Type Selection */}
      {renderAppointmentTypes()}

      {/* Date Selection */}
      {renderDateSelection()}

      {/* Available Slots */}
      {renderAvailableSlots()}

      {/* Reservation Confirmation */}
      {renderReservationConfirmation()}
    </Box>
  );
};

export default AvailableSlotsView;