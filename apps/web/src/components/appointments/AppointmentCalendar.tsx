import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  Add,
  Refresh,
  ViewWeek,
  ViewDay,
  ViewModule,
  Event,
  Schedule,
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { EventInput, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

// Hooks and services
import { useAppointmentCalendar } from '../../hooks/useAppointments';
import { useAppointmentStore, useAppointmentCalendar as useCalendarStore } from '../../stores/appointmentStore';
import { useRescheduleAppointment } from '../../hooks/useAppointments';
import { appointmentService } from '../../services/appointmentService';
import { Appointment, AppointmentType, AppointmentStatus, CalendarView } from '../../stores/appointmentTypes';

// Components (to be created in subsequent tasks)
import CreateAppointmentDialog from './CreateAppointmentDialog';
import AppointmentDetailsPanel from './AppointmentDetailsPanel';

interface AppointmentCalendarProps {
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Height of the calendar */
  height?: number | string;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to enable drag and drop */
  enableDragDrop?: boolean;
  /** Callback when appointment is selected */
  onAppointmentSelect?: (appointment: Appointment | null) => void;
  /** Callback when slot is clicked for new appointment */
  onSlotClick?: (date: Date, time?: string) => void;
}

// Color mapping for appointment types
const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  mtm_session: '#1976d2', // Blue
  chronic_disease_review: '#d32f2f', // Red
  new_medication_consultation: '#388e3c', // Green
  vaccination: '#f57c00', // Orange
  health_check: '#7b1fa2', // Purple
  smoking_cessation: '#5d4037', // Brown
  general_followup: '#616161', // Grey
};

// Status-based styling
const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, { opacity: number; borderStyle: string }> = {
  scheduled: { opacity: 1, borderStyle: 'solid' },
  confirmed: { opacity: 1, borderStyle: 'solid' },
  in_progress: { opacity: 1, borderStyle: 'double' },
  completed: { opacity: 0.7, borderStyle: 'solid' },
  cancelled: { opacity: 0.4, borderStyle: 'dashed' },
  no_show: { opacity: 0.4, borderStyle: 'dotted' },
  rescheduled: { opacity: 0.6, borderStyle: 'dashed' },
};

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  pharmacistId,
  locationId,
  height = 'calc(100vh - 200px)',
  showToolbar = true,
  enableDragDrop = true,
  onAppointmentSelect,
  onSlotClick,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const calendarRef = useRef<FullCalendar>(null);

  // Store state - Re-enabled with fixed selectors
  const {
    selectedDate,
    selectedView,
    setSelectedDate,
    setSelectedView,
    navigateDate,
    goToToday,
  } = useCalendarStore();

  // Simple initialization - set to today once on mount
  useEffect(() => {
    const today = new Date();

    setSelectedDate(today);
  }, []); // Run only once on mount

  // Sync FullCalendar with store state changes
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      
      // Update calendar date if it differs from selected date
      const currentCalendarDate = calendarApi.getDate();
      const selectedDateOnly = new Date(selectedDate);
      selectedDateOnly.setHours(0, 0, 0, 0);
      currentCalendarDate.setHours(0, 0, 0, 0);
      
      if (currentCalendarDate.getTime() !== selectedDateOnly.getTime()) {

        calendarApi.gotoDate(selectedDate);
      }
      
      // Update calendar view if it differs from selected view
      const currentView = calendarApi.view.type;
      const targetView = selectedView === 'day' ? 'timeGridDay' : 
                        selectedView === 'week' ? 'timeGridWeek' : 
                        'dayGridMonth';
      
      if (currentView !== targetView) {

        calendarApi.changeView(targetView);
      }
    }
  }, [selectedDate, selectedView]);

  const { selectedAppointment, selectAppointment } = useAppointmentStore();

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time?: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoize API parameters to prevent unnecessary re-renders
  const calendarParams = useMemo(() => {
    const dateToUse = selectedDate || new Date();
    const dateString = format(dateToUse, 'yyyy-MM-dd');
    
    const params = {
      view: selectedView,
      date: dateString,
      pharmacistId,
      locationId,
    };

    return params;
  }, [selectedView, selectedDate, pharmacistId, locationId]);

  // API hooks - Re-enabled with proper error handling
  const {
    data: calendarData,
    isLoading,
    error,
    refetch,
  } = useAppointmentCalendar(calendarParams, true); // Enabled with error handling





  const rescheduleAppointment = useRescheduleAppointment();

  // Get appointments from calendar data
  const appointments = useMemo(() => {

    if (!calendarData?.data?.appointments) {

      return [];
    }
    return calendarData.data.appointments;
  }, [calendarData]);

  // Convert appointments to FullCalendar events
  const calendarEvents: EventInput[] = useMemo(() => {
    if (!appointments || appointments.length === 0) {
      return [];
    }
    
    const events = appointments.map((appointment, index) => {


      // Fix timezone issue by using the date part from scheduledDate and time from scheduledTime
      const appointmentDate = new Date(appointment.scheduledDate);
      const [hours, minutes] = appointment.scheduledTime.split(':').map(Number);
      
      // Create start time using the date part and scheduled time
      // Use the local date but set the time correctly
      const year = appointmentDate.getFullYear();
      const month = appointmentDate.getMonth();
      const day = appointmentDate.getDate();
      
      const startTime = new Date(year, month, day, hours, minutes, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + (appointment.duration || 30));



      const typeColor = APPOINTMENT_TYPE_COLORS[appointment.type] || '#1976d2';
      const statusStyle = APPOINTMENT_STATUS_STYLES[appointment.status] || { opacity: 1, borderStyle: 'solid' };

      const event = {
        id: appointment._id,
        title: appointment.title || `${appointment.type.replace('_', ' ')} - ${appointment.patientId}`,
        start: startTime,
        end: endTime,
        backgroundColor: typeColor,
        borderColor: typeColor,
        textColor: '#ffffff',
        extendedProps: {
          appointment,
          type: appointment.type,
          status: appointment.status,
          patientId: appointment.patientId,
          assignedTo: appointment.assignedTo,
        },
        classNames: [`appointment-${appointment.status}`],
        display: 'block',
        // Apply status-based styling
        ...statusStyle,
      };

      return event;
    });
    
    return events;
  }, [appointments]);

  // Handle view change
  const handleViewChange = useCallback((view: CalendarView) => {
    setSelectedView(view);
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(
        view === 'day' ? 'timeGridDay' : 
        view === 'week' ? 'timeGridWeek' : 
        'dayGridMonth'
      );
    }
  }, [setSelectedView]);

  // Handle date navigation
  const handleDateNavigation = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      goToToday();
      if (calendarRef.current) {
        calendarRef.current.getApi().today();
      }
    } else {
      navigateDate(direction);
      if (calendarRef.current) {
        const api = calendarRef.current.getApi();
        if (direction === 'next') {
          api.next();
        } else {
          api.prev();
        }
      }
    }
  }, [navigateDate, goToToday]);

  // Handle event click (appointment selection)
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const appointment = clickInfo.event.extendedProps.appointment as Appointment;
    selectAppointment(appointment);
    setDetailsPanelOpen(true);
    onAppointmentSelect?.(appointment);
  }, [selectAppointment, onAppointmentSelect]);

  // Handle date/slot selection
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const selectedDate = selectInfo.start;
    const time = format(selectedDate, 'HH:mm');
    
    setSelectedSlot({ date: selectedDate, time });
    setCreateDialogOpen(true);
    onSlotClick?.(selectedDate, time);
    
    // Clear the selection
    selectInfo.view.calendar.unselect();
  }, [onSlotClick]);

  // Handle drag and drop rescheduling
  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    if (!enableDragDrop) return;

    const appointment = dropInfo.event.extendedProps.appointment as Appointment;
    const newDate = dropInfo.event.start;
    
    if (!newDate) return;

    try {
      await rescheduleAppointment.mutateAsync({
        appointmentId: appointment._id,
        rescheduleData: {
          newDate: format(newDate, 'yyyy-MM-dd'),
          newTime: format(newDate, 'HH:mm'),
          reason: 'Rescheduled via drag and drop',
          notifyPatient: true,
        },
      });
    } catch (error) {
      // Revert the event position
      dropInfo.revert();
      console.error('Failed to reschedule appointment:', error);
    }
  }, [enableDragDrop, rescheduleAppointment]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Handle calendar date change (when user navigates) - Simplified to prevent loops
  const handleDatesSet = useCallback((dateInfo: any) => {
    // Only log the change, don't update state to prevent loops

  }, []);

  // Mobile-specific configurations
  const mobileConfig = useMemo(() => {
    if (!isMobile) return {};
    
    return {
      height: 'auto',
      aspectRatio: 1.2,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      views: {
        timeGridWeek: {
          dayHeaderFormat: { weekday: 'short' },
        },
        timeGridDay: {
          dayHeaderFormat: { weekday: 'long', month: 'short', day: 'numeric' },
        },
      },
    };
  }, [isMobile]);

  // Calendar configuration - split into static and dynamic parts to avoid infinite loops
  const staticCalendarConfig = useMemo(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    selectable: true,
    selectMirror: true,
    slotMinTime: '08:00:00',
    slotMaxTime: '18:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    allDaySlot: false,
    nowIndicator: true,
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday - Saturday
      startTime: '08:00',
      endTime: '17:00',
    },
    weekends: true,
    dayMaxEvents: 3,
    moreLinkClick: 'popover',
    eventDisplay: 'block',
    displayEventTime: true,
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
  }), []);

  const dynamicCalendarConfig = useMemo(() => {
    // Map view names to FullCalendar view types
    const viewMap = {
      'day': 'timeGridDay',
      'week': 'timeGridWeek',
      'month': 'dayGridMonth'
    };
    
    const initialView = viewMap[selectedView] || 'dayGridMonth';
    
    return {
      initialView,
      initialDate: selectedDate, // Use store date
      headerToolbar: showToolbar ? {
        left: isMobile ? 'prev,next' : 'prev,next today',
        center: 'title',
        right: isMobile ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay',
      } : false,
      height,
      editable: enableDragDrop,
      droppable: enableDragDrop,
      ...mobileConfig,
    };
  }, [selectedView, selectedDate, showToolbar, height, enableDragDrop, isMobile, mobileConfig]);



  // Full calendar configuration - simplified to prevent loops
  const calendarConfig = useMemo(() => ({
    ...staticCalendarConfig,
    ...dynamicCalendarConfig,
    events: calendarEvents,
    eventClick: handleEventClick,
    select: handleDateSelect,
    eventDrop: handleEventDrop,
    datesSet: handleDatesSet,
  }), [
    staticCalendarConfig,
    dynamicCalendarConfig,
    calendarEvents,
    handleEventClick,
    handleDateSelect,
    handleEventDrop,
    handleDatesSet,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading calendar...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={handleRefresh}>
                Retry
              </Button>
            }
          >
            Failed to load calendar: {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Custom Toolbar */}
      {showToolbar && !isMobile && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              {/* Navigation Controls */}
              <Box display="flex" alignItems="center" gap={1}>
                <IconButton onClick={() => handleDateNavigation('prev')} size="small">
                  <ChevronLeft />
                </IconButton>
                <IconButton onClick={() => handleDateNavigation('next')} size="small">
                  <ChevronRight />
                </IconButton>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Today />}
                  onClick={() => handleDateNavigation('today')}
                  sx={{ ml: 1 }}
                >
                  Today
                </Button>
                <Typography variant="h6" sx={{ ml: 2 }}>
                  {format(new Date(), 'MMMM yyyy')}
                </Typography>
              </Box>

              {/* View Controls */}
              <Box display="flex" alignItems="center" gap={1}>
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    variant={selectedView === 'month' ? 'contained' : 'outlined'}
                    startIcon={<ViewModule />}
                    onClick={() => handleViewChange('month')}
                  >
                    Month
                  </Button>
                  <Button
                    variant={selectedView === 'week' ? 'contained' : 'outlined'}
                    startIcon={<ViewWeek />}
                    onClick={() => handleViewChange('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={selectedView === 'day' ? 'contained' : 'outlined'}
                    startIcon={<ViewDay />}
                    onClick={() => handleViewChange('day')}
                  >
                    Day
                  </Button>
                </ButtonGroup>

                <Tooltip title="Go to Today">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Today />}
                    onClick={() => {
                      const today = new Date();

                      setSelectedDate(today);
                      if (calendarRef.current) {
                        const calendarApi = calendarRef.current.getApi();
                        calendarApi.gotoDate(today);
                        calendarApi.today(); // Also call the built-in today method
                      }
                    }}
                  >
                    Reset to Today
                  </Button>
                </Tooltip>

                <Tooltip title="Refresh calendar">
                  <IconButton 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    size="small"
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardContent sx={{ p: 1 }}>

          
          <FullCalendar
            ref={calendarRef}
            key={`calendar-${selectedView}`}
            {...calendarConfig}
          />
        </CardContent>
      </Card>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add appointment"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={() => {
            setSelectedSlot({ date: new Date() });
            setCreateDialogOpen(true);
          }}
        >
          <Add />
        </Fab>
      )}

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setSelectedSlot(null);
        }}
        selectedDate={selectedSlot?.date}
        selectedTime={selectedSlot?.time}
      />

      {/* Appointment Details Panel */}
      <Dialog
        open={detailsPanelOpen}
        onClose={() => setDetailsPanelOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogContent sx={{ p: 0 }}>
          {selectedAppointment && (
            <AppointmentDetailsPanel
              appointmentId={selectedAppointment._id}
              onClose={() => setDetailsPanelOpen(false)}
              onEdit={(appointment) => {
                // TODO: Implement edit functionality in future task

                setDetailsPanelOpen(false);
              }}
              onReschedule={(appointment) => {
                // TODO: Implement reschedule functionality in future task

                setDetailsPanelOpen(false);
              }}
              onCancel={(appointment) => {

                setDetailsPanelOpen(false);
                // Refresh calendar data
                refetch();
              }}
              onComplete={(appointment) => {

                setDetailsPanelOpen(false);
                // Refresh calendar data
                refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Styles - Temporarily removed to prevent React warnings */}
      {/* TODO: Move these styles to a proper CSS file or use styled-components */}
    </Box>
  );
};

export default AppointmentCalendar;