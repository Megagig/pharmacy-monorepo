import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Switch,
  TextField,
  Button,
  Alert,
  FormControlLabel,
  Divider,
  Chip,
  Paper
} from '@mui/material';
import { Save as SaveIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';

interface WorkingDay {
  dayOfWeek: number;
  dayName: string;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

interface ScheduleData {
  workingDays: WorkingDay[];
  appointmentTypes: string[];
  maxAppointmentsPerDay: number;
  defaultDuration: number;
  bufferBetweenAppointments: number;
}

const DAYS_OF_WEEK = [
  { dayOfWeek: 1, dayName: 'Monday' },
  { dayOfWeek: 2, dayName: 'Tuesday' },
  { dayOfWeek: 3, dayName: 'Wednesday' },
  { dayOfWeek: 4, dayName: 'Thursday' },
  { dayOfWeek: 5, dayName: 'Friday' },
  { dayOfWeek: 6, dayName: 'Saturday' },
  { dayOfWeek: 0, dayName: 'Sunday' }
];

const APPOINTMENT_TYPES = [
  { value: 'mtm_session', label: 'MTM Session' },
  { value: 'chronic_disease_review', label: 'Chronic Disease Review' },
  { value: 'new_medication_consultation', label: 'New Medication Consultation' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'health_check', label: 'Health Check' },
  { value: 'smoking_cessation', label: 'Smoking Cessation' },
  { value: 'general_followup', label: 'General Follow-up' }
];

const ScheduleManagement: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [schedule, setSchedule] = useState<ScheduleData>({
    workingDays: DAYS_OF_WEEK.map(day => ({
      ...day,
      isWorkingDay: day.dayOfWeek >= 1 && day.dayOfWeek <= 5, // Monday to Friday default
      startTime: '09:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00'
    })),
    appointmentTypes: APPOINTMENT_TYPES.map(type => type.value),
    maxAppointmentsPerDay: 16,
    defaultDuration: 30,
    bufferBetweenAppointments: 0
  });

  // Simplified time handling without date pickers
  const validateTimeFormat = (time: string): boolean => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  const handleWorkingDayToggle = (dayOfWeek: number) => {
    setSchedule(prev => ({
      ...prev,
      workingDays: prev.workingDays.map(day =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, isWorkingDay: !day.isWorkingDay }
          : day
      )
    }));
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime' | 'breakStart' | 'breakEnd', value: string) => {
    if (validateTimeFormat(value) || value === '') {
      setSchedule(prev => ({
        ...prev,
        workingDays: prev.workingDays.map(day =>
          day.dayOfWeek === dayOfWeek
            ? { ...day, [field]: value }
            : day
        )
      }));
    }
  };

  const handleAppointmentTypeToggle = (appointmentType: string) => {
    setSchedule(prev => ({
      ...prev,
      appointmentTypes: prev.appointmentTypes.includes(appointmentType)
        ? prev.appointmentTypes.filter(type => type !== appointmentType)
        : [...prev.appointmentTypes, appointmentType]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Convert schedule data to API format
      const scheduleData = {
        workingHours: schedule.workingDays.map(day => ({
          dayOfWeek: day.dayOfWeek,
          isWorkingDay: day.isWorkingDay,
          shifts: day.isWorkingDay ? [{
            startTime: day.startTime,
            endTime: day.endTime,
            breakStart: day.breakStart,
            breakEnd: day.breakEnd
          }] : []
        })),
        appointmentPreferences: {
          maxAppointmentsPerDay: schedule.maxAppointmentsPerDay,
          appointmentTypes: schedule.appointmentTypes,
          defaultDuration: schedule.defaultDuration,
          bufferBetweenAppointments: schedule.bufferBetweenAppointments
        }
      };

      const response = await apiClient.post('/schedules/my-schedule', scheduleData);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Schedule saved successfully!' });
      } else {
        setMessage({ type: 'error', text: response.data.message || 'Failed to save schedule' });
      }
    } catch (error: any) {
      console.error('Schedule save error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save schedule. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const loadExistingSchedule = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/schedules/my-schedule');

      if (response.data.success && response.data.data) {
        // Convert API data back to UI format
        const apiSchedule = response.data.data;
        const workingDays = DAYS_OF_WEEK.map(day => {
          const workingHour = apiSchedule.workingHours?.find((wh: any) => wh.dayOfWeek === day.dayOfWeek);
          const shift = workingHour?.shifts?.[0];
          
          return {
            ...day,
            isWorkingDay: workingHour?.isWorkingDay || false,
            startTime: shift?.startTime || '09:00',
            endTime: shift?.endTime || '17:00',
            breakStart: shift?.breakStart || '12:00',
            breakEnd: shift?.breakEnd || '13:00'
          };
        });

        setSchedule({
          workingDays,
          appointmentTypes: apiSchedule.appointmentPreferences?.appointmentTypes || APPOINTMENT_TYPES.map(t => t.value),
          maxAppointmentsPerDay: apiSchedule.appointmentPreferences?.maxAppointmentsPerDay || 16,
          defaultDuration: apiSchedule.appointmentPreferences?.defaultDuration || 30,
          bufferBetweenAppointments: apiSchedule.appointmentPreferences?.bufferBetweenAppointments || 0
        });
      }
    } catch (error) {
      console.error('Failed to load existing schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExistingSchedule();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScheduleIcon color="primary" />
          <Typography variant="h4" component="h1">
            Schedule Management
          </Typography>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Set your working hours and availability for appointment booking.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Working Hours */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Working Hours
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Set your working days and hours for each day of the week.
                </Typography>

                {schedule.workingDays.map((day) => (
                  <Box key={day.dayOfWeek} sx={{ mb: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={2}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={day.isWorkingDay}
                                onChange={() => handleWorkingDayToggle(day.dayOfWeek)}
                              />
                            }
                            label={day.dayName}
                          />
                        </Grid>

                        {day.isWorkingDay && (
                          <>
                            <Grid item xs={6} sm={2}>
                              <TextField
                                label="Start Time"
                                type="time"
                                size="small"
                                fullWidth
                                value={day.startTime}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, 'startTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <TextField
                                label="End Time"
                                type="time"
                                size="small"
                                fullWidth
                                value={day.endTime}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, 'endTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <TextField
                                label="Break Start"
                                type="time"
                                size="small"
                                fullWidth
                                value={day.breakStart}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, 'breakStart', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <TextField
                                label="Break End"
                                type="time"
                                size="small"
                                fullWidth
                                value={day.breakEnd}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, 'breakEnd', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </>
                        )}
                      </Grid>
                    </Paper>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Appointment Preferences */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Appointment Preferences
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    label="Max Appointments Per Day"
                    type="number"
                    fullWidth
                    size="small"
                    value={schedule.maxAppointmentsPerDay}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      maxAppointmentsPerDay: parseInt(e.target.value) || 16
                    }))}
                    inputProps={{ min: 1, max: 50 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    label="Default Duration (minutes)"
                    type="number"
                    fullWidth
                    size="small"
                    value={schedule.defaultDuration}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      defaultDuration: parseInt(e.target.value) || 30
                    }))}
                    inputProps={{ min: 5, max: 120 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    label="Buffer Between Appointments (minutes)"
                    type="number"
                    fullWidth
                    size="small"
                    value={schedule.bufferBetweenAppointments}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      bufferBetweenAppointments: parseInt(e.target.value) || 0
                    }))}
                    inputProps={{ min: 0, max: 60 }}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Appointment Types
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select the types of appointments you can handle.
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {APPOINTMENT_TYPES.map((type) => (
                    <Chip
                      key={type.value}
                      label={type.label}
                      clickable
                      color={schedule.appointmentTypes.includes(type.value) ? 'primary' : 'default'}
                      onClick={() => handleAppointmentTypeToggle(type.value)}
                      variant={schedule.appointmentTypes.includes(type.value) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? 'Saving...' : 'Save Schedule'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
  );
};

export default ScheduleManagement;