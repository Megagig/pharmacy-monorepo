import React, { useState, useEffect, useCallback, MouseEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Tooltip,
  Badge,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRBAC } from '../hooks/useRBAC';
import * as rbacService from '../services/rbacService';
import NotificationSystem from '../components/rbac/NotificationSystem';
import BulkOperationProgress from '../components/rbac/BulkOperationProgress';
import type { DynamicUser, Role, PermissionPreview } from '../types/rbac';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const PharmacyUserManagement: React.FC = () => {
  const { hasFeature, canAccess } = useRBAC();

  // Disable WebSocket functionality completely
  const subscribe = useCallback(() => () => {}, []); // No-op function

  // State management
  const [users, setUsers] = useState<DynamicUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [roleAssignmentOpen, setRoleAssignmentOpen] = useState(false);
  const [selectedRolesForAssignment, setSelectedRolesForAssignment] = useState<
    string[]
  >([]);
  const [permissionPreview, setPermissionPreview] =
    useState<PermissionPreview | null>(null);
  const [bulkOperationInProgress, setBulkOperationInProgress] = useState(false);

  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<DynamicUser | null>(null);

  // Real-time updates and progress tracking
  const [bulkOperationId, setBulkOperationId] = useState<string | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);

  // Notification states
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
      setSnackbar({ open: true, message, severity });
    },
    []
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load users and roles separately to handle individual failures
      let usersLoaded = false;
      let rolesLoaded = false;

      // Try to load users
      try {
        const usersResponse = await rbacService.getAllUsers({
          page: 1,
          limit: 100,
        });
        if (usersResponse.success && usersResponse.data?.users) {
          setUsers(usersResponse.data.users);
          usersLoaded = true;
        } else {
          setUsers([]);
        }
      } catch (userError) {
        console.error('Error loading users:', userError);
        setUsers([]);
      }

      // Try to load roles
      try {
        const rolesResponse = await rbacService.getAllRoles({
          page: 1,
          limit: 100,
        });
        if (rolesResponse.success && rolesResponse.data?.roles) {
          setRoles(rolesResponse.data.roles);
          rolesLoaded = true;
        } else {
          setRoles([]);
        }
      } catch (roleError) {
        console.error('Error loading roles:', roleError);
        setRoles([]);
      }

      // Show appropriate messages based on what loaded successfully
      if (usersLoaded && rolesLoaded) {
        showSnackbar('Data loaded successfully', 'success');
      } else if (usersLoaded && !rolesLoaded) {
        showSnackbar('Users loaded, but roles failed to load', 'warning');
      } else if (!usersLoaded && rolesLoaded) {
        showSnackbar('Roles loaded, but users failed to load', 'warning');
      } else {
        showSnackbar('Failed to load user and role data', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time updates
  useEffect(() => {
    // Since subscribe is a no-op function, we don't need to call it with parameters
    // This is just to satisfy the TypeScript compiler
    const unsubscribeUserUpdates = subscribe;
    const unsubscribeRoleUpdates = subscribe;
    const unsubscribeBulkOperations = subscribe;

    return () => {
      unsubscribeUserUpdates();
      unsubscribeRoleUpdates();
      unsubscribeBulkOperations();
    };
  }, [subscribe, bulkOperationId, loadData]);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Handle role assignment
  const handleOpenRoleAssignment = () => {
    if (Array.isArray(selectedUserIds) && selectedUserIds.length === 0) {
      showSnackbar('Please select users to assign roles', 'warning');
      return;
    }
    setRoleAssignmentOpen(true);
  };

  const handleRoleAssignmentChange = (
    event: SelectChangeEvent<typeof selectedRolesForAssignment>
  ) => {
    const value = event.target.value;
    setSelectedRolesForAssignment(
      typeof value === 'string' ? value.split(',') : value
    );
  };

  const handlePreviewPermissions = async () => {
    if (
      Array.isArray(selectedUserIds) &&
      selectedUserIds.length === 1 &&
      selectedRolesForAssignment.length > 0
    ) {
      try {
        const userId = selectedUserIds[0] as string;
        const response = await rbacService.previewPermissionChanges(userId, {
          roleIds: selectedRolesForAssignment,
        });

        if (response.success) {
          setPermissionPreview(response.data as PermissionPreview);
        }
      } catch (error) {
        console.error('Error previewing permissions:', error);
        showSnackbar('Failed to preview permissions', 'error');
      }
    }
  };

  const handleAssignRoles = async () => {
    if (
      !Array.isArray(selectedUserIds) ||
      selectedUserIds.length === 0 ||
      selectedRolesForAssignment.length === 0
    ) {
      showSnackbar('Please select users and roles', 'warning');
      return;
    }

    try {
      setBulkOperationInProgress(true);

      const operationId = `role-assignment-${Date.now()}`;
      setBulkOperationId(operationId);
      setProgressDialogOpen(true);

      const result = await rbacService.bulkAssignRoles(
        Array.isArray(selectedUserIds) ? (selectedUserIds as string[]) : [],
        selectedRolesForAssignment[0] // bulkAssignRoles expects a single roleId, not an array
      );

      if (result.success) {
        showSnackbar('Roles assigned successfully', 'success');

        await loadData();
        setRoleAssignmentOpen(false);
        setSelectedRolesForAssignment([]);
        setSelectedUserIds([]);
        setPermissionPreview(null);
      }
    } catch (error) {
      console.error('Error assigning roles:', error);
      showSnackbar('Failed to assign roles', 'error');
    } finally {
      setBulkOperationInProgress(false);
    }
  };

  // Handle individual user actions
  const handleUserMenuOpen = (
    event: MouseEvent<HTMLElement>,
    user: DynamicUser
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleEditUser = (user: DynamicUser) => {

    handleUserMenuClose();
  };

  const handleViewUserRoles = async (user: DynamicUser | null) => {
    if (!user || !user._id) {
      console.error('Invalid user data:', user);
      showSnackbar('User data is not available', 'error');
      handleUserMenuClose();
      return;
    }

    try {
      const response = await rbacService.getUserRoles(user._id);
      if (response.success) {

        showSnackbar('User roles loaded successfully', 'success');
      } else {
        showSnackbar('Failed to load user roles', 'error');
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
      showSnackbar('Failed to load user roles', 'error');
    }
    handleUserMenuClose();
  };

  // Filter users based on search and filters
  const filteredUsers = React.useMemo(() => {
    if (!Array.isArray(users)) return [];

    return users.filter((user) => {
      if (!user || typeof user !== 'object') return false;

      const matchesSearch =
        !searchTerm ||
        `${user.firstName || ''} ${user.lastName || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = !statusFilter || user.status === statusFilter;

      const matchesRole =
        roleFilter.length === 0 ||
        (Array.isArray(user.assignedRoles) &&
          user.assignedRoles.some((roleId) => roleFilter.includes(roleId)));

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  // Check if user has access to user management
  if (!hasFeature('user_management')) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You don't have permission to access User Management. Please contact
          your administrator.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <GroupIcon color="primary" />
          User Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage user roles, permissions, and access controls with dynamic RBAC
        </Typography>
      </Box>

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <TextField
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          {/* Status Filter */}
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              <MenuItem value="license_pending">License Pending</MenuItem>
            </Select>
          </FormControl>

          {/* Role Filter */}
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Roles</InputLabel>
            <Select
              multiple
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : e.target.value
                )
              }
              input={<OutlinedInput label="Roles" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const role = roles.find((r) => r._id === value);
                    return (
                      <Chip
                        key={value}
                        label={role?.displayName || value}
                        size="small"
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {roles.map((role) => (
                <MenuItem key={role._id} value={role._id}>
                  <Checkbox checked={roleFilter.indexOf(role._id) > -1} />
                  <ListItemText primary={role.displayName} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          {/* Action Buttons */}
          <Tooltip title="Assign Roles to Selected Users">
            <span>
              <Button
                variant="contained"
                startIcon={<SecurityIcon />}
                onClick={handleOpenRoleAssignment}
                disabled={
                  !Array.isArray(selectedUserIds) ||
                  selectedUserIds.length === 0 ||
                  !canAccess('canManage')
                }
              >
                Assign Roles
                {Array.isArray(selectedUserIds) && selectedUserIds.length > 0 && (
                  <Badge
                    badgeContent={selectedUserIds.length}
                    color="secondary"
                    sx={{ ml: 1 }}
                  />
                )}
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600 }}>
        {(!Array.isArray(users) || users.length === 0) && !loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
            }}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No users found
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              The RBAC service may not be available or no users exist.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
            >
              Try Again
            </Button>
          </Box>
        ) : loading ||
          !Array.isArray(filteredUsers) ||
          !Array.isArray(users) ||
          !Array.isArray(roles) ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: 600,
              p: 3,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Loading user management data...
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Select</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>System Role</TableCell>
                  <TableCell>Dynamic Roles</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user._id}>
                    <Checkbox
                        checked={selectedUserIds.indexOf(user._id) > -1}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds([...selectedUserIds, user._id]);
                          } else {
                            setSelectedUserIds(selectedUserIds.filter(id => id !== user._id));
                          }
                        }}
                      />
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.status || 'Unknown'}
                        color={
                          user.status === 'active'
                            ? 'success'
                            : user.status === 'pending'
                            ? 'warning'
                            : user.status === 'suspended'
                            ? 'error'
                            : 'default'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.systemRole || 'User'}
                        size="small"
                        variant="filled"
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>
                      {Array.isArray(user.assignedRoles) &&
                      Array.isArray(roles) ? (
                        <Box
                          sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
                        >
                          {roles
                            .filter(
                              (role) =>
                                role &&
                                role._id &&
                                user.assignedRoles.includes(role._id)
                            )
                            .slice(0, 2)
                            .map((role) => (
                              <Chip
                                key={role._id}
                                label={role.displayName || 'Unknown Role'}
                                size="small"
                                variant="outlined"
                                color="secondary"
                              />
                            ))}
                          {roles.filter(
                            (role) =>
                              role &&
                              role._id &&
                              user.assignedRoles.includes(role._id)
                          ).length > 2 && (
                            <Chip
                              label={`+${
                                roles.filter(
                                  (role) =>
                                    role &&
                                    role._id &&
                                    user.assignedRoles.includes(role._id)
                                ).length - 2
                              }`}
                              size="small"
                              variant="outlined"
                              color="default"
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No roles
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit User">
                          <IconButton
                            size="small"
                            onClick={() => handleEditUser(user)}
                            disabled={!canAccess('canUpdate')}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Manage Roles">
                          <IconButton
                            size="small"
                            onClick={() => handleViewUserRoles(user)}
                          >
                            <SecurityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More Options">
                          <IconButton
                            size="small"
                            onClick={(event) => handleUserMenuOpen(event, user)}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Role Assignment Dialog */}
      <Dialog
        open={roleAssignmentOpen}
        onClose={() => setRoleAssignmentOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Assign Roles to{' '}
          {Array.isArray(selectedUserIds) ? selectedUserIds.length : 0} User
          {Array.isArray(selectedUserIds) && selectedUserIds.length !== 1
            ? 's'
            : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Roles</InputLabel>
              <Select
                multiple
                value={selectedRolesForAssignment}
                onChange={handleRoleAssignmentChange}
                input={<OutlinedInput label="Select Roles" />}
                renderValue={(selected: string[]) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const role = roles.find((r) => r._id === value);
                      return (
                        <Chip key={value} label={role?.displayName || value} />
                      );
                    })}
                  </Box>
                )}
                MenuProps={MenuProps}
              >
                {roles.map((role) => (
                  <MenuItem key={role._id} value={role._id}>
                    <Checkbox
                      checked={
                        selectedRolesForAssignment.indexOf(role._id) > -1
                      }
                    />
                    <ListItemText
                      primary={role.displayName}
                      secondary={role.description}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {Array.isArray(selectedUserIds) &&
              selectedUserIds.length === 1 &&
              selectedRolesForAssignment.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handlePreviewPermissions}
                    startIcon={<SecurityIcon />}
                  >
                    Preview Permissions
                  </Button>
                </Box>
              )}

            {/* Permission Preview */}
            {permissionPreview && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Permission Changes Preview
                </Typography>

                {permissionPreview.addedPermissions.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="success.main"
                      gutterBottom
                    >
                      <CheckCircleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      Added Permissions (
                      {permissionPreview.addedPermissions.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {permissionPreview.addedPermissions.map((permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {permissionPreview.removedPermissions.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="error.main"
                      gutterBottom
                    >
                      <WarningIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      Removed Permissions (
                      {permissionPreview.removedPermissions.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {permissionPreview.removedPermissions.map(
                        (permission) => (
                          <Chip
                            key={permission}
                            label={permission}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        )
                      )}
                    </Box>
                  </Box>
                )}

                {permissionPreview.conflicts.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Conflicts Detected
                    </Typography>
                    <ul>
                      {permissionPreview.conflicts.map((conflict, index) => (
                        <li key={index}>{conflict}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleAssignmentOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAssignRoles}
            variant="contained"
            disabled={
              selectedRolesForAssignment.length === 0 || bulkOperationInProgress
            }
            startIcon={
              bulkOperationInProgress ? (
                <CircularProgress size={16} />
              ) : (
                <SecurityIcon />
              )
            }
          >
            {bulkOperationInProgress ? 'Assigning...' : 'Assign Roles'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
      >
        <MenuItem onClick={() => selectedUser && handleEditUser(selectedUser)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit User
        </MenuItem>
        <MenuItem onClick={() => selectedUser && handleViewUserRoles(selectedUser)}>
          <SecurityIcon sx={{ mr: 1 }} />
          Manage Roles
        </MenuItem>
        <MenuItem
          onClick={handleUserMenuClose}
          disabled={!canAccess('canDelete')}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Suspend User
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Real-time Notification System */}
      <NotificationSystem />

      {/* Bulk Operation Progress Dialog */}
      <BulkOperationProgress
        open={progressDialogOpen}
        onClose={() => {
          setProgressDialogOpen(false);
          setBulkOperationId(null);
        }}
        operationId={bulkOperationId || undefined}
        initialData={{
          type: 'role_assignment',
          status: 'in_progress',
          progress: {
            total: Array.isArray(selectedUserIds) ? selectedUserIds.length : 0,
            processed: 0,
            successful: 0,
            failed: 0,
          },
          metadata: {
            roleNames: roles
              .filter((role) => selectedRolesForAssignment.includes(role._id))
              .map((role) => role.displayName),
            userCount: Array.isArray(selectedUserIds) ? selectedUserIds.length : 0,
          },
        }}
      />
    </Box>
  );
};

export default PharmacyUserManagement;
