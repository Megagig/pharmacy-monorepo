import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchIcon from '@mui/icons-material/Search';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

import { RBACGuard } from '../hooks/useRBAC';

import {
  usePatientDTPs,
  useCreateDTP,
  useUpdateDTP,
} from '../queries/usePatientResources';
import type {
  DrugTherapyProblem,
  DTPType,
  CreateDTPData,
  UpdateDTPData,
} from '../types/patientManagement';

interface DTPManagementProps {
  patientId: string;
}

interface DTPFormData {
  type: DTPType;
  description?: string;
  status: 'unresolved' | 'resolved';
}

const DTP_TYPES: { value: DTPType; label: string; description: string }[] = [
  {
    value: 'unnecessary',
    label: 'Unnecessary Therapy',
    description: 'Patient receiving drug therapy that is not needed',
  },
  {
    value: 'wrongDrug',
    label: 'Improper Drug Selection',
    description: 'Wrong drug chosen for the condition or patient',
  },
  {
    value: 'doseTooLow',
    label: 'Sub-therapeutic Dosage',
    description: 'Dose is too low to achieve therapeutic effect',
  },
  {
    value: 'doseTooHigh',
    label: 'Overdosage',
    description: 'Dose is too high, potentially causing harm',
  },
  {
    value: 'adverseReaction',
    label: 'Adverse Drug Reaction',
    description: 'Patient experiencing unwanted effects from medication',
  },
  {
    value: 'inappropriateAdherence',
    label: 'Non-adherence',
    description: 'Patient not taking medication as prescribed',
  },
  {
    value: 'needsAdditional',
    label: 'Untreated Condition',
    description:
      'Patient has a condition requiring drug therapy but is not receiving it',
  },
];

const DTPManagement: React.FC<DTPManagementProps> = ({ patientId }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDTP, setSelectedDTP] = useState<DrugTherapyProblem | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'unresolved' | 'resolved'
  >('all');

  // RBAC permissions
  // const {} = useRBAC(); // TODO: Add specific permissions when needed

  // React Query hooks
  const {
    data: dtpsResponse,
    isLoading,
    isError,
    error,
  } = usePatientDTPs(patientId);
  const createDTPMutation = useCreateDTP();
  const updateDTPMutation = useUpdateDTP();

  const dtps = dtpsResponse?.data?.results || [];

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<DTPFormData>({
    defaultValues: {
      type: 'untreated_condition',
      description: '',
      status: 'unresolved',
    },
  });

  // Filtered DTPs
  const filteredDTPs = dtps.filter((dtp: DrugTherapyProblem) => {
    const matchesSearch =
      DTP_TYPES.find((t) => t.value === dtp.type)
        ?.label.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (dtp.description &&
        dtp.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || dtp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (dtp?: DrugTherapyProblem) => {
    if (dtp) {
      setSelectedDTP(dtp);
      reset({
        type: dtp.type,
        description: dtp.description || '',
        status: dtp.status,
      });
    } else {
      setSelectedDTP(null);
      reset({
        type: 'untreated_condition',
        description: '',
        status: 'unresolved',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedDTP(null);
    reset();
  };

  const handleSaveDTP = async (formData: DTPFormData) => {
    try {
      const dtpData: CreateDTPData | UpdateDTPData = {
        type: formData.type,
        description: formData.description?.trim() || undefined,
        status: formData.status,
      };

      if (selectedDTP) {
        await updateDTPMutation.mutateAsync({
          dtpId: selectedDTP._id,
          dtpData: dtpData as UpdateDTPData,
        });
      } else {
        await createDTPMutation.mutateAsync({
          patientId,
          dtpData: dtpData as CreateDTPData,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving DTP:', error);
    }
  };

  const getDTPTypeInfo = (type: DTPType) => {
    return DTP_TYPES.find((t) => t.value === type) || DTP_TYPES[0];
  };

  const getStatusColor = (
    status: 'unresolved' | 'resolved'
  ): 'error' | 'success' => {
    return status === 'resolved' ? 'success' : 'error';
  };

  const getDTPSeverityColor = (type: DTPType): 'error' | 'warning' | 'info' => {
    switch (type) {
      case 'overdosage':
      case 'adverse_drug_reaction':
        return 'error';
      case 'drug_interaction':
      case 'untreated_condition':
        return 'warning';
      default:
        return 'info';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Stats
  const unresolvedCount = dtps.filter(
    (dtp: DrugTherapyProblem) => dtp.status === 'unresolved'
  ).length;
  const resolvedCount = dtps.filter(
    (dtp: DrugTherapyProblem) => dtp.status === 'resolved'
  ).length;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Failed to load DTPs</Typography>
        <Typography variant="body2">
          {error instanceof Error
            ? error.message
            : 'Unable to retrieve DTP information.'}
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
            <ReportProblemIcon sx={{ mr: 1, color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Drug Therapy Problems
            </Typography>
            {unresolvedCount > 0 && (
              <Chip
                label={`${unresolvedCount} unresolved`}
                size="small"
                color="error"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
          <RBACGuard action="canCreate">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Report DTP
            </Button>
          </RBACGuard>
        </Box>

        {/* Statistics Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Card sx={{ flex: 1, textAlign: 'center', p: 2 }}>
            <ErrorIcon color="error" sx={{ fontSize: 24, mb: 1 }} />
            <Typography variant="h6">{unresolvedCount}</Typography>
            <Typography variant="body2" color="text.secondary">
              Unresolved DTPs
            </Typography>
          </Card>
          <Card sx={{ flex: 1, textAlign: 'center', p: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 24, mb: 1 }} />
            <Typography variant="h6">{resolvedCount}</Typography>
            <Typography variant="body2" color="text.secondary">
              Resolved DTPs
            </Typography>
          </Card>
          <Card sx={{ flex: 1, textAlign: 'center', p: 2 }}>
            <ReportProblemIcon color="primary" sx={{ fontSize: 24, mb: 1 }} />
            <Typography variant="h6">{dtps.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              Total DTPs
            </Typography>
          </Card>
        </Stack>

        {/* Filters */}
        {dtps.length > 0 && (
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
                    placeholder="Search DTPs..."
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
                  <ToggleButtonGroup
                    value={statusFilter}
                    exclusive
                    onChange={(_, newFilter) =>
                      newFilter && setStatusFilter(newFilter)
                    }
                    size="small"
                  >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="unresolved">Unresolved</ToggleButton>
                    <ToggleButton value="resolved">Resolved</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredDTPs.length} of {dtps.length} shown
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* DTPs List */}
        {filteredDTPs.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <ReportProblemIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'No matching DTPs found'
                  : 'No drug therapy problems recorded'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Monitor and document drug therapy problems to optimize patient care'}
              </Typography>
              {!searchTerm && statusFilter === 'all' && (
                <RBACGuard action="canCreate">
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                  >
                    Report First DTP
                  </Button>
                </RBACGuard>
              )}
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Type</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Description</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Status</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Reported</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDTPs.map((dtp: DrugTherapyProblem) => {
                  const typeInfo = getDTPTypeInfo(dtp.type);
                  return (
                    <TableRow key={dtp._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {typeInfo.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={typeInfo.label}
                            color={getDTPSeverityColor(dtp.type)}
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dtp.description || typeInfo.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            dtp.status === 'resolved'
                              ? 'Resolved'
                              : 'Unresolved'
                          }
                          size="small"
                          color={getStatusColor(dtp.status)}
                          icon={
                            dtp.status === 'resolved' ? (
                              <CheckCircleIcon />
                            ) : (
                              <WarningIcon />
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(dtp.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <RBACGuard action="canUpdate">
                            <Tooltip title="Edit DTP">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(dtp)}
                                disabled={
                                  createDTPMutation.isPending ||
                                  updateDTPMutation.isPending
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </RBACGuard>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Add/Edit DTP Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <ReportProblemIcon sx={{ mr: 1 }} />
              {selectedDTP ? 'Edit Drug Therapy Problem' : 'Report New DTP'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleSubmit(handleSaveDTP)}>
              <Stack spacing={3}>
                {/* DTP Type */}
                <Controller
                  name="type"
                  control={control}
                  rules={{ required: 'DTP type is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.type}>
                      <InputLabel>DTP Type</InputLabel>
                      <Select {...field} label="DTP Type">
                        {DTP_TYPES.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {type.label}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {type.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                {/* Description */}
                <Controller
                  name="description"
                  control={control}
                  rules={{
                    maxLength: {
                      value: 500,
                      message: 'Description cannot exceed 500 characters',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Detailed Description"
                      placeholder="Provide specific details about this drug therapy problem..."
                      multiline
                      rows={4}
                      fullWidth
                      error={!!errors.description}
                      helperText={
                        errors.description?.message ||
                        'Optional: Add specific details about the problem and its context'
                      }
                    />
                  )}
                />

                {/* Status */}
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="unresolved">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <WarningIcon color="error" sx={{ mr: 1 }} />
                            Unresolved - Requires attention
                          </Box>
                        </MenuItem>
                        <MenuItem value="resolved">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                            Resolved - Problem addressed
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />

                {/* Problem Type Information */}
                {watch('type') && (
                  <Alert
                    severity={
                      getDTPSeverityColor(watch('type')) === 'error'
                        ? 'error'
                        : 'info'
                    }
                    sx={{ mt: 2 }}
                  >
                    <Typography variant="body2">
                      <strong>{getDTPTypeInfo(watch('type')).label}:</strong>{' '}
                      {getDTPTypeInfo(watch('type')).description}
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
              onClick={handleSubmit(handleSaveDTP)}
              variant="contained"
              disabled={isSubmitting}
              sx={{ minWidth: 120 }}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedDTP
                ? 'Update DTP'
                : 'Report DTP'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default DTPManagement;
