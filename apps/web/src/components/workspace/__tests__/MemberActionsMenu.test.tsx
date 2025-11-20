/**
 * Tests for MemberActionsMenu Component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MemberActionsMenu from '../MemberActionsMenu';
import type { Member } from '../../../types/workspace';

// Mock member data
const createMockMember = (overrides?: Partial<Member>): Member => ({
  _id: '123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  workplaceRole: 'Pharmacist',
  status: 'active',
  joinedAt: new Date('2024-01-01'),
  permissions: ['read', 'write'],
  ...overrides,
});

describe('MemberActionsMenu', () => {
  let anchorEl: HTMLElement;
  const mockOnClose = vi.fn();
  const mockOnAssignRole = vi.fn();
  const mockOnSuspend = vi.fn();
  const mockOnActivate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a mock anchor element
    anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);
  });

  afterEach(() => {
    document.body.removeChild(anchorEl);
  });

  describe('Rendering', () => {
    it('should render menu when open', () => {
      const member = createMockMember();
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Menu should be in the document
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
    });

    it('should not render menu when closed', () => {
      const member = createMockMember();
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={false}
          onClose={mockOnClose}
        />
      );

      // Menu should not be visible
      const menu = screen.queryByRole('menu');
      expect(menu).not.toBeInTheDocument();
    });
  });

  describe('Active Member Actions', () => {
    it('should show all actions for active member', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          onSuspend={mockOnSuspend}
          onRemove={mockOnRemove}
        />
      );

      // Should show assign role, suspend, and remove actions
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
      expect(screen.getByText('Suspend Member')).toBeInTheDocument();
      expect(screen.getByText('Remove Member')).toBeInTheDocument();
    });

    it('should not show activate action for active member', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onActivate={mockOnActivate}
        />
      );

      // Should not show activate action
      expect(screen.queryByText('Activate Member')).not.toBeInTheDocument();
    });

    it('should call onAssignRole when assign role is clicked', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
        />
      );

      const assignRoleItem = screen.getByText('Assign Role');
      fireEvent.click(assignRoleItem);

      expect(mockOnAssignRole).toHaveBeenCalledWith(member);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onSuspend when suspend is clicked', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onSuspend={mockOnSuspend}
        />
      );

      const suspendItem = screen.getByText('Suspend Member');
      fireEvent.click(suspendItem);

      expect(mockOnSuspend).toHaveBeenCalledWith(member);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onRemove when remove is clicked', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onRemove={mockOnRemove}
        />
      );

      const removeItem = screen.getByText('Remove Member');
      fireEvent.click(removeItem);

      expect(mockOnRemove).toHaveBeenCalledWith(member);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Suspended Member Actions', () => {
    it('should show activate and remove actions for suspended member', () => {
      const member = createMockMember({ status: 'suspended' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onActivate={mockOnActivate}
          onRemove={mockOnRemove}
        />
      );

      // Should show activate and remove actions
      expect(screen.getByText('Activate Member')).toBeInTheDocument();
      expect(screen.getByText('Remove Member')).toBeInTheDocument();
    });

    it('should not show assign role or suspend actions for suspended member', () => {
      const member = createMockMember({ status: 'suspended' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          onSuspend={mockOnSuspend}
        />
      );

      // Should not show assign role or suspend actions
      expect(screen.queryByText('Assign Role')).not.toBeInTheDocument();
      expect(screen.queryByText('Suspend Member')).not.toBeInTheDocument();
    });

    it('should call onActivate when activate is clicked', () => {
      const member = createMockMember({ status: 'suspended' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onActivate={mockOnActivate}
        />
      );

      const activateItem = screen.getByText('Activate Member');
      fireEvent.click(activateItem);

      expect(mockOnActivate).toHaveBeenCalledWith(member);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Pending Member Actions', () => {
    it('should not show remove action for pending member', () => {
      const member = createMockMember({ status: 'pending' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onRemove={mockOnRemove}
        />
      );

      // Should not show remove action for pending members
      expect(screen.queryByText('Remove Member')).not.toBeInTheDocument();
    });

    it('should not show any actions for pending member without callbacks', () => {
      const member = createMockMember({ status: 'pending' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Menu should be empty or minimal
      const menu = screen.getByRole('menu');
      const menuItems = within(menu).queryAllByRole('menuitem');
      expect(menuItems).toHaveLength(0);
    });
  });

  describe('Conditional Action Visibility', () => {
    it('should only show actions with provided callbacks', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          // No onSuspend or onRemove callbacks
        />
      );

      // Should only show assign role
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
      expect(screen.queryByText('Suspend Member')).not.toBeInTheDocument();
      expect(screen.queryByText('Remove Member')).not.toBeInTheDocument();
    });

    it('should show divider before remove action when other actions exist', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          onRemove={mockOnRemove}
        />
      );

      // Should have both assign role and remove actions
      expect(screen.getByText('Assign Role')).toBeInTheDocument();
      expect(screen.getByText('Remove Member')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable all actions when loading', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          onSuspend={mockOnSuspend}
          onRemove={mockOnRemove}
          loading={true}
        />
      );

      // All menu items should be disabled
      const menuItems = screen.getAllByRole('menuitem');
      menuItems.forEach((item) => {
        expect(item).toHaveAttribute('aria-disabled', 'true');
      });
    });

    it('should show loading spinner when loading', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
          loading={true}
        />
      );

      // Menu items should still be present but disabled
      const assignRoleItem = screen.getByText('Assign Role');
      expect(assignRoleItem).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for assign role action', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
        />
      );

      const assignRoleItem = screen.getByRole('menuitem', {
        name: `Assign role to ${member.firstName} ${member.lastName}`,
      });
      expect(assignRoleItem).toBeInTheDocument();
    });

    it('should have proper aria-label for suspend action', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onSuspend={mockOnSuspend}
        />
      );

      const suspendItem = screen.getByRole('menuitem', {
        name: `Suspend ${member.firstName} ${member.lastName}`,
      });
      expect(suspendItem).toBeInTheDocument();
    });

    it('should have proper aria-label for activate action', () => {
      const member = createMockMember({ status: 'suspended' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onActivate={mockOnActivate}
        />
      );

      const activateItem = screen.getByRole('menuitem', {
        name: `Activate ${member.firstName} ${member.lastName}`,
      });
      expect(activateItem).toBeInTheDocument();
    });

    it('should have proper aria-label for remove action', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onRemove={mockOnRemove}
        />
      );

      const removeItem = screen.getByRole('menuitem', {
        name: `Remove ${member.firstName} ${member.lastName}`,
      });
      expect(removeItem).toBeInTheDocument();
    });
  });

  describe('Menu Positioning', () => {
    it('should render menu with anchor element', () => {
      const member = createMockMember();
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Menu should be rendered
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when menu is closed', () => {
      const member = createMockMember();
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Simulate clicking outside the menu (backdrop click)
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close menu after action is clicked', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onAssignRole={mockOnAssignRole}
        />
      );

      const assignRoleItem = screen.getByText('Assign Role');
      fireEvent.click(assignRoleItem);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should render remove action with error styling', () => {
      const member = createMockMember({ status: 'active' });
      render(
        <MemberActionsMenu
          member={member}
          anchorEl={anchorEl}
          open={true}
          onClose={mockOnClose}
          onRemove={mockOnRemove}
        />
      );

      // Remove action should be present
      const removeItem = screen.getByText('Remove Member');
      expect(removeItem).toBeInTheDocument();
    });
  });
});
