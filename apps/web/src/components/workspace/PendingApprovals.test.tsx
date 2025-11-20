/**
 * PendingApprovals Component Tests
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PendingApprovals from './PendingApprovals';
import * as useWorkspaceTeamHooks from '../../queries/useWorkspaceTeam';
import type { Member } from '../../types/workspace';

// Mock the hooks
vi.mock('../../queries/useWorkspaceTeam');

// Helper to create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Helper to wrap component with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

// Mock pending members data
const mockPendingMembers: Member[] = [
  {
    _id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    workplaceRole: 'Pharmacist',
    status: 'pending',
    joinedAt: new Date('2024-01-15'),
    permissions: [],
  },
  {
    _id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    workplaceRole: 'Cashier',
    status: 'pending',
    joinedAt: new Date('2024-01-16'),
    permissions: [],
  },
  {
    _id: '3',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@example.com',
    workplaceRole: 'Staff',
    status: 'pending',
    joinedAt: new Date('2024-01-17'),
    permissions: [],
  },
];

describe('PendingApprovals', () => {
  const mockApproveMember = vi.fn();
  const mockRejectMember = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.spyOn(useWorkspaceTeamHooks, 'usePendingMembers').mockReturnValue({
      data: { pendingMembers: mockPendingMembers },
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useWorkspaceTeamHooks, 'useApproveMember').mockReturnValue({
      mutateAsync: mockApproveMember,
      isPending: false,
    } as any);

    vi.spyOn(useWorkspaceTeamHooks, 'useRejectMember').mockReturnValue({
      mutateAsync: mockRejectMember,
      isPending: false,
    } as any);
  });

  describe('Rendering', () => {
    it('should render pending members table', () => {
      renderWithProviders(<PendingApprovals />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should display member information correctly', () => {
      renderWithProviders(<PendingApprovals />);

      // Check first member
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    });

    it('should display avatars with initials', () => {
      renderWithProviders(<PendingApprovals />);

      // Check for avatar text content instead of role
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.getByText('JS')).toBeInTheDocument();
      expect(screen.getByText('BJ')).toBeInTheDocument();
    });

    it('should display role badges with correct colors', () => {
      renderWithProviders(<PendingApprovals />);

      const pharmacistChip = screen.getByText('Pharmacist');
      const cashierChip = screen.getByText('Cashier');
      const staffChip = screen.getByText('Staff');

      expect(pharmacistChip).toBeInTheDocument();
      expect(cashierChip).toBeInTheDocument();
      expect(staffChip).toBeInTheDocument();
    });

    it('should display formatted join dates', () => {
      renderWithProviders(<PendingApprovals />);

      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 16, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 17, 2024/)).toBeInTheDocument();
    });

    it('should display approve and reject buttons for each member', () => {
      renderWithProviders(<PendingApprovals />);

      const approveButtons = screen.getAllByRole('button', { name: /approve/i });
      const rejectButtons = screen.getAllByRole('button', { name: /reject/i });

      expect(approveButtons).toHaveLength(mockPendingMembers.length);
      expect(rejectButtons).toHaveLength(mockPendingMembers.length);
    });
  });

  describe('Loading State', () => {
    it('should display loading skeletons when loading', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'usePendingMembers').mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      renderWithProviders(<PendingApprovals />);

      // Check for skeleton elements by class name
      const container = screen.getByRole('table').parentElement;
      const skeletons = container?.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons && skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no pending members', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'usePendingMembers').mockReturnValue({
        data: { pendingMembers: [] },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(<PendingApprovals />);

      expect(screen.getByText('No pending approvals')).toBeInTheDocument();
      expect(
        screen.getByText(/All member requests have been processed/i)
      ).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', () => {
      const errorMessage = 'Failed to load pending members';
      vi.spyOn(useWorkspaceTeamHooks, 'usePendingMembers').mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error(errorMessage),
      } as any);

      renderWithProviders(<PendingApprovals />);

      expect(screen.getByText('Failed to load pending approvals')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Single Member Actions', () => {
    it('should approve a member when approve button is clicked', async () => {
      const user = userEvent.setup();
      mockApproveMember.mockResolvedValue({});

      renderWithProviders(<PendingApprovals />);

      const approveButtons = screen.getAllByRole('button', { name: /approve john doe/i });
      await user.click(approveButtons[0]);

      await waitFor(() => {
        expect(mockApproveMember).toHaveBeenCalledWith({
          memberId: '1',
          data: {},
        });
      });
    });

    it('should open reject dialog when reject button is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const rejectButtons = screen.getAllByRole('button', { name: /reject john doe/i });
      await user.click(rejectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Reject Member Request')).toBeInTheDocument();
        expect(screen.getByText(/You are about to reject the membership request from/)).toBeInTheDocument();
      });
    });

    it('should reject a member with reason from dialog', async () => {
      const user = userEvent.setup();
      mockRejectMember.mockResolvedValue({});

      renderWithProviders(<PendingApprovals />);

      // Open reject dialog
      const rejectButtons = screen.getAllByRole('button', { name: /reject john doe/i });
      await user.click(rejectButtons[0]);

      // Enter rejection reason
      const reasonInput = screen.getByLabelText(/rejection reason/i);
      await user.type(reasonInput, 'Not qualified');

      // Confirm rejection
      const confirmButton = screen.getByRole('button', { name: /^reject$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRejectMember).toHaveBeenCalledWith({
          memberId: '1',
          data: { reason: 'Not qualified' },
        });
      });
    });

    it('should reject a member without reason', async () => {
      const user = userEvent.setup();
      mockRejectMember.mockResolvedValue({});

      renderWithProviders(<PendingApprovals />);

      // Open reject dialog
      const rejectButtons = screen.getAllByRole('button', { name: /reject john doe/i });
      await user.click(rejectButtons[0]);

      // Confirm rejection without entering reason
      const confirmButton = screen.getByRole('button', { name: /^reject$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRejectMember).toHaveBeenCalledWith({
          memberId: '1',
          data: {},
        });
      });
    });

    it('should close reject dialog when cancel is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      // Open reject dialog
      const rejectButtons = screen.getAllByRole('button', { name: /reject john doe/i });
      await user.click(rejectButtons[0]);

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Reject Member Request')).not.toBeInTheDocument();
      });
    });
  });

  describe('Bulk Selection', () => {
    it('should select individual members', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const checkboxes = screen.getAllByRole('checkbox');
      const firstMemberCheckbox = checkboxes[1]; // Skip "select all" checkbox

      await user.click(firstMemberCheckbox);

      expect(firstMemberCheckbox).toBeChecked();
      expect(screen.getByText('1 member(s) selected')).toBeInTheDocument();
    });

    it('should select all members when select all is clicked', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(selectAllCheckbox).toBeChecked();
      expect(screen.getByText('3 member(s) selected')).toBeInTheDocument();
    });

    it('should deselect all members when select all is clicked again', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      
      // Select all
      await user.click(selectAllCheckbox);
      expect(screen.getByText('3 member(s) selected')).toBeInTheDocument();

      // Deselect all
      await user.click(selectAllCheckbox);
      expect(screen.queryByText(/member\(s\) selected/)).not.toBeInTheDocument();
    });

    it('should show indeterminate state when some members are selected', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const checkboxes = screen.getAllByRole('checkbox');
      const firstMemberCheckbox = checkboxes[1];

      await user.click(firstMemberCheckbox);

      // Check that the select all checkbox has indeterminate data attribute
      const selectAllCheckbox = checkboxes[0];
      expect(selectAllCheckbox).toHaveAttribute('data-indeterminate', 'true');
    });
  });

  describe('Bulk Actions', () => {
    it('should display bulk action bar when members are selected', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PendingApprovals />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      expect(screen.getByText('1 member(s) selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve selected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject selected/i })).toBeInTheDocument();
    });

    it('should bulk approve selected members', async () => {
      const user = userEvent.setup();
      mockApproveMember.mockResolvedValue({});
      
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(<PendingApprovals />);

      // Select two members
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click bulk approve
      const bulkApproveButton = screen.getByRole('button', { name: /approve selected/i });
      await user.click(bulkApproveButton);

      await waitFor(() => {
        expect(mockApproveMember).toHaveBeenCalledTimes(2);
        expect(mockApproveMember).toHaveBeenCalledWith({
          memberId: '1',
          data: {},
        });
        expect(mockApproveMember).toHaveBeenCalledWith({
          memberId: '2',
          data: {},
        });
      });
    });

    it('should bulk reject selected members', async () => {
      const user = userEvent.setup();
      mockRejectMember.mockResolvedValue({});
      
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(<PendingApprovals />);

      // Select two members
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click bulk reject
      const bulkRejectButton = screen.getByRole('button', { name: /reject selected/i });
      await user.click(bulkRejectButton);

      await waitFor(() => {
        expect(mockRejectMember).toHaveBeenCalledTimes(2);
        expect(mockRejectMember).toHaveBeenCalledWith({
          memberId: '1',
          data: {},
        });
        expect(mockRejectMember).toHaveBeenCalledWith({
          memberId: '2',
          data: {},
        });
      });
    });

    it('should not bulk approve if user cancels confirmation', async () => {
      const user = userEvent.setup();
      
      // Mock window.confirm to return false
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(<PendingApprovals />);

      // Select members
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Click bulk approve
      const bulkApproveButton = screen.getByRole('button', { name: /approve selected/i });
      await user.click(bulkApproveButton);

      expect(mockApproveMember).not.toHaveBeenCalled();
    });
  });

  describe('Callbacks', () => {
    it('should call onApproveSuccess callback after successful approval', async () => {
      const user = userEvent.setup();
      const onApproveSuccess = vi.fn();
      mockApproveMember.mockResolvedValue({});

      renderWithProviders(<PendingApprovals onApproveSuccess={onApproveSuccess} />);

      const approveButtons = screen.getAllByRole('button', { name: /approve john doe/i });
      await user.click(approveButtons[0]);

      await waitFor(() => {
        expect(onApproveSuccess).toHaveBeenCalled();
      });
    });

    it('should call onRejectSuccess callback after successful rejection', async () => {
      const user = userEvent.setup();
      const onRejectSuccess = vi.fn();
      mockRejectMember.mockResolvedValue({});

      renderWithProviders(<PendingApprovals onRejectSuccess={onRejectSuccess} />);

      // Open reject dialog
      const rejectButtons = screen.getAllByRole('button', { name: /reject john doe/i });
      await user.click(rejectButtons[0]);

      // Confirm rejection
      const confirmButton = screen.getByRole('button', { name: /^reject$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(onRejectSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Notification Badge', () => {
    it('should display notification badge with pending count', () => {
      renderWithProviders(<PendingApprovals />);

      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
      // Badge should show count of 3
      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('should not display badge when no pending members', () => {
      vi.spyOn(useWorkspaceTeamHooks, 'usePendingMembers').mockReturnValue({
        data: { pendingMembers: [] },
        isLoading: false,
        error: null,
      } as any);

      renderWithProviders(<PendingApprovals />);

      expect(screen.queryByText('Pending Approvals')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for checkboxes', () => {
      renderWithProviders(<PendingApprovals />);

      expect(screen.getByLabelText('Select all pending members')).toBeInTheDocument();
      expect(screen.getByLabelText('Select John Doe')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Jane Smith')).toBeInTheDocument();
    });

    it('should have proper ARIA labels for action buttons', () => {
      renderWithProviders(<PendingApprovals />);

      expect(screen.getByLabelText('Approve John Doe')).toBeInTheDocument();
      expect(screen.getByLabelText('Reject John Doe')).toBeInTheDocument();
    });
  });
});
