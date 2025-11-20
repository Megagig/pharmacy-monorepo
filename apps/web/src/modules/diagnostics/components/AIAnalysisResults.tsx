import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AIAnalysisResult } from '../../../services/aiDiagnosticService';

interface AIAnalysisResultsProps {
  analysis: AIAnalysisResult;
  loading?: boolean;
}

const AIAnalysisResults: React.FC<AIAnalysisResultsProps> = ({
  analysis,
  loading = false,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              AI Analysis in Progress
            </Typography>
          </Box>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Our AI is analyzing the case data. This typically takes 30-60
            seconds...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ space: 2 }}>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              AI Diagnostic Analysis
            </Typography>
            <Chip
              label={`${Math.round(analysis.confidence * 100)}% Confidence`}
              color={getConfidenceColor(analysis.confidence)}
              variant="filled"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Analysis completed in {analysis.processingTime}ms • Generated on{' '}
            {new Date(analysis.createdAt).toLocaleString()}
          </Typography>
        </CardContent>
      </Card>

      {/* Primary Diagnosis */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography
            variant="h6"
            sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
          >
            Primary Diagnosis
            <Chip
              label={`${Math.round(
                analysis.analysis.primaryDiagnosis.confidence * 100
              )}%`}
              color={getConfidenceColor(
                analysis.analysis.primaryDiagnosis.confidence
              )}
              size="small"
              sx={{ ml: 2 }}
            />
          </Typography>
          <Typography
            variant="h5"
            color="primary"
            sx={{ mb: 1, fontWeight: 500 }}
          >
            {analysis.analysis.primaryDiagnosis.condition}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {analysis.analysis.primaryDiagnosis.reasoning}
          </Typography>
        </CardContent>
      </Card>

      {/* Differential Diagnoses */}
      {analysis.analysis.differentialDiagnoses.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Differential Diagnoses (
              {analysis.analysis.differentialDiagnoses.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {analysis.analysis.differentialDiagnoses.map(
                (diagnosis, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500 }}
                            >
                              {diagnosis.condition}
                            </Typography>
                            <Chip
                              label={`${Math.round(
                                diagnosis.confidence * 100
                              )}%`}
                              color={getConfidenceColor(diagnosis.confidence)}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={diagnosis.reasoning}
                      />
                    </ListItem>
                    {index <
                      analysis.analysis.differentialDiagnoses.length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                )
              )}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Recommended Tests */}
      {analysis.analysis.recommendedTests.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Recommended Tests ({analysis.analysis.recommendedTests.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {analysis.analysis.recommendedTests.map((test, index) => (
                <React.Fragment key={index}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 500 }}
                          >
                            {test.test}
                          </Typography>
                          <Chip
                            label={test.priority}
                            color={getPriorityColor(test.priority)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={test.reasoning}
                    />
                  </ListItem>
                  {index < analysis.analysis.recommendedTests.length - 1 && (
                    <Divider />
                  )}
                </React.Fragment>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Treatment Suggestions */}
      {analysis.analysis.treatmentSuggestions.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Treatment Suggestions (
              {analysis.analysis.treatmentSuggestions.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {analysis.analysis.treatmentSuggestions.map(
                (treatment, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500 }}
                            >
                              {treatment.treatment}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip
                                label={treatment.type}
                                variant="outlined"
                                size="small"
                              />
                              <Chip
                                label={treatment.priority}
                                color={getPriorityColor(treatment.priority)}
                                size="small"
                              />
                            </Box>
                          </Box>
                        }
                        secondary={treatment.reasoning}
                      />
                    </ListItem>
                    {index <
                      analysis.analysis.treatmentSuggestions.length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                )
              )}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Risk Factors */}
      {analysis.analysis.riskFactors.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Risk Factors ({analysis.analysis.riskFactors.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {analysis.analysis.riskFactors.map((risk, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {risk.factor}
                        </Typography>
                        <Chip
                          label={risk.severity}
                          color={getPriorityColor(risk.severity)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {risk.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Follow-up Recommendations */}
      {analysis.analysis.followUpRecommendations.length > 0 && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Follow-up Recommendations (
              {analysis.analysis.followUpRecommendations.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {analysis.analysis.followUpRecommendations.map(
                (followUp, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500 }}
                            >
                              {followUp.action}
                            </Typography>
                            <Chip
                              label={followUp.timeframe}
                              variant="outlined"
                              size="small"
                            />
                          </Box>
                        }
                        secondary={followUp.reasoning}
                      />
                    </ListItem>
                    {index <
                      analysis.analysis.followUpRecommendations.length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                )
              )}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Disclaimer */}
      <Alert severity="warning" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Important:</strong> This AI analysis is for informational
          purposes only and should not replace professional medical judgment.
          Always consult with qualified healthcare professionals for diagnosis
          and treatment decisions.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AIAnalysisResults;
