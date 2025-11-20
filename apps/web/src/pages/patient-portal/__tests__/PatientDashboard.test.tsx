import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PatientDashboard from '../PatientDashboard';
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
vi.mock('../../../hooks/usePatientAuth');
vi.mock('../../../hooks/usePatientMedications', () => ({
  usePatientMedications: () => ({
    currentMedications: [
      { _id: 'med1', name: 'Metformin', nextDose: '2024-03-10T20:00:00.000Z' },
      { _id: 'med2', name: 'Lisinopril', nextDose: '2024-03-11T08:00:00.000Z' },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/usePatientMessages', () => ({
  usePatientMessages: () => ({
    conversations: [
      { _id: 'conv1', unreadCount: 2 },
      { _id: 'conv2', unreadCount: 1 },
    ],
    loading: false,
    error: null,
  }),
}));

describe('PatientDashboard', () => {
  const mockUser = {
    _id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    workspaceId: 'workspace-456',
    workspaceName: 'Test Pharmacy',
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

  it('renders dashboard with user greeting', () => {
    render(<PatientDashboard />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Welcome back, John!')).toBeInTheDocument();
    expect(screen.getByText('Here\'s your health overview for today')).toBeInTheDocument();
  });

  it('shows quick stats cards', () => {
    render(<PatientDashboard />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Active Medications')).toBeInTheDocument();
    expect(screen.getByText('Unread Messages')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Appointments')).toBeInTheDocument();
    expect(screen.getByText('Health Records')).toBeInTheDocument();
  });

  it('displays upcoming medications widget', () => {
    render(<PatientDashboard />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Upcoming Medications')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
  });

  it('shows recent messages widget', () => {
    render(<PatientDashboard />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Recent Messages')).toBeInTheDocument();
    expect(screen.getByText('3 unread messages')).toBeInTheDocument();
  });

  it('handles quick actions', () => {
    render(<PatientDashboard />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book appointment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request refill/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows loading state when user is loading', () => {
    const loadingContext = {
      ...mockAuthContextValue,
      isLoading: true,
      user: null,
    };

    render(<PatientDashboard />, {
      wrapper: createWrapper(loadingContext),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('redirects unauthenticated users', () => {
    const unauthenticatedContext = {
      ...mockAuthContextValue,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };

    render(<PatientDashboard />, {
      wrapper: createWrapper(unauthenticatedContext),
    });

    expect(screen.getByText('Please log in to access your dashboard')).toBeInTheDocument();
  });
});