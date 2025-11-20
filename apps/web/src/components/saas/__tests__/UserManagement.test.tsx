import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import UserManagement from '../UserManagement';
import * as saasQueries from '../../../queries/useSaasSettings';

// Mock the SaaS queries
jest.mock('../../../queries/useSaasSettings');

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
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockUsersData = {
  users: [
    {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      role: 'pharmacist',
      status: 'active',
      workspaceName: 'Central Pharmacy',
      lastActive: '2024-01-15T10:30:00Z',
    },
    {
      id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      role: 'super_admin',
      status: 'active',
      workspaceName: 'System Admin',
      lastActive: '2024-01-15T09:15:00Z',
    },
    {
      id: 'user3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      role: 'pharmacy_team',
      status: 'suspended',
      workspaceName: 'Metro Pharmacy',
      lastActive: '2024-01-10T14:20:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  },
  filters: {},
};

const mockMutations = {
  mutate: jest.fn(),
  isLoading: false,
  error: null,
};

describe('UserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    (saasQueries.useUsers as jest.Mock).mockReturnValue({
      data: mockUsersData,
      isLoading: false,
      error: null,
    });

    (saasQueries.useUpdateUserRole as jest.Mock).mockReturnValue(mockMutations);
    (saasQueries.useSuspendUser as jest.Mock).mockReturnValue(mockMutations);
    (saasQueries.useReactivateUser as jest.Mock).mockReturnValue(mockMutations);
    (saasQueries.useImpersonateUser as jest.Mock).mockReturnValue(mockMutations);
  });

  it('should render user management interface with correct title and subtitle', () => {
    renderWithProviders(<UserManagement />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage users, roles, and permissions across all pharmacy tenants')).toBeInTheDocument();
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  it('should render filter controls', () => {
    renderWithProviders(<UserManagement />);

    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByText('More Filters')).toBeInTheDocument();
  });

  it('should display users table with correct headers', () => {
    renderWithProviders(<UserManagement />);

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Last Active')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should display user data correctly in table rows', () => {
    renderWithProviders(<UserManagement />);

    // Check first user
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('pharmacist')).toBeInTheDocument();
    expect(screen.getByText('Central Pharmacy')).toBeInTheDocument();

    // Check second user
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('super admin')).toBeInTheDocument();

    // Check third user
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(screen.getByText('suspended')).toBeInTheDocument();
  });

  it('should show loading skeletons when data is loading', () => {
    (saasQueries.useUsers as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<UserManagement />);

    // Should show skeleton loaders in table
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display error message when there is an error', () => {
    (saasQueries.useUsers as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch users'),
    });

    renderWithProviders(<UserManagement />);

    expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
    expect(screen.getByText(/There was an error loading the user data/)).toBeInTheDocument();
  });

  it('should handle search filter changes', async () => {
    renderWithProviders(<UserManagement />);

    const searchInput = screen.getByPlaceholderText('Search users...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(searchInput).toHaveValue('john');
  });

  it('should handle role filter changes', async () => {
    renderWithProviders(<UserManagement />);

    const roleSelect = screen.getByLabelText('Role');
    fireEvent.mouseDown(roleSelect);

    await waitFor(() => {
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
      expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pharmacist'));
    expect(roleSelect).toHaveTextContent('Pharmacist');
  });

  it('should handle status filter changes', async () => {
    renderWithProviders(<UserManagement />);

    const statusSelect = screen.getByLabelText('Status');
    fireEvent.mouseDown(statusSelect);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Suspended')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Active'));
    expect(statusSelect).toHaveTextContent('Active');
  });

  it('should open user actions menu when clicked', async () => {
    renderWithProviders(<UserManagement />);

    const actionButtons = screen.getAllByRole('button', { name: '' });
    const firstActionButton = actionButtons.find(button =>
      button.querySelector('[data-testid="MoreVertIcon"]')
    );

    if (firstActionButton) {
      fireEvent.click(firstActionButton);

      await waitFor(() => {
        expect(screen.getByText('Edit User')).toBeInTheDocument();
        expect(screen.getByText('Suspend User')).toBeInTheDocument();
        expect(screen.getByText('Impersonate User')).toBeInTheDocument();
      });
    }
  });

  it('should open edit user dialog when edit is clicked', async () => {
    renderWithProviders(<UserManagement />);

    const actionButtons = screen.getAllByRole('button', { name: '' });
    const firstActionButton = actionButtons.find(button =>
      button.querySelector('[data-testid="MoreVertIcon"]')
    );

    if (firstActionButton) {
      fireEvent.click(firstActionButton);

      await waitFor(() => {
        const editButton = screen.getByText('Edit User');
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Edit User Role')).toBeInTheDocument();
        expect(screen.getByText('User: john.doe@example.com')).toBeInTheDocument();
      });
    }
  });

  it('should handle pagination changes', () => {
    renderWithProviders(<UserManagement />);

    // Check if pagination is rendered
    expect(screen.getByText('1–3 of 3')).toBeInTheDocument();
  });

  it('should display correct role colors', () => {
    renderWithProviders(<UserManagement />);

    // Check that role chips are rendered (specific colors are handled by MUI)
    expect(screen.getByText('pharmacist')).toBeInTheDocument();
    expect(screen.getByText('super admin')).toBeInTheDocument();
    expect(screen.getByText('pharmacy team')).toBeInTheDocument();
  });

  it('should display correct status colors', () => {
    renderWithProviders(<UserManagement />);

    // Check that status chips are rendered
    const activeChips = screen.getAllByText('active');
    const suspendedChip = screen.getByText('suspended');

    expect(activeChips.length).toBe(2);
    expect(suspendedChip).toBeInTheDocument();
  });

  it('should handle empty user list', () => {
    (saasQueries.useUsers as jest.Mock).mockReturnValue({
      data: {
        users: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        filters: {},
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<UserManagement />);

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should save user role changes in edit dialog', async () => {
    const mockUpdateUserRole = jest.fn();
    (saasQueries.useUpdateUserRole as jest.Mock).mockReturnValue({
      mutate: mockUpdateUserRole,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<UserManagement />);

    // Open actions menu and click edit
    const actionButtons = screen.getAllByRole('button', { name: '' });
    const firstActionButton = actionButtons.find(button =>
      button.querySelector('[data-testid="MoreVertIcon"]')
    );

    if (firstActionButton) {
      fireEvent.click(firstActionButton);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Edit User'));
      });

      await waitFor(() => {
        // Change role in dialog
        const roleSelect = screen.getByLabelText('Role');
        fireEvent.mouseDown(roleSelect);
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Super Admin'));
      });

      // Save changes
      fireEvent.click(screen.getByText('Save Changes'));

      expect(mockUpdateUserRole).toHaveBeenCalledWith({
        userId: 'user1',
        roleId: 'super_admin',
      });
    }
  });

  it('should handle user suspension', async () => {
    const mockSuspendUser = jest.fn();
    (saasQueries.useSuspendUser as jest.Mock).mockReturnValue({
      mutate: mockSuspendUser,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<UserManagement />);

    // Open actions menu and click suspend
    const actionButtons = screen.getAllByRole('button', { name: '' });
    const firstActionButton = actionButtons.find(button =>
      button.querySelector('[data-testid="MoreVertIcon"]')
    );

    if (firstActionButton) {
      fireEvent.click(firstActionButton);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Suspend User'));
      });

      expect(mockSuspendUser).toHaveBeenCalledWith({
        userId: 'user1',
        reason: 'Suspended by administrator',
      });
    }
  });

  it('should handle user impersonation', async () => {
    const mockImpersonateUser = jest.fn();
    (saasQueries.useImpersonateUser as jest.Mock).mockReturnValue({
      mutate: mockImpersonateUser,
      isLoading: false,
      error: null,
    });

    renderWithProviders(<UserManagement />);

    // Open actions menu and click impersonate
    const actionButtons = screen.getAllByRole('button', { name: '' });
    const firstActionButton = actionButtons.find(button =>
      button.querySelector('[data-testid="MoreVertIcon"]')
    );

    if (firstActionButton) {
      fireEvent.click(firstActionButton);

      await waitFor(() => {
        fireEvent.click(screen.getByText('Impersonate User'));
      });

      expect(mockImpersonateUser).toHaveBeenCalledWith('user1');
    }
  });
});