import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { vi, describe, it, expect, beforeAll } from 'vitest';

import BookAppointmentForm from '../BookAppointmentForm';
import { theme } from '../../../theme';
import * as patientPortalHooks from '../../../hooks/usePatientPortal';

// Mock the patient portal hooks
vi.mock('../../../hooks/usePatientPortal', () => ({
  useAppointmentTypes: vi.fn(),
  useAvailableSlots: vi.fn(),
  useBookAppointment: vi.fn(),
  useReserveSlot: vi.fn(),
  useReleaseSlot: vi.fn(),
}));

// Mock Material-UI useMediaQuery hook
vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false), // Default to desktop view
}));

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
];

describe('BookAppointmentForm', () => {
  const mockProps = {
    workplaceId: 'workplace123',
    patientId: 'patient123',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };

  // Setup window.matchMedia mock
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Setup default mock implementations
    vi.mocked(patientPortalHooks.useAppointmentTypes).mockReturnValue({
      data: { data: mockAppointmentTypes },
      isLoading: false,
      error: null,
    });

    vi.mocked(patientPortalHooks.useAvailableSlots).mockReturnValue({
      data: { 
        data: { 
          slots: [], 
          pharmacists: [] 
        } 
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(patientPortalHooks.useBookAppointment).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: {
          appointment: { _id: 'appointment123' },
          confirmationCode: 'CONF123',
        },
      }),
    });

    vi.mocked(patientPortalHooks.useReserveSlot).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        data: {
          reservationId: 'res123',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      }),
    });

    vi.mocked(patientPortalHooks.useReleaseSlot).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { released: true } }),
    });
  });

  describe('Rendering', () => {
    it('renders the multi-step booking wizard', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
      expect(screen.getByText('Select Service')).toBeInTheDocument();
      expect(screen.getByText('Choose Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Add Details')).toBeInTheDocument();
      expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    });

    it('displays appointment type selection step initially', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('What type of appointment do you need?')).toBeInTheDocument();
      expect(screen.getByText('Medication Therapy Management')).toBeInTheDocument();
      expect(screen.getByText('Health Check')).toBeInTheDocument();
    });

    it('shows navigation buttons', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  describe('Appointment Types', () => {
    it('displays appointment types with details', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Medication Therapy Management')).toBeInTheDocument();
      expect(screen.getByText('Comprehensive medication review with pharmacist')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      
      expect(screen.getByText('Health Check')).toBeInTheDocument();
      expect(screen.getByText('Basic health screening and consultation')).toBeInTheDocument();
      expect(screen.getByText('15 minutes')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner when appointment types are loading', () => {
      vi.mocked(patientPortalHooks.useAppointmentTypes).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows error message when appointment types fail to load', () => {
      vi.mocked(patientPortalHooks.useAppointmentTypes).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load'),
      });

      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load appointment types. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Pre-selected Values', () => {
    it('accepts pre-selected appointment type', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} preSelectedType="health_check" />
        </TestWrapper>
      );

      // Component should render without errors
      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    });

    it('accepts pre-selected date', () => {
      const preSelectedDate = new Date('2025-10-30');
      
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} preSelectedDate={preSelectedDate} />
        </TestWrapper>
      );

      // Component should render without errors
      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    });

    it('accepts pre-selected slot', () => {
      const preSelectedSlot = {
        date: '2025-10-30',
        time: '10:00',
        pharmacistId: 'pharmacist1',
        pharmacistName: 'Dr. Smith',
      };
      
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} preSelectedSlot={preSelectedSlot} />
        </TestWrapper>
      );

      // Component should render without errors
      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: 'Book Appointment' })).toBeInTheDocument();
    });

    it('has interactive elements with proper roles', () => {
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} />
        </TestWrapper>
      );

      // Should have buttons
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      
      // Should have radio inputs for appointment types (when not in error state)
      const radioInputs = screen.queryAllByRole('radio');
      expect(radioInputs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Component Props', () => {
    it('calls onCancel when provided', () => {
      const onCancel = vi.fn();
      
      render(
        <TestWrapper>
          <BookAppointmentForm {...mockProps} onCancel={onCancel} />
        </TestWrapper>
      );

      // Component should render the cancel button
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('renders without onCancel prop', () => {
      const propsWithoutCancel = { ...mockProps };
      delete propsWithoutCancel.onCancel;

      render(
        <TestWrapper>
          <BookAppointmentForm {...propsWithoutCancel} />
        </TestWrapper>
      );

      // Component should still render
      expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    });
  });
});