import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Alert,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Chip,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import FlagIcon from '@mui/icons-material/Flag';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SuperAdminIcon from '@mui/icons-material/SupervisorAccount';
import PricingIcon from '@mui/icons-material/AttachMoney';
import BusinessIcon from '@mui/icons-material/Business';
import SupportIcon from '@mui/icons-material/Support';
import HelpIcon from '@mui/icons-material/Help';
import ApiIcon from '@mui/icons-material/Api';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useRBAC } from '../hooks/useRBAC';
import { ErrorBoundary } from 'react-error-boundary';

// Lazy load tab components for better performance
const SystemOverview = lazy(() => import('../components/saas/SystemOverview'));
const UserManagement = lazy(() => import('../components/saas/UserManagement'));
const SecuritySettings = lazy(() => import('../components/saas/SecuritySettings'));
const AnalyticsReports = lazy(() => import('../components/saas/AnalyticsReports'));
const NotificationsManagement = lazy(() => import('../components/saas/NotificationsManagement'));
const BillingSubscriptions = lazy(() => import('../components/saas/BillingSubscriptions'));
const TenantManagement = lazy(() => import('../components/saas/TenantManagement'));
const TenantLicenseManagement = lazy(() => import('../components/saas/TenantLicenseManagement'));
const SupportHelpdesk = lazy(() => import('../components/saas/SupportHelpdesk'));
const HelpManagement = lazy(() => import('../components/admin/HelpManagement'));
const ApiIntegrations = lazy(() => import('../components/saas/ApiIntegrations'));
const PricingManagement = lazy(() => import('../components/admin/PricingManagement'));

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  component: React.ComponentType;
}

const SaasSettings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isSuperAdmin } = useRBAC();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);

  // Map tab IDs to indices
  const tabIdToIndex: Record<string, number> = {
    overview: 0,
    pricing: 1,
    users: 2,
    security: 3,
    analytics: 4,
    notifications: 5,
    billing: 6,
    tenants: 7,
    licenses: 8,
    support: 9,
    'help-management': 10,
    api: 11,
  };

  // Handle URL query parameter for tab navigation
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabIdToIndex[tabParam] !== undefined) {
      setActiveTab(tabIdToIndex[tabParam]);
    }
  }, [searchParams]);

  // Access control - only super_admin can view this page
  if (!isSuperAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1">
            This page is restricted to Super Admin users only. You need super
            admin permissions to access SaaS settings.
          </Typography>
        </Alert>
      </Container>
    );
  }

  const settingsCategories: TabConfig[] = [
    {
      id: 'overview',
      label: 'System Overview',
      icon: <DashboardIcon />,
      description: 'System metrics and health status',
      component: SystemOverview,
    },
    {
      id: 'pricing',
      label: 'Pricing Management',
      icon: <PricingIcon />,
      description: 'Manage pricing plans and features',
      component: PricingManagement,
    },
    {
      id: 'users',
      label: 'User Management',
      icon: <PeopleIcon />,
      description: 'Manage users, roles, and permissions',
      component: UserManagement,
    },
    {
      id: 'security',
      label: 'Security Settings',
      icon: <SecurityIcon />,
      description: 'Security policies and configurations',
      component: SecuritySettings,
    },
    {
      id: 'analytics',
      label: 'Analytics & Reports',
      icon: <AssessmentIcon />,
      description: 'System analytics and reporting',
      component: AnalyticsReports,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <NotificationsIcon />,
      description: 'System notifications and alerts',
      component: NotificationsManagement,
    },
    {
      id: 'billing',
      label: 'Billing & Subscriptions',
      icon: <PricingIcon />,
      description: 'Payment processing and subscription management',
      component: BillingSubscriptions,
    },
    {
      id: 'tenants',
      label: 'Tenant Management',
      icon: <BusinessIcon />,
      description: 'Multi-pharmacy workspace management',
      component: TenantManagement,
    },
    {
      id: 'licenses',
      label: 'License Verification',
      icon: <SecurityIcon />,
      description: 'Manage pharmacist license verifications',
      component: TenantLicenseManagement,
    },
    {
      id: 'support',
      label: 'Support & Helpdesk',
      icon: <SupportIcon />,
      description: 'Customer support and ticketing system',
      component: SupportHelpdesk,
    },
    {
      id: 'help-management',
      label: 'Help System',
      icon: <HelpIcon />,
      description: 'Manage help content, FAQs, videos, and settings',
      component: HelpManagement,
    },
    {
      id: 'api',
      label: 'API & Integrations',
      icon: <ApiIcon />,
      description: 'External system integrations and API management',
      component: ApiIntegrations,
    },
  ];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Update URL with tab parameter
    const tabId = settingsCategories[newValue]?.id;
    if (tabId) {
      setSearchParams({ tab: tabId });
    }
  };

  const renderTabContent = () => {
    const activeCategory = settingsCategories[activeTab];
    if (!activeCategory) return null;

    const Component = activeCategory.component;

    return (
      <ErrorBoundary
        fallback={
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2">
              There was an error loading this section. Please try refreshing the page.
            </Typography>
          </Alert>
        }
      >
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          }
        >
          <Component />
        </Suspense>
      </ErrorBoundary>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/dashboard" color="inherit">
            Dashboard
          </Link>
          <Typography color="textPrimary">SaaS Settings</Typography>
        </Breadcrumbs>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              <SuperAdminIcon sx={{ mr: 1, fontSize: 'inherit' }} />
              SaaS Settings
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Comprehensive system administration and configuration
            </Typography>
          </Box>

          <Chip
            icon={<SuperAdminIcon />}
            label="Super Admin Access"
            color="error"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons="auto"
        >
          {settingsCategories.map((category) => (
            <Tab
              key={category.id}
              icon={category.icon as React.ReactElement}
              label={category.label}
              iconPosition="start"
              sx={{ minHeight: 64 }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {renderTabContent()}
      </Box>
    </Container>
  );
};

export default SaasSettings;
