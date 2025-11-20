/**
 * RoleAssignmentDialog Component
 * Modal dialog for assigning roles to workspace members
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useUpdateMemberRole } from '../../queries/useWorkspaceTeam';
import type { Member, WorkplaceRole } from '../../types/workspace';

export interface RoleAssignmentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** The member whose role is being assigned */
  member: Member | null;
  /** Callback when role assignment is successful */
  onSuccess?: () => void;
}

// Available workplace roles
const WORKPLACE_ROLES: WorkplaceRole[] = [
  'Owner',
  'Staff',
  'Pharmacist',
  'Cashier',
  'Technician',
  'Assistant',
];

// Role descriptions for better UX
const ROLE_DESCRIPTIONS: Record<WorkplaceRole, string> = {
  Owner: 'Full access to all workspace features and settings',
  Staff: 'General staff member with standard access',
  Pharmacist: 'Licensed pharmacist with clinical privileges',
  Cashier: 'Point of sale and billing access',
  Technician: 'Pharmacy technician with inventory access',
  Assistant: 'Limited access for pharmacy assistants',
};

/**
 * RoleAssignmentDialog component
 * Provides a modal dialog for assigning roles to workspace members
 */
const RoleAssignmentDialog: React.FC<RoleAssignmentDialogProps> = ({
  open,
  onClose,
  member,
  onSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState<WorkplaceRole | ''>('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const updateRoleMutation = useUpdateMemberRole();

  // Reset form when dialog opens with a new member
  useEffect(() => {
    if (open && member) {
      setSelectedRole(member.workplaceRole);
      setReason('');
      setValidationError('');
    }
  }, [open, member]);

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    if (!selectedRole) {
      setValidationError('Please select a role');
      return false;
    }

    if (selectedRole === member?.workplaceRole) {
      setValidationError('Please select a different role than the current one');
      return false;
    }

    setValidationError('');
    return true;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!member || !validateForm()) {
      return;
    }

    try {
      await updateRoleMutation.mutateAsync({
        memberId: member._id,
        data: {
          workplaceRole: selectedRole as WorkplaceRole,
          reason: reason.trim() || undefined,
        },
      });

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Failed to update member role:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Failed to update role. Please try again.'
      );
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!updateRoleMutation.isPending) {
      setSelectedRole('');
      setReason('');
      setValidationError('');
      onClose();
    }
  };

  /**
   * Handle role selection change
   */
  const handleRoleChange = (role: WorkplaceRole) => {
    setSelectedRole(role);
    setValidationError('');
  };

  if (!member) {
    return null;
  }

  const isLoading = updateRoleMutation.isPending;
  const hasChanges = selectedRole !== member.workplaceRole;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="role-assignment-dialog-title"
    >
      <DialogTitle id="role-assignment-dialog-title">
        Assign Role
      </DialogTitle>

      <DialogContent>
        {/* Member Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Assigning role for:
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {member.firstName} {member.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {member.email}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Current role: <strong>{member.workplaceRole}</strong>
          </Typography>
        </Box>

        {/* Role Selection */}
        <FormControl fullWidth sx={{ mb: 3 }} required>
          <InputLabel id="role-select-label">New Role</InputLabel>
          <Select
            labelId="role-select-label"
            id="role-select"
            value={selectedRole}
            label="New Role"
            onChange={(e) => handleRoleChange(e.target.value as WorkplaceRole)}
            disabled={isLoading}
            aria-describedby="role-description"
          >
            {WORKPLACE_ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Role Description */}
        {selectedRole && (
          <Alert severity="info" sx={{ mb: 3 }} id="role-description">
            <Typography variant="body2">
              {ROLE_DESCRIPTIONS[selectedRole as WorkplaceRole]}
            </Typography>
          </Alert>
        )}

        {/* Reason Field (Optional) */}
        <TextField
          fullWidth
          label="Reason (Optional)"
          placeholder="Enter reason for role change..."
          multiline
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isLoading}
          helperText="Provide context for this role change (will be logged in audit trail)"
          inputProps={{
            maxLength: 500,
            'aria-label': 'Reason for role change',
          }}
        />

        {/* Validation Error */}
        {validationError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isLoading || !hasChanges}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isLoading ? 'Assigning...' : 'Assign Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleAssignmentDialog;
