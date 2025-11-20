import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Medication as MedicationIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  TrendingUp as SeverityIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface InteractionDetailCardProps {
  interaction: {
    _id: string;
    patientId: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    interactions: Array<{
      severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
      description: string;
      drug1: { name: string; rxcui?: string };
      drug2: { name: string; rxcui?: string };
      clinicalSignificance?: string;
      managementRecommendation?: string;
      source: string;
    }>;
    hasCriticalInteraction: boolean;
    hasContraindication: boolean;
    status: string;
    createdAt: string;
    reviewedBy?: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    reviewedAt?: string;
    pharmacistNotes?: string;
    reviewDecision?: {
      action: string;
      reason: string;
      modificationSuggestions?: string;
      monitoringParameters?: string;
    };
  };
  onClose?: () => void;
}

const InteractionDetailCard: React.FC<InteractionDetailCardProps> = ({ 
  interaction, 
  onClose 
}) => {
  const theme = useTheme();
  const [expandedPanel, setExpandedPanel] = useState<string | false>('patient');

  const handlePanelChange = (panel: string) => (
    event: React.SyntheticEvent, 
    isExpanded: boolean
  ) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'contraindicated': return theme.palette.error.main;
      case 'major': return theme.palette.warning.main;
      case 'moderate': return theme.palette.info.main;
      case 'minor': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getSeverityIcon = (severity: string) => {
    const props = { fontSize: 'small' as const };
    switch (severity) {
      case 'contraindicated': return <ErrorIcon {...props} />;
      case 'major': return <WarningIcon {...props} />;
      case 'moderate': return <InfoIcon {...props} />;
      case 'minor': return <CheckCircleIcon {...props} />;
      default: return <InfoIcon {...props} />;
    }
  };

  const getHighestSeverity = () => {
    const severityOrder = ['contraindicated', 'major', 'moderate', 'minor'];
    for (const severity of severityOrder) {
      if (interaction.interactions.some(i => i.severity === severity)) {
        return severity;
      }
    }
    return 'minor';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const highestSeverity = getHighestSeverity();
  const severityColor = getSeverityColor(highestSeverity);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        sx={{ 
          border: `2px solid ${alpha(severityColor, 0.3)}`,
          boxShadow: theme.shadows[4],
        }}
      >
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: alpha(severityColor, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: severityColor,
                }}
              >
                {getSeverityIcon(highestSeverity)}
              </Box>
              <Box>
                <Typography variant="h6" component="div">
                  Interaction Review
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {interaction.interactions.length} interaction{interaction.interactions.length !== 1 ? 's' : ''} detected
                </Typography>
              </Box>
            </Box>
          }
          action={
            onClose && (
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            )
          }
          sx={{ pb: 1 }}
        />

        <CardContent sx={{ pt: 0 }}>
          {/* Status and Priority Indicators */}
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            <Chip 
              label={interaction.status.toUpperCase()} 
              color={interaction.status === 'pending' ? 'warning' : 'default'}
              size="small"
            />
            
            {interaction.hasContraindication && (
              <Chip 
                label="CONTRAINDICATED" 
                color="error" 
                size="small"
                icon={<ErrorIcon />}
              />
            )}
            
            {interaction.hasCriticalInteraction && !interaction.hasContraindication && (
              <Chip 
                label="CRITICAL" 
                color="warning" 
                size="small"
                icon={<WarningIcon />}
              />
            )}

            <Chip 
              label={highestSeverity.toUpperCase()} 
              sx={{ 
                backgroundColor: alpha(severityColor, 0.2),
                color: severityColor,
                border: `1px solid ${alpha(severityColor, 0.5)}`,
              }}
              size="small"
              icon={getSeverityIcon(highestSeverity)}
            />
          </Box>

          {/* Patient Information Accordion */}
          <Accordion 
            expanded={expandedPanel === 'patient'} 
            onChange={handlePanelChange('patient')}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={2}>
                <PersonIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Patient Information
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  {interaction.patientId.firstName[0]}{interaction.patientId.lastName[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {interaction.patientId.firstName} {interaction.patientId.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Patient ID: {interaction.patientId._id}
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Interaction detected on: {formatDate(interaction.createdAt)}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Drug Interactions Accordion */}
          <Accordion 
            expanded={expandedPanel === 'interactions'} 
            onChange={handlePanelChange('interactions')}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={2}>
                <MedicationIcon color="secondary" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Drug Interactions ({interaction.interactions.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense>
                {interaction.interactions.map((drugInteraction, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 2, py: 1.5 }}>
                      <Box width="100%">
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: getSeverityColor(drugInteraction.severity),
                              }}
                            />
                            <Typography variant="subtitle2" fontWeight="medium">
                              {drugInteraction.drug1.name} ↔ {drugInteraction.drug2.name}
                            </Typography>
                          </Box>
                          <Chip 
                            label={drugInteraction.severity.toUpperCase()}
                            size="small"
                            sx={{ 
                              backgroundColor: alpha(getSeverityColor(drugInteraction.severity), 0.2),
                              color: getSeverityColor(drugInteraction.severity),
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary" paragraph>
                          {drugInteraction.description}
                        </Typography>

                        {drugInteraction.clinicalSignificance && (
                          <Box mb={1}>
                            <Typography variant="caption" color="primary" fontWeight="medium">
                              Clinical Significance:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {drugInteraction.clinicalSignificance}
                            </Typography>
                          </Box>
                        )}

                        {drugInteraction.managementRecommendation && (
                          <Box mb={1}>
                            <Typography variant="caption" color="warning.main" fontWeight="medium">
                              Management Recommendation:
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {drugInteraction.managementRecommendation}
                            </Typography>
                          </Box>
                        )}

                        <Typography variant="caption" color="text.disabled">
                          Source: {drugInteraction.source}
                          {drugInteraction.drug1.rxcui && ` | RxCUI: ${drugInteraction.drug1.rxcui}, ${drugInteraction.drug2.rxcui}`}
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < interaction.interactions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Review History Accordion (if reviewed) */}
          {interaction.reviewedBy && (
            <Accordion 
              expanded={expandedPanel === 'review'} 
              onChange={handlePanelChange('review')}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2}>
                  <AssignmentIcon color="info" />
                  <Typography variant="subtitle1" fontWeight="medium">
                    Review History
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar sx={{ bgcolor: theme.palette.info.main, width: 32, height: 32 }}>
                      {interaction.reviewedBy.firstName[0]}{interaction.reviewedBy.lastName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">
                        {interaction.reviewedBy.firstName} {interaction.reviewedBy.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Reviewed on {interaction.reviewedAt && formatDate(interaction.reviewedAt)}
                      </Typography>
                    </Box>
                  </Box>

                  {interaction.reviewDecision && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Decision: {interaction.reviewDecision.action.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {interaction.reviewDecision.reason}
                      </Typography>

                      {interaction.reviewDecision.modificationSuggestions && (
                        <Box mb={1}>
                          <Typography variant="caption" color="primary" fontWeight="medium">
                            Modifications:
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {interaction.reviewDecision.modificationSuggestions}
                          </Typography>
                        </Box>
                      )}

                      {interaction.reviewDecision.monitoringParameters && (
                        <Box>
                          <Typography variant="caption" color="warning.main" fontWeight="medium">
                            Monitoring Required:
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {interaction.reviewDecision.monitoringParameters}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {interaction.pharmacistNotes && (
                    <Box>
                      <Typography variant="caption" color="text.primary" fontWeight="medium">
                        Pharmacist Notes:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {interaction.pharmacistNotes}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Quick Stats */}
          <Box 
            sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Quick Summary
            </Typography>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={1}>
                <SeverityIcon fontSize="small" color="primary" />
                <Typography variant="body2">
                  Highest: {highestSeverity}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon fontSize="small" color="primary" />
                <Typography variant="body2">
                  {formatDate(interaction.createdAt)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default InteractionDetailCard;