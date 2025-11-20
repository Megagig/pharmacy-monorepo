import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Chip,
  useTheme,
  alpha,
  Avatar,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Storage as StorageIcon,
  People as PeopleIcon,
  Api as ApiIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { usageMonitoringService } from '../../services/usageMonitoringService';
import DashboardChart from './DashboardChart';

interface UsageData {
  patients: {
    current: number;
    limit: number;
    percentage: number;
  };
  users: {
    current: number;
    limit: number;
    percentage: number;
  };
  storage: {
    current: number; // in MB
    limit: number; // in MB
    percentage: number;
  };
  apiCalls: {
    current: number;
    limit: number;
    percentage: number;
    dailyUsage: Array<{ date: string; calls: number }>;
  };
  locations: {
    current: number;
    limit: number;
    percentage: number;
  };
}

interface UsageCardProps {
  title: string;
  current: number;
  limit: number;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  unit?: string;
  formatValue?: (value: number) => string;
}

const UsageCard: React.FC<UsageCardProps> = ({
  title,
  current,
  limit,
  percentage,
  icon,
  color,
  unit = '',
  formatValue,
}) => {
  const theme = useTheme();

  const getStatusColor = () => {
    if (percentage >= 90) return theme.palette.error.main;
    if (percentage >= 75) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const getStatusIcon = () => {
    if (percentage >= 90) return <WarningIcon />;
    if (percentage >= 75) return <InfoIcon />;
    return <CheckCircleIcon />;
  };

  const formatDisplayValue = (value: number) => {
    if (formatValue) return formatValue(value);
    return `${value}${unit}`;
  };

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
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
            <Chip
              icon={getStatusIcon()}
              label={`${percentage.toFixed(1)}%`}
              color={
                percentage >= 90
                  ? 'error'
                  : percentage >= 75
                  ? 'warning'
                  : 'success'
              }
              size="small"
            />
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            {title}
          </Typography>

          <Box display="flex" alignItems="baseline" mb={2}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 'bold', color: color, mr: 1 }}
            >
              {formatDisplayValue(current)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / {formatDisplayValue(limit)}
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={Math.min(percentage, 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: alpha(getStatusColor(), 0.2),
              '& .MuiLinearProgress-bar': {
                backgroundColor: getStatusColor(),
                borderRadius: 4,
              },
            }}
          />

          {percentage >= 90 && (
            <Alert severity="error" sx={{ mt: 2, py: 0.5 }}>
              <Typography variant="caption">
                Usage limit almost reached!
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const UsageDashboard: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const response = await usageMonitoringService.getUsageStats();
      setUsageData(response.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load usage data'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUsageData();
    } finally {
      setRefreshing(false);
    }
  };

  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatApiCalls = (calls: number) => {
    if (calls >= 1000000) {
      return `${(calls / 1000000).toFixed(1)}M`;
    }
    if (calls >= 1000) {
      return `${(calls / 1000).toFixed(1)}K`;
    }
    return calls.toString();
  };

  if (loading && !usageData) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Usage & Limits
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
            gap: 3,
            width: '100%',
          }}
        >
          {[...Array(5)].map((_, index) => (
            <Box key={index} sx={{ width: '100%' }}>
              <Card sx={{ height: 200 }}>
                <CardContent>
                  <Box sx={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 40,
                        width: 40,
                        borderRadius: '50%',
                        mb: 2,
                      }}
                    />
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 20,
                        width: '80%',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    />
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 32,
                        width: '60%',
                        borderRadius: 1,
                        mb: 2,
                      }}
                    />
                    <Box
                      sx={{
                        bgcolor: 'grey.200',
                        height: 8,
                        width: '100%',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ mb: 4 }}
        action={
          <IconButton color="inherit" size="small" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        }
      >
        Error loading usage data: {error}
      </Alert>
    );
  }

  if (!usageData) {
    return null;
  }

  // Prepare API usage chart data
  const apiUsageChartData = usageData.apiCalls.dailyUsage.map((day) => ({
    name: new Date(day.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    value: day.calls,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ mb: 4 }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
        >
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Usage & Limits
          </Typography>
          <Tooltip title="Refresh Usage Data">
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
              }}
            >
              <RefreshIcon
                sx={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Usage Cards */}
        <Box
          className="usage-cards-grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
            gap: 3,
            mb: 4,
            width: '100%',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <UsageCard
              title="Patients"
              current={usageData.patients.current}
              limit={usageData.patients.limit}
              percentage={usageData.patients.percentage}
              icon={<PeopleIcon />}
              color={theme.palette.primary.main}
            />
          </Box>

          <Box sx={{ width: '100%' }}>
            <UsageCard
              title="Team Members"
              current={usageData.users.current}
              limit={usageData.users.limit}
              percentage={usageData.users.percentage}
              icon={<PeopleIcon />}
              color={theme.palette.success.main}
            />
          </Box>

          <Box sx={{ width: '100%' }}>
            <UsageCard
              title="Storage"
              current={usageData.storage.current}
              limit={usageData.storage.limit}
              percentage={usageData.storage.percentage}
              icon={<StorageIcon />}
              color={theme.palette.info.main}
              formatValue={formatStorage}
            />
          </Box>

          <Box sx={{ width: '100%' }}>
            <UsageCard
              title="API Calls"
              current={usageData.apiCalls.current}
              limit={usageData.apiCalls.limit}
              percentage={usageData.apiCalls.percentage}
              icon={<ApiIcon />}
              color={theme.palette.warning.main}
              formatValue={formatApiCalls}
            />
          </Box>

          <Box sx={{ width: '100%' }}>
            <UsageCard
              title="Locations"
              current={usageData.locations.current}
              limit={usageData.locations.limit}
              percentage={usageData.locations.percentage}
              icon={<LocationIcon />}
              color={theme.palette.secondary.main}
            />
          </Box>
        </Box>

        {/* API Usage Chart */}
        {apiUsageChartData.length > 0 && (
          <Box
            className="usage-chart-grid"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              gap: 3,
              width: '100%',
            }}
          >
            <Box sx={{ width: '100%' }}>
              <DashboardChart
                title="API Usage (Last 7 Days)"
                data={apiUsageChartData}
                type="area"
                height={350}
                colors={[theme.palette.warning.main]}
                subtitle="Daily API call usage trend"
                showLegend={false}
                interactive={true}
              />
            </Box>

            <Box sx={{ width: '100%' }}>
              <Card sx={{ height: 350 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                    Usage Summary
                  </Typography>

                  <Box mb={3}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Most Used Resource
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {Math.max(
                        usageData.patients.percentage,
                        usageData.users.percentage,
                        usageData.storage.percentage,
                        usageData.apiCalls.percentage,
                        usageData.locations.percentage
                      ) === usageData.patients.percentage
                        ? 'Patients'
                        : Math.max(
                            usageData.users.percentage,
                            usageData.storage.percentage,
                            usageData.apiCalls.percentage,
                            usageData.locations.percentage
                          ) === usageData.users.percentage
                        ? 'Team Members'
                        : Math.max(
                            usageData.storage.percentage,
                            usageData.apiCalls.percentage,
                            usageData.locations.percentage
                          ) === usageData.storage.percentage
                        ? 'Storage'
                        : Math.max(
                            usageData.apiCalls.percentage,
                            usageData.locations.percentage
                          ) === usageData.apiCalls.percentage
                        ? 'API Calls'
                        : 'Locations'}
                    </Typography>
                  </Box>

                  <Box mb={3}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Resources at Risk
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {[
                        {
                          name: 'Patients',
                          percentage: usageData.patients.percentage,
                        },
                        {
                          name: 'Users',
                          percentage: usageData.users.percentage,
                        },
                        {
                          name: 'Storage',
                          percentage: usageData.storage.percentage,
                        },
                        {
                          name: 'API Calls',
                          percentage: usageData.apiCalls.percentage,
                        },
                        {
                          name: 'Locations',
                          percentage: usageData.locations.percentage,
                        },
                      ]
                        .filter((item) => item.percentage >= 75)
                        .map((item) => (
                          <Chip
                            key={item.name}
                            label={`${item.name} (${item.percentage.toFixed(
                              1
                            )}%)`}
                            color={item.percentage >= 90 ? 'error' : 'warning'}
                            size="small"
                          />
                        ))}
                      {[
                        usageData.patients.percentage,
                        usageData.users.percentage,
                        usageData.storage.percentage,
                        usageData.apiCalls.percentage,
                        usageData.locations.percentage,
                      ].every((p) => p < 75) && (
                        <Typography variant="body2" color="success.main">
                          All resources within safe limits
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Recommendation
                    </Typography>
                    <Typography variant="body2">
                      {Math.max(
                        usageData.patients.percentage,
                        usageData.users.percentage,
                        usageData.storage.percentage,
                        usageData.apiCalls.percentage,
                        usageData.locations.percentage
                      ) >= 90
                        ? 'Consider upgrading your plan to avoid service interruption.'
                        : Math.max(
                            usageData.patients.percentage,
                            usageData.users.percentage,
                            usageData.storage.percentage,
                            usageData.apiCalls.percentage,
                            usageData.locations.percentage
                          ) >= 75
                        ? 'Monitor usage closely and plan for potential upgrade.'
                        : 'Usage is within normal limits.'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default UsageDashboard;
