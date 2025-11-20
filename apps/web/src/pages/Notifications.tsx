import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    Typography,
    Button,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Alert,
    CircularProgress,
    Tooltip,
    Badge,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import SendIcon from '@mui/icons-material/Send';
import { useNotificationStore } from '../stores/notificationStore';
import notificationService from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

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
            id={`notification-tabpanel-${index}`}
            aria-labelledby={`notification-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

const NotificationsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openPreferencesDialog, setOpenPreferencesDialog] = useState(false);
    const [creating, setCreating] = useState(false);
    const { user } = useAuth();

    // Create notification form state
    const [newNotification, setNewNotification] = useState({
        title: '',
        content: '',
        type: 'info',
        priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    });

    const {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markMultipleAsRead,
        dismissNotification,
        fetchPreferences,
    } = useNotificationStore();

    useEffect(() => {
        fetchNotifications({ limit: 100 });
        fetchPreferences();
    }, [fetchNotifications, fetchPreferences]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleMarkAllAsRead = async () => {
        const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
        if (unreadIds.length > 0) {
            await markMultipleAsRead(unreadIds);
            toast.success('All notifications marked as read');
        }
    };

    const handleRefresh = () => {
        fetchNotifications({ limit: 100 });
        toast.success('Notifications refreshed');
    };

    const handleCreateNotification = async () => {
        if (!user?.id) {
            toast.error('User not authenticated');
            return;
        }

        setCreating(true);
        try {
            await notificationService.createNotification({
                userId: user.id,
                title: newNotification.title,
                content: newNotification.content,
                type: newNotification.type,
                priority: newNotification.priority,
                deliveryChannels: ['in-app'],
            });

            toast.success('Notification created successfully');
            setOpenCreateDialog(false);
            setNewNotification({
                title: '',
                content: '',
                type: 'info',
                priority: 'normal',
            });

            // Refresh notifications list
            fetchNotifications({ limit: 100 });
        } catch (error: any) {
            console.error('Failed to create notification:', error);
            toast.error(error.response?.data?.message || 'Failed to create notification');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await dismissNotification(notificationId);
            toast.success('Notification deleted');
        } catch (error) {
            toast.error('Failed to delete notification');
        }
    };

    const filteredNotifications = notifications.filter((notification) => {
        if (activeTab === 0) return true; // All
        if (activeTab === 1) return !notification.isRead; // Unread
        if (activeTab === 2) return notification.isRead; // Read
        return true;
    });

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'error';
            case 'high':
                return 'warning';
            case 'normal':
                return 'info';
            case 'low':
                return 'default';
            default:
                return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <NotificationsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1">
                            Notifications
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage and view all your notifications
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={handleRefresh} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Mark all as read">
                        <IconButton onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                            <Badge badgeContent={unreadCount} color="error">
                                <DoneAllIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Preferences">
                        <IconButton onClick={() => setOpenPreferencesDialog(true)}>
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenCreateDialog(true)}
                    >
                        New Notification
                    </Button>
                </Box>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => { }}>
                    {error}
                </Alert>
            )}

            {/* Tabs */}
            <Card>
                <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label={`All (${notifications.length})`} />
                    <Tab label={`Unread (${unreadCount})`} />
                    <Tab label={`Read (${notifications.filter((n) => n.isRead).length})`} />
                </Tabs>

                {/* Loading State */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )}

                {/* Empty State */}
                {!loading && filteredNotifications.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No notifications
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {activeTab === 1
                                ? 'You have no unread notifications'
                                : activeTab === 2
                                    ? 'You have no read notifications'
                                    : 'You have no notifications yet'}
                        </Typography>
                    </Box>
                )}

                {/* Notifications List */}
                {!loading && (
                    <TabPanel value={activeTab} index={activeTab}>
                        <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                            {filteredNotifications.map((notification) => (
                                <ListItem
                                    key={notification._id}
                                    sx={{
                                        borderLeft: notification.isRead ? 'none' : 4,
                                        borderColor: 'primary.main',
                                        backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                                        mb: 1,
                                        borderRadius: 1,
                                        '&:hover': {
                                            backgroundColor: 'action.selected',
                                        },
                                    }}
                                    secondaryAction={
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            {!notification.isRead && (
                                                <Tooltip title="Mark as read">
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        onClick={() => markAsRead(notification._id)}
                                                    >
                                                        <DoneAllIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteNotification(notification._id)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight={notification.isRead ? 'normal' : 'bold'}
                                                >
                                                    {notification.title}
                                                </Typography>
                                                <Chip
                                                    label={notification.priority}
                                                    size="small"
                                                    color={getPriorityColor(notification.priority) as any}
                                                />
                                                <Chip label={notification.type} size="small" variant="outlined" />
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {notification.content}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </TabPanel>
                )}
            </Card>

            {/* Create Notification Dialog */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SendIcon />
                        Create New Notification
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Title"
                            value={newNotification.title}
                            onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Content"
                            value={newNotification.content}
                            onChange={(e) => setNewNotification({ ...newNotification, content: e.target.value })}
                            multiline
                            rows={4}
                            required
                        />
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={newNotification.type}
                                        label="Type"
                                        onChange={(e) => setNewNotification({ ...newNotification, type: e.target.value })}
                                    >
                                        <MenuItem value="info">Info</MenuItem>
                                        <MenuItem value="success">Success</MenuItem>
                                        <MenuItem value="warning">Warning</MenuItem>
                                        <MenuItem value="error">Error</MenuItem>
                                        <MenuItem value="system">System</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={newNotification.priority}
                                        label="Priority"
                                        onChange={(e) =>
                                            setNewNotification({
                                                ...newNotification,
                                                priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent',
                                            })
                                        }
                                    >
                                        <MenuItem value="low">Low</MenuItem>
                                        <MenuItem value="normal">Normal</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Alert severity="info">
                            This will create a notification for yourself. In a production environment, you would select target users or roles.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)} disabled={creating}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateNotification}
                        disabled={!newNotification.title || !newNotification.content || creating}
                    >
                        {creating ? <CircularProgress size={20} /> : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preferences Dialog */}
            <Dialog
                open={openPreferencesDialog}
                onClose={() => setOpenPreferencesDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Notification Preferences</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Configure how you receive notifications across different channels.
                        </Typography>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Preference management will be available in a future update. For now, all in-app notifications are enabled by default.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPreferencesDialog(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default NotificationsPage;
