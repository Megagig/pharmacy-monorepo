import React, { useState, useEffect } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    Typography,
    Box,
    Divider,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Chip,
    ListItemButton,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { apiHelpers } from '../../utils/apiHelpers';
import { useNavigate } from 'react-router-dom';

interface Notification {
    _id: string;
    type: string;
    title: string;
    content: string;
    priority: string;
    status: string;
    createdAt: string;
    data: {
        actionUrl?: string;
        testName?: string;
        [key: string]: any;
    };
}

const NotificationBell: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const open = Boolean(anchorEl);

    useEffect(() => {
        fetchUnreadCount();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const response = await apiHelpers.get('/api/patient-portal/notifications/unread-count');
            if (response.success) {
                setUnreadCount(response.data.unreadCount);
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await apiHelpers.get(
                '/api/patient-portal/notifications?page=1&limit=5&status=unread'
            );
            if (response.success) {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        fetchNotifications();
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        try {
            await apiHelpers.put(`/api/patient-portal/notifications/${notification._id}/read`, {});
            // Update local state
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setNotifications((prev) =>
                prev.map((n) => (n._id === notification._id ? { ...n, status: 'read' } : n))
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }

        // Navigate to action URL
        if (notification.data.actionUrl) {
            navigate(notification.data.actionUrl);
        }
        handleClose();
    };

    const handleMarkAllRead = async () => {
        try {
            await apiHelpers.put('/api/patient-portal/notifications/read-all', {});
            setUnreadCount(0);
            setNotifications([]);
            fetchUnreadCount();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleViewAll = () => {
        navigate('/patient-portal/notifications');
        handleClose();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'lab_result_available':
            case 'lab_result_interpretation':
                return <ScienceIcon color="primary" />;
            case 'vitals_verified':
                return <FavoriteIcon color="error" />;
            case 'visit_summary_available':
                return <EventNoteIcon color="secondary" />;
            default:
                return <NotificationsIcon />;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
            case 'critical':
                return 'error';
            case 'high':
                return 'warning';
            default:
                return 'default';
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <>
            <IconButton
                color="inherit"
                onClick={handleClick}
                aria-label="notifications"
                size="large"
            >
                <Badge badgeContent={unreadCount} color="error">
                    {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
                </Badge>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        width: 400,
                        maxHeight: 500,
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                {/* Header */}
                <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Notifications</Typography>
                    {unreadCount > 0 && (
                        <Button size="small" onClick={handleMarkAllRead} startIcon={<CheckCircleIcon />}>
                            Mark all read
                        </Button>
                    )}
                </Box>
                <Divider />

                {/* Notification List */}
                {loading ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            Loading...
                        </Typography>
                    </Box>
                ) : notifications.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            No new notifications
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0 }}>
                        {notifications.map((notification) => (
                            <ListItem
                                key={notification._id}
                                disablePadding
                                sx={{
                                    bgcolor: notification.status === 'unread' ? 'action.hover' : 'transparent',
                                }}
                            >
                                <ListItemButton onClick={() => handleNotificationClick(notification)}>
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: 'transparent' }}>
                                            {getNotificationIcon(notification.type)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: notification.status === 'unread' ? 600 : 400 }}>
                                                    {notification.title}
                                                </Typography>
                                                {notification.priority !== 'normal' && (
                                                    <Chip
                                                        label={notification.priority}
                                                        size="small"
                                                        color={getPriorityColor(notification.priority) as any}
                                                        sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                    {notification.content}
                                                </Typography>
                                                <Typography variant="caption" color="text.disabled">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </Typography>
                                            </>
                                        }
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}

                {notifications.length > 0 && (
                    <>
                        <Divider />
                        <Box sx={{ p: 1, textAlign: 'center' }}>
                            <Button fullWidth onClick={handleViewAll}>
                                View All Notifications
                            </Button>
                        </Box>
                    </>
                )}
            </Menu>
        </>
    );
};

export default NotificationBell;
