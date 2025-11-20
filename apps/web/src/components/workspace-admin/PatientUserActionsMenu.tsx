/**
 * PatientUserActionsMenu Component
 * Context menu for patient user actions
 */

import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface PatientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  profileComplete: boolean;
}

interface PatientUserActionsMenuProps {
  user: PatientUser;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (user: PatientUser) => void;
  onSuspend?: (user: PatientUser) => void;
  onActivate?: (user: PatientUser) => void;
  onRemove?: (user: PatientUser) => void;
  onViewProfile?: (user: PatientUser) => void;
}

const PatientUserActionsMenu: React.FC<PatientUserActionsMenuProps> = ({
  user,
  anchorEl,
  open,
  onClose,
  onApprove,
  onSuspend,
  onActivate,
  onRemove,
  onViewProfile,
}) => {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

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
    >
      {/* View Profile */}
      {onViewProfile && (
        <MenuItem onClick={() => handleAction(() => onViewProfile(user))}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Profile</ListItemText>
        </MenuItem>
      )}

      {/* Status-specific actions */}
      {user.status === 'pending' && onApprove && (
        <MenuItem onClick={() => handleAction(() => onApprove(user))}>
          <ListItemIcon>
            <CheckCircleIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>Approve User</ListItemText>
        </MenuItem>
      )}

      {user.status === 'active' && onSuspend && (
        <MenuItem onClick={() => handleAction(() => onSuspend(user))}>
          <ListItemIcon>
            <BlockIcon fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText>Suspend User</ListItemText>
        </MenuItem>
      )}

      {user.status === 'suspended' && onActivate && (
        <MenuItem onClick={() => handleAction(() => onActivate(user))}>
          <ListItemIcon>
            <PersonAddIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>Activate User</ListItemText>
        </MenuItem>
      )}

      {/* Divider before destructive actions */}
      {onRemove && (
        <>
          <Divider />
          <MenuItem 
            onClick={() => handleAction(() => onRemove(user))}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Remove User</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
};

export default PatientUserActionsMenu;