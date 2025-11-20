import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  Chip,
  Button,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  LocalHospital as LocalHospitalIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';

interface PatientDiagnosticSummaryProps {
  patientId: string;
}

interface DiagnosticSummary {
  patient: {
    id: string;
    name: string;
    age: number;
    gender: string;
  };
  diagnosticSummary: {
    totalCases: number;
    pendingFollowUps: number;
    referralsGenerated: number;
    latestCase: {
      id: string;
      caseId: string;
      createdAt: string;
      pharmacist: {
        firstName: string;
        lastName: string;
      };
      confidenceScore: number;
    } | null;
  };
}

const PatientDiagnosticSummary: React.FC<PatientDiagnosticSummaryProps> = ({
  patientId,
}) => {
  const navigate = useNavigate();

  const {
    data: summaryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['patientDiagnosticSummary', patientId],
    queryFn: async (): Promise<DiagnosticSummary> => {
      const response = await apiClient.get(`/patients/${patientId}/diagnostic-summary`);
      return response.data.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleNewCase = () => {
    navigate(`/pharmacy/diagnostics/case/new?patientId=${patientId}`);
  };

  const handleViewHistory = () => {
    navigate(`/pharmacy/diagnostics/cases/all?patientId=${patientId}`);
  };

  const handleViewLatestCase = () => {
    if (summaryData?.diagnosticSummary.latestCase) {
      navigate(`/pharmacy/diagnostics/case/${summaryData.diagnosticSummary.latestCase.caseId}/results`);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load diagnostic summary.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Diagnostic Summary
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleViewHistory}
              startIcon={<VisibilityIcon />}
            >
              View History
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleNewCase}
              startIcon={<AddIcon />}
            >
              New Case
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Grid container spacing={2}>
            {[...Array(4)].map((_, index) => (
              <Grid item xs={6} sm={3} key={index}>
                <Box sx={{ textAlign: 'center' }}>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                  <Skeleton variant="text" width="80%" sx={{ mx: 'auto' }} />
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : summaryData ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1 }}>
                    <AssignmentIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {summaryData.diagnosticSummary.totalCases}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Cases
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                    <ScheduleIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {summaryData.diagnosticSummary.pendingFollowUps}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Follow-ups
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 1 }}>
                    <LocalHospitalIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {summaryData.diagnosticSummary.referralsGenerated}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Referrals
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1 }}>
                    <TrendingUpIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {summaryData.diagnosticSummary.latestCase?.confidenceScore 
                      ? `${Math.round(summaryData.diagnosticSummary.latestCase.confidenceScore)}%`
                      : 'N/A'
                    }
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latest Confidence
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {summaryData.diagnosticSummary.latestCase && (
              <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        Latest Case: {summaryData.diagnosticSummary.latestCase.caseId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pharmacist: {summaryData.diagnosticSummary.latestCase.pharmacist.firstName}{' '}
                        {summaryData.diagnosticSummary.latestCase.pharmacist.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(summaryData.diagnosticSummary.latestCase.createdAt), 'MMM dd, yyyy HH:mm')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={`${Math.round(summaryData.diagnosticSummary.latestCase.confidenceScore)}% confidence`}
                        size="small"
                        color={
                          summaryData.diagnosticSummary.latestCase.confidenceScore >= 90
                            ? 'success'
                            : summaryData.diagnosticSummary.latestCase.confidenceScore >= 70
                            ? 'info'
                            : summaryData.diagnosticSummary.latestCase.confidenceScore >= 50
                            ? 'warning'
                            : 'error'
                        }
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleViewLatestCase}
                      >
                        View
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No diagnostic data available
            </Typography>
            <Button
              variant="contained"
              onClick={handleNewCase}
              startIcon={<AddIcon />}
              sx={{ mt: 1 }}
            >
              Create First Case
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientDiagnosticSummary;