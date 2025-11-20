import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Switch,
  Divider,
  Alert,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Badge,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Shield as ShieldIcon,
  Key as KeyIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar: string;
    bio: string;
    location: string;
    organization: string;
    role: string;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    dateFormat: string;
    currency: string;
  };
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
    security: boolean;
    updates: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    passwordChangeRequired: boolean;
    loginNotifications: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'organization';
    dataSharing: boolean;
    analytics: boolean;
  };
}

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDataExportDialog, setShowDataExportDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: '',
      avatar: user?.avatar || '',
      bio: '',
      location: 'Lagos, Nigeria',
      organization: 'PharmacyCopilot SaaS',
      role: user?.role || 'pharmacist',
    },
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'Africa/Lagos',
      dateFormat: 'DD/MM/YYYY',
      currency: 'NGN',
    },
    notifications: {
      email: true,
      push: true,
      sms: false,
      marketing: false,
      security: true,
      updates: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
      passwordChangeRequired: false,
      loginNotifications: true,
    },
    privacy: {
      profileVisibility: 'organization',
      dataSharing: false,
      analytics: true,
    },
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrentPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
  });

  const settingsTabs = [
    { id: 'profile', label: 'Profile', icon: <PersonIcon /> },
    { id: 'preferences', label: 'Preferences', icon: <PaletteIcon /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <NotificationsIcon />,
    },
    { id: 'security', label: 'Security & Privacy', icon: <SecurityIcon /> },
    { id: 'data', label: 'Data & Storage', icon: <StorageIcon /> },
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Mock API call - replace with actual implementation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEditMode(false);
      // Show success message
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      // Show error message
      return;
    }

    setLoading(true);
    try {
      // Mock API call - replace with actual implementation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowPasswordDialog(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrentPassword: false,
        showNewPassword: false,
        showConfirmPassword: false,
      });
      // Show success message
    } catch (error) {
      console.error('Error changing password:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProfileTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
              <Avatar
                src={settings.profile.avatar}
                sx={{ width: 120, height: 120, fontSize: '2rem' }}
              >
                {settings.profile.firstName[0]}
                {settings.profile.lastName[0]}
              </Avatar>
              {editMode && (
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                  size="sm"
                >
                  <PhotoCameraIcon />
                </IconButton>
              )}
            </Box>
            <Typography variant="h5" gutterBottom>
              {settings.profile.firstName} {settings.profile.lastName}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {settings.profile.role}
            </Typography>
            <Chip
              label={settings.profile.organization}
              variant="outlined"
              size="sm"
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Card>
          <CardHeader
            title="Profile Information"
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                {editMode ? (
                  <>
                    <Button
                      startIcon={<CancelIcon />}
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={loading}
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </Button>
                )}
              </Box>
            }
          />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={settings.profile.firstName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: {
                        ...settings.profile,
                        firstName: e.target.value,
                      },
                    })
                  }
                  disabled={!editMode}
                  InputProps={{
                    startAdornment: (
                      <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={settings.profile.lastName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: {
                        ...settings.profile,
                        lastName: e.target.value,
                      },
                    })
                  }
                  disabled={!editMode}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={settings.profile.email}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={settings.profile.phone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: { ...settings.profile, phone: e.target.value },
                    })
                  }
                  disabled={!editMode}
                  InputProps={{
                    startAdornment: (
                      <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={settings.profile.location}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: {
                        ...settings.profile,
                        location: e.target.value,
                      },
                    })
                  }
                  disabled={!editMode}
                  InputProps={{
                    startAdornment: (
                      <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Organization"
                  value={settings.profile.organization}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: {
                        ...settings.profile,
                        organization: e.target.value,
                      },
                    })
                  }
                  disabled={!editMode}
                  InputProps={{
                    startAdornment: (
                      <BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Bio"
                  placeholder="Tell us about yourself..."
                  value={settings.profile.bio}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: { ...settings.profile, bio: e.target.value },
                    })
                  }
                  disabled={!editMode}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderPreferencesTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Appearance" avatar={<PaletteIcon />} />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={settings.preferences.theme}
                    label="Theme"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          theme: e.target.value as 'light' | 'dark' | 'auto',
                        },
                      })
                    }
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="auto">Auto (System)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={settings.preferences.language}
                    label="Language"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          language: e.target.value,
                        },
                      })
                    }
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="fr">Français</MenuItem>
                    <MenuItem value="es">Español</MenuItem>
                    <MenuItem value="ha">Hausa</MenuItem>
                    <MenuItem value="ig">Igbo</MenuItem>
                    <MenuItem value="yo">Yoruba</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Regional Settings" avatar={<LanguageIcon />} />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={settings.preferences.timezone}
                    label="Timezone"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          timezone: e.target.value,
                        },
                      })
                    }
                  >
                    <MenuItem value="Africa/Lagos">Lagos (WAT)</MenuItem>
                    <MenuItem value="Africa/Abuja">Abuja (WAT)</MenuItem>
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="America/New_York">New York (EST)</MenuItem>
                    <MenuItem value="Europe/London">London (GMT)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Date Format</InputLabel>
                  <Select
                    value={settings.preferences.dateFormat}
                    label="Date Format"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          dateFormat: e.target.value,
                        },
                      })
                    }
                  >
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={settings.preferences.currency}
                    label="Currency"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        preferences: {
                          ...settings.preferences,
                          currency: e.target.value,
                        },
                      })
                    }
                  >
                    <MenuItem value="NGN">Nigerian Naira (₦)</MenuItem>
                    <MenuItem value="NGN">Nigerian Naira (₦)</MenuItem>
                    <MenuItem value="EUR">Euro (€)</MenuItem>
                    <MenuItem value="GBP">British Pound (£)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderNotificationsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title="Notification Preferences"
            avatar={<NotificationsIcon />}
          />
          <Divider />
          <CardContent>
            <List>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive important updates via email"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          email: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <NotificationsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Push Notifications"
                  secondary="Browser and mobile push notifications"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.push}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          push: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <PhoneIcon />
                </ListItemIcon>
                <ListItemText
                  primary="SMS Notifications"
                  secondary="Text messages for critical alerts"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.sms}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          sms: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SecurityIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Security Alerts"
                  secondary="Login attempts and security events"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.security}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          security: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Product Updates"
                  secondary="New features and system updates"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.updates}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          updates: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Badge badgeContent="New" color="primary">
                    <NotificationsIcon />
                  </Badge>
                </ListItemIcon>
                <ListItemText
                  primary="Marketing Communications"
                  secondary="Promotional emails and newsletters"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.notifications.marketing}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          marketing: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderSecurityTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Security Settings" avatar={<SecurityIcon />} />
          <Divider />
          <CardContent>
            <List>
              <ListItem>
                <ListItemIcon>
                  <ShieldIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Two-Factor Authentication"
                  secondary="Add an extra layer of security"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.security.twoFactorEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          twoFactorEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <NotificationsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Login Notifications"
                  secondary="Get notified of new logins"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.security.loginNotifications}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          loginNotifications: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Session Timeout (minutes)
              </Typography>
              <Select
                fullWidth
                size="sm"
                value={settings.security.sessionTimeout}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: {
                      ...settings.security,
                      sessionTimeout: Number(e.target.value),
                    },
                  })
                }
              >
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
                <MenuItem value={60}>1 hour</MenuItem>
                <MenuItem value={120}>2 hours</MenuItem>
                <MenuItem value={0}>Never</MenuItem>
              </Select>
            </Box>

            <Button
              variant="outlined"
              startIcon={<KeyIcon />}
              onClick={() => setShowPasswordDialog(true)}
              fullWidth
            >
              Change Password
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Privacy Settings" avatar={<ShieldIcon />} />
          <Divider />
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Profile Visibility
              </Typography>
              <Select
                fullWidth
                size="sm"
                value={settings.privacy.profileVisibility}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    privacy: {
                      ...settings.privacy,
                      profileVisibility: e.target.value as
                        | 'public'
                        | 'private'
                        | 'team',
                    },
                  })
                }
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="organization">Organization Only</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </Select>
            </Box>

            <List>
              <ListItem>
                <ListItemText
                  primary="Data Sharing"
                  secondary="Allow anonymized data for research"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.privacy.dataSharing}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacy: {
                          ...settings.privacy,
                          dataSharing: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Analytics"
                  secondary="Help improve our service"
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={settings.privacy.analytics}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacy: {
                          ...settings.privacy,
                          analytics: e.target.checked,
                        },
                      })
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderDataTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Data Management" avatar={<StorageIcon />} />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: 'center', p: 3 }}>
                  <StorageIcon
                    sx={{ fontSize: 48, color: 'primary.main', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Export Your Data
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ mb: 3 }}
                  >
                    Download a copy of all your data in a portable format
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => setShowDataExportDialog(true)}
                  >
                    Request Data Export
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: 'center', p: 3 }}>
                  <DeleteIcon
                    sx={{ fontSize: 48, color: 'error.main', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Delete Account
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ mb: 3 }}
                  >
                    Permanently delete your account and all associated data
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                  >
                    Delete Account
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardHeader title="Storage Usage" avatar={<StorageIcon />} />
          <Divider />
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">Documents & Files</Typography>
                <Typography variant="body2">2.4 GB / 5 GB</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={48}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">Patient Records</Typography>
                <Typography variant="body2">850 MB / 2 GB</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={42.5}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="body2">Images & Media</Typography>
                <Typography variant="body2">1.2 GB / 3 GB</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={40}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Alert severity="info">
              <Typography variant="body2">
                You're using 4.45 GB of 10 GB total storage. Upgrade to get more
                space.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/dashboard" color="inherit">
            Dashboard
          </Link>
          <Typography color="textPrimary">Settings</Typography>
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
              <SettingsIcon sx={{ mr: 1, fontSize: 'inherit' }} />
              Settings
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage your account preferences and system configuration
            </Typography>
          </Box>
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
          {settingsTabs.map((tab) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
              sx={{ minHeight: 64 }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && renderProfileTab()}
        {activeTab === 1 && renderPreferencesTab()}
        {activeTab === 2 && renderNotificationsTab()}
        {activeTab === 3 && renderSecurityTab()}
        {activeTab === 4 && renderDataTab()}
      </Box>

      {/* Password Change Dialog */}
      <Dialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon />
            Change Password
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Current Password"
                type={passwordForm.showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() =>
                        setPasswordForm({
                          ...passwordForm,
                          showCurrentPassword:
                            !passwordForm.showCurrentPassword,
                        })
                      }
                      edge="end"
                    >
                      {passwordForm.showCurrentPassword ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                type={passwordForm.showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() =>
                        setPasswordForm({
                          ...passwordForm,
                          showNewPassword: !passwordForm.showNewPassword,
                        })
                      }
                      edge="end"
                    >
                      {passwordForm.showNewPassword ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm New Password"
                type={passwordForm.showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() =>
                        setPasswordForm({
                          ...passwordForm,
                          showConfirmPassword:
                            !passwordForm.showConfirmPassword,
                        })
                      }
                      edge="end"
                    >
                      {passwordForm.showConfirmPassword ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePasswordChange}
            disabled={
              loading ||
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              passwordForm.newPassword !== passwordForm.confirmPassword
            }
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Export Dialog */}
      <Dialog
        open={showDataExportDialog}
        onClose={() => setShowDataExportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Request Data Export</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            We'll prepare your data export and send you a download link via
            email. This process may take up to 24 hours.
          </Alert>
          <Typography variant="body2" color="textSecondary">
            Your export will include:
          </Typography>
          <List dense>
            <ListItem>• Profile information</ListItem>
            <ListItem>• Patient records (anonymized)</ListItem>
            <ListItem>• Transaction history</ListItem>
            <ListItem>• Settings and preferences</ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDataExportDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Handle data export request
              setShowDataExportDialog(false);
            }}
          >
            Request Export
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Settings;
