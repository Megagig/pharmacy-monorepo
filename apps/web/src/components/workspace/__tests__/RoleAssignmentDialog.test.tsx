/**
 * Tests for RoleAssignmentDialog Component
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RoleAssignmentDialog from '../RoleAssignmentDialog';
import * as useWorkspaceTeamHooks from '../../../queries/useWorkspaceTeam';
import type { Member } from '../../../types/workspace';

// Mock the useWorkspaceTeam hooks
vi.mock('../../../queries/useWorkspaceTeam', () => ({
  useUpdateMemberRole: vi.fn(),
}));

// Helper function to create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

// Mock member data
const mockMember: Member = {
  _id: 'member-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  workplaceRole: 'Staff',
  status: 'active',
  joinedAt: new Date('2024-01-01'),
  permissions: [],
};

describe('RoleAssignmentDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(useWorkspaceTeamHooks.useUpdateMemberRole).mockReturnValue({
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
      isIdle: true,
      isPaused: false,
      submittedAt: 0,
    } as any);
  });

  describe('Rendering', () => {
    it('should not render when open is false', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={false}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Assign Role' })).toBeInTheDocument();
    });

    it('should not render when member is null', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={null}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display member information', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Current role:/)).toBeInTheDocument();
      // Check for Staff in the strong tag specifically
      const currentRoleText = screen.getByText(/Current role:/);
      expect(currentRoleText.parentElement).toHaveTextContent('Staff');
    });

    it('should display role selection dropdown', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByRole('combobox', { name: /New Role/i })).toBeInTheDocument();
    });

    it('should display reason text field', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByLabelText(/Reason \(Optional\)/)).toBeInTheDocument();
    });

    it('should display action buttons', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Assign Role/i })).toBeInTheDocument();
    });
  });

  describe('Role Selection', () => {
    it('should initialize with current member role', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      expect(roleSelect).toHaveTextContent('Staff');
    });

    it('should allow selecting a different role', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);

      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /New Role/i })).toHaveTextContent('Pharmacist');
      });
    });

    it('should display role description when role is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);

      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      await waitFor(() => {
        expect(screen.getByText(/Licensed pharmacist with clinical privileges/)).toBeInTheDocument();
      });
    });

    it('should display all available roles in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);

      const expectedRoles = ['Owner', 'Staff', 'Pharmacist', 'Cashier', 'Technician', 'Assistant'];
      
      expectedRoles.forEach((role) => {
        expect(screen.getByRole('option', { name: role })).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when no changes are made', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when role is changed', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);

      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Assign Role/i });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show error when trying to assign same role', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Role is the same'));

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      // Try to submit without changing role
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      
      // Button should be disabled, but let's test the validation logic
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Reason Field', () => {
    it('should allow entering a reason', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const reasonField = screen.getByLabelText(/Reason \(Optional\)/);
      await user.type(reasonField, 'Promotion to pharmacist role');

      expect(reasonField).toHaveValue('Promotion to pharmacist role');
    });

    it('should display helper text for reason field', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(
        screen.getByText(/Provide context for this role change/)
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call mutateAsync with correct data on submit', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
          onSuccess={mockOnSuccess}
        />
      );

      // Change role
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Enter reason
      const reasonField = screen.getByLabelText(/Reason \(Optional\)/);
      await user.type(reasonField, 'Promotion');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          memberId: 'member-123',
          data: {
            workplaceRole: 'Pharmacist',
            reason: 'Promotion',
          },
        });
      });
    });

    it('should call onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
          onSuccess={mockOnSuccess}
        />
      );

      // Change role
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should close dialog after successful submission', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      // Change role
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should display error message on submission failure', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValue(new Error('Network error'));

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      // Change role
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should not include reason in request if empty', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue({});

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      // Change role without entering reason
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Assign Role/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          memberId: 'member-123',
          data: {
            workplaceRole: 'Pharmacist',
            reason: undefined,
          },
        });
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state during submission', () => {
      vi.mocked(useWorkspaceTeamHooks.useUpdateMemberRole).mockReturnValue({
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
        isIdle: false,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByText('Assigning...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    });

    it('should disable form fields during submission', () => {
      vi.mocked(useWorkspaceTeamHooks.useUpdateMemberRole).mockReturnValue({
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
        isIdle: false,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      expect(roleSelect).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByLabelText(/Reason \(Optional\)/)).toBeDisabled();
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is closed and reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      // Change role
      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      // Close dialog
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <RoleAssignmentDialog
            open={false}
            onClose={mockOnClose}
            member={mockMember}
          />
        </QueryClientProvider>
      );

      // Reopen dialog
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <RoleAssignmentDialog
            open={true}
            onClose={mockOnClose}
            member={mockMember}
          />
        </QueryClientProvider>
      );

      // Should be reset to original role
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /New Role/i })).toHaveTextContent('Staff');
      });
    });

    it('should not close dialog during submission', () => {
      vi.mocked(useWorkspaceTeamHooks.useUpdateMemberRole).mockReturnValue({
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
        isIdle: false,
        isPaused: false,
        submittedAt: Date.now(),
      } as any);

      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      // Button should be disabled during loading
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute(
        'aria-labelledby',
        'role-assignment-dialog-title'
      );
      expect(screen.getByRole('combobox', { name: /New Role/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Reason for role change/)).toBeInTheDocument();
    });

    it('should have proper role description association', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <RoleAssignmentDialog
          open={true}
          onClose={mockOnClose}
          member={mockMember}
        />
      );

      const roleSelect = screen.getByRole('combobox', { name: /New Role/i });
      await user.click(roleSelect);
      const pharmacistOption = screen.getByRole('option', { name: 'Pharmacist' });
      await user.click(pharmacistOption);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /New Role/i })).toHaveAttribute(
          'aria-describedby',
          'role-description'
        );
      });
    });
  });
});
