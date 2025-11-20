import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TenantManagement from '../TenantManagement';

const theme = createTheme();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Mock the saas service
jest.mock('../../../services/saasService', () => ({
  getTenants: jest.fn(),
  createTenant: jest.fn(),
  updateTenant: jest.fn(),
  deleteTenant: jest.fn(),
  suspendTenant: jest.fn(),
  reactivateTenant: jest.fn(),
}));

describe('TenantManagement', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('should render the component', () => {
    renderWithProviders(<TenantManagement />);
    
    expect(screen.getByText('Tenant Management')).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    renderWithProviders(<TenantManagement />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display add tenant button', () => {
    renderWithProviders(<TenantManagement />);
    
    const addButton = screen.getByRole('button', { name: /add tenant/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should open create tenant dialog when add button is clicked', async () => {
    renderWithProviders(<TenantManagement />);
    
    const addButton = screen.getByRole('button', { name: /add tenant/i });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
    });
  });

  it('should display search and filter controls', () => {
    renderWithProviders(<TenantManagement />);
    
    expect(screen.getByPlaceholderText(/search tenants/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plan filter/i)).toBeInTheDocument();
  });

  it('should handle search input', async () => {
    renderWithProviders(<TenantManagement />);
    
    const searchInput = screen.getByPlaceholderText(/search tenants/i);
    fireEvent.change(searchInput, { target: { value: 'test tenant' } });
    
    expect(searchInput).toHaveValue('test tenant');
  });

  it('should handle status filter change', async () => {
    renderWithProviders(<TenantManagement />);
    
    const statusFilter = screen.getByLabelText(/status filter/i);
    fireEvent.mouseDown(statusFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Suspended')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('should handle plan filter change', async () => {
    renderWithProviders(<TenantManagement />);
    
    const planFilter = screen.getByLabelText(/plan filter/i);
    fireEvent.mouseDown(planFilter);
    
    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });

  it('should display tenant table headers', () => {
    renderWithProviders(<TenantManagement />);
    
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Domain')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should handle create tenant form submission', async () => {
    const mockCreateTenant = require('../../../services/saasService').createTenant;
    mockCreateTenant.mockResolvedValue({ id: 'new-tenant', name: 'Test Tenant' });

    renderWithProviders(<TenantManagement />);
    
    // Open create dialog
    const addButton = screen.getByRole('button', { name: /add tenant/i });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByLabelText(/tenant name/i), {
      target: { value: 'Test Tenant' }
    });
    fireEvent.change(screen.getByLabelText(/domain/i), {
      target: { value: 'test.example.com' }
    });
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: 'admin@test.com' }
    });

    // Submit form
    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateTenant).toHaveBeenCalledWith({
        name: 'Test Tenant',
        domain: 'test.example.com',
        adminEmail: 'admin@test.com',
        plan: 'basic'
      });
    });
  });

  it('should validate required fields in create form', async () => {
    renderWithProviders(<TenantManagement />);
    
    // Open create dialog
    const addButton = screen.getByRole('button', { name: /add tenant/i });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
    });

    // Try to submit without filling required fields
    const createButton = screen.getByRole('button', { name: /create tenant/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/tenant name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/domain is required/i)).toBeInTheDocument();
      expect(screen.getByText(/admin email is required/i)).toBeInTheDocument();
    });
  });

  it('should handle tenant actions menu', async () => {
    renderWithProviders(<TenantManagement />);
    
    // Mock tenant data
    const mockTenants = [
      {
        id: 'tenant1',
        name: 'Test Tenant',
        domain: 'test.example.com',
        plan: 'premium',
        status: 'active',
        userCount: 25,
        createdAt: new Date().toISOString()
      }
    ];

    const mockGetTenants = require('../../../services/saasService').getTenants;
    mockGetTenants.mockResolvedValue({
      tenants: mockTenants,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    // Click actions menu
    const actionsButton = screen.getByLabelText(/actions for test tenant/i);
    fireEvent.click(actionsButton);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Suspend')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('should handle tenant suspension', async () => {
    const mockSuspendTenant = require('../../../services/saasService').suspendTenant;
    mockSuspendTenant.mockResolvedValue({ success: true });

    renderWithProviders(<TenantManagement />);
    
    // Mock tenant data
    const mockTenants = [
      {
        id: 'tenant1',
        name: 'Test Tenant',
        domain: 'test.example.com',
        plan: 'premium',
        status: 'active',
        userCount: 25,
        createdAt: new Date().toISOString()
      }
    ];

    const mockGetTenants = require('../../../services/saasService').getTenants;
    mockGetTenants.mockResolvedValue({
      tenants: mockTenants,
      pagination: { total: 1, page: 1, limit: 10 }
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    });

    // Click actions menu and suspend
    const actionsButton = screen.getByLabelText(/actions for test tenant/i);
    fireEvent.click(actionsButton);

    await waitFor(() => {
      const suspendButton = screen.getByText('Suspend');
      fireEvent.click(suspendButton);
    });

    // Confirm suspension
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to suspend/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /suspend/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSuspendTenant).toHaveBeenCalledWith('tenant1', expect.any(String));
    });
  });

  it('should display pagination controls', () => {
    renderWithProviders(<TenantManagement />);
    
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();
  });

  it('should handle error states', async () => {
    const mockGetTenants = require('../../../services/saasService').getTenants;
    mockGetTenants.mockRejectedValue(new Error('Failed to fetch tenants'));

    renderWithProviders(<TenantManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load tenants/i)).toBeInTheDocument();
    });
  });

  it('should display empty state when no tenants', async () => {
    const mockGetTenants = require('../../../services/saasService').getTenants;
    mockGetTenants.mockResolvedValue({
      tenants: [],
      pagination: { total: 0, page: 1, limit: 10 }
    });

    renderWithProviders(<TenantManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/no tenants found/i)).toBeInTheDocument();
    });
  });
});