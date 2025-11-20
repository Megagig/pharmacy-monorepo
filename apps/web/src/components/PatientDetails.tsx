import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Avatar,
  Chip,
  IconButton,
  Button,
  Stack,
  Alert,
  Skeleton,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ShareIcon from '@mui/icons-material/Share';
import WarningIcon from '@mui/icons-material/Warning';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import MedicationIcon from '@mui/icons-material/Medication';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import BiotechIcon from '@mui/icons-material/Biotech';

import { useRBAC } from '../hooks/useRBAC';
import { RBACGuard } from '../hooks/useRBAC';

import { usePatient } from '../queries/usePatients';
// import { usePatientOverview } from '../queries/usePatientResources';
import AllergyManagement from './AllergyManagement';
import ConditionManagement from './ConditionManagement';
import MedicationManagement from './MedicationManagement';
import ClinicalAssessment from './ClinicalAssessment';
import DTPManagement from './DTPManagement';
import CarePlanManagement from './CarePlanManagement';
import VisitManagement from './VisitManagement';
import PatientMTRSessionsTab from './PatientMTRSessionsTab';
import PatientLabResultsTab from './PatientLabResultsTab';
import type { Patient } from '../types/patientManagement';

// Tab panel component
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
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Helper function for tab accessibility
function a11yProps(index: number) {
  return {
    id: `patient-tab-${index}`,
    'aria-controls': `patient-tabpanel-${index}`,
  };
}

const PatientDetails = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);

  // RBAC permissions
  // RBAC hook for role-based access control
  useRBAC();

  // React Query hooks
  const {
    data: patientResponse,
    isLoading: patientLoading,
    isError: patientError,
    error,
  } = usePatient(patientId || '');

  const patient = patientResponse?.data?.patient;

  // Utility functions
  const calculateAge = (dob?: string): number | null => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatNigerianPhone = (phone?: string): string => {
    if (!phone) return 'N/A';
    if (phone.startsWith('+234')) {
      const number = phone.slice(4);
      return `+234 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(
        6
      )}`;
    }
    return phone;
  };

  const getDisplayName = (patient?: Patient): string => {
    if (!patient) return '';
    return patient.displayName || `${patient.firstName} ${patient.lastName}`;
  };

  const getPatientAge = (patient?: Patient): string => {
    if (!patient) return 'Unknown';
    if (patient.age !== undefined) return `${patient.age} years`;
    if (patient.calculatedAge !== undefined)
      return `${patient.calculatedAge} years`;
    const calculatedAge = calculateAge(patient.dob);
    return calculatedAge ? `${calculatedAge} years` : 'Unknown';
  };

  const getInitials = (patient?: Patient): string => {
    if (!patient) return '??';
    return `${patient.firstName[0] || ''}${patient.lastName[0] || ''
      }`.toUpperCase();
  };

  // Tab change handler
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Loading state
  if (patientLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton
          variant="rectangular"
          height={200}
          sx={{ mb: 3, borderRadius: 2 }}
        />
        <Skeleton
          variant="rectangular"
          height={60}
          sx={{ mb: 3, borderRadius: 2 }}
        />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  // Error state
  if (patientError || !patient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Failed to load patient details</Typography>
          <Typography variant="body2">
            {error instanceof Error
              ? error.message
              : 'Patient not found or unable to load patient data.'}
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/patients')}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/patients')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Patient Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive patient information and medical records
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <RBACGuard action="canUpdate">
            <Tooltip title="Edit Patient">
              <IconButton
                color="primary"
                onClick={() => navigate(`/patients/${patientId}/edit`)}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          </RBACGuard>
          <Tooltip title="Print Profile">
            <IconButton
              color="primary"
              onClick={() => {
                window.print();
              }}
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share">
            <IconButton
              color="primary"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Patient Profile - ${getDisplayName(patient)}`,
                    text: `Patient profile for ${getDisplayName(
                      patient
                    )} (MRN: ${patient.mrn})`,
                    url: window.location.href,
                  });
                } else {
                  // Fallback: copy URL to clipboard
                  navigator.clipboard.writeText(window.location.href);
                  // You could add a toast notification here
                }
              }}
            >
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Patient Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                fontSize: '2rem',
                fontWeight: 600,
              }}
            >
              {getInitials(patient)}
            </Avatar>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                {getDisplayName(patient)}
                {patient.otherNames && (
                  <Typography
                    component="span"
                    variant="h6"
                    color="text.secondary"
                    sx={{ ml: 1, fontWeight: 400 }}
                  >
                    ({patient.otherNames})
                  </Typography>
                )}
              </Typography>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ fontFamily: 'monospace', mb: 1 }}
              >
                MRN: {patient.mrn}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={`${getPatientAge(patient)} • ${patient.gender || 'Unknown'
                    }`}
                  variant="outlined"
                  size="small"
                />
                {patient.bloodGroup && (
                  <Chip
                    label={`Blood: ${patient.bloodGroup}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                {patient.genotype && (
                  <Chip
                    label={`Genotype: ${patient.genotype}`}
                    color={
                      patient.genotype.includes('S') ? 'warning' : 'success'
                    }
                    variant="outlined"
                    size="small"
                  />
                )}
                {patient.hasActiveDTP && (
                  <Chip
                    label="Active DTP"
                    color="error"
                    size="small"
                    icon={<WarningIcon />}
                  />
                )}
              </Stack>
            </Box>

            <Stack spacing={1} alignItems="flex-end">
              <Typography variant="body2" color="text.secondary">
                Contact
              </Typography>
              <Typography variant="body2">
                {formatNigerianPhone(patient.phone)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {patient.email || 'No email'}
              </Typography>
              <Typography variant="body2">
                {patient.state && patient.lga
                  ? `${patient.lga}, ${patient.state}`
                  : patient.state || 'Unknown location'}
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="patient details tabs"
          >
            <Tab
              label="Overview"
              icon={<AccountBoxIcon />}
              iconPosition="start"
              {...a11yProps(0)}
            />
            <Tab
              label="Allergies"
              icon={<LocalHospitalIcon />}
              iconPosition="start"
              {...a11yProps(1)}
            />
            <Tab
              label="Conditions"
              icon={<PersonIcon />}
              iconPosition="start"
              {...a11yProps(2)}
            />
            <Tab
              label="Medications"
              icon={<MedicationIcon />}
              iconPosition="start"
              {...a11yProps(3)}
            />
            <Tab
              label="Assessments"
              icon={<AssessmentIcon />}
              iconPosition="start"
              {...a11yProps(4)}
            />
            <Tab
              label="Care Plans"
              icon={<AssignmentIcon />}
              iconPosition="start"
              {...a11yProps(5)}
            />
            <Tab
              label="Visits"
              icon={<VisibilityIcon />}
              iconPosition="start"
              {...a11yProps(6)}
            />
            <Tab
              label="DTPs"
              icon={<WarningIcon />}
              iconPosition="start"
              {...a11yProps(7)}
            />
            <Tab
              label="MTR Sessions"
              icon={<LocalPharmacyIcon />}
              iconPosition="start"
              {...a11yProps(8)}
            />
            <Tab
              label="Laboratory"
              icon={<BiotechIcon />}
              iconPosition="start"
              {...a11yProps(9)}
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={currentTab} index={0}>
          <PatientOverviewTab patient={patient} />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <AllergiesTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ConditionsTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <MedicationsTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <AssessmentsTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={5}>
          <CarePlansTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={6}>
          <VisitsTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={7}>
          <DTPs patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={8}>
          <PatientMTRSessionsTab patientId={patientId!} />
        </TabPanel>

        <TabPanel value={currentTab} index={9}>
          <PatientLabResultsTab patientId={patientId!} />
        </TabPanel>
      </Card>
    </Box>
  );
};

// Overview Tab Component
const PatientOverviewTab = ({ patient }: { patient: Patient }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 3,
      }}
    >
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Demographics
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Full Name
              </Typography>
              <Typography variant="body1">
                {patient.firstName} {patient.lastName}
                {patient.otherNames && ` (${patient.otherNames})`}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Date of Birth
              </Typography>
              <Typography variant="body1">
                {patient.dob
                  ? new Date(patient.dob).toLocaleDateString()
                  : 'Not specified'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Gender
              </Typography>
              <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                {patient.gender || 'Not specified'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Marital Status
              </Typography>
              <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                {patient.maritalStatus || 'Not specified'}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Medical Information
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Blood Group
              </Typography>
              <Typography variant="body1">
                {patient.bloodGroup || 'Not determined'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Genotype
              </Typography>
              <Typography variant="body1">
                {patient.genotype || 'Not determined'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Weight
              </Typography>
              <Typography variant="body1">
                {patient.weightKg ? `${patient.weightKg} kg` : 'Not recorded'}
              </Typography>
            </Box>
            {patient.latestVitals && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Latest Vitals
                </Typography>
                <Typography variant="body1">
                  BP: {patient.latestVitals.bpSys}/{patient.latestVitals.bpDia}{' '}
                  mmHg
                  {patient.latestVitals.tempC &&
                    `, Temp: ${patient.latestVitals.tempC}°C`}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Contact & Location
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Phone
              </Typography>
              <Typography variant="body1">
                {patient.phone || 'Not provided'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1">
                {patient.email || 'Not provided'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Location
              </Typography>
              <Typography variant="body1">
                {patient.state && patient.lga
                  ? `${patient.lga}, ${patient.state}`
                  : patient.state || 'Not specified'}
              </Typography>
            </Box>
            {patient.address && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="body2" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1">{patient.address}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

// Placeholder tab components (to be implemented in subsequent tasks)
const AllergiesTab = ({ patientId }: { patientId: string }) => (
  <AllergyManagement patientId={patientId} />
);

const ConditionsTab = ({ patientId }: { patientId: string }) => (
  <ConditionManagement patientId={patientId} />
);

const MedicationsTab = ({ patientId }: { patientId: string }) => (
  <MedicationManagement patientId={patientId} />
);

const AssessmentsTab = ({ patientId }: { patientId: string }) => (
  <ClinicalAssessment patientId={patientId} />
);

const CarePlansTab = ({ patientId }: { patientId: string }) => (
  <CarePlanManagement patientId={patientId} />
);

const DTPs = ({ patientId }: { patientId: string }) => (
  <DTPManagement patientId={patientId} />
);

const VisitsTab = ({ patientId }: { patientId: string }) => (
  <VisitManagement patientId={patientId} />
);

export default PatientDetails;
