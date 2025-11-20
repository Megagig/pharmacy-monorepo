/**
 * SuspendMemberDialog Component
 * Modal dialog for suspending workspace members
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useSuspendMember } from '../../queries/useWorkspaceTeam';
import type { Member } from '../../types/workspace';

export interface SuspendMemberDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** The member to be suspended */
  member: Member | null;
  /** Callback when suspension is successful */
  onSuccess?: () => void;
}

/**
 * SuspendMemberDialog component
 * Provides a modal dialog for suspending workspace members with required reason
 */
const SuspendMemberDialog: React.FC<SuspendMemberDialogProps> = ({
  open,
  onClose,
  member,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const suspendMutation = useSuspendMember();

  // Reset form when dialog opens with a new member
  useEffect(() => {
    if (open && member) {
      setReason('');
      setValidationError('');
    }
  }, [open, member]);

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setValidationError('Suspension reason is required');
      return false;
    }

    if (trimmedReason.length < 10) {
      setValidationError('Reason must be at least 10 characters long');
      return false;
    }

    if (trimmedReason.length > 500) {
      setValidationError('Reason must not exceed 500 characters');
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
      await suspendMutation.mutateAsync({
        memberId: member._id,
        data: {
          reason: reason.trim(),
        },
      });

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Failed to suspend member:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Failed to suspend member. Please try again.'
      );
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!suspendMutation.isPending) {
      setReason('');
      setValidationError('');
      onClose();
    }
  };

  /**
   * Handle reason input change
   */
  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  if (!member) {
    return null;
  }

  const isLoading = suspendMutation.isPending;
  const characterCount = reason.length;
  const maxCharacters = 500;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="suspend-member-dialog-title"
    >
      <DialogTitle id="suspend-member-dialog-title">
        Suspend Member
      </DialogTitle>

      <DialogContent>
        {/* Warning Message */}
        <Alert 
          severity="warning" 
          icon={<WarningAmberIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" fontWeight="medium" gutterBottom>
            This action will immediately revoke access
          </Typography>
          <Typography variant="body2">
            The member will be unable to access the workspace until reactivated.
            They will receive an email notification about the suspension.
          </Typography>
        </Alert>

        {/* Member Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Suspending member:
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {member.firstName} {member.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {member.email}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Role: <strong>{member.workplaceRole}</strong>
          </Typography>
        </Box>

        {/* Reason Field (Required) */}
        <TextField
          fullWidth
          required
          label="Reason for Suspension"
          placeholder="Enter a detailed reason for suspending this member..."
          multiline
          rows={4}
          value={reason}
          onChange={handleReasonChange}
          disabled={isLoading}
          error={!!validationError}
          helperText={
            validationError || 
            `${characterCount}/${maxCharacters} characters (minimum 10 required)`
          }
          inputProps={{
            maxLength: maxCharacters,
            'aria-label': 'Reason for suspension',
            'aria-required': 'true',
          }}
          autoFocus
        />

        {/* Additional Validation Error */}
        {validationError && !validationError.includes('characters') && (
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
          color="error"
          disabled={isLoading || !reason.trim()}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isLoading ? 'Suspending...' : 'Suspend Member'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SuspendMemberDialog;
