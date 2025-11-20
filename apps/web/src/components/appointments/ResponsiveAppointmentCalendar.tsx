import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import AppointmentCalendar from './AppointmentCalendar';
import MobileAppointmentCalendar from './MobileAppointmentCalendar';
import { Appointment } from '../../stores/appointmentTypes';

interface ResponsiveAppointmentCalendarProps {
  /** Optional pharmacist filter */
  pharmacistId?: string;
  /** Optional location filter */
  locationId?: string;
  /** Height of the calendar (desktop only) */
  height?: number | string;
  /** Whether to show the toolbar (desktop only) */
  showToolbar?: boolean;
  /** Whether to enable drag and drop (desktop only) */
  enableDragDrop?: boolean;
  /** Callback when appointment is selected */
  onAppointmentSelect?: (appointment: Appointment | null) => void;
  /** Callback when slot is clicked for new appointment */
  onSlotClick?: (date: Date, time?: string) => void;
  /** Force mobile or desktop view */
  forceView?: 'mobile' | 'desktop';
}

/**
 * Responsive wrapper component that automatically switches between
 * desktop and mobile appointment calendar implementations based on screen size
 */
const ResponsiveAppointmentCalendar: React.FC<ResponsiveAppointmentCalendarProps> = ({
  pharmacistId,
  locationId,
  height = 'calc(100vh - 200px)',
  showToolbar = true,
  enableDragDrop = true,
  onAppointmentSelect,
  onSlotClick,
  forceView,
}) => {
  const { isMobile } = useResponsive();
  
  // Determine which view to use
  const useMobileView = forceView === 'mobile' || (forceView !== 'desktop' && isMobile);

  if (useMobileView) {
    return (
      <MobileAppointmentCalendar
        pharmacistId={pharmacistId}
        locationId={locationId}
        onAppointmentSelect={onAppointmentSelect}
        onSlotClick={onSlotClick}
      />
    );
  }

  return (
    <AppointmentCalendar
      pharmacistId={pharmacistId}
      locationId={locationId}
      height={height}
      showToolbar={showToolbar}
      enableDragDrop={enableDragDrop}
      onAppointmentSelect={onAppointmentSelect}
      onSlotClick={onSlotClick}
    />
  );
};

export default ResponsiveAppointmentCalendar;