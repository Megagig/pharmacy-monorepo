/**
 * InviteList Component Tests
 * Tests for the InviteList component
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import InviteList from './InviteList';
import * as useWorkspaceTeamHooks from '../../queries/useWorkspaceTeam';
import type { WorkspaceInvite, GetInvitesResponse } from '../../types/workspace';

// Mock the hooks
vi.mock('../../queries/useWorkspaceTeam', () => ({
  useWorkspaceInvites: vi.fn(),
  useRevokeInvite: vi.fn(),
}));

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

// Helper function to create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Helper function to wrap component with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

// Mock invite data
const mockInvites: WorkspaceInvite[] = [
  {
    _id: '1',
    workplaceId: 'workplace1',
    inviteToken: 'token123',
    email: 'john@example.com',
    workplaceRole: 'Pharmacist',
    status: 'pending',
    invitedBy: 'user1',
    expiresAt: new Date('2025-12-31'),
    maxUses: 1,
    usedCount: 0,
    requiresApproval: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    _id: '2',
    workplaceId: 'workplace1',
    inviteToken: 'token456',
    email: 'jane@example.com',
    workplaceRole: 'Cashier',
    status: 'accepted',
    invitedBy: 'user1',
    expiresAt: new Date('2025-12-31'),
    acceptedAt: new Date('2025-01-15'),
    acceptedBy: 'user2',
    maxUses: 5,
    usedCount: 2,
    requiresApproval: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    _id: '3',
    workplaceId: 'workplace1',
    inviteToken: 'token789',
    email: 'expired@example.com',
    workplaceRole: 'Staff',
    status: 'pending',
    invitedBy: 'user1',
    expiresAt: new Date('2024-01-01'), // Expired
    maxUses: 1,
    usedCount: 0,
    requiresApproval: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: '4',
    workplaceId: 'workplace1',
    inviteToken: 'token101',
    email: 'revoked@example.com',
    workplaceRole: 'Technician',
    status: 'revoked',
    invitedBy: 'user1',
    expiresAt: new Date('2025-12-31'),
    revokedAt: new Date('2025-01-10'),
    revokedBy: 'user1',
    maxUses: 1,
    usedCount: 0,
    requiresApproval: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-10'),
  },
];

describe('InviteList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading skeletons while fetching data', () => {
      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList />);

      // Check for skeleton loaders
      const skeletons = screen.getAllByRole('row');
      expect(skeletons.length).toBeGreaterThan(1); // Header + skeleton rows
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', () => {
      const errorMessage = 'Failed to fetch invites';
      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error(errorMessage),
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList />);

      expect(screen.getByText('Failed to load invites')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no invites exist', () => {
      const emptyResponse: GetInvitesResponse = {
        invites: [],
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: emptyResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList />);

      expect(screen.getByText('No invites found')).toBeInTheDocument();
      expect(
        screen.getByText('Generate invite links to add new members to your workspace.')
      ).toBeInTheDocument();
    });

    it('should display filtered empty state message', () => {
      const emptyResponse: GetInvitesResponse = {
        invites: [],
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: emptyResponse,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList filters={{ status: 'accepted' }} />);

      expect(screen.getByText('No invites found')).toBeInTheDocument();
      expect(
        screen.getByText(/No invites with status "accepted"/)
      ).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      const response: GetInvitesResponse = {
        invites: mockInvites,
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);
    });

    it('should display all invites in the table', () => {
      renderWithProviders(<InviteList />);

      // Check table headers
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Usage')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check invite data
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('expired@example.com')).toBeInTheDocument();
      expect(screen.getByText('revoked@example.com')).toBeInTheDocument();
    });

    it('should display correct role badges', () => {
      renderWithProviders(<InviteList />);

      expect(screen.getByText('Pharmacist')).toBeInTheDocument();
      expect(screen.getByText('Cashier')).toBeInTheDocument();
      expect(screen.getByText('Staff')).toBeInTheDocument();
      expect(screen.getByText('Technician')).toBeInTheDocument();
    });

    it('should display correct status badges', () => {
      renderWithProviders(<InviteList />);

      const statusBadges = screen.getAllByText(/pending|accepted|expired|revoked/i);
      expect(statusBadges.length).toBeGreaterThan(0);
    });

    it('should display usage statistics', () => {
      renderWithProviders(<InviteList />);

      // Use getAllByText since multiple invites have "0 / 1"
      const usageStats = screen.getAllByText('0 / 1');
      expect(usageStats.length).toBeGreaterThan(0);
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
    });

    it('should show "Requires approval" label for invites that need approval', () => {
      renderWithProviders(<InviteList />);

      expect(screen.getByText('Requires approval')).toBeInTheDocument();
    });

    it('should mark expired invites', () => {
      renderWithProviders(<InviteList />);

      const expiredLabels = screen.getAllByText('Expired');
      expect(expiredLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Actions', () => {
    let mockMutateAsync: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockMutateAsync = vi.fn().mockResolvedValue({});

      const response: GetInvitesResponse = {
        invites: mockInvites,
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as any);
    });

    it('should show copied confirmation after copying', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InviteList />);

      const copyButtons = screen.getAllByLabelText('Copy invite link');
      await user.click(copyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should revoke invite when revoke button is clicked', async () => {
      const user = userEvent.setup();
      const onRevokeSuccess = vi.fn();
      renderWithProviders(<InviteList onRevokeSuccess={onRevokeSuccess} />);

      // Find the revoke button for the first pending invite
      const revokeButtons = screen.getAllByLabelText('Revoke invite');
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
        expect(mockMutateAsync).toHaveBeenCalledWith('1');
        expect(onRevokeSuccess).toHaveBeenCalled();
      });
    });

    it('should not revoke invite if user cancels confirmation', async () => {
      mockConfirm.mockReturnValue(false);
      const user = userEvent.setup();
      renderWithProviders(<InviteList />);

      const revokeButtons = screen.getAllByLabelText('Revoke invite');
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
        expect(mockMutateAsync).not.toHaveBeenCalled();
      });
    });

    it('should not show copy/revoke buttons for expired invites', () => {
      renderWithProviders(<InviteList />);

      // Get all rows
      const rows = screen.getAllByRole('row');
      
      // Find the expired invite row (expired@example.com)
      const expiredRow = rows.find((row) =>
        within(row).queryByText('expired@example.com')
      );

      expect(expiredRow).toBeDefined();
      if (expiredRow) {
        expect(within(expiredRow).queryByLabelText('Copy invite link')).not.toBeInTheDocument();
        expect(within(expiredRow).queryByLabelText('Revoke invite')).not.toBeInTheDocument();
      }
    });

    it('should not show copy/revoke buttons for revoked invites', () => {
      renderWithProviders(<InviteList />);

      const rows = screen.getAllByRole('row');
      const revokedRow = rows.find((row) =>
        within(row).queryByText('revoked@example.com')
      );

      expect(revokedRow).toBeDefined();
      if (revokedRow) {
        expect(within(revokedRow).queryByLabelText('Copy invite link')).not.toBeInTheDocument();
        expect(within(revokedRow).queryByLabelText('Revoke invite')).not.toBeInTheDocument();
      }
    });

    it('should not show copy/revoke buttons for accepted invites', () => {
      renderWithProviders(<InviteList />);

      const rows = screen.getAllByRole('row');
      const acceptedRow = rows.find((row) =>
        within(row).queryByText('jane@example.com')
      );

      expect(acceptedRow).toBeDefined();
      if (acceptedRow) {
        expect(within(acceptedRow).queryByLabelText('Copy invite link')).not.toBeInTheDocument();
        expect(within(acceptedRow).queryByLabelText('Revoke invite')).not.toBeInTheDocument();
      }
    });
  });

  describe('Pagination', () => {
    it('should paginate invites correctly', async () => {
      const user = userEvent.setup();
      
      // Create more invites for pagination
      const manyInvites: WorkspaceInvite[] = Array.from({ length: 25 }, (_, i) => ({
        _id: `invite-${i}`,
        workplaceId: 'workplace1',
        inviteToken: `token-${i}`,
        email: `user${i}@example.com`,
        workplaceRole: 'Staff',
        status: 'pending',
        invitedBy: 'user1',
        expiresAt: new Date('2025-12-31'),
        maxUses: 1,
        usedCount: 0,
        requiresApproval: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));

      const response: GetInvitesResponse = {
        invites: manyInvites,
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList />);

      // Check that pagination controls are present
      expect(screen.getByText('1–20 of 25')).toBeInTheDocument();

      // Go to next page
      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      // Check that we're on page 2
      await waitFor(() => {
        expect(screen.getByText('21–25 of 25')).toBeInTheDocument();
      });
    });

    it('should change rows per page', async () => {
      const user = userEvent.setup();
      
      const manyInvites: WorkspaceInvite[] = Array.from({ length: 25 }, (_, i) => ({
        _id: `invite-${i}`,
        workplaceId: 'workplace1',
        inviteToken: `token-${i}`,
        email: `user${i}@example.com`,
        workplaceRole: 'Staff',
        status: 'pending',
        invitedBy: 'user1',
        expiresAt: new Date('2025-12-31'),
        maxUses: 1,
        usedCount: 0,
        requiresApproval: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));

      const response: GetInvitesResponse = {
        invites: manyInvites,
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(<InviteList />);

      // Change rows per page to 10
      const rowsPerPageSelect = screen.getByRole('combobox', { name: /rows per page/i });
      await user.click(rowsPerPageSelect);
      
      const option10 = screen.getByRole('option', { name: '10' });
      await user.click(option10);

      await waitFor(() => {
        expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const response: GetInvitesResponse = {
        invites: mockInvites,
      };

      vi.mocked(useWorkspaceTeamHooks.useWorkspaceInvites).mockReturnValue({
        data: response,
        isLoading: false,
        error: null,
      } as any);

      vi.mocked(useWorkspaceTeamHooks.useRevokeInvite).mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);
    });

    it('should have proper ARIA labels for action buttons', () => {
      renderWithProviders(<InviteList />);

      expect(screen.getAllByLabelText('Copy invite link').length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText('Revoke invite').length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InviteList />);

      // Tab through the table
      await user.tab();
      
      // Should be able to focus on action buttons
      const copyButtons = screen.getAllByLabelText('Copy invite link');
      expect(copyButtons[0]).toHaveFocus();
    });
  });
});
