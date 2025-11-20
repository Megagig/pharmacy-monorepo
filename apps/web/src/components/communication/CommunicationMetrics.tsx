import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Message as MessageIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useCommunicationStore } from '../../stores/communicationStore';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  color: string;
  icon: React.ReactNode;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  color,
  icon,
  loading = false,
}) => {
  const theme = useTheme();

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
          '&:hover': {
            boxShadow: `0 8px 32px ${alpha(color, 0.3)}`,
          },
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: alpha(color, 0.15),
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
            {trend && (
              <Chip
                icon={
                  trend.isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />
                }
                label={`${trend.isPositive ? '+' : ''}${trend.value}%`}
                size="small"
                color={trend.isPositive ? 'success' : 'error'}
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>

          {loading ? (
            <Skeleton variant="text" width="60%" height={32} />
          ) : (
            <Typography
              variant="h5"
              component="div"
              sx={{
                color: color,
                fontWeight: 'bold',
                mb: 0.5,
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
          )}

          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}

          {trend && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              vs {trend.period}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface CommunicationMetricsProps {
  timeRange?: 'day' | 'week' | 'month' | 'year';
  showTrends?: boolean;
}

const CommunicationMetrics: React.FC<CommunicationMetricsProps> = ({
  timeRange = 'week',
  showTrends = true,
}) => {
  const theme = useTheme();
  const { conversations, messages, notifications, loading } =
    useCommunicationStore();

  const [metrics, setMetrics] = useState({
    totalMessages: 0,
    activeConversations: 0,
    responseTime: '2.5 min',
    resolutionRate: 85,
    patientQueries: 0,
    unreadNotifications: 0,
    trends: {
      messages: { value: 12, isPositive: true },
      conversations: { value: 8, isPositive: true },
      responseTime: { value: -15, isPositive: true },
      resolutionRate: { value: 5, isPositive: true },
    },
  });

  useEffect(() => {
    // Calculate metrics from store data
    const activeConvs = conversations.filter(
      (conv) => conv.status === 'active'
    );
    const patientQueries = conversations.filter(
      (conv) => conv.type === 'patient_query'
    );
    const unreadNotifs = notifications.filter(
      (notif) => notif.status === 'unread'
    );

    // Calculate total messages across all conversations
    const totalMessages = Object.values(messages).reduce(
      (total, convMessages) => total + convMessages.length,
      0
    );

    // Calculate average response time (mock calculation)
    const avgResponseTime = calculateAverageResponseTime();

    // Calculate resolution rate (mock calculation)
    const resolutionRate = calculateResolutionRate();

    setMetrics((prev) => ({
      ...prev,
      totalMessages,
      activeConversations: activeConvs.length,
      patientQueries: patientQueries.length,
      unreadNotifications: unreadNotifs.length,
      responseTime: avgResponseTime,
      resolutionRate,
    }));
  }, [conversations, messages, notifications]);

  const calculateAverageResponseTime = (): string => {
    // Mock calculation - in real implementation, this would analyze message timestamps
    const mockMinutes = Math.floor(Math.random() * 5) + 1;
    return `${mockMinutes}.${Math.floor(Math.random() * 9)} min`;
  };

  const calculateResolutionRate = (): number => {
    // Mock calculation - in real implementation, this would analyze resolved conversations
    return Math.floor(Math.random() * 20) + 80; // 80-100%
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'day':
        return 'last day';
      case 'week':
        return 'last week';
      case 'month':
        return 'last month';
      case 'year':
        return 'last year';
      default:
        return 'last week';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Communication Analytics
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Messages"
            value={metrics.totalMessages}
            subtitle={`Sent in ${getTimeRangeLabel()}`}
            trend={
              showTrends
                ? {
                    ...metrics.trends.messages,
                    period: getTimeRangeLabel(),
                  }
                : undefined
            }
            color={theme.palette.primary.main}
            icon={<MessageIcon />}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Conversations"
            value={metrics.activeConversations}
            subtitle="Currently ongoing"
            trend={
              showTrends
                ? {
                    ...metrics.trends.conversations,
                    period: getTimeRangeLabel(),
                  }
                : undefined
            }
            color={theme.palette.success.main}
            icon={<GroupIcon />}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Response Time"
            value={metrics.responseTime}
            subtitle="Healthcare provider response"
            trend={
              showTrends
                ? {
                    ...metrics.trends.responseTime,
                    period: getTimeRangeLabel(),
                  }
                : undefined
            }
            color={theme.palette.info.main}
            icon={<ScheduleIcon />}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Resolution Rate"
            value={`${metrics.resolutionRate}%`}
            subtitle="Queries resolved successfully"
            trend={
              showTrends
                ? {
                    ...metrics.trends.resolutionRate,
                    period: getTimeRangeLabel(),
                  }
                : undefined
            }
            color={theme.palette.warning.main}
            icon={<CheckCircleIcon />}
            loading={loading}
          />
        </Grid>

        {/* Additional metrics row */}
        <Grid item xs={12} sm={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Patient Queries
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {loading ? <Skeleton width={40} /> : metrics.patientQueries}
                </Typography>
                <Chip label="Active" color="primary" size="small" />
              </Box>
              <LinearProgress
                variant="determinate"
                value={
                  (metrics.patientQueries /
                    Math.max(metrics.activeConversations, 1)) *
                  100
                }
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(
                  (metrics.patientQueries /
                    Math.max(metrics.activeConversations, 1)) *
                    100
                )}
                % of active conversations
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notification Status
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h4" color="error.main" fontWeight="bold">
                  {loading ? (
                    <Skeleton width={40} />
                  ) : (
                    metrics.unreadNotifications
                  )}
                </Typography>
                <Chip label="Unread" color="error" size="small" />
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.max(
                  0,
                  100 -
                    (metrics.unreadNotifications /
                      Math.max(notifications.length, 1)) *
                      100
                )}
                color="success"
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(
                  Math.max(
                    0,
                    100 -
                      (metrics.unreadNotifications /
                        Math.max(notifications.length, 1)) *
                        100
                  )
                )}
                % read rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CommunicationMetrics;
