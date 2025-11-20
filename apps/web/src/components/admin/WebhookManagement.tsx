import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
  Alert,
  Button,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Webhook as WebhookIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  FileCopy as CopyIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useUIStore } from '../../stores';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
  lastDelivery?: string;
  lastDeliveryStatus?: 'success' | 'failed';
  secret?: string;
  description?: string;
}

const WebhookManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: '1',
      name: 'Payment Notifications',
      url: 'https://api.example.com/webhooks/payments',
      events: ['payment.success', 'payment.failed', 'subscription.renewed'],
      status: 'active',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      lastDelivery: new Date(Date.now() - 3600000).toISOString(),
      lastDeliveryStatus: 'success',
      secret: 'whsec_*******************',
      description:
        'Handles payment and subscription events from our payment processor',
    },
    {
      id: '2',
      name: 'User Management',
      url: 'https://internal.example.com/webhooks/users',
      events: ['user.created', 'user.updated', 'user.deleted'],
      status: 'active',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      lastDelivery: new Date(Date.now() - 7200000).toISOString(),
      lastDeliveryStatus: 'success',
      secret: 'whsec_*******************',
      description: 'Syncs user data with our internal systems',
    },
    {
      id: '3',
      name: 'Audit Logs',
      url: 'https://logs.example.com/webhooks/audit',
      events: ['audit.log'],
      status: 'error',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 1000000).toISOString(),
      lastDelivery: new Date(Date.now() - 1000000).toISOString(),
      lastDeliveryStatus: 'failed',
      secret: 'whsec_*******************',
      description: 'Sends audit logs to our centralized logging system',
    },
  ]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newWebhook, setNewWebhook] = useState<
    Omit<Webhook, 'id' | 'createdAt' | 'updatedAt'>
  >({
    name: '',
    url: '',
    events: [],
    status: 'active',
    secret: '',
    description: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addNotification = useUIStore((state) => state.addNotification);

  const handleSaveWebhook = async () => {
    try {
      setLoading(true);

      // In a real implementation, this would call an API
      // For now, we'll simulate the process
      const action = editingWebhook ? 'updated' : 'created';

      addNotification({
        type: 'info',
        title: `Webhook ${action}`,
        message: `Webhook ${newWebhook.name} has been ${action}`,
      });

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (editingWebhook) {
        // Update existing webhook
        setWebhooks(
          webhooks.map((w) =>
            w.id === editingWebhook.id
              ? {
                  ...w,
                  ...newWebhook,
                  updatedAt: new Date().toISOString(),
                }
              : w
          )
        );
      } else {
        // Add new webhook
        const webhook: Webhook = {
          id: (webhooks.length + 1).toString(),
          ...newWebhook,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setWebhooks([webhook, ...webhooks]);
      }

      setShowWebhookDialog(false);
      setEditingWebhook(null);
      setNewWebhook({
        name: '',
        url: '',
        events: [],
        status: 'active',
        secret: '',
        description: '',
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Operation Failed',
        message: `Failed to save webhook: ${newWebhook.name}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      setLoading(true);

      // In a real implementation, this would call an API
      // For now, we'll simulate the process
      const webhook = webhooks.find((w) => w.id === webhookId);

      addNotification({
        type: 'info',
        title: 'Webhook Deleted',
        message: `Webhook ${webhook?.name} has been deleted`,
      });

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Remove the webhook
      setWebhooks(webhooks.filter((w) => w.id !== webhookId));
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete webhook',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhookStatus = async (webhookId: string) => {
    try {
      setLoading(true);

      // In a real implementation, this would call an API
      // For now, we'll simulate the process
      const webhook = webhooks.find((w) => w.id === webhookId);

      addNotification({
        type: 'info',
        title: 'Status Updated',
        message: `Webhook ${webhook?.name} status updated`,
      });

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Toggle the webhook status
      setWebhooks(
        webhooks.map((w) =>
          w.id === webhookId
            ? {
                ...w,
                status: w.status === 'active' ? 'inactive' : 'active',
                updatedAt: new Date().toISOString(),
              }
            : w
        )
      );
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Status Update Failed',
        message: 'Failed to update webhook status',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      setLoading(true);

      // In a real implementation, this would call an API
      // For now, we'll simulate the process
      const webhook = webhooks.find((w) => w.id === webhookId);

      addNotification({
        type: 'info',
        title: 'Test Sent',
        message: `Test event sent to webhook ${webhook?.name}`,
      });

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update last delivery status
      setWebhooks(
        webhooks.map((w) =>
          w.id === webhookId
            ? {
                ...w,
                lastDelivery: new Date().toISOString(),
                lastDeliveryStatus: Math.random() > 0.2 ? 'success' : 'failed', // 80% success rate
              }
            : w
        )
      );
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Test Failed',
        message: 'Failed to send test event',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = (secret: string, webhookId: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(webhookId);
    setTimeout(() => setCopiedId(null), 2000);

    addNotification({
      type: 'success',
      title: 'Copied',
      message: 'Webhook secret copied to clipboard',
    });
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setNewWebhook({
      name: webhook.name,
      url: webhook.url,
      events: [...webhook.events],
      status: webhook.status,
      secret: webhook.secret || '',
      description: webhook.description || '',
    });
    setShowWebhookDialog(true);
  };

  const openCreateDialog = () => {
    setEditingWebhook(null);
    setNewWebhook({
      name: '',
      url: '',
      events: [],
      status: 'active',
      secret: '',
      description: '',
    });
    setShowWebhookDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getDeliveryStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredWebhooks = webhooks.filter((webhook) => {
    const matchesSearch =
      webhook.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.events.some((e) =>
        e.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesStatus =
      filterStatus === 'all' || webhook.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <WebhookIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" component="h1">
            Webhook Management
          </Typography>
        </Box>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ mr: 1 }}
          >
            Add Webhook
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => setLoading(true)}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Webhook Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary.main" gutterBottom>
                {webhooks.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Webhooks
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" gutterBottom>
                {webhooks.filter((w) => w.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main" gutterBottom>
                {webhooks.filter((w) => w.status === 'error').length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                With Errors
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" gutterBottom>
                {
                  webhooks.filter((w) => w.lastDeliveryStatus === 'success')
                    .length
                }
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Recent Success
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by name, URL, or events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status Filter"
                  onChange={(e) => setFilterStatus(e.target.value as string)}
                >
                  <MenuItem value="all">All Webhooks</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Webhook List */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Webhook Endpoints"
              subheader="Manage all webhook endpoints and their configurations"
            />
            <Divider />
            <CardContent>
              {filteredWebhooks.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No webhooks found
                  </Typography>
                </Box>
              ) : (
                <List>
                  {filteredWebhooks.map((webhook) => (
                    <ListItem
                      key={webhook.id}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        '&:last-child': { mb: 0 },
                      }}
                    >
                      <Box sx={{ mr: 2, mt: 0.5 }}>
                        <WebhookIcon />
                      </Box>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mb: 0.5,
                            }}
                          >
                            <Typography variant="subtitle1" sx={{ mr: 1 }}>
                              {webhook.name}
                            </Typography>
                            <Chip
                              label={webhook.status}
                              size="small"
                              color={getStatusColor(webhook.status) as any}
                            />
                            {webhook.lastDeliveryStatus && (
                              <Chip
                                label={webhook.lastDeliveryStatus}
                                size="small"
                                color={
                                  getDeliveryStatusColor(
                                    webhook.lastDeliveryStatus
                                  ) as any
                                }
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="body2"
                              color="textSecondary"
                              sx={{ mb: 1 }}
                            >
                              {webhook.url}
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ mr: 2 }}
                              >
                                Events: {webhook.events.join(', ')}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                sx={{ mr: 2 }}
                              >
                                Created:{' '}
                                {new Date(
                                  webhook.createdAt
                                ).toLocaleDateString()}
                              </Typography>
                              {webhook.lastDelivery && (
                                <Typography
                                  variant="caption"
                                  color="textSecondary"
                                >
                                  Last delivery:{' '}
                                  {new Date(
                                    webhook.lastDelivery
                                  ).toLocaleDateString()}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Test Webhook">
                          <IconButton
                            onClick={() => handleTestWebhook(webhook.id)}
                            disabled={loading}
                            sx={{ mr: 1 }}
                          >
                            <WebhookIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton
                            onClick={() => openEditDialog(webhook)}
                            disabled={loading}
                            sx={{ mr: 1 }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={webhook.status === 'active'}
                              onChange={() =>
                                handleToggleWebhookStatus(webhook.id)
                              }
                              disabled={loading}
                            />
                          }
                          label={
                            webhook.status === 'active' ? 'Active' : 'Inactive'
                          }
                          sx={{ mr: 1 }}
                        />
                        <IconButton
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          disabled={loading}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Webhook Dialog */}
      <Dialog
        open={showWebhookDialog}
        onClose={() => setShowWebhookDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WebhookIcon sx={{ mr: 1 }} />
            {editingWebhook ? 'Edit Webhook' : 'Add New Webhook'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Webhook Name"
              value={newWebhook.name}
              onChange={(e) =>
                setNewWebhook({ ...newWebhook, name: e.target.value })
              }
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Endpoint URL"
              value={newWebhook.url}
              onChange={(e) =>
                setNewWebhook({ ...newWebhook, url: e.target.value })
              }
              margin="normal"
              required
              helperText="The URL where webhook events will be sent"
            />
            <TextField
              fullWidth
              label="Description"
              value={newWebhook.description}
              onChange={(e) =>
                setNewWebhook({ ...newWebhook, description: e.target.value })
              }
              margin="normal"
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Webhook Secret"
              value={newWebhook.secret}
              onChange={(e) =>
                setNewWebhook({ ...newWebhook, secret: e.target.value })
              }
              margin="normal"
              type="password"
              helperText="Used to verify webhook authenticity"
            />
            {editingWebhook && newWebhook.secret && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Button
                  startIcon={
                    copiedId === editingWebhook.id ? (
                      <CheckIcon />
                    ) : (
                      <CopyIcon />
                    )
                  }
                  onClick={() =>
                    handleCopySecret(newWebhook.secret, editingWebhook.id)
                  }
                  size="small"
                >
                  {copiedId === editingWebhook.id ? 'Copied!' : 'Copy Secret'}
                </Button>
              </Box>
            )}
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={newWebhook.status}
                label="Status"
                onChange={(e) =>
                  setNewWebhook({
                    ...newWebhook,
                    status: e.target.value as any,
                  })
                }
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveWebhook}
            disabled={loading || !newWebhook.name || !newWebhook.url}
            startIcon={
              loading ? (
                <CircularProgress size={20} />
              ) : editingWebhook ? (
                <EditIcon />
              ) : (
                <AddIcon />
              )
            }
          >
            {editingWebhook ? 'Update Webhook' : 'Add Webhook'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebhookManagement;
