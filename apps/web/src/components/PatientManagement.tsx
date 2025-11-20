import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { extractData } from '../utils/apiHelpers';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Button,
  Stack,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import MedicationIcon from '@mui/icons-material/Medication';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DescriptionIcon from '@mui/icons-material/Description';
import BiotechIcon from '@mui/icons-material/Biotech';
import EventIcon from '@mui/icons-material/Event';

// Import existing components
import PatientDashboard from './PatientDashboard';
import { usePatientAppointments } from '../hooks/useAppointments';
import { MTRStatusIndicator } from './MTRStatusIndicator';
import AllergyManagement from './AllergyManagement';
import ConditionManagement from './ConditionManagement';
import MedicationManagement from './MedicationManagement';
import ClinicalAssessment from './ClinicalAssessment';
import DTPManagement from './DTPManagement';
import CarePlanManagement from './CarePlanManagement';
import VisitManagement from './VisitManagement';
// import PatientMTRWidget from './PatientMTRWidget';
import PatientMTRSessionsList from './PatientMTRSessionsList';
import PatientClinicalNotes from './PatientClinicalNotes';
import PatientDiagnosisList from './PatientDiagnosisList';
import PatientVitalsTab from './PatientVitalsTab';
import PatientAppointmentsList from './PatientAppointmentsList';

import { usePatient } from '../queries/usePatients';
import { useRBAC } from '../hooks/useRBAC';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 0 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `patient-tab-${index}`,
    'aria-controls': `patient-tabpanel-${index}`,
  };
}

const PatientManagement = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);

  // RBAC permissions
  useRBAC();

  // React Query hooks
  const {
    data: patientResponse,
    isLoading: patientLoading,
    isError: patientError,
    error,
  } = usePatient(patientId || '');

  // Get upcoming appointments count for header
  const {
    data: appointmentsResponse,
  } = usePatientAppointments(patientId || '', { limit: 10 });

  const patient = extractData(patientResponse)?.patient;
  const appointments = appointmentsResponse?.data?.appointments || [];
  const upcomingAppointments = appointments.filter(apt => 
    new Date(`${apt.scheduledDate}T${apt.scheduledTime}`) > new Date() && 
    apt.status !== 'cancelled'
  ).length;

  // Handle tab changes
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Loading state
  if (patientLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width={200} height={40} />
        </Stack>
        <Skeleton
          variant="rectangular"
          width="100%"
          height={60}
          sx={{ mb: 3 }}
        />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  // Error state
  if (patientError) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate('/patients')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Patient Management</Typography>
        </Stack>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Failed to load patient</Typography>
          <Typography variant="body2">
            {(error as Error)?.message ||
              'An unexpected error occurred while loading patient data.'}
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          onClick={() => navigate('/patients')}
          startIcon={<ArrowBackIcon />}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  // Patient not found state
  if (!patient) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate('/patients')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">Patient Management</Typography>
        </Stack>
        <Alert severity="warning">
          <Typography variant="h6">Patient not found</Typography>
          <Typography variant="body2">
            The requested patient could not be found.
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          onClick={() => navigate('/patients')}
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  const getTabIcon = (index: number) => {
    const icons = [
      <DashboardIcon />,
      <DescriptionIcon />,
      <EventIcon />,
      <PersonIcon />,
      <LocalHospitalIcon />,
      <MedicationIcon />,
      <AssessmentIcon />,
      <WarningIcon />,
      <AssignmentIcon />,
      <VisibilityIcon />,
      <AssignmentIcon />,
      <BiotechIcon />,
    ];
    return icons[index];
  };

  const tabLabels = [
    'Dashboard',
    'Clinical Notes',
    'Appointments',
    'Allergies',
    'Conditions',
    'Medications',
    'Assessments',
    'DTPs',
    'Care Plans',
    'Visits',
    'MTR Sessions',
    'Diagnosis',
    'Vitals',
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <IconButton
              onClick={() => navigate('/patients')}
              sx={{ bgcolor: 'action.hover' }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                {patient.firstName} {patient.lastName}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  MRN: {patient.mrn}
                </Typography>
                {patient.hasActiveDTP && (
                  <Chip
                    icon={<WarningIcon />}
                    label="Active DTPs"
                    color="warning"
                    size="small"
                  />
                )}
                {patient.genotype &&
                  ['SS', 'SC', 'CC'].includes(patient.genotype) && (
                    <Chip
                      icon={<LocalHospitalIcon />}
                      label={`Sickle Cell - ${patient.genotype}`}
                      color="error"
                      size="small"
                    />
                  )}
                <MTRStatusIndicator
                  patientId={patientId || ''}
                  variant="chip"
                  showActions={false}
                />
                {upcomingAppointments > 0 && (
                  <Chip
                    icon={<EventIcon />}
                    label={`${upcomingAppointments} upcoming appointment${upcomingAppointments > 1 ? 's' : ''}`}
                    color="primary"
                    size="small"
                  />
                )}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<EventIcon />}
                onClick={() => navigate(`/appointments/create?patientId=${patientId}`)}
                color="primary"
              >
                Schedule Appointment
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditNoteIcon />}
                onClick={() => navigate(`/patients/${patientId}/edit`)}
              >
                Edit Patient
              </Button>
            </Stack>
          </Stack>

          {/* Navigation Tabs */}
          <Paper elevation={0} sx={{ borderRadius: 2 }}>
            <Tabs
              value={currentTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontWeight: 500,
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: 1.5,
                },
              }}
            >
              {tabLabels.map((label, index) => (
                <Tab
                  key={label}
                  label={label}
                  icon={getTabIcon(index)}
                  iconPosition="start"
                  {...a11yProps(index)}
                  sx={{
                    gap: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                  }}
                />
              ))}
            </Tabs>
          </Paper>
        </Box>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flexGrow: 1 }}>
        <TabPanel value={currentTab} index={0}>
          <PatientDashboard patientId={patientId} />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Box sx={{ p: 3 }}>
            <PatientClinicalNotes
              patientId={patientId || ''}
              maxNotes={10}
              showCreateButton={true}
              onCreateNote={() => navigate(`/notes/new?patientId=${patientId}`)}
              onViewNote={(noteId) => navigate(`/notes/${noteId}`)}
              onEditNote={(noteId) => navigate(`/notes/${noteId}/edit`)}
            />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Box sx={{ p: 3 }}>
            <PatientAppointmentsList 
              patientId={patientId || ''} 
              showCreateButton={true}
              showHeader={false}
            />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Box sx={{ p: 3 }}>
            <AllergyManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <Box sx={{ p: 3 }}>
            <ConditionManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={5}>
          <Box sx={{ p: 3 }}>
            <MedicationManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={6}>
          <Box sx={{ p: 3 }}>
            <ClinicalAssessment patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={7}>
          <Box sx={{ p: 3 }}>
            <DTPManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={8}>
          <Box sx={{ p: 3 }}>
            <CarePlanManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={9}>
          <Box sx={{ p: 3 }}>
            <VisitManagement patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={10}>
          <Box sx={{ p: 3 }}>
            <PatientMTRSessionsList patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={11}>
          <Box sx={{ p: 3 }}>
            <PatientDiagnosisList patientId={patientId || ''} />
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={12}>
          <PatientVitalsTab patientId={patientId || ''} />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default PatientManagement;
