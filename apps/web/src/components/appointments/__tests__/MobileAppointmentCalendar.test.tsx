import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import MobileAppointmentCalendar from '../MobileAppointmentCalendar';
import { MobileAccessibilityProvider } from '../../common/MobileAccessibilityProvider';

// Mock hooks
jest.mock('../../../hooks/useAppointments', () => ({
  useAppointmentCalendar: jest.fn(() => ({
    data: {
      data: {
        appointments: [
          {
            _id: '1',
            title: 'Test Appointment',
            scheduledDate: new Date('2025-10-27'),
            scheduledTime: '10:00',
            duration: 30,
            type: 'mtm_session',
            status: 'scheduled',
            patientId: 'patient1',
            assignedTo: 'pharmacist1',
          },
        ],
      },
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useRescheduleAppointment: jest.fn(() => ({
    mutateAsync: jest.fn(),
  })),
}));

jest.mock('../../../stores/appointmentStore', () => ({
  useAppointmentStore: jest.fn(() => ({
    selectedAppointment: null,
    selectAppointment: jest.fn(),
  })),
  useAppointmentCalendar: jest.fn(() => ({
    selectedDate: new Date('2025-10-27'),
    selectedView: 'day',
    setSelectedDate: jest.fn(),
    setSelectedView: jest.fn(),
    navigateDate: jest.fn(),
    goToToday: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    isMobile: true,
    isSmallMobile: false,
    screenWidth: 375,
    screenHeight: 667,
    getSpacing: jest.fn((mobile) => mobile),
  })),
  useIsTouchDevice: jest.fn(() => true),
  useOrientation: jest.fn(() => 'portrait'),
  useSafeAreaInsets: jest.fn(() => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })),
}));

jest.mock('../../../hooks/useTouchGestures', () => ({
  useTouchGestures: jest.fn(() => ({
    attachGestures: jest.fn(),
  })),
}));

// Mock FullCalendar
jest.mock('@fullcalendar/react', () => {
  return React.forwardRef<any, any>((props, ref) => (
    <div data-testid="fullcalendar" ref={ref}>
      Mock FullCalendar
      {props.events?.map((event: any) => (
        <div
          key={event.id}
          data-testid={`calendar-event-${event.id}`}
          onClick={() => props.eventClick?.({ event })}
        >
          {event.title}
        </div>
      ))}
    </div>
  ));
});

const theme = createTheme();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <MobileAccessibilityProvider>
          {children}
        </MobileAccessibilityProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

describe('MobileAppointmentCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mobile calendar interface', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByTestId('fullcalendar')).toBeInTheDocument();
    expect(screen.getByText('October 2025')).toBeInTheDocument();
  });

  it('displays appointments in calendar', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    expect(screen.getByText('Test Appointment')).toBeInTheDocument();
  });

  it('shows mobile toolbar with navigation controls', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Check for navigation buttons
    const prevButton = screen.getByLabelText(/previous/i) || screen.getByRole('button', { name: /chevron left/i });
    const nextButton = screen.getByLabelText(/next/i) || screen.getByRole('button', { name: /chevron right/i });
    const todayButton = screen.getByLabelText(/today/i) || screen.getByRole('button', { name: /today/i });

    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(todayButton).toBeInTheDocument();
  });

  it('displays bottom navigation with view options', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
  });

  it('shows floating action button for creating appointments', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    const fab = screen.getByLabelText('add appointment');
    expect(fab).toBeInTheDocument();
  });

  it('opens create appointment dialog when FAB is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    const fab = screen.getByLabelText('add appointment');
    await user.click(fab);

    // Should open create appointment dialog
    await waitFor(() => {
      expect(screen.getByText('New Appointment')).toBeInTheDocument();
    });
  });

  it('handles appointment click to show details', async () => {
    const onAppointmentSelect = jest.fn();
    
    render(
      <TestWrapper>
        <MobileAppointmentCalendar onAppointmentSelect={onAppointmentSelect} />
      </TestWrapper>
    );

    const appointmentEvent = screen.getByTestId('calendar-event-1');
    fireEvent.click(appointmentEvent);

    expect(onAppointmentSelect).toHaveBeenCalled();
  });

  it('displays touch gesture hints', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByText(/swipe to navigate/i)).toBeInTheDocument();
  });

  it('handles view changes through bottom navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    const weekButton = screen.getByText('Week');
    await user.click(weekButton);

    // Should trigger view change
    expect(weekButton).toHaveAttribute('aria-selected', 'true');
  });

  it('shows appointment count badge on day view', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Should show appointment count in toolbar or badge
    expect(screen.getByText(/1 appointment/i)).toBeInTheDocument();
  });

  it('handles refresh action', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    const refreshButton = screen.getByLabelText(/refresh/i);
    await user.click(refreshButton);

    // Should trigger refresh animation
    expect(refreshButton).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    // Mock loading state
    const useAppointmentCalendar = require('../../../hooks/useAppointments').useAppointmentCalendar;
    useAppointmentCalendar.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByText('Loading calendar...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error state correctly', () => {
    // Mock error state
    const useAppointmentCalendar = require('../../../hooks/useAppointments').useAppointmentCalendar;
    useAppointmentCalendar.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load calendar'),
      refetch: jest.fn(),
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(screen.getByText(/failed to load calendar/i)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('applies safe area insets for devices with notches', () => {
    const useSafeAreaInsets = require('../../../hooks/useResponsive').useSafeAreaInsets;
    useSafeAreaInsets.mockReturnValue({
      top: 44,
      right: 0,
      bottom: 34,
      left: 0,
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Should apply safe area insets to container
    const container = screen.getByTestId('fullcalendar').closest('div');
    expect(container).toHaveStyle('padding-top: 44px');
  });

  it('handles landscape orientation', () => {
    const useOrientation = require('../../../hooks/useResponsive').useOrientation;
    useOrientation.mockReturnValue('landscape');

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Should adjust layout for landscape
    expect(screen.getByTestId('fullcalendar')).toBeInTheDocument();
  });

  it('supports accessibility features', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Check for ARIA labels
    expect(screen.getByLabelText('add appointment')).toBeInTheDocument();
    
    // Check for keyboard navigation support
    const fab = screen.getByLabelText('add appointment');
    expect(fab).toHaveAttribute('tabIndex', '0');
  });

  it('handles small mobile screens', () => {
    const useResponsive = require('../../../hooks/useResponsive').useResponsive;
    useResponsive.mockReturnValue({
      isMobile: true,
      isSmallMobile: true,
      screenWidth: 320,
      screenHeight: 568,
      getSpacing: jest.fn((mobile) => mobile),
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Should adapt to small screen
    expect(screen.getByTestId('fullcalendar')).toBeInTheDocument();
  });

  it('prevents drag and drop on mobile', () => {
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // FullCalendar should be configured with editable: false for mobile
    const calendar = screen.getByTestId('fullcalendar');
    expect(calendar).toBeInTheDocument();
  });

  it('shows swipeable drawer for appointment details', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    const appointmentEvent = screen.getByTestId('calendar-event-1');
    await user.click(appointmentEvent);

    // Should open swipeable drawer
    await waitFor(() => {
      expect(screen.getByRole('presentation')).toBeInTheDocument();
    });
  });
});

describe('MobileAppointmentCalendar Touch Gestures', () => {
  it('attaches touch gesture handlers', () => {
    const mockAttachGestures = jest.fn();
    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    useTouchGestures.mockReturnValue({
      attachGestures: mockAttachGestures,
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    expect(mockAttachGestures).toHaveBeenCalled();
  });

  it('handles swipe gestures for navigation', () => {
    const mockNavigateDate = jest.fn();
    const useAppointmentCalendar = require('../../../stores/appointmentStore').useAppointmentCalendar;
    useAppointmentCalendar.mockReturnValue({
      selectedDate: new Date('2025-10-27'),
      selectedView: 'day',
      setSelectedDate: jest.fn(),
      setSelectedView: jest.fn(),
      navigateDate: mockNavigateDate,
      goToToday: jest.fn(),
    });

    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    let gestureHandlers: any = {};
    useTouchGestures.mockImplementation((handlers: any) => {
      gestureHandlers = handlers;
      return { attachGestures: jest.fn() };
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Simulate swipe left (next)
    act(() => {
      gestureHandlers.onSwipeLeft();
    });

    expect(mockNavigateDate).toHaveBeenCalledWith('next');
  });

  it('handles double tap for today navigation', () => {
    const mockGoToToday = jest.fn();
    const useAppointmentCalendar = require('../../../stores/appointmentStore').useAppointmentCalendar;
    useAppointmentCalendar.mockReturnValue({
      selectedDate: new Date('2025-10-27'),
      selectedView: 'day',
      setSelectedDate: jest.fn(),
      setSelectedView: jest.fn(),
      navigateDate: jest.fn(),
      goToToday: mockGoToToday,
    });

    const useTouchGestures = require('../../../hooks/useTouchGestures').useTouchGestures;
    let gestureHandlers: any = {};
    useTouchGestures.mockImplementation((handlers: any) => {
      gestureHandlers = handlers;
      return { attachGestures: jest.fn() };
    });

    render(
      <TestWrapper>
        <MobileAppointmentCalendar />
      </TestWrapper>
    );

    // Simulate double tap
    act(() => {
      gestureHandlers.onDoubleTap();
    });

    expect(mockGoToToday).toHaveBeenCalled();
  });
});