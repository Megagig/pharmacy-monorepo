import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip,
    Badge,
    Divider,
    Tooltip,
    Tab,
    Tabs,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import { useNotificationStore } from '../../stores/notificationStore';
import notificationService from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';

const UnifiedNotificationCenter: React.FC = () => {
    const { user } = useAuth();
    const {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markMultipleAsRead,
        dismissNotification,
    } = useNotificationStore();

    const [activeTab, setActiveTab] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [creating, setCreating] = useState(false);

    // Create notification form state
    const [newNotification, setNewNotification] = useState({
        title: '',
        content: '',
        type: 'info',
        priority: 'normal',
        targetType: 'all', // 'all', 'roles', 'users'
        targetRoles: [] as string[],
        targetUsers: [] as string[],
    });

    // Available roles for targeting
    const availableRoles = [
        'admin',
        'super_admin',
        'pharmacist',
        'pharmacy_tech',
        'doctor',
        'nurse',
        'patient',
    ];

    useEffect(() => {
        fetchNotifications();
        // Refresh every 30 seconds
        const interval = setInterval(() => {
            fetchNotifications();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleRefresh = () => {
        fetchNotifications();
        toast.success('Notifications refreshed');
    };

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markAsRead(notificationId);
            toast.success('Marked as read');
        } catch (error) {
            toast.error('Failed to mark as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const unreadNotifications = notifications.filter((n) => !n.isRead);
            if (unreadNotifications.length === 0) {
                toast('No unread notifications');
                return;
            }
            await markMultipleAsRead(unreadNotifications.map((n) => n._id));
            toast.success('All notifications marked as read');
        } catch (error) {
            toast.error('Failed to mark all as read');
        }
    };

    const handleDelete = async (notificationId: string) => {
        try {
            await dismissNotification(notificationId);
            toast.success('Notification deleted');
        } catch (error) {
            toast.error('Failed to delete notification');
        }
    };

    const handleCreateNotification = async () => {
        if (!newNotification.title || !newNotification.content) {
            toast.error('Please fill in title and content');
            return;
        }

        if (!user?.id) {
            toast.error('User not authenticated');
            return;
        }

        setCreating(true);
        try {
            // Map frontend type to backend type
            const typeMapping: Record<string, string> = {
                'info': 'system_notification',
                'success': 'system_notification',
                'warning': 'system_notification',
                'error': 'clinical_alert',
                'system': 'system_notification',
            };

            // Prepare notification data matching backend schema
            const notificationData: any = {
                userId: user.id,
                type: typeMapping[newNotification.type] || 'system_notification',
                title: newNotification.title,
                content: newNotification.content,
                priority: newNotification.priority || 'normal',
                data: {
                    metadata: {
                        notificationType: newNotification.type, // Store original type for display
                        targetType: newNotification.targetType,
                        targetRoles: newNotification.targetType === 'roles' ? newNotification.targetRoles : undefined,
                        targetUsers: newNotification.targetType === 'users' ? newNotification.targetUsers : undefined,
                        broadcast: newNotification.targetType === 'all',
                    },
                },
                deliveryChannels: {
                    inApp: true,
                    email: false,
                    sms: false,
                    push: true,
                },
            };


            await notificationService.createNotification(notificationData);

            toast.success('Notification sent successfully!');
            setOpenCreateDialog(false);
            setNewNotification({
                title: '',
                content: '',
                type: 'info',
                priority: 'normal',
                targetType: 'all',
                targetRoles: [],
                targetUsers: [],
            });

            // Refresh notifications
            fetchNotifications();
        } catch (error: any) {
            console.error('Failed to create notification:', error);
            console.error('Validation errors:', error.response?.data?.errors);

            // Show specific validation errors if available
            if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
                const errorMessages = error.response.data.errors.map((err: any) => err.message || err).join(', ');
                toast.error(`Validation error: ${errorMessages}`);
            } else {
                toast.error(error.response?.data?.message || error.message || 'Failed to send notification');
            }
        } finally {
            setCreating(false);
        }
    };

    // Filter notifications based on active tab
    const filteredNotifications = notifications.filter((notification) => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
                !notification.title.toLowerCase().includes(query) &&
                !notification.content.toLowerCase().includes(query)
            ) {
                return false;
            }
        }

        // Tab filter
        if (activeTab === 1) return !notification.isRead; // Unread
        if (activeTab === 2) return notification.isRead; // Read
        return true; // All
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

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'success';
            case 'warning':
                return 'warning';
            case 'error':
                return 'error';
            case 'info':
            default:
                return 'info';
        }
    };

    return (
        <Box>
            {/* Header Section */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage and send notifications to users
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={handleRefresh} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Mark all as read">
                        <IconButton onClick={handleMarkAllAsRead} disabled={loading || unreadCount === 0}>
                            <Badge badgeContent={unreadCount} color="primary">
                                <DoneAllIcon />
                            </Badge>
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

            {/* Search and Filter */}
            <Box sx={{ mb: 2 }}>
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
                    }}
                />
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="notification tabs">
                    <Tab label={`All (${notifications.length})`} />
                    <Tab
                        label={
                            <Badge badgeContent={unreadCount} color="primary">
                                Unread
                            </Badge>
                        }
                    />
                    <Tab label={`Read (${notifications.filter((n) => n.isRead).length})`} />
                </Tabs>
            </Paper>

            {/* Notifications List */}
            <Paper sx={{ minHeight: 400 }}>
                {loading && notifications.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : filteredNotifications.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="body1" color="text.secondary">
                            No notifications found
                        </Typography>
                    </Box>
                ) : (
                    <List>
                        {filteredNotifications.map((notification, index) => (
                            <React.Fragment key={notification._id}>
                                {index > 0 && <Divider />}
                                <ListItem
                                    sx={{
                                        bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                        '&:hover': { bgcolor: 'action.selected' },
                                        alignItems: 'flex-start',
                                    }}
                                    secondaryAction={
                                        <Box>
                                            {!notification.isRead && (
                                                <Tooltip title="Mark as read">
                                                    <IconButton
                                                        edge="end"
                                                        onClick={() => handleMarkAsRead(notification._id)}
                                                        size="small"
                                                    >
                                                        <DoneAllIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    edge="end"
                                                    onClick={() => handleDelete(notification._id)}
                                                    size="small"
                                                    sx={{ ml: 1 }}
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
                                                    variant="subtitle2"
                                                    sx={{ fontWeight: notification.isRead ? 400 : 600 }}
                                                >
                                                    {notification.title}
                                                </Typography>
                                                <Chip
                                                    label={notification.type}
                                                    size="small"
                                                    color={getTypeColor(notification.type)}
                                                />
                                                <Chip
                                                    label={notification.priority}
                                                    size="small"
                                                    color={getPriorityColor(notification.priority)}
                                                    variant="outlined"
                                                />
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                    {notification.content}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDistanceToNow(new Date(notification.createdAt), {
                                                        addSuffix: true,
                                                    })}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Paper>

            {/* Create Notification Dialog */}
            <Dialog
                open={openCreateDialog}
                onClose={() => !creating && setOpenCreateDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SendIcon />
                        Create New Notification
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Title"
                            required
                            value={newNotification.title}
                            onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Content"
                            required
                            multiline
                            rows={4}
                            value={newNotification.content}
                            onChange={(e) => setNewNotification({ ...newNotification, content: e.target.value })}
                            sx={{ mb: 2 }}
                        />
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid size={{ xs: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={newNotification.type}
                                        label="Type"
                                        onChange={(e) =>
                                            setNewNotification({ ...newNotification, type: e.target.value })
                                        }
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
                                                priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent' | 'critical',
                                            })
                                        }
                                    >
                                        <MenuItem value="low">Low</MenuItem>
                                        <MenuItem value="normal">Normal</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                        <MenuItem value="critical">Critical</MenuItem>
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {/* Target Selection */}
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Send To</InputLabel>
                            <Select
                                value={newNotification.targetType}
                                label="Send To"
                                onChange={(e) =>
                                    setNewNotification({ ...newNotification, targetType: e.target.value })
                                }
                            >
                                <MenuItem value="all">All Users</MenuItem>
                                <MenuItem value="roles">Specific Roles</MenuItem>
                                <MenuItem value="users">Specific Users</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Role Selection */}
                        {newNotification.targetType === 'roles' && (
                            <Autocomplete
                                multiple
                                options={availableRoles}
                                value={newNotification.targetRoles}
                                onChange={(_e, newValue) =>
                                    setNewNotification({ ...newNotification, targetRoles: newValue })
                                }
                                renderInput={(params) => (
                                    <TextField {...params} label="Select Roles" placeholder="Choose roles" />
                                )}
                                sx={{ mb: 2 }}
                            />
                        )}

                        {/* User Selection */}
                        {newNotification.targetType === 'users' && (
                            <TextField
                                fullWidth
                                label="User IDs (comma-separated)"
                                placeholder="user1, user2, user3"
                                value={newNotification.targetUsers.join(', ')}
                                onChange={(e) =>
                                    setNewNotification({
                                        ...newNotification,
                                        targetUsers: e.target.value.split(',').map((id) => id.trim()),
                                    })
                                }
                                sx={{ mb: 2 }}
                                helperText="Enter user IDs separated by commas"
                            />
                        )}

                        <Alert severity="info" sx={{ mt: 2 }}>
                            This will create a notification for{' '}
                            {newNotification.targetType === 'all'
                                ? 'all users'
                                : newNotification.targetType === 'roles'
                                    ? `users with roles: ${newNotification.targetRoles.join(', ')}`
                                    : `specific users`}
                            . The notification will appear in their navbar dropdown.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)} disabled={creating}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateNotification}
                        variant="contained"
                        startIcon={creating ? <CircularProgress size={20} /> : <SendIcon />}
                        disabled={creating || !newNotification.title || !newNotification.content}
                    >
                        {creating ? 'Sending...' : 'Send Notification'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UnifiedNotificationCenter;
