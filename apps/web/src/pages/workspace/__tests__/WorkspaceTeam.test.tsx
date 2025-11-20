/**
 * Tests for WorkspaceTeam page component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkspaceTeam from '../WorkspaceTeam';

// Mock hooks
vi.mock('../../../hooks/useRBAC', () => ({
  useRBAC: vi.fn(),
}));

vi.mock('../../../queries/useWorkspaceTeam', () => ({
  useWorkspaceStats: vi.fn(),
  useWorkspaceMembers: vi.fn(),
}));

// Import mocked hooks
import { useRBAC } from '../../../hooks/useRBAC';
import { useWorkspaceStats, useWorkspaceMembers } from '../../../queries/useWorkspaceTeam';

describe('WorkspaceTeam', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    vi.clearAllMocks();

    // Default mock for useWorkspaceMembers
    vi.mocked(useWorkspaceMembers).mockReturnValue({
      data: {
        members: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
      isLoading: false,
      error: null,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceTeam />
      </QueryClientProvider>
    );
  };

  describe('Access Control', () => {
    it('should deny access to non-pharmacy_outlet users', () => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn().mockReturnValue(false),
        permissions: {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
          canManage: false,
        },
        canAccess: vi.fn(),
        role: 'pharmacist',
        isOwner: false,
        isPharmacist: true,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });

      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(
        screen.getByText(/This page is restricted to workspace owners only/)
      ).toBeInTheDocument();
    });

    it('should allow access to pharmacy_outlet users', () => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });

      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Team Management')).toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    beforeEach(() => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });
    });

    it('should display page title and description', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Team Management')).toBeInTheDocument();
      expect(
        screen.getByText(/Manage your workspace team members/)
      ).toBeInTheDocument();
    });

    it('should display workspace owner badge', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Workspace Owner')).toBeInTheDocument();
    });
  });

  describe('Statistics Cards', () => {
    beforeEach(() => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });
    });

    it('should display loading state for stats', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderComponent();

      // Should show loading spinners in stats cards
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should display stats when loaded', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 15,
          activeMembers: 12,
          pendingApprovals: 3,
          activeInvites: 5,
        },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.getByText('Total Members')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();

      expect(screen.getByText('Active Members')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();

      // Use getAllByText since "Pending Approvals" appears in both stats card and tab
      expect(screen.getAllByText('Pending Approvals').length).toBeGreaterThan(0);
      expect(screen.getByText('3')).toBeInTheDocument();

      // Use getAllByText since "Active Invites" might appear in multiple places
      expect(screen.getAllByText('Active Invites').length).toBeGreaterThan(0);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display error message when stats fail to load', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load stats'),
      } as any);

      renderComponent();

      expect(
        screen.getByText(/Failed to load workspace statistics/)
      ).toBeInTheDocument();
    });

    it('should display zero values when no stats available', () => {
      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      // Should show 0 for all stats
      const zeroValues = screen.getAllByText('0');
      expect(zeroValues.length).toBe(4); // 4 stat cards
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(() => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });

      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should display all four tabs', () => {
      renderComponent();

      expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Pending Approvals/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Invite Links/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Audit Trail/i })
      ).toBeInTheDocument();
    });

    it('should show Members tab content by default', () => {
      renderComponent();

      const membersTab = screen.getByRole('tab', { name: /Members/i });
      expect(membersTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch to Pending Approvals tab when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const pendingTab = screen.getByRole('tab', { name: /Pending Approvals/i });
      await user.click(pendingTab);

      await waitFor(() => {
        expect(pendingTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should switch to Invite Links tab when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const inviteTab = screen.getByRole('tab', { name: /Invite Links/i });
      await user.click(inviteTab);

      await waitFor(() => {
        expect(inviteTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    it('should switch to Audit Trail tab when clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const auditTab = screen.getByRole('tab', { name: /Audit Trail/i });
      await user.click(auditTab);

      await waitFor(() => {
        expect(auditTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Tab Content', () => {
    beforeEach(() => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });

      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should display MemberList component in Members tab', () => {
      renderComponent();

      // Check that the MemberList component is rendered (it should show the table or empty state)
      const table = screen.queryByRole('table');
      const emptyState = screen.queryByText(/No team members found/i);
      
      // Either the table or empty state should be present
      expect(table || emptyState).toBeTruthy();
    });

    it('should display placeholder for Pending Approvals tab', async () => {
      const user = userEvent.setup();
      renderComponent();

      const pendingTab = screen.getByRole('tab', { name: /Pending Approvals/i });
      await user.click(pendingTab);

      await waitFor(() => {
        expect(
          screen.getByText(/Pending approvals component will be implemented/)
        ).toBeInTheDocument();
      });
    });

    it('should display placeholder for Invite Links tab', async () => {
      const user = userEvent.setup();
      renderComponent();

      const inviteTab = screen.getByRole('tab', { name: /Invite Links/i });
      await user.click(inviteTab);

      await waitFor(() => {
        expect(
          screen.getByText(/Invite links component will be implemented/)
        ).toBeInTheDocument();
      });
    });

    it('should display placeholder for Audit Trail tab', async () => {
      const user = userEvent.setup();
      renderComponent();

      const auditTab = screen.getByRole('tab', { name: /Audit Trail/i });
      await user.click(auditTab);

      await waitFor(() => {
        expect(
          screen.getByText(/Audit trail component will be implemented/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    beforeEach(() => {
      vi.mocked(useRBAC).mockReturnValue({
        hasRole: vi.fn((role) => role === 'pharmacy_outlet'),
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canManage: true,
        },
        canAccess: vi.fn(),
        role: 'owner',
        isOwner: true,
        isPharmacist: false,
        isTechnician: false,
        isAdmin: false,
        isSuperAdmin: false,
        hasPermission: vi.fn(),
        hasFeature: vi.fn(),
        requiresLicense: vi.fn(),
        getLicenseStatus: vi.fn(),
      });

      vi.mocked(useWorkspaceStats).mockReturnValue({
        data: {
          totalMembers: 10,
          activeMembers: 8,
          pendingApprovals: 2,
          activeInvites: 3,
        },
        isLoading: false,
        error: null,
      } as any);
    });

    it('should render without crashing on mobile viewport', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderComponent();

      expect(screen.getByText('Team Management')).toBeInTheDocument();
    });

    it('should render without crashing on desktop viewport', () => {
      // Mock desktop viewport
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));

      renderComponent();

      expect(screen.getByText('Team Management')).toBeInTheDocument();
    });
  });
});
