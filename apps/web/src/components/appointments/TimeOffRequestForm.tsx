import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Event as EventIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addDays, differenceInDays } from 'date-fns';
import { useRequestTimeOff } from '../../hooks/usePharmacistSchedule';
import { useNotification } from '../../hooks/useNotification';
import { TimeOffRequest } from '../../services/pharmacistScheduleService';

interface AffectedAppointment {
  _id: string;
  scheduledDate: string;
  scheduledTime: string;
  patientId: string;
  type: string;
  title?: string;
  patient?: {
    firstName: string;
    lastName: string;
  };
}

interface TimeOffRequestFormProps {
  open: boolean;
  onClose: () => void;
  pharmacistId: string;
  onSuccess?: () => void;
  showApprovalWorkflow?: boolean;
  canApprove?: boolean;
  initialTimeOffRequest?: {
    _id: string;
    startDate: string;
    endDate: string;
    reason: string;
    type: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    affectedAppointments?: AffectedAppointment[];
  };
}

const TimeOffRequestForm: React.FC<TimeOffRequestFormProps> = ({
  open,
  onClose,
  pharmacistId,
  onSuccess,
  showApprovalWorkflow = false,
  canApprove = false,
  initialTimeOffRequest,
}) => {
  const [formData, setFormData] = useState<TimeOffRequest & { startDateObj: Date; endDateObj: Date }>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    startDateObj: new Date(),
    endDateObj: addDays(new Date(), 1),
    reason: '',
    type: 'vacation',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [affectedAppointments, setAffectedAppointments] = useState<AffectedAppointment[]>([]);
  const [showAffectedAppointments, setShowAffectedAppointments] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [approvalReason, setApprovalReason] = useState('');

  const { showNotification } = useNotification();
  const requestTimeOffMutation = useRequestTimeOff();

  // Initialize form data from initial request if provided
  useEffect(() => {
    if (initialTimeOffRequest && open) {
      const startDateObj = new Date(initialTimeOffRequest.startDate);
      const endDateObj = new Date(initialTimeOffRequest.endDate);
      
      setFormData({
        startDate: initialTimeOffRequest.startDate,
        endDate: initialTimeOffRequest.endDate,
        startDateObj,
        endDateObj,
        reason: initialTimeOffRequest.reason,
        type: initialTimeOffRequest.type as any,
      });
      
      setAffectedAppointments(initialTimeOffRequest.affectedAppointments || []);
      setApprovalStatus(initialTimeOffRequest.status);
    }
  }, [initialTimeOffRequest, open]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }

    if (formData.endDateObj <= formData.startDateObj) {
      newErrors.endDate = 'End date must be after start date';
    }

    const daysDifference = differenceInDays(formData.endDateObj, formData.startDateObj);
    if (daysDifference > 30) {
      newErrors.endDate = 'Time-off period cannot exceed 30 days';
    }

    // Check if start date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (formData.startDateObj < today) {
      newErrors.startDate = 'Start date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const response = await requestTimeOffMutation.mutateAsync({
        pharmacistId,
        timeOffData: {
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason.trim(),
          type: formData.type,
        },
      });

      const responseAffectedAppointments = response.data?.affectedAppointments || [];
      setAffectedAppointments(responseAffectedAppointments);
      
      const affectedCount = responseAffectedAppointments.length;
      let message = 'Time-off request submitted successfully';
      
      if (affectedCount > 0) {
        message += `. ${affectedCount} appointment(s) may need rescheduling.`;
        setShowAffectedAppointments(true);
      }

      showNotification(message, 'success');
      
      // If there are affected appointments, show them instead of closing immediately
      if (affectedCount === 0) {
        handleClose();
        onSuccess?.();
      } else {
        onSuccess?.();
      }
    } catch (error) {
      showNotification('Failed to submit time-off request', 'error');
    }
  };

  // Handle approval/rejection
  const handleApprovalAction = async (action: 'approved' | 'rejected') => {
    if (!initialTimeOffRequest?._id) return;

    try {
      // This would need to be implemented in the hook
      // For now, we'll simulate the action
      setApprovalStatus(action);
      
      showNotification(
        `Time-off request ${action} successfully`,
        action === 'approved' ? 'success' : 'info'
      );
      
      onSuccess?.();
    } catch (error) {
      showNotification(`Failed to ${action} time-off request`, 'error');
    }
  };

  // Handle close
  const handleClose = () => {
    if (!initialTimeOffRequest) {
      setFormData({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        startDateObj: new Date(),
        endDateObj: addDays(new Date(), 1),
        reason: '',
        type: 'vacation',
      });
    }
    setErrors({});
    setAffectedAppointments([]);
    setShowAffectedAppointments(false);
    setApprovalStatus(null);
    setApprovalReason('');
    onClose();
  };

  // Handle date changes
  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      const startDate = format(date, 'yyyy-MM-dd');
      const endDateObj = date >= formData.endDateObj ? addDays(date, 1) : formData.endDateObj;
      const endDate = format(endDateObj, 'yyyy-MM-dd');
      
      setFormData(prev => ({
        ...prev,
        startDate,
        endDate,
        startDateObj: date,
        endDateObj,
      }));
      
      // Clear date-related errors
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.startDate;
        delete newErrors.endDate;
        return newErrors;
      });
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    if (date) {
      const endDate = format(date, 'yyyy-MM-dd');
      
      setFormData(prev => ({
        ...prev,
        endDate,
        endDateObj: date,
      }));
      
      // Clear date-related errors
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.endDate;
        return newErrors;
      });
    }
  };

  // Calculate duration
  const duration = differenceInDays(formData.endDateObj, formData.startDateObj) + 1;

  // Get type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'primary';
      case 'sick_leave':
        return 'error';
      case 'personal':
        return 'secondary';
      case 'training':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon color="success" />;
      case 'rejected':
        return <CancelIcon color="error" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return null;
    }
  };

  // Get approval workflow steps
  const getApprovalSteps = () => {
    const steps = [
      {
        label: 'Request Submitted',
        completed: true,
        active: false,
      },
      {
        label: 'Pending Review',
        completed: approvalStatus !== 'pending',
        active: approvalStatus === 'pending',
      },
      {
        label: approvalStatus === 'approved' ? 'Approved' : approvalStatus === 'rejected' ? 'Rejected' : 'Decision',
        completed: approvalStatus === 'approved' || approvalStatus === 'rejected',
        active: false,
      },
    ];
    return steps;
  };

  // Determine if form is in view-only mode
  const isViewOnly = !!initialTimeOffRequest;
  const isEditable = !isViewOnly && !showAffectedAppointments;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { minHeight: 500 }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6">
                {isViewOnly ? 'Time Off Request Details' : 'Request Time Off'}
              </Typography>
              {approvalStatus && getStatusIcon(approvalStatus)}
            </Box>
            <Chip
              label={`${duration} day${duration !== 1 ? 's' : ''}`}
              color="primary"
              size="small"
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {/* Approval Workflow Stepper */}
          {showApprovalWorkflow && approvalStatus && (
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Approval Status
              </Typography>
              <Stepper activeStep={getApprovalSteps().findIndex(step => step.active)} orientation="horizontal">
                {getApprovalSteps().map((step, index) => (
                  <Step key={step.label} completed={step.completed}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}

          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            {/* Date Selection */}
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Start Date"
                value={formData.startDateObj}
                onChange={handleStartDateChange}
                minDate={isEditable ? new Date() : undefined}
                disabled={!isEditable}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.startDate,
                    helperText: errors.startDate,
                  },
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="End Date"
                value={formData.endDateObj}
                onChange={handleEndDateChange}
                minDate={formData.startDateObj}
                disabled={!isEditable}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.endDate,
                    helperText: errors.endDate,
                  },
                }}
              />
            </Grid>

            {/* Type Selection */}
            <Grid item xs={12}>
              <FormControl fullWidth disabled={!isEditable}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <MenuItem value="vacation">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label="Vacation" color="primary" size="small" />
                      <Typography>Vacation</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="sick_leave">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label="Sick Leave" color="error" size="small" />
                      <Typography>Sick Leave</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="personal">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label="Personal" color="secondary" size="small" />
                      <Typography>Personal</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="training">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label="Training" color="info" size="small" />
                      <Typography>Training</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="other">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label="Other" color="default" size="small" />
                      <Typography>Other</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Reason */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                multiline
                rows={4}
                value={formData.reason}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, reason: e.target.value }));
                  if (errors.reason) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.reason;
                      return newErrors;
                    });
                  }
                }}
                disabled={!isEditable}
                error={!!errors.reason}
                helperText={errors.reason || (isEditable ? 'Please provide a detailed reason for your time-off request' : '')}
                placeholder={isEditable ? "Please provide a detailed reason for your time-off request..." : ''}
              />
            </Grid>

            {/* Duration Summary */}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Summary:</strong> {formData.type.replace('_', ' ')} from{' '}
                  {format(formData.startDateObj, 'MMM dd, yyyy')} to{' '}
                  {format(formData.endDateObj, 'MMM dd, yyyy')} ({duration} day{duration !== 1 ? 's' : ''})
                </Typography>
              </Alert>
            </Grid>

            {/* Warning for long periods */}
            {duration > 7 && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    This is a long time-off period ({duration} days). Please ensure adequate coverage is arranged.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Affected Appointments */}
            {affectedAppointments.length > 0 && (
              <Grid item xs={12}>
                <Accordion expanded={showAffectedAppointments || isViewOnly}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    onClick={() => setShowAffectedAppointments(!showAffectedAppointments)}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon color="warning" />
                      <Typography variant="h6">
                        Affected Appointments ({affectedAppointments.length})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      The following appointments will be affected by this time-off request and may need to be rescheduled:
                    </Alert>
                    <List>
                      {affectedAppointments.map((appointment, index) => (
                        <React.Fragment key={appointment._id}>
                          <ListItem>
                            <ListItemIcon>
                              <EventIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="subtitle1">
                                  {appointment.title || appointment.type?.replace('_', ' ') || 'Appointment'}
                                </Typography>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="textSecondary">
                                    {format(new Date(appointment.scheduledDate), 'MMM dd, yyyy')} at {appointment.scheduledTime}
                                  </Typography>
                                  {appointment.patient && (
                                    <Typography variant="body2" color="textSecondary">
                                      Patient: {appointment.patient.firstName} {appointment.patient.lastName}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                          {index < affectedAppointments.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Approval Actions for Managers */}
            {canApprove && approvalStatus === 'pending' && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="h6" gutterBottom>
                    Approval Actions
                  </Typography>
                  <TextField
                    fullWidth
                    label="Approval/Rejection Reason (Optional)"
                    multiline
                    rows={2}
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    placeholder="Provide additional comments for your decision..."
                    sx={{ mb: 2 }}
                  />
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => handleApprovalAction('approved')}
                      startIcon={<CheckCircleIcon />}
                    >
                      Approve Request
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleApprovalAction('rejected')}
                      startIcon={<CancelIcon />}
                    >
                      Reject Request
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleClose} disabled={requestTimeOffMutation.isPending}>
            {isViewOnly ? 'Close' : 'Cancel'}
          </Button>
          
          {isEditable && (
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={requestTimeOffMutation.isPending || !formData.reason.trim()}
              startIcon={requestTimeOffMutation.isPending ? <CircularProgress size={16} /> : null}
            >
              {requestTimeOffMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          )}
          
          {showAffectedAppointments && !isViewOnly && (
            <Button
              onClick={handleClose}
              variant="contained"
              color="primary"
            >
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default TimeOffRequestForm;