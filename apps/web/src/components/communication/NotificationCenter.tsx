import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Divider,
  TextField,
  InputAdornment,
  Chip,
  Button,
  Tooltip,
  Switch,
  FormControlLabel,
  Alert,
  Skeleton,
  List,
  ListItem,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Settings as SettingsIcon,
  MarkEmailRead as MarkAllReadIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  VolumeUp as SoundOnIcon,
  VolumeOff as SoundOffIcon,
} from '@mui/icons-material';
import { useCommunicationStore } from '../../stores/communicationStore';
import { CommunicationNotification } from '../../stores/types';
import NotificationItem from './NotificationItem';

interface NotificationCenterProps {
  maxHeight?: string;
  showHeader?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onNotificationClick?: (notification: CommunicationNotification) => void;
}

interface NotificationFilters {
  type?: string;
  priority?: string;
  status?: string;
  search?: string;
}

interface NotificationPreferences {
  soundEnabled: boolean;
  desktopNotifications: boolean;
  emailNotifications: boolean;
  groupSimilar: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  maxHeight = '600px',
  showHeader = true,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  onNotificationClick,
}) => {
  // Store state
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    removeNotification,
    loading,
    errors,
  } = useCommunicationStore();

  // Local state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [filters, setFilters] = useState<NotificationFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    soundEnabled: true,
    desktopNotifications: true,
    emailNotifications: false,
    groupSimilar: true,
  });
  const [lastPlayedSound, setLastPlayedSound] = useState<number>(0);

  // Notification sound
  const playNotificationSound = useCallback(() => {
    if (!preferences.soundEnabled) return;

    const now = Date.now();
    // Throttle sound to prevent spam
    if (now - lastPlayedSound < 1000) return;

    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(console.warn);
      setLastPlayedSound(now);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [preferences.soundEnabled, lastPlayedSound]);

  // Auto-refresh notifications
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNotifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Play sound for new notifications
  useEffect(() => {
    const unreadNotifications = notifications.filter(
      (n) => n.status === 'unread'
    );
    if (unreadNotifications.length > 0) {
      playNotificationSound();
    }
  }, [notifications, playNotificationSound]);

  // Desktop notifications
  useEffect(() => {
    if (!preferences.desktopNotifications) return;

    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };

    requestPermission();
  }, [preferences.desktopNotifications]);

  // Show desktop notification for new urgent notifications
  useEffect(() => {
    if (
      !preferences.desktopNotifications ||
      Notification.permission !== 'granted'
    )
      return;

    const urgentNotifications = notifications.filter(
      (n) => n.status === 'unread' && ['urgent', 'high'].includes(n.priority)
    );

    urgentNotifications.forEach((notification) => {
      new Notification(notification.title, {
        body: notification.content,
        icon: '/icons/notification-icon.png',
        tag: notification._id,
        requireInteraction: notification.priority === 'urgent',
      });
    });
  }, [notifications, preferences.desktopNotifications]);

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((n) => n.type === filters.type);
    }
    if (filters.priority) {
      filtered = filtered.filter((n) => n.priority === filters.priority);
    }
    if (filters.status) {
      filtered = filtered.filter((n) => n.status === filters.status);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query)
      );
    }

    // Group similar notifications if enabled
    if (preferences.groupSimilar) {
      const grouped = new Map<string, CommunicationNotification[]>();

      filtered.forEach((notification) => {
        const key = `${notification.type}_${
          notification.data.conversationId || 'general'
        }`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(notification);
      });

      // Return the most recent notification from each group
      filtered = Array.from(grouped.values()).map(
        (group) =>
          group.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0]
      );
    }

    // Sort by priority and date
    return filtered.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      const aPriority =
        priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority =
        priorityOrder[b.priority as keyof typeof priorityOrder] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notifications, filters, searchQuery, preferences.groupSimilar]);

  // Event handlers
  const handleNotificationClick = useCallback(
    (notification: CommunicationNotification) => {
      if (notification.status === 'unread') {
        markNotificationAsRead(notification._id);
      }

      if (onNotificationClick) {
        onNotificationClick(notification);
      }
    },
    [markNotificationAsRead, onNotificationClick]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllNotificationsAsRead();
    setAnchorEl(null);
  }, [markAllNotificationsAsRead]);

  const handleRefresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleFilterChange = useCallback(
    (key: keyof NotificationFilters, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value === 'all' ? undefined : value,
      }));
      setFilterAnchorEl(null);
    },
    []
  );

  const handlePreferenceChange = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  // Render loading state
  if (loading.fetchNotifications) {
    return (
      <Paper sx={{ p: 2, maxHeight, overflow: 'hidden' }}>
        {showHeader && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <NotificationsIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Notifications</Typography>
          </Box>
        )}
        <List>
          {[...Array(5)].map((_, index) => (
            <ListItem key={index}>
              <Skeleton variant="rectangular" width="100%" height={60} />
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        maxHeight,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showHeader && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Badge badgeContent={unreadCount} color="error" sx={{ mr: 1 }}>
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">Notifications</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={handleRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Filter">
                <IconButton
                  size="small"
                  onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                  color={
                    Object.keys(filters).length > 0 ? 'primary' : 'default'
                  }
                >
                  <FilterIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Settings">
                <IconButton
                  size="small"
                  onClick={(e) => setSettingsAnchorEl(e.currentTarget)}
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>

              {unreadCount > 0 && (
                <Tooltip title="Mark all as read">
                  <IconButton size="small" onClick={handleMarkAllAsRead}>
                    <MarkAllReadIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Active filters */}
          {(Object.keys(filters).length > 0 || searchQuery) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1,
                flexWrap: 'wrap',
              }}
            >
              {Object.entries(filters).map(
                ([key, value]) =>
                  value && (
                    <Chip
                      key={key}
                      label={`${key}: ${value}`}
                      size="small"
                      onDelete={() =>
                        handleFilterChange(
                          key as keyof NotificationFilters,
                          'all'
                        )
                      }
                    />
                  )
              )}
              {searchQuery && (
                <Chip
                  label={`Search: ${searchQuery}`}
                  size="small"
                  onDelete={() => setSearchQuery('')}
                />
              )}
              <Button size="small" onClick={clearFilters}>
                Clear all
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Error state */}
      {errors.fetchNotifications && (
        <Alert severity="error" sx={{ m: 2 }}>
          {errors.fetchNotifications}
        </Alert>
      )}

      {/* Notifications list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsIcon
              sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }}
            />
            <Typography variant="body1" color="text.secondary">
              {notifications.length === 0
                ? 'No notifications yet'
                : 'No notifications match your filters'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredNotifications.map((notification, index) => (
              <React.Fragment key={notification._id}>
                <NotificationItem
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onDismiss={() => removeNotification(notification._id)}
                />
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
      >
        <MenuItem onClick={() => handleFilterChange('status', 'unread')}>
          Unread only
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('status', 'read')}>
          Read only
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleFilterChange('priority', 'urgent')}>
          Urgent priority
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('priority', 'high')}>
          High priority
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleFilterChange('type', 'new_message')}>
          Messages only
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('type', 'clinical_alert')}>
          Clinical alerts
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('type', 'mention')}>
          Mentions only
        </MenuItem>
      </Menu>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchorEl}
        open={Boolean(settingsAnchorEl)}
        onClose={() => setSettingsAnchorEl(null)}
        PaperProps={{ sx: { minWidth: 250 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Notification Preferences
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={preferences.soundEnabled}
                onChange={(e) =>
                  handlePreferenceChange('soundEnabled', e.target.checked)
                }
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {preferences.soundEnabled ? (
                  <SoundOnIcon sx={{ mr: 1 }} />
                ) : (
                  <SoundOffIcon sx={{ mr: 1 }} />
                )}
                Sound notifications
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.desktopNotifications}
                onChange={(e) =>
                  handlePreferenceChange(
                    'desktopNotifications',
                    e.target.checked
                  )
                }
              />
            }
            label="Desktop notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  handlePreferenceChange('emailNotifications', e.target.checked)
                }
              />
            }
            label="Email notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.groupSimilar}
                onChange={(e) =>
                  handlePreferenceChange('groupSimilar', e.target.checked)
                }
              />
            }
            label="Group similar notifications"
          />
        </Box>
      </Menu>
    </Paper>
  );
};

export default NotificationCenter;
