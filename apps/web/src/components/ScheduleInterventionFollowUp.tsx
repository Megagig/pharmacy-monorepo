import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  Divider,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import { format, parseISO } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClinicalIntervention } from '../queries/useClinicalInterventions';
import { useUsers } from '../queries/useUsers';
import { engagementIntegrationApi } from '../services/api/engagementIntegrationApi';
import { showSuccessToast, showErrorToast } from '../utils/toast';

const ScheduleInterventionFollowUp: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API queries
  const {
    data: response,
    isLoading: isLoadingIntervention,
    error: interventionError,
  } = useClinicalIntervention(id || '');

  const {
    data: usersResponse,
    isLoading: isLoadingUsers,
  } = useUsers();

  const intervention = response?.data;
  const users = usersResponse?.data?.users || [];
  const pharmacists = users.filter((user: any) => 
    user.role === 'pharmacist' || user.role === 'pharmacy_manager'
  );

  // Mutation for creating follow-up
  const createFollowUpMutation = useMutation({
    mutationFn: async (data: {
      interventionId: string;
      patientId: string;
      assignedTo: string;
      locationId?: string;
    }) => {
      return engagementIntegrationApi.createFollowUpFromIntervention(
        data.interventionId,
        {
          patientId: data.patientId,
          assignedTo: data.assignedTo,
          locationId: data.locationId,
        }
      );
    },
    onSuccess: (data) => {
      showSuccessToast('Follow-up task created successfully');
      queryClient.invalidateQueries({ queryKey: ['clinical-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-tasks'] });
      navigate(`/follow-ups/${data.followUpTask._id}`);
    },
    onError: (error: any) => {
      showErrorToast(error.response?.data?.message || 'Failed to create follow-up task');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!intervention || !assignedTo) {
      showErrorToast('Please select a pharmacist to assign the follow-up');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createFollowUpMutation.mutateAsync({
        interventionId: intervention._id,
        patientId: intervention.patientId,
        assignedTo,
        locationId: intervention.locationId,
      });
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string): 'success' | 'info' | 'primary' | 'warning' | 'default' | 'error' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'implemented':
        return 'primary';
      case 'planning':
        return 'warning';
      case 'identified':
        return 'default';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoadingIntervention || isLoadingUsers) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (interventionError || !intervention) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {interventionError?.message || 'Failed to load intervention details'}
      </Alert>
    );
  }

  if (!intervention.followUp?.required) {
    return (
      <Alert severity="warning" sx={{ m: 3 }}>
        This intervention does not require follow-up.
      </Alert>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/interventions/details/${id}`)}
          variant="outlined"
        >
          Back to Intervention
        </Button>
        <Typography variant="h4" component="h1">
          Schedule Follow-up Task
        </Typography>
      </Box>

      {/* Intervention Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Clinical Intervention Summary
          </Typography>
          
          <Box display="flex" gap={1} mb={2}>
            <Chip
              label={intervention.priority.toUpperCase()}
              color={getPriorityColor(intervention.priority)}
              size="small"
            />
            <Chip
              label={intervention.status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase())}
              color={getStatusColor(intervention.status)}
              size="small"
            />
            <Chip
              label={intervention.category
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase())}
              variant="outlined"
              size="small"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Intervention #{intervention.interventionNumber}
          </Typography>
          
          <Typography variant="body1" paragraph>
            {intervention.issueDescription}
          </Typography>

          {/* Patient Information */}
          <Box display="flex" alignItems="center" gap={2} mt={2}>
            <PersonIcon color="action" />
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {intervention.patient
                  ? `${intervention.patient.firstName} ${intervention.patient.lastName}`
                  : 'Unknown Patient'}
              </Typography>
              {intervention.patient?.dateOfBirth && (
                <Typography variant="body2" color="text.secondary">
                  DOB: {format(parseISO(intervention.patient.dateOfBirth), 'MMM dd, yyyy')}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Follow-up Form */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Follow-up Task Details
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={3}>
              {/* Assigned Pharmacist */}
              <FormControl fullWidth required>
                <Autocomplete
                  options={pharmacists}
                  getOptionLabel={(option: any) => 
                    `${option.firstName} ${option.lastName} (${option.role.replace(/_/g, ' ')})`
                  }
                  value={pharmacists.find((p: any) => p._id === assignedTo) || null}
                  onChange={(_, newValue) => {
                    setAssignedTo(newValue?._id || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assign to Pharmacist"
                      required
                      helperText="Select the pharmacist who will handle this follow-up"
                    />
                  )}
                  renderOption={(props, option: any) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body1">
                          {option.firstName} {option.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.role.replace(/_/g, ' ')} • {option.email}
                        </Typography>
                      </Box>
                    </li>
                  )}
                />
              </FormControl>

              {/* Follow-up Information */}
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Follow-up Task Details:</strong>
                </Typography>
                <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                  • <strong>Type:</strong> Clinical Intervention Follow-up<br/>
                  • <strong>Priority:</strong> {intervention.priority === 'critical' ? 'Critical' : 
                    intervention.priority === 'high' ? 'Urgent' : 
                    intervention.priority === 'medium' ? 'High' : 'Medium'}<br/>
                  • <strong>Due Date:</strong> {intervention.priority === 'critical' ? '1 day' : 
                    intervention.priority === 'high' ? '3 days' : 
                    intervention.priority === 'medium' ? '7 days' : '14 days'} from now<br/>
                  • <strong>Estimated Duration:</strong> 30 minutes
                </Typography>
              </Alert>

              <Divider />

              {/* Action Buttons */}
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/interventions/details/${id}`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<ScheduleIcon />}
                  disabled={isSubmitting || !assignedTo}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Creating Follow-up...
                    </>
                  ) : (
                    'Create Follow-up Task'
                  )}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ScheduleInterventionFollowUp;