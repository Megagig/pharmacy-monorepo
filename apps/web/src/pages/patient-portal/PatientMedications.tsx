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
  Fab
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Add as AddIcon 
} from '@mui/icons-material';
import { usePatientAuth } from '../../hooks/usePatientAuth';
import { usePatientMedications } from '../../hooks/usePatientMedications';
import MedicationCard from '../../components/patient-portal/MedicationCard';
import AdherenceChart from '../../components/patient-portal/AdherenceChart';
import RefillRequest from '../../components/patient-portal/RefillRequest';

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
      id={`medication-tabpanel-${index}`}
      aria-labelledby={`medication-tab-${index}`}
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
    id: `medication-tab-${index}`,
    'aria-controls': `medication-tabpanel-${index}`,
  };
}

const PatientMedications: React.FC = () => {
  const { user } = usePatientAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Get patient ID from URL or context
  // Check if we're in a patient detail view (URL contains patient ID)
  const currentUrl = window.location.pathname;
  const patientIdMatch = currentUrl.match(/\/patients\/([a-f0-9]{24})/);
  const patientId = patientIdMatch ? patientIdMatch[1] : '690ecada0aabc60041eef019'; // fallback to known patient ID


  const {
    currentMedications,
    medicationHistory,
    adherenceData,
    refillRequests,
    loading,
    error,
    refreshMedications,
    requestRefill,
    cancelRefillRequest,
    refillLoading,
    cancelLoading
  } = usePatientMedications(patientId);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = async () => {
    try {
      await refreshMedications();
    } catch (error) {
      console.error('Failed to refresh medications:', error);
    }
  };

  const handleRefillRequest = async (medicationId: string, notes: string) => {
    try {
      await requestRefill(medicationId, notes);
    } catch (error) {
      console.error('Failed to request refill:', error);
      throw error; // Re-throw to let the component handle the error display
    }
  };

  const handleCancelRefillRequest = async (requestId: string, reason: string) => {
    try {
      await cancelRefillRequest(requestId, reason);
    } catch (error) {
      console.error('Failed to cancel refill request:', error);
      throw error; // Re-throw to let the component handle the error display
    }
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Please log in to view your medications.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            My Medications
          </Typography>
          
          <Typography variant="body1" color="text.secondary">
            Manage your current medications, view history, track adherence, and request refills.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
          sx={{ minWidth: 120 }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
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
            aria-label="medication management tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={`Current Medications (${currentMedications?.length || 0})`} 
              {...a11yProps(0)} 
            />
            <Tab 
              label={`Medication History (${medicationHistory?.length || 0})`} 
              {...a11yProps(1)} 
            />
            <Tab 
              label="Adherence Tracking" 
              {...a11yProps(2)} 
            />
            <Tab 
              label={`Refill Requests (${refillRequests?.length || 0})`} 
              {...a11yProps(3)} 
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Current Medications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your active prescriptions and current medication regimen.
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : currentMedications && currentMedications.length > 0 ? (
            <Grid container spacing={2}>
              {currentMedications.map((medication) => (
                <Grid item xs={12} key={medication._id}>
                  <MedicationCard
                    medication={medication}
                    onRefillRequest={handleRefillRequest}
                    showRefillButton={true}
                    isRefillLoading={refillLoading}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">
              No current medications found. Your pharmacist will add medications here when prescribed.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Medication History
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your past medications and completed treatments displayed in timeline view.
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : medicationHistory && medicationHistory.length > 0 ? (
            <Box sx={{ position: 'relative' }}>
              {/* Timeline line */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 20,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'divider',
                  zIndex: 0
                }}
              />
              
              {/* Timeline items */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {medicationHistory
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((medication, index) => (
                  <Box key={medication._id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Timeline dot */}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: medication.status === 'completed' ? 'success.main' : 'grey.400',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        zIndex: 1,
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </Box>
                    
                    {/* Timeline content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <MedicationCard
                        medication={medication}
                        showRefillButton={false}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Alert severity="info">
              No medication history available.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Adherence Tracking
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Track how well you're following your medication schedule with detailed score visualization.
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : adherenceData ? (
            <AdherenceChart data={adherenceData} loading={loading} />
          ) : (
            <Alert severity="info">
              No adherence data available. Start tracking your medication adherence to see detailed insights and trends here.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Refill Requests
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            View and manage your medication refill requests with status tracking.
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : refillRequests && refillRequests.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {refillRequests
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((request) => (
                <RefillRequest
                  key={request._id}
                  request={request}
                  onCancel={handleCancelRefillRequest}
                  canCancel={true}
                  isCancelLoading={cancelLoading}
                />
              ))}
            </Box>
          ) : (
            <Alert severity="info">
              No refill requests found. You can request refills for your current medications from the "Current Medications" tab.
            </Alert>
          )}
        </TabPanel>
      </Paper>

      {/* Floating Action Button for quick actions */}
      <Fab
        color="primary"
        aria-label="add medication reminder"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', md: 'none' } // Only show on mobile
        }}
        onClick={() => {
          // This could open a quick action menu or navigate to add reminder

        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default PatientMedications;