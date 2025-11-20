import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Typography,
    Card,
    CardContent,
    LinearProgress,
    Avatar,
    Chip,
    useTheme,
    alpha,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    People as PeopleIcon,
    LocalHospital as PatientIcon,
    Assignment as MTRIcon,
    NoteAdd as ClinicalNoteIcon,
    Medication as MedicationIcon,
    Refresh as RefreshIcon,
    TrendingUp as TrendingUpIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { dashboardService } from '../../services/dashboardService';

interface WorkspaceStats {
    totalPatients: number;
    totalClinicalNotes: number;
    totalMTRs: number;
    completedMTRs: number;
    totalMedicationRecords: number;
    workspaceMembers: number;
    recentActivity: {
        patientsThisMonth: number;
        notesThisMonth: number;
        mtrsThisMonth: number;
    };
}

interface MetricCardProps {
    title: string;
    current: number;
    trend?: number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    percentage?: number;
    total?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    current,
    trend,
    icon,
    color,
    subtitle,
    percentage,
    total,
}) => {
    const theme = useTheme();

    const getTrendIcon = () => {
        if (trend === undefined) return null;
        return trend >= 0 ? (
            <TrendingUpIcon sx={{ color: theme.palette.success.main, fontSize: 16 }} />
        ) : (
            <TrendingUpIcon sx={{
                color: theme.palette.error.main,
                fontSize: 16,
                transform: 'rotate(180deg)'
            }} />
        );
    };

    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
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
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={2}
                    >
                        <Avatar sx={{ bgcolor: alpha(color, 0.15), color: color }}>
                            {icon}
                        </Avatar>
                        {trend !== undefined && (
                            <Box display="flex" alignItems="center" gap={0.5}>
                                {getTrendIcon()}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: trend >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {trend > 0 ? '+' : ''}{trend}%
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {title}
                    </Typography>

                    <Box display="flex" alignItems="baseline" mb={1}>
                        <Typography
                            variant="h4"
                            sx={{ fontWeight: 'bold', color: color, mr: 1 }}
                        >
                            {current.toLocaleString()}
                        </Typography>
                        {total && (
                            <Typography variant="body2" color="text.secondary">
                                / {total.toLocaleString()}
                            </Typography>
                        )}
                    </Box>

                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            {subtitle}
                        </Typography>
                    )}

                    {percentage !== undefined && (
                        <Box>
                            <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="caption" color="text.secondary">
                                    Completion Rate
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                    {percentage.toFixed(1)}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(percentage, 100)}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: alpha(color, 0.2),
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: color,
                                        borderRadius: 3,
                                    },
                                }}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

const WorkspaceAnalytics: React.FC = () => {
    const theme = useTheme();
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkspaceStats();
    }, []);

    const fetchWorkspaceStats = async () => {
        try {
            setLoading(true);
            const data = await dashboardService.getDashboardAnalytics();

            // Transform the data into the format we need
            const workspaceStats: WorkspaceStats = {
                totalPatients: data.stats?.totalPatients || 0,
                totalClinicalNotes: data.stats?.totalClinicalNotes || 0,
                totalMTRs: data.stats?.totalMTRs || 0,
                completedMTRs: data.stats?.completedMTRs || 0,
                totalMedicationRecords: data.stats?.totalMedicationRecords || 0,
                workspaceMembers: data.stats?.workspaceMembers || 0,
                recentActivity: {
                    patientsThisMonth: data.stats?.recentPatients || 0,
                    notesThisMonth: data.stats?.recentClinicalNotes || 0,
                    mtrsThisMonth: data.stats?.recentMTRs || 0,
                },
            };

            setStats(workspaceStats);
            setError(null);
        } catch (err) {
            console.error('Error fetching workspace stats:', err);
            setError('Failed to load workspace analytics');
            // Set default empty stats
            setStats({
                totalPatients: 0,
                totalClinicalNotes: 0,
                totalMTRs: 0,
                completedMTRs: 0,
                totalMedicationRecords: 0,
                workspaceMembers: 0,
                recentActivity: {
                    patientsThisMonth: 0,
                    notesThisMonth: 0,
                    mtrsThisMonth: 0,
                },
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchWorkspaceStats();
    };

    if (loading || !stats) {
        return (
            <Card sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Workspace Analytics
                    </Typography>
                </Box>
                <Box display="flex" justifyContent="center" p={4}>
                    <LinearProgress sx={{ width: '100%' }} />
                </Box>
            </Card>
        );
    }

    const mtrCompletionRate = stats.totalMTRs > 0
        ? (stats.completedMTRs / stats.totalMTRs) * 100
        : 0;

    return (
        <Box>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={3}
            >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Workspace Analytics
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

            <Grid container spacing={3}>
                {/* Total Patients */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="Total Patients"
                        current={stats.totalPatients}
                        icon={<PatientIcon />}
                        color={theme.palette.primary.main}
                        subtitle={`${stats.recentActivity.patientsThisMonth} added this month`}
                    />
                </Grid>

                {/* Team Members */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="Team Members"
                        current={stats.workspaceMembers}
                        icon={<PeopleIcon />}
                        color={theme.palette.secondary.main}
                        subtitle="Active workspace members"
                    />
                </Grid>

                {/* Clinical Notes */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="Clinical Notes"
                        current={stats.totalClinicalNotes}
                        icon={<ClinicalNoteIcon />}
                        color={theme.palette.info.main}
                        subtitle={`${stats.recentActivity.notesThisMonth} added this month`}
                    />
                </Grid>

                {/* MTR Performance */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="MTR Sessions"
                        current={stats.completedMTRs}
                        total={stats.totalMTRs}
                        icon={<MTRIcon />}
                        color={theme.palette.success.main}
                        subtitle={`${stats.recentActivity.mtrsThisMonth} completed this month`}
                        percentage={mtrCompletionRate}
                    />
                </Grid>

                {/* Medication Records */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="Medication Records"
                        current={stats.totalMedicationRecords}
                        icon={<MedicationIcon />}
                        color={theme.palette.warning.main}
                        subtitle="Total medication records"
                    />
                </Grid>

                {/* Completion Rate Summary */}
                <Grid item xs={12} sm={6} md={4}>
                    <MetricCard
                        title="MTR Completion"
                        current={Math.round(mtrCompletionRate)}
                        icon={<CheckCircleIcon />}
                        color={mtrCompletionRate >= 80 ? theme.palette.success.main : theme.palette.warning.main}
                        subtitle={`${stats.completedMTRs} of ${stats.totalMTRs} completed`}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};

export default WorkspaceAnalytics;