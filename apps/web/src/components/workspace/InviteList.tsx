/**
 * InviteList Component
 * Displays a table of workspace invites with status, expiration, and usage statistics
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
  TablePagination,
  Chip,
  Typography,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { format, isPast } from 'date-fns';
import type { WorkspaceInvite, InviteFilters, InviteStatus } from '../../types/workspace';
import { useWorkspaceInvites, useRevokeInvite } from '../../queries/useWorkspaceTeam';

export interface InviteListProps {
  /** Optional filters to apply to the invite list */
  filters?: InviteFilters;
  /** Callback when an invite is successfully revoked */
  onRevokeSuccess?: () => void;
}

/**
 * Get color for invite status badge
 */
const getStatusColor = (
  status: InviteStatus
): 'success' | 'warning' | 'error' | 'default' | 'info' => {
  switch (status) {
    case 'pending':
      return 'info';
    case 'accepted':
      return 'success';
    case 'rejected':
      return 'error';
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'default';
    default:
      return 'default';
  }
};

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
 * Check if invite is expired
 */
const isExpired = (expiresAt: Date | string): boolean => {
  try {
    return isPast(new Date(expiresAt));
  } catch {
    return false;
  }
};

/**
 * Loading skeleton for table rows
 */
const TableRowSkeleton: React.FC = () => (
  <TableRow>
    <TableCell>
      <Skeleton variant="text" width={180} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={80} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="rounded" width={70} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={120} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={60} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell align="right">
      <Skeleton variant="circular" width={32} height={32} />
    </TableCell>
  </TableRow>
);

/**
 * InviteList component
 * Displays all workspace invites in a table format
 */
const InviteList: React.FC<InviteListProps> = ({ filters = {}, onRevokeSuccess }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Fetch invites data
  const { data, isLoading, error } = useWorkspaceInvites(filters);

  // Revoke invite mutation
  const revokeInviteMutation = useRevokeInvite();

  /**
   * Handle page change
   */
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /**
   * Handle copy invite link to clipboard
   */
  const handleCopyInviteLink = async (invite: WorkspaceInvite) => {
    try {
      // Use inviteUrl from backend if available, otherwise construct it
      const inviteUrl = invite.inviteUrl || `${window.location.origin}/register?invite=${invite.inviteToken}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteId(invite._id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
    }
  };

  /**
   * Handle revoke invite
   */
  const handleRevokeInvite = async (inviteId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invite? This action cannot be undone.')) {
      return;
    }

    try {
      await revokeInviteMutation.mutateAsync(inviteId);
      if (onRevokeSuccess) {
        onRevokeSuccess();
      }
    } catch (error) {
      console.error('Failed to revoke invite:', error);
    }
  };

  // Get paginated invites
  const paginatedInvites = React.useMemo(() => {
    if (!data?.invites) return [];
    const startIndex = page * rowsPerPage;
    return data.invites.slice(startIndex, startIndex + rowsPerPage);
  }, [data?.invites, page, rowsPerPage]);

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load invites
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  // Empty state
  if (!isLoading && (!data?.invites || data.invites.length === 0)) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No invites found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filters.status
            ? `No invites with status "${filters.status}". Try adjusting your filters.`
            : 'Generate invite links to add new members to your workspace.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Created</TableCell>
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
                <TableRowSkeleton />
                <TableRowSkeleton />
              </>
            ) : (
              // Actual data
              paginatedInvites.map((invite) => {
                const expired = isExpired(invite.expiresAt);
                const canRevoke = invite.status === 'pending' && !expired;
                const canCopy = invite.status === 'pending' && !expired;

                return (
                  <TableRow
                    key={invite._id}
                    hover
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    }}
                  >
                    {/* Email */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {invite.email}
                      </Typography>
                      {invite.requiresApproval && (
                        <Typography variant="caption" color="text.secondary">
                          Requires approval
                        </Typography>
                      )}
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      <Chip
                        label={invite.workplaceRole}
                        color={getRoleColor(invite.workplaceRole)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip
                        label={expired && invite.status === 'pending' ? 'expired' : invite.status}
                        color={getStatusColor(
                          expired && invite.status === 'pending' ? 'expired' : invite.status
                        )}
                        size="small"
                      />
                    </TableCell>

                    {/* Expiration */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={expired ? 'error.main' : 'text.primary'}
                      >
                        {formatDate(invite.expiresAt)}
                      </Typography>
                      {expired && (
                        <Typography variant="caption" color="error.main">
                          Expired
                        </Typography>
                      )}
                    </TableCell>

                    {/* Usage Statistics */}
                    <TableCell>
                      <Typography variant="body2">
                        {invite.usedCount} / {invite.maxUses}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {invite.maxUses === 1 ? 'Single use' : 'uses'}
                      </Typography>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(invite.createdAt)}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        {/* Copy Link Button */}
                        {canCopy && (
                          <Tooltip
                            title={
                              copiedInviteId === invite._id ? 'Copied!' : 'Copy invite link'
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleCopyInviteLink(invite)}
                              color={copiedInviteId === invite._id ? 'success' : 'default'}
                              aria-label="Copy invite link"
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Revoke Button */}
                        {canRevoke && (
                          <Tooltip title="Revoke invite">
                            <IconButton
                              size="small"
                              onClick={() => handleRevokeInvite(invite._id)}
                              disabled={revokeInviteMutation.isPending}
                              color="error"
                              aria-label="Revoke invite"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* No actions available */}
                        {!canCopy && !canRevoke && (
                          <Typography variant="caption" color="text.secondary">
                            No actions
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data?.invites && data.invites.length > 0 && (
        <TablePagination
          component="div"
          count={data.invites.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Box>
  );
};

export default InviteList;
