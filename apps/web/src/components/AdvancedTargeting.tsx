import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  Checkbox,
  ListItemText,
  Chip,
  Grid,
  Slider,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Paper,
  Divider,
} from '@mui/material';
import {
  Tune as TuneIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  Percent as PercentIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { FeatureFlag } from '../services/featureFlagService';
import enhancedFeatureFlagService, { 
  TargetingRules as ServiceTargetingRules, 
  UsageMetrics as ServiceUsageMetrics,
  EnhancedFeatureFlag as ServiceEnhancedFeatureFlag 
} from '../services/enhancedFeatureFlagService';

// Enhanced interfaces for advanced functionality
interface TargetingRules {
  pharmacies?: string[];
  userGroups?: string[];
  percentage?: number;
  conditions?: {
    dateRange?: {
      startDate: string;
      endDate: string;
    };
  };
}

interface UsageMetrics {
  totalUsers: number;
  activeUsers: number;
  usagePercentage: number;
  lastUsed: string;
  usageByPlan?: Array<{
    plan: string;
    userCount: number;
    percentage: number;
  }>;
  usageByWorkspace?: Array<{
    workspaceId: string;
    workspaceName: string;
    userCount: number;
  }>;
}

interface EnhancedFeatureFlag extends FeatureFlag {
  targetingRules?: TargetingRules;
  usageMetrics?: UsageMetrics;
  metadata?: {
    category?: string;
    priority?: string;
    tags?: string[];
    displayOrder?: number;
    marketingDescription?: string;
    isMarketingFeature?: boolean;
    icon?: string;
  };
}

interface AdvancedTargetingProps {
  features: FeatureFlag[];
  onUpdate: () => void;
}

interface TargetingDialogProps {
  open: boolean;
  feature: EnhancedFeatureFlag | null;
  onClose: () => void;
  onSave: (featureId: string, targetingRules: TargetingRules) => void;
}

const TargetingDialog: React.FC<TargetingDialogProps> = ({
  open,
  feature,
  onClose,
  onSave,
}) => {
  const [targetingRules, setTargetingRules] = useState<TargetingRules>({
    percentage: 100,
    pharmacies: [],
    userGroups: [],
  });

  // Mock data - replace with actual API calls
  const availablePharmacies = [
    { id: 'pharmacy1', name: 'Central Pharmacy Lagos' },
    { id: 'pharmacy2', name: 'City Pharmacy Abuja' },
    { id: 'pharmacy3', name: 'Metro Pharmacy Port Harcourt' },
  ];

  const availableUserGroups = [
    'pharmacist',
    'pharmacy_team',
    'pharmacy_outlet',
    'owner',
  ];

  useEffect(() => {
    if (feature?.targetingRules) {
      setTargetingRules({
        percentage: feature.targetingRules.percentage || 100,
        pharmacies: feature.targetingRules.pharmacies || [],
        userGroups: feature.targetingRules.userGroups || [],
        conditions: feature.targetingRules.conditions,
      });
    } else {
      setTargetingRules({
        percentage: 100,
        pharmacies: [],
        userGroups: [],
      });
    }
  }, [feature]);

  const handleSave = () => {
    if (feature) {
      onSave(feature._id, targetingRules);
      onClose();
    }
  };

  const handlePercentageChange = (_: Event, value: number | number[]) => {
    setTargetingRules(prev => ({
      ...prev,
      percentage: Array.isArray(value) ? value[0] : value,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon />
          Configure Targeting Rules - {feature?.name}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {/* Percentage Rollout */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Percentage Rollout: {targetingRules.percentage}%
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={targetingRules.percentage || 100}
                  onChange={handlePercentageChange}
                  min={0}
                  max={100}
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={targetingRules.percentage || 0}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {targetingRules.percentage === 100 
                  ? 'Feature available to all eligible users'
                  : `Feature available to ${targetingRules.percentage}% of eligible users`
                }
              </Typography>
            </Grid>

            {/* Pharmacy Targeting */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Target Pharmacies</InputLabel>
                <Select
                  multiple
                  value={targetingRules.pharmacies || []}
                  onChange={(e) => setTargetingRules(prev => ({
                    ...prev,
                    pharmacies: e.target.value as string[]
                  }))}
                  label="Target Pharmacies"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip 
                          key={value} 
                          label={availablePharmacies.find(p => p.id === value)?.name || value}
                          size="small" 
                        />
                      ))}
                    </Box>
                  )}
                >
                  {availablePharmacies.map((pharmacy) => (
                    <MenuItem key={pharmacy.id} value={pharmacy.id}>
                      <Checkbox checked={(targetingRules.pharmacies || []).includes(pharmacy.id)} />
                      <ListItemText primary={pharmacy.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* User Group Targeting */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Target User Groups</InputLabel>
                <Select
                  multiple
                  value={targetingRules.userGroups || []}
                  onChange={(e) => setTargetingRules(prev => ({
                    ...prev,
                    userGroups: e.target.value as string[]
                  }))}
                  label="Target User Groups"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableUserGroups.map((group) => (
                    <MenuItem key={group} value={group}>
                      <Checkbox checked={(targetingRules.userGroups || []).includes(group)} />
                      <ListItemText primary={group} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Date Range (Future Enhancement) */}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Coming Soon:</strong> Time-based targeting rules will allow you to schedule feature availability for specific date ranges.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Targeting Rules
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AdvancedTargeting: React.FC<AdvancedTargetingProps> = ({ features, onUpdate }) => {
  const [targetingDialogOpen, setTargetingDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<EnhancedFeatureFlag | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<string | null>(null);
  const [featureMetrics, setFeatureMetrics] = useState<Record<string, UsageMetrics>>({});

  const handleConfigureTargeting = (feature: FeatureFlag) => {
    setSelectedFeature(feature as EnhancedFeatureFlag);
    setTargetingDialogOpen(true);
  };

  const handleSaveTargeting = async (featureId: string, targetingRules: TargetingRules) => {
    try {
      await enhancedFeatureFlagService.updateTargetingRules(featureId, targetingRules);
      toast.success('Targeting rules updated successfully');
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update targeting rules');
      console.error('Error updating targeting rules:', error);
    }
  };

  const handleViewMetrics = async (feature: FeatureFlag) => {
    setMetricsLoading(feature._id);
    try {
      const metrics = await enhancedFeatureFlagService.getFeatureMetrics(feature._id);
      setFeatureMetrics(prev => ({
        ...prev,
        [feature._id]: metrics,
      }));
      toast.success('Metrics loaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch metrics');
      console.error('Error fetching metrics:', error);
    } finally {
      setMetricsLoading(null);
    }
  };

  const getTargetingStatus = (feature: EnhancedFeatureFlag) => {
    const rules = feature.targetingRules;
    if (!rules) return { status: 'No targeting', color: 'default' as const };
    
    if (rules.percentage && rules.percentage < 100) {
      return { status: `${rules.percentage}% rollout`, color: 'warning' as const };
    }
    
    if (rules.pharmacies?.length || rules.userGroups?.length) {
      return { status: 'Targeted', color: 'info' as const };
    }
    
    return { status: 'Full rollout', color: 'success' as const };
  };

  if (features.length === 0) {
    return (
      <Alert severity="info">
        No features available. Create features in the Features tab first.
      </Alert>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Advanced Targeting & Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure advanced targeting rules and view usage analytics for your features.
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Feature</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Targeting Status</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {features.map((feature) => {
                  const enhancedFeature = feature as EnhancedFeatureFlag;
                  const targetingStatus = getTargetingStatus(enhancedFeature);
                  const metrics = featureMetrics[feature._id];

                  return (
                    <TableRow key={feature._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            {feature.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {feature.key}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={enhancedFeature.metadata?.category || 'core'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={targetingStatus.status}
                          size="small"
                          color={targetingStatus.color}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell>
                        {metrics ? (
                          <Box>
                            <Typography variant="body2">
                              {metrics.activeUsers}/{metrics.totalUsers} users
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={metrics.usagePercentage}
                              sx={{ mt: 0.5, height: 4 }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Click to load
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Configure Targeting">
                            <IconButton
                              size="small"
                              onClick={() => handleConfigureTargeting(feature)}
                            >
                              <TuneIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Metrics">
                            <IconButton
                              size="small"
                              onClick={() => handleViewMetrics(feature)}
                              disabled={metricsLoading === feature._id}
                            >
                              {metricsLoading === feature._id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <AnalyticsIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Targeting Configuration Dialog */}
      <TargetingDialog
        open={targetingDialogOpen}
        feature={selectedFeature}
        onClose={() => setTargetingDialogOpen(false)}
        onSave={handleSaveTargeting}
      />
    </Box>
  );
};

export default AdvancedTargeting;