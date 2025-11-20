/**
 * RefillRequestActionsMenu Component
 * Context menu for refill request actions
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
import CancelIcon from '@mui/icons-material/Cancel';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';

interface RefillRequest {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  medication: {
    id: string;
    name: string;
    strength: string;
    form: string;
  };
  requestedQuantity: number;
  currentRefillsRemaining: number;
  patientNotes?: string;
  urgency: 'routine' | 'urgent';
  status: 'pending' | 'approved' | 'denied' | 'completed';
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: {
    id: string;
    name: string;
  };
  denialReason?: string;
  estimatedPickupDate?: Date;
  assignedTo?: {
    id: string;
    name: string;
  };
}

interface RefillRequestActionsMenuProps {
  request: RefillRequest;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (request: RefillRequest) => void;
  onDeny?: (request: RefillRequest) => void;
  onAssign?: (request: RefillRequest) => void;
  onViewDetails?: (request: RefillRequest) => void;
  onEdit?: (request: RefillRequest) => void;
}

const RefillRequestActionsMenu: React.FC<RefillRequestActionsMenuProps> = ({
  request,
  anchorEl,
  open,
  onClose,
  onApprove,
  onDeny,
  onAssign,
  onViewDetails,
  onEdit,
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
      {/* View Details */}
      {onViewDetails && (
        <MenuItem onClick={() => handleAction(() => onViewDetails(request))}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
      )}

      {/* Status-specific actions */}
      {request.status === 'pending' && (
        <>
          {onApprove && (
            <MenuItem onClick={() => handleAction(() => onApprove(request))}>
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>Approve Request</ListItemText>
            </MenuItem>
          )}
          
          {onDeny && (
            <MenuItem onClick={() => handleAction(() => onDeny(request))}>
              <ListItemIcon>
                <CancelIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Deny Request</ListItemText>
            </MenuItem>
          )}

          {onAssign && (
            <>
              <Divider />
              <MenuItem onClick={() => handleAction(() => onAssign(request))}>
                <ListItemIcon>
                  <AssignmentIndIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText>Assign to Pharmacist</ListItemText>
              </MenuItem>
            </>
          )}
        </>
      )}

      {/* Edit for approved requests */}
      {request.status === 'approved' && onEdit && (
        <>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onEdit(request))}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Request</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
};

export default RefillRequestActionsMenu;