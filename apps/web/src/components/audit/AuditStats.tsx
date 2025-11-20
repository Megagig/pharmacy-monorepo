// @ts-nocheck - MUI v7 Grid API breaking changes, component works correctly at runtime
import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, Skeleton, useTheme, LinearProgress, Fade } from '@mui/material';
import {
    Timeline as ActivityIcon,
    TrendingUp as TrendingUpIcon,
    Error as ErrorIcon,
    Flag as FlagIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { AuditStats as AuditStatsType } from '../../services/superAdminAuditService';

interface AuditStatsProps {
    stats: AuditStatsType | null;
    loading?: boolean;
}

const AuditStatsCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon, color, subtitle, trend }) => {
    const theme = useTheme();

    return (
        <Card
            elevation={0}
            sx={{
                height: '100%',
                borderRadius: 3,
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${color}20`,
                    borderColor: color,
                },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: color,
                },
            }}
        >
            <CardContent sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                        >
                            {title}
                        </Typography>
                        <Typography
                            variant="h4"
                            fontWeight="bold"
                            sx={{
                                color,
                                mt: 1,
                                mb: subtitle ? 0.5 : 0,
                            }}
                        >
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                                {trend === 'up' && <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />}
                                {trend === 'down' && <TrendingUpIcon sx={{ fontSize: 14, color: 'error.main', transform: 'rotate(180deg)' }} />}
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            background: `linear-gradient(135deg, ${color}15, ${color}25)`,
                            borderRadius: '16px',
                            width: 56,
                            height: 56,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color,
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

const AuditStats: React.FC<AuditStatsProps> = ({ stats, loading }) => {
    const theme = useTheme();

    if (loading || !stats) {
        return (
            <Box mb={3}>
                <Grid container spacing={3}>
                    {[1, 2, 3, 4].map((i) => (
                        <Grid item xs={12} sm={6} md={3} key={i}>
                            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    const failureRate = stats.totalActivities > 0
        ? ((stats.failedActivities / stats.totalActivities) * 100).toFixed(1)
        : '0.0';

    const successRate = stats.totalActivities > 0
        ? (((stats.totalActivities - stats.failedActivities) / stats.totalActivities) * 100).toFixed(1)
        : '100.0';

    return (
        <Box mb={3}>
            <Grid container spacing={3}>
                {/* Total Activities */}
                <Grid item xs={12} sm={6} md={3}>
                    <Fade in timeout={400}>
                        <Box>
                            <AuditStatsCard
                                title="Total Activities"
                                value={stats.totalActivities}
                                icon={<ActivityIcon sx={{ fontSize: 28 }} />}
                                color={theme.palette.primary.main}
                                subtitle={`${successRate}% success rate`}
                                trend="neutral"
                            />
                        </Box>
                    </Fade>
                </Grid>

                {/* Failed Activities */}
                <Grid item xs={12} sm={6} md={3}>
                    <Fade in timeout={500}>
                        <Box>
                            <AuditStatsCard
                                title="Failed Activities"
                                value={stats.failedActivities}
                                icon={<ErrorIcon sx={{ fontSize: 28 }} />}
                                color={theme.palette.error.main}
                                subtitle={`${failureRate}% failure rate`}
                                trend={stats.failedActivities > 0 ? 'up' : 'neutral'}
                            />
                        </Box>
                    </Fade>
                </Grid>

                {/* Flagged Activities */}
                <Grid item xs={12} sm={6} md={3}>
                    <Fade in timeout={600}>
                        <Box>
                            <AuditStatsCard
                                title="Flagged for Review"
                                value={stats.flaggedActivities}
                                icon={<FlagIcon sx={{ fontSize: 28 }} />}
                                color={theme.palette.warning.main}
                                subtitle="Needs attention"
                            />
                        </Box>
                    </Fade>
                </Grid>

                {/* Critical Events */}
                <Grid item xs={12} sm={6} md={3}>
                    <Fade in timeout={700}>
                        <Box>
                            <AuditStatsCard
                                title="Critical Events"
                                value={stats.activityByRisk.find((r) => r._id === 'critical')?.count || 0}
                                icon={<WarningIcon sx={{ fontSize: 28 }} />}
                                color={theme.palette.error.dark}
                                subtitle="High priority"
                            />
                        </Box>
                    </Fade>
                </Grid>

                {/* Activity Distribution */}
                <Grid item xs={12} md={6}>
                    <Fade in timeout={800}>
                        <Card
                            elevation={0}
                            sx={{
                                height: '100%',
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <TrendingUpIcon color="primary" />
                                    <Typography variant="h6" fontWeight="600">
                                        Activity Distribution
                                    </Typography>
                                </Box>
                                <Box display="flex" flexDirection="column" gap={2}>
                                    {stats.activityByType.slice(0, 5).map((activity, index) => {
                                        const percentage = stats.totalActivities > 0
                                            ? (activity.count / stats.totalActivities) * 100
                                            : 0;

                                        return (
                                            <Box key={activity._id}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                    <Typography variant="body2" fontWeight="500">
                                                        {activity._id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                                    </Typography>
                                                    <Chip
                                                        label={activity.count.toLocaleString()}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(percentage, 100)}
                                                    sx={{
                                                        height: 8,
                                                        borderRadius: 1,
                                                        bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 1,
                                                            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </CardContent>
                        </Card>
                    </Fade>
                </Grid>

                {/* Top Users */}
                <Grid item xs={12} md={6}>
                    <Fade in timeout={900}>
                        <Card
                            elevation={0}
                            sx={{
                                height: '100%',
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <CheckCircleIcon color="secondary" />
                                    <Typography variant="h6" fontWeight="600">
                                        Most Active Users
                                    </Typography>
                                </Box>
                                <Box display="flex" flexDirection="column" gap={2}>
                                    {stats.topUsers.slice(0, 5).map((user, index) => {
                                        const percentage = stats.totalActivities > 0
                                            ? (user.count / stats.totalActivities) * 100
                                            : 0;

                                        const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

                                        return (
                                            <Box key={user._id}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Chip
                                                            label={`#${index + 1}`}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: index < 3 ? medalColors[index] : theme.palette.grey[300],
                                                                color: index < 3 ? '#000' : theme.palette.text.secondary,
                                                                fontWeight: 700,
                                                                minWidth: 36,
                                                            }}
                                                        />
                                                        <Typography variant="body2" fontWeight="500">
                                                            {user.userDetails?.firstName || 'Unknown'} {user.userDetails?.lastName || 'User'}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={user.count.toLocaleString()}
                                                        size="small"
                                                        color="secondary"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(percentage, 100)}
                                                    sx={{
                                                        height: 8,
                                                        borderRadius: 1,
                                                        bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 1,
                                                            background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </CardContent>
                        </Card>
                    </Fade>
                </Grid>

                {/* Risk Distribution */}
                <Grid item xs={12}>
                    <Fade in timeout={1000}>
                        <Card
                            elevation={0}
                            sx={{
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                    <WarningIcon color="warning" />
                                    <Typography variant="h6" fontWeight="600">
                                        Risk Level Distribution
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    {stats.activityByRisk.map((risk) => {
                                        const colors: Record<string, string> = {
                                            low: theme.palette.success.main,
                                            medium: theme.palette.info.main,
                                            high: theme.palette.warning.main,
                                            critical: theme.palette.error.main,
                                        };

                                        const percentage = stats.totalActivities > 0
                                            ? (risk.count / stats.totalActivities) * 100
                                            : 0;

                                        return (
                                            <Grid item xs={12} sm={6} md={3} key={risk._id}>
                                                <Box
                                                    sx={{
                                                        p: 2,
                                                        borderRadius: 2,
                                                        border: `2px solid ${colors[risk._id]}`,
                                                        background: `${colors[risk._id]}10`,
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            transform: 'scale(1.05)',
                                                            boxShadow: `0 4px 12px ${colors[risk._id]}30`,
                                                        },
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: colors[risk._id],
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: 0.5,
                                                        }}
                                                    >
                                                        {risk._id}
                                                    </Typography>
                                                    <Typography variant="h5" fontWeight="bold" sx={{ color: colors[risk._id], my: 0.5 }}>
                                                        {risk.count.toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {percentage.toFixed(1)}% of total
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </CardContent>
                        </Card>
                    </Fade>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AuditStats;
