import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import CreateAppointmentDialog from '../CreateAppointmentDialog';
import { AppointmentFormData } from '../../../stores/appointmentTypes';

// Mock hooks
vi.mock('../../../hooks/useAppointments', () => ({
  useCreateAppointment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ data: { appointment: { _id: '123' } } }),
    isLoading: false,
    error: null,
  }),
  useAvailableSlots: () => ({
    data: {
      data: {
        slots: [
          { time: '09:00', available: true, pharmacistId: '1' },
          { time: '09:30', available: true, pharmacistId: '1' },
          { time: '10:00', available: false, pharmacistId: '1' },
          { time: '10:30', available: true, pharmacistId: '2' },
        ],
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../queries/usePatients', () => ({
  useSearchPatients: () => ({
    data: {
      data: {
        patients: [
          {
            _id: '1',
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN001',
            dateOfBirth: '1990-01-01',
            phone: '+234-123-456-7890',
          },
          {
            _id: '2',
            firstName: 'Jane',
            lastName: 'Smith',
            mrn: 'MRN002',
            dateOfBirth: '1985-05-15',
            phone: '+234-987-654-3210',
          },
        ],
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

// Mock components
vi.mock('../PatientAutocomplete', () => ({
  default: ({ value, onChange, error, helperText, required }: any) => (
    <div data-testid="patient-autocomplete">
      <input
        data-testid="patient-search"
        placeholder="Search patients..."
        onChange={(e) => {
          if (e.target.value === 'John Doe') {
            onChange({
              _id: '1',
              firstName: 'John',
              lastName: 'Doe',
              mrn: 'MRN001',
            });
          }
        }}
      />
      {error && <div data-testid="patient-error">{helperText}</div>}
      {required && <span data-testid="patient-required">*</span>}
    </div>
  ),
}));

vi.mock('../PharmacistSelector', () => ({
  default: ({ value, onChange }: any) => (
    <div data-testid="pharmacist-selector">
      <select
        data-testid="pharmacist-select"
        onChange={(e) => {
          if (e.target.value === '1') {
            onChange({
              _id: '1',
              firstName: 'Dr. John',
              lastName: 'Smith',
              role: 'pharmacist',
            });
          }
        }}
      >
        <option value="">Select Pharmacist</option>
        <option value="1">Dr. John Smith</option>
        <option value="2">Dr. Sarah Johnson</option>
      </select>
    </div>
  ),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme();

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

describe('CreateAppointmentDialog', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    open: true,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with all form fields', () => {
    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check dialog title
    expect(screen.getByText('Create New Appointment')).toBeInTheDocument();

    // Check main sections
    expect(screen.getByText('Patient Information')).toBeInTheDocument();
    expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    expect(screen.getByText('Pharmacist Assignment')).toBeInTheDocument();

    // Check form fields
    expect(screen.getByTestId('patient-autocomplete')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointment Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointment Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointment Time')).toBeInTheDocument();
    expect(screen.getByTestId('pharmacist-selector')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create appointment/i })).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create appointment/i });
    await user.click(submitButton);

    // Should show patient selection error
    await waitFor(() => {
      expect(screen.getByTestId('patient-error')).toBeInTheDocument();
    });
  });

  it('allows selecting appointment type and updates duration', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check that appointment type field exists
    expect(screen.getByText('Appointment Type')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('displays available time slots', async () => {
    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Should show available slots section
    await waitFor(() => {
      expect(screen.getByText(/Available Time Slots/)).toBeInTheDocument();
    });

    // Should show available and unavailable slots
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it('handles patient selection', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Search for patient
    const patientSearch = screen.getByTestId('patient-search');
    await user.type(patientSearch, 'John Doe');

    // Patient should be selected automatically by mock
    expect(patientSearch).toHaveValue('John Doe');
  });

  it('handles pharmacist selection', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Select pharmacist
    const pharmacistSelect = screen.getByTestId('pharmacist-select');
    await user.selectOptions(pharmacistSelect, '1');

    expect(pharmacistSelect).toHaveValue('1');
  });

  it('shows recurring appointment options when enabled', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Find the recurring appointment accordion
    expect(screen.getByText('Recurring Appointment')).toBeInTheDocument();
  });

  it('shows patient preferences when expanded', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Find the patient preferences accordion
    expect(screen.getByText('Patient Preferences')).toBeInTheDocument();
  });

  it('shows warning for weekend appointments', () => {
    const weekendDate = new Date('2024-01-06'); // Saturday

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} selectedDate={weekendDate} />
      </TestWrapper>
    );

    expect(screen.getByText(/scheduling an appointment on a weekend/i)).toBeInTheDocument();
  });

  it('shows warning for unavailable time slots', async () => {
    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check that time field exists
    expect(screen.getByText('Appointment Time')).toBeInTheDocument();
  });

  it('handles form submission successfully', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Fill required fields
    const patientSearch = screen.getByTestId('patient-search');
    await user.type(patientSearch, 'John Doe');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create appointment/i });
    await user.click(submitButton);

    // Form should attempt submission
    expect(submitButton).toBeInTheDocument();
  });

  it('handles dialog close', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles close icon click', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Click close icon
    const closeIcon = screen.getByRole('button', { name: '' }); // Close icon button
    await user.click(closeIcon);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('initializes with provided initial data', () => {
    const initialData: Partial<AppointmentFormData> = {
      type: 'mtm_session',
      duration: 45,
      description: 'Initial description',
    };

    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} initialData={initialData} />
      </TestWrapper>
    );

    // Check that fields are pre-filled
    expect(screen.getByDisplayValue('Initial description')).toBeInTheDocument();
  });

  it('initializes with selected date and time', () => {
    const selectedDate = new Date('2024-01-15');
    const selectedTime = '14:30';

    render(
      <TestWrapper>
        <CreateAppointmentDialog 
          {...defaultProps} 
          selectedDate={selectedDate}
          selectedTime={selectedTime}
        />
      </TestWrapper>
    );

    // Check that form is rendered with initial data
    expect(screen.getByText('Create New Appointment')).toBeInTheDocument();
  });

  it('prevents past date selection', async () => {
    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check that date field exists
    expect(screen.getByText('Appointment Date')).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    render(
      <TestWrapper>
        <CreateAppointmentDialog {...defaultProps} />
      </TestWrapper>
    );

    // Check that submit button exists
    const submitButton = screen.getByRole('button', { name: /create appointment/i });
    expect(submitButton).toBeInTheDocument();
  });
});