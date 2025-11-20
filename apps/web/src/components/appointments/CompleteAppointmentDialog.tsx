import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Grid,
  Stack,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Chip,
  IconButton,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  MedicalServices as MedicalServicesIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import { Appointment } from '../../stores/appointmentTypes';
import { useUpdateAppointmentStatus } from '../../hooks/useAppointments';
import { useCreateVisitFromAppointment } from '../../queries/usePatientResources';

// Outcome status options
const OUTCOME_STATUS_OPTIONS = [
  {
    value: 'successful',
    label: 'Successful',
    description: 'Appointment completed successfully with all objectives met',
    color: 'success',
  },
  {
    value: 'partially_successful',
    label: 'Partially Successful',
    description: 'Some objectives met, but follow-up may be needed',
    color: 'warning',
  },
  {
    value: 'unsuccessful',
    label: 'Unsuccessful',
    description: 'Objectives not met, requires immediate follow-up',
    color: 'error',
  },
] as const;

// Common next actions suggestions
const COMMON_NEXT_ACTIONS = [
  'Schedule follow-up appointment',
  'Monitor medication adherence',
  'Review lab results when available',
  'Contact patient in 1 week',
  'Adjust medication dosage',
  'Refer to specialist',
  'Schedule medication therapy review',
  'Provide patient education materials',
  'Monitor blood pressure',
  'Schedule vaccination',
];

interface CompleteAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSuccess?: (appointment: Appointment) => void;
}

interface FormData {
  outcomeStatus: 'successful' | 'partially_successful' | 'unsuccessful';
  notes: string;
  nextActions: string[];
  createVisit: boolean;
  customNextAction: string;
}

const CompleteAppointmentDialog: React.FC<CompleteAppointmentDialogProps> = ({
  open,
  onClose,
  appointment,
  onSuccess,
}) => {
  // Form state
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      outcomeStatus: 'successful',
      notes: '',
      nextActions: [],
      createVisit: false,
      customNextAction: '',
    },
    mode: 'onChange',
  });

  // Watch form values
  const watchedOutcomeStatus = watch('outcomeStatus');
  const watchedNextActions = watch('nextActions');
  const watchedCustomNextAction = watch('customNextAction');

  // Local state
  const [showCustomActionInput, setShowCustomActionInput] = useState(false);

  // Mutations
  const updateStatusMutation = useUpdateAppointmentStatus();
  const createVisitMutation = useCreateVisitFromAppointment();
  
  // Combined loading state
  const isLoading = updateStatusMutation.isPending || createVisitMutation.isPending;

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    if (!appointment) return;

    try {
      const statusData = {
        status: 'completed' as const,
        outcome: {
          status: data.outcomeStatus,
          notes: data.notes,
          nextActions: data.nextActions,
          visitCreated: data.createVisit,
        },
      };

      // Complete the appointment first
      const response = await updateStatusMutation.mutateAsync({
        appointmentId: appointment._id,
        statusData,
      });

      // If visit creation was requested and appointment completion was successful
      if (data.createVisit && response.data?.appointment) {
        try {
          await createVisitMutation.mutateAsync({
            patientId: appointment.patientId,
            appointmentId: appointment._id,
            appointmentData: {
              type: appointment.type,
              notes: data.notes,
              nextActions: data.nextActions,
              scheduledDate: appointment.scheduledDate.toString(),
              scheduledTime: appointment.scheduledTime,
            },
          });
        } catch (visitError) {
          console.error('Failed to create visit:', visitError);
          // Don't fail the whole operation if visit creation fails
        }
      }

      // Reset form and close dialog
      reset();
      setShowCustomActionInput(false);
      onClose();
      
      // Call success callback if provided
      if (onSuccess && response.data?.appointment) {
        onSuccess(response.data.appointment);
      }
    } catch (error) {
      console.error('Failed to complete appointment:', error);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    reset();
    setShowCustomActionInput(false);
    onClose();
  };

  // Add next action
  const handleAddNextAction = (action: string) => {
    const currentActions = watchedNextActions;
    if (!currentActions.includes(action)) {
      setValue('nextActions', [...currentActions, action]);
    }
  };

  // Remove next action
  const handleRemoveNextAction = (actionToRemove: string) => {
    const currentActions = watchedNextActions;
    setValue('nextActions', currentActions.filter(action => action !== actionToRemove));
  };

  // Add custom next action
  const handleAddCustomAction = () => {
    const customAction = watchedCustomNextAction.trim();
    if (customAction && !watchedNextActions.includes(customAction)) {
      setValue('nextActions', [...watchedNextActions, customAction]);
      setValue('customNextAction', '');
      setShowCustomActionInput(false);
    }
  };

  // Get outcome status config
  const getOutcomeStatusConfig = (status: string) => {
    return OUTCOME_STATUS_OPTIONS.find(option => option.value === status);
  };

  if (!appointment) {
    return null;
  }

  const selectedOutcomeConfig = getOutcomeStatusConfig(watchedOutcomeStatus);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">
              Complete Appointment
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Appointment Summary */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <MedicalServicesIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Appointment Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Type
                    </Typography>
                    <Typography variant="body1">
                      {appointment.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Date & Time
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(appointment.scheduledDate), 'MMM d, yyyy')} at {appointment.scheduledTime}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {appointment.duration} minutes
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={appointment.status.replace('_', ' ').toUpperCase()}
                      color="primary"
                      size="small"
                    />
                  </Grid>
                  {appointment.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {appointment.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            {/* Outcome Status */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Appointment Outcome
              </Typography>
              <Controller
                name="outcomeStatus"
                control={control}
                rules={{ required: 'Outcome status is required' }}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.outcomeStatus}>
                    <InputLabel>Outcome Status</InputLabel>
                    <Select {...field} label="Outcome Status">
                      {OUTCOME_STATUS_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box>
                            <Typography variant="body1">{option.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.outcomeStatus && (
                      <FormHelperText>{errors.outcomeStatus.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />

              {/* Status-specific alerts */}
              {selectedOutcomeConfig && (
                <Box mt={2}>
                  {selectedOutcomeConfig.value === 'unsuccessful' && (
                    <Alert severity="warning" icon={<WarningIcon />}>
                      This appointment was marked as unsuccessful. Consider scheduling an immediate follow-up.
                    </Alert>
                  )}
                  {selectedOutcomeConfig.value === 'partially_successful' && (
                    <Alert severity="info" icon={<InfoIcon />}>
                      Some objectives were met. Review next actions to ensure continuity of care.
                    </Alert>
                  )}
                  {selectedOutcomeConfig.value === 'successful' && (
                    <Alert severity="success" icon={<CheckCircleIcon />}>
                      Great! All appointment objectives were successfully completed.
                    </Alert>
                  )}
                </Box>
              )}
            </Box>

            {/* Notes */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Completion Notes
              </Typography>
              <Controller
                name="notes"
                control={control}
                rules={{ 
                  required: 'Completion notes are required',
                  minLength: { value: 10, message: 'Notes must be at least 10 characters long' }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notes"
                    placeholder="Describe what was accomplished during the appointment, any issues encountered, patient response, etc."
                    multiline
                    rows={4}
                    fullWidth
                    error={!!errors.notes}
                    helperText={errors.notes?.message || 'Provide detailed notes about the appointment outcome'}
                  />
                )}
              />
            </Box>

            {/* Next Actions */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Next Actions
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Select or add actions that should be taken following this appointment
              </Typography>

              {/* Selected Actions */}
              {watchedNextActions.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Actions:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {watchedNextActions.map((action, index) => (
                      <Chip
                        key={index}
                        label={action}
                        onDelete={() => handleRemoveNextAction(action)}
                        color="primary"
                        variant="outlined"
                        deleteIcon={<RemoveIcon />}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Common Actions */}
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Common Actions:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {COMMON_NEXT_ACTIONS.map((action) => (
                    <Chip
                      key={action}
                      label={action}
                      onClick={() => handleAddNextAction(action)}
                      color={watchedNextActions.includes(action) ? 'primary' : 'default'}
                      variant={watchedNextActions.includes(action) ? 'filled' : 'outlined'}
                      disabled={watchedNextActions.includes(action)}
                      clickable={!watchedNextActions.includes(action)}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Custom Action Input */}
              <Box>
                {!showCustomActionInput ? (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setShowCustomActionInput(true)}
                    variant="outlined"
                    size="small"
                  >
                    Add Custom Action
                  </Button>
                ) : (
                  <Box display="flex" gap={1} alignItems="flex-end">
                    <Controller
                      name="customNextAction"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Custom Action"
                          placeholder="Enter a custom next action..."
                          size="small"
                          fullWidth
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomAction();
                            }
                          }}
                        />
                      )}
                    />
                    <Button
                      onClick={handleAddCustomAction}
                      disabled={!watchedCustomNextAction.trim()}
                      variant="contained"
                      size="small"
                    >
                      Add
                    </Button>
                    <Button
                      onClick={() => {
                        setShowCustomActionInput(false);
                        setValue('customNextAction', '');
                      }}
                      variant="outlined"
                      size="small"
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider />

            {/* Create Visit Option */}
            <Box>
              <Controller
                name="createVisit"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">
                          Create Visit Record
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically create a visit record with pre-populated appointment details
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />

              {watch('createVisit') && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  A new visit record will be created and linked to this appointment.
                </Alert>
              )}
            </Box>

            {/* Validation Summary */}
            {Object.keys(errors).length > 0 && (
              <Alert severity="error">
                <Typography variant="body2" fontWeight="medium">
                  Please fix the following errors:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  {errors.outcomeStatus && <li>{errors.outcomeStatus.message}</li>}
                  {errors.notes && <li>{errors.notes.message}</li>}
                </ul>
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={isSubmitting || isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={isSubmitting || isLoading}
            startIcon={isSubmitting || isLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {isSubmitting || isLoading ? 'Completing...' : 'Complete Appointment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CompleteAppointmentDialog;