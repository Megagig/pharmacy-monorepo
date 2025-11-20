import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import type { AllergyInputProps } from '../types';

// Common allergens categorized
const COMMON_ALLERGENS = {
  medications: [
    'Penicillin',
    'Amoxicillin',
    'Ampicillin',
    'Aspirin',
    'Ibuprofen',
    'Naproxen',
    'Sulfonamides',
    'Codeine',
    'Morphine',
    'Latex',
    'Iodine',
    'Contrast dye',
  ],
  foods: [
    'Peanuts',
    'Tree nuts',
    'Shellfish',
    'Fish',
    'Eggs',
    'Milk',
    'Wheat',
    'Soy',
    'Sesame',
  ],
  environmental: [
    'Dust mites',
    'Pollen',
    'Pet dander',
    'Mold',
    'Insect stings',
    'Bee stings',
    'Wasp stings',
  ],
};

const ALL_ALLERGENS = [
  ...COMMON_ALLERGENS.medications,
  ...COMMON_ALLERGENS.foods,
  ...COMMON_ALLERGENS.environmental,
];

const SEVERITY_LEVELS = [
  {
    value: 'mild',
    label: 'Mild',
    color: 'success' as const,
    description: 'Minor symptoms, not life-threatening',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    color: 'warning' as const,
    description: 'Significant symptoms requiring treatment',
  },
  {
    value: 'severe',
    label: 'Severe',
    color: 'error' as const,
    description: 'Life-threatening, requires immediate attention',
  },
];

const REACTION_TYPES = [
  'Skin rash',
  'Hives',
  'Itching',
  'Swelling',
  'Difficulty breathing',
  'Wheezing',
  'Nausea',
  'Vomiting',
  'Diarrhea',
  'Anaphylaxis',
  'Dizziness',
  'Fainting',
  'Other',
];

interface AllergyData {
  substance: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction?: string;
  notes?: string;
}

interface AllergyFormData {
  allergies: AllergyData[];
}

interface AllergyDialogData {
  substance: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction: string;
  customReaction: string;
  notes: string;
}

const AllergyInput: React.FC<AllergyInputProps> = ({
  value = [],
  onChange,
  error,
  disabled = false,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'medications' | 'foods' | 'environmental'
  >('all');

  // Convert string array to allergy objects for internal use
  const allergyObjects: AllergyData[] = React.useMemo(() => {
    return value.map((allergen) => {
      if (typeof allergen === 'string') {
        return { substance: allergen, severity: 'mild' as const };
      }
      return allergen as AllergyData;
    });
  }, [value]);

  const { control, watch } = useForm<AllergyFormData>({
    defaultValues: {
      allergies: allergyObjects,
    },
  });

  const watchedAllergies = watch('allergies');

  // Update parent component when allergies change
  React.useEffect(() => {
    // Convert back to string array for backward compatibility
    const allergyStrings = watchedAllergies.map((allergy) => allergy.substance);
    onChange(allergyStrings);
  }, [watchedAllergies, onChange]);

  // Dialog form
  const {
    control: dialogControl,
    handleSubmit: handleDialogSubmit,
    reset: resetDialog,
    watch: watchDialog,
    formState: { errors: dialogErrors },
  } = useForm<AllergyDialogData>({
    defaultValues: {
      substance: '',
      severity: 'mild',
      reaction: '',
      customReaction: '',
      notes: '',
    },
  });

  const watchedDialogValues = watchDialog();

  const handleOpenDialog = useCallback(
    (allergy?: AllergyData, index?: number) => {
      if (allergy) {
        resetDialog({
          substance: allergy.substance,
          severity: allergy.severity,
          reaction:
            allergy.reaction && REACTION_TYPES.includes(allergy.reaction)
              ? allergy.reaction
              : 'Other',
          customReaction:
            allergy.reaction && !REACTION_TYPES.includes(allergy.reaction)
              ? allergy.reaction
              : '',
          notes: allergy.notes || '',
        });
        setEditingIndex(index ?? null);
      } else {
        resetDialog({
          substance: '',
          severity: 'mild',
          reaction: '',
          customReaction: '',
          notes: '',
        });
        setEditingIndex(null);
      }
      setIsDialogOpen(true);
    },
    [resetDialog]
  );

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingIndex(null);
    resetDialog();
  }, [resetDialog]);

  const handleSaveAllergy = useCallback(
    (data: AllergyDialogData) => {
      const reaction =
        data.reaction === 'Other' ? data.customReaction : data.reaction;

      const allergy: AllergyData = {
        substance: data.substance.trim(),
        severity: data.severity,
        reaction: reaction.trim() || undefined,
        notes: data.notes.trim() || undefined,
      };

      const updatedAllergies = [...watchedAllergies];

      if (editingIndex !== null) {
        updatedAllergies[editingIndex] = allergy;
      } else {
        updatedAllergies.push(allergy);
      }

      // Update form state (this will trigger the useEffect to update parent)
      const event = { target: { value: updatedAllergies } };
      const field = {
        onChange: (allergies: AllergyData[]) => {
          // Manually update the form state
          const allergyStrings = allergies.map((a) => a.substance);
          onChange(allergyStrings);
        },
      };
      field.onChange(updatedAllergies);

      handleCloseDialog();
    },
    [watchedAllergies, editingIndex, onChange, handleCloseDialog]
  );

  const handleRemoveAllergy = useCallback(
    (index: number) => {
      const updatedAllergies = watchedAllergies.filter((_, i) => i !== index);
      const allergyStrings = updatedAllergies.map((a) => a.substance);
      onChange(allergyStrings);
    },
    [watchedAllergies, onChange]
  );

  const handleQuickAddAllergy = useCallback(
    (substance: string) => {
      if (!value.includes(substance)) {
        onChange([...value, substance]);
      }
    },
    [value, onChange]
  );

  // Filter allergens based on search and category
  const getFilteredAllergens = () => {
    let allergens: string[] = [];

    switch (selectedCategory) {
      case 'medications':
        allergens = COMMON_ALLERGENS.medications;
        break;
      case 'foods':
        allergens = COMMON_ALLERGENS.foods;
        break;
      case 'environmental':
        allergens = COMMON_ALLERGENS.environmental;
        break;
      default:
        allergens = ALL_ALLERGENS;
    }

    return allergens.filter(
      (allergen) =>
        allergen.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !value.includes(allergen)
    );
  };

  const getSeverityColor = (severity: string) => {
    const level = SEVERITY_LEVELS.find((l) => l.value === severity);
    return level?.color || 'default';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'severe') {
      return <WarningIcon sx={{ fontSize: 16, color: 'error.main' }} />;
    }
    return null;
  };

  // Validation
  const validateSubstance = (substance: string): string | true => {
    if (!substance.trim()) {
      return 'Allergy substance is required';
    }
    if (substance.trim().length < 2) {
      return 'Substance name must be at least 2 characters';
    }
    return true;
  };

  const validateReaction = (
    reaction: string,
    customReaction: string
  ): string | true => {
    if (reaction === 'Other' && !customReaction.trim()) {
      return 'Please specify the reaction';
    }
    return true;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Allergies & Adverse Reactions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Document known allergies and adverse drug reactions for safety
            screening
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Current Allergies */}
        {allergyObjects.length > 0 ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Recorded Allergies ({allergyObjects.length})
            </Typography>
            <Stack spacing={2}>
              {allergyObjects.map((allergy, index) => (
                <Card key={index} variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <LocalHospitalIcon
                          sx={{ mr: 1, color: 'primary.main', fontSize: 20 }}
                        />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {allergy.substance}
                        </Typography>
                        {getSeverityIcon(allergy.severity)}
                        <Chip
                          label={
                            SEVERITY_LEVELS.find(
                              (l) => l.value === allergy.severity
                            )?.label
                          }
                          size="small"
                          color={getSeverityColor(allergy.severity)}
                          variant="outlined"
                          sx={{ ml: 1 }}
                        />
                      </Box>
                      {allergy.reaction && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5 }}
                        >
                          <strong>Reaction:</strong> {allergy.reaction}
                        </Typography>
                      )}
                      {allergy.notes && (
                        <Typography variant="body2" color="text.secondary">
                          <strong>Notes:</strong> {allergy.notes}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit allergy">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(allergy, index)}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove allergy">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveAllergy(index)}
                          disabled={disabled}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Stack>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              No allergies recorded. If the patient has no known allergies, this
              is noted. Add any known allergies to prevent adverse reactions.
            </Typography>
          </Alert>
        )}

        {/* Add Allergy Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={disabled}
          >
            Add Allergy
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Quick Add Common Allergens */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            Quick Add Common Allergens
          </Typography>

          {/* Category Filter */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mb: 2,
            }}
          >
            <TextField
              size="small"
              placeholder="Search allergens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                },
              }}
              disabled={disabled}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                label="Category"
                disabled={disabled}
              >
                <MenuItem value="all">All Categories</MenuItem>
                <MenuItem value="medications">Medications</MenuItem>
                <MenuItem value="foods">Foods</MenuItem>
                <MenuItem value="environmental">Environmental</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Allergen Chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {getFilteredAllergens()
              .slice(0, 20)
              .map((allergen) => (
                <Chip
                  key={allergen}
                  label={allergen}
                  onClick={() => handleQuickAddAllergy(allergen)}
                  disabled={disabled}
                  sx={{ cursor: 'pointer' }}
                  variant="outlined"
                  size="small"
                />
              ))}
          </Box>

          {getFilteredAllergens().length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {searchTerm
                ? `No allergens found matching "${searchTerm}"`
                : 'All common allergens have been added'}
            </Typography>
          )}
        </Box>

        {/* Allergy Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <LocalHospitalIcon sx={{ mr: 1 }} />
              {editingIndex !== null ? 'Edit Allergy' : 'Add Allergy'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleDialogSubmit(handleSaveAllergy)}>
              <Stack spacing={3}>
                {/* Substance */}
                <Controller
                  name="substance"
                  control={dialogControl}
                  rules={{ validate: validateSubstance }}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      options={ALL_ALLERGENS}
                      freeSolo
                      value={field.value}
                      onChange={(_, value) => field.onChange(value || '')}
                      onInputChange={(_, value) => field.onChange(value)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Allergy Substance"
                          placeholder="Enter or search allergen"
                          error={!!dialogErrors.substance}
                          helperText={dialogErrors.substance?.message}
                          required
                        />
                      )}
                    />
                  )}
                />

                {/* Severity */}
                <Controller
                  name="severity"
                  control={dialogControl}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Severity</InputLabel>
                      <Select {...field} label="Severity">
                        {SEVERITY_LEVELS.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Chip
                                label={level.label}
                                size="small"
                                color={level.color}
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {level.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                {/* Reaction */}
                <Box>
                  <Controller
                    name="reaction"
                    control={dialogControl}
                    rules={{
                      validate: (value) =>
                        validateReaction(
                          value,
                          watchedDialogValues.customReaction
                        ),
                    }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!dialogErrors.reaction}>
                        <InputLabel>Reaction Type (Optional)</InputLabel>
                        <Select {...field} label="Reaction Type (Optional)">
                          <MenuItem value="">
                            <em>Not specified</em>
                          </MenuItem>
                          {REACTION_TYPES.map((reaction) => (
                            <MenuItem key={reaction} value={reaction}>
                              {reaction}
                            </MenuItem>
                          ))}
                        </Select>
                        {dialogErrors.reaction && (
                          <FormHelperText>
                            {dialogErrors.reaction.message}
                          </FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />

                  {watchedDialogValues.reaction === 'Other' && (
                    <Controller
                      name="customReaction"
                      control={dialogControl}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Specify Reaction"
                          placeholder="Describe the allergic reaction"
                          fullWidth
                          sx={{ mt: 2 }}
                          error={!!dialogErrors.customReaction}
                          helperText={dialogErrors.customReaction?.message}
                        />
                      )}
                    />
                  )}
                </Box>

                {/* Notes */}
                <Controller
                  name="notes"
                  control={dialogControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Additional Notes (Optional)"
                      placeholder="Any additional information about this allergy"
                      multiline
                      rows={2}
                      fullWidth
                    />
                  )}
                />

                {/* Severity Warning */}
                {watchedDialogValues.severity === 'severe' && (
                  <Alert severity="error">
                    <Typography variant="body2">
                      <strong>Severe Allergy Warning:</strong> This allergy will
                      be prominently flagged during medication prescribing and
                      clinical assessments to prevent life-threatening
                      reactions.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </form>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleDialogSubmit(handleSaveAllergy)}
              variant="contained"
            >
              {editingIndex !== null ? 'Update' : 'Add'} Allergy
            </Button>
          </DialogActions>
        </Dialog>

        {/* Summary and Warnings */}
        {allergyObjects.length > 0 && (
          <Box sx={{ mt: 3 }}>
            {allergyObjects.some((a) => a.severity === 'severe') && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Critical Allergies Detected:</strong> This patient has
                  severe allergies that require immediate attention during
                  medication prescribing and treatment planning.
                </Typography>
              </Alert>
            )}

            <Alert severity="success">
              <Typography variant="body2">
                <strong>Allergy Summary:</strong> {allergyObjects.length} allerg
                {allergyObjects.length > 1 ? 'ies' : 'y'} recorded. This
                information will be used for drug interaction and
                contraindication checking.
              </Typography>
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AllergyInput;
