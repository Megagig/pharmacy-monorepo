/**
 * Slot Test Component
 * A simple component to test the enhanced slot generation system
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useAvailableSlots, useNextAvailableSlot, useValidateSlot } from '../../hooks/useAppointments';

const SlotTestComponent: React.FC = () => {
  const [testDate, setTestDate] = useState<Date>(new Date());
  const [pharmacistId, setPharmacistId] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [appointmentType, setAppointmentType] = useState<string>('general_followup');
  const [testSlot, setTestSlot] = useState<{ time: string; pharmacistId: string }>({
    time: '10:00',
    pharmacistId: ''
  });

  // Available slots query
  const {
    data: slotsData,
    isLoading: loadingSlots,
    error: slotsError,
    refetch: refetchSlots
  } = useAvailableSlots(
    {
      date: format(testDate, 'yyyy-MM-dd'),
      pharmacistId: pharmacistId || undefined,
      duration,
      type: appointmentType,
      includeUnavailable: true
    },
    true
  );

  // Next available slot query
  const {
    data: nextSlotData,
    isLoading: loadingNextSlot
  } = useNextAvailableSlot(
    {
      pharmacistId: pharmacistId || '',
      duration,
      type: appointmentType,
      daysAhead: 14
    },
    !!pharmacistId
  );

  // Slot validation mutation
  const validateSlotMutation = useValidateSlot();

  const handleValidateSlot = async () => {
    if (!testSlot.pharmacistId || !testSlot.time) {
      alert('Please enter pharmacist ID and time to validate');
      return;
    }

    try {
      const result = await validateSlotMutation.mutateAsync({
        pharmacistId: testSlot.pharmacistId,
        date: format(testDate, 'yyyy-MM-dd'),
        time: testSlot.time,
        duration,
        type: appointmentType
      });

      alert(`Slot validation result: ${result.data.available ? 'Available' : 'Not Available'}\n${result.data.reason || ''}`);
    } catch (error) {
      alert(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Slot Generation System Test
        </Typography>
        
        {/* Test Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Parameters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Test Date"
                  value={testDate}
                  onChange={(date) => date && setTestDate(date)}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Pharmacist ID (optional)"
                  value={pharmacistId}
                  onChange={(e) => setPharmacistId(e.target.value)}
                  placeholder="Leave empty for all pharmacists"
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Duration (minutes)"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Appointment Type"
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => refetchSlots()}
                  disabled={loadingSlots}
                  sx={{ height: '56px' }}
                >
                  {loadingSlots ? <CircularProgress size={24} /> : 'Test Slots'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results */}
        <Grid container spacing={3}>
          {/* Available Slots */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Available Slots for {format(testDate, 'MMMM dd, yyyy')}
                </Typography>
                
                {loadingSlots ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress />
                  </Box>
                ) : slotsError ? (
                  <Alert severity="error">
                    Error loading slots: {slotsError.message}
                  </Alert>
                ) : slotsData?.data ? (
                  <Box>
                    {/* Summary */}
                    {slotsData.data.summary && (
                      <Box mb={2}>
                        <Typography variant="body2" color="text.secondary">
                          Total: {slotsData.data.summary.totalSlots} | 
                          Available: {slotsData.data.summary.availableSlots} | 
                          Utilization: {slotsData.data.summary.utilizationRate}%
                        </Typography>
                      </Box>
                    )}

                    {/* Pharmacists */}
                    {slotsData.data.pharmacists && slotsData.data.pharmacists.length > 0 && (
                      <Box mb={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Pharmacists:
                        </Typography>
                        {slotsData.data.pharmacists.map((pharmacist) => (
                          <Typography key={pharmacist._id} variant="body2">
                            {pharmacist.name}: {pharmacist.availableSlots}/{pharmacist.totalSlots} slots
                          </Typography>
                        ))}
                      </Box>
                    )}

                    {/* Slots */}
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {slotsData.data.slots.map((slot, index) => (
                        <Chip
                          key={`${slot.pharmacistId}-${slot.time}-${index}`}
                          label={`${slot.time}${slot.pharmacistName ? ` (${slot.pharmacistName})` : ''}`}
                          color={slot.available ? 'success' : 'error'}
                          variant="outlined"
                          size="small"
                          title={slot.conflictReason || 'Available'}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Alert severity="info">
                    Click "Test Slots" to load available slots
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Next Available Slot */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Next Available Slot
                </Typography>
                
                {!pharmacistId ? (
                  <Alert severity="info">
                    Enter a pharmacist ID to find next available slot
                  </Alert>
                ) : loadingNextSlot ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress />
                  </Box>
                ) : nextSlotData?.data ? (
                  <Box>
                    <Typography variant="body1">
                      <strong>Date:</strong> {format(new Date(nextSlotData.data.date), 'MMM dd, yyyy')}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Time:</strong> {nextSlotData.data.time}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Pharmacist:</strong> {nextSlotData.data.pharmacistName}
                    </Typography>
                  </Box>
                ) : (
                  <Alert severity="warning">
                    No available slots found in the next 14 days
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Slot Validation Test */}
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Slot Validation Test
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Pharmacist ID"
                      value={testSlot.pharmacistId}
                      onChange={(e) => setTestSlot(prev => ({ ...prev, pharmacistId: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Time (HH:mm)"
                      value={testSlot.time}
                      onChange={(e) => setTestSlot(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleValidateSlot}
                      disabled={validateSlotMutation.isPending}
                    >
                      {validateSlotMutation.isPending ? <CircularProgress size={20} /> : 'Validate Slot'}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default SlotTestComponent;