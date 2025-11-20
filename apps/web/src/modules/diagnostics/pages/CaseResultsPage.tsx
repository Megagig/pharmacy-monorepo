import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import DiagnosticFeatureGuard from '../middlewares/diagnosticFeatureGuard';
import AIAnalysisResults from '../components/AIAnalysisResults';
import ScheduleDiagnosticFollowUp from '../../../components/diagnostics/ScheduleDiagnosticFollowUp';
import DiagnosticLinkedAppointments from '../../../components/diagnostics/DiagnosticLinkedAppointments';
import { useDiagnosticEngagementData } from '../../../hooks/useDiagnosticEngagement';
import {
  aiDiagnosticService,
  DiagnosticCase,
  AIAnalysisResult,
} from '../../../services/aiDiagnosticService';

const CaseResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();
  const [diagnosticCase, setDiagnosticCase] = useState<DiagnosticCase | null>(
    null
  );
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const isLoadingRef = useRef(false);

  // Get engagement data for this diagnostic case
  const {
    data: engagementData,
    isLoading: engagementLoading,
    refetch: refetchEngagement,
  } = useDiagnosticEngagementData(diagnosticCase?.id || '');

  const pollForAnalysis = useCallback(async () => {
    if (!caseId) return;

    try {
      setAnalysisLoading(true);
      const analysisResult = await aiDiagnosticService.pollAnalysis(caseId);
      setAnalysis(analysisResult);

      // Update case status
      setDiagnosticCase((prevCase) => {
        if (prevCase) {
          return {
            ...prevCase,
            status: 'completed',
            aiAnalysis: analysisResult,
          };
        }
        return prevCase;
      });
    } catch (err) {
      console.error('Failed to get analysis:', err);
      setError(
        'Analysis is taking longer than expected. Please refresh to check status.'
      );
    } finally {
      setAnalysisLoading(false);
    }
  }, [caseId]);

  const loadCase = useCallback(async () => {
    if (!caseId) {
      setError('Case ID is required');
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous calls using ref
    if (isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      const caseData = await aiDiagnosticService.getCase(caseId);

      setDiagnosticCase(caseData);

      // If case is completed and has analysis, load it
      if (caseData.status === 'completed' && caseData.aiAnalysis) {
        setAnalysis(caseData.aiAnalysis);
        // Analysis already exists, no need to poll
      } else if (caseData.status === 'analyzing' && !caseData.aiAnalysis) {
        // Only start polling if status is analyzing AND no analysis exists yet
        pollForAnalysis();
      }
    } catch (err) {
      console.error('❌ Failed to load case:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load diagnostic case. Please try again.';
      setError(errorMessage);
      // Don't crash the component, just show the error
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [caseId, pollForAnalysis]);

  const handleRefresh = () => {
    loadCase();
    if (diagnosticCase?.id) {
      refetchEngagement();
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFollowUpCreated = () => {
    refetchEngagement();
  };

  const handleBack = () => {
    navigate('/pharmacy/diagnostics');
  };

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Loading diagnostic case...
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  if (!diagnosticCase) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Diagnostic case not found.</Alert>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={handleBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Breadcrumbs sx={{ mb: 1 }}>
                <Link
                  component="button"
                  variant="body2"
                  onClick={handleBack}
                  sx={{ textDecoration: 'none' }}
                >
                  Diagnostics
                </Link>
                <Typography variant="body2" color="text.primary">
                  Case Results
                </Typography>
              </Breadcrumbs>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                Diagnostic Case Results
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Case ID: {diagnosticCase.id} • Status: {diagnosticCase.status}
              </Typography>
            </Box>
            <IconButton
              onClick={handleRefresh}
              disabled={loading || analysisLoading}
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Case Information */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h6">
                Case Information
              </Typography>
              {diagnosticCase.status === 'completed' && (
                <ScheduleDiagnosticFollowUp
                  diagnosticCase={diagnosticCase as any}
                  onFollowUpCreated={handleFollowUpCreated}
                />
              )}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Patient
                </Typography>
                <Typography variant="body2">
                  {(() => {
                    const { patientId } = diagnosticCase;
                    if (typeof patientId === 'object' && patientId && 'firstName' in patientId) {
                      return `${patientId.firstName || ''} ${patientId.lastName || ''}`.trim();
                    }
                    return String(patientId);
                  })()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body2">
                  {new Date(diagnosticCase.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body2">
                  {new Date(diagnosticCase.updatedAt).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Primary Symptoms
                </Typography>
                <Typography variant="body2">
                  {diagnosticCase.caseData.symptoms.subjective.join(', ') ||
                    'None specified'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Tabs for Analysis and Engagement */}
        <Card sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="diagnostic case tabs">
              <Tab label="AI Analysis" />
              <Tab label="Follow-up & Appointments" />
            </Tabs>
          </Box>

          {/* Analysis Results Tab */}
          {activeTab === 0 && (
            <Box>
              {diagnosticCase.status === 'analyzing' || analysisLoading ? (
                <AIAnalysisResults analysis={{} as AIAnalysisResult} loading={true} />
              ) : diagnosticCase.status === 'completed' && analysis ? (
                <AIAnalysisResults analysis={analysis} />
              ) : diagnosticCase.status === 'failed' ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Analysis Failed
                  </Typography>
                  <Typography variant="body2">
                    The AI analysis could not be completed. This may be due to
                    insufficient data or a system error. Please try submitting the
                    case again or contact support if the issue persists.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="info" sx={{ m: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Analysis Pending
                  </Typography>
                  <Typography variant="body2">
                    The AI analysis has not been completed yet. Please check back
                    later or refresh the page.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Engagement Tab */}
          {activeTab === 1 && (
            <Box>
              <DiagnosticLinkedAppointments
                appointments={engagementData?.appointments || []}
                followUpTasks={engagementData?.followUpTasks || []}
                loading={engagementLoading}
              />
            </Box>
          )}
        </Card>

        {/* Actions */}
        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={handleBack}>
            Back to Diagnostics
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/pharmacy/diagnostics/case/new')}
          >
            New Case
          </Button>
        </Box>
      </Container>
    </ErrorBoundary>
  );
};

// Wrap with feature guard
const CaseResultsPageWithGuard: React.FC = () => (
  <DiagnosticFeatureGuard>
    <CaseResultsPage />
  </DiagnosticFeatureGuard>
);

export default CaseResultsPageWithGuard;
