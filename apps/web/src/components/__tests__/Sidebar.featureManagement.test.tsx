import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Sidebar from '../Sidebar';

// Mock the hooks
vi.mock('../../stores/sidebarHooks', () => ({
  useSidebarControls: () => ({
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
    setSidebarOpen: vi.fn(),
  }),
}));

vi.mock('../../hooks/useRBAC', () => ({
  useRBAC: vi.fn(),
}));

vi.mock('../../hooks/useSubscription', () => ({
  useSubscriptionStatus: () => ({
    isActive: true,
    tier: 'pro',
  }),
}));

vi.mock('../AccessControl', () => ({
  ConditionalRender: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const theme = createTheme();

const renderSidebar = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <Sidebar />
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Sidebar - Feature Management Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display Feature Management link for super_admin users', async () => {
    const { useRBAC } = await import('../../hooks/useRBAC');
    vi.mocked(useRBAC).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      hasRole: vi.fn((role: string) => role === 'super_admin'),
      requiresLicense: vi.fn().mockReturnValue(false),
      getLicenseStatus: vi.fn().mockReturnValue('approved'),
      hasPermission: vi.fn().mockReturnValue(true),
      canAccessResource: vi.fn().mockReturnValue(true),
      user: { role: 'super_admin' } as any,
      loading: false,
    });

    renderSidebar();

    // Check if Feature Management link is present
    const featureManagementLink = screen.getByText('Feature Management');
    expect(featureManagementLink).toBeInTheDocument();

    // Check if the link has the correct path
    const linkElement = featureManagementLink.closest('a');
    expect(linkElement).toHaveAttribute('href', '/admin/feature-management');
  });

  it('should NOT display Feature Management link for non-super_admin users', async () => {
    const { useRBAC } = await import('../../hooks/useRBAC');
    vi.mocked(useRBAC).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(false), // Not super_admin
      requiresLicense: vi.fn().mockReturnValue(false),
      getLicenseStatus: vi.fn().mockReturnValue('approved'),
      hasPermission: vi.fn().mockReturnValue(false),
      canAccessResource: vi.fn().mockReturnValue(false),
      user: { role: 'pharmacist' } as any,
      loading: false,
    });

    renderSidebar();

    // Check if Feature Management link is NOT present
    const featureManagementLink = screen.queryByText('Feature Management');
    expect(featureManagementLink).not.toBeInTheDocument();
  });

  it('should display Feature Management link in the ADMINISTRATION section', async () => {
    const { useRBAC } = await import('../../hooks/useRBAC');
    vi.mocked(useRBAC).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      hasRole: vi.fn((role: string) => role === 'super_admin'),
      requiresLicense: vi.fn().mockReturnValue(false),
      getLicenseStatus: vi.fn().mockReturnValue('approved'),
      hasPermission: vi.fn().mockReturnValue(true),
      canAccessResource: vi.fn().mockReturnValue(true),
      user: { role: 'super_admin' } as any,
      loading: false,
    });

    renderSidebar();

    // Check if ADMINISTRATION section header is present
    const administrationHeader = screen.getByText('ADMINISTRATION');
    expect(administrationHeader).toBeInTheDocument();

    // Check if Feature Management link is present
    const featureManagementLink = screen.getByText('Feature Management');
    expect(featureManagementLink).toBeInTheDocument();
  });

  it('should use Flag icon for Feature Management link', async () => {
    const { useRBAC } = await import('../../hooks/useRBAC');
    vi.mocked(useRBAC).mockReturnValue({
      hasFeature: vi.fn().mockReturnValue(true),
      hasRole: vi.fn((role: string) => role === 'super_admin'),
      requiresLicense: vi.fn().mockReturnValue(false),
      getLicenseStatus: vi.fn().mockReturnValue('approved'),
      hasPermission: vi.fn().mockReturnValue(true),
      canAccessResource: vi.fn().mockReturnValue(true),
      user: { role: 'super_admin' } as any,
      loading: false,
    });

    renderSidebar();

    // Check if Feature Management link is present
    const featureManagementLink = screen.getByText('Feature Management');
    expect(featureManagementLink).toBeInTheDocument();

    // The icon should be rendered as an SVG with the MuiSvgIcon class
    const linkElement = featureManagementLink.closest('a');
    const iconElement = linkElement?.querySelector('.MuiSvgIcon-root');
    expect(iconElement).toBeInTheDocument();
  });
});
