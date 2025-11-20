import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Button,
  Stack,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Science as ScienceIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useLabIntegrationsByPatient } from '../hooks/useLabIntegration';

interface PatientLabIntegrationWidgetProps {
  patientId: string;
  maxCases?: number;
  onViewCase?: (caseId: string) => void;
  onViewAllCases?: () => void;
  onCreateCase?: () => void;
}

const PatientLabIntegrationWidget: React.FC<PatientLabIntegrationWidgetProps> = ({
  patientId,
  maxCases = 5,
  onViewCase,
  onViewAllCases,
  onCreateCase,
}) => {
  const navigate = useNavigate();
  const { data: cases = [], isLoading, isError, error } = useLabIntegrationsByPatient(patientId);

  const handleViewCase = (caseId: string) => {
    if (onViewCase) {
      onViewCase(caseId);
    } else {
      navigate(`/pharmacy/lab-integration/${caseId}`);
    }
  };

  const handleViewAll = () => {
    if (onViewAllCases) {
      onViewAllCases();
    } else {
      navigate(`/pharmacy/lab-integration?patientId=${patientId}`);
    }
  };

  const handleCreateCase = () => {
    if (onCreateCase) {
      onCreateCase();
    } else {
      navigate(`/pharmacy/lab-integration/new?patientId=${patientId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'implemented':
        return 'info';
      case 'approved':
        return 'primary';
      case 'pending_review':
      case 'pending_approval':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'implemented':
        return <CheckCircleIcon fontSize="small" />;
      case 'pending_review':
      case 'pending_approval':
        return <ScheduleIcon fontSize="small" />;
      case 'cancelled':
        return <WarningIcon fontSize="small" />;
      default:
        return <ScienceIcon fontSize="small" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'urgent':
        return 'warning';
      default:
        return 'default';
    }
  };

  const displayedCases = cases.slice(0, maxCases);

  if (isLoading) {
    return (
      <Card>
        <CardHeader
          avatar={<ScienceIcon />}
          title="Lab Integration Cases"
          subheader="AI-powered lab result interpretation and therapy management"
        />
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader
          avatar={<ScienceIcon />}
          title="Lab Integration Cases"
          subheader="AI-powered lab result interpretation and therapy management"
        />
        <CardContent>
          <Alert severity="error">
            Failed to load lab integration cases: {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        avatar={<ScienceIcon />}
        title="Lab Integration Cases"
        subheader={`${cases.length} total case${cases.length !== 1 ? 's' : ''}`}
        action={
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={handleCreateCase}
          >
            New Case
          </Button>
        }
      />
      <CardContent>
        {displayedCases.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <ScienceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No lab integration cases yet
            </Typography>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              size="small"
              onClick={handleCreateCase}
              sx={{ mt: 2 }}
            >
              Create First Case
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {displayedCases.map((labCase, index) => (
              <Box key={labCase._id}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" noWrap>
                        {labCase.labResultIds?.length || 0} Lab Result{labCase.labResultIds?.length !== 1 ? 's' : ''}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(labCase.status)}
                        label={labCase.status.replace(/_/g, ' ')}
                        size="small"
                        color={getStatusColor(labCase.status)}
                      />
                      {labCase.priority !== 'routine' && (
                        <Chip
                          label={labCase.priority}
                          size="small"
                          color={getPriorityColor(labCase.priority)}
                        />
                      )}
                    </Box>

                    <Typography variant="caption" color="text.secondary" display="block">
                      Created: {format(new Date(labCase.createdAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>

                    {labCase.aiInterpretation && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon fontSize="small" color="primary" />
                        <Typography variant="caption" color="primary">
                          AI Interpretation: {labCase.aiInterpretation.clinicalSignificance}
                          {labCase.aiInterpretation.confidenceScore && 
                            ` (${Math.round(labCase.aiInterpretation.confidenceScore * 100)}% confidence)`
                          }
                        </Typography>
                      </Box>
                    )}

                    {labCase.therapyRecommendations && labCase.therapyRecommendations.length > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {labCase.therapyRecommendations.length} therapy recommendation{labCase.therapyRecommendations.length !== 1 ? 's' : ''}
                      </Typography>
                    )}

                    {labCase.medicationAdjustments && labCase.medicationAdjustments.length > 0 && (
                      <Typography variant="caption" color="success.main" display="block" sx={{ mt: 0.5 }}>
                        ✓ {labCase.medicationAdjustments.length} medication adjustment{labCase.medicationAdjustments.length !== 1 ? 's' : ''} implemented
                      </Typography>
                    )}
                  </Box>

                  <IconButton
                    size="small"
                    onClick={() => handleViewCase(labCase._id)}
                    sx={{ flexShrink: 0 }}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Box>

                {index < displayedCases.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}

            {cases.length > maxCases && (
              <Button
                fullWidth
                variant="text"
                onClick={handleViewAll}
                sx={{ mt: 1 }}
              >
                View All {cases.length} Cases
              </Button>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientLabIntegrationWidget;

