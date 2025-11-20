/**
 * MemberActionsMenu Component
 * Dropdown menu with actions for managing workspace members
 */

import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Member } from '../../types/workspace';

export interface MemberActionsMenuProps {
  /** The member for which actions are displayed */
  member: Member;
  /** Anchor element for the menu */
  anchorEl: HTMLElement | null;
  /** Whether the menu is open */
  open: boolean;
  /** Callback when menu is closed */
  onClose: () => void;
  /** Callback when assign role action is clicked */
  onAssignRole?: (member: Member) => void;
  /** Callback when suspend action is clicked */
  onSuspend?: (member: Member) => void;
  /** Callback when activate action is clicked */
  onActivate?: (member: Member) => void;
  /** Callback when remove member action is clicked */
  onRemove?: (member: Member) => void;
  /** Whether an action is currently loading */
  loading?: boolean;
}

/**
 * MemberActionsMenu component
 * Provides a dropdown menu with actions for managing workspace members
 * Actions are conditionally displayed based on member status
 */
const MemberActionsMenu: React.FC<MemberActionsMenuProps> = ({
  member,
  anchorEl,
  open,
  onClose,
  onAssignRole,
  onSuspend,
  onActivate,
  onRemove,
  loading = false,
}) => {
  /**
   * Handle assign role action
   */
  const handleAssignRole = () => {
    onClose();
    if (onAssignRole) {
      onAssignRole(member);
    }
  };

  /**
   * Handle suspend action
   */
  const handleSuspend = () => {
    onClose();
    if (onSuspend) {
      onSuspend(member);
    }
  };

  /**
   * Handle activate action
   */
  const handleActivate = () => {
    onClose();
    if (onActivate) {
      onActivate(member);
    }
  };

  /**
   * Handle remove member action
   */
  const handleRemove = () => {
    onClose();
    if (onRemove) {
      onRemove(member);
    }
  };

  // Determine which actions should be visible based on member status
  const canAssignRole = member.status === 'active';
  const canSuspend = member.status === 'active';
  const canActivate = member.status === 'suspended';
  const canRemove = member.status !== 'pending'; // Can remove active or suspended members

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          minWidth: 200,
          boxShadow: 3,
        },
      }}
    >
      {/* Assign Role Action */}
      {canAssignRole && onAssignRole && (
        <MenuItem
          onClick={handleAssignRole}
          disabled={loading}
          aria-label={`Assign role to ${member.firstName} ${member.lastName}`}
        >
          <ListItemIcon>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <PersonAddIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText primary="Assign Role" />
        </MenuItem>
      )}

      {/* Suspend/Activate Actions */}
      {canSuspend && onSuspend && (
        <MenuItem
          onClick={handleSuspend}
          disabled={loading}
          aria-label={`Suspend ${member.firstName} ${member.lastName}`}
        >
          <ListItemIcon>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <BlockIcon fontSize="small" color="warning" />
            )}
          </ListItemIcon>
          <ListItemText primary="Suspend Member" />
        </MenuItem>
      )}

      {canActivate && onActivate && (
        <MenuItem
          onClick={handleActivate}
          disabled={loading}
          aria-label={`Activate ${member.firstName} ${member.lastName}`}
        >
          <ListItemIcon>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <CheckCircleIcon fontSize="small" color="success" />
            )}
          </ListItemIcon>
          <ListItemText primary="Activate Member" />
        </MenuItem>
      )}

      {/* Divider before destructive action */}
      {canRemove && onRemove && (canAssignRole || canSuspend || canActivate) && (
        <Divider />
      )}

      {/* Remove Member Action */}
      {canRemove && onRemove && (
        <MenuItem
          onClick={handleRemove}
          disabled={loading}
          aria-label={`Remove ${member.firstName} ${member.lastName}`}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            {loading ? (
              <CircularProgress size={20} color="error" />
            ) : (
              <DeleteIcon fontSize="small" color="error" />
            )}
          </ListItemIcon>
          <ListItemText primary="Remove Member" />
        </MenuItem>
      )}
    </Menu>
  );
};

export default MemberActionsMenu;
