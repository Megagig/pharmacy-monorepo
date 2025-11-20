import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  Paper,
  Tooltip,
  IconButton,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  LocalHospital as LocalHospitalIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import type { DiagnosticResultsPanelProps, DiagnosticResult } from '../types';
import ConfidenceIndicator from './ConfidenceIndicator';
import RedFlagAlerts from './RedFlagAlerts';
import InteractionAlerts from './InteractionAlerts';

const SEVERITY_CONFIG = {
  low: { color: 'success' as const, icon: CheckCircleIcon, label: 'Low Risk' },
  medium: {
    color: 'warning' as const,
    icon: WarningIcon,
    label: 'Medium Risk',
  },
  high: { color: 'error' as const, icon: ErrorIcon, label: 'High Risk' },
};

const PRIORITY_CONFIG = {
  urgent: { color: 'error' as const, label: 'Urgent', icon: ErrorIcon },
  routine: { color: 'info' as const, label: 'Routine', icon: ScheduleIcon },
  optional: { color: 'default' as const, label: 'Optional', icon: InfoIcon },
};

const URGENCY_CONFIG = {
  immediate: {
    color: 'error' as const,
    label: 'Immediate',
    severity: 'error' as const,
  },
  within_24h: {
    color: 'warning' as const,
    label: 'Within 24h',
    severity: 'warning' as const,
  },
  routine: {
    color: 'info' as const,
    label: 'Routine',
    severity: 'info' as const,
  },
};

const DiagnosticResultsPanel: React.FC<DiagnosticResultsPanelProps> = ({
  result,
  onApprove,
  onModify,
  onReject,
  loading = false,
  error,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['diagnoses', 'redFlags'])
  );

  const handleToggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getSeverityChip = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Chip
        icon={<Icon sx={{ fontSize: 16 }} />}
        label={config.label}
        size="small"
        color={config.color}
        variant="outlined"
      />
    );
  };

  const getPriorityChip = (priority: string) => {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Chip
        icon={<Icon sx={{ fontSize: 16 }} />}
        label={config.label}
        size="small"
        color={config.color}
        variant="outlined"
      />
    );
  };

  const getUrgencyAlert = (urgency: string) => {
    const config = URGENCY_CONFIG[urgency as keyof typeof URGENCY_CONFIG];
    if (!config) return null;

    return (
      <Alert severity={config.severity} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Referral Urgency: {config.label}
        </Typography>
      </Alert>
    );
  };

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}
            >
              <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
              AI Diagnostic Analysis
            </Typography>
            <ConfidenceIndicator
              confidence={result.aiMetadata.confidenceScore}
              size="large"
            />
          </Box>

          {/* AI Metadata Summary */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Model
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {result.aiMetadata.modelId}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Processing Time
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {(result.aiMetadata.processingTime / 1000).toFixed(1)}s
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Tokens Used
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {result.aiMetadata.tokenUsage.totalTokens.toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Confidence
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {(result.aiMetadata.confidenceScore * 100).toFixed(1)}%
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Red Flag Alerts */}
        {result.redFlags.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <RedFlagAlerts redFlags={result.redFlags} />
          </Box>
        )}

        {/* Referral Recommendation */}
        {result.referralRecommendation?.recommended && (
          <Box sx={{ mb: 3 }}>
            {getUrgencyAlert(result.referralRecommendation.urgency)}
            <Alert severity="warning" icon={<LocalHospitalIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Referral Recommended: {result.referralRecommendation.specialty}
              </Typography>
              <Typography variant="body2">
                {result.referralRecommendation.reason}
              </Typography>
            </Alert>
          </Box>
        )}

        <Stack spacing={2}>
          {/* Differential Diagnoses */}
          <Accordion
            expanded={expandedSections.has('diagnoses')}
            onChange={() => handleToggleSection('diagnoses')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
              >
                <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Differential Diagnoses ({result.diagnoses.length})
                </Typography>
                <Box sx={{ ml: 'auto', mr: 2 }}>
                  <Chip
                    label={`Avg Confidence: ${((result.diagnoses.reduce((sum, d) => sum + d.probability, 0) / result.diagnoses.length) * 100).toFixed(1)}%`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {result.diagnoses.map((diagnosis, index) => (
                  <ListItem
                    key={index}
                    divider={index < result.diagnoses.length - 1}
                  >
                    <ListItemIcon>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 80,
                        }}
                      >
                        <ConfidenceIndicator
                          confidence={diagnosis.probability}
                          size="small"
                        />
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {diagnosis.condition}
                          </Typography>
                          {getSeverityChip(diagnosis.severity)}
                          {diagnosis.icdCode && (
                            <Chip
                              label={`ICD: ${diagnosis.icdCode}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {diagnosis.snomedCode && (
                            <Chip
                              label={`SNOMED: ${diagnosis.snomedCode}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          {diagnosis.reasoning}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Suggested Tests */}
          {result.suggestedTests.length > 0 && (
            <Accordion
              expanded={expandedSections.has('tests')}
              onChange={() => handleToggleSection('tests')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScienceIcon sx={{ mr: 1, color: 'secondary.main' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Suggested Laboratory Tests ({result.suggestedTests.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {result.suggestedTests.map((test, index) => (
                    <ListItem
                      key={index}
                      divider={index < result.suggestedTests.length - 1}
                    >
                      <ListItemIcon>
                        <ScienceIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="body1"
                              sx={{ fontWeight: 600 }}
                            >
                              {test.testName}
                            </Typography>
                            {getPriorityChip(test.priority)}
                            {test.loincCode && (
                              <Chip
                                label={`LOINC: ${test.loincCode}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {test.reasoning}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Medication Suggestions */}
          {result.medicationSuggestions.length > 0 && (
            <Accordion
              expanded={expandedSections.has('medications')}
              onChange={() => handleToggleSection('medications')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <MedicationIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Medication Suggestions (
                    {result.medicationSuggestions.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {result.medicationSuggestions.map((medication, index) => (
                    <Paper key={index} sx={{ p: 2 }} variant="outlined">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {medication.drugName}
                        </Typography>
                        {medication.rxcui && (
                          <Chip
                            label={`RxCUI: ${medication.rxcui}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>

                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Dosage
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {medication.dosage}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Frequency
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {medication.frequency}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Duration
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {medication.duration}
                          </Typography>
                        </Grid>
                      </Grid>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        <strong>Reasoning:</strong> {medication.reasoning}
                      </Typography>

                      {medication.safetyNotes.length > 0 && (
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 1 }}
                          >
                            Safety Notes:
                          </Typography>
                          <Stack spacing={0.5}>
                            {medication.safetyNotes.map((note, noteIndex) => (
                              <Alert
                                key={noteIndex}
                                severity="warning"
                                sx={{ py: 0.5 }}
                              >
                                <Typography variant="body2">{note}</Typography>
                              </Alert>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Paper>
                  ))}

                  {/* Drug Interaction Alerts */}
                  <InteractionAlerts
                    medications={result.medicationSuggestions}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* AI Disclaimer */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>AI Disclaimer:</strong> {result.disclaimer}
          </Typography>
        </Alert>

        {/* Review Status */}
        {result.pharmacistReview && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Pharmacist Review Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={result.pharmacistReview.status.toUpperCase()}
                color={
                  result.pharmacistReview.status === 'approved'
                    ? 'success'
                    : result.pharmacistReview.status === 'modified'
                      ? 'warning'
                      : 'error'
                }
                variant="filled"
              />
              <Typography variant="body2" color="text.secondary">
                Reviewed on{' '}
                {new Date(
                  result.pharmacistReview.reviewedAt
                ).toLocaleDateString()}
              </Typography>
            </Box>

            {result.pharmacistReview.modifications && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Modifications:</strong>{' '}
                  {result.pharmacistReview.modifications}
                </Typography>
              </Alert>
            )}

            {result.pharmacistReview.rejectionReason && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Rejection Reason:</strong>{' '}
                  {result.pharmacistReview.rejectionReason}
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Action Buttons */}
        {!result.pharmacistReview && (onApprove || onModify || onReject) && (
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            {onReject && (
              <Button
                variant="outlined"
                color="error"
                onClick={onReject}
                disabled={loading}
              >
                Reject
              </Button>
            )}
            {onModify && (
              <Button
                variant="outlined"
                color="warning"
                onClick={onModify}
                disabled={loading}
              >
                Modify
              </Button>
            )}
            {onApprove && (
              <Button
                variant="contained"
                color="success"
                onClick={onApprove}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Approve'}
              </Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagnosticResultsPanel;
