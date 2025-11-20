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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import RoleManagement from '../../components/rbac/RoleManagement';
import PermissionMatrix from '../../components/rbac/PermissionMatrix';
import { useRBAC } from '../../hooks/useRBAC';
import {
  getAllRoles,
  getAllPermissions,
  getRBACStatistics,
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
      id={`rbac-tabpanel-${index}`}
      aria-labelledby={`rbac-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface RBACStats {
  totalRoles: number;
  activeRoles: number;
  totalPermissions: number;
  totalUsers: number;
  recentAuditLogs: number;
}

const RBACManagement: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isSuperAdmin, hasRole } = useRBAC();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [stats, setStats] = useState<RBACStats>({
    totalRoles: 0,
    activeRoles: 0,
    totalPermissions: 0,
    totalUsers: 0,
    recentAuditLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  // Check access - only super admins can access this page
  const hasAccess = isSuperAdmin || hasRole('super_admin');

  useEffect(() => {
    if (hasAccess) {
      loadStats();
    }
  }, [hasAccess]);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Load RBAC statistics
      const [rolesResponse, permissionsResponse, auditResponse] = await Promise.all([
        getAllRoles(),
        getAllPermissions(),
        getRBACStatistics(),
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

      if (auditResponse.success) {
        setStats(prev => ({
          ...prev,
          totalUsers: auditResponse.data.totalUsers || 0,
          recentAuditLogs: auditResponse.data.recentLogs || 0,
        }));
      }
    } catch (error) {
      console.error('Error loading RBAC stats:', error);
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
          <AlertTitle>Access Denied</AlertTitle>
          You do not have permission to access RBAC Management. This page is restricted to Super Administrators only.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 3 }}
      >
        <Link
          color="inherit"
          href="/admin"
          onClick={(e) => {
            e.preventDefault();
            navigate('/admin');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <DashboardIcon sx={{ mr: 0.5 }} fontSize="small" />
          Admin
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <SecurityIcon sx={{ mr: 0.5 }} fontSize="small" />
          RBAC Management
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SecurityIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" gutterBottom>
              Role-Based Access Control
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage roles, permissions, and access control for your organization
            </Typography>
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              }}
            >
              <CardContent>
                <Typography variant="h4" color="primary.main">
                  {stats.totalRoles}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Roles
                </Typography>
                <Chip
                  label={`${stats.activeRoles} Active`}
                  size="small"
                  color="success"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
              }}
            >
              <CardContent>
                <Typography variant="h4" color="secondary.main">
                  {stats.totalPermissions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Permissions
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              }}
            >
              <CardContent>
                <Typography variant="h4" color="info.main">
                  {stats.totalUsers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Users
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              }}
            >
              <CardContent>
                <Typography variant="h4" color="warning.main">
                  {stats.recentAuditLogs}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recent Audit Logs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tab
            icon={<HierarchyIcon />}
            label="Role Management"
            id="rbac-tab-0"
            aria-controls="rbac-tabpanel-0"
          />
          <Tab
            icon={<MatrixIcon />}
            label="Permission Matrix"
            id="rbac-tab-1"
            aria-controls="rbac-tabpanel-1"
          />
          <Tab
            icon={<AuditIcon />}
            label="Audit Trail"
            id="rbac-tab-2"
            aria-controls="rbac-tabpanel-2"
            disabled
          />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <RoleManagement onRoleSelect={handleRoleSelect} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <PermissionMatrix
          selectedRole={selectedRole}
          onRoleSelect={handleRoleSelect}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Alert severity="info">
          <AlertTitle>Audit Trail Coming Soon</AlertTitle>
          RBAC audit trail functionality will be available in the next update.
        </Alert>
      </TabPanel>
    </Container>
  );
};

export default RBACManagement;

