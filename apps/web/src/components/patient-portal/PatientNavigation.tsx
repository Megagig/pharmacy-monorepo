import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  Badge,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Medication as MedicationIcon,
  LocalHospital as HealthIcon,
  Message as MessageIcon,
  CalendarToday as CalendarIcon,
  Receipt as BillingIcon,
  School as EducationIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import SkipNavigation from './SkipNavigation';
import AccessibilityToolbar from './AccessibilityToolbar';

interface NavigationItem {
  name: string;
  path: string;
  icon: React.ComponentType;
  badge?: string | number;
  disabled?: boolean;
}

interface PatientNavigationProps {
  workspaceId?: string;
}

const PatientNavigation: React.FC<PatientNavigationProps> = ({ workspaceId }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState<null | HTMLElement>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout, isAuthenticated } = usePatientAuth();

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setProfileMenuAnchor(null);
    setNotificationMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/patient-access');
  };

  // Navigation items for authenticated patients
  const navigationItems: NavigationItem[] = [
    {
      name: 'Dashboard',
      path: `/patient-portal/${workspaceId || user?.workspaceId}`,
      icon: DashboardIcon,
    },
    {
      name: 'My Profile',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/profile`,
      icon: PersonIcon,
    },
    {
      name: 'Medications',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/medications`,
      icon: MedicationIcon,
    },
    {
      name: 'Health Records',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/health-records`,
      icon: HealthIcon,
    },
    {
      name: 'Messages',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/messages`,
      icon: MessageIcon,
      badge: 3, // TODO: Connect to actual unread count
    },
    {
      name: 'Appointments',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/appointments`,
      icon: CalendarIcon,
    },
    {
      name: 'Billing',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/billing`,
      icon: BillingIcon,
    },
    {
      name: 'Education',
      path: `/patient-portal/${workspaceId || user?.workspaceId}/education`,
      icon: EducationIcon,
    },
  ];

  // Public navigation items
  const publicNavigationItems: NavigationItem[] = [
    {
      name: 'Home',
      path: '/patient-access',
      icon: HomeIcon,
    },
    {
      name: 'Health Blog',
      path: '/blog',
      icon: EducationIcon,
    },
  ];

  const renderNavigationItems = (items: NavigationItem[]) => (
    <List sx={{ px: 1 }}>
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        const IconComponent = item.icon;

        return (
          <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={Link}
              to={item.path}
              disabled={item.disabled}
              sx={{
                borderRadius: 2,
                minHeight: 48,
                backgroundColor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? 'white' : 'text.primary',
                '&:hover': {
                  backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? 'white' : 'text.secondary',
                  minWidth: 40,
                }}
              >
                {item.badge ? (
                  <Badge
                    badgeContent={item.badge}
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.75rem',
                        height: 18,
                        minWidth: 18,
                      },
                    }}
                  >
                    <IconComponent fontSize="small" />
                  </Badge>
                ) : (
                  <IconComponent fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.name}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );

  const drawerContent = (
    <Box sx={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MedicationIcon sx={{ color: '#fff', fontSize: '1.2rem' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {user?.workspaceName || 'Patient Portal'}
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* User Info */}
      {isAuthenticated && user && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'primary.main',
                fontSize: '1.2rem',
              }}
            >
              {user.firstName?.[0]}{user.lastName?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                {user.firstName} {user.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user.email}
              </Typography>
              <Chip
                size="small"
                label={user.status}
                color={user.status === 'active' ? 'success' : 'warning'}
                sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation Items */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {isAuthenticated ? (
          <>
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              Patient Portal
            </Typography>
            {renderNavigationItems(navigationItems)}
          </>
        ) : (
          <>
            <Typography
              variant="overline"
              sx={{
                px: 2,
                py: 1,
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              Public Access
            </Typography>
            {renderNavigationItems(publicNavigationItems)}
          </>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          PharmaCare Patient Portal
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Skip Navigation for Accessibility */}
      <SkipNavigation />
      
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {/* Mobile Menu Button */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MedicationIcon sx={{ color: '#fff', fontSize: '1.2rem' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {user?.workspaceName || 'Patient Portal'}
            </Typography>
          </Box>

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Accessibility Toolbar */}
            <AccessibilityToolbar />
            
            {isAuthenticated && (
              <>
                {/* Notifications */}
                <Tooltip title="Notifications">
                  <IconButton
                    color="inherit"
                    onClick={handleNotificationMenuOpen}
                    size="large"
                    aria-label="View notifications"
                  >
                    <Badge badgeContent={3} color="error">
                      <NotificationsIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>

                {/* Profile Menu */}
                <Tooltip title="Account">
                  <IconButton
                    color="inherit"
                    onClick={handleProfileMenuOpen}
                    size="large"
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.main',
                        fontSize: '0.9rem',
                      }}
                    >
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </Avatar>
                  </IconButton>
                </Tooltip>
              </>
            )}

            {!isAuthenticated && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  component={Link}
                  to={`/patient-auth/${workspaceId}`}
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  <AccountIcon />
                </IconButton>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        id="patient-navigation"
        sx={{ width: { md: 280 }, flexShrink: { md: 0 } }}
        aria-label="patient portal navigation"
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 280,
              top: 64, // Height of AppBar
              height: 'calc(100vh - 64px)',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          component={Link}
          to={`/patient-portal/${workspaceId || user?.workspaceId}/profile`}
          onClick={handleMenuClose}
        >
          <PersonIcon fontSize="small" sx={{ mr: 1 }} />
          My Profile
        </MenuItem>
        <MenuItem
          component={Link}
          to={`/patient-portal/${workspaceId || user?.workspaceId}/settings`}
          onClick={handleMenuClose}
        >
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Notification Menu */}
      <Menu
        anchorEl={notificationMenuAnchor}
        open={Boolean(notificationMenuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Notifications</Typography>
        </Box>
        <MenuItem onClick={handleMenuClose}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Appointment Reminder
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your appointment is tomorrow at 2:00 PM
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Medication Refill Due
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your prescription needs refill in 3 days
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              New Message
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dr. Smith replied to your question
            </Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleMenuClose();
            navigate(`/patient-portal/${workspaceId || user?.workspaceId}/notifications`);
          }}
          sx={{ justifyContent: 'center', color: 'primary.main' }}
        >
          View All Notifications
        </MenuItem>
      </Menu>
    </>
  );
};

export default PatientNavigation;