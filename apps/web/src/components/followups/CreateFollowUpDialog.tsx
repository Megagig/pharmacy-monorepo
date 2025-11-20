import React, { useState, useEffect } from 'react';
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
  Chip,
  Card,
  CardContent,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Flag as FlagIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, startOfDay, isBefore } from 'date-fns';
import toast from 'react-hot-toast';

import { FollowUpFormData, FollowUpType, FollowUpPriority, TriggerType } from '../../stores/followUpTypes';
import { useCreateFollowUpTask } from '../../hooks/useFollowUps';
import PatientAutocomplete from '../appointments/PatientAutocomplete';
import PharmacistSelector from '../appointments/PharmacistSelector';
import { Patient } from '../../types/patientManagement';

// Follow-up type options
const FOLLOWUP_TYPES: Array<{
  value: FollowUpType;
  label: string;
  description: string;
  duration: number; // default duration in minutes
  color: string;
}> = [
  {
    value: 'medication_start_followup',
    label: 'Medication Start Follow-up',
    description: 'Check on patient after starting new medication',
    duration: 15,
    color: '#1976d2',
  },
  {
    value: 'lab_result_review',
    label: 'Lab Result Review',
    description: 'Review and discuss lab test results',
    duration: 20,
    color: '#d32f2f',
  },
  {
    value: 'hospital_discharge_followup',
    label: 'Hospital Discharge Follow-up',
    description: 'Post-discharge care and medication reconciliation',
    duration: 30,
    color: '#f57c00',
  },
  {
    value: 'medication_change_followup',
    label: 'Medication Change Follow-up',
    description: 'Monitor effects of medication changes',
    duration: 15,
    color: '#388e3c',
  },
  {
    value: 'chronic_disease_monitoring',
    label: 'Chronic Disease Monitoring',
    description: 'Regular check-in for chronic condition management',
    duration: 25,
    color: '#7b1fa2',
  },
  {
    value: 'adherence_check',
    label: 'Adherence Check',
    description: 'Check medication adherence and address barriers',
    duration: 15,
    color: '#5d4037',
  },
  {
    value: 'refill_reminder',
    label: 'Refill Reminder',
    description: 'Remind patient about medication refills',
    duration: 10,
    color: '#0288d1',
  },
  {
    value: 'preventive_care',
    label: 'Preventive Care',
    description: 'Preventive health services and screenings',
    duration: 20,
    color: '#689f38',
  },
  {
    value: 'general_followup',
    label: 'General Follow-up',
    description: 'General patient follow-up',
    duration: 15,
    color: '#616161',
  },
];

// Priority options
const PRIORITY_OPTIONS: Array<{
  value: FollowUpPriority;
  label: string;
  color: string;
}> = [
  { value: 'low', label: 'Low', color: '#757575' },
  { value: 'medium', label: 'Medium', color: '#ffa726' },
  { value: 'high', label: 'High', color: '#ef5350' },
  { value: 'urgent', label: 'Urgent', color: '#d32f2f' },
  { value: 'critical', label: 'Critical', color: '#b71c1c' },
];

// Trigger type options
const TRIGGER_TYPES: Array<{
  value: TriggerType;
  label: string;
}> = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'medication_start', label: 'Medication Start' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'hospital_discharge', label: 'Hospital Discharge' },
  { value: 'medication_change', label: 'Medication Change' },
  { value: 'scheduled_monitoring', label: 'Scheduled Monitoring' },
  { value: 'missed_appointment', label: 'Missed Appointment' },
  { value: 'system_rule', label: 'System Rule' },
];

interface CreateFollowUpDialogProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<FollowUpFormData>;
  selectedDate?: Date;
}

interface ExtendedFormData extends FollowUpFormData {
  selectedPatient: Patient | null;
  selectedPharmacist: any | null;
  objectivesText: string;
}

const CreateFollowUpDialog: React.FC<CreateFollowUpDialogProps> = ({
  open,
  onClose,
  initialData,
  selectedDate,
}) => {
  // Form state
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExtendedFormData>({
    defaultValues: {
      patientId: '',
      type: 'general_followup',
      title: '',
      description: '',
      objectives: [],
      objectivesText: '',
      priority: 'medium',
      dueDate: selectedDate || addDays(new Date(), 1),
      estimatedDuration: 15,
      assignedTo: '',
      trigger: {
        type: 'manual',
      },
      selectedPatient: null,
      selectedPharmacist: null,
      ...initialData,
    },
    mode: 'onChange',
  });

  // Watch form values
  const watchedType = watch('type');
  const watchedPriority = watch('priority');
  const watchedObjectivesText = watch('objectivesText');

  // Mutations
  const createFollowUpMutation = useCreateFollowUpTask();

  // Update duration when type changes
  useEffect(() => {
    const selectedType = FOLLOWUP_TYPES.find(type => type.value === watchedType);
    if (selectedType) {
      setValue('estimatedDuration', selectedType.duration);
      // Auto-generate title if empty
      if (!watch('title')) {
        setValue('title', selectedType.label);
      }
    }
  }, [watchedType, setValue, watch]);

  // Parse objectives from text
  useEffect(() => {
    if (watchedObjectivesText) {
      const objectives = watchedObjectivesText
        .split('\n')
        .map(obj => obj.trim())
        .filter(obj => obj.length > 0);
      setValue('objectives', objectives);
    } else {
      // If no objectives text, set empty array
      setValue('objectives', []);
    }
  }, [watchedObjectivesText, setValue]);

  // Handle form submission
  const onSubmit = async (data: ExtendedFormData) => {
    try {
      if (!data.selectedPatient) {
        toast.error('Please select a patient');
        return;
      }

      // Ensure at least one objective exists
      let objectives = data.objectives;
      if (!objectives || objectives.length === 0) {
        // Provide a default objective based on the follow-up type
        const selectedType = FOLLOWUP_TYPES.find(type => type.value === data.type);
        objectives = [selectedType?.description || 'Follow up with patient'];
      }

      const followUpData: FollowUpFormData = {
        patientId: data.selectedPatient._id,
        type: data.type,
        title: data.title,
        description: data.description,
        objectives: objectives,
        priority: data.priority,
        dueDate: data.dueDate,
        estimatedDuration: data.estimatedDuration,
        assignedTo: data.selectedPharmacist?._id || '',
        trigger: data.trigger,
      };

      await createFollowUpMutation.mutateAsync(followUpData);
      
      toast.success('Follow-up task created successfully!');
      
      // Reset form and close dialog
      reset();
      onClose();
    } catch (error: any) {
      console.error('Failed to create follow-up task:', error);
      
      // Extract error message from different error formats
      let errorMessage = 'Failed to create follow-up task';
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <AssignmentIcon color="success" />
              <Typography variant="h6">
                Create New Follow-up Task
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
              {/* Patient Selection */}
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <PersonIcon color="primary" />
                    <Typography variant="h6">Patient Information</Typography>
                  </Box>
                  
                  <Controller
                    name="selectedPatient"
                    control={control}
                    rules={{ required: 'Patient selection is required' }}
                    render={({ field }) => (
                      <PatientAutocomplete
                        value={field.value}
                        onChange={(patient) => {
                          field.onChange(patient);
                          setValue('patientId', patient?._id || '');
                        }}
                        onInputChange={() => {}}
                        error={!!errors.selectedPatient}
                        helperText={errors.selectedPatient?.message}
                        required
                      />
                    )}
                  />
                </CardContent>
              </Card>

              {/* Follow-up Details */}
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <AssignmentIcon color="success" />
                    <Typography variant="h6">Follow-up Details</Typography>
                  </Box>

                  <Grid container spacing={2}>
                    {/* Type */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="type"
                        control={control}
                        rules={{ required: 'Follow-up type is required' }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.type}>
                            <InputLabel>Follow-up Type</InputLabel>
                            <Select {...field} label="Follow-up Type">
                              {FOLLOWUP_TYPES.map((type) => (
                                <MenuItem key={type.value} value={type.value}>
                                  <Box>
                                    <Typography variant="body1">{type.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {type.description}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.type && (
                              <FormHelperText>{errors.type.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Priority */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="priority"
                        control={control}
                        rules={{ required: 'Priority is required' }}
                        render={({ field }) => (
                          <FormControl fullWidth error={!!errors.priority}>
                            <InputLabel>Priority</InputLabel>
                            <Select {...field} label="Priority">
                              {PRIORITY_OPTIONS.map((priority) => (
                                <MenuItem key={priority.value} value={priority.value}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <FlagIcon sx={{ color: priority.color }} />
                                    {priority.label}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.priority && (
                              <FormHelperText>{errors.priority.message}</FormHelperText>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    {/* Title */}
                    <Grid item xs={12}>
                      <Controller
                        name="title"
                        control={control}
                        rules={{ required: 'Title is required' }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Task Title"
                            fullWidth
                            error={!!errors.title}
                            helperText={errors.title?.message}
                            required
                          />
                        )}
                      />
                    </Grid>

                    {/* Due Date */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="dueDate"
                        control={control}
                        rules={{ 
                          required: 'Due date is required',
                          validate: (value) => {
                            if (isBefore(startOfDay(value), startOfDay(new Date()))) {
                              return 'Cannot set due date in the past';
                            }
                            return true;
                          }
                        }}
                        render={({ field }) => (
                          <DatePicker
                            {...field}
                            label="Due Date"
                            minDate={new Date()}
                            maxDate={addDays(new Date(), 365)}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                error: !!errors.dueDate,
                                helperText: errors.dueDate?.message,
                              },
                            }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Estimated Duration */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="estimatedDuration"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Estimated Duration (minutes)"
                            type="number"
                            fullWidth
                            inputProps={{ min: 5, max: 120 }}
                          />
                        )}
                      />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12}>
                      <Controller
                        name="description"
                        control={control}
                        rules={{ required: 'Description is required' }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Description"
                            placeholder="Describe the follow-up task..."
                            multiline
                            rows={3}
                            fullWidth
                            error={!!errors.description}
                            helperText={errors.description?.message}
                            required
                          />
                        )}
                      />
                    </Grid>

                    {/* Objectives */}
                    <Grid item xs={12}>
                      <Controller
                        name="objectivesText"
                        control={control}
                        rules={{
                          validate: (value) => {
                            const objectives = value?.split('\n').map(obj => obj.trim()).filter(obj => obj.length > 0) || [];
                            return objectives.length > 0 || 'At least one objective is required';
                          }
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Objectives (one per line) *"
                            placeholder="Enter each objective on a new line..."
                            multiline
                            rows={3}
                            fullWidth
                            required
                            error={!!errors.objectivesText}
                            helperText={errors.objectivesText?.message || "List each objective on a separate line (required)"}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Pharmacist Assignment */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Pharmacist Assignment (Optional)
                  </Typography>
                  
                  <Controller
                    name="selectedPharmacist"
                    control={control}
                    render={({ field }) => (
                      <PharmacistSelector
                        value={field.value}
                        onChange={(pharmacist) => {
                          field.onChange(pharmacist);
                          setValue('assignedTo', pharmacist?._id || '');
                        }}
                        filterByAvailability={false}
                      />
                    )}
                  />
                </CardContent>
              </Card>

              {/* Trigger Information */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Trigger Information
                  </Typography>
                  
                  <Controller
                    name="trigger.type"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Trigger Type</InputLabel>
                        <Select {...field} label="Trigger Type">
                          {TRIGGER_TYPES.map((trigger) => (
                            <MenuItem key={trigger.value} value={trigger.value}>
                              {trigger.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </CardContent>
              </Card>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <AssignmentIcon />}
            >
              {isSubmitting ? 'Creating...' : 'Create Follow-up Task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateFollowUpDialog;
