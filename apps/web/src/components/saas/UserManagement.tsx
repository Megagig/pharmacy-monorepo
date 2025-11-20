import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  Grid,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  useUsers,
  useUpdateUserRole,
  useSuspendUser,
  useReactivateUser,
  useImpersonateUser,
  useApproveUser,
  useRejectUser,
  useBulkApproveUsers,
  useBulkRejectUsers,
  useBulkSuspendUsers,
  useCreateUser
} from '../../queries/useSaasSettings';
import { useQueryClient } from '@tanstack/react-query';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import Checkbox from '@mui/material/Checkbox';

interface UserActionsMenuProps {
  user: any;
  onEdit: (user: any) => void;
  onSuspend: (user: any) => void;
  onReactivate: (user: any) => void;
  onImpersonate: (user: any) => void;
  onApprove: (user: any) => void;
  onReject: (user: any) => void;
}

const UserActionsMenu: React.FC<UserActionsMenuProps> = ({
  user,
  onEdit,
  onSuspend,
  onReactivate,
  onImpersonate,
  onApprove,
  onReject,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <>
      <IconButton onClick={handleClick} size="small">
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuList>
          {user.status === 'pending' && (
            <>
              <MenuItemComponent onClick={() => handleAction(() => onApprove(user))}>
                <ThumbUpIcon sx={{ mr: 1 }} fontSize="small" />
                Approve User
              </MenuItemComponent>
              <MenuItemComponent onClick={() => handleAction(() => onReject(user))}>
                <ThumbDownIcon sx={{ mr: 1 }} fontSize="small" />
                Reject User
              </MenuItemComponent>
            </>
          )}
          <MenuItemComponent onClick={() => handleAction(() => onEdit(user))}>
            <EditIcon sx={{ mr: 1 }} fontSize="small" />
            Assign Role
          </MenuItemComponent>
          {user.status === 'active' ? (
            <MenuItemComponent onClick={() => handleAction(() => onSuspend(user))}>
              <BlockIcon sx={{ mr: 1 }} fontSize="small" />
              Suspend User
            </MenuItemComponent>
          ) : user.status === 'suspended' ? (
            <MenuItemComponent onClick={() => handleAction(() => onReactivate(user))}>
              <CheckCircleIcon sx={{ mr: 1 }} fontSize="small" />
              Reactivate User
            </MenuItemComponent>
          ) : null}
          <MenuItemComponent onClick={() => handleAction(() => onImpersonate(user))}>
            <SupervisorAccountIcon sx={{ mr: 1 }} fontSize="small" />
            Impersonate User
          </MenuItemComponent>
        </MenuList>
      </Menu>
    </>
  );
};

interface EditUserDialogProps {
  open: boolean;
  user: any | null;
  onClose: () => void;
  onSave: (userId: string, roleId: string) => void;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({
  open,
  user,
  onClose,
  onSave,
}) => {
  const [selectedRole, setSelectedRole] = useState('');

  // Update selectedRole when user changes or dialog opens
  React.useEffect(() => {
    if (user && open) {
      setSelectedRole(user.role || '');
    }
  }, [user, open]);

  const roles = [
    { id: 'super_admin', name: 'Super Admin' },
    { id: 'pharmacy_outlet', name: 'Pharmacy Owner' },
    { id: 'pharmacist', name: 'Pharmacist' },
    { id: 'intern_pharmacist', name: 'Intern Pharmacist' },
    { id: 'pharmacy_team', name: 'Pharmacy Team' },
  ];

  const handleSave = () => {
    if (user && selectedRole) {
      onSave(user._id, selectedRole);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User Role</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Typography variant="body1" gutterBottom>
            User: {user?.email}
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              label="Role"
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const UserManagement: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: usersData, isLoading, error } = useUsers(
    filters,
    { page: page + 1, limit: rowsPerPage }
  );

  const queryClient = useQueryClient();
  const updateUserRoleMutation = useUpdateUserRole();
  const suspendUserMutation = useSuspendUser();
  const reactivateUserMutation = useReactivateUser();
  const impersonateUserMutation = useImpersonateUser();
  const approveUserMutation = useApproveUser();
  const rejectUserMutation = useRejectUser();
  const bulkApproveUsersMutation = useBulkApproveUsers();
  const bulkRejectUsersMutation = useBulkRejectUsers();
  const bulkSuspendUsersMutation = useBulkSuspendUsers();
  const createUserMutation = useCreateUser();

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleSuspendUser = (user: any) => {
    suspendUserMutation.mutate({
      userId: user._id,
      reason: 'Suspended by administrator',
    }, {
      onSuccess: () => {
        setSuccessMessage(`User ${user.firstName} ${user.lastName} has been suspended successfully.`);
        setErrorMessage(null);
        // Manually invalidate all user-related queries to refresh the UI
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to suspend user: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleReactivateUser = (user: any) => {
    reactivateUserMutation.mutate(user._id, {
      onSuccess: () => {
        setSuccessMessage(`User ${user.firstName} ${user.lastName} has been reactivated successfully.`);
        setErrorMessage(null);
        // Manually invalidate all user-related queries to refresh the UI
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to reactivate user: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleImpersonateUser = (user: any) => {
    impersonateUserMutation.mutate(user._id, {
      onSuccess: (session) => {
        setSuccessMessage(`Impersonation session created for ${user.firstName} ${user.lastName}.`);
        setErrorMessage(null);

        // You would typically redirect or update the auth context here
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to create impersonation session: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleSaveUserRole = (userId: string, roleId: string) => {
    updateUserRoleMutation.mutate({ userId, roleId }, {
      onSuccess: () => {
        setSuccessMessage('User role updated successfully.');
        setErrorMessage(null);
        // Manually invalidate all user-related queries to refresh the UI
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
        // Also force refetch the users query to ensure immediate UI update
        queryClient.refetchQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to update user role: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleApproveUser = (user: any) => {
    approveUserMutation.mutate(user._id, {
      onSuccess: () => {
        setSuccessMessage(`User ${user.firstName} ${user.lastName} has been approved successfully.`);
        setErrorMessage(null);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to approve user: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleRejectUser = (user: any) => {
    setSelectedUser(user);
    setRejectDialogOpen(true);
  };

  const confirmRejectUser = () => {
    if (!selectedUser) return;

    rejectUserMutation.mutate({ userId: selectedUser._id, reason: rejectReason }, {
      onSuccess: () => {
        setSuccessMessage(`User ${selectedUser.firstName} ${selectedUser.lastName} has been rejected.`);
        setErrorMessage(null);
        setRejectDialogOpen(false);
        setRejectReason('');
        setSelectedUser(null);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to reject user: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === usersData?.users?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(usersData?.users?.map((u: any) => u._id) || []);
    }
  };

  const handleBulkApprove = () => {
    if (selectedUsers.length === 0) return;

    bulkApproveUsersMutation.mutate(selectedUsers, {
      onSuccess: (result: any) => {
        setSuccessMessage(`Successfully approved ${result.successfulApprovals} users.`);
        setErrorMessage(null);
        setSelectedUsers([]);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to approve users: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleBulkReject = () => {
    if (selectedUsers.length === 0) return;

    const reason = prompt('Enter rejection reason (optional):');
    bulkRejectUsersMutation.mutate({ userIds: selectedUsers, reason: reason || undefined }, {
      onSuccess: (result: any) => {
        setSuccessMessage(`Successfully rejected ${result.successfulRejections} users.`);
        setErrorMessage(null);
        setSelectedUsers([]);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to reject users: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const handleBulkSuspend = () => {
    if (selectedUsers.length === 0) return;

    const reason = prompt('Enter suspension reason (required):');
    if (!reason) {
      setErrorMessage('Suspension reason is required');
      return;
    }

    bulkSuspendUsersMutation.mutate({ userIds: selectedUsers, reason }, {
      onSuccess: (result: any) => {
        setSuccessMessage(`Successfully suspended ${result.successfulSuspensions} users.`);
        setErrorMessage(null);
        setSelectedUsers([]);
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
        });
      },
      onError: (error: any) => {
        setErrorMessage(`Failed to suspend users: ${error.message || 'Unknown error'}`);
        setSuccessMessage(null);
      }
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'pharmacy_outlet':
        return 'primary';
      case 'pharmacist':
        return 'success';
      case 'intern_pharmacist':
        return 'info';
      case 'pharmacy_team':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (error) {
    return (
      <Alert severity="error">
        <Typography variant="h6" gutterBottom>
          Error Loading Users
        </Typography>
        <Typography variant="body2">
          There was an error loading the user data. Please try refreshing the page.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="User Management"
          subheader="Manage users, roles, and permissions across all pharmacy tenants"
          action={
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setAddUserDialogOpen(true)}
            >
              Add User
            </Button>
          }
        />
        <CardContent>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  label="Role"
                >
                  <MenuItem value="">All Roles</MenuItem>
                  <MenuItem value="super_admin">Super Admin</MenuItem>
                  <MenuItem value="pharmacy_outlet">Pharmacy Owner</MenuItem>
                  <MenuItem value="pharmacist">Pharmacist</MenuItem>
                  <MenuItem value="intern_pharmacist">Intern Pharmacist</MenuItem>
                  <MenuItem value="pharmacy_team">Pharmacy Team</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterListIcon />}
                sx={{ height: '56px' }}
              >
                More Filters
              </Button>
            </Grid>
          </Grid>

          {/* Users Table */}
          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2">
                {selectedUsers.length} user(s) selected
              </Typography>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<ThumbUpIcon />}
                onClick={handleBulkApprove}
              >
                Bulk Approve
              </Button>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<ThumbDownIcon />}
                onClick={handleBulkReject}
              >
                Bulk Reject
              </Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<BlockIcon />}
                onClick={handleBulkSuspend}
              >
                Bulk Suspend
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSelectedUsers([])}
              >
                Clear Selection
              </Button>
            </Box>
          )}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedUsers.length === usersData?.users?.length && usersData?.users?.length > 0}
                      indeterminate={selectedUsers.length > 0 && selectedUsers.length < (usersData?.users?.length || 0)}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Workspace</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: rowsPerPage }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell padding="checkbox">
                        <Skeleton variant="circular" width={24} height={24} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                          <Box>
                            <Skeleton width={120} />
                            <Skeleton width={80} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Skeleton width={80} /></TableCell>
                      <TableCell><Skeleton width={60} /></TableCell>
                      <TableCell><Skeleton width={100} /></TableCell>
                      <TableCell><Skeleton width={80} /></TableCell>
                      <TableCell><Skeleton width={40} /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  usersData?.users?.map((user) => (
                    <TableRow key={user._id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.includes(user._id)}
                          onChange={() => handleSelectUser(user._id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2 }}>
                            {user.firstName?.[0] || user.email[0].toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role?.replace('_', ' ') || 'Unknown'}
                          color={getRoleColor(user.role) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status || 'Unknown'}
                          color={getStatusColor(user.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.workplaceId?.name || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <UserActionsMenu
                          user={user}
                          onEdit={handleEditUser}
                          onSuspend={handleSuspendUser}
                          onReactivate={handleReactivateUser}
                          onImpersonate={handleImpersonateUser}
                          onApprove={handleApproveUser}
                          onReject={handleRejectUser}
                        />
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No users found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[10, 20, 50]}
            component="div"
            count={usersData?.pagination?.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUserRole}
      />

      {/* Reject User Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject User</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to reject {selectedUser?.firstName} {selectedUser?.lastName}?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Rejection Reason (Optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              sx={{ mt: 2 }}
              placeholder="Enter reason for rejection..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRejectDialogOpen(false);
            setRejectReason('');
          }}>
            Cancel
          </Button>
          <Button onClick={confirmRejectUser} variant="contained" color="error">
            Reject User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add User Dialog */}
      <AddUserDialog
        open={addUserDialogOpen}
        onClose={() => setAddUserDialogOpen(false)}
        onSuccess={() => {
          setAddUserDialogOpen(false);
          setSuccessMessage('User created successfully');
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'saas' && query.queryKey.includes('users')
          });
        }}
      />
    </Box>
  );
};

// Add User Dialog Component
interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddUserDialog: React.FC<AddUserDialogProps> = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'pharmacist',
    workplaceId: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const createUserMutation = useCreateUser();

  const handleSubmit = () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.password || !formData.role) {
      setError('Please fill in all required fields');
      return;
    }

    createUserMutation.mutate(formData, {
      onSuccess: () => {
        setFormData({
          email: '',
          firstName: '',
          lastName: '',
          password: '',
          role: 'pharmacist',
          workplaceId: '',
          phone: ''
        });
        setError('');
        onSuccess();
      },
      onError: (err: any) => {
        setError(err.message || 'Failed to create user');
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New User</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            fullWidth
            required
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              required
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            <TextField
              fullWidth
              required
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </Box>

          <TextField
            fullWidth
            required
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            helperText="User will receive this password via email"
          />

          <FormControl fullWidth required>
            <InputLabel>Role</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              label="Role"
            >
              <MenuItem value="super_admin">Super Admin</MenuItem>
              <MenuItem value="pharmacy_outlet">Pharmacy Owner</MenuItem>
              <MenuItem value="pharmacist">Pharmacist</MenuItem>
              <MenuItem value="intern_pharmacist">Intern Pharmacist</MenuItem>
              <MenuItem value="pharmacy_team">Pharmacy Team</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Phone (Optional)"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <TextField
            fullWidth
            label="Workplace ID (Optional)"
            value={formData.workplaceId}
            onChange={(e) => setFormData({ ...formData, workplaceId: e.target.value })}
            helperText="Leave empty if not assigning to a workspace"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={createUserMutation.isPending}
        >
          {createUserMutation.isPending ? 'Creating...' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserManagement;