import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemButton,
    Avatar,
    Chip,
    IconButton,
    Pagination,
    Tabs,
    Tab,
    Button,
    Alert,
    CircularProgress,
    Paper,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EventNoteIcon from '@mui/icons-material/EventNote';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
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
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

const NotificationsPage: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const statusFilters = ['unread', 'read', 'all'];

    useEffect(() => {
        fetchNotifications();
    }, [tabValue, page]);

    const fetchNotifications = async () => {
        setLoading(true);
        setError('');
        try {
            const status = statusFilters[tabValue];
            const url =
                status === 'all'
                    ? `/api/patient-portal/notifications?page=${page}&limit=20`
                    : `/api/patient-portal/notifications?page=${page}&limit=20&status=${status}`;

            const response = await apiHelpers.get(url);
            if (response.success) {
                setNotifications(response.data.notifications);
                setTotalPages(response.data.pagination.totalPages);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setPage(1);
    };

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        setPage(value);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (notification.status === 'unread') {
            try {
                await apiHelpers.put(`/api/patient-portal/notifications/${notification._id}/read`, {});
                setNotifications((prev) =>
                    prev.map((n) => (n._id === notification._id ? { ...n, status: 'read' } : n))
                );
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        }

        if (notification.data.actionUrl) {
            navigate(notification.data.actionUrl);
        }
    };

    const handleDelete = async (notificationId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            await apiHelpers.delete(`/api/patient-portal/notifications/${notificationId}`);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiHelpers.put('/api/patient-portal/notifications/read-all', {});
            fetchNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Stay updated on your health records and care updates
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={fetchNotifications}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        startIcon={<CheckCircleIcon />}
                        onClick={handleMarkAllRead}
                        variant="outlined"
                    >
                        Mark All Read
                    </Button>
                </Box>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                    <Tab label="Unread" />
                    <Tab label="Read" />
                    <Tab label="All" />
                </Tabs>
            </Paper>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Tab Panels */}
            {[0, 1, 2].map((index) => (
                <TabPanel key={index} value={tabValue} index={index}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : notifications.length === 0 ? (
                        <Card>
                            <CardContent>
                                <Box sx={{ textAlign: 'center', py: 6 }}>
                                    <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        No notifications
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        You're all caught up! Check back later for updates.
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card>
                                <List sx={{ p: 0 }}>
                                    {notifications.map((notification, idx) => (
                                        <React.Fragment key={notification._id}>
                                            <ListItem
                                                disablePadding
                                                sx={{
                                                    bgcolor: notification.status === 'unread' ? 'action.hover' : 'transparent',
                                                }}
                                                secondaryAction={
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="delete"
                                                        onClick={(e) => handleDelete(notification._id, e)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemButton
                                                    onClick={() => handleNotificationClick(notification)}
                                                    sx={{ py: 2 }}
                                                >
                                                    <ListItemAvatar>
                                                        <Avatar sx={{ bgcolor: 'transparent', width: 48, height: 48 }}>
                                                            {getNotificationIcon(notification.type)}
                                                        </Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                                <Typography
                                                                    variant="subtitle1"
                                                                    sx={{ fontWeight: notification.status === 'unread' ? 600 : 400 }}
                                                                >
                                                                    {notification.title}
                                                                </Typography>
                                                                {notification.priority !== 'normal' && (
                                                                    <Chip
                                                                        label={notification.priority.toUpperCase()}
                                                                        size="small"
                                                                        color={getPriorityColor(notification.priority) as any}
                                                                    />
                                                                )}
                                                                {notification.status === 'unread' && (
                                                                    <Chip label="New" size="small" color="primary" />
                                                                )}
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                                    {notification.content}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.disabled">
                                                                    {formatDate(notification.createdAt)}
                                                                </Typography>
                                                            </>
                                                        }
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                            {idx < notifications.length - 1 && <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </Card>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                                    <Pagination
                                        count={totalPages}
                                        page={page}
                                        onChange={handlePageChange}
                                        color="primary"
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </TabPanel>
            ))}
        </Container>
    );
};

export default NotificationsPage;
