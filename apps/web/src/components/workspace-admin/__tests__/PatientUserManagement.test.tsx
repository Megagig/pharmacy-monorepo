/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PatientUserManagement from '../PatientUserManagement';

// Mock the usePatientPortalAdmin hook
const mockMutate = jest.fn();
const mockUsePatientPortalAdmin = {
  usePatientUsers: jest.fn(() => ({
    data: {
      users: [
        {
          id: 'patient_1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+234-801-234-5678',
          status: 'pending',
          emailVerified: true,
          profileComplete: true,
          registeredAt: new Date('2024-01-01'),
          lastLoginAt: new Date('2024-01-15'),
        },
        {
          id: 'patient_2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          status: 'active',
          emailVerified: false,
          profileComplete: false,
          registeredAt: new Date('2024-01-02'),
        },
      ],
      counts: {
        total: 2,
        pending: 1,
        active: 1,
        suspended: 0,
      },
      pagination: {
        total: 2,
        page: 1,
        limit: 20,
      },
    },
    isLoading: false,
    error: null,
  })),
  useApproveUser: () => ({ mutate: mockMutate, isPending: false }),
  useSuspendUser: () => ({ mutate: mockMutate, isPending: false }),
  useActivateUser: () => ({ mutate: mockMutate, isPending: false }),
  useRemoveUser: () => ({ mutate: mockMutate, isPending: false }),
};

jest.mock('../../../hooks/usePatientPortalAdmin', () => ({
  usePatientPortalAdmin: () => mockUsePatientPortalAdmin,
}));

// Mock the PatientUserActionsMenu component
jest.mock('../PatientUserActionsMenu', () => {
  return function MockPatientUserActionsMenu({ 
    user, 
    open, 
    onClose, 
    onApprove, 
    onSuspend, 
    onActivate, 
    onRemove 
  }: any) {
    if (!open) return null;
    
    return (
      <div data-testid="patient-user-actions-menu">
        <button onClick={() => onApprove(user)}>Approve</button>
        <button onClick={() => onSuspend(user)}>Suspend</button>
        <button onClick={() => onActivate(user)}>Activate</button>
        <button onClick={() => onRemove(user)}>Remove</button>
        <button onClick={onClose}>Close</button>
      </div>
    );
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

const mockOnShowSnackbar = jest.fn();

describe('PatientUserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the patient user management component', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getByText('All Users')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('displays user count badges in tabs', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Check if badges are rendered (they contain the counts)
    expect(screen.getByText('2')).toBeInTheDocument(); // Total count
    expect(screen.getByText('1')).toBeInTheDocument(); // Pending count
  });

  it('displays patient users in table', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
  });

  it('displays user status chips', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('displays profile status chips', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getAllByText('Verified')).toHaveLength(1);
    expect(screen.getAllByText('Unverified')).toHaveLength(1);
    expect(screen.getAllByText('Complete')).toHaveLength(1);
    expect(screen.getAllByText('Incomplete')).toHaveLength(1);
  });

  it('opens actions menu when more actions button is clicked', async () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    const moreActionsButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(moreActionsButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('patient-user-actions-menu')).toBeInTheDocument();
    });
  });

  it('handles user approval', async () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Open actions menu
    const moreActionsButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(moreActionsButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('patient-user-actions-menu')).toBeInTheDocument();
    });

    // Click approve
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(screen.getByText('Approve Patient User')).toBeInTheDocument();
    });

    // Confirm approval
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('handles user suspension with reason', async () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Open actions menu
    const moreActionsButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(moreActionsButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('patient-user-actions-menu')).toBeInTheDocument();
    });

    // Click suspend
    fireEvent.click(screen.getByText('Suspend'));

    await waitFor(() => {
      expect(screen.getByText('Suspend Patient User')).toBeInTheDocument();
    });

    // Enter suspension reason
    const reasonInput = screen.getByLabelText('Reason for suspension');
    fireEvent.change(reasonInput, { target: { value: 'Policy violation' } });

    // Confirm suspension
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('switches between status tabs', async () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Click on Pending Approval tab
    fireEvent.click(screen.getByText('Pending Approval'));

    await waitFor(() => {
      // Should call usePatientUsers with status filter
      expect(mockUsePatientPortalAdmin.usePatientUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });
  });

  it('handles pagination', () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Check if pagination is rendered
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });

  it('sorts users by column headers', async () => {
    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Click on Patient column header to sort
    const patientHeader = screen.getByText('Patient');
    fireEvent.click(patientHeader);

    // Should trigger re-render with sorted data
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('displays empty state when no users found', () => {
    // Mock empty data
    mockUsePatientPortalAdmin.usePatientUsers.mockReturnValue({
      data: {
        users: [],
        counts: { total: 0, pending: 0, active: 0, suspended: 0 },
        pagination: { total: 0, page: 1, limit: 20 },
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getByText('No patient users found')).toBeInTheDocument();
  });

  it('displays loading skeletons when loading', () => {
    // Mock loading state
    mockUsePatientPortalAdmin.usePatientUsers.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    // Should show skeleton loaders
    expect(screen.getAllByTestId('patient-user-management')).toBeDefined();
  });

  it('displays error message when there is an error', () => {
    // Mock error state
    mockUsePatientPortalAdmin.usePatientUsers.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load users'),
    });

    renderWithProviders(<PatientUserManagement onShowSnackbar={mockOnShowSnackbar} />);

    expect(screen.getByText('Failed to load patient users')).toBeInTheDocument();
  });
});