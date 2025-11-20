import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Stack,
  Chip,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Medication as MedicationIcon,
  LocalPharmacy as LocalPharmacyIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type {
  DiagnosticResult,
  DrugInteraction,
  AllergyAlert,
  Contraindication,
} from '../types';

interface InteractionAlertsProps {
  medications: DiagnosticResult['medicationSuggestions'];
  patientAllergies?: string[];
  patientConditions?: string[];
  onCheckInteractions?: (medications: string[]) => Promise<{
    interactions: DrugInteraction[];
    allergies: AllergyAlert[];
    contraindications: Contraindication[];
  }>;
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  major: {
    color: 'error' as const,
    icon: ErrorIcon,
    label: 'Major',
    description: 'Significant clinical interaction - avoid combination',
  },
  moderate: {
    color: 'warning' as const,
    icon: WarningIcon,
    label: 'Moderate',
    description: 'Monitor closely and consider alternatives',
  },
  minor: {
    color: 'info' as const,
    icon: InfoIcon,
    label: 'Minor',
    description: 'Monitor for effects but generally safe',
  },
};

const ALLERGY_SEVERITY_CONFIG = {
  severe: {
    color: 'error' as const,
    icon: ErrorIcon,
    label: 'Severe Allergy',
    description: 'Contraindicated - do not use',
  },
  moderate: {
    color: 'warning' as const,
    icon: WarningIcon,
    label: 'Moderate Allergy',
    description: 'Use with extreme caution',
  },
  mild: {
    color: 'info' as const,
    icon: InfoIcon,
    label: 'Mild Allergy',
    description: 'Monitor for allergic reactions',
  },
};

const CONTRAINDICATION_CONFIG = {
  contraindicated: {
    color: 'error' as const,
    icon: ErrorIcon,
    label: 'Contraindicated',
    description: 'Do not use in this condition',
  },
  warning: {
    color: 'warning' as const,
    icon: WarningIcon,
    label: 'Use with Caution',
    description: 'Monitor closely in this condition',
  },
};

const InteractionAlerts: React.FC<InteractionAlertsProps> = ({
  medications,
  patientAllergies = [],
  patientConditions = [],
  onCheckInteractions,
  loading = false,
}) => {
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [allergies, setAllergies] = useState<AllergyAlert[]>([]);
  const [contraindications, setContraindications] = useState<
    Contraindication[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['interactions'])
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

  const checkInteractions = async () => {
    if (!onCheckInteractions || medications.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const drugNames = medications.map((med) => med.drugName);
      const result = await onCheckInteractions(drugNames);

      setInteractions(result.interactions || []);
      setAllergies(result.allergies || []);
      setContraindications(result.contraindications || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check interactions'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (medications.length > 0) {
      checkInteractions();
    }
  }, [medications]);

  const getSeverityConfig = (
    severity: string,
    type: 'interaction' | 'allergy' | 'contraindication'
  ) => {
    switch (type) {
      case 'allergy':
        return (
          ALLERGY_SEVERITY_CONFIG[
            severity as keyof typeof ALLERGY_SEVERITY_CONFIG
          ] || ALLERGY_SEVERITY_CONFIG.mild
        );
      case 'contraindication':
        return (
          CONTRAINDICATION_CONFIG[
            severity as keyof typeof CONTRAINDICATION_CONFIG
          ] || CONTRAINDICATION_CONFIG.warning
        );
      default:
        return (
          SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ||
          SEVERITY_CONFIG.minor
        );
    }
  };

  const totalAlerts =
    interactions.length + allergies.length + contraindications.length;
  const criticalAlerts = [
    ...interactions.filter((i) => i.severity === 'major'),
    ...allergies.filter((a) => a.severity === 'severe'),
    ...contraindications.filter((c) => c.severity === 'contraindicated'),
  ].length;

  if (medications.length === 0) {
    return null;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}
          >
            <HealthAndSafetyIcon sx={{ mr: 1, color: 'primary.main' }} />
            Drug Safety Analysis
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(isLoading || loading) && <CircularProgress size={20} />}
            <Tooltip title="Refresh interaction check">
              <IconButton
                size="small"
                onClick={checkInteractions}
                disabled={isLoading || loading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={`${medications.length} Medications`}
            variant="outlined"
            size="small"
            icon={<MedicationIcon />}
          />
          {totalAlerts > 0 && (
            <Chip
              label={`${totalAlerts} Alert(s)`}
              color={criticalAlerts > 0 ? 'error' : 'warning'}
              variant="filled"
              size="small"
            />
          )}
          {criticalAlerts > 0 && (
            <Chip
              label={`${criticalAlerts} Critical`}
              color="error"
              variant="filled"
              size="small"
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Interaction Check Failed</AlertTitle>
            <Typography variant="body2">{error}</Typography>
            <Button size="small" onClick={checkInteractions} sx={{ mt: 1 }}>
              Retry
            </Button>
          </Alert>
        )}

        {criticalAlerts > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Critical Drug Safety Alerts</AlertTitle>
            <Typography variant="body2">
              {criticalAlerts} critical safety issue(s) detected. Review all
              alerts before prescribing.
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Drug-Drug Interactions */}
      {interactions.length > 0 && (
        <Accordion
          expanded={expandedSections.has('interactions')}
          onChange={() => handleToggleSection('interactions')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MedicationIcon color="warning" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Drug-Drug Interactions ({interactions.length})
              </Typography>
              {interactions.some((i) => i.severity === 'major') && (
                <Chip
                  label="Major Interactions"
                  color="error"
                  size="small"
                  variant="filled"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {interactions.map((interaction, index) => {
                const config = getSeverityConfig(
                  interaction.severity,
                  'interaction'
                );
                const Icon = config.icon;

                return (
                  <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                    >
                      <Icon color={config.color} />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {interaction.drug1} + {interaction.drug2}
                          </Typography>
                          <Chip
                            label={config.label}
                            color={config.color}
                            size="small"
                            variant="outlined"
                          />
                        </Box>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          {config.description}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Clinical Effect:</strong>{' '}
                          {interaction.clinicalEffect}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Description:</strong>{' '}
                          {interaction.description}
                        </Typography>

                        {interaction.mechanism && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Mechanism:</strong> {interaction.mechanism}
                          </Typography>
                        )}

                        {interaction.management && (
                          <Alert
                            severity={config.color}
                            variant="outlined"
                            sx={{ mt: 1 }}
                          >
                            <Typography variant="body2">
                              <strong>Management:</strong>{' '}
                              {interaction.management}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Allergy Alerts */}
      {allergies.length > 0 && (
        <Accordion
          expanded={expandedSections.has('allergies')}
          onChange={() => handleToggleSection('allergies')}
          sx={{ mt: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="error" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Allergy Alerts ({allergies.length})
              </Typography>
              {allergies.some((a) => a.severity === 'severe') && (
                <Chip
                  label="Severe Allergies"
                  color="error"
                  size="small"
                  variant="filled"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {allergies.map((allergy, index) => {
                const config = getSeverityConfig(allergy.severity, 'allergy');
                const Icon = config.icon;

                return (
                  <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                    >
                      <Icon color={config.color} />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {allergy.drug}
                          </Typography>
                          <Chip
                            label={config.label}
                            color={config.color}
                            size="small"
                            variant="filled"
                          />
                        </Box>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          {config.description}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Known Allergy:</strong> {allergy.allergy}
                        </Typography>

                        <Typography variant="body2">
                          <strong>Reaction:</strong> {allergy.reaction}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Contraindications */}
      {contraindications.length > 0 && (
        <Accordion
          expanded={expandedSections.has('contraindications')}
          onChange={() => handleToggleSection('contraindications')}
          sx={{ mt: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Contraindications ({contraindications.length})
              </Typography>
              {contraindications.some(
                (c) => c.severity === 'contraindicated'
              ) && (
                <Chip
                  label="Absolute Contraindications"
                  color="error"
                  size="small"
                  variant="filled"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {contraindications.map((contraindication, index) => {
                const config = getSeverityConfig(
                  contraindication.severity,
                  'contraindication'
                );
                const Icon = config.icon;

                return (
                  <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                    >
                      <Icon color={config.color} />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {contraindication.drug}
                          </Typography>
                          <Chip
                            label={config.label}
                            color={config.color}
                            size="small"
                            variant="filled"
                          />
                        </Box>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 1 }}
                        >
                          {config.description}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Condition:</strong>{' '}
                          {contraindication.condition}
                        </Typography>

                        <Typography variant="body2">
                          <strong>Reason:</strong> {contraindication.reason}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* No Alerts */}
      {!isLoading && !loading && totalAlerts === 0 && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <AlertTitle>No Safety Alerts</AlertTitle>
          <Typography variant="body2">
            No drug interactions, allergies, or contraindications detected for
            the suggested medications.
          </Typography>
        </Alert>
      )}

      {/* Safety Disclaimer */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Safety Note:</strong> This analysis is based on available drug
          interaction databases. Always consult current prescribing information
          and consider individual patient factors.
        </Typography>
      </Alert>
    </Box>
  );
};

export default InteractionAlerts;
