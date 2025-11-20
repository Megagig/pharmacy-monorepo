import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthProvider } from '../../context/AuthContext';

// Mock the FeatureManagement component
vi.mock('../../pages/FeatureManagement', () => ({
  default: () => <div data-testid="feature-management-page">Feature Management Page</div>,
}));

// Mock the auth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock the RBAC hook
vi.mock('../../hooks/useRBAC', () => ({
  useRBAC: vi.fn(),
}));

// Mock the subscription hook
vi.mock('../../hooks/useSubscription', () => ({
  useSubscriptionStatus: vi.fn(() => ({
    status: 'active',
    isActive: true,
    tier: 'enterprise',
    daysRemaining: 30,
  })),
}));

import { useAuth } from '../../hooks/useAuth';
import { useRBAC } from '../../hooks/useRBAC';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('Feature Management Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render FeatureManagement page for super_admin users', async () => {
    // Mock super_admin user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        _id: '123',
        email: 'admin@test.com',
        role: 'super_admin',
        firstName: 'Admin',
        lastName: 'User',
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      updateProfile: vi.fn(),
      checkAuth: vi.fn(),
    } as any);

    vi.mocked(useRBAC).mockReturnValue({
      hasRole: vi.fn((role) => role === 'super_admin'),
      hasPermission: vi.fn(() => true),
      hasFeature: vi.fn(() => true),
      requiresLicense: vi.fn(() => false),
      getLicenseStatus: vi.fn(() => 'approved'),
      canAccessRoute: vi.fn(() => true),
      getEffectivePermissions: vi.fn(() => []),
    } as any);

    const LazyFeatureManagement = await import('../../pages/FeatureManagement');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/feature-management']}>
          <Routes>
            <Route
              path="/admin/feature-management"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <LazyFeatureManagement.default />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Feature Management/i)).toBeInTheDocument();
    });
  });

  it('should show access denied for non-super_admin users', async () => {
    // Mock regular user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        _id: '456',
        email: 'user@test.com',
        role: 'pharmacist',
        firstName: 'Regular',
        lastName: 'User',
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      updateProfile: vi.fn(),
      checkAuth: vi.fn(),
    } as any);

    vi.mocked(useRBAC).mockReturnValue({
      hasRole: vi.fn((role) => role === 'pharmacist'),
      hasPermission: vi.fn(() => false),
      hasFeature: vi.fn(() => true),
      requiresLicense: vi.fn(() => false),
      getLicenseStatus: vi.fn(() => 'approved'),
      canAccessRoute: vi.fn(() => false),
      getEffectivePermissions: vi.fn(() => []),
    } as any);

    const LazyFeatureManagement = await import('../../pages/FeatureManagement');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/feature-management']}>
          <Routes>
            <Route
              path="/admin/feature-management"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <LazyFeatureManagement.default />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Insufficient Role Permissions/i)).toBeInTheDocument();
    });
  });

  it('should redirect unauthenticated users to login', async () => {
    // Mock no user
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      updateProfile: vi.fn(),
      checkAuth: vi.fn(),
    } as any);

    vi.mocked(useRBAC).mockReturnValue({
      hasRole: vi.fn(() => false),
      hasPermission: vi.fn(() => false),
      hasFeature: vi.fn(() => false),
      requiresLicense: vi.fn(() => false),
      getLicenseStatus: vi.fn(() => 'not_uploaded'),
      canAccessRoute: vi.fn(() => false),
      getEffectivePermissions: vi.fn(() => []),
    } as any);

    const LazyFeatureManagement = await import('../../pages/FeatureManagement');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/feature-management']}>
          <Routes>
            <Route
              path="/admin/feature-management"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <LazyFeatureManagement.default />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Login Page/i)).toBeInTheDocument();
    });
  });
});
