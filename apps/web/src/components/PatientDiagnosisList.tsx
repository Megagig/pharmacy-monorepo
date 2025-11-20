import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  Skeleton,
  Paper,
} from '@mui/material';
import BiotechIcon from '@mui/icons-material/Biotech';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { aiDiagnosticService } from '../services/aiDiagnosticService';

interface PatientDiagnosisListProps {
  patientId: string;
}

const PatientDiagnosisList: React.FC<PatientDiagnosisListProps> = ({
  patientId,
}) => {
  const navigate = useNavigate();

  // Fetch diagnostic cases for the patient
  const {
    data: diagnosticCases,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['patientDiagnosticCases', patientId],
    queryFn: () => aiDiagnosticService.getPatientCases(patientId),
    enabled: !!patientId,
  });

  const totalCases = diagnosticCases?.length || 0;
  const pendingReviewCases = diagnosticCases?.filter((c) => c.status === 'draft' || c.aiAnalysis?.status === 'processing')?.length || 0;
  const completedCases = diagnosticCases?.filter((c) => c.status === 'completed')?.length || 0;

  const handleViewCase = (caseId: string) => {
    // Navigate to the all cases page with the specific case highlighted
    navigate(`/pharmacy/diagnostics/cases/all?caseId=${caseId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'draft':
      case 'submitted':
        return 'default';
      case 'analyzing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'draft':
        return 'Pending Review';
      case 'submitted':
        return 'Submitted';
      case 'analyzing':
        return 'Analyzing';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BiotechIcon />
              <Typography variant="h6">AI Diagnostic Cases</Typography>
            </Box>
          }
        />
        <CardContent>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={60} />
            <Skeleton variant="rectangular" height={200} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BiotechIcon />
              <Typography variant="h6">AI Diagnostic Cases</Typography>
            </Box>
          }
        />
        <CardContent>
          <Alert severity="error">
            <Typography variant="body2">
              {(error as Error)?.message || 'Failed to load diagnostic cases'}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BiotechIcon />
            <Typography variant="h6">AI Diagnostic Cases</Typography>
          </Box>
        }
        action={
          <Button
            variant="contained"
            startIcon={<BiotechIcon />}
            onClick={() => navigate('/pharmacy/diagnostics/case/new')}
            size="small"
          >
            New Diagnosis
          </Button>
        }
      />
      <CardContent>
        {/* Summary Stats */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              flex: 1,
              bgcolor: 'primary.50',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" color="primary.main" fontWeight={600}>
              {totalCases}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Cases
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              flex: 1,
              bgcolor: 'warning.50',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" color="warning.main" fontWeight={600}>
              {pendingReviewCases}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending Review
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              flex: 1,
              bgcolor: 'success.50',
              borderRadius: 2,
            }}
          >
            <Typography variant="h4" color="success.main" fontWeight={600}>
              {completedCases}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed
            </Typography>
          </Paper>
        </Stack>

        {/* Cases Table */}
        {diagnosticCases && diagnosticCases.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Case ID
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Date Created
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Primary Diagnosis
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Confidence
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Status
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={600}>
                      Actions
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diagnosticCases.map((diagnosticCase) => (
                  <TableRow
                    key={diagnosticCase.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewCase(diagnosticCase.id)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {diagnosticCase.id.substring(0, 8).toUpperCase()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(diagnosticCase.createdAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(diagnosticCase.createdAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {diagnosticCase.aiAnalysis?.analysis?.primaryDiagnosis?.condition || 'Analyzing...'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {diagnosticCase.aiAnalysis?.confidence ? (
                        <Chip
                          label={`${Math.round(diagnosticCase.aiAnalysis.confidence)}%`}
                          size="small"
                          color={
                            diagnosticCase.aiAnalysis.confidence >= 80
                              ? 'success'
                              : diagnosticCase.aiAnalysis.confidence >= 60
                              ? 'warning'
                              : 'default'
                          }
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(diagnosticCase.status)}
                        size="small"
                        color={getStatusColor(diagnosticCase.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewCase(diagnosticCase.id);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              No diagnostic cases found for this patient. Click "New Diagnosis" to create one.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientDiagnosisList;
