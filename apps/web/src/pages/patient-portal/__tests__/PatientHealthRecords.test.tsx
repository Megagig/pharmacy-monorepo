import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PatientHealthRecords from '../PatientHealthRecords';
import { usePatientAuth } from '../../../hooks/usePatientAuth';
import { usePatientHealthRecords } from '../../../hooks/usePatientHealthRecords';

// Mock the hooks
jest.mock('../../../hooks/usePatientAuth');
jest.mock('../../../hooks/usePatientHealthRecords');

const mockUsePatientAuth = usePatientAuth as jest.MockedFunction<typeof usePatientAuth>;
const mockUsePatientHealthRecords = usePatientHealthRecords as jest.MockedFunction<typeof usePatientHealthRecords>;

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockUser = {
  _id: 'user_123',
  patientId: 'patient_123',
  email: 'test@example.com',
  workplaceId: 'workplace_123'
};

const mockLabResults = [
  {
    _id: 'lab_001',
    patientId: 'patient_123',
    testDate: '2024-03-15',
    testType: 'Complete Blood Count (CBC)',
    pharmacistName: 'Dr. Sarah Johnson',
    labName: 'Central Medical Laboratory',
    status: 'reviewed' as const,
    results: [
      {
        testName: 'Hemoglobin',
        value: 13.5,
        unit: 'g/dL',
        referenceRange: { min: 12.0, max: 15.5 },
        status: 'normal' as const
      }
    ],
    createdAt: '2024-03-15T10:00:00.000Z',
    updatedAt: '2024-03-15T14:30:00.000Z'
  }
];

const mockVisitHistory = [
  {
    _id: 'visit_001',
    patientId: 'patient_123',
    visitDate: '2024-03-20',
    visitType: 'Medication Therapy Review',
    chiefComplaint: 'Follow-up for diabetes management',
    assessment: 'Patient shows good adherence to medication regimen',
    pharmacistName: 'Dr. Sarah Johnson',
    status: 'completed',
    createdAt: '2024-03-20T14:00:00.000Z',
    updatedAt: '2024-03-20T15:30:00.000Z'
  }
];

const mockVitalsHistory = [
  {
    recordedDate: '2024-03-22T08:00:00.000Z',
    bloodPressure: { systolic: 128, diastolic: 82 },
    heartRate: 72,
    weight: 75.5,
    glucose: 110,
    notes: 'Morning reading before breakfast',
    source: 'patient_portal' as const
  }
];

const mockVitalsTrends = {
  readings: [
    {
      date: '2024-03-22T08:00:00.000Z',
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRate: 72,
      weight: 75.5,
      glucose: 110
    }
  ],
  trends: [
    {
      metric: 'Blood Pressure',
      trend: 'stable' as const,
      change: -2,
      status: 'normal' as const
    }
  ],
  insights: [
    {
      type: 'success' as const,
      message: 'Your blood pressure has been stable and within target range this week.'
    }
  ],
  summary: {
    totalReadings: 5,
    daysTracked: 5,
    lastReading: '2024-03-22T08:00:00.000Z',
    averages: {
      bloodPressure: { systolic: 126, diastolic: 81 },
      heartRate: 72,
      weight: 75.6,
      glucose: 110
    }
  }
};

describe('PatientHealthRecords', () => {
  const mockRefreshHealthRecords = jest.fn();
  const mockLogVitals = jest.fn();
  const mockDownloadMedicalRecords = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUsePatientAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });

    mockUsePatientHealthRecords.mockReturnValue({
      labResults: mockLabResults,
      visitHistory: mockVisitHistory,
      vitalsHistory: mockVitalsHistory,
      vitalsTrends: mockVitalsTrends,
      loading: false,
      error: null,
      refreshHealthRecords: mockRefreshHealthRecords,
      logVitals: mockLogVitals,
      downloadMedicalRecords: mockDownloadMedicalRecords,
      vitalsLoading: false,
      downloadLoading: false
    });
  });

  it('renders page header and navigation', () => {
    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('My Health Records')).toBeInTheDocument();
    expect(screen.getByText('Access your lab results, visit history, track vitals, and download medical records.')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('renders tabs with correct counts', () => {
    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('Lab Results (1)')).toBeInTheDocument();
    expect(screen.getByText('Vitals Tracking')).toBeInTheDocument();
    expect(screen.getByText('Visit History (1)')).toBeInTheDocument();
  });

  it('shows error message when not authenticated', () => {
    mockUsePatientAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      loading: false,
      error: null
    });

    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('Please log in to view your health records.')).toBeInTheDocument();
  });

  it('displays error alert when there is an error', () => {
    mockUsePatientHealthRecords.mockReturnValue({
      labResults: null,
      visitHistory: null,
      vitalsHistory: null,
      vitalsTrends: null,
      loading: false,
      error: 'Failed to load health records',
      refreshHealthRecords: mockRefreshHealthRecords,
      logVitals: mockLogVitals,
      downloadMedicalRecords: mockDownloadMedicalRecords,
      vitalsLoading: false,
      downloadLoading: false
    });

    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('Failed to load health records')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUsePatientHealthRecords.mockReturnValue({
      labResults: null,
      visitHistory: null,
      vitalsHistory: null,
      vitalsTrends: null,
      loading: true,
      error: null,
      refreshHealthRecords: mockRefreshHealthRecords,
      logVitals: mockLogVitals,
      downloadMedicalRecords: mockDownloadMedicalRecords,
      vitalsLoading: false,
      downloadLoading: false
    });

    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('calls refresh function when refresh button is clicked', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);
    
    expect(mockRefreshHealthRecords).toHaveBeenCalled();
  });

  it('calls download function when download button is clicked', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    const downloadButton = screen.getByText('Download PDF');
    await user.click(downloadButton);
    
    expect(mockDownloadMedicalRecords).toHaveBeenCalled();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    // Initially on Lab Results tab
    expect(screen.getByText('Lab Results')).toBeInTheDocument();
    expect(screen.getByText('Your laboratory test results with reference ranges and pharmacist interpretations.')).toBeInTheDocument();
    
    // Switch to Vitals Tracking tab
    const vitalsTab = screen.getByText('Vitals Tracking');
    await user.click(vitalsTab);
    
    expect(screen.getByText('Log your vital signs and view trends over time with graphical representations.')).toBeInTheDocument();
    expect(screen.getByText('Log New Vitals')).toBeInTheDocument();
    
    // Switch to Visit History tab
    const visitHistoryTab = screen.getByText('Visit History (1)');
    await user.click(visitHistoryTab);
    
    expect(screen.getByText('Your past consultations with notes, recommendations, and follow-up plans.')).toBeInTheDocument();
  });

  it('displays lab results in the lab results tab', () => {
    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
  });

  it('displays visit history in the visit history tab', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    // Switch to Visit History tab
    const visitHistoryTab = screen.getByText('Visit History (1)');
    await user.click(visitHistoryTab);
    
    expect(screen.getByText('Medication Therapy Review')).toBeInTheDocument();
    expect(screen.getByText('Follow-up for diabetes management')).toBeInTheDocument();
  });

  it('displays vitals logging form in vitals tab', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    // Switch to Vitals Tracking tab
    const vitalsTab = screen.getByText('Vitals Tracking');
    await user.click(vitalsTab);
    
    expect(screen.getByText('Log New Vitals')).toBeInTheDocument();
    expect(screen.getByText('Vitals Trends')).toBeInTheDocument();
    expect(screen.getByText('Recent Vitals History')).toBeInTheDocument();
  });

  it('shows empty states when no data is available', () => {
    mockUsePatientHealthRecords.mockReturnValue({
      labResults: [],
      visitHistory: [],
      vitalsHistory: [],
      vitalsTrends: null,
      loading: false,
      error: null,
      refreshHealthRecords: mockRefreshHealthRecords,
      logVitals: mockLogVitals,
      downloadMedicalRecords: mockDownloadMedicalRecords,
      vitalsLoading: false,
      downloadLoading: false
    });

    renderWithTheme(<PatientHealthRecords />);
    
    expect(screen.getByText('No lab results available. Lab results will appear here when your pharmacist uploads them.')).toBeInTheDocument();
  });

  it('displays recent vitals history', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    // Switch to Vitals Tracking tab
    const vitalsTab = screen.getByText('Vitals Tracking');
    await user.click(vitalsTab);
    
    expect(screen.getByText('Recent Vitals History')).toBeInTheDocument();
    expect(screen.getByText('128/82 mmHg')).toBeInTheDocument();
    expect(screen.getByText('72 bpm')).toBeInTheDocument();
    expect(screen.getByText('75.5 kg')).toBeInTheDocument();
    expect(screen.getByText('110 mg/dL')).toBeInTheDocument();
    expect(screen.getByText('Note: Morning reading before breakfast')).toBeInTheDocument();
  });

  it('shows floating action button on mobile', () => {
    renderWithTheme(<PatientHealthRecords />);
    
    const fab = screen.getByLabelText('log vitals');
    expect(fab).toBeInTheDocument();
  });

  it('switches to vitals tab when FAB is clicked', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PatientHealthRecords />);
    
    // Initially on Lab Results tab
    expect(screen.getByText('Your laboratory test results with reference ranges and pharmacist interpretations.')).toBeInTheDocument();
    
    // Click FAB
    const fab = screen.getByLabelText('log vitals');
    await user.click(fab);
    
    // Should switch to vitals tab
    expect(screen.getByText('Log your vital signs and view trends over time with graphical representations.')).toBeInTheDocument();
  });

  it('handles vitals submission', async () => {
    const user = userEvent.setup();
    mockLogVitals.mockResolvedValue(undefined);
    
    renderWithTheme(<PatientHealthRecords />);
    
    // Switch to Vitals Tracking tab
    const vitalsTab = screen.getByText('Vitals Tracking');
    await user.click(vitalsTab);
    
    // Fill in heart rate
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    // Submit form
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogVitals).toHaveBeenCalledWith({
        bloodPressureSystolic: undefined,
        bloodPressureDiastolic: undefined,
        heartRate: 72,
        weight: undefined,
        glucose: undefined,
        temperature: undefined,
        oxygenSaturation: undefined,
        notes: undefined
      });
    });
  });

  it('handles vitals submission errors', async () => {
    const user = userEvent.setup();
    mockLogVitals.mockRejectedValue(new Error('Failed to log vitals'));
    
    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    renderWithTheme(<PatientHealthRecords />);
    
    // Switch to Vitals Tracking tab
    const vitalsTab = screen.getByText('Vitals Tracking');
    await user.click(vitalsTab);
    
    // Fill in heart rate
    const heartRateInput = screen.getByLabelText('Heart Rate');
    await user.type(heartRateInput, '72');
    
    // Submit form
    const submitButton = screen.getByText('Log Vitals');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log vitals:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });
});