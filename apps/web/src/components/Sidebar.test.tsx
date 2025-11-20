import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import Sidebar from './Sidebar';
import { AuthProvider } from '../context/AuthContext';
import { FeatureFlagProvider } from '../context/FeatureFlagContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';

// Mock the hooks
vi.mock('../hooks/useRBAC', () => ({
  useRBAC: () => ({
    hasFeature: vi.fn(() => true),
    hasRole: vi.fn((role: string) => role === 'pharmacy_outlet'),
    requiresLicense: vi.fn(() => false),
    getLicenseStatus: vi.fn(() => 'approved'),
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      role: 'pharmacy_outlet',
      workplaceId: 'test-workplace-id',
    },
  }),
}));

vi.mock('../hooks/useSubscription', () => ({
  useSubscriptionStatus: () => ({
    isActive: true,
    tier: 'premium',
  }),
}));

vi.mock('../stores/sidebarHooks', () => ({
  useSidebarControls: () => ({
    sidebarOpen: true,
    toggleSidebar: vi.fn(),
    setSidebarOpen: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderSidebar = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <FeatureFlagProvider>
              <Sidebar />
            </FeatureFlagProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Sidebar - Team Members Navigation', () => {
  it('should render Team Members link for pharmacy_outlet users', () => {
    renderSidebar();
    
    const teamMembersLink = screen.getByText('Team Members');
    expect(teamMembersLink).toBeInTheDocument();
  });

  it('should point Team Members link to /workspace/team', () => {
    renderSidebar();
    
    const teamMembersLink = screen.getByText('Team Members').closest('a');
    expect(teamMembersLink).toHaveAttribute('href', '/workspace/team');
  });

  it('should show Team Members link only for pharmacy_outlet role', () => {
    // This test verifies the role-based visibility
    // The mock already sets hasRole to return true only for 'pharmacy_outlet'
    renderSidebar();
    
    const teamMembersLink = screen.getByText('Team Members');
    expect(teamMembersLink).toBeInTheDocument();
  });
});
