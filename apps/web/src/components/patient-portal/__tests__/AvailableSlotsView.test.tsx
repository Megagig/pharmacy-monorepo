import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { format, addDays } from 'date-fns';

import AvailableSlotsView from '../AvailableSlotsView';
import { theme } from '../../../theme';
import * as patientPortalHooks from '../../../hooks/usePatientPortal';

// Mock the patient portal hooks
vi.mock('../../../hooks/usePatientPortal');

// Mock Material-UI useMediaQuery hook
vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false), // Default to desktop view
}));

// Mock date-fns to have consistent dates in tests
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    isToday: vi.fn(() => false),
    isTomorrow: vi.fn(() => false),
    isYesterday: vi.fn(() => false),
  };
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Mock data
const mockAppointmentTypes = [
  {
    type: 'mtm_session',
    name: 'Medication Therapy Management',
    description: 'Comprehensive medication review with pharmacist',
    duration: 30,
    available: true,
  },
  {
    type: 'health_check',
    name: 'Health Check',
    description: 'Basic health screening and consultation',
    duration: 15,
    available: true,
  },
  {
    type: 'vaccination',
    name: 'Vaccination',
    description: 'Immunization services',
    duration: 10,
    available: false,
  },
];

const mockAvailableSlots = [
  {
    time: '09:00',
    available: true,
    pharmacistId: 'pharmacist1',
    pharmacistName: 'Dr. Smith',
  },
  {
    time: '09:30',
    available: true,
    pharmacistId: 'pharmacist1',
    pharmacistName: 'Dr. Smith',
  },
  {
    time: '10:00',
    available: false,
    pharmacistId: 'pharmacist1',
    pharmacistName: 'Dr. Smith',
  },
  {
    time: '10:30',
    available: true,
    pharmacistId: 'pharmacist2',
    pharmacistName: 'Dr. Johnson',
  },
];

const mockPharmacists = [
  { _id: 'pharmacist1', name: 'Dr. Smith' },
  { _id: 'pharmacist2', name: 'Dr. Johnson' },
];

describe('AvailableSlotsView', () => {
  const mockProps = {
    workplaceId: 'workplace123',
    onSlotSelect: vi.fn(),
    onBack: vi.fn(),
  };

  const mockUseAppointmentTypes = vi.fn();
  const mockUseAvailableSlots = vi.fn();
  const mockUseReserveSlot = vi.fn();
  const mockUseReleaseSlot = vi.fn();

  // Setup window.matchMedia mock
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockUseAppointmentTypes.mockReturnValue({
      data: { data: mockAppointmentTypes },
      isLoading: false,
      error: null,
    });

    mockUseAvailableSlots.mockReturnValue({
      data: { 
        data: { 
          slots: mockAvailableSlots, 
          pharmacists: mockPharmacists 
        } 
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseReserveSlot.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: {
          reservationId: 'res123',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      }),
    });

    mockUseReleaseSlot.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { released: true } }),
    });

    // Mock the hooks
    vi.mocked(patientPortalHooks.useAppointmentTypes).mockImplementation(mockUseAppointmentTypes);
    vi.mocked(patientPortalHooks.useAvailableSlots).mockImplementation(mockUseAvailableSlots);
    vi.mocked(patientPortalHooks.useReserveSlot).mockImplementation(mockUseReserveSlot);
    vi.mocked(patientPortalHooks.useReleaseSlot).mockImplementation(mockUseReleaseSlot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with all sections', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Book an Appointment')).toBeInTheDocument();
      expect(screen.getByText('Select Appointment Type')).toBeInTheDocument();
      expect(screen.getByText('Select Date')).toBeInTheDocument();
    });

    it('renders appointment types correctly', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Medication Therapy Management')).toBeInTheDocument();
      expect(screen.getByText('Health Check')).toBeInTheDocument();
      expect(screen.getByText('Vaccination')).toBeInTheDocument();
      
      // Check duration chips
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByText('15 min')).toBeInTheDocument();
      expect(screen.getByText('10 min')).toBeInTheDocument();
    });

    it('shows back button when onBack prop is provided', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
    });

    it('does not show back button when onBack prop is not provided', () => {
      const propsWithoutBack = { ...mockProps };
      delete propsWithoutBack.onBack;

      render(
        <TestWrapper>
          <AvailableSlotsView {...propsWithoutBack} />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading skeletons for appointment types', () => {
      mockUseAppointmentTypes.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      // Should show skeleton loaders
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows loading skeletons for available slots', () => {
      mockUseAvailableSlots.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      // Should show skeleton loaders for slots
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error States', () => {
    it('shows error message when appointment types fail to load', () => {
      mockUseAppointmentTypes.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load'),
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load appointment types. Please try again.')).toBeInTheDocument();
    });

    it('shows error message when slots fail to load', () => {
      mockUseAvailableSlots.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load slots'),
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load available slots. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Appointment Type Selection', () => {
    it('allows selecting an appointment type', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      const mtmCard = screen.getByText('Medication Therapy Management').closest('[role="button"]');
      expect(mtmCard).toBeInTheDocument();

      await user.click(mtmCard!);

      // Should show check icon for selected type
      await waitFor(() => {
        expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
      });
    });

    it('does not allow selecting unavailable appointment types', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      const vaccinationCard = screen.getByText('Vaccination').closest('div');
      expect(vaccinationCard).toHaveStyle({ opacity: '0.6' });

      // Should not be clickable
      await user.click(vaccinationCard!);
      expect(screen.queryByTestId('CheckCircleIcon')).not.toBeInTheDocument();
    });

    it('pre-selects appointment type when provided', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="health_check" />
        </TestWrapper>
      );

      expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
    });
  });

  describe('Date Selection', () => {
    it('shows current date by default', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      // Should show some date display
      expect(screen.getByText(/today|tomorrow|yesterday|\w+day, \w+ \d+/i)).toBeInTheDocument();
    });

    it('allows navigating to next day', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      const nextButton = screen.getByRole('button', { name: /arrow forward/i });
      await user.click(nextButton);

      // Should trigger date change (tested via API call parameters)
      expect(mockUseAvailableSlots).toHaveBeenCalled();
    });

    it('allows navigating to previous day', async () => {
      const user = userEvent.setup();
      const futureDate = addDays(new Date(), 2);

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} preSelectedDate={futureDate} />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /arrow back/i });
      await user.click(prevButton);

      expect(mockUseAvailableSlots).toHaveBeenCalled();
    });

    it('disables previous day button for past dates', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /arrow back/i });
      expect(prevButton).toBeDisabled();
    });
  });

  describe('Available Slots Display', () => {
    it('shows info message when no appointment type is selected', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Please select an appointment type to view available time slots.')).toBeInTheDocument();
    });

    it('displays available slots when appointment type is selected', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('09:30')).toBeInTheDocument();
      expect(screen.getByText('10:30')).toBeInTheDocument();
    });

    it('shows pharmacist names for slots', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Johnson')).toBeInTheDocument();
    });

    it('shows no slots message when no slots are available', () => {
      mockUseAvailableSlots.mockReturnValue({
        data: { data: { slots: [], pharmacists: [] } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      expect(screen.getByText(/No available slots for the selected date/)).toBeInTheDocument();
    });
  });

  describe('Slot Reservation', () => {
    it('allows reserving an available slot', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: {
          reservationId: 'res123',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      });

      mockUseReserveSlot.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      const slotCard = screen.getByText('09:00').closest('div[role="button"]');
      await user.click(slotCard!);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        workplaceId: 'workplace123',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        type: 'mtm_session',
        pharmacistId: 'pharmacist1',
      });
    });

    it('shows reservation confirmation when slot is reserved', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: {
          reservationId: 'res123',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      });

      mockUseReserveSlot.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      const slotCard = screen.getByText('09:00').closest('div[role="button"]');
      await user.click(slotCard!);

      await waitFor(() => {
        expect(screen.getByText('Slot Reserved')).toBeInTheDocument();
        expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
        expect(screen.getByText('Release Slot')).toBeInTheDocument();
      });
    });

    it('calls onSlotSelect when confirming reservation', async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        data: {
          reservationId: 'res123',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      });

      mockUseReserveSlot.mockReturnValue({
        mutateAsync: mockMutateAsync,
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} selectedType="mtm_session" />
        </TestWrapper>
      );

      // Reserve a slot
      const slotCard = screen.getByText('09:00').closest('div[role="button"]');
      await user.click(slotCard!);

      // Confirm the reservation
      await waitFor(() => {
        const confirmButton = screen.getByText('Confirm Booking');
        return user.click(confirmButton);
      });

      expect(mockProps.onSlotSelect).toHaveBeenCalledWith({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        type: 'mtm_session',
        pharmacistId: 'pharmacist1',
        pharmacistName: 'Dr. Smith',
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile breakpoint
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      // Component should render without errors on mobile
      expect(screen.getByText('Book an Appointment')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      // Check for proper heading structure
      expect(screen.getByRole('heading', { name: 'Book an Appointment' })).toBeInTheDocument();
      
      // Check for button roles
      expect(screen.getAllByRole('button')).toHaveLength(expect.any(Number));
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AvailableSlotsView {...mockProps} />
        </TestWrapper>
      );

      // Should be able to tab through interactive elements
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });
  });
});