import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Box,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/ExitToApp';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscriptionStatus } from '../hooks/useSubscription';
import { useNotificationStore } from '../stores/notificationStore';
import ThemeToggle from './common/ThemeToggle';
import CommunicationNotificationBadge from './communication/CommunicationNotificationBadge';
import { formatDistanceToNow } from 'date-fns';

/**
 * Main navigation bar component displayed at the top of the application
 * when users are logged in.
 */
const Navbar: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] =
    useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const { tier } = useSubscriptionStatus();
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
  } = useNotificationStore();

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications({ limit: 10 });
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
    // Refresh notifications when opening the menu
    fetchNotifications({ limit: 10 });
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
    handleMenuClose();
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const getSubscriptionChipColor = () => {
    switch (tier) {
      case 'enterprise':
        return 'error';
      case 'pro':
        return 'secondary';
      case 'basic':
        return 'primary';
      case 'free_trial':
      default:
        return 'default';
    }
  };

  if (!user) return null;

  return (
    <AppBar
      position="fixed"
      color="primary"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ display: { xs: 'none', sm: 'block' }, flexGrow: 1 }}
        >
          PharmacyCopilot
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {tier && (
            <Chip
              size="small"
              label={tier.replace('_', ' ').toUpperCase()}
              color={
                getSubscriptionChipColor() as
                | 'default'
                | 'primary'
                | 'secondary'
                | 'error'
              }
            />
          )}

          {/* Theme Toggle */}
          <Box sx={{ mr: 1 }}>
            <ThemeToggle size="sm" />
          </Box>

          {/* Communication Hub Notification Badge */}
          <CommunicationNotificationBadge size="medium" showPreview={true} />

          <IconButton
            size="large"
            color="inherit"
            onClick={handleNotificationMenuOpen}
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton
            size="large"
            edge="end"
            color="inherit"
            onClick={handleProfileMenuOpen}
          >
            {/* Use default icon for now */}
            <AccountCircleIcon />
          </IconButton>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem component={Link} to="/profile" onClick={handleMenuClose}>
            Profile
          </MenuItem>
          <MenuItem
            component={Link}
            to="/subscription-management"
            onClick={handleMenuClose}
          >
            Subscription
          </MenuItem>
          {user.role === 'super_admin' && (
            <MenuItem component={Link} to="/admin" onClick={handleMenuClose}>
              Admin Dashboard
            </MenuItem>
          )}
          <MenuItem component={Link} to="/settings" onClick={handleMenuClose}>
            Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>

        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: { width: 360, maxHeight: 480 },
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Typography variant="caption" color="textSecondary">
                {unreadCount} unread
              </Typography>
            )}
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && notifications.length === 0 && (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                No notifications
              </Typography>
            </Box>
          )}

          {!loading &&
            notifications.slice(0, 5).map((notification) => (
              <MenuItem
                key={notification._id}
                onClick={() => handleNotificationClick(notification._id, notification.isRead)}
                sx={{
                  backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                  borderLeft: notification.isRead ? 'none' : 3,
                  borderColor: 'primary.main',
                  whiteSpace: 'normal',
                  py: 1.5,
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                    {notification.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {notification.content}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </Typography>
                </Box>
              </MenuItem>
            ))}

          {notifications.length > 0 && (
            <>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  navigate('/notifications');
                }}
                sx={{ justifyContent: 'center', color: 'primary.main' }}
              >
                <Typography variant="body2">View all notifications</Typography>
              </MenuItem>
            </>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
