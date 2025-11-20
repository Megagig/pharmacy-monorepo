import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { BrowserRouter } from 'react-router-dom';

import PatientAppointments from '../PatientAppointments';
import { PatientAuthContext } from '../../../contexts/PatientAuthContext';

// Mock the hooks
jest.mock('../../../hooks/usePatientAuth');
jest.mock('../../../components/patient-portal/MyAppointmentsList', () => {
  return function MockMyAppointmentsList({ onAppointmentUpdate }: any) {
    return (
      <div data-testid="my-appointments-list">
        <button onClick={() => onAppointmentUpdate({ id: 'test' })}>
          Update Appointment
        </button>
      </div>
    );
  };
});

jest.mock('../../../components/patient-portal/BookAppointmentForm', () => {
  return function MockBookAppointmentForm({ onSuccess, onCancel }: any) {
    return (
      <div data-testid="book-appointment-form">
        <button onClick={() => onSuccess({ id: 'new-appointment' })}>
          Book Success
        </button>
        <button onClick={onCancel}>Cancel Booking</button>
      </div>
    );
  };
});

const theme = createTheme();

const createWrapper = (authValue: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <PatientAuthContext.Provider value={authValue}>
              {children}
            </PatientAuthContext.Provider>
          </LocalizationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('PatientAppointments', () => {
  const mockUser = {
    _id: 'patient-123',
    patientId: 'patient-123',
    workplaceId: 'workplace-456',
    email: 'patient@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    refreshUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the appointments page correctly', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('My Appointments')).toBeInTheDocument();
    expect(screen.getByText('Manage your appointments and book new consultations')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows login warning when user is not authenticated', () => {
    const unauthenticatedContext = {
      ...mockAuthContextValue,
      user: null,
      isAuthenticated: false,
    };

    render(<PatientAppointments />, {
      wrapper: createWrapper(unauthenticatedContext),
    });

    expect(screen.getByText('Please log in to view your appointments.')).toBeInTheDocument();
  });

  it('displays appointment statistics correctly', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Check for stats cards
    expect(screen.getByText('2')).toBeInTheDocument(); // Upcoming count
    expect(screen.getByText('15')).toBeInTheDocument(); // Completed count
    expect(screen.getByText('1')).toBeInTheDocument(); // Cancelled count
  });

  it('shows next appointment highlight', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Upcoming Appointment')).toBeInTheDocument();
    expect(screen.getByText('Next Appointment')).toBeInTheDocument();
  });

  it('handles tab navigation correctly', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const allAppointmentsTab = screen.getByRole('tab', { name: /all appointments/i });
    const bookNewTab = screen.getByRole('tab', { name: /book new/i });

    expect(allAppointmentsTab).toHaveAttribute('aria-selected', 'true');
    expect(bookNewTab).toHaveAttribute('aria-selected', 'false');

    // Click on Book New tab
    fireEvent.click(bookNewTab);

    expect(allAppointmentsTab).toHaveAttribute('aria-selected', 'false');
    expect(bookNewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('book-appointment-form')).toBeInTheDocument();
  });

  it('renders MyAppointmentsList component in first tab', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByTestId('my-appointments-list')).toBeInTheDocument();
  });

  it('renders BookAppointmentForm component in second tab', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Switch to Book New tab
    const bookNewTab = screen.getByRole('tab', { name: /book new/i });
    fireEvent.click(bookNewTab);

    expect(screen.getByTestId('book-appointment-form')).toBeInTheDocument();
  });

  it('handles refresh button click', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    // The refresh should trigger a re-render of the appointments list
    expect(screen.getByTestId('my-appointments-list')).toBeInTheDocument();
  });

  it('handles appointment booking success', async () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Switch to Book New tab
    const bookNewTab = screen.getByRole('tab', { name: /book new/i });
    fireEvent.click(bookNewTab);

    // Simulate successful booking
    const bookSuccessButton = screen.getByText('Book Success');
    fireEvent.click(bookSuccessButton);

    // Should switch back to All Appointments tab
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all appointments/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('handles appointment update', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Simulate appointment update
    const updateButton = screen.getByText('Update Appointment');
    fireEvent.click(updateButton);

    // Should trigger a refresh of the appointments list
    expect(screen.getByTestId('my-appointments-list')).toBeInTheDocument();
  });

  it('shows book appointment button on desktop', () => {
    // Mock desktop viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false, // Desktop
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('button', { name: /book appointment/i })).toBeInTheDocument();
  });

  it('handles mobile booking dialog', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('(max-width:'), // Mobile
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Should show FAB for mobile
    const fab = screen.getByRole('button', { name: /book appointment/i });
    expect(fab).toBeInTheDocument();

    // Click FAB to open dialog
    fireEvent.click(fab);

    expect(screen.getByText('Book New Appointment')).toBeInTheDocument();
    expect(screen.getByTestId('book-appointment-form')).toBeInTheDocument();
  });

  it('handles mobile dialog close', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('(max-width:'), // Mobile
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Open dialog
    const fab = screen.getByRole('button', { name: /book appointment/i });
    fireEvent.click(fab);

    // Close dialog
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Dialog should be closed
    expect(screen.queryByText('Book New Appointment')).not.toBeInTheDocument();
  });

  it('handles booking cancellation from dialog', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // Switch to Book New tab
    const bookNewTab = screen.getByRole('tab', { name: /book new/i });
    fireEvent.click(bookNewTab);

    // Cancel booking
    const cancelButton = screen.getByText('Cancel Booking');
    fireEvent.click(cancelButton);

    // Should switch back to All Appointments tab
    expect(screen.getByRole('tab', { name: /all appointments/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('displays appointment action buttons in next appointment card', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('passes correct props to child components', () => {
    render(<PatientAppointments />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    // MyAppointmentsList should receive correct props
    expect(screen.getByTestId('my-appointments-list')).toBeInTheDocument();

    // Switch to booking form
    const bookNewTab = screen.getByRole('tab', { name: /book new/i });
    fireEvent.click(bookNewTab);

    // BookAppointmentForm should receive correct props
    expect(screen.getByTestId('book-appointment-form')).toBeInTheDocument();
  });
});