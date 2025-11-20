/**
 * Patient Portal Admin Dashboard
 * Main page for managing patient portal users, refill requests, and analytics
 * Only accessible to workspace administrators
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  useTheme,
  useMediaQuery,
  Snackbar,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useRBAC } from '../../hooks/useRBAC';
import { useAuth } from '../../context/AuthContext';
import { usePatientPortalAdmin } from '../../hooks/usePatientPortalAdmin';
import PatientUserManagement from '../../components/workspace-admin/PatientUserManagement';
import RefillRequestManagement from '../../components/workspace-admin/RefillRequestManagement';
import PatientPortalAnalytics from '../../components/workspace-admin/PatientPortalAnalytics';
import PatientPortalSettings from '../../components/workspace-admin/PatientPortalSettings';

// Tab panel component
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
      id={`patient-portal-admin-tabpanel-${index}`}
      aria-labelledby={`patient-portal-admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Stats card component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
  subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
  loading = false,
  subtitle,
}) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Typography variant="h4" component="div">
                  {value.toLocaleString()}
                </Typography>
                {subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}.main`,
              color: 'white',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const PatientPortalAdmin: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { hasRole } = useRBAC();
  const { user, loading: authLoading } = useAuth(); // Get loading state too
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  // For super admins viewing a specific workspace, use the workspace ID from URL
  // For regular workspace admins, use their own workspace (no override needed)
  const isSuperAdminWithOverride = user?.role === 'super_admin' && workspaceId;
  const targetWorkspaceId = isSuperAdminWithOverride ? workspaceId : undefined;

  // Fetch patient portal statistics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = usePatientPortalAdmin(targetWorkspaceId).usePortalStats();

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  // Access control - ALL workspace members can access Patient Portal
  // Allowed roles: owner, pharmacy_outlet, pharmacy_team, pharmacist, super_admin
  if (!hasRole(['owner', 'pharmacy_outlet', 'pharmacy_team', 'pharmacist', 'super_admin'])) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1">
            This page is only accessible to workspace members. Please join a workspace to access the patient portal.
          </Typography>
        </Alert>
      </Container>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem' } }}
            >
              <LocalPharmacyIcon sx={{ mr: 1, fontSize: 'inherit', verticalAlign: 'middle' }} />
              Patient Portal Administration
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage patient portal users, refill requests, and portal settings
            </Typography>
          </Box>

          <Chip
            icon={<CheckCircleIcon />}
            label="Portal Active"
            color="success"
            variant="outlined"
          />
        </Box>

        {/* Stats Cards */}
        {statsError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load patient portal statistics. Please try refreshing the page.
          </Alert>
        )}

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Patients"
              value={stats?.totalPatients || 0}
              icon={<PeopleIcon />}
              color="primary"
              loading={statsLoading}
              subtitle="Registered users"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Active Patients"
              value={stats?.activePatients || 0}
              icon={<CheckCircleIcon />}
              color="success"
              loading={statsLoading}
              subtitle="Approved & active"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Pending Approvals"
              value={stats?.pendingApprovals || 0}
              icon={<HourglassEmptyIcon />}
              color="warning"
              loading={statsLoading}
              subtitle="Awaiting approval"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Refill Requests"
              value={stats?.pendingRefills || 0}
              icon={<LocalPharmacyIcon />}
              color="info"
              loading={statsLoading}
              subtitle="Pending requests"
            />
          </Grid>
        </Grid>

        {/* Additional Stats Row */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Monthly Logins"
              value={stats?.monthlyLogins || 0}
              icon={<AnalyticsIcon />}
              color="secondary"
              loading={statsLoading}
              subtitle="This month"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Messages Sent"
              value={stats?.messagesSent || 0}
              icon={<AnalyticsIcon />}
              color="info"
              loading={statsLoading}
              subtitle="This month"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Appointments Booked"
              value={stats?.appointmentsBooked || 0}
              icon={<AnalyticsIcon />}
              color="success"
              loading={statsLoading}
              subtitle="This month"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Portal Engagement"
              value={stats?.engagementRate || 0}
              icon={<AnalyticsIcon />}
              color="primary"
              loading={statsLoading}
              subtitle="% active users"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons="auto"
          aria-label="patient portal admin tabs"
        >
          <Tab
            icon={<PeopleIcon />}
            label="Patient Users"
            iconPosition="start"
            id="patient-portal-admin-tab-0"
            aria-controls="patient-portal-admin-tabpanel-0"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<LocalPharmacyIcon />}
            label="Refill Requests"
            iconPosition="start"
            id="patient-portal-admin-tab-1"
            aria-controls="patient-portal-admin-tabpanel-1"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<AnalyticsIcon />}
            label="Analytics"
            iconPosition="start"
            id="patient-portal-admin-tab-2"
            aria-controls="patient-portal-admin-tabpanel-2"
            sx={{ minHeight: 64 }}
          />
          <Tab
            icon={<SettingsIcon />}
            label="Portal Settings"
            iconPosition="start"
            id="patient-portal-admin-tab-3"
            aria-controls="patient-portal-admin-tabpanel-3"
            sx={{ minHeight: 64 }}
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <PatientUserManagement onShowSnackbar={showSnackbar} workspaceId={targetWorkspaceId} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <RefillRequestManagement onShowSnackbar={showSnackbar} workspaceId={targetWorkspaceId} />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <PatientPortalAnalytics workspaceId={targetWorkspaceId} />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <PatientPortalSettings onShowSnackbar={showSnackbar} workspaceId={targetWorkspaceId} />
      </TabPanel>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PatientPortalAdmin;