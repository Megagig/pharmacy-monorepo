import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Snackbar,
  Badge,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Subscriptions as SubscriptionsIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  MoreVert as MoreVertIcon,
  Upgrade as UpgradeIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import saasService from '../../services/saasService';
import saasTenantService from '../../services/saasTenantService';
import StatsCard from '../common/StatsCard';
import StatusBadge from '../common/StatusBadge';
import ConfirmDialog from '../common/ConfirmDialog';
import ExportButton from '../common/ExportButton';


interface TenantBranding {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontFamily?: string;
  customCss?: string;
}

interface TenantLimits {
  maxUsers: number;
  maxPatients: number;
  storageLimit: number;
  apiCallsPerMonth: number;
  maxWorkspaces: number;
  maxIntegrations: number;
}

interface TenantSettings {
  timezone: string;
  currency: string;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

interface TenantCustomization {
  branding: TenantBranding;
  limits: TenantLimits;
  features: string[];
  settings: TenantSettings;
  usageMetrics: {
    currentUsers: number;
    currentPatients: number;
    storageUsed: number;
    apiCallsThisMonth: number;
    lastCalculatedAt: string;
  };
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  type: 'pharmacy' | 'clinic' | 'hospital' | 'chain';
  status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'trialing';
  contactInfo: {
    email: string;
    phone?: string;
  };
  createdAt: string;
  lastActivity: string;
}

interface WorkspaceMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  workplaceRole: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}

interface TenantSubscription {
  workspace: {
    id: string;
    name: string;
    subscriptionStatus: string;
    trialEndDate?: string;
  };
  subscription?: {
    _id: string;
    planId: string;
    tier: string;
    status: string;
    startDate: string;
    endDate: string;
    priceAtPurchase: number;
    billingInterval: string;
  };
  plan?: {
    _id: string;
    name: string;
    tier: string;
    price: number;
    features: string[];
  };
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
      id={`tenant-tabpanel-${index}`}
      aria-labelledby={`tenant-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const TenantManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [customization, setCustomization] = useState<TenantCustomization | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersPagination, setMembersPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customizationDialog, setCustomizationDialog] = useState(false);
  const [editingBranding, setEditingBranding] = useState(false);
  const [editingLimits, setEditingLimits] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);
  const [inviteMemberDialog, setInviteMemberDialog] = useState(false);
  const [memberActionMenu, setMemberActionMenu] = useState<{
    anchorEl: HTMLElement | null;
    member: WorkspaceMember | null;
  }>({ anchorEl: null, member: null });
  const [newMemberData, setNewMemberData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'Staff',
  });
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [subscriptionDialog, setSubscriptionDialog] = useState<{
    open: boolean;
    action: 'upgrade' | 'downgrade' | 'revoke' | null;
  }>({ open: false, action: null });
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [subscriptionReason, setSubscriptionReason] = useState('');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Note: Subscription status refresh will be handled by the user refreshing the page
  // or by the natural flow of the application

  // Using saasService directly since tenant methods aren't in useSaasSettings hook

  // Available features for selection
  const availableFeatures = [
    'patient-management',
    'prescription-processing',
    'inventory-management',
    'clinical-notes',
    'ai-diagnostics',
    'reports-analytics',
    'billing-integration',
    'multi-location',
    'api-access',
    'advanced-security',
  ];

  useEffect(() => {

    loadTenants();
    loadSubscriptionPlans();
  }, []);

  const loadSubscriptionPlans = async (billingPeriod?: 'monthly' | 'yearly') => {
    try {
      const response = await saasService.getAvailableSubscriptionPlans(billingPeriod);
      setSubscriptionPlans(response.data.plans || []);
    } catch (err) {
      console.error('Error loading subscription plans:', err);
      setSubscriptionPlans([]);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);

      const response = await saasService.getTenants();

      if (response.data && response.data.tenants) {
        setTenants(response.data.tenants);

      } else {

        setTenants([]);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to load tenants';
      setError(errorMessage);
      console.error('Error loading tenants:', err);
      console.error('Error response:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const createSampleData = async () => {
    try {
      setLoading(true);

      // Create sample workspaces using the provision API
      const sampleWorkspaces = [
        {
          name: 'Central Pharmacy',
          type: 'pharmacy',
          contactInfo: {
            email: 'admin@centralpharmacy.com',
            phone: '+1234567890',
            address: {
              street: '123 Main Street',
              city: 'Lagos',
              state: 'Lagos',
              country: 'Nigeria',
              postalCode: '100001'
            }
          },
          primaryContact: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@centralpharmacy.com'
          },
          subscriptionPlanId: '507f1f77bcf86cd799439011' // Dummy ObjectId
        },
        {
          name: 'City Hospital Pharmacy',
          type: 'hospital',
          contactInfo: {
            email: 'pharmacy@cityhospital.com',
            phone: '+1234567891',
            address: {
              street: '456 Hospital Road',
              city: 'Abuja',
              state: 'FCT',
              country: 'Nigeria',
              postalCode: '900001'
            }
          },
          primaryContact: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@cityhospital.com'
          },
          subscriptionPlanId: '507f1f77bcf86cd799439011'
        }
      ];

      for (const workspace of sampleWorkspaces) {
        try {
          await saasService.provisionTenant(workspace);
        } catch (err) {
          console.error('Error creating workspace:', workspace.name, err);
        }
      }

      setSuccess('Sample data created successfully');
      await loadTenants();
    } catch (err: any) {
      setError('Failed to create sample data');
      console.error('Error creating sample data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantCustomization = async (tenantId: string) => {
    try {
      const response = await saasService.getTenantCustomization(tenantId);

      setCustomization(response.data?.customization || null);
    } catch (err) {
      console.error('Error loading tenant customization:', err);
      // Set default customization to prevent errors
      setCustomization({
        branding: { primaryColor: '#1976d2', secondaryColor: '#dc004e' },
        limits: { maxUsers: 50, maxPatients: 1000, storageLimit: 5000, apiCallsPerMonth: 10000 },
        features: [],
        settings: { timezone: 'UTC', currency: 'USD', language: 'en' },
        usageMetrics: { currentUsers: 0, currentPatients: 0, storageUsed: 0, apiCallsThisMonth: 0 }
      });
    }
  };

  const handleTenantSelect = async (tenant: Tenant) => {
    try {
      setSelectedTenant(tenant);
      setLoading(true);

      await Promise.all([
        loadTenantCustomization(tenant._id),
        loadTenantSubscription(tenant._id),
        loadWorkspaceMembers(tenant._id),
      ]);

      setCustomizationDialog(true);
    } catch (error) {
      console.error('Error loading tenant data:', error);
      setError('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  };

  const loadTenantSubscription = async (tenantId: string) => {
    try {
      setLoading(true);
      const response = await saasService.getTenantSubscription(tenantId);
      setSubscription(response.data.subscription);
    } catch (err) {
      setError('Failed to load tenant subscription');
      console.error('Error loading tenant subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceMembers = async (tenantId: string, page: number = 1) => {
    try {
      setLoading(true);
      const response = await saasService.getWorkspaceMembers(tenantId, { page, limit: 20 });
      setMembers(response.data.members);
      setMembersPagination(response.data.pagination);
    } catch (err) {
      setError('Failed to load workspace members');
      console.error('Error loading workspace members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranding = async (branding: Partial<TenantBranding>) => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      await saasService.updateTenantBranding(selectedTenant._id, branding);
      setSuccess('Branding updated successfully');
      await loadTenantCustomization(selectedTenant._id);
      setEditingBranding(false);
    } catch (err) {
      setError('Failed to update branding');
      console.error('Error updating branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimits = async (limits: Partial<TenantLimits>) => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      await saasService.updateTenantLimits(selectedTenant._id, limits);
      setSuccess('Limits updated successfully');
      await loadTenantCustomization(selectedTenant._id);
      setEditingLimits(false);
    } catch (err) {
      setError('Failed to update limits');
      console.error('Error updating limits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFeatures = async (features: string[]) => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      await saasService.updateTenantFeatures(selectedTenant._id, features);
      setSuccess('Features updated successfully');
      await loadTenantCustomization(selectedTenant._id);
      setEditingFeatures(false);
    } catch (err) {
      setError('Failed to update features');
      console.error('Error updating features:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionAction = (action: 'upgrade' | 'downgrade' | 'revoke') => {
    setSubscriptionDialog({ open: true, action });
    setSelectedPlan('');
    setSubscriptionReason('');
    setSelectedBillingPeriod('monthly');
    // Load plans for the default billing period
    if (action !== 'revoke') {
      loadSubscriptionPlans('monthly');
    }
  };

  const executeSubscriptionAction = async () => {
    if (!selectedTenant || !subscriptionDialog.action) return;

    try {
      setLoading(true);

      await saasService.updateTenantSubscription(selectedTenant._id, {
        action: subscriptionDialog.action,
        planId: selectedPlan || undefined,
        reason: subscriptionReason,
      });

      setSuccess(`Subscription ${subscriptionDialog.action} completed successfully. The tenant information has been updated. Please refresh the page to see updated subscription status in the navigation.`);
      setSubscriptionDialog({ open: false, action: null });
      await Promise.all([
        loadTenantSubscription(selectedTenant._id),
        loadTenants(), // Refresh the tenant list to show updated status
      ]);
    } catch (err: any) {
      setError(`Failed to ${subscriptionDialog.action} subscription: ${err.response?.data?.error?.message || err.message}`);
      console.error(`Error ${subscriptionDialog.action} subscription:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      await saasService.inviteWorkspaceMember(selectedTenant._id, newMemberData);
      setSuccess('Invitation sent successfully');
      setInviteMemberDialog(false);
      setNewMemberData({ email: '', firstName: '', lastName: '', role: 'Staff' });
      await loadWorkspaceMembers(selectedTenant._id);
    } catch (err) {
      setError('Failed to send invitation');
      console.error('Error inviting member:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      await saasService.updateMemberRole(selectedTenant._id, memberId, newRole);
      setSuccess('Member role updated successfully');
      await loadWorkspaceMembers(selectedTenant._id);
      setMemberActionMenu({ anchorEl: null, member: null });
    } catch (err) {
      setError('Failed to update member role');
      console.error('Error updating member role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTenant) return;

    const reason = prompt('Please provide a reason for removing this member:');
    if (reason === null) return; // User cancelled

    try {
      setLoading(true);
      await saasService.removeMember(selectedTenant._id, memberId, reason);
      setSuccess('Member removed successfully');
      await loadWorkspaceMembers(selectedTenant._id);
      setMemberActionMenu({ anchorEl: null, member: null });
    } catch (err) {
      setError('Failed to remove member');
      console.error('Error removing member:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'error';
      case 'pending':
        return 'warning';
      case 'trial':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatUsage = (current: number = 0, limit: number = 1, unit: string) => {
    const safeLimit = limit || 1; // Prevent division by zero
    const percentage = (current / safeLimit) * 100;
    const color = percentage > 90 ? 'error' : percentage > 75 ? 'warning' : 'success';

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">
          {current.toLocaleString()} / {safeLimit.toLocaleString()} {unit}
        </Typography>
        <Chip
          label={`${percentage.toFixed(1)}%`}
          size="small"
          color={color}
          variant="outlined"
        />
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Tenant Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadTenants}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Tenant List" />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SubscriptionsIcon fontSize="small" />
                    Subscriptions
                  </Box>
                }
                disabled={!selectedTenant}
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon fontSize="small" />
                    Members
                    {members.length > 0 && (
                      <Badge badgeContent={members.length} color="primary" />
                    )}
                  </Box>
                }
                disabled={!selectedTenant}
              />
              <Tab label="Customization" disabled={!selectedTenant} />
              <Tab label="Analytics" disabled={!selectedTenant} />
            </Tabs>
          </Box>

          <TabPanel value={activeTab} index={0}>
            {loading && !tenants.length ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Loading tenants...
                </Typography>
              </Box>
            ) : tenants.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  No tenants found
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  There are no workspaces in the system yet.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={createSampleData}
                  disabled={loading}
                >
                  Create Sample Data
                </Button>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Subscription</TableCell>
                      <TableCell>Members</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Last Activity</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant._id}>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2">{tenant.name}</Typography>
                            <Typography variant="caption" color="textSecondary">
                              {tenant.slug}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={tenant.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={tenant.status}
                            size="small"
                            color={getStatusColor(tenant.status) as any}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Chip
                              label={tenant.subscriptionStatus}
                              size="small"
                              color={getStatusColor(tenant.subscriptionStatus) as any}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="textSecondary">
                              {tenant.planName || 'Free Trial'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PeopleIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {/* This would be populated from actual member count */}
                              {Math.floor(Math.random() * 20) + 1} members
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{tenant.contactInfo.email}</Typography>
                          {tenant.contactInfo.phone && (
                            <Typography variant="caption" color="textSecondary">
                              {tenant.contactInfo.phone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(tenant.lastActivity).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Customize Tenant">
                            <IconButton
                              size="small"
                              onClick={() => handleTenantSelect(tenant)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {selectedTenant && subscription && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Subscription Management for {selectedTenant.name}
                  </Typography>
                </Grid>

                {/* Current Subscription Info */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SubscriptionsIcon />
                        Current Subscription
                      </Typography>

                      {subscription.subscription ? (
                        <Box>
                          <Typography variant="body1" gutterBottom>
                            <strong>Plan:</strong> {subscription.plan?.name || 'Unknown Plan'}
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Tier:</strong> {subscription.subscription.tier}
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Status:</strong>
                            <Chip
                              label={subscription.subscription.status}
                              size="small"
                              color={getStatusColor(subscription.subscription.status) as any}
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Price:</strong> ₦{subscription.subscription.priceAtPurchase.toLocaleString()}/{subscription.subscription.billingInterval}
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>End Date:</strong> {new Date(subscription.subscription.endDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      ) : (
                        <Alert severity="info">
                          No active subscription found
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Subscription Actions */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Subscription Actions
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<UpgradeIcon />}
                          onClick={() => handleSubscriptionAction('upgrade')}
                          disabled={loading}
                        >
                          Upgrade Subscription
                        </Button>

                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={() => handleSubscriptionAction('downgrade')}
                          disabled={loading}
                        >
                          Downgrade Subscription
                        </Button>

                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => handleSubscriptionAction('revoke')}
                          disabled={loading}
                        >
                          Revoke Subscription
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Workspace Info */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Workspace Information
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="textSecondary">Workspace Name</Typography>
                          <Typography variant="body1">{subscription.workspace.name}</Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="textSecondary">Subscription Status</Typography>
                          <Chip
                            label={subscription.workspace.subscriptionStatus}
                            size="small"
                            color={getStatusColor(subscription.workspace.subscriptionStatus) as any}
                          />
                        </Grid>
                        {(subscription.workspace.trialEndDate || subscription.subscription?.endDate) && (
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" color="textSecondary">
                              {subscription.workspace.subscriptionStatus === 'trial' ? 'Trial End Date' : 'Subscription End Date'}
                            </Typography>
                            <Typography variant="body1">
                              {subscription.workspace.subscriptionStatus === 'trial' && subscription.workspace.trialEndDate
                                ? new Date(subscription.workspace.trialEndDate).toLocaleDateString()
                                : subscription.subscription?.endDate
                                  ? new Date(subscription.subscription.endDate).toLocaleDateString()
                                  : 'N/A'
                              }
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            {selectedTenant && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Workspace Members ({membersPagination.total})
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<PersonAddIcon />}
                      onClick={() => setInviteMemberDialog(true)}
                    >
                      Invite Member
                    </Button>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Member</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Last Login</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member._id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ width: 32, height: 32 }}>
                                  {member.firstName[0]}{member.lastName[0]}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2">
                                    {member.firstName} {member.lastName}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Joined {new Date(member.createdAt).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>
                              <Chip
                                label={member.workplaceRole || member.role}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={member.status}
                                size="small"
                                color={getStatusColor(member.status) as any}
                              />
                            </TableCell>
                            <TableCell>
                              {member.lastLoginAt
                                ? new Date(member.lastLoginAt).toLocaleDateString()
                                : 'Never'
                              }
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={(e) => setMemberActionMenu({
                                  anchorEl: e.currentTarget,
                                  member
                                })}
                              >
                                <MoreVertIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            {selectedTenant && customization && (
              <Grid container spacing={3}>
                {/* Branding Section */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PaletteIcon />
                          Branding & Theming
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setEditingBranding(true)}
                        >
                          Edit
                        </Button>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                backgroundColor: customization.branding.primaryColor,
                                borderRadius: 1,
                                border: '1px solid #ccc',
                              }}
                            />
                            <Box>
                              <Typography variant="subtitle2">Primary Color</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {customization.branding.primaryColor}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                backgroundColor: customization.branding.secondaryColor,
                                borderRadius: 1,
                                border: '1px solid #ccc',
                              }}
                            />
                            <Box>
                              <Typography variant="subtitle2">Secondary Color</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {customization.branding.secondaryColor}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box>
                            <Typography variant="subtitle2">Font Family</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {customization.branding.fontFamily || 'Default'}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Limits Section */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SecurityIcon />
                          Limits & Quotas
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setEditingLimits(true)}
                        >
                          Edit
                        </Button>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Users</Typography>
                          {formatUsage(
                            customization?.usageMetrics?.currentUsers || 0,
                            customization?.limits?.maxUsers || 50,
                            'users'
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Patients</Typography>
                          {formatUsage(
                            customization?.usageMetrics?.currentPatients || 0,
                            customization?.limits?.maxPatients || 1000,
                            'patients'
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Storage</Typography>
                          {formatUsage(
                            customization?.usageMetrics?.storageUsed || 0,
                            customization?.limits?.storageLimit || 5000,
                            'MB'
                          )}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>API Calls (This Month)</Typography>
                          {formatUsage(
                            customization?.usageMetrics?.apiCallsThisMonth || 0,
                            customization?.limits?.apiCallsPerMonth || 10000,
                            'calls'
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Features Section */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SettingsIcon />
                          Enabled Features
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setEditingFeatures(true)}
                        >
                          Edit
                        </Button>
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {(customization?.features || []).map((feature) => (
                          <Chip
                            key={feature}
                            label={feature.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                        {(!customization?.features || customization.features.length === 0) && (
                          <Typography variant="body2" color="textSecondary">
                            No features enabled
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            {selectedTenant && customization && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Usage Analytics for {selectedTenant.name}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {customization?.usageMetrics?.currentUsers || 0}
                      </Typography>
                      <Typography variant="subtitle2" color="textSecondary">
                        Active Users
                      </Typography>
                      <Typography variant="caption">
                        of {customization?.limits?.maxUsers || 50} limit
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="secondary">
                        {customization?.usageMetrics?.currentPatients || 0}
                      </Typography>
                      <Typography variant="subtitle2" color="textSecondary">
                        Patients
                      </Typography>
                      <Typography variant="caption">
                        of {customization?.limits?.maxPatients || 1000} limit
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info">
                        {((customization?.usageMetrics?.storageUsed || 0) / 1024).toFixed(1)}GB
                      </Typography>
                      <Typography variant="subtitle2" color="textSecondary">
                        Storage Used
                      </Typography>
                      <Typography variant="caption">
                        of {((customization?.limits?.storageLimit || 5000) / 1024).toFixed(1)}GB limit
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning">
                        {(customization?.usageMetrics?.apiCallsThisMonth || 0).toLocaleString()}
                      </Typography>
                      <Typography variant="subtitle2" color="textSecondary">
                        API Calls
                      </Typography>
                      <Typography variant="caption">
                        this month
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteMemberDialog}
        onClose={() => setInviteMemberDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite New Member</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={newMemberData.firstName}
                onChange={(e) => setNewMemberData(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={newMemberData.lastName}
                onChange={(e) => setNewMemberData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newMemberData.email}
                onChange={(e) => setNewMemberData(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newMemberData.role}
                  label="Role"
                  onChange={(e) => setNewMemberData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <MenuItem value="Owner">Owner</MenuItem>
                  <MenuItem value="Staff">Staff</MenuItem>
                  <MenuItem value="Pharmacist">Pharmacist</MenuItem>
                  <MenuItem value="Cashier">Cashier</MenuItem>
                  <MenuItem value="Technician">Technician</MenuItem>
                  <MenuItem value="Assistant">Assistant</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteMemberDialog(false)}>Cancel</Button>
          <Button
            onClick={handleInviteMember}
            variant="contained"
            disabled={loading || !newMemberData.email || !newMemberData.firstName || !newMemberData.lastName}
            startIcon={<EmailIcon />}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Member Action Menu */}
      <Menu
        anchorEl={memberActionMenu.anchorEl}
        open={Boolean(memberActionMenu.anchorEl)}
        onClose={() => setMemberActionMenu({ anchorEl: null, member: null })}
      >
        <MenuItem onClick={() => {
          if (memberActionMenu.member) {
            const newRole = prompt('Enter new role:', memberActionMenu.member.workplaceRole);
            if (newRole) {
              handleUpdateMemberRole(memberActionMenu.member._id, newRole);
            }
          }
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change Role</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (memberActionMenu.member) {
              handleRemoveMember(memberActionMenu.member._id);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Remove Member</ListItemText>
        </MenuItem>
      </Menu>

      {/* Subscription Action Dialog */}
      <Dialog
        open={subscriptionDialog.open}
        onClose={() => setSubscriptionDialog({ open: false, action: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {subscriptionDialog.action === 'revoke'
            ? 'Revoke Subscription'
            : `${subscriptionDialog.action === 'upgrade' ? 'Upgrade' : 'Downgrade'} Subscription`
          }
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {subscriptionDialog.action !== 'revoke' && (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Billing Period</InputLabel>
                    <Select
                      value={selectedBillingPeriod}
                      label="Billing Period"
                      onChange={(e) => {
                        const newPeriod = e.target.value as 'monthly' | 'yearly';
                        setSelectedBillingPeriod(newPeriod);
                        setSelectedPlan(''); // Reset selected plan when changing billing period
                        loadSubscriptionPlans(newPeriod);
                      }}
                    >
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly (10% discount)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Select a Plan ({subscriptionPlans.length} available)
                  </Typography>
                  <Grid container spacing={2}>
                    {subscriptionPlans.length === 0 && (
                      <Grid item xs={12}>
                        <Alert severity="info">
                          No subscription plans available. Please contact support.
                        </Alert>
                      </Grid>
                    )}
                    {subscriptionPlans.map((plan) => (
                      <Grid item xs={12} sm={6} md={4} key={plan._id}>
                        <Card
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            border: selectedPlan === plan._id ? 2 : 1,
                            borderColor: selectedPlan === plan._id ? 'primary.main' : 'divider',
                            '&:hover': {
                              borderColor: 'primary.main',
                              boxShadow: 1,
                            }
                          }}
                          onClick={() => setSelectedPlan(plan._id)}
                        >
                          <CardContent sx={{ textAlign: 'center', p: 2 }}>
                            <Typography variant="h6" gutterBottom>
                              {plan.name}
                            </Typography>
                            <Typography variant="h4" color="primary" gutterBottom>
                              ₦{plan.price.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              per {plan.billingPeriod}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                label={plan.tier.replace('_', ' ').toUpperCase()}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <Chip
                                label={plan.billingPeriod.toUpperCase()}
                                size="small"
                                color={plan.billingPeriod === 'yearly' ? 'success' : 'default'}
                                variant="outlined"
                              />
                              {plan.isPopular && (
                                <Chip
                                  label="Popular"
                                  size="small"
                                  color="secondary"
                                />
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                multiline
                rows={3}
                value={subscriptionReason}
                onChange={(e) => setSubscriptionReason(e.target.value)}
                placeholder={`Please provide a reason for ${subscriptionDialog.action}...`}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setSubscriptionDialog({ open: false, action: null })}>
            Cancel
          </Button>
          <Button
            onClick={executeSubscriptionAction}
            variant="contained"
            disabled={loading || !subscriptionReason || (subscriptionDialog.action !== 'revoke' && !selectedPlan)}
            color={subscriptionDialog.action === 'revoke' ? 'error' : 'primary'}
          >
            {subscriptionDialog.action === 'revoke' ? 'Revoke' :
              subscriptionDialog.action === 'upgrade' ? 'Upgrade' : 'Downgrade'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TenantManagement;