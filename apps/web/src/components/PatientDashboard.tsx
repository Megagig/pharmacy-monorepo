import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { extractData } from '../utils/apiHelpers';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Chip,
  IconButton,
  Button,
  Alert,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ShareIcon from '@mui/icons-material/Share';
import WarningIcon from '@mui/icons-material/Warning';
import PersonIcon from '@mui/icons-material/Person';
import MedicationIcon from '@mui/icons-material/Medication';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TimelineIcon from '@mui/icons-material/Timeline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ScienceIcon from '@mui/icons-material/Science';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CakeIcon from '@mui/icons-material/Cake';

import { usePatient, usePatientSummary } from '../queries/usePatients';
import { usePatientLabOrders } from '../hooks/useManualLabOrders';
import { PatientMTRWidget } from './PatientMTRWidget';
import PatientClinicalNotes from './PatientClinicalNotes';
import PatientLabOrderWidget from './PatientLabOrderWidget';
import PatientLabIntegrationWidget from './PatientLabIntegrationWidget';
import PatientTimelineWidget from './PatientTimelineWidget';
import PatientAppointmentAlerts from './PatientAppointmentAlerts';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import type { Patient } from '../types/patientManagement';

interface PatientDashboardProps {
  patientId?: string;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({
  patientId: propPatientId,
}) => {
  const { patientId: routePatientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const patientId = propPatientId || routePatientId;

  // Feature flags
  const { isFeatureEnabled } = useFeatureFlags();
  const hasClinicalNotesFeature = isFeatureEnabled('clinical_notes');

  // React Query hooks
  const {
    data: patientResponse,
    isLoading: patientLoading,
    isError: patientError,
    error,
  } = usePatient(patientId!);

  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    isError: summaryError,
  } = usePatientSummary(patientId!);

  const { data: labOrders = [], isLoading: labOrdersLoading } =
    usePatientLabOrders(patientId!, { enabled: !!patientId });

  const patientData = extractData(patientResponse)?.patient;
  const summaryData = extractData(summaryResponse);

  // Extract real data from API response
  const overview = summaryData
    ? {
      totalActiveMedications: summaryData.counts?.currentMedications || 0,
      totalActiveDTPs: summaryData.counts?.hasActiveDTP ? 1 : 0, // Convert boolean to count
      totalActiveConditions: summaryData.counts?.conditions || 0,
      recentVisits: summaryData.counts?.visits || 0,
      totalInterventions: summaryData.counts?.interventions || 0,
      activeInterventions: summaryData.counts?.activeInterventions || 0,
    }
    : {
      totalActiveMedications: 0,
      totalActiveDTPs: 0,
      totalActiveConditions: 0,
      recentVisits: 0,
      totalInterventions: 0,
      activeInterventions: 0,
    };

  if (patientLoading || summaryLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton
          variant="rectangular"
          width="100%"
          height={200}
          sx={{ mb: 3 }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {[...Array(6)].map((_, index) => (
            <Box key={index} sx={{ flex: '1 1 300px', minWidth: 0 }}>
              <Skeleton variant="rectangular" width="100%" height={150} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (patientError || summaryError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6">Failed to load patient data</Typography>
          <Typography variant="body2">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred.'}
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

  if (!patientData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <Typography variant="h6">Patient not found</Typography>
          <Typography variant="body2">
            The requested patient could not be found.
          </Typography>
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/patients')}
          sx={{ mt: 2 }}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

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

  const getPatientAge = (patient: Patient): string => {
    if (patient.age !== undefined) return `${patient.age} years`;
    const calculatedAge = calculateAge(patient.dob);
    return calculatedAge ? `${calculatedAge} years` : 'Unknown';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Patient Info */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={() => navigate('/patients')}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: 'primary.main',
              fontSize: '1.5rem',
            }}
          >
            {getInitials(patientData.firstName, patientData.lastName)}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              {patientData.firstName} {patientData.lastName}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center',
              }}
            >
              <Typography variant="body1" color="text.secondary">
                MRN: {patientData.mrn}
              </Typography>
              <Chip
                label={`${getPatientAge(patientData)} • ${patientData.gender || 'Unknown'
                  }`}
                size="small"
                variant="outlined"
              />
              {patientData.bloodGroup && (
                <Chip
                  label={patientData.bloodGroup}
                  size="small"
                  color="primary"
                />
              )}
              {patientData.genotype && (
                <Chip
                  label={patientData.genotype}
                  size="small"
                  color={
                    patientData.genotype.includes('S') ? 'warning' : 'success'
                  }
                />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => navigate(`/patients/${patientId}/edit`)}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => window.print()}>
              <PrintIcon />
            </IconButton>
            <IconButton
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Patient Profile - ${patientData.firstName} ${patientData.lastName}`,
                    text: `Patient profile for ${patientData.firstName} ${patientData.lastName} (MRN: ${patientData.mrn})`,
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
            >
              <ShareIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Quick Stats Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <MedicationIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {overview?.totalActiveMedications || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Medications
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {overview?.totalActiveDTPs || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active DTPs
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <AssessmentIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {overview?.totalActiveConditions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Conditions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <ScheduleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {overview?.recentVisits || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recent Visits
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <ScienceIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {labOrdersLoading ? '...' : labOrders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lab Orders
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <TimelineIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {overview?.totalInterventions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Interventions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Appointment Alerts */}
      <PatientAppointmentAlerts
        patientId={patientId!}
        onCreateAppointment={() => navigate(`/appointments/create?patientId=${patientId}`)}
        onViewAppointment={(appointmentId) => navigate(`/appointments/${appointmentId}`)}
      />

      {/* MTR Integration Widget */}
      <Box sx={{ mb: 4 }}>
        <PatientMTRWidget patientId={patientId!} />
      </Box>

      {/* Clinical Notes Widget - Only show if feature is enabled */}
      {hasClinicalNotesFeature && (
        <Box sx={{ mb: 4 }}>
          <PatientClinicalNotes
            patientId={patientId!}
            maxNotes={5}
            showCreateButton={true}
          />
        </Box>
      )}

      {/* Lab Order History Widget */}
      <Box sx={{ mb: 4 }}>
        <PatientLabOrderWidget
          patientId={patientId!}
          maxOrders={3}
          onViewOrder={(orderId) => {
            // Navigate to order details
            navigate(`/lab-orders/${orderId}`);
          }}
          onViewResults={(orderId) => {
            // Navigate to results entry/view
            navigate(`/lab-orders/${orderId}/results`);
          }}
          onViewAllOrders={() => {
            // Navigate to full lab order history
            navigate(`/patients/${patientId}/lab-orders`);
          }}
        />
      </Box>

      {/* Lab Integration Widget */}
      <Box sx={{ mb: 4 }}>
        <PatientLabIntegrationWidget
          patientId={patientId!}
          maxCases={5}
          onViewCase={(caseId) => {
            navigate(`/pharmacy/lab-integration/${caseId}`);
          }}
          onViewAllCases={() => {
            navigate(`/pharmacy/lab-integration?patientId=${patientId}`);
          }}
          onCreateCase={() => {
            navigate(`/pharmacy/lab-integration/new?patientId=${patientId}`);
          }}
        />
      </Box>

      {/* Patient Details and Timeline */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        {/* Patient Details */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card>
            <CardHeader
              title="Patient Information"
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              avatar={<PersonIcon color="primary" />}
            />
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PhoneIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Phone
                    </Typography>
                    <Typography variant="body1">
                      {patientData.phone || 'Not provided'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">
                      {patientData.email || 'Not provided'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LocationOnIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Location
                    </Typography>
                    <Typography variant="body1">
                      {patientData.state || 'Unknown'},{' '}
                      {patientData.lga || 'Unknown LGA'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CakeIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Date of Birth
                    </Typography>
                    <Typography variant="body1">
                      {patientData.dob
                        ? new Date(patientData.dob).toLocaleDateString()
                        : 'Unknown'}
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Patient Timeline */}
        <Box sx={{ flex: '1 1 600px', minWidth: 0 }}>
          <PatientTimelineWidget
            patientId={patientId!}
            maxItems={5}
            onViewLabOrder={(orderId) => {
              navigate(`/lab-orders/${orderId}`);
            }}
            onViewClinicalNote={(noteId) => {
              navigate(`/clinical-notes/${noteId}`);
            }}
            onViewMTR={(mtrId) => {
              navigate(`/mtr/${mtrId}`);
            }}
          />
        </Box>
      </Box>

      {/* Patient Summary */}
      <Card>
        <CardHeader
          title="Patient Summary"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          avatar={<AssignmentIcon color="primary" />}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {summaryData?.counts?.hasActiveDTP && (
              <Chip
                label="Has Active DTP"
                color="warning"
                icon={<WarningIcon />}
              />
            )}
            {summaryData?.counts?.hasActiveInterventions && (
              <Chip
                label="Active Interventions"
                color="info"
                icon={<TimelineIcon />}
              />
            )}
            {overview?.totalActiveMedications > 0 && (
              <Chip
                label={`${overview.totalActiveMedications} Active Medications`}
                color="primary"
                variant="outlined"
              />
            )}
            {overview?.totalActiveConditions > 0 && (
              <Chip
                label={`${overview.totalActiveConditions} Active Conditions`}
                color="secondary"
                variant="outlined"
              />
            )}
            {!summaryData?.counts?.hasActiveDTP &&
              !summaryData?.counts?.hasActiveInterventions &&
              overview?.totalActiveMedications === 0 &&
              overview?.totalActiveConditions === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No active clinical issues identified
                </Typography>
              )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientDashboard;
