/**
 * SaaS Admin Dashboard
 * Comprehensive system administration dashboard for super admins
 * Consolidates all SaaS management features in one place
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  Business as BusinessIcon,
  Support as SupportIcon,
  Api as ApiIcon,
  AttachMoney as PricingIcon,
  Assignment as LicenseIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Import SaaS components
import SystemOverview from '../../components/saas/SystemOverview';
import UserManagement from '../../components/saas/UserManagement';
import SecuritySettings from '../../components/saas/SecuritySettings';
import AnalyticsReports from '../../components/saas/AnalyticsReports';
import NotificationsManagement from '../../components/saas/NotificationsManagement';
import TenantManagement from '../../components/saas/TenantManagement';
import TenantLicenseManagement from '../../components/saas/TenantLicenseManagement';
import SupportHelpdesk from '../../components/saas/SupportHelpdesk';
import ApiIntegrations from '../../components/saas/ApiIntegrations';
import PricingManagement from '../../components/admin/PricingManagement';

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
      id={`saas-tabpanel-${index}`}
      aria-labelledby={`saas-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const SaasAdminDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    { label: 'System Overview', icon: <DashboardIcon />, component: SystemOverview },
    { label: 'Pricing', icon: <PricingIcon />, component: PricingManagement },
    { label: 'Users', icon: <PeopleIcon />, component: UserManagement },
    { label: 'Security', icon: <SecurityIcon />, component: SecuritySettings },
    { label: 'Analytics', icon: <AssessmentIcon />, component: AnalyticsReports },
    { label: 'Notifications', icon: <NotificationsIcon />, component: NotificationsManagement },
    { label: 'Tenants', icon: <BusinessIcon />, component: TenantManagement },
    { label: 'Licenses', icon: <LicenseIcon />, component: TenantLicenseManagement },
    { label: 'Support', icon: <SupportIcon />, component: SupportHelpdesk },
    { label: 'API', icon: <ApiIcon />, component: ApiIntegrations },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/dashboard" underline="hover" color="inherit">
          Dashboard
        </Link>
        <Typography color="text.primary">SaaS Admin</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            SaaS Administration
          </Typography>
          <Chip label="Super Admin" color="error" size="small" />
        </Box>
        <Typography variant="body1" color="text.secondary">
          Comprehensive system administration and configuration dashboard
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            aria-label="saas admin tabs"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
              },
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                id={`saas-tab-${index}`}
                aria-controls={`saas-tabpanel-${index}`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        {tabs.map((tab, index) => (
          <TabPanel key={index} value={activeTab} index={index}>
            <tab.component />
          </TabPanel>
        ))}
      </Paper>
    </Container>
  );
};

export default SaasAdminDashboard;

