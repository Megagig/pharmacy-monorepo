import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { useUIStore } from '../../stores';
import LoadingSpinner from '../LoadingSpinner';
import BulkOperationProgress from '../rbac/BulkOperationProgress';
import {
  getAllUsers,
  updateUserRole,
  suspendUser,
  approveLicense,
  rejectLicense,
  getAllRoles,
  bulkAssignRoles,
  bulkRevokeRoles,
  getPendingLicenses,
  getSystemAnalytics,
} from '../../services/rbacService';
import type { BulkRoleAssignment, DynamicUser, Role } from '../../types/rbac';

// Import the new admin components
import SecurityDashboard from './SecurityDashboard';
import UsageMonitoring from './UsageMonitoring';
import InvitationManagement from './InvitationManagement';
import LocationManagement from './LocationManagement';
import AdvancedSubscriptionAnalytics from '../subscription/AdvancedSubscriptionAnalytics';
import EnhancedAnalytics from './EnhancedAnalytics';
import AIUsageMonitoring from './AIUsageMonitoring';

interface License {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  workplaceName?: string;
  licenseNumber: string;
  licenseStatus?: string;
  pharmacySchool?: string;
  yearOfGraduation?: number;
  expirationDate?: string;
  documentInfo?: {
    fileName: string;
    uploadedAt: string;
    fileSize?: number;
  };
}

interface Analytics {
  users: { _id: string; count: number; active: number }[];
  subscriptions: {
    _id: string;
    count: number;
    active: number;
    revenue: number;
  }[];
  licenses: { _id: string; count: number }[];
  generated: string;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<DynamicUser[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState<DynamicUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    licenseStatus: '',
  });
  const [licenseFilters, setLicenseFilters] = useState({
    status: '',
    search: '',
  });
  const [pendingLicenseCount, setPendingLicenseCount] = useState(0);

  // Bulk operation states
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkRevokeDialogOpen, setBulkRevokeDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [bulkOperationId, setBulkOperationId] = useState<string>('');
  const [bulkOperationProgressOpen, setBulkOperationProgressOpen] =
    useState(false);
  const [isTemporary, setIsTemporary] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [revocationReason, setRevocationReason] = useState<string>('');

  const addNotification = useUIStore((state) => state.addNotification);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters, licenseFilters]);

  useEffect(() => {
    if (activeTab === 0) {
      loadRoles();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 0: // Users
          await loadUsers();
          break;
        case 1: // Licenses
          await loadLicenses();
          break;
        case 2: // Analytics
          await loadAnalytics();
          break;
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load data',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getAllUsers({
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      });

      if (response.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadLicenses = async () => {
    try {
      // Fetch all licenses with current filters
      const response = await getPendingLicenses({
        status: licenseFilters.status || undefined,
        search: licenseFilters.search || undefined,
      });

      if (response.success) {
        setLicenses(response.data.licenses as License[]);
      }

      // Fetch pending count for badge
      const pendingResponse = await getPendingLicenses({ status: 'pending' });
      if (pendingResponse.success) {
        setPendingLicenseCount(pendingResponse.data.licenses.length);
      }
    } catch (error) {
      console.error('Failed to load licenses:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await getSystemAnalytics();

      if (response.success) {
        // Convert SystemAnalytics to our Analytics interface
        const convertedAnalytics: Analytics = {
          users: response.data.userAnalytics.byRole.map((item) => ({
            _id: item._id,
            count: item.count,
            active: item.count, // Use count as active since we don't have active count
          })),
          subscriptions: response.data.userAnalytics.byStatus.map((item) => ({
            _id: item._id,
            count: item.count,
            active: item.count,
            revenue: 0, // Default revenue since we don't have this data
          })),
          licenses: response.data.permissionAnalytics.byCategory.map(
            (item) => ({
              _id: item._id,
              count: item.count,
            })
          ),
          generated: new Date().toISOString(),
        };
        setAnalytics(convertedAnalytics);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await getAllRoles({ page: 1, limit: 100 });
      if (response.success) {
        setRoles(response.data.roles);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      const response = await updateUserRole(userId, role);

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'User role updated successfully',
          duration: 5000,
        });
        loadUsers();
        setEditDialogOpen(false);
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update user role',
        duration: 5000,
      });
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const response = await suspendUser(userId, 'Administrative action');

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'User suspended successfully',
          duration: 5000,
        });
        loadUsers();
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to suspend user',
        duration: 5000,
      });
    }
  };

  const handleApproveLicense = async (userId: string) => {
    try {
      const response = await approveLicense(userId);

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'License approved successfully',
          duration: 5000,
        });
        loadLicenses();
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to approve license',
        duration: 5000,
      });
    }
  };

  const handleRejectLicense = async (userId: string, reason: string) => {
    try {
      const response = await rejectLicense(userId, reason);

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'License rejected',
          duration: 5000,
        });
        loadLicenses();
        setLicenseDialogOpen(false);
      }
    } catch {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to reject license',
        duration: 5000,
      });
    }
  };

  // Bulk role assignment handlers
  const handleBulkAssignRoles = async () => {
    if (selectedUsers.length === 0 || selectedRoles.length === 0) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Please select at least one user and one role',
        duration: 5000,
      });
      return;
    }

    try {
      const bulkData: BulkRoleAssignment = {
        userIds: selectedUsers,
        roleIds: selectedRoles,
        workspaceId: undefined,
        isTemporary,
        expiresAt: isTemporary ? expiresAt : undefined,
        assignmentReason,
      };

      const response = await bulkAssignRoles(
        bulkData.userIds,
        bulkData.roleIds[0]
      );

      if (response.success) {
        setBulkOperationId('');
        setBulkOperationProgressOpen(true);
        setBulkAssignDialogOpen(false);
        addNotification({
          type: 'success',
          title: 'Bulk Operation Started',
          message: 'Bulk role assignment has been initiated',
          duration: 5000,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Error',
          message: response.message || 'Failed to start bulk role assignment',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error in bulk role assignment:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to start bulk role assignment',
        duration: 5000,
      });
    }
  };

  const handleBulkRevokeRoles = async () => {
    if (selectedUsers.length === 0 || selectedRoles.length === 0) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Please select at least one user and one role',
        duration: 5000,
      });
      return;
    }

    try {
      const response = await bulkRevokeRoles(selectedUsers, selectedRoles[0]);

      if (response.success) {
        setBulkOperationId('');
        setBulkOperationProgressOpen(true);
        setBulkRevokeDialogOpen(false);
        addNotification({
          type: 'success',
          title: 'Bulk Operation Started',
          message: 'Bulk role revocation has been initiated',
          duration: 5000,
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Error',
          message: response.message || 'Failed to start bulk role revocation',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error in bulk role revocation:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to start bulk role revocation',
        duration: 5000,
      });
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    }
  };

  const handleRoleSelection = (roleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles([...selectedRoles, roleId]);
    } else {
      setSelectedRoles(selectedRoles.filter((id) => id !== roleId));
    }
  };

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map((user) => user._id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectAllRoles = (checked: boolean) => {
    if (checked) {
      setSelectedRoles(roles.map((role) => role._id));
    } else {
      setSelectedRoles([]);
    }
  };

  const getStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'error';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRoleColor = (
    role: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'pharmacy_outlet':
        return 'primary';
      case 'pharmacy_team':
        return 'secondary';
      case 'pharmacist':
        return 'info';
      case 'intern_pharmacist':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getLicenseStatusColor = (
    status: string
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'not_required':
        return 'default';
      default:
        return 'default';
    }
  };

  const getSubscriptionColor = (
    tier: string | undefined
  ):
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (tier) {
      case 'enterprise':
        return 'error';
      case 'pro':
      case 'network':
        return 'primary';
      case 'basic':
        return 'info';
      case 'free_trial':
      case 'trial':
        return 'warning';
      case 'active':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading && !users.length && !licenses.length && !analytics) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Box sx={{ px: 0, pt: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ px: 3 }}>
          Admin Dashboard
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, px: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<PeopleIcon />}
            label="User Management"
            iconPosition="start"
          />
          <Tab
            icon={
              <Badge badgeContent={pendingLicenseCount} color="error">
                <AssignmentIcon />
              </Badge>
            }
            label="License Verification"
            iconPosition="start"
          />
          <Tab
            icon={<AnalyticsIcon />}
            label="Analytics"
            iconPosition="start"
          />
          <Tab icon={<SecurityIcon />} label="Security" iconPosition="start" />
          <Tab
            icon={<TrendingUpIcon />}
            label="Usage Monitoring"
            iconPosition="start"
          />
          <Tab icon={<EmailIcon />} label="Invitations" iconPosition="start" />
          <Tab
            icon={<LocationOnIcon />}
            label="Locations"
            iconPosition="start"
          />
          <Tab
            icon={<SettingsIcon />}
            label="System Settings"
            iconPosition="start"
          />
          <Tab
            icon={<AnalyticsIcon />}
            label="AI Usage Monitoring"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Users Tab */}
      {activeTab === 0 && (
        <Box sx={{ px: 3 }}>
          {/* Bulk Actions */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<PlaylistAddCheckIcon />}
              onClick={() => setBulkAssignDialogOpen(true)}
              disabled={selectedUsers.length === 0}
            >
              Bulk Assign Roles ({selectedUsers.length})
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RemoveCircleIcon />}
              onClick={() => setBulkRevokeDialogOpen(true)}
              disabled={selectedUsers.length === 0}
            >
              Bulk Revoke Roles ({selectedUsers.length})
            </Button>
          </Box>

          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={filters.role}
                  onChange={(e) =>
                    setFilters({ ...filters, role: e.target.value })
                  }
                >
                  <MenuItem value="">All Roles</MenuItem>
                  <MenuItem value="pharmacist">Pharmacist</MenuItem>
                  <MenuItem value="pharmacy_team">Pharmacy Team</MenuItem>
                  <MenuItem value="pharmacy_outlet">Pharmacy Outlet</MenuItem>
                  <MenuItem value="intern_pharmacist">
                    Intern Pharmacist
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Users Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={
                        selectedUsers.length === users.length &&
                        users.length > 0
                      }
                      indeterminate={
                        selectedUsers.length > 0 &&
                        selectedUsers.length < users.length
                      }
                      onChange={(e) => handleSelectAllUsers(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>License Status</TableCell>
                  <TableCell>Subscription</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedUsers.includes(user._id)}
                        onChange={(e) =>
                          handleUserSelection(user._id, e.target.checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={(user.role || user.systemRole || 'No Role').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        color={getRoleColor(user.role || user.systemRole || 'unknown')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status || 'Unknown'}
                        color={getStatusColor(user.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(user.licenseStatus || 'not_required').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        color={getLicenseStatusColor(user.licenseStatus || 'not_required')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(user.subscriptionTier || user.subscriptionStatus || 'No Subscription').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        variant="outlined"
                        size="small"
                        color={getSubscriptionColor(user.subscriptionTier || user.subscriptionStatus)}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit User">
                        <IconButton
                          onClick={() => {
                            setSelectedUser(user);
                            setEditDialogOpen(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Suspend User">
                        <IconButton
                          onClick={() => handleSuspendUser(user._id)}
                          disabled={user.status === 'suspended'}
                        >
                          <BlockIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={-1}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) =>
                setRowsPerPage(parseInt(e.target.value))
              }
            />
          </TableContainer>
        </Box>
      )}

      {/* Licenses Tab */}
      {activeTab === 1 && (
        <Box sx={{ px: 3 }}>
          {/* License Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={licenseFilters.status}
                  onChange={(e) =>
                    setLicenseFilters({
                      ...licenseFilters,
                      status: e.target.value,
                    })
                  }
                >
                  <MenuItem value="">All Licenses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="Search by name, email, or license number"
                value={licenseFilters.search}
                onChange={(e) =>
                  setLicenseFilters({
                    ...licenseFilters,
                    search: e.target.value,
                  })
                }
              />
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>License Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Document</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {licenses.map((license) => (
                  <TableRow key={license.userId}>
                    <TableCell>
                      {license.userName}
                    </TableCell>
                    <TableCell>{license.userEmail}</TableCell>
                    <TableCell>{license.licenseNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={(license.licenseStatus || 'pending').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        color={getLicenseStatusColor(license.licenseStatus || 'pending')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {license.documentInfo ? (
                        <Button
                          startIcon={<DownloadIcon />}
                          size="small"
                          onClick={() => {
                            window.open(
                              `/api/license/document/${license.userId}`,
                              '_blank'
                            );
                          }}
                        >
                          {license.documentInfo.fileName}
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No document
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {license.documentInfo?.uploadedAt
                        ? new Date(license.documentInfo.uploadedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Approve License">
                        <IconButton
                          onClick={() => handleApproveLicense(license.userId)}
                          color="success"
                          disabled={license.licenseStatus === 'approved'}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reject License">
                        <IconButton
                          onClick={() => {
                            setSelectedLicense(license as any);
                            setLicenseDialogOpen(true);
                          }}
                          color="error"
                          disabled={license.licenseStatus === 'rejected'}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Analytics Tab */}
      {activeTab === 2 && (
        <Box sx={{ width: '100%', maxWidth: '100%', px: 0 }}>
          <EnhancedAnalytics />
        </Box>
      )}

      {/* Security Dashboard Tab */}
      {activeTab === 3 && <SecurityDashboard />}

      {/* Usage Monitoring Tab */}
      {activeTab === 4 && <UsageMonitoring />}

      {/* Invitation Management Tab */}
      {activeTab === 5 && <InvitationManagement />}

      {/* Location Management Tab */}
      {activeTab === 6 && <LocationManagement />}

      {/* Advanced Subscription Analytics Tab */}
      {activeTab === 7 && <AdvancedSubscriptionAnalytics />}

      {/* System Settings Tab */}
      {activeTab === 8 && (
        <Box sx={{ px: 3 }}>
          <Alert severity="info">
            System settings panel will be available in the next update.
          </Alert>
        </Box>
      )}

      {/* AI Usage Monitoring Tab */}
      {activeTab === 9 && <AIUsageMonitoring />}

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit User Role</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box pt={1}>
              <Typography variant="body1" gutterBottom>
                User: {selectedUser.firstName} {selectedUser.lastName}
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={selectedUser.systemRole}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser,
                      systemRole: e.target.value,
                    })
                  }
                >
                  <MenuItem value="pharmacist">Pharmacist</MenuItem>
                  <MenuItem value="pharmacy_team">Pharmacy Team</MenuItem>
                  <MenuItem value="pharmacy_outlet">Pharmacy Outlet</MenuItem>
                  <MenuItem value="intern_pharmacist">
                    Intern Pharmacist
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              selectedUser &&
              handleUpdateUserRole(selectedUser._id, selectedUser.systemRole)
            }
            variant="contained"
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* License Rejection Dialog */}
      <Dialog
        open={licenseDialogOpen}
        onClose={() => setLicenseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject License</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Reason"
            placeholder="Please provide a reason for rejecting this license..."
            margin="normal"
            id="rejection-reason"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLicenseDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const reason = (
                document.getElementById('rejection-reason') as HTMLInputElement
              )?.value;
              if (selectedLicense && reason) {
                handleRejectLicense(selectedLicense._id, reason);
              }
            }}
            variant="contained"
            color="error"
          >
            Reject License
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Assign Roles Dialog */}
      <Dialog
        open={bulkAssignDialogOpen}
        onClose={() => setBulkAssignDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Bulk Assign Roles</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Users ({selectedUsers.length})
            </Typography>
            <Box sx={{ mb: 3, maxHeight: 150, overflow: 'auto' }}>
              {users
                .filter((user) => selectedUsers.includes(user._id))
                .map((user) => (
                  <Chip
                    key={user._id}
                    label={`${user.firstName} ${user.lastName}`}
                    sx={{ m: 0.5 }}
                  />
                ))}
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Select Roles
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={
                      selectedRoles.length === roles.length && roles.length > 0
                    }
                    indeterminate={
                      selectedRoles.length > 0 &&
                      selectedRoles.length < roles.length
                    }
                    onChange={(e) => handleSelectAllRoles(e.target.checked)}
                  />
                }
                label="Select All Roles"
              />
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {roles.map((role) => (
                  <FormControlLabel
                    key={role._id}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(role._id)}
                        onChange={(e) =>
                          handleRoleSelection(role._id, e.target.checked)
                        }
                      />
                    }
                    label={role.displayName}
                  />
                ))}
              </Box>
            </Box>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isTemporary}
                        onChange={(e) => setIsTemporary(e.target.checked)}
                      />
                    }
                    label="Temporary Assignment"
                  />
                  {isTemporary && (
                    <TextField
                      fullWidth
                      label="Expiration Date"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                  <TextField
                    fullWidth
                    label="Assignment Reason (Optional)"
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                    multiline
                    rows={2}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAssignDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBulkAssignRoles}
            variant="contained"
            disabled={selectedRoles.length === 0}
          >
            Assign Roles
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Revoke Roles Dialog */}
      <Dialog
        open={bulkRevokeDialogOpen}
        onClose={() => setBulkRevokeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Bulk Revoke Roles</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Users ({selectedUsers.length})
            </Typography>
            <Box sx={{ mb: 3, maxHeight: 150, overflow: 'auto' }}>
              {users
                .filter((user) => selectedUsers.includes(user._id))
                .map((user) => (
                  <Chip
                    key={user._id}
                    label={`${user.firstName} ${user.lastName}`}
                    sx={{ m: 0.5 }}
                  />
                ))}
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Select Roles to Revoke
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={
                      selectedRoles.length === roles.length && roles.length > 0
                    }
                    indeterminate={
                      selectedRoles.length > 0 &&
                      selectedRoles.length < roles.length
                    }
                    onChange={(e) => handleSelectAllRoles(e.target.checked)}
                  />
                }
                label="Select All Roles"
              />
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {roles.map((role) => (
                  <FormControlLabel
                    key={role._id}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(role._id)}
                        onChange={(e) =>
                          handleRoleSelection(role._id, e.target.checked)
                        }
                      />
                    }
                    label={role.displayName}
                  />
                ))}
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Revocation Reason (Optional)"
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkRevokeDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBulkRevokeRoles}
            variant="contained"
            color="error"
            disabled={selectedRoles.length === 0}
          >
            Revoke Roles
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Operation Progress Dialog */}
      <BulkOperationProgress
        open={bulkOperationProgressOpen}
        onClose={() => {
          setBulkOperationProgressOpen(false);
          setSelectedUsers([]);
          setSelectedRoles([]);
          loadData();
        }}
        operationId={bulkOperationId}
        initialData={{
          type: 'role_assignment',
          status: 'pending',
          progress: {
            total: selectedUsers.length,
            processed: 0,
            successful: 0,
            failed: 0,
          },
          startTime: new Date().toISOString(),
          errors: [],
          warnings: [],
          metadata: {
            userCount: selectedUsers.length,
          },
        }}
      />
    </Box>
  );
};

export default AdminDashboard;
