import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Skeleton,
  Avatar,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface DashboardCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  navigateTo?: string;
  subtitle?: string;
  loading?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
    period?: string;
  };
  badge?: {
    label: string;
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  };
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  color,
  navigateTo,
  subtitle,
  loading = false,
  trend,
  badge,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleClick = () => {
    if (navigateTo) {
      navigate(navigateTo);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Card
        sx={{
          height: '100%',
          cursor: navigateTo ? 'pointer' : 'default',
          background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(
            color,
            0.05
          )} 100%)`,
          border: `1px solid ${alpha(color, 0.2)}`,
          position: 'relative',
          overflow: 'visible',
          '&:hover': navigateTo
            ? {
                boxShadow: `0 8px 32px ${alpha(color, 0.3)}`,
                transform: 'translateY(-2px)',
              }
            : {},
        }}
        onClick={handleClick}
      >
        <CardContent sx={{ p: 3, position: 'relative' }}>
          {/* Background Pattern */}
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${alpha(
                color,
                0.1
              )}, ${alpha(color, 0.05)})`,
              zIndex: 0,
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {/* Header with Icon and Badge */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={2}
            >
              <Avatar
                sx={{
                  bgcolor: alpha(color, 0.15),
                  color: color,
                  width: 56,
                  height: 56,
                }}
              >
                {icon}
              </Avatar>

              <Box
                display="flex"
                flexDirection="column"
                alignItems="flex-end"
                gap={1}
              >
                {badge && (
                  <Chip
                    label={badge.label}
                    color={badge.color}
                    size="small"
                    variant="outlined"
                  />
                )}
                {trend && (
                  <Chip
                    icon={
                      trend.isPositive ? (
                        <TrendingUpIcon />
                      ) : (
                        <TrendingDownIcon />
                      )
                    }
                    label={`${trend.isPositive ? '+' : ''}${trend.value}%`}
                    size="small"
                    color={trend.isPositive ? 'success' : 'error'}
                    variant="filled"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
                {navigateTo && (
                  <IconButton
                    size="small"
                    sx={{
                      color: color,
                      bgcolor: alpha(color, 0.1),
                      '&:hover': { bgcolor: alpha(color, 0.2) },
                    }}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Title */}
            <Typography
              variant="h6"
              color="text.secondary"
              gutterBottom
              sx={{ fontWeight: 500 }}
            >
              {title}
            </Typography>

            {/* Value */}
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
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                }}
              >
                {value}
              </Typography>
            )}

            {/* Subtitle */}
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ opacity: 0.8 }}
              >
                {subtitle}
              </Typography>
            )}

            {/* Trend Period */}
            {trend?.period && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: 'block', opacity: 0.7 }}
              >
                vs {trend.period}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DashboardCard;
