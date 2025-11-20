import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PatientMedications from '../PatientMedications';
import { PatientAuthContext } from '../../../contexts/PatientAuthContext';

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
          <PatientAuthContext.Provider value={authValue}>
            {children}
          </PatientAuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

// Mock hooks
vi.mock('../../../hooks/usePatientMedications', () => ({
  usePatientMedications: () => ({
    currentMedications: [
      {
        _id: 'med1',
        name: 'Metformin',
        strength: '500mg',
        dosageForm: 'Tablet',
        instructions: 'Take twice daily',
        status: 'active',
        refillsRemaining: 2,
      },
      {
        _id: 'med2',
        name: 'Lisinopril',
        strength: '10mg',
        dosageForm: 'Tablet',
        instructions: 'Take once daily',
        status: 'active',
        refillsRemaining: 1,
      },
    ],
    medicationHistory: [],
    adherenceData: {
      overallScore: 85,
      medications: [],
    },
    refillRequests: [],
    loading: false,
    error: null,
    requestRefill: vi.fn(),
    cancelRefillRequest: vi.fn(),
    refreshMedications: vi.fn(),
  }),
}));

describe('PatientMedications', () => {
  const mockUser = {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    workspaceId: 'workspace-456',
  };

  const mockAuthContextValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders medications page correctly', () => {
    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('My Medications')).toBeInTheDocument();
    expect(screen.getByText('Manage your medications, track adherence, and request refills')).toBeInTheDocument();
  });

  it('shows medication tabs', () => {
    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('tab', { name: /current medications/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /medication history/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /adherence tracking/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /refill requests/i })).toBeInTheDocument();
  });

  it('displays current medications', () => {
    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    expect(screen.getByText('500mg Tablet')).toBeInTheDocument();
    expect(screen.getByText('10mg Tablet')).toBeInTheDocument();
  });

  it('handles tab navigation', () => {
    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const adherenceTab = screen.getByRole('tab', { name: /adherence tracking/i });
    fireEvent.click(adherenceTab);

    expect(screen.getByText('Overall Adherence Score')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(require('../../../hooks/usePatientMedications').usePatientMedications).mockReturnValue({
      currentMedications: null,
      loading: true,
      error: null,
    });

    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', () => {
    vi.mocked(require('../../../hooks/usePatientMedications').usePatientMedications).mockReturnValue({
      currentMedications: null,
      loading: false,
      error: 'Failed to load medications',
    });

    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Error loading medications')).toBeInTheDocument();
  });

  it('shows empty state when no medications', () => {
    vi.mocked(require('../../../hooks/usePatientMedications').usePatientMedications).mockReturnValue({
      currentMedications: [],
      loading: false,
      error: null,
    });

    render(<PatientMedications />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('No medications found')).toBeInTheDocument();
  });
});