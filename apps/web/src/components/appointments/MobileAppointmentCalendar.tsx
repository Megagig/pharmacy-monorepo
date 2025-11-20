import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  Fab,
  Dialog,
  DialogContent,
  SwipeableDrawer,
  AppBar,
  Toolbar,
  Chip,
  Stack,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Slide,
  Zoom,
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
  FilterList,
  Close,
  SwipeLeft,
  SwipeRight,
  TouchApp,
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
import { useResponsive, useIsTouchDevice, useOrientation, useSafeAreaInsets } from '../../hooks/useResponsive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { Appointment, AppointmentType, AppointmentStatus, CalendarView } from '../../stores/appointmentTypes';

// Components
import CreateAppointmentDialog from './CreateAppointmentDialog';
import AppointmentDetailsPanel from './AppointmentDetailsPanel';

interface MobileAppointmentCalendarProps {
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Callback when appointment is selected */
  onAppointmentSelect?: (appointment: Appointment | null) => void;
  /** Callback when slot is clicked for new appointment */
  onSlotClick?: (date: Date, time?: string) => void;
}

// Color mapping for appointment types
const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  mtm_session: '#1976d2',
  chronic_disease_review: '#d32f2f',
  new_medication_consultation: '#388e3c',
  vaccination: '#f57c00',
  health_check: '#7b1fa2',
  smoking_cessation: '#5d4037',
  general_followup: '#616161',
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

const MobileAppointmentCalendar: React.FC<MobileAppointmentCalendarProps> = ({
  pharmacistId,
  locationId,
  onAppointmentSelect,
  onSlotClick,
}) => {
  const theme = useTheme();
  const { isMobile, isSmallMobile, screenWidth, screenHeight, getSpacing } = useResponsive();
  const isTouchDevice = useIsTouchDevice();
  const orientation = useOrientation();
  const safeAreaInsets = useSafeAreaInsets();
  const calendarRef = useRef<FullCalendar>(null);

  // Store state
  const {
    selectedDate,
    selectedView,
    setSelectedDate,
    setSelectedView,
    navigateDate,
    goToToday,
  } = useCalendarStore();

  const { selectedAppointment, selectAppointment } = useAppointmentStore();

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time?: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [viewTransition, setViewTransition] = useState(false);

  // API hooks
  const {
    data: calendarData,
    isLoading,
    error,
    refetch,
  } = useAppointmentCalendar({
    view: selectedView,
    date: format(selectedDate, 'yyyy-MM-dd'),
    pharmacistId,
    locationId,
  });

  const rescheduleAppointment = useRescheduleAppointment();

  // Get appointments from store
  const appointments = useMemo(() => {
    if (!calendarData?.data?.appointments) return [];
    return calendarData.data.appointments;
  }, [calendarData]);

  // Convert appointments to FullCalendar events
  const calendarEvents: EventInput[] = useMemo(() => {
    return appointments.map((appointment) => {
      const appointmentDate = new Date(appointment.scheduledDate);
      const [hours, minutes] = appointment.scheduledTime.split(':').map(Number);
      const startTime = new Date(appointmentDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + appointment.duration);

      const typeColor = APPOINTMENT_TYPE_COLORS[appointment.type];
      const statusStyle = APPOINTMENT_STATUS_STYLES[appointment.status];

      return {
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
        classNames: [`appointment-${appointment.status}`, 'mobile-appointment-event'],
        display: 'block',
        ...statusStyle,
      };
    });
  }, [appointments]);

  // Touch gesture handlers
  const { attachGestures } = useTouchGestures({
    onSwipeLeft: () => {
      setSwipeDirection('left');
      handleDateNavigation('next');
    },
    onSwipeRight: () => {
      setSwipeDirection('right');
      handleDateNavigation('prev');
    },
    onDoubleTap: () => {
      goToToday();
      if (calendarRef.current) {
        calendarRef.current.getApi().today();
      }
    },
  }, {
    swipeThreshold: 50,
    doubleTapDelay: 300,
  });

  // Handle view change with animation
  const handleViewChange = useCallback((view: CalendarView) => {
    setViewTransition(true);
    setTimeout(() => {
      setSelectedView(view);
      if (calendarRef.current) {
        calendarRef.current.getApi().changeView(
          view === 'day' ? 'timeGridDay' : 
          view === 'week' ? 'timeGridWeek' : 
          'dayGridMonth'
        );
      }
      setViewTransition(false);
    }, 150);
  }, [setSelectedView]);

  // Handle date navigation with swipe animation
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
    
    // Clear swipe direction after animation
    setTimeout(() => setSwipeDirection(null), 300);
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

  // Handle drag and drop rescheduling (disabled on mobile for better UX)
  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    // Revert immediately on mobile - use dedicated reschedule dialog instead
    if (isMobile) {
      dropInfo.revert();
      return;
    }

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
      dropInfo.revert();
      console.error('Failed to reschedule appointment:', error);
    }
  }, [isMobile, rescheduleAppointment]);

  // Handle refresh with haptic feedback
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    // Haptic feedback on supported devices
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Handle calendar date change
  const handleDatesSet = useCallback((dateInfo: any) => {
    setSelectedDate(dateInfo.start);
  }, [setSelectedDate]);

  // Mobile-optimized calendar configuration
  const mobileCalendarConfig = useMemo(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: selectedView === 'day' ? 'timeGridDay' : 
                selectedView === 'week' ? 'timeGridWeek' : 
                'dayGridMonth',
    initialDate: selectedDate,
    headerToolbar: false, // We'll use custom mobile toolbar
    height: orientation === 'landscape' ? screenHeight - 120 : screenHeight - 200,
    events: calendarEvents,
    selectable: true,
    selectMirror: true,
    editable: false, // Disabled for mobile - use dedicated dialogs
    droppable: false,
    eventClick: handleEventClick,
    select: handleDateSelect,
    eventDrop: handleEventDrop,
    datesSet: handleDatesSet,
    slotMinTime: '08:00:00',
    slotMaxTime: '18:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    allDaySlot: false,
    nowIndicator: true,
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      startTime: '08:00',
      endTime: '17:00',
    },
    weekends: true,
    dayMaxEvents: isSmallMobile ? 2 : 3,
    moreLinkClick: 'popover',
    eventDisplay: 'block',
    displayEventTime: !isSmallMobile,
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
    // Mobile-specific view configurations
    views: {
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', month: 'short', day: 'numeric' },
        slotLabelFormat: {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        },
      },
      timeGridWeek: {
        dayHeaderFormat: { weekday: 'short', day: 'numeric' },
        slotLabelFormat: {
          hour: 'numeric',
          hour12: true,
        },
      },
      dayGridMonth: {
        dayHeaderFormat: { weekday: 'short' },
        dayCellContent: (arg) => arg.dayNumberText,
      },
    },
    // Touch-friendly event sizing
    eventMinHeight: 30,
    eventShortHeight: 25,
    // Responsive font sizes
    eventTextColor: '#ffffff',
    eventBorderWidth: 2,
  }), [
    selectedView,
    selectedDate,
    calendarEvents,
    handleEventClick,
    handleDateSelect,
    handleEventDrop,
    handleDatesSet,
    orientation,
    screenHeight,
    isSmallMobile,
  ]);

  // Attach touch gestures to calendar
  useEffect(() => {
    if (calendarRef.current && isTouchDevice) {
      const calendarEl = calendarRef.current.getApi().el;
      attachGestures(calendarEl);
    }
  }, [attachGestures, isTouchDevice]);

  // Get today's appointments count for badge
  const todayAppointmentsCount = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments.filter(apt => 
      format(new Date(apt.scheduledDate), 'yyyy-MM-dd') === today &&
      apt.status !== 'cancelled' && apt.status !== 'completed'
    ).length;
  }, [appointments]);

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="50vh"
        sx={{ 
          paddingTop: `${safeAreaInsets.top}px`,
          paddingBottom: `${safeAreaInsets.bottom}px`,
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={40} />
          <Typography variant="body1" color="text.secondary">
            Loading calendar...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        p: 2,
        paddingTop: `${safeAreaInsets.top + 16}px`,
        paddingBottom: `${safeAreaInsets.bottom + 16}px`,
      }}>
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
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        position: 'relative',
        height: '100vh',
        paddingTop: `${safeAreaInsets.top}px`,
        paddingBottom: `${safeAreaInsets.bottom + 80}px`, // Space for bottom navigation
        overflow: 'hidden',
      }}
    >
      {/* Mobile Toolbar */}
      <AppBar 
        position="sticky" 
        elevation={1}
        sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
            {/* Navigation Controls */}
            <IconButton 
              onClick={() => handleDateNavigation('prev')} 
              size="small"
              sx={{ 
                bgcolor: swipeDirection === 'right' ? 'action.selected' : 'transparent',
                transition: 'background-color 0.3s ease',
              }}
            >
              <ChevronLeft />
            </IconButton>
            
            <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
              <Typography variant="h6" noWrap>
                {format(selectedDate, selectedView === 'day' ? 'EEEE, MMM dd' : 'MMMM yyyy')}
              </Typography>
              {selectedView === 'day' && (
                <Typography variant="caption" color="text.secondary">
                  {todayAppointmentsCount} appointments
                </Typography>
              )}
            </Box>
            
            <IconButton 
              onClick={() => handleDateNavigation('next')} 
              size="small"
              sx={{ 
                bgcolor: swipeDirection === 'left' ? 'action.selected' : 'transparent',
                transition: 'background-color 0.3s ease',
              }}
            >
              <ChevronRight />
            </IconButton>
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={1}>
            <IconButton 
              onClick={() => handleDateNavigation('today')} 
              size="small"
              color={isToday(selectedDate) ? 'primary' : 'default'}
            >
              <Today />
            </IconButton>
            
            <IconButton 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              size="small"
            >
              <Refresh sx={{ 
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }} />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Calendar Container with Swipe Animation */}
      <Box 
        sx={{ 
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          transform: swipeDirection ? 
            `translateX(${swipeDirection === 'left' ? '-10px' : '10px'})` : 
            'translateX(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        <Slide 
          direction={viewTransition ? 'up' : undefined} 
          in={!viewTransition} 
          timeout={300}
        >
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 0,
              boxShadow: 'none',
              '& .fc': {
                height: '100%',
              },
            }}
          >
            <CardContent sx={{ p: 1, height: '100%' }}>
              <FullCalendar
                ref={calendarRef}
                {...mobileCalendarConfig}
              />
            </CardContent>
          </Card>
        </Slide>
      </Box>

      {/* Bottom Navigation */}
      <BottomNavigation
        value={selectedView}
        onChange={(event, newValue) => handleViewChange(newValue)}
        sx={{
          position: 'fixed',
          bottom: safeAreaInsets.bottom,
          left: 0,
          right: 0,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          zIndex: 1000,
        }}
      >
        <BottomNavigationAction
          label="Month"
          value="month"
          icon={<ViewModule />}
        />
        <BottomNavigationAction
          label="Week"
          value="week"
          icon={<ViewWeek />}
        />
        <BottomNavigationAction
          label="Day"
          value="day"
          icon={
            <Badge badgeContent={todayAppointmentsCount} color="error" max={99}>
              <ViewDay />
            </Badge>
          }
        />
      </BottomNavigation>

      {/* Floating Action Button */}
      <Zoom in={!createDialogOpen && !detailsPanelOpen}>
        <Fab
          color="primary"
          aria-label="add appointment"
          onClick={() => {
            setSelectedSlot({ date: new Date() });
            setCreateDialogOpen(true);
          }}
          sx={{
            position: 'fixed',
            bottom: safeAreaInsets.bottom + 90,
            right: 16,
            zIndex: 1000,
          }}
        >
          <Add />
        </Fab>
      </Zoom>

      {/* Touch Gesture Hint */}
      {isTouchDevice && (
        <Box
          sx={{
            position: 'fixed',
            bottom: safeAreaInsets.bottom + 120,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        >
          <Chip
            icon={<TouchApp />}
            label="Swipe to navigate • Double tap for today"
            size="small"
            variant="outlined"
            sx={{
              bgcolor: 'background.paper',
              backdropFilter: 'blur(8px)',
            }}
          />
        </Box>
      )}

      {/* Create Appointment Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullScreen
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        <CreateAppointmentDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          selectedDate={selectedSlot?.date}
          selectedTime={selectedSlot?.time}
        />
      </Dialog>

      {/* Appointment Details Panel */}
      <SwipeableDrawer
        anchor="bottom"
        open={detailsPanelOpen}
        onClose={() => setDetailsPanelOpen(false)}
        onOpen={() => setDetailsPanelOpen(true)}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            height: '80vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: `${safeAreaInsets.bottom}px`,
          },
        }}
      >
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              bgcolor: 'divider',
              borderRadius: 2,
              mx: 'auto',
            }}
          />
        </Box>
        {selectedAppointment && (
          <AppointmentDetailsPanel
            appointmentId={selectedAppointment._id}
            onClose={() => setDetailsPanelOpen(false)}
            onEdit={(appointment) => {

              setDetailsPanelOpen(false);
            }}
            onReschedule={(appointment) => {

              setDetailsPanelOpen(false);
            }}
            onCancel={(appointment) => {

              setDetailsPanelOpen(false);
              refetch();
            }}
            onComplete={(appointment) => {

              setDetailsPanelOpen(false);
              refetch();
            }}
          />
        )}
      </SwipeableDrawer>

      {/* Mobile-specific styles */}
      <style jsx global>{`
        .mobile-appointment-event {
          border-radius: 6px !important;
          font-size: 11px !important;
          padding: 2px 4px !important;
          font-weight: 500 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
        }
        
        .mobile-appointment-event .fc-event-title {
          font-weight: 600 !important;
          line-height: 1.2 !important;
        }
        
        .fc-timegrid-slot {
          height: 35px !important;
        }
        
        .fc-timegrid-slot-label {
          font-size: 11px !important;
        }
        
        .fc-col-header-cell {
          padding: 4px 2px !important;
        }
        
        .fc-daygrid-day-number {
          font-size: 14px !important;
          font-weight: 500 !important;
        }
        
        .fc-now-indicator {
          border-color: #f44336 !important;
          border-width: 2px !important;
        }
        
        .fc-now-indicator-arrow {
          border-top-color: #f44336 !important;
          border-bottom-color: #f44336 !important;
          border-width: 6px !important;
        }
        
        /* Touch-friendly event sizing */
        .fc-event {
          min-height: 28px !important;
          cursor: pointer !important;
        }
        
        .fc-event:active {
          transform: scale(0.98) !important;
          transition: transform 0.1s ease !important;
        }
        
        /* Landscape orientation adjustments */
        @media (orientation: landscape) and (max-height: 500px) {
          .fc-timegrid-slot {
            height: 25px !important;
          }
          
          .mobile-appointment-event {
            font-size: 10px !important;
            padding: 1px 3px !important;
          }
        }
        
        /* High DPI displays */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .mobile-appointment-event {
            box-shadow: 0 0.5px 1.5px rgba(0, 0, 0, 0.2) !important;
          }
        }
        
        /* Reduced motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .fc-event:active {
            transform: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default MobileAppointmentCalendar;