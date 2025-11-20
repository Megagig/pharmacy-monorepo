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
} from '@mui/material';
import {
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    TrendingUp as TrendingUpIcon,
    MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useSuperAdminClinicalInterventions } from '../../hooks/useSuperAdminClinicalInterventions';

interface MetricCardProps {
    title: string;
    value: number | string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color,
    loading = false,
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

                    <Typography variant="caption" color="text.secondary">
                        {subtitle}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

const SuperAdminClinicalInterventions: React.FC = () => {
    const theme = useTheme();
    const { data, loading, error } = useSuperAdminClinicalInterventions();

    if (error) {
        return (
            <Box mb={4}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load clinical interventions data: {error}
                </Alert>
            </Box>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
                        Clinical Interventions Overview
                    </Typography>
                    {data && data.byWorkspace.length > 0 && (
                        <Chip
                            label={`${data.byWorkspace.length} Workspaces`}
                            size="small"
                            color="primary"
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
                    <MetricCard
                        title="Total Interventions"
                        value={data?.totalInterventions || 0}
                        subtitle="All interventions"
                        icon={<AssignmentIcon />}
                        color={theme.palette.primary.main}
                        loading={loading}
                    />

                    <MetricCard
                        title="Active"
                        value={data?.activeInterventions || 0}
                        subtitle="In progress"
                        icon={<TrendingUpIcon />}
                        color={theme.palette.info.main}
                        loading={loading}
                    />

                    <MetricCard
                        title="Success Rate"
                        value={data ? `${data.successRate}%` : '0%'}
                        subtitle="Completed successfully"
                        icon={<CheckCircleIcon />}
                        color={theme.palette.success.main}
                        loading={loading}
                    />

                    <MetricCard
                        title="Cost Savings"
                        value={data ? `₦${(data.costSavings / 1000).toFixed(0)}K` : '₦0'}
                        subtitle="Estimated savings"
                        icon={<MonetizationOnIcon />}
                        color={theme.palette.warning.main}
                        loading={loading}
                    />
                </Box>
            </Box>
        </motion.div>
    );
};

export default SuperAdminClinicalInterventions;
