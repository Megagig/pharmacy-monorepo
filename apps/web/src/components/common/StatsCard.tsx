import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Skeleton,
    alpha,
    useTheme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export interface StatsCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        direction: 'up' | 'down';
        label?: string;
    };
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
    loading?: boolean;
    onClick?: () => void;
    subtitle?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    icon,
    trend,
    color = 'primary',
    loading = false,
    onClick,
    subtitle,
}) => {
    const theme = useTheme();

    const getColorValue = () => {
        switch (color) {
            case 'primary':
                return theme.palette.primary.main;
            case 'secondary':
                return theme.palette.secondary.main;
            case 'success':
                return theme.palette.success.main;
            case 'error':
                return theme.palette.error.main;
            case 'warning':
                return theme.palette.warning.main;
            case 'info':
                return theme.palette.info.main;
            default:
                return theme.palette.primary.main;
        }
    };

    const colorValue = getColorValue();

    if (loading) {
        return (
            <Card>
                <CardContent>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
                    <Skeleton variant="text" width="30%" height={20} sx={{ mt: 1 }} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            sx={{
                height: '100%',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                '&:hover': onClick
                    ? {
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[8],
                    }
                    : {},
            }}
            onClick={onClick}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                            sx={{ fontWeight: 500 }}
                        >
                            {title}
                        </Typography>
                        <Typography
                            variant="h4"
                            component="div"
                            sx={{
                                fontWeight: 700,
                                color: colorValue,
                                mt: 1,
                                mb: subtitle || trend ? 1 : 0,
                            }}
                        >
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {icon && (
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: alpha(colorValue, 0.1),
                                color: colorValue,
                            }}
                        >
                            {icon}
                        </Box>
                    )}
                </Box>

                {trend && (
                    <Box
                        display="flex"
                        alignItems="center"
                        mt={2}
                        sx={{
                            color:
                                trend.direction === 'up'
                                    ? theme.palette.success.main
                                    : theme.palette.error.main,
                        }}
                    >
                        {trend.direction === 'up' ? (
                            <TrendingUpIcon fontSize="small" />
                        ) : (
                            <TrendingDownIcon fontSize="small" />
                        )}
                        <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 600 }}>
                            {trend.value > 0 ? '+' : ''}
                            {trend.value}%
                        </Typography>
                        {trend.label && (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                {trend.label}
                            </Typography>
                        )}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default StatsCard;
