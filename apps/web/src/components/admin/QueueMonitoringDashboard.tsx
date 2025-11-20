/**
 * Queue Monitoring Dashboard
 * Real-time monitoring and management of background job queues
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Delete as DeleteIcon,
  CleaningServices as CleanIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface QueueHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: {
    processingRate: number;
    failureRate: number;
    avgProcessingTime: number;
  };
}

interface QueueDashboardData {
  queues: QueueStats[];
  health: QueueHealth[];
  summary: {
    totalQueues: number;
    healthyQueues: number;
    degradedQueues: number;
    unhealthyQueues: number;
    totalJobs: number;
    activeJobs: number;
    failedJobs: number;
  };
}

const QueueMonitoringDashboard: React.FC = () => {
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    queue: string;
  }>({ open: false, action: '', queue: '' });
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();

  // Fetch queue dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery<QueueDashboardData>({
    queryKey: ['queue-monitoring', 'dashboard'],
    queryFn: async () => {
      const response = await axios.get('/api/queue-monitoring/dashboard');
      return response.data.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Pause queue mutation
  const pauseQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      await axios.post(`/api/queue-monitoring/${queueName}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-monitoring'] });
    },
  });

  // Resume queue mutation
  const resumeQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      await axios.post(`/api/queue-monitoring/${queueName}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-monitoring'] });
    },
  });

  // Clean queue mutation
  const cleanQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      await axios.post(`/api/queue-monitoring/${queueName}/clean`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-monitoring'] });
    },
  });

  // Empty queue mutation
  const emptyQueueMutation = useMutation({
    mutationFn: async (queueName: string) => {
      await axios.post(`/api/queue-monitoring/${queueName}/empty`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-monitoring'] });
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

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <HealthyIcon color="success" />;
      case 'degraded': return <WarningIcon color="warning" />;
      case 'unhealthy': return <ErrorIcon color="error" />;
      default: return null;
    }
  };

  const handleQueueAction = (action: string, queue: string) => {
    setConfirmDialog({ open: true, action, queue });
  };

  const executeQueueAction = async () => {
    const { action, queue } = confirmDialog;
    
    switch (action) {
      case 'pause':
        await pauseQueueMutation.mutateAsync(queue);
        break;
      case 'resume':
        await resumeQueueMutation.mutateAsync(queue);
        break;
      case 'clean':
        await cleanQueueMutation.mutateAsync(queue);
        break;
      case 'empty':
        await emptyQueueMutation.mutateAsync(queue);
        break;
    }
    
    setConfirmDialog({ open: false, action: '', queue: '' });
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
        Failed to load queue monitoring data. Please try again.
      </Alert>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Queue Monitoring Dashboard
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Queues
              </Typography>
              <Typography variant="h4">
                {dashboardData.summary.totalQueues}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Healthy Queues
              </Typography>
              <Typography variant="h4" color="success.main">
                {dashboardData.summary.healthyQueues}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Jobs
              </Typography>
              <Typography variant="h4" color="primary.main">
                {dashboardData.summary.activeJobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failed Jobs
              </Typography>
              <Typography variant="h4" color="error.main">
                {dashboardData.summary.failedJobs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Queue Statistics" />
          <Tab label="Health Status" />
        </Tabs>
      </Card>

      {/* Queue Statistics Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Queue Name</TableCell>
                    <TableCell align="right">Waiting</TableCell>
                    <TableCell align="right">Active</TableCell>
                    <TableCell align="right">Completed</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Delayed</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboardData.queues.map((queue) => (
                    <TableRow key={queue.name}>
                      <TableCell>{queue.name}</TableCell>
                      <TableCell align="right">{queue.waiting}</TableCell>
                      <TableCell align="right">{queue.active}</TableCell>
                      <TableCell align="right">{queue.completed}</TableCell>
                      <TableCell align="right">{queue.failed}</TableCell>
                      <TableCell align="right">{queue.delayed}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={queue.paused ? 'Paused' : 'Running'}
                          color={queue.paused ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={queue.paused ? 'Resume' : 'Pause'}>
                          <IconButton
                            size="small"
                            onClick={() => handleQueueAction(queue.paused ? 'resume' : 'pause', queue.name)}
                          >
                            {queue.paused ? <ResumeIcon /> : <PauseIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clean Old Jobs">
                          <IconButton
                            size="small"
                            onClick={() => handleQueueAction('clean', queue.name)}
                          >
                            <CleanIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Empty Queue">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleQueueAction('empty', queue.name)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Health Status Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {dashboardData.health.map((health) => (
            <Grid item xs={12} md={6} key={health.name}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {getHealthIcon(health.status)}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                      {health.name}
                    </Typography>
                    <Chip
                      label={health.status}
                      color={getHealthStatusColor(health.status) as any}
                      size="small"
                      sx={{ ml: 'auto' }}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Processing Rate: {health.metrics.processingRate.toFixed(2)} jobs/min
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Failure Rate: {health.metrics.failureRate.toFixed(2)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Avg Processing Time: {health.metrics.avgProcessingTime.toFixed(2)}ms
                  </Typography>

                  {health.issues.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Issues:
                      </Typography>
                      {health.issues.map((issue, index) => (
                        <Alert key={index} severity="warning" sx={{ mt: 1 }}>
                          {issue}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, action: '', queue: '' })}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} the queue "{confirmDialog.queue}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: '', queue: '' })}>
            Cancel
          </Button>
          <Button onClick={executeQueueAction} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QueueMonitoringDashboard;

