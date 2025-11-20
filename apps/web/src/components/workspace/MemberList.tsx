/**
 * MemberList Component
 * Displays a table of workspace members with sorting, filtering, and pagination
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
  TableSortLabel,
  TablePagination,
  Avatar,
  Chip,
  Typography,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { format } from 'date-fns';
import type { Member, MemberFilters, Pagination } from '../../types/workspace';
import { useWorkspaceMembers } from '../../queries/useWorkspaceTeam';
import MemberActionsMenu from './MemberActionsMenu';

interface MemberListProps {
  filters?: MemberFilters;
  onAssignRole?: (member: Member) => void;
  onSuspend?: (member: Member) => void;
  onActivate?: (member: Member) => void;
  onRemove?: (member: Member) => void;
}

type SortField = 'firstName' | 'lastName' | 'email' | 'workplaceRole' | 'status' | 'joinedAt';
type SortDirection = 'asc' | 'desc';

/**
 * Get color for member status badge
 */
const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
      return 'error';
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
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy');
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
      <Skeleton variant="rounded" width={70} height={24} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell>
      <Skeleton variant="text" width={100} />
    </TableCell>
    <TableCell>
      <Skeleton variant="circular" width={32} height={32} />
    </TableCell>
  </TableRow>
);

const MemberList: React.FC<MemberListProps> = ({
  filters = {},
  onAssignRole,
  onSuspend,
  onActivate,
  onRemove,
}) => {
  const [sortField, setSortField] = useState<SortField>('joinedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20 });
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Fetch members data
  const {
    data,
    isLoading,
    error,
  } = useWorkspaceMembers(filters, pagination);

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Handle page change
   */
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPagination({ ...pagination, page: newPage + 1 });
  };

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPagination({
      page: 1,
      limit: parseInt(event.target.value, 10),
    });
  };

  /**
   * Handle member action menu click
   */
  const handleActionClick = (event: React.MouseEvent<HTMLElement>, member: Member) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedMember(null);
  };

  // Sort members locally (client-side sorting)
  const sortedMembers = React.useMemo(() => {
    if (!data?.members) return [];

    return [...data.members].sort((a, b) => {
      let aValue: string | number | Date = a[sortField];
      let bValue: string | number | Date = b[sortField];

      // Handle date fields
      if (sortField === 'joinedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle string fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [data?.members, sortField, sortDirection]);

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load team members
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  // Empty state
  if (!isLoading && sortedMembers.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No team members found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filters.search || filters.role || filters.status
            ? 'Try adjusting your filters to see more results.'
            : 'Start by inviting team members to your workspace.'}
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
              <TableCell>
                <TableSortLabel
                  active={sortField === 'firstName' || sortField === 'lastName'}
                  direction={sortDirection}
                  onClick={() => handleSort('firstName')}
                >
                  Member
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'workplaceRole'}
                  direction={sortDirection}
                  onClick={() => handleSort('workplaceRole')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortDirection}
                  onClick={() => handleSort('status')}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'joinedAt'}
                  direction={sortDirection}
                  onClick={() => handleSort('joinedAt')}
                >
                  Joined
                </TableSortLabel>
              </TableCell>
              <TableCell>Last Active</TableCell>
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
              sortedMembers.map((member) => (
                <TableRow
                  key={member._id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                  }}
                >
                  {/* Member Info */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: 'primary.main',
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

                  {/* Role */}
                  <TableCell>
                    <Chip
                      label={member.workplaceRole}
                      color={getRoleColor(member.workplaceRole)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={member.status}
                      color={getStatusColor(member.status)}
                      size="small"
                    />
                  </TableCell>

                  {/* Joined Date */}
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(member.joinedAt)}
                    </Typography>
                  </TableCell>

                  {/* Last Active */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(member.lastLoginAt)}
                    </Typography>
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Tooltip title="More actions">
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionClick(e, member)}
                        aria-label={`Actions for ${member.firstName} ${member.lastName}`}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data?.pagination && (
        <TablePagination
          component="div"
          count={data.pagination.total}
          page={pagination.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}

      {/* Member Actions Menu */}
      {selectedMember && (
        <MemberActionsMenu
          member={selectedMember}
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          onAssignRole={onAssignRole}
          onSuspend={onSuspend}
          onActivate={onActivate}
          onRemove={onRemove}
        />
      )}
    </Box>
  );
};

export default MemberList;
