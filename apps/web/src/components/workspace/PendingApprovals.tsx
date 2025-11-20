/**
 * PendingApprovals Component
 * Displays a table of pending member approvals with approve/reject actions
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  Typography,
  Skeleton,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Badge,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { format } from 'date-fns';
import type { Member } from '../../types/workspace';
import { usePendingMembers, useApproveMember, useRejectMember } from '../../queries/useWorkspaceTeam';

export interface PendingApprovalsProps {
  /** Callback when a member is successfully approved */
  onApproveSuccess?: () => void;
  /** Callback when a member is successfully rejected */
  onRejectSuccess?: () => void;
}

/**
 * Get color for role badge
 */
const getRoleColor = (role: string): 'primary' | 'secondary' | 'info' | 'default' => {
  switch (role) {
    case 'Owner':
      return 'primary';
    case 'Pharmacist':
      return 'info';
    case 'Staff':
      return 'secondary';
    default:
      return 'default';
  }
};

/**
 * Format date for display
 */
const formatDate = (date: Date | string): string => {
  try {
    return format(new Date(date), 'MMM dd, yyyy HH:mm');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Get initials from name for avatar
 */
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

/**
 * Loading skeleton for table rows
 */
const TableRowSkeleton: React.FC = () => (
  <TableRow>
    <TableCell padding="checkbox">
      <Skeleton variant="rectangular" width={18} height={18} />
    </TableCell>
    <TableCell>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box>
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={180} />
        </Box>
      </Box>
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={80} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={120} />
    </TableCell>
    <TableCell align="right">
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Skeleton variant="rounded" width={80} height={32} />
        <Skeleton variant="rounded" width={80} height={32} />
      </Box>
    </TableCell>
  </TableRow>
);

/**
 * Rejection reason dialog component
 */
interface RejectDialogProps {
  open: boolean;
  memberName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

const RejectDialog: React.FC<RejectDialogProps> = ({
  open,
  memberName,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reject Member Request</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          You are about to reject the membership request from <strong>{memberName}</strong>.
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="Rejection Reason (Optional)"
          fullWidth
          multiline
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a reason for rejection..."
          helperText="This reason will be included in the rejection email"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={isLoading}
        >
          {isLoading ? 'Rejecting...' : 'Reject'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * PendingApprovals component
 * Displays all pending member approvals in a table format
 */
const PendingApprovals: React.FC<PendingApprovalsProps> = ({
  onApproveSuccess,
  onRejectSuccess,
}) => {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [memberToReject, setMemberToReject] = useState<Member | null>(null);

  // Fetch pending members data
  const { data, isLoading, error } = usePendingMembers();

  // Approve and reject mutations
  const approveMemberMutation = useApproveMember();
  const rejectMemberMutation = useRejectMember();

  /**
   * Handle select all checkbox
   */
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && data?.pendingMembers) {
      setSelectedMembers(new Set(data.pendingMembers.map((m) => m._id)));
    } else {
      setSelectedMembers(new Set());
    }
  };

  /**
   * Handle individual member selection
   */
  const handleSelectMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  /**
   * Handle approve single member
   */
  const handleApproveMember = async (member: Member) => {
    try {
      await approveMemberMutation.mutateAsync({
        memberId: member._id,
        data: {},
      });
      if (onApproveSuccess) {
        onApproveSuccess();
      }
    } catch (error) {
      console.error('Failed to approve member:', error);
    }
  };

  /**
   * Handle reject single member - open dialog
   */
  const handleRejectMemberClick = (member: Member) => {
    setMemberToReject(member);
    setRejectDialogOpen(true);
  };

  /**
   * Handle reject confirmation from dialog
   */
  const handleRejectConfirm = async (reason: string) => {
    if (!memberToReject) return;

    try {
      await rejectMemberMutation.mutateAsync({
        memberId: memberToReject._id,
        data: reason ? { reason } : {},
      });
      setRejectDialogOpen(false);
      setMemberToReject(null);
      if (onRejectSuccess) {
        onRejectSuccess();
      }
    } catch (error) {
      console.error('Failed to reject member:', error);
    }
  };

  /**
   * Handle bulk approve
   */
  const handleBulkApprove = async () => {
    if (selectedMembers.size === 0) return;

    if (!window.confirm(`Are you sure you want to approve ${selectedMembers.size} member(s)?`)) {
      return;
    }

    try {
      const approvePromises = Array.from(selectedMembers).map((memberId) =>
        approveMemberMutation.mutateAsync({
          memberId,
          data: {},
        })
      );

      await Promise.all(approvePromises);
      setSelectedMembers(new Set());
      if (onApproveSuccess) {
        onApproveSuccess();
      }
    } catch (error) {
      console.error('Failed to bulk approve members:', error);
    }
  };

  /**
   * Handle bulk reject
   */
  const handleBulkReject = async () => {
    if (selectedMembers.size === 0) return;

    if (!window.confirm(`Are you sure you want to reject ${selectedMembers.size} member(s)?`)) {
      return;
    }

    try {
      const rejectPromises = Array.from(selectedMembers).map((memberId) =>
        rejectMemberMutation.mutateAsync({
          memberId,
          data: {},
        })
      );

      await Promise.all(rejectPromises);
      setSelectedMembers(new Set());
      if (onRejectSuccess) {
        onRejectSuccess();
      }
    } catch (error) {
      console.error('Failed to bulk reject members:', error);
    }
  };

  const pendingMembers = data?.pendingMembers || [];
  const isAllSelected = pendingMembers.length > 0 && selectedMembers.size === pendingMembers.length;
  const isSomeSelected = selectedMembers.size > 0 && selectedMembers.size < pendingMembers.length;

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load pending approvals
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  // Empty state
  if (!isLoading && pendingMembers.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No pending approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All member requests have been processed. New requests will appear here.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Bulk Actions Bar */}
      {selectedMembers.size > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
          }}
        >
          <Typography variant="body1" fontWeight={500}>
            {selectedMembers.size} member(s) selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={handleBulkApprove}
              disabled={approveMemberMutation.isPending}
            >
              Approve Selected
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleBulkReject}
              disabled={rejectMemberMutation.isPending}
            >
              Reject Selected
            </Button>
          </Box>
        </Paper>
      )}

      {/* Pending Members Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={isSomeSelected}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  disabled={isLoading || pendingMembers.length === 0}
                  inputProps={{ 'aria-label': 'Select all pending members' }}
                />
              </TableCell>
              <TableCell>Member</TableCell>
              <TableCell>Requested Role</TableCell>
              <TableCell>Join Request Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              <>
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </>
            ) : (
              // Actual data
              pendingMembers.map((member) => {
                const isSelected = selectedMembers.has(member._id);

                return (
                  <TableRow
                    key={member._id}
                    hover
                    selected={isSelected}
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    }}
                  >
                    {/* Checkbox */}
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectMember(member._id)}
                        inputProps={{
                          'aria-label': `Select ${member.firstName} ${member.lastName}`,
                        }}
                      />
                    </TableCell>

                    {/* Member Info */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'warning.main',
                            fontSize: '0.875rem',
                          }}
                        >
                          {getInitials(member.firstName, member.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {member.firstName} {member.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {member.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Requested Role */}
                    <TableCell>
                      <Chip
                        label={member.workplaceRole}
                        color={getRoleColor(member.workplaceRole)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>

                    {/* Join Request Date */}
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(member.joinedAt)}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Tooltip title="Approve member">
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleApproveMember(member)}
                              disabled={approveMemberMutation.isPending}
                              aria-label={`Approve ${member.firstName} ${member.lastName}`}
                            >
                              Approve
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reject member">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleRejectMemberClick(member)}
                              disabled={rejectMemberMutation.isPending}
                              aria-label={`Reject ${member.firstName} ${member.lastName}`}
                            >
                              Reject
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Notification Badge Count (for parent component) */}
      {!isLoading && pendingMembers.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={pendingMembers.length} color="warning" max={99}>
            <Typography variant="body2" color="text.secondary">
              Pending Approvals
            </Typography>
          </Badge>
        </Box>
      )}

      {/* Reject Dialog */}
      {memberToReject && (
        <RejectDialog
          open={rejectDialogOpen}
          memberName={`${memberToReject.firstName} ${memberToReject.lastName}`}
          onClose={() => {
            setRejectDialogOpen(false);
            setMemberToReject(null);
          }}
          onConfirm={handleRejectConfirm}
          isLoading={rejectMemberMutation.isPending}
        />
      )}
    </Box>
  );
};

export default PendingApprovals;
