import React, { useState, useEffect } from 'react';
import { useRBAC } from '../hooks/useRBAC';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Favorite as HeartIcon,
  Thermostat as TempIcon,
  MonitorWeight as WeightIcon,
  Bloodtype as BloodIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../services/apiClient';

interface VitalReading {
  _id: string;
  bloodPressure?: {
    systolic?: number;
    diastolic?: number;
  };
  heartRate?: number; // bpm
  temperature?: number; // °C
  weight?: number; // kg
  bloodGlucose?: number; // mg/dL
  recordedBy?: 'patient' | 'pharmacist';
  source?: 'patient' | 'pharmacist';
  verified?: boolean;
  recordedAt: string;
  notes?: string;
}

interface PatientVitalsTabProps {
  patientId: string;
}

const PatientVitalsTab: React.FC<PatientVitalsTabProps> = ({ patientId }) => {
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const { role, isPharmacist, isOwner } = useRBAC();
  const canVerify = isPharmacist || isOwner;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVital, setNewVital] = useState({
    systolic: '',
    diastolic: '',
    heartRate: '',
    temperatureC: '',
    weightKg: '',
    bloodGlucose: '',
    notes: '',
  });
  const [unitPref, setUnitPref] = useState<'C'|'F'>('C');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const fetchVitals = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch unified vitals for workspace
      const response = await apiClient.get(`/patients/${patientId}/vitals`, { params: { limit: 50 } });
      const data = response.data?.data || response.data || {};
      const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);

      const normalized: VitalReading[] = results.map((i: any) => ({
        _id: i._id || String(Math.random()),
        bloodPressure: i.bloodPressure,
        heartRate: i.heartRate,
        temperature: i.temperature, // °C
        weight: i.weight, // kg
        bloodGlucose: i.bloodGlucose, // mg/dL
        recordedBy: i.source,
        source: i.source,
        verified: !!i.verified,
        recordedAt: i.recordedAt,
        notes: i.notes,
      }));

      setVitals(normalized);
    } catch (err: any) {
      console.error('Error fetching vitals:', err);
      setError(err.message || 'Failed to load vitals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchVitals();
    }
  }, [patientId]);

  const handleAddVital = async () => {
    try {
      const vitalData: any = {
        recordedBy: 'pharmacist',
        recordedDate: new Date().toISOString(),
      };

      if (newVital.systolic && newVital.diastolic) {
        vitalData.bloodPressure = {
          systolic: parseInt(newVital.systolic),
          diastolic: parseInt(newVital.diastolic),
        };
      }

      if (newVital.heartRate) {
        vitalData.heartRate = parseInt(newVital.heartRate);
      }

      if (newVital.temperature) {
        vitalData.temperature = parseFloat(newVital.temperature);
      }

      if (newVital.weight) {
        vitalData.weight = parseFloat(newVital.weight);
      }

      if (newVital.bloodGlucose) {
        vitalData.bloodGlucose = parseFloat(newVital.bloodGlucose);
      }

      if (newVital.notes) {
        vitalData.notes = newVital.notes;
      }

      // Build payload only with valid fields satisfying backend validator
      const payload: any = { recordedAt: vitalData.recordedDate };
      const vitalsPayload: any = {};

      // Blood pressure: include only if both values present and within schema range
      const sys = vitalData.bloodPressure?.systolic;
      const dia = vitalData.bloodPressure?.diastolic;
      if (
        typeof sys === 'number' && typeof dia === 'number' &&
        sys >= 50 && sys <= 300 && dia >= 30 && dia <= 200
      ) {
        vitalsPayload.bpSys = sys;
        vitalsPayload.bpDia = dia;
      }

      // Temperature: UI is in °F; convert to °C and include only if within [30,45]
      if (newVital.temperatureC) {
        const tempC = parseFloat(newVital.temperatureC);
        if (!Number.isNaN(tempC) && tempC >= 30 && tempC <= 45) {
          vitalsPayload.tempC = Number(tempC.toFixed(1));
        } else if (!Number.isNaN(tempC)) {
          setFieldErrors((prev) => ({ ...prev, temperatureC: 'Temperature must be between 30°C and 45°C' }));
          throw new Error('Validation');
        }
      }

      if (Object.keys(vitalsPayload).length > 0) {
        payload.vitals = vitalsPayload;
      }

      // Build labs payload for heart rate, weight, and glucose if present
      const labsPayload: any = {};
      const miscPayload: any = {};

      // Heart rate (bpm) via labs.misc.hr_bpm — acceptable clinical range 30–220
      if (newVital.heartRate) {
        const hr = parseInt(newVital.heartRate);
        if (!Number.isNaN(hr) && hr >= 30 && hr <= 220) {
          miscPayload.hr_bpm = hr;
        } else if (!Number.isNaN(hr)) {
          setFieldErrors((prev) => ({ ...prev, heartRate: 'Heart rate must be between 30–220 bpm' }));
          throw new Error('Validation');
        }
      }

      // Weight in kg via labs.misc.weight_kg — range 1–500 kg
      if (newVital.weightKg) {
        const w = parseFloat(newVital.weightKg);
        if (!Number.isNaN(w) && w >= 1 && w <= 500) {
          miscPayload.weight_kg = Number(w.toFixed(1));
        } else if (!Number.isNaN(w)) {
          setFieldErrors((prev) => ({ ...prev, weightKg: 'Weight must be between 1–500 kg' }));
          throw new Error('Validation');
        }
      }

      // Fasting blood sugar via labs.fbs — validator allows 30–600 mg/dL
      if (newVital.bloodGlucose) {
        const fbs = parseFloat(newVital.bloodGlucose);
        if (!Number.isNaN(fbs) && fbs >= 30 && fbs <= 600) {
          labsPayload.fbs = Number(fbs.toFixed(1));
        } else if (!Number.isNaN(fbs)) {
          setFieldErrors((prev) => ({ ...prev, bloodGlucose: 'Glucose must be between 30–600 mg/dL' }));
          throw new Error('Validation');
        }
      }

      if (Object.keys(miscPayload).length > 0) {
        labsPayload.misc = miscPayload;
      }

      if (Object.keys(labsPayload).length > 0) {
        payload.labs = labsPayload;
      }

      if (vitalData.notes) {
        payload.soap = { objective: vitalData.notes };
      }

      // Create a new clinical assessment entry with vitals (workspace-scoped API)
      await apiClient.post(`/patients/${patientId}/assessments`, payload);
      
      setAddDialogOpen(false);
      setNewVital({
        systolic: '',
        diastolic: '',
        heartRate: '',
        temperature: '',
        weight: '',
        bloodGlucose: '',
        notes: '',
      });
      fetchVitals();
    } catch (err: any) {
      console.error('Error adding vital:', err);
      alert(err.message || 'Failed to add vital signs');
    }
  };

  const getLatestVital = (type: keyof VitalReading) => {
    if (vitals.length === 0) return null;
    return vitals[0];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const prepareChartData = () => {
    return vitals
      .slice()
      .reverse()
      .map((vital) => ({
        date: new Date(vital.recordedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        'Systolic BP': vital.bloodPressure?.systolic,
        'Diastolic BP': vital.bloodPressure?.diastolic,
        'Heart Rate': vital.heartRate,
        Temperature: vital.temperature,
        Weight: vital.weight,
        'Blood Glucose': vital.bloodGlucose,
      }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const latestVital = vitals[0];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Patient Vitals
        </Typography>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchVitals} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Vitals
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {vitals.length === 0 ? (
        <Alert severity="info">
          No vital signs recorded yet. Click "Add Vitals" to record the first reading.
        </Alert>
      ) : (
        <>
          {/* Latest Vitals Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {latestVital?.bloodPressure && (
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <HeartIcon color="error" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Blood Pressure
                      </Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight="bold">
                      {latestVital.bloodPressure.systolic}/{latestVital.bloodPressure.diastolic}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      mmHg
                    </Typography>
                    <Chip
                      size="small"
                      label={latestVital.recordedBy === 'patient' ? 'Self-reported' : 'Recorded by staff'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {latestVital?.heartRate && (
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <HeartIcon color="error" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Heart Rate
                      </Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight="bold">
                      {latestVital.heartRate}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      bpm
                    </Typography>
                    <Chip
                      size="small"
                      label={latestVital.recordedBy === 'patient' ? 'Self-reported' : 'Recorded by staff'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {latestVital?.temperature && (
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <TempIcon color="primary" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Temperature
                      </Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight="bold">
                      {latestVital.temperature}°F
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Fahrenheit
                    </Typography>
                    <Chip
                      size="small"
                      label={latestVital.recordedBy === 'patient' ? 'Self-reported' : 'Recorded by staff'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {latestVital?.weight && (
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <WeightIcon color="primary" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Weight
                      </Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight="bold">
                      {latestVital.weight}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      lbs
                    </Typography>
                    <Chip
                      size="small"
                      label={latestVital.recordedBy === 'patient' ? 'Self-reported' : 'Recorded by staff'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {latestVital?.bloodGlucose && (
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <BloodIcon color="error" />
                      <Typography variant="subtitle2" color="text.secondary">
                        Blood Glucose
                      </Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight="bold">
                      {latestVital.bloodGlucose}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      mg/dL
                    </Typography>
                    <Chip
                      size="small"
                      label={latestVital.recordedBy === 'patient' ? 'Self-reported' : 'Recorded by staff'}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Vitals Trend Chart */}
          {vitals.length > 1 && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                  Vitals Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    {latestVital?.bloodPressure && (
                      <>
                        <Line type="monotone" dataKey="Systolic BP" stroke="#f44336" />
                        <Line type="monotone" dataKey="Diastolic BP" stroke="#ff9800" />
                      </>
                    )}
                    {latestVital?.heartRate && (
                      <Line type="monotone" dataKey="Heart Rate" stroke="#e91e63" />
                    )}
                    {latestVital?.temperature && (
                      <Line type="monotone" dataKey="Temperature" stroke="#2196f3" />
                    )}
                    {latestVital?.weight && (
                      <Line type="monotone" dataKey="Weight" stroke="#4caf50" />
                    )}
                    {latestVital?.bloodGlucose && (
                      <Line type="monotone" dataKey="Blood Glucose" stroke="#9c27b0" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Vitals History */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                Vitals History
              </Typography>
              <Stack spacing={2}>
                {vitals.map((vital) => (
                  <Card key={vital._id} variant="outlined">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              {formatDate(vital.recordedAt)}
                            </Typography>
                            {vital.source && (
                              <Chip size="small" label={vital.source === 'pharmacist' ? 'Pharmacist' : 'Patient'} />
                            )}
                            {vital.verified !== undefined && (
                              <Chip size="small" color={vital.verified ? 'success' : 'default'} label={vital.verified ? 'Verified' : 'Unverified'} />
                            )}
                          </Stack>
                          {/* Verify/Unverify actions for patient-sourced vitals */}
                          {vital.source === 'patient' && canVerify && (
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              {!vital.verified ? (
                                <Button size="small" variant="outlined" onClick={async () => {
                                  try {
                                    await apiClient.put(`/pharmacist/vitals/${patientId}/${vital._id}/verify`);
                                    fetchVitals();
                                  } catch (e: any) {
                                    console.error('Verify failed', e);
                                    alert(e?.response?.data?.message || 'Verify failed');
                                  }
                                }}>Verify</Button>
                              ) : (
                                <Button size="small" variant="text" onClick={async () => {
                                  try {
                                    await apiClient.put(`/pharmacist/vitals/${patientId}/${vital._id}/unverify`);
                                    fetchVitals();
                                  } catch (e: any) {
                                    console.error('Unverify failed', e);
                                    alert(e?.response?.data?.message || 'Unverify failed');
                                  }
                                }}>Unverify</Button>
                              )}
                            </Stack>
                          )}
                          <Grid container spacing={2} sx={{ mt: 1 }}>
                            {vital.bloodPressure && (
                              <Grid item>
                                <Typography variant="body2">
                                  <strong>BP:</strong> {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg
                                </Typography>
                              </Grid>
                            )}
                            {vital.heartRate && (
                              <Grid item>
                                <Typography variant="body2">
                                  <strong>HR:</strong> {vital.heartRate} bpm
                                </Typography>
                              </Grid>
                            )}
                            {vital.temperature && (
                              <Grid item>
                                <Typography variant="body2">
                                  <strong>Temp:</strong> {vital.temperature}°F
                                </Typography>
                              </Grid>
                            )}
                            {vital.weight && (
                              <Grid item>
                                <Typography variant="body2">
                                  <strong>Weight:</strong> {vital.weight} lbs
                                </Typography>
                              </Grid>
                            )}
                            {vital.bloodGlucose && (
                              <Grid item>
                                <Typography variant="body2">
                                  <strong>Glucose:</strong> {vital.bloodGlucose} mg/dL
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                          {vital.notes && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              <strong>Notes:</strong> {vital.notes}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          size="small"
                          label={vital.recordedBy === 'patient' ? 'Patient' : 'Staff'}
                          color={vital.recordedBy === 'patient' ? 'primary' : 'secondary'}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Vitals Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Vital Signs</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Systolic BP"
                type="number"
                value={newVital.systolic}
                onChange={(e) => setNewVital({ ...newVital, systolic: e.target.value })}
                helperText="mmHg"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Diastolic BP"
                type="number"
                value={newVital.diastolic}
                onChange={(e) => setNewVital({ ...newVital, diastolic: e.target.value })}
                helperText="mmHg"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Heart Rate"
                type="number"
                value={newVital.heartRate}
                onChange={(e) => setNewVital({ ...newVital, heartRate: e.target.value })}
                helperText="bpm"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Temperature (°C)"
                type="number"
                value={newVital.temperatureC}
                onChange={(e) => setNewVital({ ...newVital, temperatureC: e.target.value })}
                helperText={fieldErrors.temperatureC ?? '30–45 °C'}
                error={Boolean(fieldErrors.temperatureC)}
                inputProps={{ step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Weight (kg)"
                type="number"
                value={newVital.weightKg}
                onChange={(e) => setNewVital({ ...newVital, weightKg: e.target.value })}
                helperText={fieldErrors.weightKg ?? '1–500 kg'}
                error={Boolean(fieldErrors.weightKg)}
                inputProps={{ step: 0.1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Blood Glucose"
                type="number"
                value={newVital.bloodGlucose}
                onChange={(e) => setNewVital({ ...newVital, bloodGlucose: e.target.value })}
                helperText="mg/dL"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={newVital.notes}
                onChange={(e) => setNewVital({ ...newVital, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddVital}>
            Save Vitals
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientVitalsTab;
