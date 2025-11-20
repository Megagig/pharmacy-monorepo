import React from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Chip,
    Skeleton,
    Alert,
    useTheme,
    alpha,
    Divider,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    Person as PersonIcon,
    Description as DescriptionIcon,
    LocalHospital as LocalHospitalIcon,
    Assignment as AssignmentIcon,
    MedicalServices as MedicalServicesIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useSuperAdminActivities } from '../../hooks/useSuperAdminActivities';
import { formatDistanceToNow } from 'date-fns';

const getActivityIcon = (type: string) => {
    switch (type) {
        case 'patient_added':
            return <LocalHospitalIcon />;
        case 'note_created':
            return <DescriptionIcon />;
        case 'mtr_created':
            return <AssignmentIcon />;
        case 'intervention_created':
            return <MedicalServicesIcon />;
        default:
            return <NotificationsIcon />;
    }
};

const getActivityColor = (type: string, theme: any) => {
    switch (type) {
        case 'patient_added':
            return theme.palette.primary.main;
        case 'note_created':
            return theme.palette.info.main;
        case 'mtr_created':
            return theme.palette.success.main;
        case 'intervention_created':
            return theme.palette.warning.main;
        default:
            return theme.palette.grey[500];
    }
};

const SuperAdminRecentActivities: React.FC = () => {
    const theme = useTheme();
    const { data, loading, error } = useSuperAdminActivities(10);

    if (error) {
        return (
            <Box mb={4}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load activities data: {error}
                </Alert>
            </Box>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            <Box mb={4}>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 'bold',
                        mb: 3,
                        color: 'text.primary',
                    }}
                >
                    Recent Activities
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            md: 'repeat(2, 1fr)',
                        },
                        gap: 3,
                    }}
                >
                    {/* System Activities */}
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <Avatar
                                    sx={{
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        color: theme.palette.primary.main,
                                        mr: 2,
                                    }}
                                >
                                    <NotificationsIcon />
                                </Avatar>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                    System Activities
                                </Typography>
                            </Box>

                            {loading ? (
                                <Box>
                                    {[...Array(5)].map((_, index) => (
                                        <Box key={index} mb={2}>
                                            <Skeleton variant="text" width="80%" />
                                            <Skeleton variant="text" width="60%" />
                                        </Box>
                                    ))}
                                </Box>
                            ) : data && data.systemActivities.length > 0 ? (
                                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    {data.systemActivities.map((activity, index) => {
                                        const color = getActivityColor(activity.type, theme);
                                        return (
                                            <React.Fragment key={index}>
                                                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                                                    <ListItemAvatar>
                                                        <Avatar
                                                            sx={{
                                                                bgcolor: alpha(color, 0.1),
                                                                color: color,
                                                                width: 40,
                                                                height: 40,
                                                            }}
                                                        >
                                                            {getActivityIcon(activity.type)}
                                                        </Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={
                                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                {activity.description}
                                                            </Typography>
                                                        }
                                                        secondary={
                                                            <Box>
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    component="span"
                                                                >
                                                                    {formatDistanceToNow(new Date(activity.timestamp), {
                                                                        addSuffix: true,
                                                                    })}
                                                                </Typography>
                                                                {activity.workspaceName && (
                                                                    <Chip
                                                                        label={activity.workspaceName}
                                                                        size="small"
                                                                        sx={{ ml: 1, height: 20 }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        }
                                                    />
                                                </ListItem>
                                                {index < data.systemActivities.length - 1 && <Divider />}
                                            </React.Fragment>
                                        );
                                    })}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                                    No recent system activities
                                </Typography>
                            )}
                        </CardContent>
                    </Card>

                    {/* User Activities */}
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <Avatar
                                    sx={{
                                        bgcolor: alpha(theme.palette.success.main, 0.1),
                                        color: theme.palette.success.main,
                                        mr: 2,
                                    }}
                                >
                                    <PersonIcon />
                                </Avatar>
                                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                    User Activities
                                </Typography>
                            </Box>

                            {loading ? (
                                <Box>
                                    {[...Array(5)].map((_, index) => (
                                        <Box key={index} mb={2}>
                                            <Skeleton variant="text" width="80%" />
                                            <Skeleton variant="text" width="60%" />
                                        </Box>
                                    ))}
                                </Box>
                            ) : data && data.userActivities.length > 0 ? (
                                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    {data.userActivities.map((activity, index) => (
                                        <React.Fragment key={index}>
                                            <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                                                <ListItemAvatar>
                                                    <Avatar
                                                        sx={{
                                                            bgcolor: alpha(theme.palette.success.main, 0.1),
                                                            color: theme.palette.success.main,
                                                            width: 40,
                                                            height: 40,
                                                        }}
                                                    >
                                                        {activity.userName.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {activity.userName}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Box>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                display="block"
                                                            >
                                                                {activity.action}
                                                            </Typography>
                                                            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    component="span"
                                                                >
                                                                    {formatDistanceToNow(new Date(activity.timestamp), {
                                                                        addSuffix: true,
                                                                    })}
                                                                </Typography>
                                                                <Chip
                                                                    label={activity.role}
                                                                    size="small"
                                                                    sx={{ height: 20 }}
                                                                />
                                                                {activity.workspaceName && (
                                                                    <Chip
                                                                        label={activity.workspaceName}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ height: 20 }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                            {index < data.userActivities.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                                    No recent user activities
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        </motion.div>
    );
};

export default SuperAdminRecentActivities;
