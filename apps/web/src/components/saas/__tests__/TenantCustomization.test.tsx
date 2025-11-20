import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TenantManagement from '../TenantManagement';
import { useSaasSettings } from '../../../queries/useSaasSettings';

// Mock the useSaasSettings hook
jest.mock('../../../queries/useSaasSettings');

const mockUseSaasSettings = useSaasSettings as jest.MockedFunction<typeof useSaasSettings>;

const mockSaasService = {
  getTenants: jest.fn(),
  getTenantCustomization: jest.fn(),
  updateTenantBranding: jest.fn(),
  updateTenantLimits: jest.fn(),
  updateTenantFeatures: jest.fn(),
  updateTenantCustomization: jest.fn(),
};

const mockTenants = [
  {
    _id: 'tenant1',
    name: 'Test Pharmacy',
    slug: 'test-pharmacy',
    type: 'pharmacy',
    status: 'active',
    subscriptionStatus: 'active',
    contactInfo: {
      email: 'admin@testpharmacy.com',
      phone: '+1234567890',
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    lastActivity: '2024-01-15T00:00:00.000Z',
  },
  {
    _id: 'tenant2',
    name: 'City Clinic',
    slug: 'city-clinic',
    type: 'clinic',
    status: 'trial',
    subscriptionStatus: 'trialing',
    contactInfo: {
      email: 'admin@cityclinic.com',
    },
    createdAt: '2024-01-10T00:00:00.000Z',
    lastActivity: '2024-01-14T00:00:00.000Z',
  },
];

const mockCustomization = {
  branding: {
    primaryColor: '#3B82F6',
    secondaryColor: '#6B7280',
    fontFamily: 'Inter, sans-serif',
  },
  limits: {
    maxUsers: 10,
    maxPatients: 1000,
    storageLimit: 5000,
    apiCallsPerMonth: 10000,
    maxWorkspaces: 1,
    maxIntegrations: 5,
  },
  features: ['patient-management', 'prescription-processing'],
  settings: {
    timezone: 'UTC',
    currency: 'USD',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
  usageMetrics: {
    currentUsers: 5,
    currentPatients: 500,
    storageUsed: 2500,
    apiCallsThisMonth: 5000,
    lastCalculatedAt: '2024-01-15T00:00:00.000Z',
  },
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('TenantManagement - Customization', () => {
  beforeEach(() => {
    mockUseSaasSettings.mockReturnValue({
      saasService: mockSaasService,
    } as any);

    mockSaasService.getTenants.mockResolvedValue({
      tenants: mockTenants,
      pagination: { page: 1, limit: 20, total: 2, pages: 1 },
    });

    mockSaasService.getTenantCustomization.mockResolvedValue({
      customization: mockCustomization,
    });

    jest.clearAllMocks();
  });

  it('should render tenant management interface', async () => {
    renderWithQueryClient(<TenantManagement />);

    expect(screen.getByText('Tenant Management')).toBeInTheDocument();
    expect(screen.getByText('Tenant List')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('should load and display tenants', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(mockSaasService.getTenants).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('City Clinic')).toBeInTheDocument();
    });
  });

  it('should display tenant information correctly', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      // Check tenant names
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
      expect(screen.getByText('test-pharmacy')).toBeInTheDocument();
      
      // Check tenant types
      expect(screen.getByText('pharmacy')).toBeInTheDocument();
      expect(screen.getByText('clinic')).toBeInTheDocument();
      
      // Check statuses
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('trial')).toBeInTheDocument();
      
      // Check contact emails
      expect(screen.getByText('admin@testpharmacy.com')).toBeInTheDocument();
      expect(screen.getByText('admin@cityclinic.com')).toBeInTheDocument();
    });
  });

  it('should open customization dialog when edit button is clicked', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click the edit button for the first tenant
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(mockSaasService.getTenantCustomization).toHaveBeenCalledWith('tenant1');
    });
  });

  it('should display branding information in customization view', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Branding & Theming')).toBeInTheDocument();
      expect(screen.getByText('#3B82F6')).toBeInTheDocument();
      expect(screen.getByText('#6B7280')).toBeInTheDocument();
    });
  });

  it('should display limits and usage information', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Limits & Quotas')).toBeInTheDocument();
      expect(screen.getByText('5 / 10 users')).toBeInTheDocument();
      expect(screen.getByText('500 / 1,000 patients')).toBeInTheDocument();
    });
  });

  it('should display enabled features', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Enabled Features')).toBeInTheDocument();
      expect(screen.getByText('Patient Management')).toBeInTheDocument();
      expect(screen.getByText('Prescription Processing')).toBeInTheDocument();
    });
  });

  it('should show usage analytics in analytics tab', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    // Switch to analytics tab
    const analyticsTab = screen.getByRole('tab', { name: /analytics/i });
    fireEvent.click(analyticsTab);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Active Users
      expect(screen.getByText('500')).toBeInTheDocument(); // Patients
      expect(screen.getByText('2.4GB')).toBeInTheDocument(); // Storage Used
      expect(screen.getByText('5,000')).toBeInTheDocument(); // API Calls
    });
  });

  it('should handle branding update', async () => {
    mockSaasService.updateTenantBranding.mockResolvedValue({ success: true });

    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Branding & Theming')).toBeInTheDocument();
    });

    // Click edit branding button
    const editBrandingButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBrandingButton);

    // This would open a branding edit dialog/form
    // The actual implementation would depend on the UI design
  });

  it('should handle limits update', async () => {
    mockSaasService.updateTenantLimits.mockResolvedValue({ success: true });

    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Limits & Quotas')).toBeInTheDocument();
    });

    // The actual limits editing would be implemented with forms/dialogs
  });

  it('should handle features update', async () => {
    mockSaasService.updateTenantFeatures.mockResolvedValue({ success: true });

    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Enabled Features')).toBeInTheDocument();
    });

    // The actual features editing would be implemented with checkboxes/toggles
  });

  it('should handle loading states', async () => {
    // Mock loading state
    mockSaasService.getTenants.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ tenants: [], pagination: {} }), 100))
    );

    renderWithQueryClient(<TenantManagement />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('should handle error states', async () => {
    mockSaasService.getTenants.mockRejectedValue(new Error('Failed to load tenants'));

    renderWithQueryClient(<TenantManagement />);

    // Error handling would be implemented with error boundaries or error states
    // The exact implementation depends on the error handling strategy
  });

  it('should refresh tenants when refresh button is clicked', async () => {
    renderWithQueryClient(<TenantManagement />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockSaasService.getTenants).toHaveBeenCalledTimes(2); // Initial load + refresh
    });
  });

  it('should format usage percentages correctly', async () => {
    renderWithQueryClient(<TenantManagement />);

    await waitFor(() => {
      expect(screen.getByText('Test Pharmacy')).toBeInTheDocument();
    });

    // Click edit button to open customization
    const editButtons = screen.getAllByRole('button', { name: /customize tenant/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      // Check that usage percentages are displayed
      expect(screen.getByText('50.0%')).toBeInTheDocument(); // 5/10 users = 50%
      expect(screen.getByText('50.0%')).toBeInTheDocument(); // 500/1000 patients = 50%
    });
  });
});