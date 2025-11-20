/**
 * System Monitoring Dashboard
 * Real-time system health and performance monitoring
 */

import React, { useState } from 'react';
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
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
  timestamp: Date;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  metrics: SystemMetrics;
  uptime: number;
  version: string;
  environment: string;
  timestamp: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const SystemMonitoringDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();

  // Fetch system health
  const { data: systemHealth, isLoading, error } = useQuery<SystemHealth>({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      const response = await axios.get('/api/monitoring/system-health');
      return response.data.data;
    },
    refetchInterval: autoRefresh ? 10000 : false,
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
      default: return null;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
        Failed to load system monitoring data. Please try again.
      </Alert>
    );
  }

  if (!systemHealth) {
    return (
      <Alert severity="info">
        No system health data available.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          System Monitoring
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['system'] })}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Overall Health Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                <Chip
                  label={systemHealth.overall}
                  color={getHealthStatusColor(systemHealth.overall) as any}
                  icon={getHealthStatusIcon(systemHealth.overall)}
                />
                <Typography variant="body2" color="textSecondary">
                  Uptime: {formatUptime(systemHealth.uptime)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Version: {systemHealth.version}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Environment: {systemHealth.environment}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="System Metrics" />
            <Tab label="Service Health" />
          </Tabs>
        </Box>

        {/* System Metrics Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            {/* CPU Usage */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <SpeedIcon color="primary" />
                    <Typography variant="h6">CPU Usage</Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {systemHealth.metrics.cpu.usage.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemHealth.metrics.cpu.usage}
                    color={systemHealth.metrics.cpu.usage > 80 ? 'error' : 'primary'}
                    sx={{ height: 10, borderRadius: 5, mb: 1 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    {systemHealth.metrics.cpu.cores} cores available
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Memory Usage */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <MemoryIcon color="primary" />
                    <Typography variant="h6">Memory Usage</Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {systemHealth.metrics.memory.usagePercent.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemHealth.metrics.memory.usagePercent}
                    color={systemHealth.metrics.memory.usagePercent > 80 ? 'error' : 'primary'}
                    sx={{ height: 10, borderRadius: 5, mb: 1 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    {formatBytes(systemHealth.metrics.memory.used)} / {formatBytes(systemHealth.metrics.memory.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Disk Usage */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <StorageIcon color="primary" />
                    <Typography variant="h6">Disk Usage</Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {systemHealth.metrics.disk.usagePercent.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={systemHealth.metrics.disk.usagePercent}
                    color={systemHealth.metrics.disk.usagePercent > 80 ? 'error' : 'primary'}
                    sx={{ height: 10, borderRadius: 5, mb: 1 }}
                  />
                  <Typography variant="body2" color="textSecondary">
                    {formatBytes(systemHealth.metrics.disk.used)} / {formatBytes(systemHealth.metrics.disk.total)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Network Traffic */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <CloudIcon color="primary" />
                    <Typography variant="h6">Network Traffic</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="textSecondary">
                      Inbound: {formatBytes(systemHealth.metrics.network.bytesIn)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Outbound: {formatBytes(systemHealth.metrics.network.bytesOut)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Service Health Tab */}
        <TabPanel value={activeTab} index={1}>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Response Time</TableCell>
                  <TableCell>Last Check</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {systemHealth.services.map((service) => (
                  <TableRow key={service.service}>
                    <TableCell>{service.service.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Chip
                        label={service.status}
                        color={getHealthStatusColor(service.status) as any}
                        icon={getHealthStatusIcon(service.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{service.responseTime}ms</TableCell>
                    <TableCell>{new Date(service.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default SystemMonitoringDashboard;

