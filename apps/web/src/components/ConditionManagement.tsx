import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { extractResults } from '../utils/apiHelpers';
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
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import InfoIcon from '@mui/icons-material/Info';

import {
  usePatientConditions,
  useCreateCondition,
  useUpdateCondition,
  useDeleteCondition,
} from '../queries/usePatients';
import type {
  Condition,
  CreateConditionData,
  UpdateConditionData,
} from '../types/patientManagement';

interface ConditionManagementProps {
  patientId: string;
}

interface ConditionFormData {
  name: string;
  snomedId?: string;
  onsetDate?: Date;
  status: 'active' | 'resolved' | 'remission';
  notes?: string;
}

type ConditionStatus = 'active' | 'resolved' | 'remission';

const CONDITION_STATUSES: {
  value: ConditionStatus;
  label: string;
  color: 'success' | 'warning' | 'info' | 'error';
  icon: React.ReactElement;
}[] = [
  {
    value: 'active',
    label: 'Active',
    color: 'error',
    icon: <WarningIcon />,
  },
  {
    value: 'remission',
    label: 'In Remission',
    color: 'warning',
    icon: <PauseCircleIcon />,
  },
  {
    value: 'resolved',
    label: 'Resolved',
    color: 'success',
    icon: <CheckCircleIcon />,
  },
];

// Common medical conditions with SNOMED CT codes
const COMMON_CONDITIONS = [
  { name: 'Hypertension', snomedId: '38341003' },
  { name: 'Diabetes mellitus', snomedId: '73211009' },
  { name: 'Asthma', snomedId: '195967001' },
  { name: 'Chronic obstructive pulmonary disease', snomedId: '13645005' },
  { name: 'Malaria', snomedId: '61462000' },
  { name: 'Typhoid fever', snomedId: '4834000' },
  { name: 'Gastroenteritis', snomedId: '25374005' },
  { name: 'Upper respiratory tract infection', snomedId: '54150009' },
  { name: 'Pneumonia', snomedId: '233604007' },
  { name: 'Urinary tract infection', snomedId: '68566005' },
  { name: 'Hepatitis B', snomedId: '66071002' },
  { name: 'Sickle cell disease', snomedId: '417357006' },
  { name: 'Peptic ulcer disease', snomedId: '13200003' },
  { name: 'Arthritis', snomedId: '3723001' },
  { name: 'Migraine', snomedId: '37796009' },
  { name: 'Depression', snomedId: '35489007' },
  { name: 'Anxiety disorder', snomedId: '48694002' },
  { name: 'Chronic kidney disease', snomedId: '709044004' },
  { name: 'Heart failure', snomedId: '84114007' },
  { name: 'Stroke', snomedId: '230690007' },
];

const ConditionManagement: React.FC<ConditionManagementProps> = ({
  patientId,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConditionStatus | 'all'>(
    'all'
  );

  // React Query hooks
  const {
    data: conditionsResponse,
    isLoading,
    isError,
    error,
  } = usePatientConditions(patientId);
  const createConditionMutation = useCreateCondition();
  const updateConditionMutation = useUpdateCondition();
  const deleteConditionMutation = useDeleteCondition();

  const conditions = extractResults(conditionsResponse);

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ConditionFormData>({
    defaultValues: {
      name: '',
      snomedId: '',
      onsetDate: undefined,
      status: 'active',
      notes: '',
    },
  });

  // Filtered conditions
  const filteredConditions = (conditions as Condition[]).filter(
    (condition: Condition) => {
      const matchesSearch = condition.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || condition.status === statusFilter;
      return matchesSearch && matchesStatus;
    }
  );

  // Event handlers
  const handleOpenDialog = (condition?: Condition) => {
    if (condition) {
      setSelectedCondition(condition);
      reset({
        name: condition.name,
        snomedId: condition.snomedId || '',
        onsetDate: condition.onsetDate
          ? new Date(condition.onsetDate)
          : undefined,
        status: condition.status,
        notes: condition.notes || '',
      });
    } else {
      setSelectedCondition(null);
      reset({
        name: '',
        snomedId: '',
        onsetDate: undefined,
        status: 'active',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCondition(null);
    reset();
  };

  const handleSaveCondition = async (formData: ConditionFormData) => {
    try {
      const conditionData: CreateConditionData | UpdateConditionData = {
        name: formData.name.trim(),
        snomedId: formData.snomedId?.trim() || undefined,
        onsetDate: formData.onsetDate
          ? formData.onsetDate.toISOString()
          : undefined,
        status: formData.status,
        notes: formData.notes?.trim() || undefined,
      };

      if (selectedCondition) {
        // Update existing condition
        await updateConditionMutation.mutateAsync({
          conditionId: selectedCondition._id,
          conditionData: conditionData as UpdateConditionData,
        });
      } else {
        // Create new condition
        await createConditionMutation.mutateAsync({
          patientId,
          conditionData: conditionData as CreateConditionData,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving condition:', error);
    }
  };

  const handleDeleteCondition = async (conditionId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this condition? This action cannot be undone.'
      )
    ) {
      try {
        await deleteConditionMutation.mutateAsync(conditionId);
      } catch (error) {
        console.error('Error deleting condition:', error);
      }
    }
  };

  const handleCommonConditionSelect = (condition: {
    name: string;
    snomedId: string;
  }) => {
    setValue('name', condition.name);
    setValue('snomedId', condition.snomedId);
  };

  const getStatusConfig = (status: ConditionStatus) => {
    return (
      CONDITION_STATUSES.find((s) => s.value === status) ||
      CONDITION_STATUSES[0]
    );
  };

  const validateSnomedId = (snomedId: string): boolean => {
    if (!snomedId) return true; // Optional field
    // SNOMED CT ID validation: 6-18 digits
    return /^\d{6,18}$/.test(snomedId);
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
        <Typography variant="h6">Failed to load conditions</Typography>
        <Typography variant="body2">
          {error instanceof Error
            ? error.message
            : 'Unable to retrieve condition information.'}
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
            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Condition Management
            </Typography>
            {conditions.length > 0 && (
              <Chip
                label={`${conditions.length} condition${
                  conditions.length > 1 ? 's' : ''
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
              createConditionMutation.isPending ||
              updateConditionMutation.isPending ||
              deleteConditionMutation.isPending
            }
          >
            Add Condition
          </Button>
        </Box>

        {/* Filters and Search */}
        {conditions.length > 0 && (
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
                    placeholder="Search conditions..."
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
                    <InputLabel>Status Filter</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(
                          e.target.value as ConditionStatus | 'all'
                        )
                      }
                      label="Status Filter"
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      {CONDITION_STATUSES.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                mr: 1,
                                display: 'flex',
                                fontSize: '0.8rem',
                              }}
                            >
                              {status.icon}
                            </Box>
                            {status.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ minWidth: 150 }}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredConditions.length} of {conditions.length} shown
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Conditions List */}
        {filteredConditions.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <PersonIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'No matching conditions found'
                  : 'No conditions recorded'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Document patient conditions to maintain comprehensive medical records'}
              </Typography>
              {!searchTerm && statusFilter === 'all' && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add First Condition
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
                    <strong>Condition Name</strong>
                  </TableCell>
                  <TableCell>
                    <strong>SNOMED CT ID</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Onset Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Notes</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(filteredConditions as Condition[]).map(
                  (condition: Condition) => {
                    const statusConfig = getStatusConfig(condition.status);
                    return (
                      <TableRow key={condition._id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {condition.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {condition.snomedId ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography
                                variant="body2"
                                sx={{ fontFamily: 'monospace', mr: 1 }}
                              >
                                {condition.snomedId}
                              </Typography>
                              <Tooltip title="SNOMED CT standardized medical terminology">
                                <InfoIcon
                                  sx={{ fontSize: 14, color: 'info.main' }}
                                />
                              </Tooltip>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusConfig.label}
                            size="small"
                            color={statusConfig.color}
                            variant="outlined"
                            icon={statusConfig.icon}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(condition.onsetDate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {condition.notes || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="Edit Condition">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(condition)}
                                disabled={
                                  createConditionMutation.isPending ||
                                  updateConditionMutation.isPending ||
                                  deleteConditionMutation.isPending
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Condition">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  handleDeleteCondition(condition._id)
                                }
                                disabled={
                                  createConditionMutation.isPending ||
                                  updateConditionMutation.isPending ||
                                  deleteConditionMutation.isPending
                                }
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Add/Edit Condition Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2 },
          }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <PersonIcon sx={{ mr: 1 }} />
              {selectedCondition ? 'Edit Condition' : 'Add New Condition'}
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
            <Box component="form" onSubmit={handleSubmit(handleSaveCondition)}>
              <Stack spacing={3}>
                {/* Condition Name */}
                <Controller
                  name="name"
                  control={control}
                  rules={{
                    required: 'Condition name is required',
                    minLength: {
                      value: 2,
                      message: 'Condition name must be at least 2 characters',
                    },
                    maxLength: {
                      value: 100,
                      message: 'Condition name cannot exceed 100 characters',
                    },
                  }}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      options={COMMON_CONDITIONS}
                      getOptionLabel={(option) =>
                        typeof option === 'string' ? option : option.name
                      }
                      freeSolo
                      value={field.value}
                      onChange={(_, newValue) => {
                        if (typeof newValue === 'string') {
                          field.onChange(newValue);
                        } else if (newValue) {
                          handleCommonConditionSelect(newValue);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Condition Name"
                          placeholder="e.g., Hypertension, Diabetes"
                          error={!!errors.name}
                          helperText={errors.name?.message}
                          required
                          fullWidth
                        />
                      )}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <li key={key} {...otherProps}>
                            <Box>
                              <Typography variant="body2">
                                {option.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontFamily: 'monospace' }}
                              >
                                SNOMED: {option.snomedId}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                    />
                  )}
                />

                {/* SNOMED CT ID */}
                <Controller
                  name="snomedId"
                  control={control}
                  rules={{
                    validate: (value) =>
                      !value ||
                      validateSnomedId(value) ||
                      'Invalid SNOMED CT ID format (6-18 digits)',
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="SNOMED CT Identifier"
                      placeholder="e.g., 38341003"
                      error={!!errors.snomedId}
                      helperText={
                        errors.snomedId?.message ||
                        'Optional: SNOMED CT standardized medical terminology code'
                      }
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <InfoIcon sx={{ color: 'info.main' }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <Divider />

                {/* Status and Date */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2,
                  }}
                >
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <FormControl error={!!errors.status} fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select {...field} label="Status">
                          {CONDITION_STATUSES.map((status) => (
                            <MenuItem key={status.value} value={status.value}>
                              <Box
                                sx={{ display: 'flex', alignItems: 'center' }}
                              >
                                <Box sx={{ mr: 1, display: 'flex' }}>
                                  {status.icon}
                                </Box>
                                <Chip
                                  label={status.label}
                                  size="small"
                                  color={status.color}
                                  variant="outlined"
                                  sx={{ mr: 1 }}
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.status && (
                          <FormHelperText>
                            {errors.status.message}
                          </FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="onsetDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        {...field}
                        label="Onset Date"
                        maxDate={new Date()}
                        slotProps={{
                          textField: {
                            error: !!errors.onsetDate,
                            helperText:
                              errors.onsetDate?.message ||
                              'When condition started',
                            fullWidth: true,
                          },
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Notes */}
                <Controller
                  name="notes"
                  control={control}
                  rules={{
                    maxLength: {
                      value: 500,
                      message: 'Notes cannot exceed 500 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Clinical Notes"
                      placeholder="Additional information about the condition..."
                      multiline
                      rows={3}
                      error={!!errors.notes}
                      helperText={
                        errors.notes?.message ||
                        'Optional: Additional clinical information or observations'
                      }
                      fullWidth
                    />
                  )}
                />

                {/* Status Information */}
                {watch('status') && (
                  <Alert
                    severity={
                      watch('status') === 'active'
                        ? 'warning'
                        : watch('status') === 'resolved'
                        ? 'success'
                        : 'info'
                    }
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      <strong>
                        {getStatusConfig(watch('status')).label} Status:
                      </strong>{' '}
                      {watch('status') === 'active' &&
                        'This condition is currently active and may require ongoing treatment.'}
                      {watch('status') === 'resolved' &&
                        'This condition has been resolved and is no longer active.'}
                      {watch('status') === 'remission' &&
                        'This condition is in remission - symptoms are reduced or absent but may return.'}
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(handleSaveCondition)}
              variant="contained"
              disabled={isSubmitting}
              sx={{ minWidth: 120 }}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedCondition
                ? 'Update'
                : 'Add Condition'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ConditionManagement;
