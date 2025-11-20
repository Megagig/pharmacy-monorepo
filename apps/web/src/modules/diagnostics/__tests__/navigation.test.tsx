import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Import components to test
import DiagnosticBreadcrumbs from '../components/DiagnosticBreadcrumbs';
import DiagnosticFeatureGuard from '../middlewares/diagnosticFeatureGuard';

// Mock hooks
vi.mock('../../../hooks/useRBAC', () => ({
  useRBAC: () => ({
    hasFeature: vi.fn(() => true),
    hasRole: vi.fn(() => true),
    requiresLicense: vi.fn(() => false),
    getLicenseStatus: vi.fn(() => 'approved'),
  }),
}));

vi.mock('../../../hooks/useSubscription', () => ({
  useSubscriptionStatus: () => ({
    isActive: true,
    tier: 'professional',
    daysRemaining: 30,
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/pharmacy/diagnostics',
    }),
    useParams: () => ({}),
  };
});

const theme = createTheme();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Diagnostic Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DiagnosticBreadcrumbs', () => {
    it('renders basic breadcrumbs for dashboard path', () => {
      render(<DiagnosticBreadcrumbs />, { wrapper: createWrapper() });

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(
        screen.getByText('AI Diagnostics & Therapeutics')
      ).toBeInTheDocument();
    });

    it('renders breadcrumbs with custom items', () => {
      const customItems = [
        { label: 'Custom Item', path: '/custom' },
        { label: 'Final Item' },
      ];

      render(<DiagnosticBreadcrumbs customItems={customItems} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Custom Item')).toBeInTheDocument();
      expect(screen.getByText('Final Item')).toBeInTheDocument();
    });

    it('handles case creation path correctly', () => {
      // Mock useLocation for case creation path
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useLocation: () => ({
            pathname: '/pharmacy/diagnostics/case/new',
          }),
          useParams: () => ({}),
        };
      });

      render(<DiagnosticBreadcrumbs />, { wrapper: createWrapper() });

      expect(screen.getByText('New Case')).toBeInTheDocument();
    });

    it('handles case review path correctly', () => {
      // Mock useLocation and useParams for case review path
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useLocation: () => ({
            pathname: '/pharmacy/diagnostics/case/123456789',
          }),
          useParams: () => ({
            requestId: '123456789',
          }),
        };
      });

      render(<DiagnosticBreadcrumbs />, { wrapper: createWrapper() });

      expect(screen.getByText('Cases')).toBeInTheDocument();
      expect(screen.getByText('Case 56789')).toBeInTheDocument(); // Last 8 chars
    });

    it('handles demo path correctly', () => {
      // Mock useLocation for demo path
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useLocation: () => ({
            pathname: '/pharmacy/diagnostics/demo',
          }),
          useParams: () => ({}),
        };
      });

      render(<DiagnosticBreadcrumbs />, { wrapper: createWrapper() });

      expect(screen.getByText('Component Demo')).toBeInTheDocument();
    });
  });

  describe('DiagnosticFeatureGuard', () => {
    it('renders children when user has required permissions', () => {
      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('shows access denied when user lacks required role', () => {
      // Mock useRBAC to return false for hasRole
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => true),
          hasRole: vi.fn(() => false),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(
        screen.getByText('AI Diagnostics & Therapeutics')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/requires pharmacist-level access/i)
      ).toBeInTheDocument();
    });

    it('shows subscription required when user has no active subscription', () => {
      // Mock useSubscriptionStatus to return inactive subscription
      vi.doMock('../../../hooks/useSubscription', () => ({
        useSubscriptionStatus: () => ({
          isActive: false,
          tier: 'free',
          daysRemaining: 0,
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(
        screen.getByText(/active subscription is required/i)
      ).toBeInTheDocument();
      expect(screen.getByText('Upgrade Subscription')).toBeInTheDocument();
    });

    it('shows feature not enabled when feature is disabled', () => {
      // Mock useRBAC to return false for hasFeature
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => false),
          hasRole: vi.fn(() => true),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(
        screen.getByText(/AI Diagnostics feature is not enabled/i)
      ).toBeInTheDocument();
    });

    it('displays feature highlights in access denied screen', () => {
      // Mock to show access denied screen
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => false),
          hasRole: vi.fn(() => true),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Feature Highlights')).toBeInTheDocument();
      expect(
        screen.getByText(/AI-powered differential diagnosis/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/drug interaction checking/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Lab result integration/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Clinical decision support/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/integration with clinical notes/i)
      ).toBeInTheDocument();
    });

    it('provides navigation buttons in access denied screen', () => {
      // Mock to show access denied screen
      vi.doMock('../../../hooks/useSubscription', () => ({
        useSubscriptionStatus: () => ({
          isActive: false,
          tier: 'free',
          daysRemaining: 0,
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      const upgradeButton = screen.getByText('Upgrade Subscription');
      const dashboardButton = screen.getByText('Back to Dashboard');

      expect(upgradeButton).toBeInTheDocument();
      expect(dashboardButton).toBeInTheDocument();

      // Check that buttons have correct links
      expect(upgradeButton.closest('a')).toHaveAttribute(
        'href',
        '/subscriptions'
      );
      expect(dashboardButton.closest('a')).toHaveAttribute(
        'href',
        '/dashboard'
      );
    });

    it('uses custom fallback when provided', () => {
      const customFallback = <div>Custom Access Denied</div>;

      // Mock to trigger fallback
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => false),
          hasRole: vi.fn(() => true),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      render(
        <DiagnosticFeatureGuard fallback={customFallback}>
          <div>Protected Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Custom Access Denied')).toBeInTheDocument();
    });
  });

  describe('Navigation Integration', () => {
    it('allows navigation between diagnostic pages when authorized', async () => {
      // Mock successful authorization
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => true),
          hasRole: vi.fn(() => true),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      vi.doMock('../../../hooks/useSubscription', () => ({
        useSubscriptionStatus: () => ({
          isActive: true,
          tier: 'professional',
          daysRemaining: 30,
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <DiagnosticBreadcrumbs />
          <div>Diagnostic Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Diagnostic Content')).toBeInTheDocument();
      expect(
        screen.getByText('AI Diagnostics & Therapeutics')
      ).toBeInTheDocument();
    });

    it('prevents navigation when not authorized', () => {
      // Mock failed authorization
      vi.doMock('../../../hooks/useRBAC', () => ({
        useRBAC: () => ({
          hasFeature: vi.fn(() => false),
          hasRole: vi.fn(() => false),
          requiresLicense: vi.fn(() => false),
          getLicenseStatus: vi.fn(() => 'approved'),
        }),
      }));

      render(
        <DiagnosticFeatureGuard>
          <DiagnosticBreadcrumbs />
          <div>Diagnostic Content</div>
        </DiagnosticFeatureGuard>,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Diagnostic Content')).not.toBeInTheDocument();
      expect(
        screen.getByText(/requires pharmacist-level access/i)
      ).toBeInTheDocument();
    });
  });
});
