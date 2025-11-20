/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PatientPortalAdmin from '../PatientPortalAdmin';

// Mock the useRBAC hook
jest.mock('../../../hooks/useRBAC', () => ({
  useRBAC: () => ({
    hasRole: jest.fn(() => true),
  }),
}));

// Mock the usePatientPortalAdmin hook
jest.mock('../../../hooks/usePatientPortalAdmin', () => ({
  usePatientPortalAdmin: () => ({
    usePortalStats: () => ({
      data: {
        totalPatients: 1247,
        activePatients: 1089,
        pendingApprovals: 23,
        pendingRefills: 45,
        monthlyLogins: 3456,
        messagesSent: 789,
        appointmentsBooked: 234,
        engagementRate: 78,
      },
      isLoading: false,
      error: null,
    }),
  }),
}));

// Mock the child components
jest.mock('../../../components/workspace-admin/PatientUserManagement', () => {
  return function MockPatientUserManagement({ onShowSnackbar }: any) {
    return (
      <div data-testid="patient-user-management">
        Patient User Management Component
        <button onClick={() => onShowSnackbar('Test message', 'success')}>
          Test Snackbar
        </button>
      </div>
    );
  };
});

jest.mock('../../../components/workspace-admin/RefillRequestManagement', () => {
  return function MockRefillRequestManagement() {
    return <div data-testid="refill-request-management">Refill Request Management Component</div>;
  };
});

jest.mock('../../../components/workspace-admin/PatientPortalAnalytics', () => {
  return function MockPatientPortalAnalytics() {
    return <div data-testid="patient-portal-analytics">Patient Portal Analytics Component</div>;
  };
});

jest.mock('../../../components/workspace-admin/PatientPortalSettings', () => {
  return function MockPatientPortalSettings() {
    return <div data-testid="patient-portal-settings">Patient Portal Settings Component</div>;
  };
});

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('PatientPortalAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the patient portal admin dashboard', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Patient Portal Administration')).toBeInTheDocument();
    expect(screen.getByText('Manage patient portal users, refill requests, and portal settings')).toBeInTheDocument();
  });

  it('displays portal statistics cards', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Total Patients')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
    expect(screen.getByText('Active Patients')).toBeInTheDocument();
    expect(screen.getByText('1,089')).toBeInTheDocument();
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('Refill Requests')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('displays additional statistics cards', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Monthly Logins')).toBeInTheDocument();
    expect(screen.getByText('3,456')).toBeInTheDocument();
    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getByText('789')).toBeInTheDocument();
    expect(screen.getByText('Appointments Booked')).toBeInTheDocument();
    expect(screen.getByText('234')).toBeInTheDocument();
    expect(screen.getByText('Portal Engagement')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('renders navigation tabs', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Patient Users')).toBeInTheDocument();
    expect(screen.getByText('Refill Requests')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Portal Settings')).toBeInTheDocument();
  });

  it('shows patient user management by default', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByTestId('patient-user-management')).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    renderWithProviders(<PatientPortalAdmin />);

    // Click on Refill Requests tab
    fireEvent.click(screen.getByText('Refill Requests'));
    await waitFor(() => {
      expect(screen.getByTestId('refill-request-management')).toBeInTheDocument();
    });

    // Click on Analytics tab
    fireEvent.click(screen.getByText('Analytics'));
    await waitFor(() => {
      expect(screen.getByTestId('patient-portal-analytics')).toBeInTheDocument();
    });

    // Click on Portal Settings tab
    fireEvent.click(screen.getByText('Portal Settings'));
    await waitFor(() => {
      expect(screen.getByTestId('patient-portal-settings')).toBeInTheDocument();
    });
  });

  it('displays snackbar when triggered by child components', async () => {
    renderWithProviders(<PatientPortalAdmin />);

    // Click the test button in the mocked component
    fireEvent.click(screen.getByText('Test Snackbar'));

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('displays portal active status chip', () => {
    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Portal Active')).toBeInTheDocument();
  });
});

describe('PatientPortalAdmin - Access Control', () => {
  it('shows access denied for unauthorized users', () => {
    // Mock useRBAC to return false for hasRole
    jest.doMock('../../../hooks/useRBAC', () => ({
      useRBAC: () => ({
        hasRole: jest.fn(() => false),
      }),
    }));

    const { useRBAC } = require('../../../hooks/useRBAC');
    useRBAC.mockReturnValue({
      hasRole: jest.fn(() => false),
    });

    renderWithProviders(<PatientPortalAdmin />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/This page is only accessible to workspace members/)).toBeInTheDocument();
  });
});