import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  CircularProgress,
  Button,
  Grid,
  Fab,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import { usePatientHealthRecords } from '../../hooks/usePatientHealthRecords';
import VitalsChart from '../../components/patient-portal/VitalsChart';
import LabResultCard from '../../components/patient-portal/LabResultCard';
import VitalsLogging from '../../components/patient-portal/VitalsLogging';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`health-records-tabpanel-${index}`}
      aria-labelledby={`health-records-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `health-records-tab-${index}`,
    'aria-controls': `health-records-tabpanel-${index}`,
  };
}

const PatientHealthRecords: React.FC = () => {
  const { user } = usePatientAuth();
  const [tabValue, setTabValue] = useState(0);

  const {
    labResults,
    visitHistory,
    vitalsHistory,
    vitalsTrends,
    loading,
    error,
    refreshHealthRecords,
    logVitals,
    downloadMedicalRecords,
    vitalsLoading,
    downloadLoading
  } = usePatientHealthRecords(user?.id);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = async () => {
    try {
      await refreshHealthRecords();
    } catch (error) {
      console.error('Failed to refresh health records:', error);
    }
  };

  const handleVitalsSubmit = async (vitalsData: any) => {
    try {
      await logVitals(vitalsData);
    } catch (error) {
      console.error('Failed to log vitals:', error);
      throw error; // Re-throw to let the component handle the error display
    }
  };

  const handleDownloadRecords = async () => {
    try {
      await downloadMedicalRecords();
    } catch (error) {
      console.error('Failed to download medical records:', error);
    }
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Please log in to view your health records.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            My Health Records
          </Typography>

          <Typography variant="body1" color="text.secondary">
            Access your lab results, visit history, track vitals, and download medical records.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>

          <Button
            variant="contained"
            startIcon={downloadLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleDownloadRecords}
            disabled={downloadLoading}
            sx={{ minWidth: 140 }}
          >
            {downloadLoading ? 'Generating...' : 'Download PDF'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="health records tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label={`Lab Results (${labResults?.length || 0})`}
              {...a11yProps(0)}
            />
            <Tab
              label="Vitals Tracking"
              {...a11yProps(1)}
            />
            <Tab
              label={`Visit History (${visitHistory?.length || 0})`}
              {...a11yProps(2)}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Lab Results
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your laboratory test results with reference ranges and pharmacist interpretations.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : labResults && labResults.length > 0 ? (
            <Grid container spacing={2}>
              {labResults
                .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
                .map((result) => (
                  <Grid item xs={12} key={result._id}>
                    <LabResultCard result={result} />
                  </Grid>
                ))}
            </Grid>
          ) : (
            <Alert severity="info">
              No lab results available. Lab results will appear here when your pharmacist uploads them.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Vitals Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Log your vital signs and view trends over time with graphical representations.
          </Typography>

          <Grid container spacing={3}>
            {/* Vitals Logging Form */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Log New Vitals
                  </Typography>
                  <VitalsLogging
                    onSubmit={handleVitalsSubmit}
                    loading={vitalsLoading}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Vitals Charts - expanded to full width */}
            <Grid item xs={12} md={12}>
              <Card>
                <CardContent sx={{ pt: 2, pb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                      Vitals Trends
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {/* Time range selector */}
                      <Chip label="7d" size="small" onClick={() => refreshHealthRecords()} clickable />
                      <Chip label="14d" size="small" onClick={() => refreshHealthRecords()} clickable />
                      <Chip label="30d" size="small" color="primary" onClick={() => refreshHealthRecords()} clickable />
                      <Chip label="90d" size="small" onClick={() => refreshHealthRecords()} clickable />
                    </Box>
                  </Box>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress />
                    </Box>
                  ) : vitalsTrends ? (
                    <Box sx={{ height: { xs: 360, sm: 420, md: 480 } }}>
                      <VitalsChart data={vitalsTrends} loading={loading} />
                    </Box>
                  ) : (
                    <Alert severity="info">
                      No vitals data available. Start logging your vitals to see trends and insights.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Vitals History */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Vitals History
                  </Typography>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : vitalsHistory && vitalsHistory.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {vitalsHistory
                        .sort((a: any, b: any) => new Date(b.recordedAt || b.recordedDate).getTime() - new Date(a.recordedAt || a.recordedDate).getTime())
                        .slice(0, 10) // Show last 10 entries
                        .map((vital: any, index: number) => (
                          <Card key={index} variant="outlined">
                            <CardContent sx={{ py: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  {new Date(vital.recordedAt || vital.recordedDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  {vital.source && (
                                    <Chip
                                      label={vital.source === 'pharmacist' ? 'Pharmacist' : 'Patient'}
                                      size="small"
                                      color={vital.source === 'pharmacist' ? 'default' : 'primary'}
                                      variant="outlined"
                                    />
                                  )}
                                  {typeof vital.verified !== 'undefined' && (
                                    vital.verified ? (
                                      <Chip
                                        icon={<ViewIcon fontSize="small" />}
                                        label="Verified"
                                        size="small"
                                        color="success"
                                        sx={{ fontWeight: 600 }}
                                      />
                                    ) : (
                                      <Chip
                                        label="Unverified"
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                      />
                                    )
                                  )}
                                </Box>
                              </Box>

                              <Grid container spacing={2}>
                                {vital.bloodPressure && (
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">
                                      Blood Pressure
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                      {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg
                                    </Typography>
                                  </Grid>
                                )}

                                {vital.heartRate && (
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">
                                      Heart Rate
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                      {vital.heartRate} bpm
                                    </Typography>
                                  </Grid>
                                )}

                                {vital.weight && (
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">
                                      Weight
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                      {vital.weight} kg
                                    </Typography>
                                  </Grid>
                                )}

                                {vital.glucose && (
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="body2" color="text.secondary">
                                      Glucose
                                    </Typography>
                                    <Typography variant="body1" fontWeight="medium">
                                      {vital.glucose} mg/dL
                                    </Typography>
                                  </Grid>
                                )}
                              </Grid>

                              {vital.notes && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                  Note: {vital.notes}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                    </Box>
                  ) : (
                    <Alert severity="info">
                      No vitals history available. Start logging your vitals to build your health tracking history.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Visit History
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your past consultations with notes, recommendations, and follow-up plans.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : visitHistory && visitHistory.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visitHistory
                .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                .map((visit) => (
                  <Card key={visit._id} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {visit.visitType || 'Consultation'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(visit.visitDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip
                            label={visit.status || 'Completed'}
                            color={visit.status === 'completed' ? 'success' : 'default'}
                            size="small"
                          />
                          {visit.followUpRequired && (
                            <Chip
                              label="Follow-up Required"
                              color="warning"
                              size="small"
                            />
                          )}
                        </Box>
                      </Box>

                      {/* Patient Summary Section - Prominent Display */}
                      {visit.patientSummary && visit.patientSummary.visibleToPatient && (
                        <Box
                          sx={{
                            mb: 3,
                            p: 2,
                            bgcolor: 'primary.50',
                            borderRadius: 2,
                            borderLeft: 4,
                            borderColor: 'primary.main',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                              label="✨ Pharmacist Summary"
                              color="primary"
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>

                          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
                            {visit.patientSummary.summary}
                          </Typography>

                          {visit.patientSummary.keyPoints && visit.patientSummary.keyPoints.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                                Key Points:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {visit.patientSummary.keyPoints.map((point: string, idx: number) => (
                                  <Chip
                                    key={idx}
                                    label={point}
                                    variant="outlined"
                                    color="primary"
                                    size="small"
                                    sx={{
                                      height: 'auto',
                                      py: 0.5,
                                      '& .MuiChip-label': {
                                        whiteSpace: 'normal',
                                        textAlign: 'left',
                                      },
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}

                          {visit.patientSummary.nextSteps && visit.patientSummary.nextSteps.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                                What's Next:
                              </Typography>
                              <Box sx={{ pl: 2 }}>
                                {visit.patientSummary.nextSteps.map((step: string, idx: number) => (
                                  <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                                      {idx + 1}.
                                    </Typography>
                                    <Typography variant="body2">{step}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}

                      {visit.chiefComplaint && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Chief Complaint
                          </Typography>
                          <Typography variant="body2">
                            {visit.chiefComplaint}
                          </Typography>
                        </Box>
                      )}

                      {visit.assessment && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Assessment
                          </Typography>
                          <Typography variant="body2">
                            {visit.assessment}
                          </Typography>
                        </Box>
                      )}

                      {visit.recommendations && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Recommendations
                          </Typography>
                          <Typography variant="body2">
                            {visit.recommendations}
                          </Typography>
                        </Box>
                      )}

                      {visit.pharmacistName && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                          <Typography variant="body2" color="text.secondary">
                            Consulted with: <strong>{visit.pharmacistName}</strong>
                          </Typography>

                          <Tooltip title="View detailed consultation notes">
                            <IconButton size="small" color="primary">
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </Box>
          ) : (
            <Alert severity="info">
              No visit history available. Your consultation history will appear here after appointments.
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Floating Action Button for quick vitals logging */}
      <Fab
        color="primary"
        aria-label="log vitals"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' } // Only show on mobile
        }}
        onClick={() => {
          setTabValue(1); // Switch to vitals tab
        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default PatientHealthRecords;