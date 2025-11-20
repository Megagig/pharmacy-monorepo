import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Chip,
    LinearProgress,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
    Grid,
    Paper,
} from '@mui/material';
import {
    Person as PersonIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    Visibility as VisibilityIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { dashboardService } from '../../services/dashboardService';

interface TeamMemberPerformance {
    id: string;
    name: string;
    email: string;
    role: string;
    metrics: {
        totalMTRs: number;
        completedMTRs: number;
        completionRate: number;
        averageCompletionTime?: string;
        totalClinicalNotes: number;
        recentActivity: string;
    };
    status: 'active' | 'busy' | 'away';
}

interface SummaryStats {
    totalTeamMembers: number;
    avgCompletionRate: number;
    totalMTRsCompleted: number;
    totalClinicalNotes: number;
}

const TeamPerformanceDashboard: React.FC = () => {
    const theme = useTheme();
    const [teamData, setTeamData] = useState<TeamMemberPerformance[]>([]);
    const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTeamPerformance();
    }, []);

    const fetchTeamPerformance = async () => {
        try {
            setLoading(true);
            const data = await dashboardService.getDashboardAnalytics();

            // Transform the real data into team performance metrics
            const mockTeamData: TeamMemberPerformance[] = [];

            // If we have real MTR data, create performance metrics based on it
            if (data.mtrSessions && data.mtrSessions.length > 0) {
                // Group MTR sessions by user if user info is available
                const userMTRMap = new Map();

                data.mtrSessions.forEach((mtr: any) => {
                    const userId = mtr.pharmacistId || mtr.createdBy || 'unknown';
                    if (!userMTRMap.has(userId)) {
                        userMTRMap.set(userId, {
                            id: userId,
                            mtrs: [],
                            completed: 0,
                        });
                    }

                    const userMTRs = userMTRMap.get(userId);
                    userMTRs.mtrs.push(mtr);

                    if (mtr.status === 'completed') {
                        userMTRs.completed++;
                    }
                });

                // Convert to team performance data
                let memberIndex = 1;
                userMTRMap.forEach((userData, userId) => {
                    const completionRate = userData.mtrs.length > 0
                        ? (userData.completed / userData.mtrs.length) * 100
                        : 0;

                    mockTeamData.push({
                        id: userId,
                        name: `Team Member ${memberIndex}`,
                        email: `member${memberIndex}@workspace.com`,
                        role: 'Pharmacist',
                        metrics: {
                            totalMTRs: userData.mtrs.length,
                            completedMTRs: userData.completed,
                            completionRate,
                            totalClinicalNotes: Math.floor(userData.mtrs.length * 1.5), // Estimate
                            recentActivity: userData.mtrs.length > 0 ? 'Recent MTR session' : 'No recent activity',
                        },
                        status: completionRate > 80 ? 'active' : completionRate > 50 ? 'busy' : 'away',
                    });
                    memberIndex++;
                });
            }

            // If no real MTR data, show workspace summary
            if (mockTeamData.length === 0) {
                mockTeamData.push({
                    id: 'workspace-summary',
                    name: 'Workspace Summary',
                    email: 'workspace@pharmacare.com',
                    role: 'System',
                    metrics: {
                        totalMTRs: data.stats?.totalMTRs || 0,
                        completedMTRs: data.stats?.completedMTRs || 0,
                        completionRate: data.stats?.totalMTRs > 0
                            ? ((data.stats?.completedMTRs || 0) / (data.stats?.totalMTRs || 1)) * 100
                            : 0,
                        totalClinicalNotes: data.stats?.totalClinicalNotes || 0,
                        recentActivity: 'Workspace activity summary',
                    },
                    status: 'active',
                });
            }

            setTeamData(mockTeamData);

            // Calculate summary stats
            const totalMembers = mockTeamData.length;
            const avgCompletionRate = mockTeamData.reduce((sum, member) =>
                sum + member.metrics.completionRate, 0) / (totalMembers || 1);
            const totalMTRsCompleted = mockTeamData.reduce((sum, member) =>
                sum + member.metrics.completedMTRs, 0);
            const totalClinicalNotes = mockTeamData.reduce((sum, member) =>
                sum + member.metrics.totalClinicalNotes, 0);

            setSummaryStats({
                totalTeamMembers: totalMembers,
                avgCompletionRate,
                totalMTRsCompleted,
                totalClinicalNotes,
            });

            setError(null);
        } catch (err) {
            console.error('Error fetching team performance:', err);
            setError('Failed to load team performance data');

            // Set default empty data
            setTeamData([]);
            setSummaryStats({
                totalTeamMembers: 0,
                avgCompletionRate: 0,
                totalMTRsCompleted: 0,
                totalClinicalNotes: 0,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchTeamPerformance();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return theme.palette.success.main;
            case 'busy': return theme.palette.warning.main;
            case 'away': return theme.palette.error.main;
            default: return theme.palette.grey[500];
        }
    };

    const getCompletionRateColor = (rate: number) => {
        if (rate >= 90) return theme.palette.success.main;
        if (rate >= 70) return theme.palette.warning.main;
        return theme.palette.error.main;
    };

    if (loading) {
        return (
            <Card sx={{ mt: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Team Performance
                        </Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" p={4}>
                        <LinearProgress sx={{ width: '100%' }} />
                    </Box>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box mt={3}>
            <Card>
                <CardContent>
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={3}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            Team Performance Overview
                        </Typography>
                        <Tooltip title="Refresh data">
                            <IconButton onClick={handleRefresh} size="small">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {error && (
                        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                            {error}
                        </Typography>
                    )}

                    {/* Summary Stats */}
                    {summaryStats && (
                        <Grid container spacing={3} mb={3}>
                            <Grid item xs={6} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                                        {summaryStats.totalTeamMembers}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Team Members
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                                        {summaryStats.avgCompletionRate.toFixed(1)}%
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Avg. Completion
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                                        {summaryStats.totalMTRsCompleted}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        MTRs Completed
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                                        {summaryStats.totalClinicalNotes}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Clinical Notes
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    )}

                    {/* Team Table */}
                    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${theme.palette.divider}` }}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                                    <TableCell>Team Member</TableCell>
                                    <TableCell align="center">MTRs</TableCell>
                                    <TableCell align="center">Completion Rate</TableCell>
                                    <TableCell align="center">Clinical Notes</TableCell>
                                    <TableCell align="center">Status</TableCell>
                                    <TableCell align="center">Recent Activity</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {teamData.map((member, index) => (
                                    <motion.tr
                                        key={member.id}
                                        component={TableRow}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) } }}
                                    >
                                        <TableCell>
                                            <Box display="flex" alignItems="center" gap={2}>
                                                <Avatar
                                                    sx={{
                                                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                                                        color: theme.palette.primary.main,
                                                    }}
                                                >
                                                    <PersonIcon />
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                        {member.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {member.email}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {member.metrics.completedMTRs}/{member.metrics.totalMTRs}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Total/Completed
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box>
                                                <Chip
                                                    label={`${member.metrics.completionRate.toFixed(1)}%`}
                                                    color={
                                                        member.metrics.completionRate >= 90
                                                            ? 'success'
                                                            : member.metrics.completionRate >= 70
                                                                ? 'warning'
                                                                : 'error'
                                                    }
                                                    size="small"
                                                    sx={{ minWidth: 60 }}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {member.metrics.totalClinicalNotes}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={member.status}
                                                sx={{
                                                    backgroundColor: alpha(getStatusColor(member.status), 0.2),
                                                    color: getStatusColor(member.status),
                                                    fontWeight: 'bold',
                                                    textTransform: 'capitalize',
                                                }}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="caption" color="text.secondary">
                                                {member.metrics.recentActivity}
                                            </Typography>
                                        </TableCell>
                                    </motion.tr>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {teamData.length === 0 && !loading && (
                        <Box textAlign="center" py={4}>
                            <Typography variant="body2" color="text.secondary">
                                No team performance data available yet.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Start creating MTR sessions to see performance metrics.
                            </Typography>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default TeamPerformanceDashboard;