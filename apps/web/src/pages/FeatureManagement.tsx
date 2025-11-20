import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  Checkbox,
  FormLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import toast from 'react-hot-toast';
import featureFlagService, { FeatureFlag } from '../services/featureFlagService';
import AdvancedTargeting from '../components/AdvancedTargeting';
import PricingPlanManagement from './PricingPlanManagement';

// Constants - All 6 tiers for both monthly & yearly plans
const AVAILABLE_TIERS = ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'];
const AVAILABLE_ROLES = ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'];

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
      id={`feature-tabpanel-${index}`}
      aria-labelledby={`feature-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// TierFeatureMatrix Component
interface TierFeatureMatrixProps {
  features: FeatureFlag[];
  onUpdate: () => void;
}

const TierFeatureMatrix: React.FC<TierFeatureMatrixProps> = ({ features, onUpdate }) => {
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateTierFeature = async (tier: string, featureKey: string, hasAccess: boolean) => {
    const updateKey = `${tier}-${featureKey}`;
    setUpdating(updateKey);
    setError(null);

    try {
      const action = hasAccess ? 'add' : 'remove';
      await featureFlagService.updateTierFeatures(tier, [featureKey], action);

      toast.success(
        `Feature ${hasAccess ? 'enabled' : 'disabled'} for ${tier} tier`
      );

      // Refresh the feature list
      onUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update tier feature';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdating(null);
    }
  };

  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (features.length === 0) {
    return (
      <Alert severity="info">
        No features available. Create features in the Features tab first.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Feature-Tier Matrix
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Toggle switches to enable or disable features for specific subscription tiers.
        </Typography>

        {/* Mobile scroll hint */}
        <Alert
          severity="info"
          sx={{
            mb: 2,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          Scroll horizontally to view all tiers
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Horizontal scroll wrapper for mobile */}
        <Box
          sx={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'action.hover',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'action.selected',
              borderRadius: '4px',
            },
          }}
        >
          <Box
            component="table"
            sx={{
              width: '100%',
              minWidth: { xs: '800px', md: '100%' },
              borderCollapse: 'collapse',
              '& th, & td': {
                border: '1px solid',
                borderColor: 'divider',
                padding: { xs: 1, sm: 1.5, md: 2 },
                textAlign: 'left',
              },
              '& th': {
                backgroundColor: 'action.hover',
                fontWeight: 'bold',
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
              '& td': {
                fontSize: { xs: '0.875rem', sm: '1rem' },
              },
            }}
          >
            <thead>
              <tr>
                <Box component="th" sx={{ minWidth: { xs: '150px', sm: '200px' } }}>
                  Feature
                </Box>
                {AVAILABLE_TIERS.map((tier) => (
                  <Box
                    component="th"
                    key={tier}
                    sx={{
                      textAlign: 'center',
                      minWidth: { xs: '100px', sm: '120px' },
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {capitalizeFirstLetter(tier.replace('_', ' '))}
                  </Box>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature._id}>
                  <td>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {feature.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        display: 'block',
                        wordBreak: 'break-word'
                      }}
                    >
                      {feature.key}
                    </Typography>
                  </td>
                  {AVAILABLE_TIERS.map((tier) => {
                    const isChecked = feature.allowedTiers?.includes(tier) || false;
                    const updateKey = `${tier}-${feature.key}`;
                    const isUpdating = updating === updateKey;

                    return (
                      <Box component="td" key={tier} sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        {isUpdating ? (
                          <CircularProgress size={24} />
                        ) : (
                          <Switch
                            checked={isChecked}
                            onChange={(e) => updateTierFeature(tier, feature.key, e.target.checked)}
                            color="primary"
                            disabled={isUpdating}
                            size="small"
                            sx={{
                              '& .MuiSwitch-switchBase': {
                                padding: { xs: '6px', sm: '9px' }
                              },
                              '& .MuiSwitch-thumb': {
                                width: { xs: '16px', sm: '20px' },
                                height: { xs: '16px', sm: '20px' }
                              }
                            }}
                          />
                        )}
                      </Box>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const FeatureManagement: React.FC = () => {
  // State management
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureFlag | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    allowedTiers: [] as string[],
    allowedRoles: [] as string[],
    isActive: true,
  });

  // Fetch features on mount
  useEffect(() => {
    fetchFeatures();
  }, []);

  // Fetch features function
  const fetchFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await featureFlagService.getFeatureFlags();
      setFeatures(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch features';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle tier checkbox change
  const handleTierChange = (tier: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      allowedTiers: checked
        ? [...prev.allowedTiers, tier]
        : prev.allowedTiers.filter((t) => t !== tier),
    }));
  };

  // Handle role checkbox change
  const handleRoleChange = (role: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      allowedRoles: checked
        ? [...prev.allowedRoles, role]
        : prev.allowedRoles.filter((r) => r !== role),
    }));
  };

  // Handle form submit
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.key.trim() || !formData.name.trim()) {
      toast.error('Feature key and name are required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingFeature) {
        await featureFlagService.updateFeatureFlag(editingFeature._id, formData);
        toast.success('Feature updated successfully');
      } else {
        await featureFlagService.createFeatureFlag(formData);
        toast.success('Feature created successfully');
      }
      await fetchFeatures();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit
  const startEdit = (feature: FeatureFlag) => {
    setEditingFeature(feature);
    setFormData({
      key: feature.key,
      name: feature.name,
      description: feature.description || '',
      allowedTiers: feature.allowedTiers || [],
      allowedRoles: feature.allowedRoles || [],
      isActive: feature.isActive,
    });
    setShowCreateForm(true);
  };

  // Handle delete
  const handleDelete = async (feature: FeatureFlag) => {
    if (!window.confirm(`Are you sure you want to delete "${feature.name}"?`)) {
      return;
    }

    try {
      setSubmitting(true);
      await featureFlagService.deleteFeatureFlag(feature._id);
      toast.success('Feature deleted successfully');
      await fetchFeatures();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete feature');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      allowedTiers: [],
      allowedRoles: [],
      isActive: true,
    });
    setEditingFeature(null);
    setShowCreateForm(false);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={48} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading features...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error && features.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px">
          <Alert severity="error" sx={{ mb: 2, maxWidth: '600px' }}>
            <Typography variant="h6" gutterBottom>
              Failed to Load Features
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={fetchFeatures}
          >
            Retry
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      {/* Page Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        flexDirection={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 2, sm: 0 }}
      >
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Feature Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateForm(true)}
          disabled={submitting}
          sx={{
            minWidth: { sm: '150px' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Add Feature
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="feature management tabs">
          <Tab label="Features" id="feature-tab-0" aria-controls="feature-tabpanel-0" />
          <Tab label="Tier Management" id="feature-tab-1" aria-controls="feature-tabpanel-1" />
          <Tab
            label="Advanced Targeting"
            id="feature-tab-2"
            aria-controls="feature-tabpanel-2"
            icon={<TuneIcon />}
            iconPosition="start"
          />
          <Tab
            label="Pricing Plans"
            id="feature-tab-3"
            aria-controls="feature-tabpanel-3"
          />
        </Tabs>
      </Box>

      {/* Features Tab */}
      <TabPanel value={activeTab} index={0}>
        {/* Create/Edit Form Dialog */}
        <Dialog
          open={showCreateForm}
          onClose={resetForm}
          maxWidth="md"
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              margin: { xs: 0, sm: 2 },
              maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' },
              width: { xs: '100%', sm: 'auto' }
            }
          }}
        >
          <DialogTitle>
            {editingFeature ? 'Edit Feature' : 'Create Feature'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Feature Key"
                    value={formData.key}
                    onChange={(e) => handleInputChange('key', e.target.value)}
                    disabled={!!editingFeature}
                    helperText="Unique identifier (lowercase, underscores allowed)"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Display Name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    multiline
                    rows={3}
                  />
                </Grid>

                {/* Allowed Tiers */}
                <Grid size={12}>
                  <FormLabel component="legend">Allowed Tiers</FormLabel>
                  <FormGroup
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(3, 1fr)'
                      },
                      gap: 1
                    }}
                  >
                    {AVAILABLE_TIERS.map((tier) => (
                      <FormControlLabel
                        key={tier}
                        control={
                          <Checkbox
                            checked={formData.allowedTiers.includes(tier)}
                            onChange={(e) => handleTierChange(tier, e.target.checked)}
                          />
                        }
                        label={tier}
                      />
                    ))}
                  </FormGroup>
                </Grid>

                {/* Allowed Roles */}
                <Grid size={12}>
                  <FormLabel component="legend">Allowed Roles</FormLabel>
                  <FormGroup
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(3, 1fr)'
                      },
                      gap: 1
                    }}
                  >
                    {AVAILABLE_ROLES.map((role) => (
                      <FormControlLabel
                        key={role}
                        control={
                          <Checkbox
                            checked={formData.allowedRoles.includes(role)}
                            onChange={(e) => handleRoleChange(role, e.target.checked)}
                          />
                        }
                        label={role}
                      />
                    ))}
                  </FormGroup>
                </Grid>

                {/* Active Toggle */}
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 },
              px: { xs: 2, sm: 3 },
              pb: { xs: 2, sm: 2 }
            }}
          >
            <Button
              onClick={resetForm}
              disabled={submitting}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={submitting}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {submitting ? 'Saving...' : editingFeature ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Feature List */}
        {features.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No features found. Click "Add Feature" to create one.
          </Alert>
        ) : (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {features.map((feature) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={feature._id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6" component="h2">
                        {feature.name}
                      </Typography>
                      <Chip
                        label={feature.isActive ? 'Active' : 'Inactive'}
                        color={feature.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontFamily: 'monospace' }}>
                      Key: {feature.key}
                    </Typography>

                    {feature.description && (
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {feature.description}
                      </Typography>
                    )}

                    {/* Tiers */}
                    <Box mb={1}>
                      <Typography variant="caption" color="text.secondary">
                        Tiers:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                        {feature.allowedTiers && feature.allowedTiers.length > 0 ? (
                          feature.allowedTiers.map((tier) => (
                            <Chip key={tier} label={tier} size="small" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Roles */}
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary">
                        Roles:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                        {feature.allowedRoles && feature.allowedRoles.length > 0 ? (
                          feature.allowedRoles.map((role) => (
                            <Chip key={role} label={role} size="small" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box
                      display="flex"
                      justifyContent="flex-end"
                      gap={1}
                      sx={{ mt: 1 }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => startEdit(feature)}
                        aria-label="Edit"
                        disabled={submitting}
                        sx={{
                          minWidth: { xs: '40px', sm: 'auto' },
                          minHeight: { xs: '40px', sm: 'auto' }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(feature)}
                        aria-label="Delete"
                        disabled={submitting}
                        sx={{
                          minWidth: { xs: '40px', sm: 'auto' },
                          minHeight: { xs: '40px', sm: 'auto' }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* Tier Management Tab */}
      <TabPanel value={activeTab} index={1}>
        <TierFeatureMatrix features={features} onUpdate={fetchFeatures} />
      </TabPanel>

      {/* Advanced Targeting Tab */}
      <TabPanel value={activeTab} index={2}>
        <AdvancedTargeting features={features} onUpdate={fetchFeatures} />
      </TabPanel>

      {/* Pricing Plans Tab */}
      <TabPanel value={activeTab} index={3}>
        <PricingPlanManagement />
      </TabPanel>
    </Container>
  );
};

export default FeatureManagement;
