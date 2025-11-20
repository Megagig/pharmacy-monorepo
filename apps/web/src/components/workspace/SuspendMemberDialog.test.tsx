/**
 * Tests for SuspendMemberDialog Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SuspendMemberDialog from './SuspendMemberDialog';
import type { Member } from '../../types/workspace';
import * as useWorkspaceTeamHooks from '../../queries/useWorkspaceTeam';

// Mock the useWorkspaceTeam hooks
vi.mock('../../queries/useWorkspaceTeam', () => ({
  useSuspendMember: vi.fn(),
}));

// Test data
const mockMember: Member = {
  _id: 'member-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  workplaceRole: 'Pharmacist',
  status: 'active',
  joinedAt: new Date('2024-01-01'),
  permissions: ['read:patients', 'write:prescriptions'],
};

describe('SuspendMemberDialog', () => {
  let queryClient: QueryClient;
  let mockMutateAsync: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    mockMutateAsync = vi.fn();
    mockOnClose = vi.fn();
    mockOnSuccess = vi.fn();

    // Mock the useSuspendMember hook
    vi.mocked(useWorkspaceTeamHooks.useSuspendMember).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      mutate: vi.fn(),
      reset: vi.fn(),
      status: 'idle',
      variables: undefined,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as any);
  });

  const renderDialog = (props: Partial<React.ComponentProps<typeof SuspendMemberDialog>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SuspendMemberDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
          onSuccess={mockOnSuccess}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render the dialog when open', () => {
      renderDialog();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Suspend Member' })).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderDialog({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not render when member is null', () => {
      renderDialog({ member: null });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display member information', () => {
      renderDialog();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Pharmacist/)).toBeInTheDocument();
    });

    it('should display warning message', () => {
      renderDialog();

      expect(screen.getByText(/This action will immediately revoke access/)).toBeInTheDocument();
      expect(screen.getByText(/unable to access the workspace until reactivated/)).toBeInTheDocument();
    });

    it('should display required reason field', () => {
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      expect(reasonField).toBeInTheDocument();
      expect(reasonField).toHaveAttribute('required');
    });

    it('should display character count', () => {
      renderDialog();

      expect(screen.getByText(/0\/500 characters \(minimum 10 required\)/)).toBeInTheDocument();
    });

    it('should display action buttons', () => {
      renderDialog();

      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Suspend Member/ })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable suspend button when reason is empty', () => {
      renderDialog();

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      expect(suspendButton).toBeDisabled();
    });

    it('should enable suspend button when reason is provided', async () => {
      const user = userEvent.setup();
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      expect(suspendButton).toBeEnabled();
    });

    it('should show error when reason is too short', async () => {
      const user = userEvent.setup();
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Short');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(screen.getByText(/Reason must be at least 10 characters long/)).toBeInTheDocument();
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Test reason');

      expect(screen.getByText(/11\/500 characters/)).toBeInTheDocument();
    });

    it('should enforce maximum character limit', () => {
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/) as HTMLTextAreaElement;
      
      // TextField has maxLength attribute which prevents typing beyond limit
      expect(reasonField).toHaveAttribute('maxlength', '500');
    });

    it('should clear validation error when user starts typing', async () => {
      const user = userEvent.setup();
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      
      // Type short text to trigger validation error
      await user.type(reasonField, 'aa');
      
      // Trigger validation error by clicking suspend
      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(screen.getByText(/Reason must be at least 10 characters long/)).toBeInTheDocument();
      });

      // Start typing more
      await user.type(reasonField, 'New reason text');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/Reason must be at least 10 characters long/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call suspend mutation with correct data', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason for testing');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          memberId: 'member-123',
          data: {
            reason: 'Valid suspension reason for testing',
          },
        });
      });
    });

    it('should trim whitespace from reason', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, '  Valid suspension reason  ');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          memberId: 'member-123',
          data: {
            reason: 'Valid suspension reason',
          },
        });
      });
    });

    it('should call onSuccess callback after successful suspension', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should close dialog after successful suspension', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should display error message on suspension failure', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Network error'));
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Network error/);
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should display generic error message for unknown errors', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue('Unknown error');
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Valid suspension reason');

      const suspendButton = screen.getByRole('button', { name: /Suspend Member/ });
      await user.click(suspendButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Failed to suspend member. Please try again./);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during suspension', async () => {
      const user = userEvent.setup();
      
      // Mock pending state
      vi.mocked(useWorkspaceTeamHooks.useSuspendMember).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn(),
        status: 'pending',
        variables: undefined,
        context: undefined,
        failureCount: 0,
        failureReason: null,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderDialog();

      expect(screen.getByRole('button', { name: /Suspending.../ })).toBeInTheDocument();
    });

    it('should disable all inputs during suspension', () => {
      vi.mocked(useWorkspaceTeamHooks.useSuspendMember).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn(),
        status: 'pending',
        variables: undefined,
        context: undefined,
        failureCount: 0,
        failureReason: null,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      const suspendButton = screen.getByRole('button', { name: /Suspending.../ });

      expect(reasonField).toBeDisabled();
      expect(cancelButton).toBeDisabled();
      expect(suspendButton).toBeDisabled();
    });
  });

  describe('Dialog Interactions', () => {
    it('should close dialog when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderDialog();

      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is closed and reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = renderDialog();

      // Type in reason
      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      await user.type(reasonField, 'Test reason');

      // Close dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <SuspendMemberDialog
            open={false}
            onClose={mockOnClose}
            member={mockMember}
            onSuccess={mockOnSuccess}
          />
        </QueryClientProvider>
      );

      // Reopen dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <SuspendMemberDialog
            open={true}
            onClose={mockOnClose}
            member={mockMember}
            onSuccess={mockOnSuccess}
          />
        </QueryClientProvider>
      );

      // Form should be reset
      const reopenedReasonField = screen.getByLabelText(/Reason for Suspension/) as HTMLTextAreaElement;
      expect(reopenedReasonField.value).toBe('');
    });

    it('should not close dialog during suspension', () => {
      vi.mocked(useWorkspaceTeamHooks.useSuspendMember).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn(),
        status: 'pending',
        variables: undefined,
        context: undefined,
        failureCount: 0,
        failureReason: null,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderDialog();

      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      
      // Button should be disabled during loading, preventing clicks
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderDialog();

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'suspend-member-dialog-title');
      
      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      expect(reasonField).toHaveAttribute('aria-label', 'Reason for suspension');
      expect(reasonField).toHaveAttribute('aria-required', 'true');
    });

    it('should focus reason field on open', () => {
      renderDialog();

      const reasonField = screen.getByLabelText(/Reason for Suspension/);
      expect(reasonField).toHaveFocus();
    });
  });
});
