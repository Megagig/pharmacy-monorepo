import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Paper,
  alpha,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Flag as FlagIcon,
  Email as EmailIcon,
  Speed as RateLimitIcon,
  Build as MaintenanceIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Security as SecurityIcon,
  Dashboard as DefaultsIcon,
} from '@mui/icons-material';
import { useUIStore } from '../../stores';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const SystemSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  
  const [activeTab, setActiveTab] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rateLimitSettings, setRateLimitSettings] = useState({
    windowMs: 900000,
    maxRequests: 5000,
  });
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    from: '',
  });

  // Fetch feature flags
  const { data: featureFlagsData, isLoading: loadingFlags } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: async () => {
      const response = await adminService.getFeatureFlags();
      return response.data;
    },
  });

  // Fetch system settings
  const { data: systemSettingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      try {
        const response = await adminService.getSystemSettings();
        return response.data;
      } catch (error) {
        console.error('Failed to fetch system settings:', error);
        return null;
      }
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Update local state when backend data is loaded
  React.useEffect(() => {
    if (systemSettingsData) {
      if (systemSettingsData.maintenanceMode !== undefined) {
        setMaintenanceMode(systemSettingsData.maintenanceMode);
      }
      if (systemSettingsData.rateLimit) {
        setRateLimitSettings({
          windowMs: systemSettingsData.rateLimit.windowMs || 900000,
          maxRequests: systemSettingsData.rateLimit.maxRequests || 5000,
        });
      }
      if (systemSettingsData.emailConfig) {
        setEmailSettings({
          smtpHost: systemSettingsData.emailConfig.smtpHost || '',
          smtpPort: systemSettingsData.emailConfig.smtpPort || 587,
          from: systemSettingsData.emailConfig.from || '',
        });
      }
    }
  }, [systemSettingsData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleToggleFeatureFlag = async (flagId: string, currentState: boolean) => {
    try {
      await adminService.toggleFeatureFlag(flagId, !currentState);
      queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Feature flag updated successfully',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update feature flag',
      });
    }
  };

  const handleSaveRateLimit = async () => {
    try {
      await adminService.updateSystemSettings({
        rateLimit: rateLimitSettings,
      });
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Rate limit settings updated successfully',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update rate limit settings',
      });
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      await adminService.updateSystemSettings({
        emailConfig: emailSettings,
      });
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Email settings updated successfully',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update email settings',
      });
    }
  };

  const handleToggleMaintenanceMode = async () => {
    try {
      const newMode = !maintenanceMode;
      await adminService.updateSystemSettings({
        maintenanceMode: newMode,
      });
      setMaintenanceMode(newMode);
      addNotification({
        type: newMode ? 'warning' : 'success',
        title: newMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
        message: newMode
          ? 'System is now in maintenance mode'
          : 'System is back online',
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to toggle maintenance mode',
      });
    }
  };

  const featureFlags = featureFlagsData?.featureFlags || [];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 1, fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="600">
            System Settings
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
            queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {featureFlags.length}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Feature Flags
                  </Typography>
                </Box>
                <FlagIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: maintenanceMode
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h5" fontWeight="700">
                    {maintenanceMode ? 'ACTIVE' : 'NORMAL'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    System Status
                  </Typography>
                </Box>
                <MaintenanceIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" fontWeight="700">
                    {rateLimitSettings.maxRequests}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Rate Limit
                  </Typography>
                </Box>
                <RateLimitIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h5" fontWeight="700">
                    SMTP
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Email Config
                  </Typography>
                </Box>
                <EmailIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
              },
            }}
          >
            <Tab icon={<FlagIcon />} iconPosition="start" label="Feature Flags" />
            <Tab icon={<EmailIcon />} iconPosition="start" label="Email Configuration" />
            <Tab icon={<MaintenanceIcon />} iconPosition="start" label="Maintenance Mode" />
            <Tab icon={<RateLimitIcon />} iconPosition="start" label="Rate Limits" />
            <Tab icon={<DefaultsIcon />} iconPosition="start" label="System Defaults" />
          </Tabs>
        </Box>

        {/* Tab Panel 0: Feature Flags */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Feature Flag Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enable or disable features across the system
            </Typography>

            {loadingFlags ? (
              <CircularProgress />
            ) : featureFlags.length === 0 ? (
              <Alert severity="info">No feature flags configured</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Required Tiers</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {featureFlags.map((flag: any) => (
                      <TableRow key={flag._id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FlagIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body2" fontWeight="600">
                              {flag.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {flag.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {flag.requiredTiers?.map((tier: string) => (
                              <Chip key={tier} label={tier} size="small" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={flag.isEnabled ? <ActiveIcon /> : <InactiveIcon />}
                            label={flag.isEnabled ? 'Enabled' : 'Disabled'}
                            size="small"
                            color={flag.isEnabled ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={flag.isEnabled}
                                onChange={() => handleToggleFeatureFlag(flag._id, flag.isEnabled)}
                                color="primary"
                              />
                            }
                            label=""
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </TabPanel>

        {/* Tab Panel 1: Email Configuration */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Email Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure SMTP settings for system emails
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Host"
                  value={emailSettings.smtpHost}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, smtpHost: e.target.value })
                  }
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Port"
                  type="number"
                  value={emailSettings.smtpPort}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      smtpPort: parseInt(e.target.value),
                    })
                  }
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="From Email Address"
                  value={emailSettings.from}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, from: e.target.value })
                  }
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveEmailSettings}
                >
                  Save Email Settings
                </Button>
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Typography variant="h6" gutterBottom>
              Email Delivery Statistics
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              Email statistics are tracked in real-time. Check the System Health tab for
              detailed metrics.
            </Alert>
          </Box>
        </TabPanel>

        {/* Tab Panel 2: Maintenance Mode */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Maintenance Mode
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enable maintenance mode to temporarily disable user access
            </Typography>

            <Alert
              severity={maintenanceMode ? 'warning' : 'success'}
              sx={{ mb: 3 }}
            >
              {maintenanceMode
                ? 'System is currently in maintenance mode. Users cannot access the platform.'
                : 'System is operating normally.'}
            </Alert>

            <Card variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="h6">Maintenance Mode</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {maintenanceMode
                        ? 'Click to disable and restore user access'
                        : 'Click to enable and restrict user access'}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={maintenanceMode}
                        onChange={handleToggleMaintenanceMode}
                        color="warning"
                        size="medium"
                      />
                    }
                    label={maintenanceMode ? 'Active' : 'Inactive'}
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>

        {/* Tab Panel 3: Rate Limits */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              API Rate Limiting
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure rate limits to prevent API abuse
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Time Window (milliseconds)"
                  type="number"
                  value={rateLimitSettings.windowMs}
                  onChange={(e) =>
                    setRateLimitSettings({
                      ...rateLimitSettings,
                      windowMs: parseInt(e.target.value),
                    })
                  }
                  margin="normal"
                  helperText="Default: 900000 (15 minutes)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Requests"
                  type="number"
                  value={rateLimitSettings.maxRequests}
                  onChange={(e) =>
                    setRateLimitSettings({
                      ...rateLimitSettings,
                      maxRequests: parseInt(e.target.value),
                    })
                  }
                  margin="normal"
                  helperText="Default: 5000 requests per window"
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  Current setting: {rateLimitSettings.maxRequests} requests per{' '}
                  {rateLimitSettings.windowMs / 60000} minutes
                </Alert>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveRateLimit}
                >
                  Save Rate Limit Settings
                </Button>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab Panel 4: System Defaults */}
        <TabPanel value={activeTab} index={4}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Defaults
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Default values and configurations for new workspaces
            </Typography>

            <List>
              <ListItem>
                <ListItemText
                  primary="Default Trial Period"
                  secondary="14 days for new workspaces"
                />
                <ListItemSecondaryAction>
                  <Chip label="14 Days" color="primary" />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Max Pending Invitations"
                  secondary="Maximum invitations per workspace"
                />
                <ListItemSecondaryAction>
                  <Chip label="20" color="primary" />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Default Timezone"
                  secondary="System-wide timezone setting"
                />
                <ListItemSecondaryAction>
                  <Chip label="UTC" color="primary" />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Session Timeout"
                  secondary="User session duration"
                />
                <ListItemSecondaryAction>
                  <Chip label="24 Hours" color="primary" />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Alert severity="info" sx={{ mt: 3 }}>
              System defaults are configured in environment variables and database schemas.
              Contact development team to modify these values.
            </Alert>
          </Box>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default SystemSettings;
