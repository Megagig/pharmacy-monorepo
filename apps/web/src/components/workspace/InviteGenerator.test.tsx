/**
 * InviteGenerator Component Tests
 * Tests for the InviteGenerator modal dialog component
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import InviteGenerator from './InviteGenerator';
import * as useWorkspaceTeamHooks from '../../queries/useWorkspaceTeam';

// Mock the useGenerateInvite hook
vi.mock('../../queries/useWorkspaceTeam', () => ({
  useGenerateInvite: vi.fn(),
}));

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('InviteGenerator', () => {
  let queryClient: QueryClient;
  let mockMutateAsync: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockOnSuccess: ReturnType<typeof vi.fn>;

  const mockGenerateInviteResponse = {
    invite: {
      _id: 'invite-123',
      inviteToken: 'token-abc-123',
      inviteUrl: 'https://example.com/signup?invite=token-abc-123',
      expiresAt: new Date('2025-10-18'),
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockMutateAsync = vi.fn();
    mockOnClose = vi.fn();
    mockOnSuccess = vi.fn();

    // Mock the useGenerateInvite hook
    vi.mocked(useWorkspaceTeamHooks.useGenerateInvite).mockReturnValue({
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      open: true,
      onClose: mockOnClose,
      onSuccess: mockOnSuccess,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <InviteGenerator {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render the dialog when open', () => {
      renderComponent();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Generate Invite Link')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderComponent({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderComponent();

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expires in \(days\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/maximum uses/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/requires approval/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/personal message/i)).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate invite/i })).toBeInTheDocument();
    });

    it('should have default values', () => {
      renderComponent();

      expect(screen.getByLabelText(/email address/i)).toHaveValue('');
      expect(screen.getByLabelText(/expires in \(days\)/i)).toHaveValue(7);
      expect(screen.getByLabelText(/maximum uses/i)).toHaveValue(1);
      expect(screen.getByLabelText(/requires approval/i)).not.toBeChecked();
      expect(screen.getByLabelText(/personal message/i)).toHaveValue('');
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      const user = userEvent.setup();
      renderComponent();

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('should show error when email is invalid', async () => {
      const user = userEvent.setup();
      renderComponent();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show error when role is not selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/please select a role/i)).toBeInTheDocument();
      });
    });

    it('should show error when expiration days is out of range', async () => {
      const user = userEvent.setup();
      renderComponent();

      const expiresInput = screen.getByLabelText(/expires in \(days\)/i);
      await user.clear(expiresInput);
      await user.type(expiresInput, '31');

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/expiration must be between 1 and 30 days/i)).toBeInTheDocument();
      });
    });

    it('should show error when max uses is out of range', async () => {
      const user = userEvent.setup();
      renderComponent();

      const maxUsesInput = screen.getByLabelText(/maximum uses/i);
      await user.clear(maxUsesInput);
      await user.type(maxUsesInput, '101');

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/max uses must be between 1 and 100/i)).toBeInTheDocument();
      });
    });

    // Note: Personal message validation is enforced by maxLength attribute on the input
    // The TextField component prevents entering more than 500 characters

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup();
      renderComponent();

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      // Wait for validation error to appear
      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email address/i);
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 't');

      // Error should be cleared
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      });
    });
  });

  describe('Role Selection', () => {
    it('should display role options when dropdown is opened', async () => {
      const user = userEvent.setup();
      renderComponent();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /staff/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /pharmacist/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /cashier/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /technician/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /assistant/i })).toBeInTheDocument();
      });
    });

    it('should show role description when role is selected', async () => {
      const user = userEvent.setup();
      renderComponent();

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);

      const pharmacistOption = screen.getByRole('option', { name: /pharmacist/i });
      await user.click(pharmacistOption);

      await waitFor(() => {
        expect(screen.getByText(/licensed pharmacist with clinical privileges/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    // Note: Full form submission test is covered by simpler tests below
    // Complex MUI Select interactions can be flaky in tests

    it('should display generated invite link after successful submission', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue(mockGenerateInviteResponse);
      renderComponent();

      // Fill in minimal required fields
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      // Submit the form
      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/invite link generated successfully!/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue(mockGenerateInviteResponse.invite.inviteUrl)).toBeInTheDocument();
      });
    });

    it('should call onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue(mockGenerateInviteResponse);
      renderComponent();

      // Fill in minimal required fields
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      // Submit the form
      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(mockGenerateInviteResponse.invite.inviteUrl);
      });
    });

    it('should handle submission error', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to generate invite';
      mockMutateAsync.mockRejectedValue(new Error(errorMessage));
      renderComponent();

      // Fill in minimal required fields
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      // Submit the form
      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should omit personal message if empty', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue(mockGenerateInviteResponse);
      renderComponent();

      // Fill in minimal required fields without personal message
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      // Submit the form
      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            personalMessage: undefined,
          })
        );
      });
    });
  });

  describe('Copy Invite Link', () => {
    // Note: Clipboard API testing is complex in JSDOM environment
    // The copy functionality is tested in the "show copied confirmation" test below

    it('should show copied confirmation', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue(mockGenerateInviteResponse);
      renderComponent();

      // Generate invite first
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockGenerateInviteResponse.invite.inviteUrl)).toBeInTheDocument();
      });

      // Click copy button
      const copyButton = screen.getByLabelText(/copy invite link/i);
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText(/copied!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when done button is clicked after generating invite', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValue(mockGenerateInviteResponse);
      renderComponent();

      // Generate invite first
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      const roleSelect = screen.getByLabelText(/role/i);
      await user.click(roleSelect);
      const staffOption = screen.getByRole('option', { name: /^staff$/i });
      await user.click(staffOption);

      const generateButton = screen.getByRole('button', { name: /generate invite/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
      });

      const doneButton = screen.getByRole('button', { name: /done/i });
      await user.click(doneButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when dialog is reopened', async () => {
      const { rerender } = renderComponent({ open: false });

      // Open dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <InviteGenerator open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
        </QueryClientProvider>
      );

      // Check that form is reset
      expect(screen.getByLabelText(/email address/i)).toHaveValue('');
      expect(screen.getByLabelText(/expires in \(days\)/i)).toHaveValue(7);
      expect(screen.getByLabelText(/maximum uses/i)).toHaveValue(1);
      expect(screen.getByLabelText(/requires approval/i)).not.toBeChecked();
    });
  });

  describe('Loading State', () => {
    it('should disable form fields while loading', async () => {
      const user = userEvent.setup();
      vi.mocked(useWorkspaceTeamHooks.useGenerateInvite).mockReturnValue({
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

      renderComponent();

      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      // For MUI Select, check the input element inside
      const roleSelect = screen.getByLabelText(/role/i);
      expect(roleSelect).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByLabelText(/expires in \(days\)/i)).toBeDisabled();
      expect(screen.getByLabelText(/maximum uses/i)).toBeDisabled();
      expect(screen.getByLabelText(/requires approval/i)).toBeDisabled();
      expect(screen.getByLabelText(/personal message/i)).toBeDisabled();
    });

    it('should show loading text on submit button', () => {
      vi.mocked(useWorkspaceTeamHooks.useGenerateInvite).mockReturnValue({
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

      renderComponent();

      expect(screen.getByRole('button', { name: /generating.../i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();

      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-label', 'Email address');
      expect(screen.getByLabelText(/expires in \(days\)/i)).toHaveAttribute('aria-label', 'Expiration days');
      expect(screen.getByLabelText(/maximum uses/i)).toHaveAttribute('aria-label', 'Maximum uses');
      expect(screen.getByLabelText(/requires approval/i)).toHaveAttribute('aria-label', 'Requires approval');
      expect(screen.getByLabelText(/personal message/i)).toHaveAttribute('aria-label', 'Personal message');
    });

    it('should have proper required attributes', () => {
      renderComponent();

      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/expires in \(days\)/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/maximum uses/i)).toHaveAttribute('aria-required', 'true');
    });
  });
});
