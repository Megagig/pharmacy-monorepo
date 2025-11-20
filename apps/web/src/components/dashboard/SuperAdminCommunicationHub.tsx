import React from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Avatar,
    Skeleton,
    Alert,
    useTheme,
    alpha,
    Chip,
    LinearProgress,
} from '@mui/material';
import {
    Chat as ChatIcon,
    Message as MessageIcon,
    MarkEmailUnread as UnreadIcon,
    Speed as SpeedIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useSuperAdminCommunications } from '../../hooks/useSuperAdminCommunications';

interface CommunicationMetricCardProps {
    title: string;
    value: number | string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
    progress?: number;
}

const CommunicationMetricCard: React.FC<CommunicationMetricCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color,
    loading = false,
    progress,
}) => {
    const theme = useTheme();

    return (
        <Card
            sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(
                    color,
                    0.05
                )} 100%)`,
                border: `1px solid ${alpha(color, 0.2)}`,
                position: 'relative',
                overflow: 'visible',
            }}
        >
            <CardContent sx={{ p: 3 }}>
                {/* Background Pattern */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${alpha(color, 0.1)}, ${alpha(
                            color,
                            0.05
                        )})`,
                        zIndex: 0,
                    }}
                />

                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Avatar
                            sx={{
                                bgcolor: alpha(color, 0.15),
                                color: color,
                                width: 48,
                                height: 48,
                            }}
                        >
                            {icon}
                        </Avatar>
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {title}
                    </Typography>

                    {loading ? (
                        <Skeleton variant="text" width="60%" height={48} />
                    ) : (
                        <Typography
                            variant="h3"
                            component="div"
                            sx={{
                                color: color,
                                fontWeight: 'bold',
                                mb: 1,
                            }}
                        >
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        {subtitle}
                    </Typography>

                    {progress !== undefined && (
                        <Box>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: alpha(color, 0.1),
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: color,
                                    },
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                {progress}% active
                            </Typography>
                        </Box>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

const SuperAdminCommunicationHub: React.FC = () => {
    const theme = useTheme();
    const { data, loading, error } = useSuperAdminCommunications();

    if (error) {
        return (
            <Box mb={4}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load communications data: {error}
                </Alert>
            </Box>
        );
    }

    // Calculate activity percentage
    const activityPercentage = data && data.totalConversations > 0
        ? Math.round((data.activeConversations / data.totalConversations) * 100)
        : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            <Box mb={4}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 'bold',
                            color: 'text.primary',
                        }}
                    >
                        Communication Hub
                    </Typography>
                    {data && data.byWorkspace.length > 0 && (
                        <Chip
                            label={`${data.byWorkspace.length} Active Workspaces`}
                            size="small"
                            color="success"
                            variant="outlined"
                        />
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(4, 1fr)',
                        },
                        gap: 3,
                    }}
                >
                    <CommunicationMetricCard
                        title="Total Conversations"
                        value={data?.totalConversations || 0}
                        subtitle="All conversations"
                        icon={<ChatIcon />}
                        color={theme.palette.primary.main}
                        loading={loading}
                        progress={activityPercentage}
                    />

                    <CommunicationMetricCard
                        title="Active Conversations"
                        value={data?.activeConversations || 0}
                        subtitle="Last 24 hours"
                        icon={<ChatIcon />}
                        color={theme.palette.success.main}
                        loading={loading}
                    />

                    <CommunicationMetricCard
                        title="Total Messages"
                        value={data?.totalMessages || 0}
                        subtitle={`${data?.recentMessages || 0} in last 24h`}
                        icon={<MessageIcon />}
                        color={theme.palette.info.main}
                        loading={loading}
                    />

                    <CommunicationMetricCard
                        title="Avg Response Time"
                        value={data ? `${data.avgResponseTime}m` : '0m'}
                        subtitle={`${data?.unreadMessages || 0} unread`}
                        icon={<SpeedIcon />}
                        color={theme.palette.warning.main}
                        loading={loading}
                    />
                </Box>
            </Box>
        </motion.div>
    );
};

export default SuperAdminCommunicationHub;
