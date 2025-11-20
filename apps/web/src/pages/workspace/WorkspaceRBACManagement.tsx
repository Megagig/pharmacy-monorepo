import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Tabs,
    Tab,
    Paper,
    Alert,
    AlertTitle,
    Breadcrumbs,
    Link,
    Chip,
    Grid,
    Card,
    CardContent,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Security as SecurityIcon,
    AccountTree as HierarchyIcon,
    GridOn as MatrixIcon,
    History as AuditIcon,
    Dashboard as DashboardIcon,
    NavigateNext as NavigateNextIcon,
    Business as WorkspaceIcon,
    Group as GroupIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import RoleManagement from '../../components/rbac/RoleManagement';
import PermissionMatrix from '../../components/rbac/PermissionMatrix';
import TeamMemberAssignment from '../../components/rbac/TeamMemberAssignment';
import AuditTrail from '../../components/rbac/AuditTrail';
import { useRBAC } from '../../hooks/useRBAC';
import { useAuth } from '../../hooks/useAuth';
import {
    getWorkspaceRoles,
    getWorkspacePermissions,
    getWorkspaceRBACStatistics,
} from '../../services/rbacService';
import type { Role } from '../../types/rbac';

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
            id={`workspace-rbac-tabpanel-${index}`}
            aria-labelledby={`workspace-rbac-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

interface WorkspaceRBACStats {
    totalRoles: number;
    activeRoles: number;
    totalPermissions: number;
    totalUsers: number;
    recentAuditLogs: number;
}

const WorkspaceRBACManagement: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { hasRole } = useRBAC();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(0);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [stats, setStats] = useState<WorkspaceRBACStats>({
        totalRoles: 0,
        activeRoles: 0,
        totalPermissions: 0,
        totalUsers: 0,
        recentAuditLogs: 0,
    });
    const [loading, setLoading] = useState(true);

    // Check access - pharmacists and workspace owners can access this page
    const hasAccess = hasRole('pharmacist') || hasRole('pharmacy_outlet');

    useEffect(() => {
        if (hasAccess) {
            loadWorkspaceStats();
        }
    }, [hasAccess]);

    const loadWorkspaceStats = async () => {
        try {
            setLoading(true);
            // Load workspace-scoped RBAC statistics
            const [rolesResponse, permissionsResponse, statsResponse] = await Promise.all([
                getWorkspaceRoles({ limit: 100 }),
                getWorkspacePermissions({ limit: 200 }),
                getWorkspaceRBACStatistics(),
            ]);

            if (rolesResponse.success) {
                const roles = rolesResponse.data.roles || [];
                setStats(prev => ({
                    ...prev,
                    totalRoles: roles.length,
                    activeRoles: roles.filter((r: Role) => r.isActive).length,
                }));
            }

            if (permissionsResponse.success) {
                const permissions = permissionsResponse.data.permissions || [];
                setStats(prev => ({
                    ...prev,
                    totalPermissions: permissions.length,
                }));
            }

            if (statsResponse.success) {
                setStats(prev => ({
                    ...prev,
                    totalUsers: statsResponse.data.totalMembers || 0,
                    totalRoles: statsResponse.data.totalRoles || prev.totalRoles,
                    activeRoles: statsResponse.data.activeRoles || prev.activeRoles,
                }));
            }
        } catch (error) {
            console.error('Error loading workspace RBAC stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleRoleSelect = (role: Role) => {
        setSelectedRole(role);
        // Switch to permission matrix tab when a role is selected
        setActiveTab(1);
    };

    // Access denied view
    if (!hasAccess) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Alert severity="error">
                    <AlertTitle>Insufficient Role Permissions</AlertTitle>
                    This page requires pharmacy_outlet role(s). Your current role is {user?.role}.
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Breadcrumbs
                    separator={<NavigateNextIcon fontSize="small" />}
                    sx={{ mb: 2 }}
                >
                    <Link
                        color="inherit"
                        href="/dashboard"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/dashboard');
                        }}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                        <DashboardIcon fontSize="small" />
                        Dashboard
                    </Link>
                    <Link
                        color="inherit"
                        href="/workspace/team"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/workspace/team');
                        }}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                        <WorkspaceIcon fontSize="small" />
                        Workspace
                    </Link>
                    <Typography
                        color="text.primary"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                        <SecurityIcon fontSize="small" />
                        RBAC Management
                    </Typography>
                </Breadcrumbs>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1" fontWeight="bold">
                            Workspace Roles & Permission Management
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Manage roles, permissions, and access control for your workspace team members
                        </Typography>
                    </Box>
                </Box>

                <Chip
                    label={`Workspace: ${user?.workplaceName || 'Current Workspace'}`}
                    color="primary"
                    variant="outlined"
                    icon={<WorkspaceIcon />}
                />
            </Box>
            {/* Statistics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.2)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">
                                        {loading ? '...' : stats.totalRoles}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Roles
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.2)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <HierarchyIcon sx={{ fontSize: 32, color: 'success.main' }} />
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">
                                        {loading ? '...' : stats.activeRoles}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Active Roles
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.2)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <MatrixIcon sx={{ fontSize: 32, color: 'info.main' }} />
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">
                                        {loading ? '...' : stats.totalPermissions}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Permissions
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card
                        sx={{
                            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.2)} 100%)`,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <AuditIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">
                                        {loading ? '...' : stats.totalUsers}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Team Members
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            {/* Main Content */}
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        aria-label="workspace rbac management tabs"
                        sx={{
                            '& .MuiTab-root': {
                                minHeight: 64,
                                textTransform: 'none',
                                fontSize: '1rem',
                                fontWeight: 500,
                            },
                        }}
                    >
                        <Tab
                            icon={<SecurityIcon />}
                            iconPosition="start"
                            label="Role Management"
                            id="workspace-rbac-tab-0"
                            aria-controls="workspace-rbac-tabpanel-0"
                        />
                        <Tab
                            icon={<MatrixIcon />}
                            iconPosition="start"
                            label="Permission Matrix"
                            id="workspace-rbac-tab-1"
                            aria-controls="workspace-rbac-tabpanel-1"
                        />
                        <Tab
                            icon={<GroupIcon />}
                            iconPosition="start"
                            label="Team Members"
                            id="workspace-rbac-tab-2"
                            aria-controls="workspace-rbac-tabpanel-2"
                        />
                        <Tab
                            icon={<AuditIcon />}
                            iconPosition="start"
                            label="Audit Trail"
                            id="workspace-rbac-tab-3"
                            aria-controls="workspace-rbac-tabpanel-3"
                        />
                    </Tabs>
                </Box>

                <TabPanel value={activeTab} index={0}>
                    <RoleManagement
                        onRoleSelect={handleRoleSelect}
                        workspaceScoped={true}
                        workspaceId={user?.pharmacyId}
                    />
                </TabPanel>

                <TabPanel value={activeTab} index={1}>
                    <PermissionMatrix
                        selectedRole={selectedRole}
                        workspaceScoped={true}
                        workspaceId={user?.pharmacyId}
                    />
                </TabPanel>

                <TabPanel value={activeTab} index={2}>
                    <TeamMemberAssignment workspaceId={user?.pharmacyId} />
                </TabPanel>

                <TabPanel value={activeTab} index={3}>
                    <AuditTrail workspaceId={user?.pharmacyId} />
                </TabPanel>
            </Paper>
        </Container>
    );
};

export default WorkspaceRBACManagement;