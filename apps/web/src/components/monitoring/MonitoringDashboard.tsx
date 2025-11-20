/**
 * Patient Engagement Monitoring Dashboard
 * Displays real-time monitoring data and alerts
 * Requirements: 9.1, 9.2, 9.3
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Timeline as TrendIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface MonitoringData {
  summary: {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    activeAlerts: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
  operationMetrics: {
    appointments: OperationStats;
    followUps: OperationStats;
    reminders: OperationStats;
    schedules: OperationStats;
  };
  performanceMetrics: {
    responseTimeP95: number;
    errorRate: number;
    throughput: number;
  };
  alerts: Alert[];
  healthChecks: HealthCheck[];
}

interface OperationStats {
  total: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
}

interface Alert {
  id: string;
  type: 'performance' | 'error' | 'business' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  module: string;
  operation: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
  timestamp: string;
}

const MonitoringDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const queryClient = useQueryClient();

  // Fetch monitoring data
  const { data: monitoringData, isLoading, error, refetch } = useQuery<MonitoringData>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: async () => {
      const response = await axios.get('/api/monitoring/dashboard');
      return response.data.data;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
  });

  // Fetch real-time data
  const { data: realtimeData } = useQuery({
    queryKey: ['monitoring', 'realtime'],
    queryFn: async () => {
      const response = await axios.get('/api/monitoring/realtime');
      return response.data.data;
    },
    refetchInterval: autoRefresh ? 10000 : false, // 10 seconds for real-time
  });

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await axios.post(`/api/health/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    },
  });

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <HealthyIcon color="success" />;
      case 'degraded': return <WarningIcon color="warning" />;
      case 'unhealthy': return <ErrorIcon color="error" />;
      default: return <CircularProgress size={20} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load monitoring data. Please try again.
      </Alert>
    );
  }

  if (!monitoringData) {
    return (
      <Alert severity="info">
        No monitoring data available.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Patient Engagement Monitoring
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Overall Health
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getHealthStatusIcon(monitoringData.summary.healthStatus)}
                <Chip
                  label={monitoringData.summary.healthStatus.toUpperCase()}
                  color={getHealthStatusColor(monitoringData.summary.healthStatus) as any}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4">
                {formatPercentage(monitoringData.summary.successRate)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={monitoringData.summary.successRate}
                color={monitoringData.summary.successRate > 95 ? 'success' : 'warning'}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Response Time
              </Typography>
              <Typography variant="h4">
                {formatDuration(monitoringData.summary.averageResponseTime)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                P95: {formatDuration(monitoringData.performanceMetrics.responseTimeP95)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Alerts
              </Typography>
              <Typography variant="h4" color={monitoringData.summary.activeAlerts > 0 ? 'error' : 'success'}>
                {monitoringData.summary.activeAlerts}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Operations: {monitoringData.summary.totalOperations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Operation Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Operation Performance
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Module</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Success Rate</TableCell>
                      <TableCell align="right">Avg Response Time</TableCell>
                      <TableCell align="right">P95 Response Time</TableCell>
                      <TableCell align="right">Error Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(monitoringData.operationMetrics).map(([module, stats]) => (
                      <TableRow key={module}>
                        <TableCell component="th" scope="row">
                          <Chip label={module} size="small" />
                        </TableCell>
                        <TableCell align="right">{stats.total}</TableCell>
                        <TableCell align="right">
                          <Typography
                            color={stats.total > 0 && (stats.successful / stats.total) > 0.95 ? 'success.main' : 'warning.main'}
                          >
                            {stats.total > 0 ? formatPercentage((stats.successful / stats.total) * 100) : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatDuration(stats.averageResponseTime)}</TableCell>
                        <TableCell align="right">{formatDuration(stats.p95ResponseTime)}</TableCell>
                        <TableCell align="right">
                          <Typography color={stats.errorRate > 5 ? 'error.main' : 'text.primary'}>
                            {formatPercentage(stats.errorRate)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Health Checks */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Service Health Checks
              </Typography>
              {monitoringData.healthChecks.map((check) => (
                <Box key={check.service} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getHealthStatusIcon(check.status)}
                    <Typography>{check.service.replace('_', ' ')}</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2">
                      {formatDuration(check.responseTime)}
                    </Typography>
                    <Chip
                      label={check.status}
                      color={getHealthStatusColor(check.status) as any}
                      size="small"
                    />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Active Alerts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Alerts
              </Typography>
              {monitoringData.alerts.length === 0 ? (
                <Typography color="textSecondary">No active alerts</Typography>
              ) : (
                monitoringData.alerts.slice(0, 5).map((alert) => (
                  <Box key={alert.id} mb={2}>
                    <Alert
                      severity={getSeverityColor(alert.severity) as any}
                      action={
                        <IconButton
                          size="small"
                          onClick={() => resolveAlertMutation.mutate(alert.id)}
                          disabled={resolveAlertMutation.isPending}
                        >
                          <CheckCircle />
                        </IconButton>
                      }
                    >
                      <Typography variant="body2" fontWeight="bold">
                        {alert.module}.{alert.operation}
                      </Typography>
                      <Typography variant="body2">
                        {alert.message}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(alert.timestamp).toLocaleString()}
                      </Typography>
                    </Alert>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Real-time Data */}
      {realtimeData && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Real-time System Metrics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Memory Usage
                    </Typography>
                    <Typography variant="h6">
                      {realtimeData.systemMetrics.memory.heapUsed}MB / {realtimeData.systemMetrics.memory.heapTotal}MB
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={realtimeData.systemMetrics.memory.heapUsagePercent}
                      color={realtimeData.systemMetrics.memory.heapUsagePercent > 80 ? 'error' : 'primary'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Uptime
                    </Typography>
                    <Typography variant="h6">
                      {Math.floor(realtimeData.systemMetrics.uptime / 3600)}h {Math.floor((realtimeData.systemMetrics.uptime % 3600) / 60)}m
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Last Updated
                    </Typography>
                    <Typography variant="h6">
                      {new Date(realtimeData.lastUpdated).toLocaleTimeString()}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default MonitoringDashboard;