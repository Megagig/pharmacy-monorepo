import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import ProfileTab from '../components/settings/ProfileTab';
import PreferencesTab from '../components/settings/PreferencesTab';
import SecurityTab from '../components/settings/SecurityTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <PersonIcon /> },
    { id: 'preferences', label: 'Preferences', icon: <PaletteIcon /> },
    { id: 'security', label: 'Security & Privacy', icon: <SecurityIcon /> },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component={RouterLink}
          to="/dashboard"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Dashboard
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 0.5 }} fontSize="small" />
          Settings
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account settings, preferences, and security options
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant={isMobile ? 'scrollable' : 'fullWidth'}
            scrollButtons={isMobile ? 'auto' : false}
            aria-label="settings tabs"
            sx={{
              '& .MuiTab-root': {
                minHeight: 72,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
              },
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={tab.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {tab.icon}
                    {!isMobile && tab.label}
                  </Box>
                }
                id={`settings-tab-${index}`}
                aria-controls={`settings-tabpanel-${index}`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <TabPanel value={activeTab} index={0}>
            <ProfileTab />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <PreferencesTab />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <SecurityTab />
          </TabPanel>
        </Box>
      </Paper>
    </Container>
  );
};

export default Settings;
