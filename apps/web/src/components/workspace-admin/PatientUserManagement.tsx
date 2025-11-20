/**
 * PatientUserManagement Component
 * Manages patient portal users with approval queue and user actions
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { format } from 'date-fns';
import { usePatientPortalAdmin } from '../../hooks/usePatientPortalAdmin';
import PatientUserActionsMenu from './PatientUserActionsMenu';

interface PatientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  profileComplete: boolean;
  registeredAt: Date;
  lastLoginAt?: Date;
  approvedBy?: {
    id: string;
    name: string;
  };
  approvedAt?: Date;
  suspendedBy?: {
    id: string;
    name: string;
  };
  suspendedAt?: Date;
  suspensionReason?: string;
}

interface PatientUserManagementProps {
  onShowSnackbar: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
  workspaceId?: string; // Optional workspace ID for super admin override
}

type SortField = 'firstName' | 'lastName' | 'email' | 'status' | 'registeredAt' | 'lastLoginAt';
type SortDirection = 'asc' | 'desc';

/**
 * Get color for user status badge
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
      <Skeleton variant="text" width={100} />
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

const PatientUserManagement: React.FC<PatientUserManagementProps> = ({ onShowSnackbar, workspaceId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [sortField, setSortField] = useState<SortField>('registeredAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedUser, setSelectedUser] = useState<PatientUser | null>(null);

  // Dialog states
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'suspend' | 'activate' | 'remove' | null;
    user: PatientUser | null;
  }>({ open: false, type: null, user: null });
  const [suspendReason, setSuspendReason] = useState('');

  // Get filter based on active tab
  const getStatusFilter = () => {
    switch (activeTab) {
      case 0: return undefined; // All users
      case 1: return 'pending'; // Pending approval
      case 2: return 'active'; // Active users
      case 3: return 'suspended'; // Suspended users
      default: return undefined;
    }
  };

  // Fetch patient users data
  const {
    data,
    isLoading,
    error,
  } = usePatientPortalAdmin(workspaceId).usePatientUsers({
    status: getStatusFilter(),
    page: pagination.page,
    limit: pagination.limit,
  });

  // Mutation hooks
  const { mutate: approveUser, isPending: isApproving } = usePatientPortalAdmin(workspaceId).useApproveUser();
  const { mutate: suspendUser, isPending: isSuspending } = usePatientPortalAdmin(workspaceId).useSuspendUser();
  const { mutate: activateUser, isPending: isActivating } = usePatientPortalAdmin(workspaceId).useActivateUser();
  const { mutate: removeUser, isPending: isRemoving } = usePatientPortalAdmin(workspaceId).useRemoveUser();

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
   * Handle tab change
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setPagination({ page: 1, limit: 20 }); // Reset pagination
  };

  /**
   * Handle user action menu click
   */
  const handleActionClick = (event: React.MouseEvent<HTMLElement>, user: PatientUser) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedUser(null);
  };

  /**
   * Handle user actions
   */
  const handleApproveUser = (user: PatientUser) => {
    setActionDialog({ open: true, type: 'approve', user });
  };

  const handleSuspendUser = (user: PatientUser) => {
    setActionDialog({ open: true, type: 'suspend', user });
  };

  const handleActivateUser = (user: PatientUser) => {
    setActionDialog({ open: true, type: 'activate', user });
  };

  const handleRemoveUser = (user: PatientUser) => {
    setActionDialog({ open: true, type: 'remove', user });
  };

  /**
   * Handle confirm action
   */
  const handleConfirmAction = () => {
    if (!actionDialog.user) return;

    const user = actionDialog.user;

    switch (actionDialog.type) {
      case 'approve':
        approveUser(user.id, {
          onSuccess: () => {
            onShowSnackbar(`${user.firstName} ${user.lastName} has been approved successfully`, 'success');
            setActionDialog({ open: false, type: null, user: null });
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to approve user', 'error');
          },
        });
        break;

      case 'suspend':
        suspendUser({
          userId: user.id,
          reason: suspendReason || 'No reason provided',
        }, {
          onSuccess: () => {
            onShowSnackbar(`${user.firstName} ${user.lastName} has been suspended`, 'success');
            setActionDialog({ open: false, type: null, user: null });
            setSuspendReason('');
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to suspend user', 'error');
          },
        });
        break;

      case 'activate':
        activateUser(user.id, {
          onSuccess: () => {
            onShowSnackbar(`${user.firstName} ${user.lastName} has been activated successfully`, 'success');
            setActionDialog({ open: false, type: null, user: null });
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to activate user', 'error');
          },
        });
        break;

      case 'remove':
        removeUser(user.id, {
          onSuccess: () => {
            onShowSnackbar(`${user.firstName} ${user.lastName} has been removed from the portal`, 'success');
            setActionDialog({ open: false, type: null, user: null });
          },
          onError: (error: any) => {
            onShowSnackbar(error.response?.data?.message || 'Failed to remove user', 'error');
          },
        });
        break;
    }
  };

  /**
   * Handle close action dialog
   */
  const handleCloseActionDialog = () => {
    setActionDialog({ open: false, type: null, user: null });
    setSuspendReason('');
  };

  // Sort users locally (client-side sorting)
  const sortedUsers = React.useMemo(() => {
    if (!data?.users) return [];

    return [...data.users].sort((a, b) => {
      let aValue: string | number | Date = a[sortField];
      let bValue: string | number | Date = b[sortField];

      // Handle date fields
      if (sortField === 'registeredAt' || sortField === 'lastLoginAt') {
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
  }, [data?.users, sortField, sortDirection]);

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body1" gutterBottom>
          Failed to load patient users
        </Typography>
        <Typography variant="body2">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Status Filter Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="patient user status tabs"
        >
          <Tab
            label="All Users"
            icon={<Badge badgeContent={data?.counts?.total || 0} color="primary"><PersonAddIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Pending Approval"
            icon={<Badge badgeContent={data?.counts?.pending || 0} color="warning"><HourglassEmptyIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Active Users"
            icon={<Badge badgeContent={data?.counts?.active || 0} color="success"><CheckCircleIcon /></Badge>}
            iconPosition="start"
          />
          <Tab
            label="Suspended"
            icon={<Badge badgeContent={data?.counts?.suspended || 0} color="error"><BlockIcon /></Badge>}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Users Table */}
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
                  Patient
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
                  active={sortField === 'registeredAt'}
                  direction={sortDirection}
                  onClick={() => handleSort('registeredAt')}
                >
                  Registered
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === 'lastLoginAt'}
                  direction={sortDirection}
                  onClick={() => handleSort('lastLoginAt')}
                >
                  Last Login
                </TableSortLabel>
              </TableCell>
              <TableCell>Profile</TableCell>
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
            ) : sortedUsers.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No patient users found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activeTab === 1 ? 'No pending approvals at this time.' : 'No users match the current filter.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              // Actual data
              sortedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                  }}
                >
                  {/* Patient Info */}
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
                        {getInitials(user.firstName, user.lastName)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                        {user.phone && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {user.phone}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={user.status}
                      color={getStatusColor(user.status)}
                      size="small"
                    />
                  </TableCell>

                  {/* Registered Date */}
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(user.registeredAt)}
                    </Typography>
                  </TableCell>

                  {/* Last Login */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(user.lastLoginAt)}
                    </Typography>
                  </TableCell>

                  {/* Profile Status */}
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={user.emailVerified ? 'Verified' : 'Unverified'}
                        color={user.emailVerified ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={user.profileComplete ? 'Complete' : 'Incomplete'}
                        color={user.profileComplete ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Tooltip title="More actions">
                      <IconButton
                        size="small"
                        onClick={(e) => handleActionClick(e, user)}
                        aria-label={`Actions for ${user.firstName} ${user.lastName}`}
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

      {/* User Actions Menu */}
      {selectedUser && (
        <PatientUserActionsMenu
          user={selectedUser}
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          onApprove={handleApproveUser}
          onSuspend={handleSuspendUser}
          onActivate={handleActivateUser}
          onRemove={handleRemoveUser}
        />
      )}

      {/* Action Confirmation Dialogs */}
      <Dialog
        open={actionDialog.open}
        onClose={handleCloseActionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === 'approve' && 'Approve Patient User'}
          {actionDialog.type === 'suspend' && 'Suspend Patient User'}
          {actionDialog.type === 'activate' && 'Activate Patient User'}
          {actionDialog.type === 'remove' && 'Remove Patient User'}
        </DialogTitle>
        <DialogContent>
          {actionDialog.type === 'approve' && (
            <Typography>
              Are you sure you want to approve {actionDialog.user?.firstName} {actionDialog.user?.lastName}?
              They will be able to access the patient portal immediately.
            </Typography>
          )}
          {actionDialog.type === 'suspend' && (
            <Box>
              <Typography gutterBottom>
                Are you sure you want to suspend {actionDialog.user?.firstName} {actionDialog.user?.lastName}?
                They will no longer be able to access the patient portal.
              </Typography>
              <TextField
                fullWidth
                label="Reason for suspension"
                multiline
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
          {actionDialog.type === 'activate' && (
            <Typography>
              Are you sure you want to activate {actionDialog.user?.firstName} {actionDialog.user?.lastName}?
              They will be able to access the patient portal again.
            </Typography>
          )}
          {actionDialog.type === 'remove' && (
            <Typography>
              Are you sure you want to permanently remove {actionDialog.user?.firstName} {actionDialog.user?.lastName}
              from the patient portal? This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={actionDialog.type === 'remove' ? 'error' : 'primary'}
            disabled={isApproving || isSuspending || isActivating || isRemoving}
          >
            {actionDialog.type === 'approve' && 'Approve'}
            {actionDialog.type === 'suspend' && 'Suspend'}
            {actionDialog.type === 'activate' && 'Activate'}
            {actionDialog.type === 'remove' && 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientUserManagement;