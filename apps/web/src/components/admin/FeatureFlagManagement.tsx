import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  CircularProgress,
  Chip,
  Switch,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
// Import custom Grid components that fix Material UI v7 Grid typing issues
import GridItem, { GridContainer } from '../common/GridItem';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRBAC } from '../../hooks/useRBAC';
// Import the feature flag types from service
import featureFlagService, {
  FeatureFlag as FeatureFlagType,
} from '../../services/featureFlagService';
import type {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagResponse,
} from '../../types/featureFlags';

// Temporary mock if the real service doesn't exist
if (!featureFlagService) {
  // Create a mock service
  const mockService = {
    getAllFeatureFlags: async () => {
      // Mock API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: [
              {
                _id: '1',
                name: 'Advanced Analytics',
                key: 'advanced_analytics',
                description:
                  'Access to advanced business intelligence dashboards',
                isActive: true,
                allowedTiers: ['pro', 'enterprise'],
                allowedRoles: [
                  'pharmacist',
                  'pharmacy_team',
                  'pharmacy_outlet',
                ],
                metadata: {
                  category: 'analytics',
                  priority: 'medium',
                  tags: ['analytics', 'dashboard'],
                },
                customRules: {},
              },
              {
                _id: '2',
                name: 'Team Management',
                key: 'team_management',
                description: 'Ability to invite and manage team members',
                isActive: true,
                allowedTiers: ['pro', 'enterprise'],
                allowedRoles: ['pharmacy_team', 'pharmacy_outlet'],
                metadata: {
                  category: 'collaboration',
                  priority: 'high',
                  tags: ['team', 'users'],
                },
                customRules: {
                  maxUsers: 5,
                },
              },
              {
                _id: '3',
                name: 'API Access',
                key: 'api_access',
                description: 'Access to API endpoints for external integration',
                isActive: false,
                allowedTiers: ['enterprise'],
                allowedRoles: ['pharmacy_outlet'],
                metadata: {
                  category: 'integration',
                  priority: 'medium',
                  tags: ['api', 'integration'],
                },
                customRules: {},
              },
            ],
          });
        }, 500);
      });
    },

    updateFeatureFlag: async (id: string, data: UpdateFeatureFlagDto) => {
      // Mock API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Feature flag updated successfully',
            data: {
              ...data,
              _id: id,
            },
          });
        }, 500);
      });
    },

    createFeatureFlag: async (data: CreateFeatureFlagDto) => {
      // Mock API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Feature flag created successfully',
            data: {
              ...data,
              _id: Date.now().toString(),
            },
          });
        }, 500);
      });
    },

    deleteFeatureFlag: async (id: string) => {
      // Mock API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: `Feature flag with id ${id} deleted successfully`,
            deletedId: id,
          });
        }, 500);
      });
    },
  };

  // Use the mock service if the real one doesn't exist
  // Modify the window object to make the mock service available
  // Using any here is intentional and safe - we're extending Window with a custom property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).mockFeatureFlagService = mockService; // Use the global mock as a fallback in the component
}

// Create a local service reference that uses either the real service or the mock
const localFeatureFlagService =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  featureFlagService || (window as any).mockFeatureFlagService;

// Types - using imported type
type FeatureFlag = FeatureFlagType;

const SUBSCRIPTION_TIERS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const USER_ROLES = [
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'pharmacy_team', label: 'Pharmacy Team' },
  { value: 'pharmacy_outlet', label: 'Pharmacy Outlet' },
  { value: 'intern_pharmacist', label: 'Intern Pharmacist' },
  { value: 'super_admin', label: 'Super Admin' },
];

const CATEGORIES = [
  { value: 'core', label: 'Core Features' },
  { value: 'analytics', label: 'Analytics & Reporting' },
  { value: 'collaboration', label: 'Collaboration & Teams' },
  { value: 'integration', label: 'Integrations' },
  { value: 'compliance', label: 'Compliance & Regulations' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'administration', label: 'Administration' },
];

const FeatureFlagManagement: React.FC = () => {
  const { isSuperAdmin } = useRBAC();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureFlag | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Form state for new/edit feature flag
  const [formData, setFormData] = useState<Partial<FeatureFlag>>({
    name: '',
    key: '',
    description: '',
    isActive: true,
    allowedTiers: [],
    allowedRoles: [],
    customRules: {},
    metadata: {
      category: 'core',
      priority: 'medium',
      tags: [],
    },
  });

  // Load feature flags
  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        setLoading(true);
        const response = await localFeatureFlagService.getAllFeatureFlags();
        const typedResponse = response as {
          success: boolean;
          data: FeatureFlag[];
        };
        if (typedResponse.success) {
          setFeatureFlags(typedResponse.data);
        }
      } catch (error) {
        console.error('Error fetching feature flags:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load feature flags',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFeatureFlags();
  }, []);

  // Filter feature flags based on selected filters
  const filteredFeatureFlags = featureFlags.filter((flag) => {
    const matchesCategory =
      filterCategory === 'all' || flag.metadata.category === filterCategory;
    const matchesTier =
      filterTier === 'all' || flag.allowedTiers.includes(filterTier);
    return matchesCategory && matchesTier;
  });

  // Handle dialog open for creating new feature flag
  const handleCreateNew = () => {
    setIsEditing(false);
    setSelectedFeature(null);
    setFormData({
      name: '',
      key: '',
      description: '',
      isActive: true,
      allowedTiers: [],
      allowedRoles: [],
      customRules: {},
      metadata: {
        category: 'core',
        priority: 'medium',
        tags: [],
      },
    });
    setDialogOpen(true);
  };

  // Handle dialog open for editing feature flag
  const handleEdit = (feature: FeatureFlag) => {
    setIsEditing(true);
    setSelectedFeature(feature);
    setFormData({
      ...feature,
    });
    setDialogOpen(true);
  };

  // Handle dialog open for deleting feature flag
  const handleDeleteDialogOpen = (feature: FeatureFlag) => {
    setSelectedFeature(feature);
    setDeleteDialogOpen(true);
  };

  // Handle form field changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, childField] = name.split('.');
      setFormData((prev) => {
        const parentKey = parent as keyof typeof prev;
        const parentObj = prev[parentKey] as Record<string, unknown>;
        return {
          ...prev,
          [parent]: {
            ...parentObj,
            [childField]: value,
          },
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle switch changes
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;

    if (name.includes('.')) {
      const [parent, childField] = name.split('.');
      setFormData((prev) => {
        const parentKey = parent as keyof typeof prev;
        const parentObj = prev[parentKey] as Record<string, unknown>;
        return {
          ...prev,
          [parent]: {
            ...parentObj,
            [childField]: checked,
          },
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    }
  };

  // Handle select changes
  const handleSelectChange = (e: SelectChangeEvent<string[]>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle category select change
  const handleCategoryChange = (e: SelectChangeEvent<string>) => {
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata!,
        category: e.target.value,
      },
    }));
  };

  // Handle priority select change
  const handlePriorityChange = (e: SelectChangeEvent<string>) => {
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata!,
        priority: e.target.value as 'low' | 'medium' | 'high' | 'critical',
      },
    }));
  };

  // Handle tag input
  const handleTagsChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();

      if (newTag && !formData.metadata?.tags?.includes(newTag)) {
        setFormData((prev) => ({
          ...prev,
          metadata: {
            ...prev.metadata!,
            tags: [...(prev.metadata?.tags || []), newTag],
          },
        }));
        e.currentTarget.value = '';
      }
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata!,
        tags: prev.metadata?.tags?.filter((tag) => tag !== tagToRemove) || [],
      },
    }));
  };

  // Submit form
  const handleSubmit = async () => {
    try {
      // Validate form data
      if (!formData.name || !formData.key || !formData.description) {
        setSnackbar({
          open: true,
          message: 'Please fill all required fields',
          severity: 'error',
        });
        return;
      }

      // Clean up key format
      const cleanKey = formData.key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const dataToSubmit = {
        ...formData,
        key: cleanKey,
      };

      let response: FeatureFlagResponse;

      if (isEditing && selectedFeature) {
        response = await localFeatureFlagService.updateFeatureFlag(
          selectedFeature._id,
          dataToSubmit
        );

        // Update local state
        setFeatureFlags((prev) =>
          prev.map((flag) =>
            flag._id === selectedFeature._id
              ? (response.data as FeatureFlag)
              : flag
          )
        );
      } else {
        // Ensure required fields are present for the CreateFeatureFlagDto
        const createFlagData: CreateFeatureFlagDto = {
          name: dataToSubmit.name || '',
          key: dataToSubmit.key || '',
          description: dataToSubmit.description || '',
          isActive: dataToSubmit.isActive,
          allowedTiers: dataToSubmit.allowedTiers,
          allowedRoles: dataToSubmit.allowedRoles,
          customRules: dataToSubmit.customRules,
          metadata: dataToSubmit.metadata,
        };

        response = await localFeatureFlagService.createFeatureFlag(
          createFlagData
        );

        // Add to local state
        setFeatureFlags((prev) => [...prev, response.data as FeatureFlag]);
      }

      setSnackbar({
        open: true,
        message: response.message || 'Operation completed successfully',
        severity: 'success',
      });

      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving feature flag:', error);
      setSnackbar({
        open: true,
        message: 'Error saving feature flag',
        severity: 'error',
      });
    }
  };

  // Delete feature flag
  const handleDelete = async () => {
    if (!selectedFeature) return;

    try {
      const response = await localFeatureFlagService.deleteFeatureFlag(
        selectedFeature._id
      );

      // Update local state
      setFeatureFlags((prev) =>
        prev.filter((flag) => flag._id !== selectedFeature._id)
      );

      setSnackbar({
        open: true,
        message: response.message || 'Feature flag deleted successfully',
        severity: 'success',
      });

      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting feature flag:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting feature flag',
        severity: 'error',
      });
    }
  };

  // Toggle feature flag active status
  const handleToggleActive = async (feature: FeatureFlag) => {
    try {
      const updatedFeature = { ...feature, isActive: !feature.isActive };

      await localFeatureFlagService.updateFeatureFlag(
        feature._id,
        updatedFeature
      );

      // Update local state
      setFeatureFlags((prev) =>
        prev.map((flag) =>
          flag._id === feature._id
            ? { ...flag, isActive: !flag.isActive }
            : flag
        )
      );

      setSnackbar({
        open: true,
        message: `Feature '${feature.name}' ${
          feature.isActive ? 'disabled' : 'enabled'
        }`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Error toggling feature flag:', error);
      setSnackbar({
        open: true,
        message: 'Error updating feature flag',
        severity: 'error',
      });
    }
  };

  // Close snackbar
  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // If not admin, show access denied
  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h4" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You need super admin permissions to access feature flag management.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Feature Flag Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
        >
          Create Feature Flag
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Filter Feature Flags" />
        <CardContent>
          <GridContainer spacing={2}>
            <GridItem xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  label="Category"
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {CATEGORIES.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </GridItem>
            <GridItem xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Subscription Tier</InputLabel>
                <Select
                  value={filterTier}
                  label="Subscription Tier"
                  onChange={(e) => setFilterTier(e.target.value)}
                >
                  <MenuItem value="all">All Tiers</MenuItem>
                  {SUBSCRIPTION_TIERS.map((tier) => (
                    <MenuItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </GridItem>
          </GridContainer>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Tiers</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFeatureFlags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No feature flags found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredFeatureFlags.map((feature) => (
                  <TableRow key={feature._id}>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={feature.isActive}
                            onChange={() => handleToggleActive(feature)}
                            color="primary"
                          />
                        }
                        label={feature.isActive ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell>{feature.name}</TableCell>
                    <TableCell>
                      <code>{feature.key}</code>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={feature.metadata.category}
                        size="small"
                        color={
                          feature.metadata.category === 'core'
                            ? 'primary'
                            : feature.metadata.category === 'analytics'
                            ? 'secondary'
                            : feature.metadata.category === 'collaboration'
                            ? 'success'
                            : feature.metadata.category === 'integration'
                            ? 'info'
                            : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {feature.allowedTiers.map((tier) => (
                        <Chip
                          key={tier}
                          label={tier}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      {feature.allowedRoles.map((role) => (
                        <Chip
                          key={role}
                          label={role}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleEdit(feature)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleDeleteDialogOpen(feature)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Feature Flag Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? 'Edit Feature Flag' : 'Create Feature Flag'}
        </DialogTitle>
        <DialogContent>
          <GridContainer spacing={3} sx={{ mt: 0 }}>
            <GridItem xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </GridItem>

            <GridItem xs={12} md={6}>
              <TextField
                name="name"
                label="Feature Name"
                fullWidth
                required
                value={formData.name || ''}
                onChange={handleChange}
                helperText="Human-readable name for the feature"
              />
            </GridItem>

            <GridItem xs={12} md={6}>
              <TextField
                name="key"
                label="Feature Key"
                fullWidth
                required
                value={formData.key || ''}
                onChange={handleChange}
                helperText="Unique key used in code (lowercase, no spaces)"
                disabled={isEditing} // Don't allow key changes for existing features
              />
            </GridItem>

            <GridItem xs={12}>
              <TextField
                name="description"
                label="Description"
                fullWidth
                required
                multiline
                rows={2}
                value={formData.description || ''}
                onChange={handleChange}
                helperText="Detailed description of what this feature does"
              />
            </GridItem>

            <GridItem xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="isActive"
                    checked={formData.isActive || false}
                    onChange={handleSwitchChange}
                    color="primary"
                  />
                }
                label="Feature Active"
              />
            </GridItem>

            <GridItem xs={12}>
              <Divider />
            </GridItem>

            <GridItem xs={12}>
              <Typography variant="h6" gutterBottom>
                Access Control
              </Typography>
            </GridItem>

            <GridItem xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel id="allowed-tiers-label">
                  Allowed Subscription Tiers
                </InputLabel>
                <Select
                  labelId="allowed-tiers-label"
                  name="allowedTiers"
                  multiple
                  value={formData.allowedTiers || []}
                  onChange={handleSelectChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {SUBSCRIPTION_TIERS.map((tier) => (
                    <MenuItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </GridItem>

            <GridItem xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="allowed-roles-label">Allowed Roles</InputLabel>
                <Select
                  labelId="allowed-roles-label"
                  name="allowedRoles"
                  multiple
                  value={formData.allowedRoles || []}
                  onChange={handleSelectChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {USER_ROLES.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </GridItem>

            <GridItem xs={12}>
              <Divider />
            </GridItem>

            <GridItem xs={12}>
              <Typography variant="h6" gutterBottom>
                Custom Rules
              </Typography>
            </GridItem>

            <GridItem xs={12} md={6}>
              <TextField
                name="customRules.maxUsers"
                label="Max Users"
                type="number"
                fullWidth
                value={formData.customRules?.maxUsers || ''}
                onChange={handleChange}
                helperText="Maximum users allowed (blank for unlimited)"
              />
            </GridItem>

            <GridItem xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    name="customRules.requiredLicense"
                    checked={formData.customRules?.requiredLicense || false}
                    onChange={handleSwitchChange}
                    color="primary"
                  />
                }
                label="Requires License Verification"
              />
            </GridItem>

            <GridItem xs={12}>
              <Divider />
            </GridItem>

            <GridItem xs={12}>
              <Typography variant="h6" gutterBottom>
                Metadata
              </Typography>
            </GridItem>

            <GridItem xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.metadata?.category || 'core'}
                  label="Category"
                  onChange={handleCategoryChange}
                >
                  {CATEGORIES.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </GridItem>

            <GridItem xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.metadata?.priority || 'medium'}
                  label="Priority"
                  onChange={handlePriorityChange}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </GridItem>

            <GridItem xs={12}>
              <TextField
                label="Tags (press Enter to add)"
                fullWidth
                onKeyDown={handleTagsChange}
                helperText="Add search tags separated by Enter"
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 1 }}>
                {formData.metadata?.tags?.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    sx={{ m: 0.5 }}
                  />
                ))}
              </Box>
            </GridItem>
          </GridContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {isEditing ? 'Save Changes' : 'Create Feature Flag'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the feature flag "
            {selectedFeature?.name}"?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. Any code depending on this feature
            flag may break.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FeatureFlagManagement;
