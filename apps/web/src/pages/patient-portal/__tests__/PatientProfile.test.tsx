import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PatientProfile from '../PatientProfile';
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
vi.mock('../../../hooks/usePatientProfile', () => ({
  usePatientProfile: () => ({
    profile: {
      _id: 'patient-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+234-801-234-5678',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      bloodGroup: 'O+',
      genotype: 'AA',
      weight: 75,
      allergies: [],
      chronicConditions: [],
      emergencyContacts: [],
      insuranceInfo: {},
    },
    loading: false,
    error: null,
    updateProfile: vi.fn(),
    addAllergy: vi.fn(),
    updateAllergy: vi.fn(),
    removeAllergy: vi.fn(),
    addCondition: vi.fn(),
    updateCondition: vi.fn(),
    removeCondition: vi.fn(),
    addEmergencyContact: vi.fn(),
    updateEmergencyContact: vi.fn(),
    removeEmergencyContact: vi.fn(),
    updateInsurance: vi.fn(),
  }),
}));

describe('PatientProfile', () => {
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

  it('renders profile page correctly', () => {
    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('Manage your personal information and medical details')).toBeInTheDocument();
  });

  it('shows profile tabs', () => {
    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('tab', { name: /personal information/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /medical information/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /allergies/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /conditions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /emergency contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /insurance/i })).toBeInTheDocument();
  });

  it('displays personal information form', () => {
    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+234-801-234-5678')).toBeInTheDocument();
  });

  it('handles profile update', async () => {
    const mockUpdateProfile = vi.fn();
    
    vi.mocked(require('../../../hooks/usePatientProfile').usePatientProfile).mockReturnValue({
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      },
      updateProfile: mockUpdateProfile,
      loading: false,
      error: null,
    });

    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const firstNameInput = screen.getByDisplayValue('John');
    fireEvent.change(firstNameInput, { target: { value: 'Johnny' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
  });

  it('switches between tabs correctly', () => {
    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const medicalTab = screen.getByRole('tab', { name: /medical information/i });
    fireEvent.click(medicalTab);

    expect(screen.getByText('Blood Group')).toBeInTheDocument();
    expect(screen.getByText('Genotype')).toBeInTheDocument();
    expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(require('../../../hooks/usePatientProfile').usePatientProfile).mockReturnValue({
      profile: null,
      loading: true,
      error: null,
    });

    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error state', () => {
    vi.mocked(require('../../../hooks/usePatientProfile').usePatientProfile).mockReturnValue({
      profile: null,
      loading: false,
      error: 'Failed to load profile',
    });

    render(<PatientProfile />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(screen.getByText('Error loading profile')).toBeInTheDocument();
    expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
  });
});