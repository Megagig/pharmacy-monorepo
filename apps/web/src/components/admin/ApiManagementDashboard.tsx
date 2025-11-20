/**
 * API Management Dashboard
 * API key management, usage analytics, and endpoint monitoring
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ActiveIcon,
  Block as InactiveIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { VisibilityOff } from '@mui/icons-material';

interface ApiKey {
  _id: string;
  name: string;
  key: string;
  status: 'active' | 'inactive' | 'revoked';
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface ApiUsageStats {
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  averageResponseTime?: number;
  requestsByEndpoint?: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  requestsByStatus?: Array<{
    status: number;
    count: number;
  }>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ApiManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch API keys
  const { data: apiKeys, isLoading: keysLoading, error: keysError } = useQuery<ApiKey[]>({
    queryKey: ['api', 'keys'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/admin/saas/api-management/keys');
        return response.data.data || [];
      } catch (error) {
        console.warn('Failed to fetch API keys:', error);
        return [];
      }
    },
    retry: false, // Don't retry on failure
  });

  // Fetch API usage stats
  const { data: usageStats, isLoading: statsLoading, error: statsError } = useQuery<ApiUsageStats>({
    queryKey: ['api', 'usage'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/admin/saas/api-management/analytics');
        return response.data.data || {};
      } catch (error) {
        console.warn('Failed to fetch API usage stats:', error);
        // Return default empty stats instead of throwing
        return {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          requestsByEndpoint: [],
          requestsByStatus: []
        };
      }
    },
    retry: false, // Don't retry on failure
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      await axios.post('/api/admin/saas/api-management/keys', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api'] });
      setCreateDialogOpen(false);
      setNewKeyName('');
      setNewKeyPermissions([]);
    },
  });

  // Revoke API key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await axios.delete(`/api/admin/saas/api-management/keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api'] });
    },
  });

  const handleCreateKey = () => {
    if (newKeyName) {
      createKeyMutation.mutate({ name: newKeyName, permissions: newKeyPermissions });
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'revoked': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <ActiveIcon />;
      case 'inactive': return <InactiveIcon />;
      case 'revoked': return <InactiveIcon />;
      default: return null;
    }
  };

  if (keysLoading || statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          API Management
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create API Key
          </Button>
          <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['api'] })}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Error Alerts */}
      {(keysError || statsError) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {keysError && 'Failed to load API keys. '}
          {statsError && 'Failed to load usage statistics. '}
          Some features may not be available.
        </Alert>
      )}

      {/* Usage Statistics */}
      {usageStats && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Total Requests
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {(usageStats.totalRequests || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Success Rate
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {usageStats.totalRequests && usageStats.successfulRequests 
                    ? (((usageStats.successfulRequests || 0) / (usageStats.totalRequests || 1)) * 100).toFixed(1)
                    : '0.0'
                  }%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Failed Requests
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {(usageStats.failedRequests || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Avg Response Time
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {(usageStats.averageResponseTime || 0).toFixed(0)}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="API Keys" />
            <Tab label="Usage Analytics" />
          </Tabs>
        </Box>

        {/* API Keys Tab */}
        <TabPanel value={activeTab} index={0}>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>API Key</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Usage Count</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {apiKeys && apiKeys.length > 0 ? (
                  apiKeys.map((key) => (
                    <TableRow key={key._id}>
                      <TableCell>{key.name}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace">
                            {visibleKeys.has(key._id) ? key.key : '••••••••••••••••'}
                          </Typography>
                          <IconButton size="small" onClick={() => toggleKeyVisibility(key._id)}>
                            {visibleKeys.has(key._id) ? <VisibilityOff fontSize="small" /> : <ViewIcon fontSize="small" />}
                          </IconButton>
                          <IconButton size="small" onClick={() => copyToClipboard(key.key)}>
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={key.status}
                          color={getStatusColor(key.status) as any}
                          icon={getStatusIcon(key.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{(key.usageCount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Revoke Key">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => revokeKeyMutation.mutate(key._id)}
                            disabled={key.status === 'revoked'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No API keys found. Create your first API key to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Usage Analytics Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Endpoints
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Endpoint</TableCell>
                          <TableCell align="right">Requests</TableCell>
                          <TableCell align="right">Avg Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {usageStats?.requestsByEndpoint?.slice(0, 10).map((endpoint, index) => (
                          <TableRow key={index}>
                            <TableCell>{endpoint.endpoint}</TableCell>
                            <TableCell align="right">{(endpoint.count || 0).toLocaleString()}</TableCell>
                            <TableCell align="right">{(endpoint.avgResponseTime || 0).toFixed(0)}ms</TableCell>
                          </TableRow>
                        )) || (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography variant="body2" color="text.secondary">
                                No endpoint data available
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Response Status Distribution
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Status Code</TableCell>
                          <TableCell align="right">Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {usageStats?.requestsByStatus?.map((status, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip
                                label={status.status}
                                color={status.status < 400 ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">{(status.count || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        )) || (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              <Typography variant="body2" color="text.secondary">
                                No status data available
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Key</DialogTitle>
        <DialogContent>
          <TextField
            label="Key Name"
            fullWidth
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Permissions</InputLabel>
            <Select
              multiple
              value={newKeyPermissions}
              onChange={(e) => setNewKeyPermissions(e.target.value as string[])}
              renderValue={(selected) => (selected as string[]).join(', ')}
            >
              <MenuItem value="read">Read</MenuItem>
              <MenuItem value="write">Write</MenuItem>
              <MenuItem value="delete">Delete</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateKey} variant="contained" disabled={!newKeyName}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiManagementDashboard;

