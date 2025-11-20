import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  Divider,
  Tabs,
  Tab,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import { useLabIntegration, useRequestAIInterpretation } from '../hooks/useLabIntegration';
import AIInterpretationDisplay from '../components/lab-integration/AIInterpretationDisplay';
import TherapyRecommendationReview from '../components/lab-integration/TherapyRecommendationReview';
import MedicationAdjustmentInterface from '../components/lab-integration/MedicationAdjustmentInterface';
import LabTrendVisualization from '../components/lab-integration/LabTrendVisualization';
import SafetyChecksDisplay from '../components/lab-integration/SafetyChecksDisplay';
import PhysicianEscalationDialog from '../components/lab-integration/PhysicianEscalationDialog';
import CriticalAlertDialog from '../components/lab-integration/CriticalAlertDialog';
import ReviewWorkflowBanner from '../components/lab-integration/ReviewWorkflowBanner';
import PatientInterpretationEditor from '../components/lab-integration/PatientInterpretationEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const LabIntegrationCaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam ? parseInt(tabParam, 10) : 0;
  });
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [criticalAlertOpen, setCriticalAlertOpen] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<any>(null);

  // Fetch case data
  const { data: labIntegration, isLoading, error, refetch } = useLabIntegration(id || '', !!id);
  const requestAIMutation = useRequestAIInterpretation();

  // Check for critical alerts when data loads
  useEffect(() => {
    if (labIntegration) {
      // Check for critical values
      const hasCriticalValues = labIntegration.labResultIds?.some((result: any) => result.isCritical);
      const hasCriticalInterpretation = labIntegration.aiInterpretation?.clinicalSignificance === 'critical';
      const hasCriticalSafety = labIntegration.criticalSafetyIssues;

      if (hasCriticalValues || hasCriticalInterpretation || hasCriticalSafety) {
        // Show critical alert dialog
        const alert = {
          type: hasCriticalValues ? 'critical_value' : hasCriticalInterpretation ? 'critical_interpretation' : 'critical_safety_issue',
          severity: 'critical' as const,
          message: hasCriticalValues
            ? 'Critical lab values detected'
            : hasCriticalInterpretation
              ? 'AI interpretation indicates critical clinical significance'
              : 'Critical safety issues detected',
          details: {
            summary: labIntegration.aiInterpretation?.summary,
            recommendedActions: labIntegration.aiInterpretation?.recommendedActions
          }
        };
        setCriticalAlert(alert);
        setCriticalAlertOpen(true);
      }
    }
  }, [labIntegration]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleBack = () => {
    navigate('/pharmacy/lab-integration');
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleRequestAI = async () => {
    if (!id) return;

    try {
      await requestAIMutation.mutateAsync(id);
      toast.success('AI interpretation requested successfully. Processing will begin shortly.');
    } catch (error: any) {
      // Extract error message from response
      const errorMessage = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Failed to request AI interpretation';

      // Show user-friendly error message
      toast.error(errorMessage, {
        duration: 5000,
      });

      // Log detailed error for debugging
      console.error('AI interpretation request failed:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
      });
    }
  };

  const handleEscalate = () => {
    setEscalationDialogOpen(true);
  };

  const handleEscalationSuccess = () => {
    refetch();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
      draft: 'default',
      pending_interpretation: 'info',
      pending_review: 'warning',
      pending_approval: 'warning',
      approved: 'success',
      implemented: 'success',
      completed: 'success',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  const getUrgencyColor = (urgency?: string) => {
    const colors: Record<string, 'default' | 'warning' | 'error'> = {
      routine: 'default',
      urgent: 'warning',
      stat: 'error',
    };
    return colors[urgency || 'routine'] || 'default';
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} />
      </Container>
    );
  }

  if (error || !labIntegration) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Failed to load lab integration case. Please try again.
        </Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Helmet>
        <title>Lab Integration Case | PharmaCare</title>
      </Helmet>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleBack}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScienceIcon fontSize="large" />
                Lab Integration Case
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Case ID: {labIntegration._id.slice(0, 8).toUpperCase()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {labIntegration.status === 'draft' && (
              <Button
                variant="contained"
                onClick={handleRequestAI}
                disabled={requestAIMutation.isPending}
              >
                Request AI Interpretation
              </Button>
            )}
            {(labIntegration.criticalSafetyIssues ||
              labIntegration.aiInterpretation?.clinicalSignificance === 'critical' ||
              labIntegration.labResultIds?.some((r: any) => r.isCritical)) && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<LocalHospitalIcon />}
                  onClick={handleEscalate}
                >
                  Escalate to Physician
                </Button>
              )}
          </Box>
        </Box>

        {/* Review Workflow Banner */}
        <ReviewWorkflowBanner
          labIntegration={labIntegration}
          onStartReview={() => setActiveTab(1)}
        />

        {/* Status Banner */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Chip
                  label={labIntegration.status.replace(/_/g, ' ').toUpperCase()}
                  color={getStatusColor(labIntegration.status)}
                  size="medium"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Urgency
                </Typography>
                <Chip
                  label={labIntegration.urgency?.toUpperCase() || 'ROUTINE'}
                  color={getUrgencyColor(labIntegration.urgency)}
                  size="medium"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Created
                </Typography>
                <Typography variant="body1">
                  {format(new Date(labIntegration.createdAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Source
                </Typography>
                <Typography variant="body1">
                  {labIntegration.source.replace(/_/g, ' ').toUpperCase()}
                </Typography>
              </Grid>
            </Grid>

            {/* Progress Indicator */}
            {labIntegration.status === 'pending_interpretation' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  AI Interpretation in Progress...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {/* Review Required Alert */}
            {labIntegration.status === 'pending_review' && (
              <Alert 
                severity="warning" 
                sx={{ mt: 2 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={() => setActiveTab(1)}
                    startIcon={<AssignmentIcon />}
                  >
                    Review Now
                  </Button>
                }
              >
                <Typography variant="subtitle2" gutterBottom>
                  Pharmacist Review Required
                </Typography>
                <Typography variant="body2">
                  This case requires pharmacist review of AI-generated therapy recommendations.
                </Typography>
              </Alert>
            )}

            {/* Critical Alert */}
            {labIntegration.urgency === 'stat' && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  STAT CASE - Immediate Attention Required
                </Typography>
                <Typography variant="body2">
                  This case has been flagged as critical and requires immediate pharmacist review.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab
                label="AI Interpretation"
                icon={<ScienceIcon />}
                iconPosition="start"
              />
              <Tab
                label="Therapy Recommendations"
                icon={<AssignmentIcon />}
                iconPosition="start"
              />
              <Tab
                label="Safety Checks"
                icon={<SecurityIcon />}
                iconPosition="start"
              />
              <Tab
                label="Medication Adjustments"
                icon={<CheckCircleIcon />}
                iconPosition="start"
              />
              <Tab
                label="Lab Trends"
                icon={<TrendingUpIcon />}
                iconPosition="start"
              />
              <Tab
                label="Patient Interpretation"
                icon={<PersonIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <TabPanel value={activeTab} index={0}>
            <AIInterpretationDisplay
              interpretation={labIntegration.aiInterpretation}
              status={labIntegration.status}
              aiProcessingStatus={labIntegration.aiProcessingStatus}
              aiProcessingError={labIntegration.aiProcessingError}
              onRequestInterpretation={handleRequestAI}
              loading={requestAIMutation.isPending}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <TherapyRecommendationReview
              labIntegrationId={labIntegration._id}
              recommendations={labIntegration.therapyRecommendations}
              pharmacistReview={labIntegration.pharmacistReview}
              status={labIntegration.status}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <SafetyChecksDisplay safetyChecks={labIntegration.safetyChecks} />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <MedicationAdjustmentInterface
              labIntegrationId={labIntegration._id}
              adjustments={labIntegration.medicationAdjustments}
              recommendations={labIntegration.therapyRecommendations}
              status={labIntegration.status}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            <LabTrendVisualization
              patientId={labIntegration.patientId}
              labResultIds={labIntegration.labResultIds}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={5}>
            <PatientInterpretationEditor
              labIntegrationId={labIntegration._id}
              patientName={`${labIntegration.patientId?.firstName || ''} ${labIntegration.patientId?.lastName || ''}`}
              onUpdate={() => {
                // Optionally refresh the case data
                window.location.reload();
              }}
            />
          </TabPanel>
        </Card>

        {/* Physician Escalation Dialog */}
        <PhysicianEscalationDialog
          open={escalationDialogOpen}
          onClose={() => setEscalationDialogOpen(false)}
          labIntegrationId={labIntegration._id}
          patientName={`${labIntegration.patientId?.firstName || ''} ${labIntegration.patientId?.lastName || ''}`}
          onSuccess={handleEscalationSuccess}
        />

        {/* Critical Alert Dialog */}
        <CriticalAlertDialog
          open={criticalAlertOpen}
          onClose={() => setCriticalAlertOpen(false)}
          alert={criticalAlert}
          labIntegrationId={labIntegration._id}
          patientName={`${labIntegration.patientId?.firstName || ''} ${labIntegration.patientId?.lastName || ''}`}
          onEscalate={handleEscalate}
        />
      </Container>
    </>
  );
};

export default LabIntegrationCaseDetail;

