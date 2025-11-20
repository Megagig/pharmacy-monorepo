import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fade,
  Collapse,
} from '@mui/material';
import {
  CheckCircle,
  CalendarToday,
  AccessTime,
  Person,
  LocationOn,
  Phone,
  Email,
  Directions,
  EventAvailable,
  Info,
  Print,
  Share,
  ExpandMore,
  ExpandLess,
  Schedule,
  NotificationsActive,
  MedicalServices,
  Assignment,
} from '@mui/icons-material';
import { format, parseISO, addMinutes } from 'date-fns';

import { PatientAppointment } from '../../services/patientPortalService';

interface AppointmentConfirmationProps {
  appointment: PatientAppointment;
  confirmationCode?: string;
  pharmacyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    directions?: string;
    parkingInfo?: string;
  };
  onClose?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
  onAddToCalendar?: (appointment: PatientAppointment) => void;
  showActions?: boolean;
}

interface PreparationInstruction {
  icon: React.ReactNode;
  title: string;
  description: string;
  isImportant?: boolean;
}

const AppointmentConfirmation: React.FC<AppointmentConfirmationProps> = ({
  appointment,
  confirmationCode,
  pharmacyInfo,
  onClose,
  onPrint,
  onShare,
  onAddToCalendar,
  showActions = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [showPreparationDetails, setShowPreparationDetails] = useState(false);
  const [showPharmacyDetails, setShowPharmacyDetails] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Format date and time for display
  const formatDateDisplay = (dateStr: string): string => {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const formatTimeDisplay = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  // Calculate end time
  const getEndTime = (): string => {
    const [hours, minutes] = appointment.scheduledTime.split(':');
    const startDate = new Date();
    startDate.setHours(parseInt(hours), parseInt(minutes));
    const endDate = addMinutes(startDate, appointment.duration);
    return format(endDate, 'h:mm a');
  };

  // Get appointment type display name
  const getAppointmentTypeDisplay = (): string => {
    return appointment.title || 
           appointment.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get preparation instructions based on appointment type
  const getPreparationInstructions = (): PreparationInstruction[] => {
    const baseInstructions: PreparationInstruction[] = [
      {
        icon: <Schedule color="primary" />,
        title: 'Arrive on Time',
        description: 'Please arrive 5-10 minutes before your scheduled appointment time.',
      },
      {
        icon: <Assignment color="primary" />,
        title: 'Bring Required Documents',
        description: 'Bring a valid ID, insurance card, and any relevant medical records.',
      },
    ];

    // Add type-specific instructions
    const typeSpecificInstructions: Record<string, PreparationInstruction[]> = {
      mtm_session: [
        {
          icon: <MedicalServices color="warning" />,
          title: 'Bring All Medications',
          description: 'Please bring all prescription and over-the-counter medications you are currently taking.',
          isImportant: true,
        },
        {
          icon: <Info color="primary" />,
          title: 'Prepare Questions',
          description: 'Write down any questions or concerns about your medications.',
        },
      ],
      vaccination: [
        {
          icon: <MedicalServices color="warning" />,
          title: 'Vaccination History',
          description: 'Bring your vaccination record or any previous vaccination documentation.',
          isImportant: true,
        },
        {
          icon: <Info color="primary" />,
          title: 'Wear Appropriate Clothing',
          description: 'Wear loose-fitting clothing that allows easy access to your upper arm.',
        },
      ],
      health_check: [
        {
          icon: <Info color="primary" />,
          title: 'Health History',
          description: 'Be prepared to discuss your current health status and any recent changes.',
        },
        {
          icon: <MedicalServices color="primary" />,
          title: 'Current Medications',
          description: 'Have a list of all medications and supplements you are taking.',
        },
      ],
      chronic_disease_review: [
        {
          icon: <MedicalServices color="warning" />,
          title: 'Recent Test Results',
          description: 'Bring any recent lab results, blood pressure readings, or other relevant test results.',
          isImportant: true,
        },
        {
          icon: <Info color="primary" />,
          title: 'Symptom Log',
          description: 'Keep track of any symptoms or changes since your last visit.',
        },
      ],
    };

    const specificInstructions = typeSpecificInstructions[appointment.type] || [];
    return [...baseInstructions, ...specificInstructions];
  };

  // Handle add to calendar
  const handleAddToCalendar = () => {
    if (onAddToCalendar) {
      onAddToCalendar(appointment);
    } else {
      setShowCalendarDialog(true);
    }
  };

  // Generate calendar event data
  const generateCalendarEventData = () => {
    const startDateTime = parseISO(`${appointment.scheduledDate}T${appointment.scheduledTime}`);
    const endDateTime = addMinutes(startDateTime, appointment.duration);
    
    const eventData = {
      title: `${getAppointmentTypeDisplay()} - ${pharmacyInfo?.name || 'Pharmacy'}`,
      start: startDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      end: endDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      description: `${appointment.description || ''}\n\nPharmacist: ${appointment.pharmacistName || 'TBD'}\nConfirmation Code: ${confirmationCode || 'N/A'}`,
      location: pharmacyInfo?.address || appointment.locationName || '',
    };

    return eventData;
  };

  // Generate calendar URLs
  const generateCalendarUrls = () => {
    const eventData = generateCalendarEventData();
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventData.title)}&dates=${eventData.start}/${eventData.end}&details=${encodeURIComponent(eventData.description)}&location=${encodeURIComponent(eventData.location)}`;
    
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventData.title)}&startdt=${eventData.start}&enddt=${eventData.end}&body=${encodeURIComponent(eventData.description)}&location=${encodeURIComponent(eventData.location)}`;
    
    return { googleUrl, outlookUrl };
  };

  const preparationInstructions = getPreparationInstructions();
  const { googleUrl, outlookUrl } = generateCalendarUrls();

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: isMobile ? 2 : 3 }}>
      {/* Success Header */}
      <Fade in timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            p: 3, 
            mb: 3, 
            textAlign: 'center',
            background: `linear-gradient(135deg, ${theme.palette.success.light}20, ${theme.palette.success.main}20)`,
            border: `1px solid ${theme.palette.success.main}40`,
          }}
        >
          <CheckCircle 
            sx={{ 
              fontSize: 64, 
              color: 'success.main', 
              mb: 2,
              animation: animationComplete ? 'none' : 'pulse 1s ease-in-out',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.1)' },
                '100%': { transform: 'scale(1)' },
              },
            }} 
          />
          <Typography variant="h4" component="h1" gutterBottom color="success.main">
            Appointment Confirmed!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your appointment has been successfully booked. You will receive a confirmation message shortly.
          </Typography>
          {confirmationCode && (
            <Chip
              label={`Confirmation Code: ${confirmationCode}`}
              color="success"
              variant="outlined"
              sx={{ mt: 2, fontWeight: 'bold' }}
            />
          )}
        </Paper>
      </Fade>

      {/* Appointment Details */}
      <Fade in timeout={700}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Appointment Details
            </Typography>
            
            <Grid container spacing={3}>
              {/* Service Type */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MedicalServices color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Service
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom>
                  {getAppointmentTypeDisplay()}
                </Typography>
                {appointment.description && (
                  <Typography variant="body2" color="text.secondary">
                    {appointment.description}
                  </Typography>
                )}
              </Grid>

              {/* Date & Time */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CalendarToday color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Date & Time
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom>
                  {formatDateDisplay(appointment.scheduledDate)}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {formatTimeDisplay(appointment.scheduledTime)} - {getEndTime()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Duration: {appointment.duration} minutes
                </Typography>
              </Grid>

              {/* Pharmacist */}
              {appointment.pharmacistName && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Pharmacist
                    </Typography>
                  </Box>
                  <Typography variant="body1">
                    {appointment.pharmacistName}
                  </Typography>
                </Grid>
              )}

              {/* Status */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <NotificationsActive color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Status
                  </Typography>
                </Box>
                <Chip
                  icon={<CheckCircle />}
                  label="Confirmed"
                  color="success"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Fade>

      {/* Pharmacy Information */}
      {pharmacyInfo && (
        <Fade in timeout={900}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" component="h2">
                  Pharmacy Information
                </Typography>
                <IconButton
                  onClick={() => setShowPharmacyDetails(!showPharmacyDetails)}
                  size="small"
                >
                  {showPharmacyDetails ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocationOn color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {pharmacyInfo.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {pharmacyInfo.address}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Phone color="primary" />
                    <Typography variant="body1">
                      {pharmacyInfo.phone}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email color="primary" />
                    <Typography variant="body1">
                      {pharmacyInfo.email}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Collapse in={showPharmacyDetails}>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  {pharmacyInfo.directions && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Directions
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pharmacyInfo.directions}
                      </Typography>
                    </Grid>
                  )}
                  
                  {pharmacyInfo.parkingInfo && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Parking Information
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pharmacyInfo.parkingInfo}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Collapse>

              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  startIcon={<Directions />}
                  variant="outlined"
                  size="small"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(pharmacyInfo.address)}`, '_blank')}
                >
                  Get Directions
                </Button>
                
                <Button
                  startIcon={<Phone />}
                  variant="outlined"
                  size="small"
                  onClick={() => window.open(`tel:${pharmacyInfo.phone}`, '_self')}
                >
                  Call Pharmacy
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Preparation Instructions */}
      <Fade in timeout={1100}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h5" component="h2">
                Preparation Instructions
              </Typography>
              <IconButton
                onClick={() => setShowPreparationDetails(!showPreparationDetails)}
                size="small"
              >
                {showPreparationDetails ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              Please review these instructions to ensure your appointment goes smoothly.
            </Alert>

            <List>
              {preparationInstructions.slice(0, showPreparationDetails ? undefined : 2).map((instruction, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon>
                    {instruction.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography 
                        variant="subtitle2" 
                        color={instruction.isImportant ? 'warning.main' : 'text.primary'}
                        fontWeight={instruction.isImportant ? 'bold' : 'normal'}
                      >
                        {instruction.title}
                        {instruction.isImportant && (
                          <Chip 
                            label="Important" 
                            size="small" 
                            color="warning" 
                            sx={{ ml: 1, height: 20 }} 
                          />
                        )}
                      </Typography>
                    }
                    secondary={instruction.description}
                  />
                </ListItem>
              ))}
            </List>

            {!showPreparationDetails && preparationInstructions.length > 2 && (
              <Button
                onClick={() => setShowPreparationDetails(true)}
                startIcon={<ExpandMore />}
                size="small"
              >
                Show {preparationInstructions.length - 2} more instructions
              </Button>
            )}
          </CardContent>
        </Card>
      </Fade>

      {/* Action Buttons */}
      {showActions && (
        <Fade in timeout={1300}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<EventAvailable />}
                    onClick={handleAddToCalendar}
                    size={isMobile ? 'medium' : 'large'}
                  >
                    Add to Calendar
                  </Button>
                </Grid>

                {onPrint && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Print />}
                      onClick={onPrint}
                      size={isMobile ? 'medium' : 'large'}
                    >
                      Print Details
                    </Button>
                  </Grid>
                )}

                {onShare && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Share />}
                      onClick={onShare}
                      size={isMobile ? 'medium' : 'large'}
                    >
                      Share
                    </Button>
                  </Grid>
                )}

                {onClose && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      fullWidth
                      variant="text"
                      onClick={onClose}
                      size={isMobile ? 'medium' : 'large'}
                    >
                      Close
                    </Button>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Add to Calendar Dialog */}
      <Dialog
        open={showCalendarDialog}
        onClose={() => setShowCalendarDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailable color="primary" />
            Add to Calendar
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Choose your preferred calendar application:
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  window.open(googleUrl, '_blank');
                  setShowCalendarDialog(false);
                }}
                sx={{ py: 2 }}
              >
                Google Calendar
              </Button>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  window.open(outlookUrl, '_blank');
                  setShowCalendarDialog(false);
                }}
                sx={{ py: 2 }}
              >
                Outlook Calendar
              </Button>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 2 }}>
            You can also manually add this appointment to your calendar using the details above.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCalendarDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AppointmentConfirmation;