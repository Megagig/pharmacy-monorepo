import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
// import { extractResults } from '../utils/apiHelpers';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';

import {
  usePatientAllergies,
  useCreateAllergy,
  useUpdateAllergy,
  useDeleteAllergy,
} from '../queries/usePatients';
import type {
  Allergy,
  SeverityLevel,
  CreateAllergyData,
  UpdateAllergyData,
} from '../types/patientManagement';

interface AllergyManagementProps {
  patientId: string;
}

interface AllergyFormData {
  substance: string;
  reaction?: string;
  severity?: SeverityLevel;
  notedAt?: Date;
}

const SEVERITY_LEVELS: {
  value: SeverityLevel;
  label: string;
  color: 'success' | 'warning' | 'error';
}[] = [
  { value: 'mild', label: 'Mild', color: 'success' },
  { value: 'moderate', label: 'Moderate', color: 'warning' },
  { value: 'severe', label: 'Severe', color: 'error' },
];

const COMMON_ALLERGENS = [
  'Penicillin',
  'Amoxicillin',
  'Aspirin',
  'Ibuprofen',
  'Sulfonamides',
  'Codeine',
  'Morphine',
  'Latex',
  'Peanuts',
  'Shellfish',
  'Eggs',
  'Milk',
  'Wheat',
  'Soy',
  'Tree nuts',
  'Fish',
  'Dust mites',
  'Pollen',
  'Pet dander',
  'Insect stings',
];

const AllergyManagement: React.FC<AllergyManagementProps> = ({ patientId }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAllergy, setSelectedAllergy] = useState<Allergy | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>(
    'all'
  );

  // React Query hooks
  const {
    data: allergiesResponse,
    isLoading,
    isError,
    error,
  } = usePatientAllergies(patientId);
  const createAllergyMutation = useCreateAllergy();
  const updateAllergyMutation = useUpdateAllergy();
  const deleteAllergyMutation = useDeleteAllergy();

  const allergies = allergiesResponse?.data?.results || [];

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<AllergyFormData>({
    defaultValues: {
      substance: '',
      reaction: '',
      severity: 'mild',
      notedAt: new Date(),
    },
  });

  // Filtered allergies
  const filteredAllergies = allergies.filter((allergy: Allergy) => {
    const matchesSearch = allergy.substance
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesSeverity =
      severityFilter === 'all' || allergy.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  // Event handlers
  const handleOpenDialog = (allergy?: Allergy) => {
    if (allergy) {
      setSelectedAllergy(allergy);
      reset({
        substance: allergy.substance,
        reaction: allergy.reaction || '',
        severity: allergy.severity || 'mild',
        notedAt: allergy.notedAt ? new Date(allergy.notedAt) : new Date(),
      });
    } else {
      setSelectedAllergy(null);
      reset({
        substance: '',
        reaction: '',
        severity: 'mild',
        notedAt: new Date(),
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAllergy(null);
    reset();
  };

  const handleSaveAllergy = async (formData: AllergyFormData) => {
    try {
      const allergyData: CreateAllergyData | UpdateAllergyData = {
        substance: formData.substance.trim(),
        reaction: formData.reaction?.trim() || undefined,
        severity: formData.severity,
        notedAt: formData.notedAt?.toISOString(),
      };

      if (selectedAllergy) {
        // Update existing allergy
        await updateAllergyMutation.mutateAsync({
          allergyId: selectedAllergy._id,
          allergyData: allergyData as UpdateAllergyData,
        });
      } else {
        // Create new allergy
        await createAllergyMutation.mutateAsync({
          patientId,
          allergyData: allergyData as CreateAllergyData,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving allergy:', error);
    }
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this allergy? This action cannot be undone.'
      )
    ) {
      try {
        await deleteAllergyMutation.mutateAsync(allergyId);
      } catch (error) {
        console.error('Error deleting allergy:', error);
      }
    }
  };

  const handleCommonAllergenSelect = (substance: string) => {
    setValue('substance', substance);
  };

  const getSeverityColor = (
    severity?: SeverityLevel
  ): 'success' | 'warning' | 'error' | 'default' => {
    const severityConfig = SEVERITY_LEVELS.find((s) => s.value === severity);
    return (
      (severityConfig?.color as 'success' | 'warning' | 'error') || 'default'
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Failed to load allergies</Typography>
        <Typography variant="body2">
          {error instanceof Error
            ? error.message
            : 'Unable to retrieve allergy information.'}
        </Typography>
      </Alert>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LocalHospitalIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Allergy Management
            </Typography>
            {allergies.length > 0 && (
              <Chip
                label={`${allergies.length} record${
                  allergies.length > 1 ? 's' : ''
                }`}
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={
              createAllergyMutation.isPending ||
              updateAllergyMutation.isPending ||
              deleteAllergyMutation.isPending
            }
          >
            Add Allergy
          </Button>
        </Box>

        {/* Filters and Search */}
        {allergies.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 250 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search allergies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />
                      ),
                    }}
                  />
                </Box>
                <Box sx={{ minWidth: 200 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity Filter</InputLabel>
                    <Select
                      value={severityFilter}
                      onChange={(e) =>
                        setSeverityFilter(
                          e.target.value as SeverityLevel | 'all'
                        )
                      }
                      label="Severity Filter"
                    >
                      <MenuItem value="all">All Severities</MenuItem>
                      {SEVERITY_LEVELS.map((level) => (
                        <MenuItem key={level.value} value={level.value}>
                          {level.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ minWidth: 150 }}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredAllergies.length} of {allergies.length} shown
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Allergies List */}
        {filteredAllergies.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <LocalHospitalIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                {searchTerm || severityFilter !== 'all'
                  ? 'No matching allergies found'
                  : 'No allergies recorded'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm || severityFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add allergies to help ensure patient safety and appropriate medication selection'}
              </Typography>
              {!searchTerm && severityFilter === 'all' && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Allergy
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Substance</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Reaction</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Severity</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Noted Date</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAllergies.map((allergy: Allergy) => (
                  <TableRow key={allergy._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {allergy.substance}
                        </Typography>
                        {allergy.severity === 'severe' && (
                          <WarningIcon
                            sx={{ ml: 1, color: 'error.main', fontSize: 20 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {allergy.reaction || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          SEVERITY_LEVELS.find(
                            (s) => s.value === allergy.severity
                          )?.label || 'Unknown'
                        }
                        size="small"
                        color={getSeverityColor(allergy.severity)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(allergy.notedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Tooltip title="Edit Allergy">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(allergy)}
                            disabled={
                              createAllergyMutation.isPending ||
                              updateAllergyMutation.isPending ||
                              deleteAllergyMutation.isPending
                            }
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Allergy">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAllergy(allergy._id)}
                            disabled={
                              createAllergyMutation.isPending ||
                              updateAllergyMutation.isPending ||
                              deleteAllergyMutation.isPending
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Add/Edit Allergy Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 },
          }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <LocalHospitalIcon sx={{ mr: 1 }} />
              {selectedAllergy ? 'Edit Allergy' : 'Add New Allergy'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleSubmit(handleSaveAllergy)}>
              <Stack spacing={3}>
                {/* Substance Field */}
                <Controller
                  name="substance"
                  control={control}
                  rules={{
                    required: 'Allergy substance is required',
                    minLength: {
                      value: 2,
                      message: 'Substance name must be at least 2 characters',
                    },
                    maxLength: {
                      value: 100,
                      message: 'Substance name cannot exceed 100 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Allergy Substance"
                      placeholder="e.g., Penicillin, Peanuts, Latex"
                      error={!!errors.substance}
                      helperText={errors.substance?.message}
                      required
                      fullWidth
                    />
                  )}
                />

                {/* Common Allergens Quick Select */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, color: 'text.secondary' }}
                  >
                    Common Allergens (click to select):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {COMMON_ALLERGENS.slice(0, 12).map((allergen) => (
                      <Chip
                        key={allergen}
                        label={allergen}
                        size="small"
                        onClick={() => handleCommonAllergenSelect(allergen)}
                        sx={{ cursor: 'pointer' }}
                        variant={
                          watch('substance') === allergen
                            ? 'filled'
                            : 'outlined'
                        }
                        color={
                          watch('substance') === allergen
                            ? 'primary'
                            : 'default'
                        }
                      />
                    ))}
                  </Box>
                </Box>

                <Divider />

                {/* Reaction Field */}
                <Controller
                  name="reaction"
                  control={control}
                  rules={{
                    maxLength: {
                      value: 200,
                      message:
                        'Reaction description cannot exceed 200 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Reaction (Optional)"
                      placeholder="e.g., rash, difficulty breathing, swelling"
                      multiline
                      rows={2}
                      error={!!errors.reaction}
                      helperText={
                        errors.reaction?.message ||
                        "Describe the patient's allergic reaction"
                      }
                      fullWidth
                    />
                  )}
                />

                {/* Severity and Date */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2,
                  }}
                >
                  <Controller
                    name="severity"
                    control={control}
                    render={({ field }) => (
                      <FormControl error={!!errors.severity} fullWidth>
                        <InputLabel>Severity</InputLabel>
                        <Select {...field} label="Severity">
                          {SEVERITY_LEVELS.map((level) => (
                            <MenuItem key={level.value} value={level.value}>
                              <Box
                                sx={{ display: 'flex', alignItems: 'center' }}
                              >
                                <Chip
                                  label={level.label}
                                  size="small"
                                  color={level.color}
                                  variant="outlined"
                                  sx={{ mr: 1, minWidth: 65 }}
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.severity && (
                          <FormHelperText>
                            {errors.severity.message}
                          </FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="notedAt"
                    control={control}
                    render={({ field }) => (
                      <DateTimePicker
                        {...field}
                        label="Date Noted"
                        maxDateTime={new Date()}
                        slotProps={{
                          textField: {
                            error: !!errors.notedAt,
                            helperText: errors.notedAt?.message,
                            fullWidth: true,
                          },
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Severity Warning */}
                {watch('severity') === 'severe' && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Severe Allergy Warning:</strong> This allergy will
                      be prominently displayed in the patient's profile and
                      flagged during medication prescribing to ensure patient
                      safety.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </form>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(handleSaveAllergy)}
              variant="contained"
              disabled={isSubmitting}
              sx={{ minWidth: 100 }}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedAllergy
                ? 'Update'
                : 'Add Allergy'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AllergyManagement;
