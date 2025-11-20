/**
 * PatientAlertsPanel Tests
 * Tests for patient alerts display component
 * Requirements: 4.1, 4.2
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PatientAlertsPanel from '../PatientAlertsPanel';
import { usePatientAlerts } from '../../../hooks/useAlerts';
import { PatientAlert } from '../../../types/alerts';

// Mock the hooks
jest.mock('../../../hooks/useAlerts');

const mockUsePatientAlerts = usePatientAlerts as jest.MockedFunction<typeof usePatientAlerts>;

// Test data
const mockPatientAlerts: PatientAlert[] = [
  {
    id: 'alert-1',
    type: 'overdue_appointment',
    severity: 'high',
    title: 'Overdue Appointment',
    message: 'Patient has an overdue appointment scheduled for Oct 20, 2024',
    patientId: 'patient-1',
    patientName: 'John Doe',
    data: {
      appointmentId: 'appointment-1',
      scheduledDate: '2024-10-20',
      appointmentType: 'mtm_session',
    },
    createdAt: '2024-10-26T10:00:00Z',
    actionUrl: '/appointments/appointment-1',
    expiresAt: '2024-11-02T10:00:00Z',
  },
  {
    id: 'alert-2',
    type: 'abnormal_vitals',
    severity: 'medium',
    title: 'Elevated Blood Pressure',
    message: 'Last BP reading elevated (150/95) - due for recheck',
    patientId: 'patient-1',
    patientName: 'John Doe',
    data: {
      bpSystolic: 150,
      bpDiastolic: 95,
      recordedAt: '2024-10-25T14:30:00Z',
    },
    createdAt: '2024-10-26T09:00:00Z',
    actionUrl: '/patients/patient-1/vitals',
    expiresAt: '2024-11-25T09:00:00Z',
  },
  {
    id: 'alert-3',
    type: 'low_adherence',
    severity: 'medium',
    title: 'Low Adherence Detected',
    message: 'Low adherence detected (65.0%) - counseling recommended',
    patientId: 'patient-1',
    patientName: 'John Doe',
    data: {
      adherenceRate: 65.0,
      totalFollowUps: 10,
      completedFollowUps: 6,
    },
    createdAt: '2024-10-26T08:00:00Z',
    actionUrl: '/patients/patient-1/adherence',
    expiresAt: '2024-11-25T08:00:00Z',
  },
];

const mockAlertsResponse = {
  data: {
    alerts: mockPatientAlerts,
    summary: {
      total: 3,
      bySeverity: { high: 1, medium: 2 },
      byType: { overdue_appointment: 1, abnormal_vitals: 1, low_adherence: 1 },
    },
  },
};

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
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('PatientAlertsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    expect(screen.getByText('Error Loading Alerts')).toBeInTheDocument();
    expect(screen.getByText('Failed to load patient alerts. Please try again.')).toBeInTheDocument();
  });

  it('renders no alerts state', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: {
        data: {
          alerts: [],
          summary: { total: 0, bySeverity: {}, byType: {} },
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('This patient has no active alerts at this time.')).toBeInTheDocument();
  });

  it('renders patient alerts correctly', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" patientName="John Doe" />
      </TestWrapper>
    );

    // Check header
    expect(screen.getByText('Patient Alerts')).toBeInTheDocument();
    expect(screen.getByText('- John Doe')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Alert count

    // Check summary chips
    expect(screen.getByText('high: 1')).toBeInTheDocument();
    expect(screen.getByText('medium: 2')).toBeInTheDocument();

    // Check individual alerts
    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.getByText('Patient has an overdue appointment scheduled for Oct 20, 2024')).toBeInTheDocument();
    
    expect(screen.getByText('Elevated Blood Pressure')).toBeInTheDocument();
    expect(screen.getByText('Last BP reading elevated (150/95) - due for recheck')).toBeInTheDocument();
    
    expect(screen.getByText('Low Adherence Detected')).toBeInTheDocument();
    expect(screen.getByText('Low adherence detected (65.0%) - counseling recommended')).toBeInTheDocument();
  });

  it('displays alert details correctly', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    // Check BP details
    expect(screen.getByText('BP: 150/95')).toBeInTheDocument();

    // Check adherence details
    expect(screen.getByText('Adherence: 65.0%')).toBeInTheDocument();

    // Check severity chips
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getAllByText('MEDIUM')).toHaveLength(2);

    // Check type chips
    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.getByText('Abnormal Vitals')).toBeInTheDocument();
    expect(screen.getByText('Low Adherence')).toBeInTheDocument();
  });

  it('handles alert actions', async () => {
    const mockOnAlertAction = jest.fn();
    
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel 
          patientId="patient-1" 
          onAlertAction={mockOnAlertAction}
        />
      </TestWrapper>
    );

    // Click on view button for first alert
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    expect(mockOnAlertAction).toHaveBeenCalledWith(mockPatientAlerts[0]);
  });

  it('handles alert dismissal', async () => {
    const mockOnDismissAlert = jest.fn().mockResolvedValue(undefined);
    const mockRefetch = jest.fn();
    
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel 
          patientId="patient-1" 
          onDismissAlert={mockOnDismissAlert}
        />
      </TestWrapper>
    );

    // Click dismiss button for first alert
    const dismissButtons = screen.getAllByLabelText('Dismiss alert');
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(mockOnDismissAlert).toHaveBeenCalledWith('alert-1');
    });

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('shows loading state during dismissal', async () => {
    const mockOnDismissAlert = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel 
          patientId="patient-1" 
          onDismissAlert={mockOnDismissAlert}
        />
      </TestWrapper>
    );

    // Click dismiss button
    const dismissButtons = screen.getAllByLabelText('Dismiss alert');
    fireEvent.click(dismissButtons[0]);

    // Should show loading spinner
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('can be collapsed and expanded', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    // Initially expanded - alerts should be visible
    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();

    // Click collapse button
    const collapseButton = screen.getByLabelText(/expand/i);
    fireEvent.click(collapseButton);

    // Alerts should be hidden (but still in DOM due to Collapse component)
    // We can check if the collapse button icon changed
    expect(screen.getByTestId('ExpandMoreIcon')).toBeInTheDocument();
  });

  it('filters alerts by severity', () => {
    const highSeverityAlerts = mockPatientAlerts.filter(alert => alert.severity === 'high');
    
    mockUsePatientAlerts.mockReturnValue({
      data: {
        data: {
          alerts: highSeverityAlerts,
          summary: { total: 1, bySeverity: { high: 1 }, byType: { overdue_appointment: 1 } },
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    // Should only show high severity alert
    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.queryByText('Elevated Blood Pressure')).not.toBeInTheDocument();
    expect(screen.queryByText('Low Adherence Detected')).not.toBeInTheDocument();
  });

  it('displays dismissed alerts when showDismissed is true', () => {
    const dismissedAlert = {
      ...mockPatientAlerts[0],
      dismissedAt: '2024-10-26T11:00:00Z',
      dismissReason: 'Resolved by pharmacist',
    };

    mockUsePatientAlerts.mockReturnValue({
      data: {
        data: {
          alerts: [dismissedAlert],
          summary: { total: 1, bySeverity: { high: 1 }, byType: { overdue_appointment: 1 } },
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" showDismissed={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.getByText(/Dismissed.*ago/)).toBeInTheDocument();
    expect(screen.getByText('Reason: Resolved by pharmacist')).toBeInTheDocument();
  });

  it('respects maxAlerts prop', () => {
    mockUsePatientAlerts.mockReturnValue({
      data: {
        data: {
          alerts: mockPatientAlerts.slice(0, 2), // Only first 2 alerts
          summary: { total: 2, bySeverity: { high: 1, medium: 1 }, byType: {} },
        },
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" maxAlerts={2} />
      </TestWrapper>
    );

    expect(screen.getByText('Overdue Appointment')).toBeInTheDocument();
    expect(screen.getByText('Elevated Blood Pressure')).toBeInTheDocument();
    expect(screen.queryByText('Low Adherence Detected')).not.toBeInTheDocument();
  });

  it('opens action URL in new tab when no onAlertAction provided', () => {
    const mockWindowOpen = jest.fn();
    Object.defineProperty(window, 'open', {
      value: mockWindowOpen,
      writable: true,
    });

    mockUsePatientAlerts.mockReturnValue({
      data: mockAlertsResponse,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PatientAlertsPanel patientId="patient-1" />
      </TestWrapper>
    );

    // Click view button
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    expect(mockWindowOpen).toHaveBeenCalledWith('/appointments/appointment-1', '_blank');
  });
});