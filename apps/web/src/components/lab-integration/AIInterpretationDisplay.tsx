import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  LinearProgress,
  Button,
  Stack,
  Paper,
  Grid,
  Divider,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { AIInterpretation } from '../../services/labIntegrationService';

interface AIInterpretationDisplayProps {
  interpretation?: AIInterpretation;
  status: string;
  aiProcessingStatus?: string;
  aiProcessingError?: string;
  onRequestInterpretation?: () => void;
  loading?: boolean;
}

const AIInterpretationDisplay: React.FC<AIInterpretationDisplayProps> = ({
  interpretation,
  status,
  aiProcessingStatus,
  aiProcessingError,
  onRequestInterpretation,
  loading = false,
}) => {
  const getClinicalSignificanceColor = (significance: string) => {
    const colors: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
      normal: 'success',
      abnormal_minor: 'info',
      abnormal_significant: 'warning',
      critical: 'error',
    };
    return colors[significance] || 'info';
  };

  const getClinicalSignificanceIcon = (significance: string) => {
    const icons: Record<string, React.ReactElement> = {
      normal: <CheckCircleIcon />,
      abnormal_minor: <InfoIcon />,
      abnormal_significant: <WarningIcon />,
      critical: <ErrorIcon />,
    };
    return icons[significance] || <InfoIcon />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  // Check if AI is processing
  if (aiProcessingStatus === 'processing' || status === 'pending_interpretation') {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <PsychologyIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          AI Interpretation in Progress
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The AI is analyzing the lab results. This may take a few moments...
        </Typography>
        <LinearProgress sx={{ maxWidth: 400, mx: 'auto' }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Status: {aiProcessingStatus || 'Processing'}
        </Typography>
      </Box>
    );
  }

  // Check if AI processing failed
  if (aiProcessingStatus === 'failed') {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          AI Interpretation Failed
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {aiProcessingError || 'The AI interpretation could not be completed. Please try again or contact support.'}
        </Typography>
        {aiProcessingError && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontStyle: 'italic' }}>
            Error details: {aiProcessingError}
          </Typography>
        )}
        {onRequestInterpretation && (
          <Button
            variant="outlined"
            size="small"
            onClick={onRequestInterpretation}
            disabled={loading}
            startIcon={<RefreshIcon />}
            sx={{ mt: 1 }}
          >
            Retry AI Interpretation
          </Button>
        )}
      </Alert>
    );
  }

  // No interpretation yet
  if (!interpretation) {
    if (status === 'draft' || aiProcessingStatus === 'pending') {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <PsychologyIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            AI Interpretation Not Started
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click the button below to request AI interpretation of the lab results.
          </Typography>
          {onRequestInterpretation && (
            <Button
              variant="contained"
              onClick={onRequestInterpretation}
              disabled={loading}
              startIcon={<PsychologyIcon />}
            >
              Request AI Interpretation
            </Button>
          )}
        </Box>
      );
    }

    return (
      <Alert severity="info">
        No AI interpretation available for this case.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Header Card */}
      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Clinical Significance
              </Typography>
              <Chip
                icon={getClinicalSignificanceIcon(interpretation.clinicalSignificance)}
                label={interpretation.clinicalSignificance.replace(/_/g, ' ').toUpperCase()}
                color={getClinicalSignificanceColor(interpretation.clinicalSignificance)}
                size="medium"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                AI Confidence
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={interpretation.confidence * 100}
                  color={getConfidenceColor(interpretation.confidence)}
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" fontWeight="bold">
                  {(interpretation.confidence * 100).toFixed(0)}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Analyzed
              </Typography>
              <Typography variant="body2">
                {interpretation.interpretedAt
                  ? format(new Date(interpretation.interpretedAt), 'MMM dd, yyyy HH:mm')
                  : 'Recently'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Model: {interpretation.modelUsed || 'AI Model'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary */}
      <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          AI Summary
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
          {interpretation.summary}
        </Typography>
      </Paper>

      {/* Differential Diagnosis */}
      {interpretation.differentialDiagnosis && interpretation.differentialDiagnosis.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Differential Diagnosis
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              {interpretation.differentialDiagnosis.map((diagnosis, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`#${index + 1}`} size="small" color="primary" />
                    <Typography variant="body1" fontWeight="medium">
                      {diagnosis}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {interpretation.recommendedActions && interpretation.recommendedActions.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recommended Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {interpretation.recommendedActions.map((action, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 2 }}>
                  <Chip
                    label={index + 1}
                    size="small"
                    color="primary"
                    sx={{ minWidth: 32, height: 24 }}
                  />
                  <Typography variant="body1" sx={{ flex: 1 }}>
                    {action}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Low Confidence Warning */}
      {interpretation.confidence < 0.6 && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <Typography variant="subtitle2" gutterBottom>
            Low Confidence Score
          </Typography>
          <Typography variant="body2">
            The AI interpretation has a confidence score below 60%. Please review the results
            carefully and consider consulting with a physician or requesting additional tests.
          </Typography>
        </Alert>
      )}

      {/* Critical Significance Alert */}
      {interpretation.clinicalSignificance === 'critical' && (
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="subtitle2" gutterBottom>
            Critical Clinical Significance
          </Typography>
          <Typography variant="body2">
            This case has been flagged as clinically critical. Immediate action may be required.
            Please review the therapy recommendations and safety checks carefully.
          </Typography>
        </Alert>
      )}
    </Stack>
  );
};

export default AIInterpretationDisplay;

