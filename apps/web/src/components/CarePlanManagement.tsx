import { useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
  List,
  ListItem,
  ListItemText,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import FlagIcon from '@mui/icons-material/Flag';
import RemoveIcon from '@mui/icons-material/Remove';

import { RBACGuard } from '../hooks/useRBAC';

import {
  usePatientCarePlans,
  useCreateCarePlan,
  useUpdateCarePlan,
} from '../queries/usePatientResources';
import type {
  CarePlan,
  CreateCarePlanData,
  UpdateCarePlanData,
} from '../types/patientManagement';

interface CarePlanManagementProps {
  patientId: string;
}

interface CarePlanFormData {
  goals: Array<{ value: string }>;
  objectives: Array<{ value: string }>;
  followUpDate?: Date;
  planQuality: 'adequate' | 'needsReview';
  dtpSummary?: 'resolved' | 'unresolved';
  notes?: string;
}

const CarePlanManagement: React.FC<CarePlanManagementProps> = ({
  patientId,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCarePlan, setSelectedCarePlan] = useState<CarePlan | null>(
    null
  );

  // React Query hooks
  const {
    data: carePlansResponse,
    isLoading,
    isError,
    error,
  } = usePatientCarePlans(patientId);
  const createCarePlanMutation = useCreateCarePlan();
  const updateCarePlanMutation = useUpdateCarePlan();

  const carePlans = carePlansResponse?.data?.results || [];
  const latestCarePlan = carePlans[0]; // Assuming sorted by date desc

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CarePlanFormData>({
    defaultValues: {
      goals: [{ value: '' }],
      objectives: [{ value: '' }],
      followUpDate: undefined,
      planQuality: 'adequate',
      dtpSummary: 'resolved',
      notes: '',
    },
  });

  const {
    fields: goalFields,
    append: appendGoal,
    remove: removeGoal,
  } = useFieldArray({
    control,
    name: 'goals',
  });

  const {
    fields: objectiveFields,
    append: appendObjective,
    remove: removeObjective,
  } = useFieldArray({
    control,
    name: 'objectives',
  });

  const handleOpenDialog = (carePlan?: CarePlan) => {
    if (carePlan) {
      setSelectedCarePlan(carePlan);
      reset({
        goals:
          carePlan.goals.length > 0
            ? carePlan.goals.map((g) => ({ value: g }))
            : [{ value: '' }],
        objectives:
          carePlan.objectives.length > 0
            ? carePlan.objectives.map((o) => ({ value: o }))
            : [{ value: '' }],
        followUpDate: carePlan.followUpDate
          ? new Date(carePlan.followUpDate)
          : undefined,
        planQuality: carePlan.planQuality,
        dtpSummary: carePlan.dtpSummary,
        notes: carePlan.notes || '',
      });
    } else {
      setSelectedCarePlan(null);
      reset({
        goals: [{ value: '' }],
        objectives: [{ value: '' }],
        followUpDate: undefined,
        planQuality: 'adequate',
        dtpSummary: 'resolved',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCarePlan(null);
    reset();
  };

  const handleSaveCarePlan = async (formData: CarePlanFormData) => {
    try {
      const carePlanData: CreateCarePlanData | UpdateCarePlanData = {
        goals: formData.goals
          .map((g) => g.value)
          .filter((goal) => goal.trim() !== ''),
        objectives: formData.objectives
          .map((o) => o.value)
          .filter((obj) => obj.trim() !== ''),
        followUpDate: formData.followUpDate?.toISOString(),
        planQuality: formData.planQuality,
        dtpSummary: formData.dtpSummary,
        notes: formData.notes?.trim() || undefined,
      };

      if (selectedCarePlan) {
        await updateCarePlanMutation.mutateAsync({
          carePlanId: selectedCarePlan._id,
          carePlanData: carePlanData as UpdateCarePlanData,
        });
      } else {
        await createCarePlanMutation.mutateAsync({
          patientId,
          carePlanData: carePlanData as CreateCarePlanData,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Error saving care plan:', error);
    }
  };

  const getPlanQualityColor = (
    quality: 'adequate' | 'needsReview'
  ): 'success' | 'warning' => {
    return quality === 'adequate' ? 'success' : 'warning';
  };

  const getDtpSummaryColor = (
    summary?: 'resolved' | 'unresolved'
  ): 'success' | 'warning' => {
    return summary === 'resolved' ? 'success' : 'warning';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
        <Typography variant="h6">Failed to load care plans</Typography>
        <Typography variant="body2">
          {error instanceof Error
            ? error.message
            : 'Unable to retrieve care plan information.'}
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
            <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Care Plan Management
            </Typography>
            {carePlans.length > 0 && (
              <Chip
                label={`${carePlans.length} plan${
                  carePlans.length > 1 ? 's' : ''
                }`}
                size="small"
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
              Create Care Plan
            </Button>
          </RBACGuard>
        </Box>

        {/* Current Care Plan */}
        {latestCarePlan ? (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 3,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Current Care Plan
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    label={
                      latestCarePlan.planQuality === 'adequate'
                        ? 'Adequate'
                        : 'Needs Review'
                    }
                    size="small"
                    color={getPlanQualityColor(latestCarePlan.planQuality)}
                    icon={
                      latestCarePlan.planQuality === 'adequate' ? (
                        <CheckCircleIcon />
                      ) : (
                        <WarningIcon />
                      )
                    }
                  />
                  {latestCarePlan.dtpSummary && (
                    <Chip
                      label={`DTPs ${latestCarePlan.dtpSummary}`}
                      size="small"
                      color={getDtpSummaryColor(latestCarePlan.dtpSummary)}
                    />
                  )}
                  <RBACGuard action="canUpdate">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(latestCarePlan)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </RBACGuard>
                </Stack>
              </Box>

              <Box
                sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}
              >
                {/* Goals */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <FlagIcon sx={{ mr: 1, fontSize: 18 }} />
                    Treatment Goals ({latestCarePlan.goals.length})
                  </Typography>
                  <List dense>
                    {latestCarePlan.goals.map((goal: string, index: number) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemText
                          primary={goal}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {/* Objectives */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <CheckCircleIcon sx={{ mr: 1, fontSize: 18 }} />
                    Objectives ({latestCarePlan.objectives.length})
                  </Typography>
                  <List dense>
                    {latestCarePlan.objectives.map(
                      (objective: string, index: number) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemText
                            primary={objective}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      )
                    )}
                  </List>
                </Box>
              </Box>

              {(latestCarePlan.notes || latestCarePlan.followUpDate) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    {latestCarePlan.followUpDate && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Next Follow-up
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatDate(latestCarePlan.followUpDate)}
                        </Typography>
                      </Box>
                    )}
                    {latestCarePlan.notes && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Additional Notes
                        </Typography>
                        <Typography variant="body2">
                          {latestCarePlan.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <AssignmentIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No care plan created
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create a comprehensive care plan to guide patient treatment and
                track progress
              </Typography>
              <RBACGuard action="canCreate">
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Create Care Plan
                </Button>
              </RBACGuard>
            </CardContent>
          </Card>
        )}

        {/* Previous Care Plans */}
        {carePlans.length > 1 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Previous Care Plans ({carePlans.length - 1})
              </Typography>
              <Stack spacing={2}>
                {carePlans.slice(1).map((plan: CarePlan) => (
                  <Paper key={plan._id} sx={{ p: 2 }} variant="outlined">
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Care Plan - {formatDate(plan.createdAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {plan.goals.length} goals • {plan.objectives.length}{' '}
                          objectives
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={plan.planQuality}
                          size="small"
                          color={getPlanQualityColor(plan.planQuality)}
                          variant="outlined"
                        />
                        <RBACGuard action="canUpdate">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(plan)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </RBACGuard>
                      </Stack>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Care Plan Dialog */}
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
              <AssignmentIcon sx={{ mr: 1 }} />
              {selectedCarePlan ? 'Edit Care Plan' : 'Create Care Plan'}
            </Box>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <form onSubmit={handleSubmit(handleSaveCarePlan)}>
              <Stack spacing={3}>
                {/* Goals Section */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Treatment Goals
                  </Typography>
                  {goalFields.map((field, index) => (
                    <Box key={field.id} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Controller
                        name={`goals.${index}.value`}
                        control={control}
                        rules={{
                          required:
                            index === 0
                              ? 'At least one goal is required'
                              : false,
                          maxLength: {
                            value: 200,
                            message: 'Goal cannot exceed 200 characters',
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            placeholder={`Goal ${index + 1}`}
                            fullWidth
                            size="small"
                            error={!!errors.goals?.[index]?.value}
                            helperText={errors.goals?.[index]?.value?.message}
                          />
                        )}
                      />
                      {goalFields.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={() => removeGoal(index)}
                          color="error"
                        >
                          <RemoveIcon />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => appendGoal({ value: '' })}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Add Goal
                  </Button>
                </Box>

                {/* Objectives Section */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Treatment Objectives
                  </Typography>
                  {objectiveFields.map((field, index) => (
                    <Box key={field.id} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Controller
                        name={`objectives.${index}.value`}
                        control={control}
                        rules={{
                          required:
                            index === 0
                              ? 'At least one objective is required'
                              : false,
                          maxLength: {
                            value: 200,
                            message: 'Objective cannot exceed 200 characters',
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            placeholder={`Objective ${index + 1}`}
                            fullWidth
                            size="small"
                            error={!!errors.objectives?.[index]?.value}
                            helperText={
                              errors.objectives?.[index]?.value?.message
                            }
                          />
                        )}
                      />
                      {objectiveFields.length > 1 && (
                        <IconButton
                          size="small"
                          onClick={() => removeObjective(index)}
                          color="error"
                        >
                          <RemoveIcon />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => appendObjective({ value: '' })}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Add Objective
                  </Button>
                </Box>

                <Divider />

                {/* Quality and Status */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2,
                  }}
                >
                  <Controller
                    name="planQuality"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Plan Quality</InputLabel>
                        <Select {...field} label="Plan Quality">
                          <MenuItem value="adequate">
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                              Adequate
                            </Box>
                          </MenuItem>
                          <MenuItem value="needsReview">
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <WarningIcon color="warning" sx={{ mr: 1 }} />
                              Needs Review
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="dtpSummary"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>DTP Status</InputLabel>
                        <Select {...field} label="DTP Status">
                          <MenuItem value="resolved">
                            All DTPs Resolved
                          </MenuItem>
                          <MenuItem value="unresolved">
                            DTPs Unresolved
                          </MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Box>

                {/* Follow-up Date */}
                <Controller
                  name="followUpDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...field}
                      label="Next Follow-up Date"
                      minDate={new Date()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          helperText: 'Optional: Schedule next appointment',
                        },
                      }}
                    />
                  )}
                />

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
                      label="Additional Notes"
                      placeholder="Any additional observations or instructions..."
                      multiline
                      rows={3}
                      fullWidth
                      error={!!errors.notes}
                      helperText={
                        errors.notes?.message || 'Optional clinical notes'
                      }
                    />
                  )}
                />
              </Stack>
            </form>
          </DialogContent>

          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(handleSaveCarePlan)}
              variant="contained"
              disabled={isSubmitting}
              sx={{ minWidth: 120 }}
            >
              {isSubmitting
                ? 'Saving...'
                : selectedCarePlan
                ? 'Update Plan'
                : 'Create Plan'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default CarePlanManagement;
