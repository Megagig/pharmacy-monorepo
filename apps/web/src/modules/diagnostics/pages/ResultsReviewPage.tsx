import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Science as ScienceIcon,
  LocalHospital as HospitalIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';

// Import components
import {
  DiagnosticResultsPanel,
  PharmacistReviewPanel,
  RedFlagAlerts,
  InteractionAlerts,
  ConfidenceIndicator,
} from '../components';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';

// Import hooks and stores
import {
  useDiagnosticRequest,
  useDiagnosticResult,
  useApproveDiagnostic,
  useModifyDiagnostic,
  useRejectDiagnostic,
} from '../hooks/useDiagnostics';
import { usePatients } from '../../../stores';

// Import types
import type {
  DiagnosticRequest,
  DiagnosticResult,
  DrugInteraction,
} from '../types';
import DiagnosticFeatureGuard from '../middlewares/diagnosticFeatureGuard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({
  children,
  value,
  index,
  ...other
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

interface ActionDialogProps {
  open: boolean;
  type: 'approve' | 'modify' | 'reject' | 'export' | 'referral';
  onClose: () => void;
  onConfirm: (data?: any) => void;
  loading?: boolean;
}

const ActionDialog: React.FC<ActionDialogProps> = ({
  open,
  type,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [referralData, setReferralData] = useState({
    specialty: '',
    urgency: 'routine' as 'immediate' | 'within_24h' | 'routine',
    reason: '',
    notes: '',
  });

  const handleConfirm = () => {
    switch (type) {
      case 'modify':
        onConfirm(inputValue);
        break;
      case 'reject':
        onConfirm(inputValue);
        break;
      case 'referral':
        onConfirm(referralData);
        break;
      default:
        onConfirm();
    }
    setInputValue('');
    setReferralData({
      specialty: '',
      urgency: 'routine',
      reason: '',
      notes: '',
    });
  };

  const getDialogContent = () => {
    switch (type) {
      case 'approve':
        return {
          title: 'Approve Diagnostic Result',
          content: (
            <Typography>
              Are you sure you want to approve this diagnostic result? This will
              mark it as reviewed and approved for clinical use.
            </Typography>
          ),
          confirmText: 'Approve',
          confirmColor: 'success' as const,
        };
      case 'modify':
        return {
          title: 'Modify Diagnostic Result',
          content: (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Please provide your modifications to the diagnostic result:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Modifications"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe your modifications to the AI recommendations..."
              />
            </Box>
          ),
          confirmText: 'Save Modifications',
          confirmColor: 'primary' as const,
        };
      case 'reject':
        return {
          title: 'Reject Diagnostic Result',
          content: (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Please provide a reason for rejecting this diagnostic result:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Rejection Reason"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Explain why this result is being rejected..."
                required
              />
            </Box>
          ),
          confirmText: 'Reject Result',
          confirmColor: 'error' as const,
        };
      case 'export':
        return {
          title: 'Export Diagnostic Report',
          content: (
            <Typography>
              This will generate a comprehensive diagnostic report including all
              analysis, recommendations, and pharmacist review notes.
            </Typography>
          ),
          confirmText: 'Export PDF',
          confirmColor: 'primary' as const,
        };
      case 'referral':
        return {
          title: 'Create Referral',
          content: (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Create a referral based on this diagnostic analysis:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Specialty"
                    value={referralData.specialty}
                    onChange={(e) =>
                      setReferralData((prev) => ({
                        ...prev,
                        specialty: e.target.value,
                      }))
                    }
                    placeholder="e.g., Cardiology, Endocrinology"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Urgency"
                    value={referralData.urgency}
                    onChange={(e) =>
                      setReferralData((prev) => ({
                        ...prev,
                        urgency: e.target.value as any,
                      }))
                    }
                    SelectProps={{ native: true }}
                  >
                    <option value="routine">Routine</option>
                    <option value="within_24h">Within 24 Hours</option>
                    <option value="immediate">Immediate</option>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Reason for Referral"
                    value={referralData.reason}
                    onChange={(e) =>
                      setReferralData((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    placeholder="Primary reason for specialist consultation"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Additional Notes"
                    value={referralData.notes}
                    onChange={(e) =>
                      setReferralData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Additional clinical notes for the specialist"
                  />
                </Grid>
              </Grid>
            </Box>
          ),
          confirmText: 'Create Referral',
          confirmColor: 'primary' as const,
        };
      default:
        return {
          title: 'Confirm Action',
          content: <Typography>Are you sure you want to proceed?</Typography>,
          confirmText: 'Confirm',
          confirmColor: 'primary' as const,
        };
    }
  };

  const { title, content, confirmText, confirmColor } = getDialogContent();
  const canConfirm = type === 'reject' ? inputValue.trim().length > 0 : true;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ResultsReviewPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'approve' | 'modify' | 'reject' | 'export' | 'referral';
  }>({
    open: false,
    type: 'approve',
  });

  // Store state
  const { patients } = usePatients();

  // API queries
  const {
    data: requestData,
    isLoading: requestLoading,
    error: requestError,
  } = useDiagnosticRequest(requestId!);

  const {
    data: resultData,
    isLoading: resultLoading,
    error: resultError,
    refetch: refetchResult,
  } = useDiagnosticResult(requestId!, {
    enablePolling: requestData?.data?.status === 'processing',
    pollingInterval: 5000,
  });

  // Mutations
  const approveMutation = useApproveDiagnostic();
  const modifyMutation = useModifyDiagnostic();
  const rejectMutation = useRejectDiagnostic();

  // Data
  const request = requestData?.data as DiagnosticRequest | undefined;
  const result = resultData?.data as DiagnosticResult | undefined;
  const patient = patients.find((p) => p._id === request?.patientId);

  // Handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleActionClick = (type: typeof actionDialog.type) => {
    setActionDialog({ open: true, type });
  };

  const handleActionConfirm = async (data?: any) => {
    if (!result) return;

    try {
      switch (actionDialog.type) {
        case 'approve':
          await approveMutation.mutateAsync(result._id);
          break;
        case 'modify':
          await modifyMutation.mutateAsync({
            resultId: result._id,
            modifications: data,
          });
          break;
        case 'reject':
          await rejectMutation.mutateAsync({
            resultId: result._id,
            rejectionReason: data,
          });
          break;
        case 'export':
          // Handle export logic

          break;
        case 'referral':
          // Handle referral creation

          break;
      }

      setActionDialog({ open: false, type: 'approve' });
      refetchResult();
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const handleBack = () => {
    navigate('/pharmacy/diagnostics');
  };

  const handleCreateIntervention = () => {
    if (result) {
      navigate(
        `/clinical-interventions/create?diagnosticResultId=${result._id}`
      );
    }
  };

  // Loading state
  if (requestLoading || resultLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  // Error state
  if (requestError || resultError || !request) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load diagnostic data. Please try again.
        </Alert>
        <Button variant="contained" onClick={handleBack}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  // Processing state
  if (request.status === 'processing') {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={64} sx={{ mb: 3 }} />
            <Typography variant="h5" sx={{ mb: 2 }}>
              AI Analysis in Progress
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Your diagnostic case is being analyzed. This typically takes 10-30
              seconds.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Patient:{' '}
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
            </Typography>
          </CardContent>
        </Card>
      </Container>
    );
  }

  // No result yet
  if (!result) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Diagnostic analysis is not yet available for this case.
        </Alert>
        <Button variant="contained" onClick={handleBack}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  const isReviewed = result.pharmacistReview?.status !== undefined;
  const reviewStatus = result.pharmacistReview?.status;

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={handleBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                Diagnostic Results Review
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {patient
                  ? `${patient.firstName} ${patient.lastName}`
                  : 'Unknown Patient'}{' '}
                - Case ID: {request._id.slice(-8)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Print Report">
                <IconButton onClick={() => handleActionClick('export')}>
                  <PrintIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export PDF">
                <IconButton onClick={() => handleActionClick('export')}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton>
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Status and Actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={`Case ${request.status}`}
                color={request.status === 'completed' ? 'success' : 'default'}
                sx={{ textTransform: 'capitalize' }}
              />
              {isReviewed && (
                <Chip
                  label={`Review ${reviewStatus}`}
                  color={
                    reviewStatus === 'approved'
                      ? 'success'
                      : reviewStatus === 'modified'
                      ? 'warning'
                      : 'error'
                  }
                  sx={{ textTransform: 'capitalize' }}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                Analyzed{' '}
                {format(new Date(result.createdAt), 'MMM dd, yyyy HH:mm')}
              </Typography>
            </Box>

            {!isReviewed && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => handleActionClick('reject')}
                  disabled={rejectMutation.isPending}
                >
                  Reject
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleActionClick('modify')}
                  disabled={modifyMutation.isPending}
                >
                  Modify
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleActionClick('approve')}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </Button>
              </Box>
            )}

            {isReviewed && reviewStatus === 'approved' && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<HospitalIcon />}
                  onClick={() => handleActionClick('referral')}
                >
                  Create Referral
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AssignmentIcon />}
                  onClick={handleCreateIntervention}
                >
                  Create Intervention
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {/* Red Flags Alert */}
        {result.redFlags && result.redFlags.length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Critical Red Flags Detected
            </Typography>
            <RedFlagAlerts redFlags={result.redFlags} />
          </Alert>
        )}

        {/* Referral Recommendation */}
        {result.referralRecommendation?.recommended && (
          <Alert
            severity={
              result.referralRecommendation.urgency === 'immediate'
                ? 'error'
                : 'warning'
            }
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Referral Recommended -{' '}
              {result.referralRecommendation.urgency.replace('_', ' ')}
            </Typography>
            <Typography variant="body2">
              {result.referralRecommendation.specialty}:{' '}
              {result.referralRecommendation.reason}
            </Typography>
          </Alert>
        )}

        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="diagnostic results tabs"
            >
              <Tab label="Analysis Results" />
              <Tab label="Case Details" />
              <Tab label="Interactions" />
              <Tab label="Review History" />
            </Tabs>
          </Box>

          <TabPanel value={activeTab} index={0}>
            <DiagnosticResultsPanel
              result={result}
              onApprove={() => handleActionClick('approve')}
              onModify={(modifications) => handleActionClick('modify')}
              onReject={(reason) => handleActionClick('reject')}
              loading={
                approveMutation.isPending ||
                modifyMutation.isPending ||
                rejectMutation.isPending
              }
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              {/* Patient Information */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <PersonIcon sx={{ mr: 1 }} />
                    Patient Information
                  </Typography>
                  {patient && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Name:</strong> {patient.firstName}{' '}
                        {patient.lastName}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>DOB:</strong> {patient.dateOfBirth}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Gender:</strong> {patient.gender}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Phone:</strong> {patient.phoneNumber}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Case Input Summary */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <ScienceIcon sx={{ mr: 1 }} />
                    Case Input Summary
                  </Typography>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Primary Symptoms:</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {request.inputSnapshot.symptoms.subjective.join(', ')}
                    </Typography>

                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Duration:</strong>{' '}
                      {request.inputSnapshot.symptoms.duration}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Severity:</strong>{' '}
                      {request.inputSnapshot.symptoms.severity}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Onset:</strong>{' '}
                      {request.inputSnapshot.symptoms.onset}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Medications */}
              {request.inputSnapshot.currentMedications &&
                request.inputSnapshot.currentMedications.length > 0 && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                      <Typography
                        variant="h6"
                        sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                      >
                        <MedicationIcon sx={{ mr: 1 }} />
                        Current Medications
                      </Typography>
                      <List dense>
                        {request.inputSnapshot.currentMedications.map(
                          (med, index) => (
                            <ListItem key={index}>
                              <ListItemText
                                primary={med.name}
                                secondary={`${med.dosage} - ${med.frequency}`}
                              />
                            </ListItem>
                          )
                        )}
                      </List>
                    </Paper>
                  </Grid>
                )}

              {/* Allergies */}
              {request.inputSnapshot.allergies &&
                request.inputSnapshot.allergies.length > 0 && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 3 }}>
                      <Typography
                        variant="h6"
                        sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                      >
                        <WarningIcon sx={{ mr: 1 }} />
                        Known Allergies
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {request.inputSnapshot.allergies.map(
                          (allergy, index) => (
                            <Chip
                              key={index}
                              label={allergy}
                              color="warning"
                              size="small"
                            />
                          )
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                )}
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <InteractionAlerts
              medications={result.medicationSuggestions.map(
                (med) => med.drugName
              )}
              allergies={request.inputSnapshot.allergies || []}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <PharmacistReviewPanel
              result={result}
              onApprove={() => handleActionClick('approve')}
              onModify={(modifications) => handleActionClick('modify')}
              onReject={(reason) => handleActionClick('reject')}
              loading={
                approveMutation.isPending ||
                modifyMutation.isPending ||
                rejectMutation.isPending
              }
            />
          </TabPanel>
        </Card>

        {/* AI Metadata */}
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
            >
              <TrendingUpIcon sx={{ mr: 1 }} />
              AI Analysis Metadata
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Model:
                </Typography>
                <Typography variant="body2">
                  {result.aiMetadata.modelId} v{result.aiMetadata.modelVersion}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Confidence Score:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ConfidenceIndicator
                    score={result.aiMetadata.confidenceScore}
                  />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {Math.round(result.aiMetadata.confidenceScore * 100)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Processing Time:
                </Typography>
                <Typography variant="body2">
                  {result.aiMetadata.processingTime}ms
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Tokens Used:
                </Typography>
                <Typography variant="body2">
                  {result.aiMetadata.tokenUsage.totalTokens}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <ActionDialog
          open={actionDialog.open}
          type={actionDialog.type}
          onClose={() => setActionDialog({ open: false, type: 'approve' })}
          onConfirm={handleActionConfirm}
          loading={
            approveMutation.isPending ||
            modifyMutation.isPending ||
            rejectMutation.isPending
          }
        />
      </Container>
    </ErrorBoundary>
  );
};

// Wrap with feature guard
const ResultsReviewPageWithGuard: React.FC = () => (
  <DiagnosticFeatureGuard>
    <ResultsReviewPage />
  </DiagnosticFeatureGuard>
);

export default ResultsReviewPageWithGuard;
