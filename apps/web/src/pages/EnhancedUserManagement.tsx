// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Button,
    IconButton,
    Chip,
    Avatar,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Tooltip,
    Badge,
    CircularProgress,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    LinearProgress,
    Divider,
    Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HistoryIcon from '@mui/icons-material/History';
import SpeedIcon from '@mui/icons-material/Speed';
import ShieldIcon from '@mui/icons-material/Shield';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ScheduleIcon from '@mui/icons-material/Schedule';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import * as adminService from '../services/adminService';
import * as rbacService from '../services/rbacService';
import { useRBAC } from '../hooks/useRBAC';

// Tab Panel Component
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`rbac-tabpanel-${index}`}
            aria-labelledby={`rbac-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

// Statistics Card Component
interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    trend?: string;
    loading?: boolean;
}

function StatCard({ title, value, icon, color, trend, loading }: StatCardProps) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: color, mr: 2 }}>
                        {icon}
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Box>
                {loading ? (
                    <CircularProgress size={24} />
                ) : (
                    <>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                            {value}
                        </Typography>
                        {trend && (
                            <Chip
                                label={trend}
                                size="small"
                                color={trend.startsWith('+') ? 'success' : 'error'}
                                variant="outlined"
                            />
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

const EnhancedUserManagement: React.FC = () => {
    const navigate = useNavigate();
    const { hasFeature, canAccess } = useRBAC();

    // Tab state
    const [currentTab, setCurrentTab] = useState(0);

    // Data states
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>({});
    const [roleHierarchy, setRoleHierarchy] = useState<any>(null);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Dialog states
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userDetailsOpen, setUserDetailsOpen] = useState(false);
    const [roleAssignmentOpen, setRoleAssignmentOpen] = useState(false);
    const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
    const [auditTrailOpen, setAuditTrailOpen] = useState(false);
    const [bulkOperationOpen, setBulkOperationOpen] = useState(false);

    // Selection states
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    const [selectedRolesForAssignment, setSelectedRolesForAssignment] = useState<string[]>([]);
    const [directPermissions, setDirectPermissions] = useState<string[]>([]);
    const [deniedPermissions, setDeniedPermissions] = useState<string[]>([]);

    // Preview and conflict states
    const [permissionPreview, setPermissionPreview] = useState<any>(null);
    const [detectedConflicts, setDetectedConflicts] = useState<any>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<any>([]);
    const [auditTrail, setAuditTrail] = useState<any[]>([]);

    // Notification state
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'warning' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'info',
    });

    // Fetch all data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes, permsRes] = await Promise.all([
                rbacService.getAllUsers(),
                rbacService.getAllRoles(),
                rbacService.getAllPermissions(),
            ]);

            if (usersRes.success) setUsers(usersRes.data?.users || []);
            if (rolesRes.success) setRoles(rolesRes.data?.roles || []);
            if (permsRes.success) setPermissions(permsRes.data?.permissions || []);

            // Debug logging
            if (usersRes.success && usersRes.data?.users?.length > 0) {



            }
        } catch (error) {
            console.error('Error fetching data:', error);
            showSnackbar('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch statistics
    const fetchStatistics = useCallback(async () => {
        setStatsLoading(true);
        try {
            // Using basic counts from data already fetched
            setStatistics({
                totalUsers: users.length,
                totalRoles: roles.length,
                totalPermissions: permissions.length,
                activeUsers: users.filter((u: any) => u.status === 'active').length,
            });
        } catch (error) {
            console.error('Error fetching statistics:', error);
        } finally {
            setStatsLoading(false);
        }
    }, [users, roles, permissions]);

    // Fetch role hierarchy
    const fetchRoleHierarchy = useCallback(async () => {
        try {
            const response = await rbacService.getRoleHierarchyTree();
            if (response.success) {
                setRoleHierarchy(response.data);
            }
        } catch (error) {
            console.error('Error fetching role hierarchy:', error);
        }
    }, []);

    // Fetch audit logs
    const fetchAuditLogs = useCallback(async () => {
        try {
            const response = await rbacService.getAuditDashboard();
            if (response.success) {
                setAuditLogs(response.data?.recentActivity || []);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    }, []);

    // Initial data fetch - run only once on mount
    useEffect(() => {
        fetchData();
        fetchRoleHierarchy();
        fetchAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update statistics when data changes
    useEffect(() => {
        if (users.length > 0 || roles.length > 0 || permissions.length > 0) {
            fetchStatistics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, roles, permissions]);

    const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // User selection handlers
    const handleSelectUser = (userId: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedUserIds(filteredUsers.map((user) => user._id));
        } else {
            setSelectedUserIds([]);
        }
    };

    // View user details
    const handleViewUserDetails = async (user: any) => {
        setSelectedUser(user);
        setActionLoading(true);
        try {
            // Fetch effective permissions
            const response = await rbacService.getUserEffectivePermissions(user._id);
            if (response.success) {
                setEffectivePermissions(response.data.permissions || []);
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            showSnackbar('Failed to load user details', 'error');
        } finally {
            setActionLoading(false);
            setUserDetailsOpen(true);
        }
    };

    // Assign roles
    const handleAssignRoles = async () => {
        if (selectedUserIds.length === 0 || selectedRoleIds.length === 0) {
            showSnackbar('Please select users and roles', 'warning');
            return;
        }

        setActionLoading(true);
        try {
            const response = await rbacService.assignUserRoles({
                userIds: selectedUserIds,
                roleIds: selectedRoleIds,
                // Don't send workspaceId if not needed (avoids ObjectId cast error)
                isTemporary: false,
            });

            if (response.success) {
                showSnackbar('Roles assigned successfully', 'success');
                setRoleAssignmentOpen(false);
                setSelectedRoleIds([]);
                setSelectedUserIds([]);
                fetchData();
            } else {
                showSnackbar(response.message || 'Failed to assign roles', 'error');
            }
        } catch (error) {
            console.error('Error assigning roles:', error);
            showSnackbar('Failed to assign roles', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Preview permission changes
    const handlePreviewPermissions = async () => {
        if (!selectedUser || selectedRolesForAssignment.length === 0) {
            showSnackbar('Please select roles to preview', 'warning');
            return;
        }

        setActionLoading(true);
        try {
            const response = await rbacService.previewPermissionChanges(selectedUser._id, {
                roleIds: selectedRolesForAssignment,
                directPermissions,
                deniedPermissions,
            });

            if (response.success) {
                setPermissionPreview(response.data);
            } else {
                showSnackbar('Failed to preview permissions', 'error');
            }
        } catch (error) {
            console.error('Error previewing permissions:', error);
            showSnackbar('Failed to preview permissions', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Detect conflicts
    const handleDetectConflicts = async (user: any) => {
        setSelectedUser(user);
        setActionLoading(true);
        try {
            const roleIds = user.assignedRoles || [];
            const response = await rbacService.detectRoleConflicts(user._id, roleIds);
            if (response.success) {
                setDetectedConflicts(response.data);
                setConflictDialogOpen(true);
            } else {
                showSnackbar('No conflicts detected', 'success');
            }
        } catch (error) {
            console.error('Error detecting conflicts:', error);
            showSnackbar('Failed to detect conflicts', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Resolve conflicts
    const handleResolveConflicts = async (resolution: any) => {
        if (!selectedUser) return;

        setActionLoading(true);
        try {
            const response = await rbacService.resolveRoleConflicts(selectedUser._id, resolution);
            if (response.success) {
                showSnackbar('Conflicts resolved successfully', 'success');
                setConflictDialogOpen(false);
                fetchData();
            } else {
                showSnackbar('Failed to resolve conflicts', 'error');
            }
        } catch (error) {
            console.error('Error resolving conflicts:', error);
            showSnackbar('Failed to resolve conflicts', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // View audit trail
    const handleViewAuditTrail = async (user: any) => {
        setSelectedUser(user);
        setActionLoading(true);
        try {
            const response = await rbacService.getUserAuditTrail(user._id);
            if (response.success) {
                setAuditTrail(response.data || []);
                setAuditTrailOpen(true);
            }
        } catch (error) {
            console.error('Error fetching audit trail:', error);
            showSnackbar('Failed to load audit trail', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Refresh cache
    const handleRefreshCache = async (userId: string) => {
        setActionLoading(true);
        try {
            const response = await rbacService.refreshUserPermissionCache(userId);
            if (response.success) {
                showSnackbar('Cache refreshed successfully', 'success');
                fetchData();
            }
        } catch (error) {
            console.error('Error refreshing cache:', error);
            showSnackbar('Failed to refresh cache', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Filter users
    const filteredUsers = users.filter((user) => {
        const matchesSearch =
            !searchTerm ||
            `${user.firstName || ''} ${user.lastName || ''}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = !statusFilter || user.status === statusFilter;

        const matchesRole =
            roleFilter.length === 0 ||
            (user.assignedRoles &&
                user.assignedRoles.some((roleId: string) => roleFilter.includes(roleId)));

        return matchesSearch && matchesStatus && matchesRole;
    });

    // Pagination
    const paginatedUsers = filteredUsers.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    if (!hasFeature('user_management')) {
        return (
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Alert severity="warning">
                    You don't have permission to access User Management. Please contact your administrator.
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                            <AdminIcon fontSize="large" />
                        </Avatar>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                Role-Based Access Control
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Comprehensive user management with dynamic RBAC system
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Refresh all data">
                            <IconButton
                                onClick={() => {
                                    fetchData();
                                    fetchStatistics();
                                    fetchRoleHierarchy();
                                    fetchAuditLogs();
                                }}
                                disabled={loading}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Export data">
                            <IconButton>
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Statistics Cards */}
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Total Users"
                            value={statistics?.totalUsers || users.length}
                            icon={<PeopleIcon />}
                            color="#1976d2"
                            trend={statistics?.usersTrend}
                            loading={statsLoading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Active Roles"
                            value={roles.filter((r) => r.isActive).length}
                            icon={<SecurityIcon />}
                            color="#2e7d32"
                            trend={statistics?.rolesTrend}
                            loading={statsLoading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Permissions"
                            value={permissions.length}
                            icon={<VpnKeyIcon />}
                            color="#ed6c02"
                            loading={statsLoading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            title="Pending Approvals"
                            value={statistics?.pendingApprovals || 0}
                            icon={<WarningIcon />}
                            color="#d32f2f"
                            loading={statsLoading}
                        />
                    </Grid>
                </Grid>
            </Box>

            {/* Tabs Navigation */}
            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={currentTab}
                    onChange={(_, newValue) => setCurrentTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        '& .MuiTab-root': {
                            minHeight: 64,
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 500,
                        },
                    }}
                >
                    <Tab icon={<PeopleIcon />} iconPosition="start" label="Users Overview" />
                    <Tab icon={<SecurityIcon />} iconPosition="start" label="Roles & Hierarchy" />
                    <Tab icon={<VpnKeyIcon />} iconPosition="start" label="Permissions Matrix" />
                    <Tab icon={<WarningIcon />} iconPosition="start" label="Conflicts & Alerts" />
                    <Tab icon={<HistoryIcon />} iconPosition="start" label="Audit Trail" />
                    <Tab icon={<AssessmentIcon />} iconPosition="start" label="Analytics" />
                </Tabs>
            </Paper>

            {/* Tab 0: Users Overview */}
            <TabPanel value={currentTab} index={0}>
                <UsersOverviewTab
                    users={paginatedUsers}
                    roles={roles}
                    loading={loading}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    roleFilter={roleFilter}
                    setRoleFilter={setRoleFilter}
                    selectedUserIds={selectedUserIds}
                    handleSelectUser={handleSelectUser}
                    handleSelectAll={handleSelectAll}
                    handleViewUserDetails={handleViewUserDetails}
                    handleDetectConflicts={handleDetectConflicts}
                    handleViewAuditTrail={handleViewAuditTrail}
                    handleRefreshCache={handleRefreshCache}
                    setRoleAssignmentOpen={setRoleAssignmentOpen}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    totalUsers={filteredUsers.length}
                    handleChangePage={handleChangePage}
                    handleChangeRowsPerPage={handleChangeRowsPerPage}
                />
            </TabPanel>

            {/* Tab 1: Roles & Hierarchy */}
            <TabPanel value={currentTab} index={1}>
                <RolesHierarchyTab
                    roles={roles}
                    roleHierarchy={roleHierarchy}
                    loading={loading}
                    fetchRoleHierarchy={fetchRoleHierarchy}
                />
            </TabPanel>

            {/* Tab 2: Permissions Matrix */}
            <TabPanel value={currentTab} index={2}>
                <PermissionsMatrixTab
                    permissions={permissions}
                    roles={roles}
                    loading={loading}
                    onRefresh={fetchData}
                />
            </TabPanel>

            {/* Tab 3: Conflicts & Alerts */}
            <TabPanel value={currentTab} index={3}>
                <ConflictsAlertsTab
                    users={users}
                    handleDetectConflicts={handleDetectConflicts}
                    loading={loading}
                />
            </TabPanel>

            {/* Tab 4: Audit Trail */}
            <TabPanel value={currentTab} index={4}>
                <AuditTrailTab auditLogs={auditLogs} loading={loading} />
            </TabPanel>

            {/* Tab 5: Analytics */}
            <TabPanel value={currentTab} index={5}>
                <AnalyticsTab statistics={statistics} loading={statsLoading} />
            </TabPanel>

            {/* Dialogs will be added here */}

            {/* User Details Dialog */}
            <Dialog open={userDetailsOpen} onClose={() => setUserDetailsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>User Details - {selectedUser?.firstName} {selectedUser?.lastName}</DialogTitle>
                <DialogContent>
                    {selectedUser && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                <strong>Email:</strong> {selectedUser.email}
                            </Typography>
                            <Typography variant="subtitle2" gutterBottom>
                                <strong>Status:</strong> {selectedUser.status}
                            </Typography>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                <strong>Assigned Roles:</strong>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                {(selectedUser as any).roles?.map((role: any) => (
                                    <Chip key={role._id} label={role.displayName || role.name} size="small" color="primary" />
                                ))}
                            </Box>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                <strong>Effective Permissions:</strong>
                            </Typography>
                            <Box sx={{ maxHeight: 300, overflow: 'auto', mt: 1 }}>
                                {effectivePermissions.map((perm: string, index: number) => (
                                    <Chip key={index} label={perm} size="small" sx={{ m: 0.5 }} />
                                ))}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUserDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Audit Trail Dialog */}
            <Dialog open={auditTrailOpen} onClose={() => setAuditTrailOpen(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Audit Trail - {selectedUser?.firstName} {selectedUser?.lastName}</DialogTitle>
                <DialogContent>
                    {auditTrail.length > 0 ? (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Timestamp</TableCell>
                                        <TableCell>Action</TableCell>
                                        <TableCell>Details</TableCell>
                                        <TableCell>Performed By</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {auditTrail.map((entry: any, index: number) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                {new Date(entry.timestamp || entry.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={entry.action || entry.type} size="small" />
                                            </TableCell>
                                            <TableCell>{entry.details || entry.description || 'N/A'}</TableCell>
                                            <TableCell>{entry.performedBy || entry.userId || 'System'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No audit trail available
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAuditTrailOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Role Assignment Dialog */}
            <Dialog open={roleAssignmentOpen} onClose={() => setRoleAssignmentOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign Roles to Users</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            Selected Users: {selectedUserIds.length}
                        </Typography>
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>Select Roles</InputLabel>
                            <Select
                                multiple
                                value={selectedRoleIds}
                                onChange={(e) => setSelectedRoleIds(typeof e.target.value === 'string' ? [] : e.target.value)}
                                input={<OutlinedInput label="Select Roles" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const role = roles.find((r) => r._id === value);
                                            return <Chip key={value} label={role?.displayName || value} size="small" />;
                                        })}
                                    </Box>
                                )}
                            >
                                {roles.map((role) => (
                                    <MenuItem key={role._id} value={role._id}>
                                        <Checkbox checked={selectedRoleIds.indexOf(role._id) > -1} />
                                        <ListItemText primary={role.displayName} secondary={role.description} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleAssignmentOpen(false)}>Cancel</Button>
                    <Button onClick={handleAssignRoles} variant="contained" disabled={selectedRoleIds.length === 0}>
                        Assign Roles
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

// Users Overview Tab Component
interface UsersOverviewTabProps {
    users: any[];
    roles: any[];
    loading: boolean;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    roleFilter: string[];
    setRoleFilter: (value: string[]) => void;
    selectedUserIds: string[];
    handleSelectUser: (userId: string) => void;
    handleSelectAll: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleViewUserDetails: (user: any) => void;
    handleDetectConflicts: (user: any) => void;
    handleViewAuditTrail: (user: any) => void;
    handleRefreshCache: (userId: string) => void;
    setRoleAssignmentOpen: (open: boolean) => void;
    page: number;
    rowsPerPage: number;
    totalUsers: number;
    handleChangePage: (event: unknown, newPage: number) => void;
    handleChangeRowsPerPage: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function UsersOverviewTab({
    users,
    roles,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    selectedUserIds,
    handleSelectUser,
    handleSelectAll,
    handleViewUserDetails,
    handleDetectConflicts,
    handleViewAuditTrail,
    handleRefreshCache,
    setRoleAssignmentOpen,
    page,
    rowsPerPage,
    totalUsers,
    handleChangePage,
    handleChangeRowsPerPage,
}: UsersOverviewTabProps) {
    return (
        <Box>
            {/* Toolbar */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth>
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
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                            <InputLabel>Roles</InputLabel>
                            <Select
                                multiple
                                value={roleFilter}
                                onChange={(e) =>
                                    setRoleFilter(typeof e.target.value === 'string' ? [] : e.target.value)
                                }
                                input={<OutlinedInput label="Roles" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const role = roles.find((r) => r._id === value);
                                            return <Chip key={value} label={role?.displayName || value} size="small" />;
                                        })}
                                    </Box>
                                )}
                            >
                                {roles.map((role) => (
                                    <MenuItem key={role._id} value={role._id}>
                                        <Checkbox checked={roleFilter.indexOf(role._id) > -1} />
                                        <ListItemText primary={role.displayName} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<SecurityIcon />}
                            onClick={() => setRoleAssignmentOpen(true)}
                            disabled={selectedUserIds.length === 0}
                        >
                            Assign Roles ({selectedUserIds.length})
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Users Table */}
            <Paper>
                {loading ? (
                    <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                indeterminate={
                                                    selectedUserIds.length > 0 && selectedUserIds.length < users.length
                                                }
                                                checked={users.length > 0 && selectedUserIds.length === users.length}
                                                onChange={handleSelectAll}
                                            />
                                        </TableCell>
                                        <TableCell>User</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>System Role</TableCell>
                                        <TableCell>Dynamic Roles</TableCell>
                                        <TableCell>Direct Permissions</TableCell>
                                        <TableCell>Last Active</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user._id} hover>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedUserIds.includes(user._id)}
                                                    onChange={() => handleSelectUser(user._id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar sx={{ width: 32, height: 32 }}>
                                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {user.firstName} {user.lastName}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {user.email}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.status || 'Unknown'}
                                                    size="small"
                                                    color={
                                                        user.status === 'active'
                                                            ? 'success'
                                                            : user.status === 'pending'
                                                                ? 'warning'
                                                                : 'error'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.role || 'user'}
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {/* Use roles array from backend (populated from UserRole table) */}
                                                    {(user as any).roles && Array.isArray((user as any).roles) && (user as any).roles.length > 0 ? (
                                                        <>
                                                            {(user as any).roles.slice(0, 2).map((role: any) => (
                                                                <Chip
                                                                    key={role._id || role}
                                                                    label={role.displayName || role.name || role}
                                                                    size="small"
                                                                    color="primary"
                                                                    variant="outlined"
                                                                />
                                                            ))}
                                                            {(user as any).roles.length > 2 && (
                                                                <Chip
                                                                    label={`+${(user as any).roles.length - 2}`}
                                                                    size="small"
                                                                    color="default"
                                                                />
                                                            )}
                                                        </>
                                                    ) : user.assignedRoles && Array.isArray(user.assignedRoles) && user.assignedRoles.length > 0 ? (
                                                        <>
                                                            {user.assignedRoles.slice(0, 2).map((roleId: string) => {
                                                                const role = roles.find((r) => r._id === roleId);
                                                                return (
                                                                    <Chip
                                                                        key={roleId}
                                                                        label={role?.displayName || role?.name || 'Unknown'}
                                                                        size="small"
                                                                        color="primary"
                                                                        variant="outlined"
                                                                    />
                                                                );
                                                            })}
                                                            {user.assignedRoles.length > 2 && (
                                                                <Chip
                                                                    label={`+${user.assignedRoles.length - 2}`}
                                                                    size="small"
                                                                    color="default"
                                                                />
                                                            )}
                                                        </>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">
                                                            No roles assigned
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={user.directPermissions?.length || 0}
                                                    size="small"
                                                    icon={<VpnKeyIcon />}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption">
                                                    {(user as any).lastLoginAt || user.lastActive
                                                        ? new Date((user as any).lastLoginAt || user.lastActive).toLocaleDateString()
                                                        : 'Never'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => handleViewUserDetails(user)}>
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Detect Conflicts">
                                                    <IconButton size="small" onClick={() => handleDetectConflicts(user)}>
                                                        <WarningIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Audit Trail">
                                                    <IconButton size="small" onClick={() => handleViewAuditTrail(user)}>
                                                        <HistoryIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Refresh Cache">
                                                    <IconButton size="small" onClick={() => handleRefreshCache(user._id)}>
                                                        <RefreshIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            component="div"
                            count={totalUsers}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                )}
            </Paper>
        </Box>
    );
}

// Placeholder components for other tabs (will be implemented next)
function RolesHierarchyTab({ roles, roleHierarchy, loading, fetchRoleHierarchy }: any) {
    const [expandedRoles, setExpandedRoles] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<any>(null);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [roleForm, setRoleForm] = useState({
        name: '',
        displayName: '',
        description: '',
        level: 1,
        isSystemRole: false,
    });

    // Debug: Log roles data
    React.useEffect(() => {


    }, [roles, roleHierarchy]);

    const handleToggleExpand = (roleId: string) => {
        setExpandedRoles((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
        );
    };

    const handleEditRole = (role: any) => {
        setSelectedRole(role);
        setRoleForm({
            name: role.name || '',
            displayName: role.displayName || '',
            description: role.description || '',
            level: role.level || 1,
            isSystemRole: role.isSystemRole || false,
        });
        setEditMode(true);
        setRoleDialogOpen(true);
    };

    const handleCreateRole = () => {
        setSelectedRole(null);
        setRoleForm({
            name: '',
            displayName: '',
            description: '',
            level: 1,
            isSystemRole: false,
        });
        setEditMode(false);
        setRoleDialogOpen(true);
    };

    const handleSaveRole = async () => {
        try {
            if (editMode && selectedRole) {
                await rbacService.updateRole(selectedRole._id, roleForm);
            } else {
                await rbacService.createRole(roleForm);
            }
            setRoleDialogOpen(false);
            fetchRoleHierarchy();
        } catch (error) {
            console.error('Error saving role:', error);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (window.confirm('Are you sure you want to delete this role?')) {
            try {
                await rbacService.deleteRole(roleId);
                fetchRoleHierarchy();
            } catch (error) {
                console.error('Error deleting role:', error);
            }
        }
    };

    const renderRoleTree = (role: any, depth: number = 0) => {
        const hasChildren = role.children && role.children.length > 0;
        const isExpanded = expandedRoles.includes(role._id);

        return (
            <Box key={role._id} sx={{ ml: depth * 4 }}>
                <Accordion
                    expanded={isExpanded}
                    onChange={() => handleToggleExpand(role._id)}
                    sx={{ mb: 1 }}
                >
                    <AccordionSummary expandIcon={hasChildren ? <ExpandMoreIcon /> : null}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <AccountTreeIcon color="primary" />
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {role.displayName || role.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Level {role.level} • {role.permissions?.length || 0} permissions
                                </Typography>
                            </Box>
                            <Chip
                                label={role.isSystemRole ? 'System' : 'Custom'}
                                size="small"
                                color={role.isSystemRole ? 'error' : 'success'}
                                variant="outlined"
                            />
                            <IconButton size="small" onClick={() => handleEditRole(role)}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                            {!role.isSystemRole && (
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteRole(role._id)}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ pl: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {role.description || 'No description available'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                                {role.permissions?.slice(0, 5).map((perm: string) => (
                                    <Chip key={perm} label={perm} size="small" variant="outlined" />
                                ))}
                                {role.permissions?.length > 5 && (
                                    <Chip label={`+${role.permissions.length - 5} more`} size="small" />
                                )}
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>
                {hasChildren &&
                    isExpanded &&
                    role.children.map((child: any) => renderRoleTree(child, depth + 1))}
            </Box>
        );
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Role Hierarchy & Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchRoleHierarchy}
                    >
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateRole}>
                        Create Role
                    </Button>
                </Box>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Role Hierarchy Tree ({roles.length} roles)
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    {roles && roles.length > 0 ? (
                        // If we have roleHierarchy, show it; otherwise show flat list
                        (roleHierarchy && roleHierarchy.length > 0
                            ? roleHierarchy.map((role: any) => renderRoleTree(role))
                            : roles.map((role: any) => renderRoleTree(role, 0))
                        )
                    ) : (
                        <Alert severity="info">No roles available. Create roles to get started.</Alert>
                    )}
                </Paper>
            )}

            {/* Role Dialog */}
            <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Role Name"
                            value={roleForm.name}
                            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Display Name"
                            value={roleForm.displayName}
                            onChange={(e) => setRoleForm({ ...roleForm, displayName: e.target.value })}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Description"
                            value={roleForm.description}
                            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={3}
                        />
                        <TextField
                            label="Level"
                            type="number"
                            value={roleForm.level}
                            onChange={(e) => setRoleForm({ ...roleForm, level: parseInt(e.target.value) })}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialogOpen(false)} startIcon={<CancelIcon />}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveRole} variant="contained" startIcon={<SaveIcon />}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function PermissionsMatrixTab({ permissions, roles, loading, onRefresh }: any) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [permissionMatrix, setPermissionMatrix] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [createPermissionOpen, setCreatePermissionOpen] = useState(false);
    const [updatingPermission, setUpdatingPermission] = useState<string>('');
    const [permissionForm, setPermissionForm] = useState({
        name: '',
        displayName: '',
        description: '',
        category: '',
        resource: '',
        action: ''
    });

    useEffect(() => {
        fetchPermissionMatrix();
        fetchCategories();
    }, []);

    const fetchPermissionMatrix = async () => {
        setMatrixLoading(true);
        try {
            const response = await rbacService.getPermissionMatrix();
            setPermissionMatrix(response.data || []);
        } catch (error) {
            console.error('Error fetching permission matrix:', error);
        } finally {
            setMatrixLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await rbacService.getPermissionCategories();
            // Ensure categories is an array of strings
            const cats = response.data?.categories || [];
            const validCategories = cats.filter((cat: any) => typeof cat === 'string' && cat.trim() !== '');
            setCategories(validCategories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            setCategories([]);
        }
    };

    const handlePermissionToggle = async (roleId: string, permissionId: string, currentlyHas: boolean) => {
        const toggleKey = `${roleId}-${permissionId}`;

        // Prevent duplicate clicks
        if (updatingPermission === toggleKey) {

            return;
        }

        setUpdatingPermission(toggleKey);

        try {

            // Find the role
            const role = roles.find((r: any) => r._id === roleId);
            if (!role) {
                console.error('Role not found:', roleId);
                alert('Role not found. Please refresh the page.');
                return;
            }

            // Get current permissions
            const currentPermissions = role.permissions || [];

            // Find the permission name
            const permission = permissions.find((p: any) => p._id === permissionId);
            if (!permission) {
                console.error('Permission not found:', permissionId);
                alert('Permission not found. Please refresh the page.');
                return;
            }

            // Use action field (backend expects this) or fallback to name
            const permissionAction = permission.action || permission.name;

            let updatedPermissions;
            if (currentlyHas) {
                // Remove permission - check both action and name for compatibility
                updatedPermissions = currentPermissions.filter(
                    (p: string) => p !== permissionAction && p !== permission.name
                );

            } else {
                // Add permission using action field
                updatedPermissions = [...currentPermissions, permissionAction];

            }

            // Update role with new permissions
            const response = await rbacService.updateRole(roleId, {
                permissions: updatedPermissions
            });

            // Refresh data
            await fetchPermissionMatrix();
            if (onRefresh) {
                await onRefresh(); // Call parent's refresh function
            }
        } catch (error: any) {
            console.error('Error toggling permission:', error);
            alert(`Failed to update permission: ${error?.message || 'Unknown error'}`);
        } finally {
            setUpdatingPermission('');
        }
    };

    const handleCreatePermission = async () => {
        try {
            await rbacService.createPermission(permissionForm);
            setCreatePermissionOpen(false);
            setPermissionForm({
                name: '',
                displayName: '',
                description: '',
                category: '',
                resource: '',
                action: ''
            });
            fetchPermissionMatrix();
            fetchCategories();
            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error('Error creating permission:', error);
        }
    };

    const filteredPermissions = permissions.filter((perm: any) => {
        const matchesSearch = perm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            perm.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || perm.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Permissions Matrix
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<DownloadIcon />}>
                        Export Matrix
                    </Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPermissionMatrix}>
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreatePermissionOpen(true)}
                    >
                        Create Permission
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <TextField
                        placeholder="Search permissions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        size="small"
                        sx={{ flexGrow: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            label="Category"
                        >
                            <MenuItem value="all">All Categories</MenuItem>
                            {categories.map((cat) => (
                                <MenuItem key={cat} value={cat}>
                                    {cat}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {matrixLoading || loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, minWidth: 250 }}>Permission</TableCell>
                                    {roles.slice(0, 6).map((role: any) => (
                                        <TableCell key={role._id} align="center" sx={{ fontWeight: 600 }}>
                                            <Tooltip title={role.description || ''}>
                                                <Box>
                                                    {role.displayName || role.name}
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredPermissions.map((permission: any) => (
                                    <TableRow key={permission._id} hover>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {permission.displayName || permission.name || permission.action}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {permission.description}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        {roles.slice(0, 6).map((role: any) => {
                                            // Check both action and name for compatibility
                                            const permissionAction = permission.action || permission.name;
                                            const hasPermission = role.permissions?.includes(permissionAction) ||
                                                role.permissions?.includes(permission.name);
                                            const toggleKey = `${role._id}-${permission._id}`;
                                            const isUpdating = updatingPermission === toggleKey;

                                            return (
                                                <TableCell key={role._id} align="center">
                                                    <Checkbox
                                                        checked={hasPermission}
                                                        onChange={() =>
                                                            handlePermissionToggle(
                                                                role._id,
                                                                permission._id,
                                                                hasPermission
                                                            )
                                                        }
                                                        disabled={isUpdating}
                                                        color="success"
                                                    />
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {filteredPermissions.length === 0 && !loading && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        No permissions found matching your criteria.
                    </Alert>
                )}
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VpnKeyIcon /> Permission Categories
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        {categories.length > 0 ? (
                            categories.map((category) => (
                                <Chip
                                    key={String(category)}
                                    label={String(category)}
                                    sx={{ m: 0.5 }}
                                    onClick={() => setSelectedCategory(String(category))}
                                    color={selectedCategory === category ? 'primary' : 'default'}
                                />
                            ))
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No categories available
                            </Typography>
                        )}
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssessmentIcon /> Statistics
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Total Permissions:</Typography>
                                <Chip label={permissions?.length || 0} size="small" color="primary" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Total Roles:</Typography>
                                <Chip label={roles?.length || 0} size="small" color="secondary" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Categories:</Typography>
                                <Chip label={categories?.length || 0} size="small" color="success" />
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Create Permission Dialog */}
            <Dialog
                open={createPermissionOpen}
                onClose={() => setCreatePermissionOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create New Permission</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Permission Name"
                            placeholder="e.g., manage_inventory"
                            value={permissionForm.name}
                            onChange={(e) => setPermissionForm({ ...permissionForm, name: e.target.value })}
                            fullWidth
                            required
                            helperText="Use lowercase with underscores (e.g., read_reports)"
                        />
                        <TextField
                            label="Display Name"
                            placeholder="e.g., Manage Inventory"
                            value={permissionForm.displayName}
                            onChange={(e) => setPermissionForm({ ...permissionForm, displayName: e.target.value })}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Description"
                            placeholder="Describe what this permission allows"
                            value={permissionForm.description}
                            onChange={(e) => setPermissionForm({ ...permissionForm, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={3}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={permissionForm.category}
                                onChange={(e) => setPermissionForm({ ...permissionForm, category: e.target.value })}
                                label="Category"
                            >
                                <MenuItem value="administration">Administration</MenuItem>
                                <MenuItem value="user_management">User Management</MenuItem>
                                <MenuItem value="inventory">Inventory</MenuItem>
                                <MenuItem value="reports">Reports</MenuItem>
                                <MenuItem value="patients">Patients</MenuItem>
                                <MenuItem value="prescriptions">Prescriptions</MenuItem>
                                <MenuItem value="clinical">Clinical</MenuItem>
                                <MenuItem value="financial">Financial</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="Resource"
                            placeholder="e.g., inventory, users, reports"
                            value={permissionForm.resource}
                            onChange={(e) => setPermissionForm({ ...permissionForm, resource: e.target.value })}
                            fullWidth
                            helperText="The resource this permission applies to"
                        />
                        <FormControl fullWidth>
                            <InputLabel>Action</InputLabel>
                            <Select
                                value={permissionForm.action}
                                onChange={(e) => setPermissionForm({ ...permissionForm, action: e.target.value })}
                                label="Action"
                            >
                                <MenuItem value="read">Read</MenuItem>
                                <MenuItem value="create">Create</MenuItem>
                                <MenuItem value="update">Update</MenuItem>
                                <MenuItem value="delete">Delete</MenuItem>
                                <MenuItem value="manage">Manage (Full Access)</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreatePermissionOpen(false)} startIcon={<CancelIcon />}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreatePermission}
                        variant="contained"
                        startIcon={<SaveIcon />}
                        disabled={!permissionForm.name || !permissionForm.displayName}
                    >
                        Create Permission
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function ConflictsAlertsTab({ users, handleDetectConflicts, loading }: any) {
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [conflictsLoading, setConflictsLoading] = useState(false);
    const [selectedConflict, setSelectedConflict] = useState<any>(null);
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

    useEffect(() => {
        fetchSecurityAlerts();
    }, []);

    const fetchSecurityAlerts = async () => {
        try {
            const response = await rbacService.getSecurityAlerts();
            setAlerts(response.data?.alerts || []);
        } catch (error) {
            console.error('Error fetching security alerts:', error);
        }
    };

    const handleDetectAllConflicts = async () => {
        setConflictsLoading(true);
        try {
            const allConflicts: any[] = [];
            for (const user of users) {
                const roleIds = user.assignedRoles || [];
                const response = await rbacService.detectRoleConflicts(user._id, roleIds);
                if (response.data?.conflicts && response.data.conflicts.length > 0) {
                    allConflicts.push({
                        userId: user._id,
                        userName: `${user.firstName} ${user.lastName}`,
                        email: user.email,
                        conflicts: response.data.conflicts,
                    });
                }
            }
            setConflicts(allConflicts);
        } catch (error) {
            console.error('Error detecting conflicts:', error);
        } finally {
            setConflictsLoading(false);
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        try {
            await rbacService.resolveSecurityAlert(alertId, {
                action: 'resolved',
                notes: 'Alert resolved by admin',
            });
            fetchSecurityAlerts();
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const handleViewConflictDetails = (conflict: any) => {
        setSelectedConflict(conflict);
        setConflictDialogOpen(true);
    };

    const getSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return 'error';
            case 'high':
                return 'warning';
            case 'medium':
                return 'info';
            case 'low':
                return 'success';
            default:
                return 'default';
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Conflicts & Security Alerts
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchSecurityAlerts}
                    >
                        Refresh Alerts
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<WarningIcon />}
                        onClick={handleDetectAllConflicts}
                        disabled={conflictsLoading}
                    >
                        Detect All Conflicts
                    </Button>
                </Box>
            </Box>

            {/* Security Alerts Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShieldIcon color="error" /> Security Alerts ({alerts.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {alerts.length === 0 ? (
                    <Alert severity="success" icon={<CheckCircleIcon />}>
                        No active security alerts. All systems are secure.
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {alerts.map((alert: any, index: number) => (
                            <Paper
                                key={index}
                                elevation={2}
                                sx={{
                                    p: 2,
                                    borderLeft: 4,
                                    borderColor: `${getSeverityColor(alert.severity)}.main`,
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Chip
                                                label={alert.severity || 'Medium'}
                                                size="small"
                                                color={getSeverityColor(alert.severity)}
                                            />
                                            <Chip label={alert.type || 'Security'} size="small" variant="outlined" />
                                            <Typography variant="caption" color="text.secondary">
                                                {alert.timestamp
                                                    ? new Date(alert.timestamp).toLocaleString()
                                                    : 'Just now'}
                                            </Typography>
                                        </Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            {alert.title || 'Security Alert'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {alert.description || alert.message || 'No description available'}
                                        </Typography>
                                        {alert.affectedUsers && (
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                Affected Users: {alert.affectedUsers.join(', ')}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Button
                                        size="small"
                                        color="success"
                                        onClick={() => handleResolveAlert(alert._id)}
                                    >
                                        Resolve
                                    </Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Paper>

            {/* Permission Conflicts Section */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" /> Permission Conflicts ({conflicts.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {conflictsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : conflicts.length === 0 ? (
                    <Alert severity="info">
                        No conflicts detected. Click "Detect All Conflicts" to scan all users.
                    </Alert>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Conflicts</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {conflicts.map((conflict: any, index: number) => (
                                    <TableRow key={index} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 32, height: 32 }}>
                                                    {conflict.userName?.[0]}
                                                </Avatar>
                                                <Typography variant="body2">{conflict.userName}</Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>{conflict.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={`${conflict.conflicts?.length || 0} conflicts`}
                                                size="small"
                                                color="warning"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={conflict.conflicts?.[0]?.severity || 'Medium'}
                                                size="small"
                                                color={getSeverityColor(conflict.conflicts?.[0]?.severity)}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleViewConflictDetails(conflict)}
                                            >
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Conflict Details Dialog */}
            <Dialog
                open={conflictDialogOpen}
                onClose={() => setConflictDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Conflict Details - {selectedConflict?.userName}
                </DialogTitle>
                <DialogContent>
                    {selectedConflict?.conflicts?.map((conf: any, index: number) => (
                        <Paper key={index} elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                {conf.type || 'Permission Conflict'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {conf.description || conf.message || 'No description available'}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                                <Chip label={conf.severity || 'Medium'} size="small" color={getSeverityColor(conf.severity)} />
                            </Box>
                        </Paper>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConflictDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function AuditTrailTab({ auditLogs, loading }: any) {
    const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        action: 'all',
        user: '',
        dateFrom: '',
        dateTo: '',
        resource: 'all',
    });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [detailedLogs, setDetailedLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    useEffect(() => {
        fetchDetailedAuditLogs();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [filters, detailedLogs]);

    const fetchDetailedAuditLogs = async () => {
        setLogsLoading(true);
        try {
            const response = await rbacService.getRBACDetailedAuditLogs({ limit: 100 });
            setDetailedLogs(response.data?.logs || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...detailedLogs];

        if (filters.action !== 'all') {
            filtered = filtered.filter((log) => log.action === filters.action);
        }
        if (filters.user) {
            filtered = filtered.filter((log) =>
                log.userId?.toLowerCase().includes(filters.user.toLowerCase()) ||
                log.performedBy?.toLowerCase().includes(filters.user.toLowerCase())
            );
        }
        if (filters.resource !== 'all') {
            filtered = filtered.filter((log) => log.resourceType === filters.resource);
        }
        if (filters.dateFrom) {
            filtered = filtered.filter((log) => new Date(log.timestamp) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            filtered = filtered.filter((log) => new Date(log.timestamp) <= new Date(filters.dateTo));
        }

        setFilteredLogs(filtered);
    };

    const handleExportLogs = async () => {
        try {
            const response = await rbacService.exportAuditLogs({ format: 'csv' });
            // Handle download

        } catch (error) {
            console.error('Error exporting logs:', error);
        }
    };

    const getActionColor = (action: string) => {
        switch (action?.toLowerCase()) {
            case 'create':
                return 'success';
            case 'update':
                return 'info';
            case 'delete':
                return 'error';
            case 'read':
            case 'view':
                return 'default';
            default:
                return 'primary';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action?.toLowerCase()) {
            case 'create':
                return <AddIcon fontSize="small" />;
            case 'update':
                return <EditIcon fontSize="small" />;
            case 'delete':
                return <DeleteIcon fontSize="small" />;
            case 'view':
            case 'read':
                return <VisibilityIcon fontSize="small" />;
            default:
                return <InfoIcon fontSize="small" />;
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Audit Trail & Activity History
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportLogs}>
                        Export Logs
                    </Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDetailedAuditLogs}>
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterListIcon /> Filters
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Action Type</InputLabel>
                            <Select
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                                label="Action Type"
                            >
                                <MenuItem value="all">All Actions</MenuItem>
                                <MenuItem value="create">Create</MenuItem>
                                <MenuItem value="update">Update</MenuItem>
                                <MenuItem value="delete">Delete</MenuItem>
                                <MenuItem value="view">View</MenuItem>
                                <MenuItem value="assign">Assign</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Resource Type</InputLabel>
                            <Select
                                value={filters.resource}
                                onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
                                label="Resource Type"
                            >
                                <MenuItem value="all">All Resources</MenuItem>
                                <MenuItem value="user">User</MenuItem>
                                <MenuItem value="role">Role</MenuItem>
                                <MenuItem value="permission">Permission</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Date From"
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Date To"
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Audit Logs Table */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Activity Logs ({filteredLogs.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {logsLoading || loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Resource</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredLogs
                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        .map((log: any, index: number) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <ScheduleIcon fontSize="small" color="action" />
                                                        <Box>
                                                            <Typography variant="body2">
                                                                {log.timestamp
                                                                    ? new Date(log.timestamp).toLocaleDateString()
                                                                    : 'N/A'}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {log.timestamp
                                                                    ? new Date(log.timestamp).toLocaleTimeString()
                                                                    : ''}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        icon={getActionIcon(log.action)}
                                                        label={log.action || 'Unknown'}
                                                        size="small"
                                                        color={getActionColor(log.action)}
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 24, height: 24 }}>
                                                            <PersonIcon fontSize="small" />
                                                        </Avatar>
                                                        <Typography variant="body2">
                                                            {log.performedBy || log.userId || 'System'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={log.resourceType || 'N/A'}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                        {log.description || log.details || 'No details'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={log.status || 'Success'}
                                                        size="small"
                                                        color={log.status === 'failed' ? 'error' : 'success'}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={filteredLogs.length}
                            page={page}
                            onPageChange={(e, newPage) => setPage(newPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                        />
                    </>
                )}
            </Paper>
        </Box>
    );
}

function AnalyticsTab({ statistics, loading }: any) {
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [complianceReport, setComplianceReport] = useState<any>(null);

    useEffect(() => {
        fetchAnalyticsData();
        fetchComplianceReport();
    }, []);

    const fetchAnalyticsData = async () => {
        setAnalyticsLoading(true);
        try {
            const response = await rbacService.getAuditStatistics();
            setAnalyticsData(response.data || {});
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchComplianceReport = async () => {
        try {
            const response = await rbacService.getComplianceReport();
            setComplianceReport(response.data || {});
        } catch (error) {
            console.error('Error fetching compliance report:', error);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Analytics & Insights
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<DownloadIcon />}>
                        Export Report
                    </Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAnalyticsData}>
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Key Metrics Grid */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Total Users"
                        value={statistics?.totalUsers || 0}
                        icon={<PeopleIcon />}
                        color="primary.main"
                        loading={loading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Active Roles"
                        value={statistics?.totalRoles || 0}
                        icon={<SecurityIcon />}
                        color="secondary.main"
                        loading={loading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Permissions"
                        value={statistics?.totalPermissions || 0}
                        icon={<VpnKeyIcon />}
                        color="success.main"
                        loading={loading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Audit Logs"
                        value={analyticsData?.totalLogs || 0}
                        icon={<HistoryIcon />}
                        color="warning.main"
                        loading={analyticsLoading}
                    />
                </Grid>
            </Grid>

            {/* Activity Overview */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimelineIcon /> Activity Overview
                </Typography>
                <Divider sx={{ mb: 3 }} />
                {analyticsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Role Distribution
                                </Typography>
                                {analyticsData?.roleDistribution?.map((role: any, index: number) => (
                                    <Box key={index} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2">{role.name}</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {role.count} users
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={(role.count / (statistics?.totalUsers || 1)) * 100}
                                            sx={{ height: 8, borderRadius: 1 }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Permission Usage
                                </Typography>
                                {analyticsData?.permissionUsage?.map((perm: any, index: number) => (
                                    <Box key={index} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="body2">{perm.name}</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {perm.usage}%
                                            </Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={perm.usage}
                                            sx={{ height: 8, borderRadius: 1 }}
                                            color="secondary"
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                )}
            </Paper>

            {/* Compliance & Security */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShieldIcon /> Security Compliance
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        {complianceReport ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2">Overall Compliance</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {complianceReport.overallScore || 95}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={complianceReport.overallScore || 95}
                                        sx={{ height: 10, borderRadius: 1 }}
                                        color="success"
                                    />
                                </Box>
                                <Divider />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2">Users with MFA:</Typography>
                                    <Chip
                                        label={`${complianceReport.mfaEnabled || 0}%`}
                                        size="small"
                                        color="success"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2">Roles Compliant:</Typography>
                                    <Chip
                                        label={`${complianceReport.rolesCompliant || 100}%`}
                                        size="small"
                                        color="success"
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2">Permissions Validated:</Typography>
                                    <Chip
                                        label={`${complianceReport.permissionsValidated || 98}%`}
                                        size="small"
                                        color="success"
                                    />
                                </Box>
                            </Box>
                        ) : (
                            <Alert severity="info">Compliance data not available</Alert>
                        )}
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SpeedIcon /> Performance Metrics
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2">Average Response Time:</Typography>
                                <Chip label="125ms" size="small" color="success" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2">Cache Hit Rate:</Typography>
                                <Chip label="94%" size="small" color="success" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2">API Success Rate:</Typography>
                                <Chip label="99.8%" size="small" color="success" />
                            </Box>
                            <Divider />
                            <Box>
                                <Typography variant="body2" sx={{ mb: 1 }}>System Health</Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={98}
                                    sx={{ height: 10, borderRadius: 1 }}
                                    color="success"
                                />
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Recent Activity Summary */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssessmentIcon /> Recent Activity Summary
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                                {analyticsData?.recentCreates || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Created (24h)
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                                {analyticsData?.recentUpdates || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Updated (24h)
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="error.main" sx={{ fontWeight: 700 }}>
                                {analyticsData?.recentDeletes || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Deleted (24h)
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                                {analyticsData?.activeUsers || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Active Users
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
}

export default EnhancedUserManagement;
