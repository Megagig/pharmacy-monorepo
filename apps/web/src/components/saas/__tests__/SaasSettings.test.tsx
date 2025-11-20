import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import SaasSettings from '../../../pages/SaasSettings';
import { useRBAC } from '../../../hooks/useRBAC';

// Mock the RBAC hook
jest.mock('../../../hooks/useRBAC');
const mockUseRBAC = useRBAC as jest.MockedFunction<typeof useRBAC>;

// Mock the lazy-loaded components
jest.mock('../SystemOverview', () => {
  return function MockSystemOverview() {
    return <div data-testid="system-overview">System Overview Component</div>;
  };
});

jest.mock('../UserManagement', () => {
  return function MockUserManagement() {
    return <div data-testid="user-management">User Management Component</div>;
  };
});

jest.mock('../FeatureFlagsManagement', () => {
  return function MockFeatureFlagsManagement() {
    return <div data-testid="feature-flags">Feature Flags Component</div>;
  };
});

jest.mock('../../admin/PricingManagement', () => {
  return function MockPricingManagement() {
    return <div data-testid="pricing-management">Pricing Management Component</div>;
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
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('SaasSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render access denied message for non-super admin users', () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: false,
      permissions: {
        canCreate: false,
        canRead: true,
        canUpdate: false,
        canDelete: false,
        canManage: false,
      },
      canAccess: jest.fn(),
      role: 'pharmacist',
      isOwner: false,
      isPharmacist: true,
      isTechnician: false,
      isAdmin: false,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    renderWithProviders(<SaasSettings />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/This page is restricted to Super Admin users only/)).toBeInTheDocument();
  });

  it('should render SaaS settings interface for super admin users', async () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    renderWithProviders(<SaasSettings />);

    expect(screen.getByText('SaaS Settings')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive system administration and configuration')).toBeInTheDocument();
    expect(screen.getByText('Super Admin Access')).toBeInTheDocument();
  });

  it('should display all tab categories', async () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    renderWithProviders(<SaasSettings />);

    // Check for tab labels
    expect(screen.getByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('Pricing Management')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    expect(screen.getByText('Security Settings')).toBeInTheDocument();
    expect(screen.getByText('Analytics & Reports')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Billing & Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Tenant Management')).toBeInTheDocument();
    expect(screen.getByText('Support & Helpdesk')).toBeInTheDocument();
    expect(screen.getByText('API & Integrations')).toBeInTheDocument();
  });

  it('should switch between tabs when clicked', async () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    renderWithProviders(<SaasSettings />);

    // Default tab should be System Overview
    await waitFor(() => {
      expect(screen.getByTestId('system-overview')).toBeInTheDocument();
    });

    // Click on User Management tab
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user-management')).toBeInTheDocument();
    });

    // Click on Feature Flags tab
    fireEvent.click(screen.getByText('Feature Flags'));
    
    await waitFor(() => {
      expect(screen.getByTestId('feature-flags')).toBeInTheDocument();
    });
  });

  it('should render breadcrumbs correctly', () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    renderWithProviders(<SaasSettings />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('SaaS Settings')).toBeInTheDocument();
  });

  it('should handle responsive design on mobile', () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });

    renderWithProviders(<SaasSettings />);

    // The component should still render properly on mobile
    expect(screen.getByText('SaaS Settings')).toBeInTheDocument();
  });

  it('should show error boundary fallback when component fails', async () => {
    mockUseRBAC.mockReturnValue({
      isSuperAdmin: true,
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canManage: true,
      },
      canAccess: jest.fn(),
      role: 'admin',
      isOwner: false,
      isPharmacist: false,
      isTechnician: false,
      isAdmin: true,
      hasRole: jest.fn(),
      hasPermission: jest.fn(),
      hasFeature: jest.fn(),
      requiresLicense: jest.fn(),
      getLicenseStatus: jest.fn(),
    });

    // Mock a component that throws an error
    jest.doMock('../SystemOverview', () => {
      return function ErrorComponent() {
        throw new Error('Test error');
      };
    });

    renderWithProviders(<SaasSettings />);

    // Should show error boundary fallback
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});