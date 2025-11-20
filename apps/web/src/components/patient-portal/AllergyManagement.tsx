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
  AlertTriangle,
  Shield,
  X,
  Save,
  Calendar,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SeverityLevel } from '../../types/patientManagement';

interface Allergy {
  _id: string;
  allergen: string;
  reaction: string;
  severity: SeverityLevel;
  recordedDate: string;
  recordedBy?: string;
}

interface AllergyFormData {
  allergen: string;
  reaction: string;
  severity: SeverityLevel;
}

interface AllergyManagementProps {
  allergies: Allergy[];
  loading?: boolean;
  error?: string;
  onAddAllergy: (allergyData: Omit<AllergyFormData, '_id'>) => Promise<void>;
  onUpdateAllergy: (allergyId: string, allergyData: Partial<AllergyFormData>) => Promise<void>;
  onDeleteAllergy: (allergyId: string) => Promise<void>;
  readonly?: boolean;
}

const SEVERITY_LEVELS: { value: SeverityLevel; label: string; color: string }[] = [
  { value: 'mild', label: 'Mild', color: 'success' },
  { value: 'moderate', label: 'Moderate', color: 'warning' },
  { value: 'severe', label: 'Severe', color: 'error' },
];

const COMMON_ALLERGENS = [
  'Penicillin',
  'Aspirin',
  'Ibuprofen',
  'Codeine',
  'Morphine',
  'Sulfa drugs',
  'Latex',
  'Iodine',
  'Shellfish',
  'Nuts',
  'Eggs',
  'Milk',
  'Soy',
  'Wheat',
  'Pollen',
  'Dust mites',
  'Pet dander',
  'Mold',
];

export const AllergyManagement: React.FC<AllergyManagementProps> = ({
  allergies,
  loading = false,
  error,
  onAddAllergy,
  onUpdateAllergy,
  onDeleteAllergy,
  readonly = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  const [formData, setFormData] = useState<AllergyFormData>({
    allergen: '',
    reaction: '',
    severity: 'mild',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!dialogOpen) {
      setFormData({
        allergen: '',
        reaction: '',
        severity: 'mild',
      });
      setFormErrors({});
      setEditingAllergy(null);
    }
  }, [dialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editingAllergy) {
      setFormData({
        allergen: editingAllergy.allergen,
        reaction: editingAllergy.reaction,
        severity: editingAllergy.severity,
      });
    }
  }, [editingAllergy]);

  const handleInputChange = (field: keyof AllergyFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: unknown } }
  ) => {
    const value = event.target.value as string;
    setFormData(prev => ({
      ...prev,
      [field]: value,
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

    if (!formData.allergen.trim()) {
      errors.allergen = 'Allergen is required';
    }

    if (!formData.reaction.trim()) {
      errors.reaction = 'Reaction description is required';
    }

    if (!formData.severity) {
      errors.severity = 'Severity level is required';
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
      if (editingAllergy) {
        await onUpdateAllergy(editingAllergy._id, formData);
      } else {
        await onAddAllergy(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save allergy:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setDialogOpen(true);
  };

  const handleDelete = async (allergyId: string) => {
    try {
      await onDeleteAllergy(allergyId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete allergy:', error);
    }
  };

  const getSeverityColor = (severity: SeverityLevel) => {
    const severityConfig = SEVERITY_LEVELS.find(s => s.value === severity);
    return severityConfig?.color || 'default';
  };

  const getSeverityIcon = (severity: SeverityLevel) => {
    switch (severity) {
      case 'severe':
        return <AlertTriangle className="h-4 w-4" />;
      case 'moderate':
        return <AlertTriangle className="h-4 w-4" />;
      case 'mild':
        return <Shield className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const criticalAllergies = allergies.filter(allergy => allergy.severity === 'severe');

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
            Allergies & Adverse Reactions
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
            Manage your known allergies and adverse drug reactions
          </Typography>
        </Box>
        {!readonly && (
          <Button
            variant="primary"
            onClick={() => setDialogOpen(true)}
            startIcon={<Plus className="h-4 w-4" />}
          >
            Add Allergy
          </Button>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Critical Allergies Alert */}
      {criticalAllergies.length > 0 && (
        <Alert severity="error" className="mb-4">
          <Box className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <Box>
              <Typography variant="subtitle2" className="font-medium">
                Critical Allergies Alert
              </Typography>
              <Typography variant="body2">
                You have {criticalAllergies.length} severe allerg{criticalAllergies.length === 1 ? 'y' : 'ies'} on record. 
                Make sure all healthcare providers are aware of these.
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Allergies List */}
      {allergies.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <Typography variant="h6" className="text-gray-900 dark:text-white mb-2">
            No Allergies Recorded
          </Typography>
          <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
            You haven't recorded any allergies yet. Add any known allergies or adverse reactions to help your healthcare providers provide safer care.
          </Typography>
          {!readonly && (
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Add Your First Allergy
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={3}>
          {allergies.map((allergy) => (
            <Grid item xs={12} md={6} key={allergy._id}>
              <Card className="p-4 h-full">
                <Box className="flex items-start justify-between mb-3">
                  <Box className="flex items-center space-x-2">
                    {getSeverityIcon(allergy.severity)}
                    <Typography variant="h6" className="text-gray-900 dark:text-white font-medium">
                      {allergy.allergen}
                    </Typography>
                  </Box>
                  <Box className="flex items-center space-x-1">
                    <Chip
                      label={allergy.severity}
                      size="small"
                      color={getSeverityColor(allergy.severity) as any}
                      variant="outlined"
                    />
                    {!readonly && (
                      <>
                        <Tooltip title="Edit allergy">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(allergy)}
                          >
                            <Edit className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete allergy">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmId(allergy._id)}
                            color="error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </Box>

                <Typography variant="body2" className="text-gray-700 dark:text-gray-300 mb-3">
                  <strong>Reaction:</strong> {allergy.reaction}
                </Typography>

                <Box className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  Recorded: {new Date(allergy.recordedDate).toLocaleDateString()}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Allergy Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box className="flex items-center justify-between">
            <Typography variant="h6">
              {editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box className="space-y-4 pt-2">
            <Input
              label="Allergen"
              value={formData.allergen}
              onChange={handleInputChange('allergen')}
              error={formErrors.allergen}
              required
              helperText="Name of the substance you're allergic to"
              list="common-allergens"
            />
            <datalist id="common-allergens">
              {COMMON_ALLERGENS.map((allergen) => (
                <option key={allergen} value={allergen} />
              ))}
            </datalist>

            <Input
              label="Reaction"
              value={formData.reaction}
              onChange={handleInputChange('reaction')}
              error={formErrors.reaction}
              required
              multiline
              rows={3}
              helperText="Describe the reaction you experience (e.g., rash, swelling, difficulty breathing)"
            />

            <Input
              label="Severity Level"
              select
              value={formData.severity}
              onChange={handleInputChange('severity')}
              error={formErrors.severity}
              required
              SelectProps={{ native: true }}
              helperText="How severe is this allergic reaction?"
            >
              {SEVERITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </Input>

            <Alert severity="info">
              <Typography variant="body2">
                <strong>Severity Guidelines:</strong>
                <br />
                • <strong>Mild:</strong> Minor symptoms like skin irritation or mild nausea
                <br />
                • <strong>Moderate:</strong> More noticeable symptoms that may require treatment
                <br />
                • <strong>Severe:</strong> Life-threatening reactions requiring immediate medical attention
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
            {editingAllergy ? 'Update Allergy' : 'Add Allergy'}
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
            Are you sure you want to delete this allergy record? This action cannot be undone.
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

export default AllergyManagement;