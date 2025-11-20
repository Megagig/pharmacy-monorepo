/**
 * Waitlist Management Component
 * Manages appointment waitlists and notifications
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Badge,
  Avatar,
  Stack,
  Divider,
  Snackbar,
  FormControlLabel,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import {
  HourglassEmpty as WaitlistIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';

interface WaitlistEntry {
  _id: string;
  patientId: string;
  patientName: string;
  appointmentType: string;
  duration: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  preferredPharmacistId?: string;
  preferredPharmacistName?: string;
  preferredTimeSlots?: string[];
  preferredDays?: number[];
  maxWaitDays: number;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled';
  estimatedWaitTime?: string;
}

interface WaitlistStats {
  totalActive: number;
  byUrgency: Record<string, number>;
  byAppointmentType: Record<string, number>;
  averageWaitTime: number;
  fulfillmentRate: number;
}

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Pharmacist {
  _id: string;
  firstName: string;
  lastName: string;
  specialties: string[];
}

const WaitlistManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [filters, setFilters] = useState({
    status: 'active' as const,
    urgencyLevel: '',
    appointmentType: '',
    search: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  const [newEntry, setNewEntry] = useState({
    patientId: '',
    appointmentType: 'general_followup',
    duration: 30,
    urgencyLevel: 'medium' as const,
    maxWaitDays: 14,
    preferredPharmacistId: '',
    preferredTimeSlots: [] as string[],
    preferredDays: [] as number[],
    notificationPreferences: {
      email: true,
      sms: true,
      push: true
    }
  });

  // Scheduling state
  const [schedulingData, setSchedulingData] = useState({
    selectedDate: '',
    selectedTime: '',
    selectedPharmacist: '',
    notes: ''
  });

  // Fetch waitlist data
  const { data: waitlistData, isLoading, error, refetch } = useQuery({
    queryKey: ['waitlist', filters],
    queryFn: async () => {
      try {
        const response = await appointmentService.getWaitlist(filters);
        return response.data;
      } catch (err: any) {
        // Provide more helpful error messages
        if (err.message === 'Validation failed') {
          throw new Error('Invalid filter parameters. Please check your search criteria.');
        }
        if (err.response?.status === 403) {
          throw new Error('This feature is not available in your current plan or you need to join a workspace.');
        }
        if (err.response?.status === 400 && err.response?.data?.message?.includes('Workplace')) {
          throw new Error('You must be part of a workspace to access the waitlist feature.');
        }
        throw err;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false, // Don't retry on error
    staleTime: 0, // Always treat data as stale
    gcTime: 0, // Don't cache
  });

  // Fetch waitlist stats
  const { data: stats } = useQuery({
    queryKey: ['waitlist-stats'],
    queryFn: async () => {
      const response = await appointmentService.getWaitlistStats();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Patient search state for autocomplete
  const [patientSearchText, setPatientSearchText] = useState('');
  const [patientInputValue, setPatientInputValue] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(patientInputValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [patientInputValue]);

  // Fetch patients for autocomplete with search
  const { data: patients = [], isFetching: isFetchingPatients } = useQuery({
    queryKey: ['patients-search', debouncedSearchText],
    queryFn: () => appointmentService.getPatients(debouncedSearchText),
    enabled: addDialogOpen && debouncedSearchText.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 30000, // Keep data in cache
  });

  // Fetch pharmacists for selection
  const { data: pharmacists } = useQuery({
    queryKey: ['pharmacists'],
    queryFn: () => appointmentService.getPharmacists(),
    enabled: addDialogOpen,
  });

  // Fetch available slots for scheduling
  const { data: availableSlots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['available-slots', schedulingData.selectedDate, selectedWaitlistEntry?.duration, selectedWaitlistEntry?.appointmentType],
    queryFn: () => appointmentService.getAvailableSlots({
      date: schedulingData.selectedDate,
      duration: selectedWaitlistEntry?.duration || 30,
      type: selectedWaitlistEntry?.appointmentType || 'general_followup'
    }),
    enabled: scheduleDialogOpen && !!schedulingData.selectedDate && !!selectedWaitlistEntry,
    staleTime: 30000,
  });

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'primary';
      case 'fulfilled': return 'success';
      case 'expired': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Mutations
  const addToWaitlistMutation = useMutation({
    mutationFn: (data: any) => appointmentService.addToWaitlist(data),
    onSuccess: async () => {
      // Force refetch instead of just invalidating
      await queryClient.refetchQueries({ queryKey: ['waitlist'] });
      await queryClient.refetchQueries({ queryKey: ['waitlist-stats'] });
      setAddDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Patient added to waitlist successfully',
        severity: 'success'
      });
      resetForm();
    },
    onError: (error: any) => {
      console.error('Add to waitlist error:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Failed to add patient to waitlist';
      
      // Check for validation error with details
      if (error.response?.data?.error?.details) {
        const details = error.response.data.error.details
          .map((d: any) => `${d.field}: ${d.message}`)
          .join(', ');
        errorMessage = `Validation failed: ${details}`;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  });

  const cancelWaitlistMutation = useMutation({
    mutationFn: (entryId: string) => appointmentService.cancelWaitlistEntry(entryId),
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
      setSnackbar({
        open: true,
        message: 'Waitlist entry cancelled successfully',
        severity: 'success'
      });
    },
    onError: (error: any) => {
      console.error('Cancel waitlist mutation failed:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to cancel waitlist entry',
        severity: 'error'
      });
    }
  });

  const processWaitlistMutation = useMutation({
    mutationFn: () => appointmentService.processWaitlist(),
    onSuccess: (response) => {
      const result = response.data;
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
      setSnackbar({
        open: true,
        message: `Waitlist processed: ${result.processed} entries checked, ${result.notified} notifications sent, ${result.fulfilled} auto-scheduled`,
        severity: 'success'
      });
    },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to process waitlist',
        severity: 'error'
      });
    }
  });

  const notifyPatientMutation = useMutation({
    mutationFn: (entryId: string) => appointmentService.notifyWaitlistPatient(entryId),
    onSuccess: () => {

      setSnackbar({
        open: true,
        message: 'Patient notified successfully',
        severity: 'success'
      });
    },
    onError: (error: any) => {
      console.error('Notify patient mutation failed:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to notify patient',
        severity: 'error'
      });
    }
  });

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: {
      patientId: string;
      appointmentType: string;
      scheduledDate: string;
      scheduledTime: string;
      duration: number;
      assignedTo?: string;
      title: string;
      description?: string;
    }) => {
      const response = await appointmentService.createAppointment(data);
      return response;
    },
    onSuccess: async (response, variables) => {

      // Mark waitlist entry as fulfilled
      if (selectedWaitlistEntry) {
        try {
          await appointmentService.cancelWaitlistEntry(selectedWaitlistEntry._id);
        } catch (error) {
          console.warn('Failed to mark waitlist entry as fulfilled:', error);
        }
      }
      
      // Refresh data
      await queryClient.refetchQueries({ queryKey: ['waitlist'] });
      await queryClient.refetchQueries({ queryKey: ['waitlist-stats'] });
      
      setScheduleDialogOpen(false);
      setSelectedWaitlistEntry(null);
      setSchedulingData({
        selectedDate: '',
        selectedTime: '',
        selectedPharmacist: '',
        notes: ''
      });
      
      setSnackbar({
        open: true,
        message: `Appointment scheduled successfully for ${selectedWaitlistEntry?.patientName}`,
        severity: 'success'
      });
    },
    onError: (error: any) => {
      console.error('Schedule appointment mutation failed:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Failed to schedule appointment';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  });

  const resetForm = () => {
    setNewEntry({
      patientId: '',
      appointmentType: 'general_followup',
      duration: 30,
      urgencyLevel: 'medium',
      maxWaitDays: 14,
      preferredPharmacistId: '',
      preferredTimeSlots: [],
      preferredDays: [],
      notificationPreferences: {
        email: true,
        sms: true,
        push: true
      }
    });
  };

  const handleAddToWaitlist = () => {
    // Clean up the data before sending - remove empty preferredPharmacistId
    const cleanedEntry: any = {
      patientId: newEntry.patientId,
      appointmentType: newEntry.appointmentType,
      duration: newEntry.duration,
      urgencyLevel: newEntry.urgencyLevel,
      maxWaitDays: newEntry.maxWaitDays,
      preferredTimeSlots: newEntry.preferredTimeSlots,
      preferredDays: newEntry.preferredDays,
      notificationPreferences: newEntry.notificationPreferences,
    };
    
    // Only include preferredPharmacistId if it's not empty
    if (newEntry.preferredPharmacistId) {
      cleanedEntry.preferredPharmacistId = newEntry.preferredPharmacistId;
    }

    addToWaitlistMutation.mutate(cleanedEntry);
  };

  const handleCancelWaitlist = (entryId: string) => {

    cancelWaitlistMutation.mutate(entryId);
  };

  const handleProcessWaitlist = () => {
    processWaitlistMutation.mutate();
  };

  const handleNotifyPatient = (entryId: string) => {

    notifyPatientMutation.mutate(entryId);
  };

  const handleScheduleNow = (entry: WaitlistEntry) => {

    setSelectedWaitlistEntry(entry);
    
    // Set default pharmacist - prefer the entry's preferred pharmacist, or first available
    const defaultPharmacist = entry.preferredPharmacistId || 
      (pharmacists && pharmacists.length > 0 ? pharmacists[0]._id : '');
    
    setSchedulingData({
      selectedDate: '',
      selectedTime: '',
      selectedPharmacist: defaultPharmacist,
      notes: ''
    });
    setScheduleDialogOpen(true);
  };

  const handleScheduleAppointment = () => {
    if (!selectedWaitlistEntry || !schedulingData.selectedDate || !schedulingData.selectedTime) {
      setSnackbar({
        open: true,
        message: 'Please select both date and time for the appointment',
        severity: 'warning'
      });
      return;
    }

    // Ensure we have a pharmacist assigned
    if (!schedulingData.selectedPharmacist) {
      setSnackbar({
        open: true,
        message: 'Please select a pharmacist for the appointment',
        severity: 'warning'
      });
      return;
    }

    // Extract patient ID safely
    let patientId: string;
    if (typeof selectedWaitlistEntry.patientId === 'string') {
      patientId = selectedWaitlistEntry.patientId;
    } else if (selectedWaitlistEntry.patientId && typeof selectedWaitlistEntry.patientId === 'object') {
      patientId = selectedWaitlistEntry.patientId._id;
    } else {
      setSnackbar({
        open: true,
        message: 'Invalid patient data. Please try again.',
        severity: 'error'
      });
      return;
    }

    const appointmentData = {
      patientId,
      type: selectedWaitlistEntry.appointmentType, // Backend expects 'type', not 'appointmentType'
      scheduledDate: schedulingData.selectedDate,
      scheduledTime: schedulingData.selectedTime,
      duration: selectedWaitlistEntry.duration,
      assignedTo: schedulingData.selectedPharmacist, // Required field
      title: `${selectedWaitlistEntry.appointmentType.replace('_', ' ')} - ${selectedWaitlistEntry.patientName}`,
      description: schedulingData.notes || `Scheduled from waitlist. Urgency: ${selectedWaitlistEntry.urgencyLevel}`
    };



    scheduleAppointmentMutation.mutate(appointmentData);
  };

  const filteredEntries = waitlistData?.entries?.filter((entry: WaitlistEntry) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!entry.patientName.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (filters.urgencyLevel && entry.urgencyLevel !== filters.urgencyLevel) {
      return false;
    }
    if (filters.appointmentType && entry.appointmentType !== filters.appointmentType) {
      return false;
    }
    return true;
  }) || [];

  const timeSlotOptions = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  const dayOptions = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: 'warning.main' }}>
            <WaitlistIcon />
          </Avatar>
          <Box>
            <Typography variant="h5">
              Appointment Waitlist
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage patients waiting for appointment slots
            </Typography>
          </Box>
        </Box>
        
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<NotificationsIcon />}
            onClick={handleProcessWaitlist}
            disabled={processWaitlistMutation.isPending}
          >
            {processWaitlistMutation.isPending ? 'Processing...' : 'Process Waitlist'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add to Waitlist
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <WaitlistIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.totalActive}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Entries
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.fulfillmentRate}%</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fulfillment Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <AccessTimeIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.averageWaitTime}d</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Wait Time
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    <TrendingUpIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.byUrgency.urgent}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Urgent Cases
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search patients..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={filters.urgencyLevel}
                  label="Urgency"
                  onChange={(e) => setFilters(prev => ({ ...prev, urgencyLevel: e.target.value }))}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Appointment Type</InputLabel>
                <Select
                  value={filters.appointmentType}
                  label="Appointment Type"
                  onChange={(e) => setFilters(prev => ({ ...prev, appointmentType: e.target.value }))}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="mtm_session">MTM Session</MenuItem>
                  <MenuItem value="chronic_disease_review">Chronic Disease Review</MenuItem>
                  <MenuItem value="new_medication_consultation">New Medication Consultation</MenuItem>
                  <MenuItem value="vaccination">Vaccination</MenuItem>
                  <MenuItem value="health_check">Health Check</MenuItem>
                  <MenuItem value="smoking_cessation">Smoking Cessation</MenuItem>
                  <MenuItem value="general_followup">General Follow-up</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="fulfilled">Fulfilled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Waitlist Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Waitlist Entries ({filteredEntries.length})
            </Typography>
            <Chip
              icon={<FilterIcon />}
              label={`${filters.status} entries`}
              color="primary"
              variant="outlined"
            />
          </Box>
          
          {isLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">
              {(error as Error)?.message || 'Failed to load waitlist data. Please try again.'}
            </Alert>
          ) : filteredEntries.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient</TableCell>
                    <TableCell>Appointment Type</TableCell>
                    <TableCell>Urgency</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Preferred Pharmacist</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Est. Available</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            <PersonIcon />
                          </Avatar>
                          <Typography variant="body2">
                            {entry.patientName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.appointmentType.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entry.urgencyLevel}
                          color={getUrgencyColor(entry.urgencyLevel) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.duration} min
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.preferredPharmacistName || 'Any'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.estimatedWaitTime}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entry.status}
                          color={getStatusColor(entry.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Notify patient">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleNotifyPatient(entry._id)}
                              disabled={notifyPatientMutation.isPending}
                            >
                              <NotificationsIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Schedule now">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handleScheduleNow(entry)}
                            >
                              <ScheduleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleCancelWaitlist(entry._id)}
                              disabled={cancelWaitlistMutation.isPending}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No patients currently on the waitlist.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add to Waitlist Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Patient to Waitlist</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={patients || []}
                getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                value={patients?.find(p => p._id === newEntry.patientId) || null}
                inputValue={patientInputValue}
                onChange={(_, value) => {
                  setNewEntry(prev => ({ ...prev, patientId: value?._id || '' }));
                }}
                onInputChange={(_, value, reason) => {
                  if (reason !== 'reset') {
                    setPatientInputValue(value);
                  }
                }}
                filterOptions={(x) => x}
                loading={isFetchingPatients}
                disableClearable={false}
                includeInputInList
                selectOnFocus
                handleHomeEndKeys
                blurOnSelect="touch"
                forcePopupIcon
                noOptionsText={patientInputValue.length < 2 ? "Type at least 2 characters to search" : "No patients found"}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Patient"
                    placeholder="Type to search patients..."
                    required
                    helperText={isFetchingPatients ? 'Searching...' : 'Type at least 2 characters to search'}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                      <PersonIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body2">
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} • {option.phone}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Appointment Type</InputLabel>
                <Select
                  value={newEntry.appointmentType}
                  label="Appointment Type"
                  onChange={(e) => setNewEntry(prev => ({ ...prev, appointmentType: e.target.value }))}
                >
                  <MenuItem value="mtm_session">MTM Session</MenuItem>
                  <MenuItem value="chronic_disease_review">Chronic Disease Review</MenuItem>
                  <MenuItem value="new_medication_consultation">New Medication Consultation</MenuItem>
                  <MenuItem value="vaccination">Vaccination</MenuItem>
                  <MenuItem value="health_check">Health Check</MenuItem>
                  <MenuItem value="smoking_cessation">Smoking Cessation</MenuItem>
                  <MenuItem value="general_followup">General Follow-up</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Urgency Level</InputLabel>
                <Select
                  value={newEntry.urgencyLevel}
                  label="Urgency Level"
                  onChange={(e) => setNewEntry(prev => ({ ...prev, urgencyLevel: e.target.value as any }))}
                >
                  <MenuItem value="low">Low Priority</MenuItem>
                  <MenuItem value="medium">Medium Priority</MenuItem>
                  <MenuItem value="high">High Priority</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={newEntry.duration}
                onChange={(e) => setNewEntry(prev => ({ ...prev, duration: Number(e.target.value) }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Wait Days"
                type="number"
                value={newEntry.maxWaitDays}
                onChange={(e) => setNewEntry(prev => ({ ...prev, maxWaitDays: Number(e.target.value) }))}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Preferred Pharmacist</InputLabel>
                <Select
                  value={newEntry.preferredPharmacistId}
                  label="Preferred Pharmacist"
                  onChange={(e) => setNewEntry(prev => ({ ...prev, preferredPharmacistId: e.target.value }))}
                >
                  <MenuItem value="">Any Pharmacist</MenuItem>
                  {pharmacists?.map((pharmacist) => (
                    <MenuItem key={pharmacist._id} value={pharmacist._id}>
                      {pharmacist.firstName} {pharmacist.lastName}
                      {pharmacist.specialties.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({pharmacist.specialties.join(', ')})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                options={timeSlotOptions}
                value={newEntry.preferredTimeSlots}
                onChange={(_, value) => setNewEntry(prev => ({ ...prev, preferredTimeSlots: value }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Preferred Time Slots"
                    placeholder="Select preferred times"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                    />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                options={dayOptions}
                getOptionLabel={(option) => option.label}
                value={dayOptions.filter(day => newEntry.preferredDays.includes(day.value))}
                onChange={(_, value) => setNewEntry(prev => ({ 
                  ...prev, 
                  preferredDays: value.map(day => day.value) 
                }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Preferred Days"
                    placeholder="Select preferred days"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.label}
                      size="small"
                      {...getTagProps({ index })}
                    />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Notification Preferences
              </Typography>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newEntry.notificationPreferences.email}
                      onChange={(e) => setNewEntry(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          email: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Email"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newEntry.notificationPreferences.sms}
                      onChange={(e) => setNewEntry(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          sms: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="SMS"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newEntry.notificationPreferences.push}
                      onChange={(e) => setNewEntry(prev => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          push: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Push"
                />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToWaitlist}
            variant="contained"
            disabled={!newEntry.patientId || addToWaitlistMutation.isPending}
          >
            {addToWaitlistMutation.isPending ? 'Adding...' : 'Add to Waitlist'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Appointment Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Schedule Appointment
          {selectedWaitlistEntry && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Patient: {selectedWaitlistEntry.patientName} • 
              Type: {selectedWaitlistEntry.appointmentType.replace('_', ' ')} • 
              Duration: {selectedWaitlistEntry.duration} min
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Appointment Date"
                type="date"
                value={schedulingData.selectedDate}
                onChange={(e) => setSchedulingData(prev => ({ ...prev, selectedDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: new Date().toISOString().split('T')[0] // Prevent past dates
                }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Pharmacist</InputLabel>
                <Select
                  value={schedulingData.selectedPharmacist}
                  label="Pharmacist"
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, selectedPharmacist: e.target.value }))}
                >
                  <MenuItem value="">Any Available</MenuItem>
                  {pharmacists?.map((pharmacist) => (
                    <MenuItem key={pharmacist._id} value={pharmacist._id}>
                      {pharmacist.firstName} {pharmacist.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {schedulingData.selectedDate && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Available Time Slots
                </Typography>
                {isLoadingSlots ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : availableSlots?.data?.slots?.length > 0 ? (
                  <Grid container spacing={1}>
                    {availableSlots.data.slots
                      .filter((slot: any) => slot.available)
                      .map((slot: any) => (
                        <Grid item key={`${slot.pharmacistId}-${slot.time}`}>
                          <Button
                            variant={schedulingData.selectedTime === slot.time ? "contained" : "outlined"}
                            size="small"
                            onClick={() => {

                              setSchedulingData(prev => ({ 
                                ...prev, 
                                selectedTime: slot.time,
                                selectedPharmacist: slot.pharmacistId || prev.selectedPharmacist
                              }));
                            }}
                            sx={{ minWidth: 80 }}
                          >
                            {slot.time}
                          </Button>
                        </Grid>
                      ))}
                  </Grid>
                ) : (
                  <Alert severity="info">
                    No available slots for the selected date. Please choose a different date.
                  </Alert>
                )}
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={3}
                value={schedulingData.notes}
                onChange={(e) => setSchedulingData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional notes for this appointment..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleScheduleAppointment}
            disabled={scheduleAppointmentMutation.isPending || !schedulingData.selectedDate || !schedulingData.selectedTime}
          >
            {scheduleAppointmentMutation.isPending ? 'Scheduling...' : 'Schedule Appointment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WaitlistManagement;