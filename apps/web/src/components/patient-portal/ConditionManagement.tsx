import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Plus,
  Edit,
  Trash2,
  Activity,
  CheckCircle,
  Clock,
  Pause,
  X,
  Save,
  Calendar,
  FileText,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface Condition {
  _id: string;
  name: string;
  onsetDate?: string;
  status: 'active' | 'resolved' | 'remission';
  notes?: string;
  recordedDate: string;
  recordedBy?: string;
}

interface ConditionFormData {
  name: string;
  onsetDate?: string;
  status: 'active' | 'resolved' | 'remission';
  notes?: string;
}

interface ConditionManagementProps {
  conditions: Condition[];
  loading?: boolean;
  error?: string;
  onAddCondition: (conditionData: Omit<ConditionFormData, '_id'>) => Promise<void>;
  onUpdateCondition: (conditionId: string, conditionData: Partial<ConditionFormData>) => Promise<void>;
  onDeleteCondition: (conditionId: string) => Promise<void>;
  readonly?: boolean;
}

const CONDITION_STATUSES: { value: Condition['status']; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'active', label: 'Active', color: 'error', icon: <Activity className="h-4 w-4" /> },
  { value: 'remission', label: 'In Remission', color: 'warning', icon: <Pause className="h-4 w-4" /> },
  { value: 'resolved', label: 'Resolved', color: 'success', icon: <CheckCircle className="h-4 w-4" /> },
];

const COMMON_CONDITIONS = [
  'Hypertension',
  'Diabetes Type 2',
  'Diabetes Type 1',
  'High Cholesterol',
  'Asthma',
  'COPD',
  'Arthritis',
  'Depression',
  'Anxiety',
  'Migraine',
  'Gastroesophageal Reflux Disease (GERD)',
  'Osteoporosis',
  'Thyroid Disorder',
  'Heart Disease',
  'Kidney Disease',
  'Liver Disease',
  'Epilepsy',
  'Chronic Pain',
  'Sleep Apnea',
  'Allergic Rhinitis',
];

export const ConditionManagement: React.FC<ConditionManagementProps> = ({
  conditions,
  loading = false,
  error,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
  readonly = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null);
  const [formData, setFormData] = useState<ConditionFormData>({
    name: '',
    onsetDate: '',
    status: 'active',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!dialogOpen) {
      setFormData({
        name: '',
        onsetDate: '',
        status: 'active',
        notes: '',
      });
      setFormErrors({});
      setEditingCondition(null);
    }
  }, [dialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editingCondition) {
      setFormData({
        name: editingCondition.name,
        onsetDate: editingCondition.onsetDate || '',
        status: editingCondition.status,
        notes: editingCondition.notes || '',
      });
    }
  }, [editingCondition]);

  const handleInputChange = (field: keyof ConditionFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value as string;
    setFormData(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value,
    }));

    // Clear validation error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Condition name is required';
    }

    if (!formData.status) {
      errors.status = 'Status is required';
    }

    // Validate onset date if provided
    if (formData.onsetDate) {
      const onsetDate = new Date(formData.onsetDate);
      const today = new Date();
      
      if (onsetDate > today) {
        errors.onsetDate = 'Onset date cannot be in the future';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingCondition) {
        await onUpdateCondition(editingCondition._id, formData);
      } else {
        await onAddCondition(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save condition:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (condition: Condition) => {
    setEditingCondition(condition);
    setDialogOpen(true);
  };

  const handleDelete = async (conditionId: string) => {
    try {
      await onDeleteCondition(conditionId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete condition:', error);
    }
  };

  const getStatusConfig = (status: Condition['status']) => {
    return CONDITION_STATUSES.find(s => s.value === status) || CONDITION_STATUSES[0];
  };

  const calculateDuration = (onsetDate: string): string => {
    if (!onsetDate) return '';
    
    const onset = new Date(onsetDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - onset.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months === 1 ? '' : 's'}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      if (remainingMonths === 0) {
        return `${years} year${years === 1 ? '' : 's'}`;
      }
      return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
    }
  };

  const activeConditions = conditions.filter(condition => condition.status === 'active');
  const inactiveConditions = conditions.filter(condition => condition.status !== 'active');

  if (loading) {
    return (
      <Box className="flex justify-center items-center py-8">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box className="flex items-center justify-between mb-6">
        <Box>
          <Typography variant="h6" className="text-gray-900 dark:text-white font-semibold">
            Chronic Conditions
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
            Manage your ongoing health conditions and medical history
          </Typography>
        </Box>
        {!readonly && (
          <Button
            variant="primary"
            onClick={() => setDialogOpen(true)}
            startIcon={<Plus className="h-4 w-4" />}
          >
            Add Condition
          </Button>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Active Conditions Alert */}
      {activeConditions.length > 0 && (
        <Alert severity="info" className="mb-4">
          <Box className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <Box>
              <Typography variant="subtitle2" className="font-medium">
                Active Conditions
              </Typography>
              <Typography variant="body2">
                You have {activeConditions.length} active condition{activeConditions.length === 1 ? '' : 's'} that may require ongoing management.
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Conditions List */}
      {conditions.length === 0 ? (
        <Card className="p-8 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-2">
            No Conditions Recorded
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
            You haven't recorded any chronic conditions yet. Add any ongoing health conditions to help your healthcare providers provide better care.
          </Typography>
          {!readonly && (
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add Your First Condition
            </Button>
          )}
        </Card>
      ) : (
        <Box className="space-y-6">
          {/* Active Conditions */}
          {activeConditions.length > 0 && (
            <Box>
              <Typography variant="subtitle1" className="text-gray-900 dark:text-white font-medium mb-3">
                Active Conditions ({activeConditions.length})
              </Typography>
              <Grid container spacing={3}>
                {activeConditions.map((condition) => (
                  <Grid item xs={12} md={6} key={condition._id}>
                    <Card className="p-4 h-full border-l-4 border-red-500">
                      <Box className="flex items-start justify-between mb-3">
                        <Box className="flex items-center space-x-2">
                          {getStatusConfig(condition.status).icon}
                          <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
                            {condition.name}
                          </Typography>
                        </Box>
                        <Box className="flex items-center space-x-1">
                          <Chip
                            label={getStatusConfig(condition.status).label}
                            size="small"
                            color={getStatusConfig(condition.status).color as any}
                            variant="outlined"
                          />
                          {!readonly && (
                            <>
                              <Tooltip title="Edit condition">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(condition)}
                                >
                                  <Edit className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete condition">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteConfirmId(condition._id)}
                                  color="error"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Box>

                      {condition.onsetDate && (
                        <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Duration:</strong> {calculateDuration(condition.onsetDate)}
                        </Typography>
                      )}

                      {condition.notes && (
                        <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-3">
                          <strong>Notes:</strong> {condition.notes}
                        </Typography>
                      )}

                      <Box className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-sm">
                        <Box className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {condition.onsetDate ? (
                            <>Onset: {new Date(condition.onsetDate).toLocaleDateString()}</>
                          ) : (
                            <>Recorded: {new Date(condition.recordedDate).toLocaleDateString()}</>
                          )}
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Inactive Conditions */}
          {inactiveConditions.length > 0 && (
            <Box>
              <Typography variant="subtitle1" className="text-gray-900 dark:text-white font-medium mb-3">
                Previous Conditions ({inactiveConditions.length})
              </Typography>
              <Grid container spacing={3}>
                {inactiveConditions.map((condition) => (
                  <Grid item xs={12} md={6} key={condition._id}>
                    <Card className="p-4 h-full opacity-75">
                      <Box className="flex items-start justify-between mb-3">
                        <Box className="flex items-center space-x-2">
                          {getStatusConfig(condition.status).icon}
                          <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
                            {condition.name}
                          </Typography>
                        </Box>
                        <Box className="flex items-center space-x-1">
                          <Chip
                            label={getStatusConfig(condition.status).label}
                            size="small"
                            color={getStatusConfig(condition.status).color as any}
                            variant="outlined"
                          />
                          {!readonly && (
                            <>
                              <Tooltip title="Edit condition">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(condition)}
                                >
                                  <Edit className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete condition">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteConfirmId(condition._id)}
                                  color="error"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </Box>

                      {condition.onsetDate && (
                        <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-2">
                          <strong>Duration:</strong> {calculateDuration(condition.onsetDate)}
                        </Typography>
                      )}

                      {condition.notes && (
                        <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-3">
                          <strong>Notes:</strong> {condition.notes}
                        </Typography>
                      )}

                      <Box className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-sm">
                        <Box className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {condition.onsetDate ? (
                            <>Onset: {new Date(condition.onsetDate).toLocaleDateString()}</>
                          ) : (
                            <>Recorded: {new Date(condition.recordedDate).toLocaleDateString()}</>
                          )}
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      {/* Add/Edit Condition Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box className="flex items-center justify-between">
            <Typography variant="h6">
              {editingCondition ? 'Edit Condition' : 'Add New Condition'}
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box className="space-y-4 pt-2">
            <Input
              label="Condition Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              error={formErrors.name}
              required
              helperText="Name of the medical condition"
              list="common-conditions"
            />
            <datalist id="common-conditions">
              {COMMON_CONDITIONS.map((condition) => (
                <option key={condition} value={condition} />
              ))}
            </datalist>

            <Input
              label="Onset Date"
              type="date"
              value={formData.onsetDate || ''}
              onChange={handleInputChange('onsetDate')}
              error={formErrors.onsetDate}
              helperText="When did this condition first start? (optional)"
              InputLabelProps={{ shrink: true }}
            />

            <Input
              label="Status"
              select
              value={formData.status}
              onChange={handleInputChange('status')}
              error={formErrors.status}
              required
              SelectProps={{ native: true }}
              helperText="Current status of this condition"
            >
              {CONDITION_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Input>

            <Input
              label="Notes"
              value={formData.notes || ''}
              onChange={handleInputChange('notes')}
              multiline
              rows={3}
              helperText="Additional notes about this condition (optional)"
            />

            <Alert severity="info">
              <Typography variant="body2">
                <strong>Status Guidelines:</strong>
                <br />
                • <strong>Active:</strong> Currently experiencing symptoms or requiring treatment
                <br />
                • <strong>In Remission:</strong> Condition is controlled but may return
                <br />
                • <strong>Resolved:</strong> Condition has been cured or no longer affects you
              </Typography>
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            startIcon={<Save className="h-4 w-4" />}
          >
            {editingCondition ? 'Update Condition' : 'Add Condition'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this condition record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outline"
            onClick={() => setDeleteConfirmId(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConditionManagement;