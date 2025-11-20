/**
 * Patient Engagement Feature Flags Management Component
 * 
 * Allows administrators to manage patient engagement feature flags
 * with gradual rollout controls and usage monitoring.
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  Slider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Chip,
  Grid,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import featureFlagService from '../../services/featureFlagService';

// Patient Engagement Feature Flag Keys
const PATIENT_ENGAGEMENT_FLAGS = {
  MODULE: 'patient_engagement_module',
  APPOINTMENTS: 'appointment_scheduling',
  FOLLOW_UPS: 'followup_task_management',
  REMINDERS: 'smart_reminder_system',
  PATIENT_PORTAL: 'patient_portal',
  RECURRING_APPOINTMENTS: 'recurring_appointments',
  CLINICAL_ALERTS: 'clinical_alerts',
  ANALYTICS: 'engagement_analytics',
  SCHEDULE_MANAGEMENT: 'schedule_management',
  MODULE_INTEGRATION: 'engagement_module_integration'
} as const;

interface FeatureFlag {
  _id: string;
  name: string;
  key: string;
  description: string;
  isActive: boolean;
  allowedTiers: string[];
  allowedRoles: string[];
  targetingRules?: {
    percentage: number;
    pharmacies?: string[];
    userGroups?: string[];
    conditions?: any;
  };
  usageMetrics?: {
    totalUsers: number;
    activeUsers: number;
    usagePercentage: number;
    lastUsed?: string;
  };
  metadata?: {
    category: string;
    priority: string;
    tags: string[];
    marketingDescription?: string;
    isMarketingFeature?: boolean;
    icon?: string;
  };
}

interface RolloutDialogProps {
  open: boolean;
  onClose: () => void;
  featureFlag: FeatureFlag | null;
  onSave: (flagId: string, percentage: number, conditions?: any) => void;
}

const RolloutDialog: React.FC<RolloutDialogProps> = ({
  open,
  onClose,
  featureFlag,
  onSave,
}) => {
  const [percentage, setPercentage] = useState(0);
  const [conditions, setConditions] = useState<any>({});

  React.useEffect(() => {
    if (featureFlag) {
      setPercentage(featureFlag.targetingRules?.percentage || 0);
      setConditions(featureFlag.targetingRules?.conditions || {});
    }
  }, [featureFlag]);

  const handleSave = () => {
    if (featureFlag) {
      onSave(featureFlag._id, percentage, conditions);
      onClose();
    }
  };

  const getRolloutStage = (percent: number) => {
    if (percent === 0) return { stage: 'Disabled', color: 'error' as const };
    if (percent <= 10) return { stage: 'Beta Testing', color: 'warning' as const };
    if (percent <= 25) return { stage: 'Limited Rollout', color: 'info' as const };
    if (percent <= 50) return { stage: 'Gradual Rollout', color: 'primary' as const };
    if (percent < 100) return { stage: 'Wide Rollout', color: 'success' as const };
    return { stage: 'Full Rollout', color: 'success' as const };
  };

  const rolloutStage = getRolloutStage(percentage);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Configure Rollout: {featureFlag?.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {featureFlag?.description}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography gutterBottom>
              Rollout Percentage: {percentage}%
            </Typography>
            <Slider
              value={percentage}
              onChange={(_, value) => setPercentage(value as number)}
              step={5}
              marks={[
                { value: 0, label: '0%' },
                { value: 10, label: '10%' },
                { value: 25, label: '25%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' },
              ]}
              min={0}
              max={100}
              valueLabelDisplay="auto"
            />
            <Box sx={{ mt: 1 }}>
              <Chip
                label={rolloutStage.stage}
                color={rolloutStage.color}
                size="small"
              />
            </Box>
          </Box>

          {percentage > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                This feature will be enabled for approximately {percentage}% of users.
                Users are selected consistently based on their ID hash.
              </Typography>
            </Alert>
          )}

          {percentage === 100 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                This feature will be enabled for all users in allowed tiers and roles.
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Allowed Tiers
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {featureFlag?.allowedTiers.map((tier) => (
                    <Chip key={tier} label={tier} size="small" sx={{ mr: 1 }} />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Allowed Roles
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {featureFlag?.allowedRoles.map((role) => (
                    <Chip key={role} label={role} size="small" sx={{ mr: 1 }} />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Rollout Configuration
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PatientEngagementFeatureFlags: React.FC = () => {
  const [rolloutDialogOpen, setRolloutDialogOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Fetch patient engagement feature flags
  const { data: featureFlags, isLoading, error } = useQuery({
    queryKey: ['featureFlags', 'patient_engagement'],
    queryFn: async () => {
      const response = await featureFlagService.getAllFeatureFlags();
      // Filter for patient engagement flags
      return response.data.filter((flag: FeatureFlag) => 
        Object.values(PATIENT_ENGAGEMENT_FLAGS).includes(flag.key as any)
      );
    },
  });

  // Update feature flag mutation
  const updateFeatureFlagMutation = useMutation({
    mutationFn: async ({ flagId, updates }: { flagId: string; updates: any }) => {
      return featureFlagService.updateFeatureFlag(flagId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
      enqueueSnackbar('Feature flag updated successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(`Failed to update feature flag: ${error.message}`, { variant: 'error' });
    },
  });

  const handleToggleFeature = async (flagId: string, isActive: boolean) => {
    updateFeatureFlagMutation.mutate({
      flagId,
      updates: { isActive }
    });
  };

  const handleConfigureRollout = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setRolloutDialogOpen(true);
  };

  const handleSaveRollout = (flagId: string, percentage: number, conditions?: any) => {
    updateFeatureFlagMutation.mutate({
      flagId,
      updates: {
        targetingRules: {
          percentage,
          conditions
        }
      }
    });
  };

  const getStatusIcon = (flag: FeatureFlag) => {
    if (!flag.isActive) {
      return <CancelIcon color="error" />;
    }
    
    const percentage = flag.targetingRules?.percentage || 0;
    if (percentage === 0) {
      return <WarningIcon color="warning" />;
    }
    if (percentage === 100) {
      return <CheckCircleIcon color="success" />;
    }
    return <TrendingUpIcon color="primary" />;
  };

  const getStatusText = (flag: FeatureFlag) => {
    if (!flag.isActive) return 'Disabled';
    
    const percentage = flag.targetingRules?.percentage || 0;
    if (percentage === 0) return 'Enabled (0% rollout)';
    if (percentage === 100) return 'Fully Enabled';
    return `${percentage}% Rollout`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Patient Engagement Feature Flags
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load feature flags: {(error as Error).message}
        </Alert>
      </Box>
    );
  }

  const coreFeatures = featureFlags?.filter((flag: FeatureFlag) => 
    flag.metadata?.priority === 'high'
  ) || [];
  
  const additionalFeatures = featureFlags?.filter((flag: FeatureFlag) => 
    flag.metadata?.priority !== 'high'
  ) || [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Patient Engagement Feature Flags
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage the rollout of patient engagement features with gradual deployment controls.
      </Typography>

      {/* Core Features */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Core Features</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {coreFeatures.map((flag: FeatureFlag) => (
              <Grid item xs={12} md={6} key={flag._id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getStatusIcon(flag)}
                      <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                        {flag.name}
                      </Typography>
                      <Chip
                        label={flag.metadata?.priority}
                        color={getPriorityColor(flag.metadata?.priority || 'medium')}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {flag.description}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={flag.isActive}
                            onChange={(e) => handleToggleFeature(flag._id, e.target.checked)}
                            disabled={updateFeatureFlagMutation.isPending}
                          />
                        }
                        label={getStatusText(flag)}
                      />
                    </Box>

                    {flag.isActive && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Rollout Progress
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={flag.targetingRules?.percentage || 0}
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {flag.targetingRules?.percentage || 0}% of eligible users
                        </Typography>
                      </Box>
                    )}

                    {flag.usageMetrics && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Usage: {flag.usageMetrics.activeUsers} active users
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<SettingsIcon />}
                        onClick={() => handleConfigureRollout(flag)}
                        disabled={updateFeatureFlagMutation.isPending}
                      >
                        Configure Rollout
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Additional Features */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Additional Features</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Feature</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Rollout</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {additionalFeatures.map((flag: FeatureFlag) => (
                  <TableRow key={flag._id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {flag.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {flag.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getStatusIcon(flag)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {getStatusText(flag)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ minWidth: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={flag.targetingRules?.percentage || 0}
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="caption">
                          {flag.targetingRules?.percentage || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {flag.usageMetrics?.activeUsers || 0} users
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Switch
                          size="small"
                          checked={flag.isActive}
                          onChange={(e) => handleToggleFeature(flag._id, e.target.checked)}
                          disabled={updateFeatureFlagMutation.isPending}
                        />
                        <Tooltip title="Configure Rollout">
                          <IconButton
                            size="small"
                            onClick={() => handleConfigureRollout(flag)}
                            disabled={updateFeatureFlagMutation.isPending}
                          >
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Rollout Configuration Dialog */}
      <RolloutDialog
        open={rolloutDialogOpen}
        onClose={() => setRolloutDialogOpen(false)}
        featureFlag={selectedFlag}
        onSave={handleSaveRollout}
      />

      {/* Rollout Guidelines */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Rollout Guidelines
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  Recommended Rollout Stages:
                </Typography>
                <Typography variant="body2">
                  1. Beta Testing (10%) - Internal testing<br/>
                  2. Limited Rollout (25%) - Selected customers<br/>
                  3. Gradual Rollout (50%) - Wider deployment<br/>
                  4. Full Rollout (100%) - All eligible users
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={12} md={6}>
              <Alert severity="warning">
                <Typography variant="body2" fontWeight="medium">
                  Important Notes:
                </Typography>
                <Typography variant="body2">
                  • Monitor error rates during rollout<br/>
                  • Core module must be enabled first<br/>
                  • Some features depend on others<br/>
                  • Users are selected consistently by ID hash
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientEngagementFeatureFlags;