import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  Paper,
  Tooltip,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  PersonAdd as PersonAddIcon,
  Schedule as ScheduleIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Types based on the DiagnosticCase model
interface DiagnosticResult {
  caseId: string;
  patientId: string;
  aiAnalysis: {
    differentialDiagnoses: Array<{
      condition: string;
      probability: number;
      reasoning: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    recommendedTests: Array<{
      testName: string;
      priority: 'urgent' | 'routine' | 'optional';
      reasoning: string;
    }>;
    therapeuticOptions: Array<{
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      reasoning: string;
      safetyNotes: string[];
    }>;
    redFlags: Array<{
      flag: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      action: string;
    }>;
    referralRecommendation?: {
      recommended: boolean;
      urgency: 'immediate' | 'within_24h' | 'routine';
      specialty: string;
      reason: string;
    };
    disclaimer: string;
    confidenceScore: number;
    processingTime: number;
  };
  drugInteractions?: Array<{
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    clinicalEffect: string;
    management: string;
  }>;
  status: 'draft' | 'completed' | 'referred' | 'cancelled';
  createdAt: string;
}

interface InterpretationPanelProps {
  diagnosticResult: DiagnosticResult;
  patientName?: string;
  orderId?: string;
  onActionTaken: (action: string, data?: any) => void;
  onCreatePrescription?: (medication: any) => void;
  onScheduleReferral?: (referral: any) => void;
  onCreateCarePlan?: (plan: any) => void;
  onPrintReport?: () => void;
  onShareResults?: () => void;
  loading?: boolean;
}

const InterpretationPanel: React.FC<InterpretationPanelProps> = ({
  diagnosticResult,
  patientName,
  orderId,
  onActionTaken,
  onCreatePrescription,
  onScheduleReferral,
  onCreateCarePlan,
  onPrintReport,
  onShareResults,
  loading = false,
}) => {
  // State management
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    redFlags: true, // Red flags expanded by default
    diagnoses: true,
    recommendations: false,
    therapeutics: false,
    interactions: false,
  });
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'prescription' | 'referral' | 'carePlan' | null;
    data?: any;
  }>({ open: false, type: null });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Helper functions
  const getSeverityColor = (
    severity: string
  ): 'error' | 'warning' | 'info' | 'success' => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
      case 'major':
        return 'error';
      case 'medium':
      case 'moderate':
        return 'warning';
      case 'low':
      case 'minor':
        return 'info';
      default:
        return 'info';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
      case 'major':
        return <WarningIcon color="error" />;
      case 'medium':
      case 'moderate':
        return <WarningIcon color="warning" />;
      case 'low':
      case 'minor':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'routine':
        return 'warning';
      case 'optional':
        return 'info';
      default:
        return 'info';
    }
  };

  const handleSectionToggle = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleActionClick = useCallback(
    (actionType: string, data?: any) => {
      switch (actionType) {
        case 'prescription':
          setActionDialog({ open: true, type: 'prescription', data });
          break;
        case 'referral':
          setActionDialog({ open: true, type: 'referral', data });
          break;
        case 'carePlan':
          setActionDialog({ open: true, type: 'carePlan', data });
          break;
        case 'print':
          onPrintReport?.();
          onActionTaken('print_report');
          break;
        case 'share':
          onShareResults?.();
          onActionTaken('share_results');
          break;
        default:
          onActionTaken(actionType, data);
      }
    },
    [onActionTaken, onPrintReport, onShareResults]
  );

  const handleDialogClose = () => {
    setActionDialog({ open: false, type: null });
  };

  const handleDialogSubmit = (formData: any) => {
    const { type, data } = actionDialog;

    switch (type) {
      case 'prescription':
        onCreatePrescription?.(formData);
        onActionTaken('create_prescription', formData);
        break;
      case 'referral':
        onScheduleReferral?.(formData);
        onActionTaken('schedule_referral', formData);
        break;
      case 'carePlan':
        onCreateCarePlan?.(formData);
        onActionTaken('create_care_plan', formData);
        break;
    }

    setSnackbar({
      open: true,
      message: `${type} created successfully`,
      severity: 'success',
    });

    handleDialogClose();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Processing AI interpretation...
        </Typography>
      </Box>
    );
  }

  const { aiAnalysis, drugInteractions } = diagnosticResult;
  const criticalRedFlags = aiAnalysis.redFlags.filter(
    (flag) => flag.severity === 'critical'
  );
  const hasUrgentReferral =
    aiAnalysis.referralRecommendation?.urgency === 'immediate';

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, mx: 'auto' }}>
      {/* Header with confidence score and actions */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              AI Diagnostic Interpretation
            </Typography>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              {patientName && (
                <Typography variant="body2" color="text.secondary">
                  Patient: {patientName}
                </Typography>
              )}
              {orderId && (
                <Typography variant="body2" color="text.secondary">
                  Order: {orderId}
                </Typography>
              )}
              <Chip
                label={`Confidence: ${aiAnalysis.confidenceScore}%`}
                color={
                  aiAnalysis.confidenceScore >= 80
                    ? 'success'
                    : aiAnalysis.confidenceScore >= 60
                      ? 'warning'
                      : 'error'
                }
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                Processed in {aiAnalysis.processingTime}ms
              </Typography>
            </Box>
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => handleActionClick('print')}
              size="small"
            >
              Print
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={() => handleActionClick('share')}
              size="small"
            >
              Share
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Critical Alerts Banner */}
      {(criticalRedFlags.length > 0 || hasUrgentReferral) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            hasUrgentReferral && (
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  handleActionClick(
                    'referral',
                    aiAnalysis.referralRecommendation
                  )
                }
              >
                Schedule Referral
              </Button>
            )
          }
        >
          <Typography variant="h6" component="div">
            🚨 Critical Alert - Immediate Attention Required
          </Typography>
          {criticalRedFlags.map((flag, index) => (
            <Typography key={index} variant="body2">
              • {flag.flag}: {flag.action}
            </Typography>
          ))}
          {hasUrgentReferral && (
            <Typography variant="body2">
              • Immediate referral to{' '}
              {aiAnalysis.referralRecommendation?.specialty} required:{' '}
              {aiAnalysis.referralRecommendation?.reason}
            </Typography>
          )}
        </Alert>
      )}

      {/* Red Flags Section */}
      {aiAnalysis.redFlags.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Accordion
            expanded={expandedSections.redFlags}
            onChange={() => handleSectionToggle('redFlags')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon color="error" />
                <Typography variant="h6">
                  Red Flags ({aiAnalysis.redFlags.length})
                </Typography>
                {criticalRedFlags.length > 0 && (
                  <Chip
                    label={`${criticalRedFlags.length} Critical`}
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {aiAnalysis.redFlags.map((flag, index) => (
                  <ListItem
                    key={index}
                    divider={index < aiAnalysis.redFlags.length - 1}
                  >
                    <ListItemIcon>
                      {getSeverityIcon(flag.severity)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" component="span">
                            {flag.flag}
                          </Typography>
                          <Chip
                            label={flag.severity.toUpperCase()}
                            color={getSeverityColor(flag.severity)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          <strong>Action:</strong> {flag.action}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Card>
      )}

      {/* Differential Diagnoses */}
      <Card sx={{ mb: 2 }}>
        <Accordion
          expanded={expandedSections.diagnoses}
          onChange={() => handleSectionToggle('diagnoses')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <HospitalIcon color="primary" />
              <Typography variant="h6">
                Differential Diagnoses (
                {aiAnalysis.differentialDiagnoses.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {aiAnalysis.differentialDiagnoses.map((diagnosis, index) => (
                <ListItem
                  key={index}
                  divider={index < aiAnalysis.differentialDiagnoses.length - 1}
                >
                  <ListItemText
                    primary={
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        flexWrap="wrap"
                      >
                        <Typography variant="subtitle1" component="span">
                          {diagnosis.condition}
                        </Typography>
                        <Chip
                          label={`${diagnosis.probability}%`}
                          color={
                            diagnosis.probability > 70
                              ? 'error'
                              : diagnosis.probability > 40
                                ? 'warning'
                                : 'success'
                          }
                          size="small"
                        />
                        <Chip
                          label={diagnosis.severity}
                          color={getSeverityColor(diagnosis.severity)}
                          size="small"
                        />
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
      </Card>

      {/* Recommended Tests */}
      {aiAnalysis.recommendedTests.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Accordion
            expanded={expandedSections.recommendations}
            onChange={() => handleSectionToggle('recommendations')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <ScienceIcon color="info" />
                <Typography variant="h6">
                  Recommended Tests ({aiAnalysis.recommendedTests.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {aiAnalysis.recommendedTests.map((test, index) => (
                  <ListItem
                    key={index}
                    divider={index < aiAnalysis.recommendedTests.length - 1}
                  >
                    <ListItemText
                      primary={
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Typography variant="subtitle1" component="span">
                            {test.testName}
                          </Typography>
                          <Chip
                            label={test.priority}
                            color={getPriorityColor(test.priority)}
                            size="small"
                          />
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
        </Card>
      )}

      {/* Therapeutic Options */}
      {aiAnalysis.therapeuticOptions.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Accordion
            expanded={expandedSections.therapeutics}
            onChange={() => handleSectionToggle('therapeutics')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <MedicationIcon color="success" />
                <Typography variant="h6">
                  Therapeutic Options ({aiAnalysis.therapeuticOptions.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {aiAnalysis.therapeuticOptions.map((option, index) => (
                  <ListItem
                    key={index}
                    divider={index < aiAnalysis.therapeuticOptions.length - 1}
                  >
                    <ListItemText
                      primary={
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Typography variant="subtitle1" component="span">
                            {option.medication}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.dosage}, {option.frequency} for{' '}
                            {option.duration}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              handleActionClick('prescription', option)
                            }
                          >
                            Create Prescription
                          </Button>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            paragraph
                          >
                            <strong>Reasoning:</strong> {option.reasoning}
                          </Typography>
                          {option.safetyNotes.length > 0 && (
                            <Box>
                              <Typography
                                variant="caption"
                                color="error"
                                display="block"
                              >
                                Safety Notes:
                              </Typography>
                              {option.safetyNotes.map((note, noteIndex) => (
                                <Typography
                                  key={noteIndex}
                                  variant="caption"
                                  color="error"
                                  display="block"
                                >
                                  • {note}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Card>
      )}

      {/* Drug Interactions */}
      {drugInteractions && drugInteractions.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Accordion
            expanded={expandedSections.interactions}
            onChange={() => handleSectionToggle('interactions')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon color="warning" />
                <Typography variant="h6">
                  Drug Interactions ({drugInteractions.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {drugInteractions.map((interaction, index) => (
                  <ListItem
                    key={index}
                    divider={index < drugInteractions.length - 1}
                  >
                    <ListItemText
                      primary={
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Typography variant="subtitle1" component="span">
                            {interaction.drug1} ↔ {interaction.drug2}
                          </Typography>
                          <Chip
                            label={interaction.severity}
                            color={getSeverityColor(interaction.severity)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            paragraph
                          >
                            <strong>Description:</strong>{' '}
                            {interaction.description}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            paragraph
                          >
                            <strong>Clinical Effect:</strong>{' '}
                            {interaction.clinicalEffect}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Management:</strong>{' '}
                            {interaction.management}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Card>
      )}

      {/* Referral Recommendation */}
      {aiAnalysis.referralRecommendation?.recommended && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <PersonAddIcon color="info" />
              <Typography variant="h6">Referral Recommendation</Typography>
              <Chip
                label={aiAnalysis.referralRecommendation.urgency
                  .replace('_', ' ')
                  .toUpperCase()}
                color={
                  aiAnalysis.referralRecommendation.urgency === 'immediate'
                    ? 'error'
                    : 'warning'
                }
                size="small"
              />
            </Box>
            <Typography variant="body1" paragraph>
              <strong>Specialty:</strong>{' '}
              {aiAnalysis.referralRecommendation.specialty}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {aiAnalysis.referralRecommendation.reason}
            </Typography>
            <Button
              variant="contained"
              startIcon={<ScheduleIcon />}
              onClick={() =>
                handleActionClick('referral', aiAnalysis.referralRecommendation)
              }
              color={
                aiAnalysis.referralRecommendation.urgency === 'immediate'
                  ? 'error'
                  : 'primary'
              }
            >
              Schedule Referral
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AssignmentIcon />}
              onClick={() => handleActionClick('carePlan')}
            >
              Create Care Plan
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ScheduleIcon />}
              onClick={() => handleActionClick('followUp')}
            >
              Schedule Follow-up
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleActionClick('markComplete')}
            >
              Mark Complete
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Disclaimer */}
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Disclaimer:</strong> {aiAnalysis.disclaimer}
        </Typography>
      </Alert>

      {/* Action Dialogs */}
      <ActionDialog
        open={actionDialog.open}
        type={actionDialog.type}
        data={actionDialog.data}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Action Dialog Component
interface ActionDialogProps {
  open: boolean;
  type: 'prescription' | 'referral' | 'carePlan' | null;
  data?: any;
  onClose: () => void;
  onSubmit: (formData: any) => void;
}

const ActionDialog: React.FC<ActionDialogProps> = ({
  open,
  type,
  data,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = () => {
    onSubmit(formData);
    setFormData({});
  };

  const getDialogTitle = () => {
    switch (type) {
      case 'prescription':
        return 'Create Prescription';
      case 'referral':
        return 'Schedule Referral';
      case 'carePlan':
        return 'Create Care Plan';
      default:
        return 'Action';
    }
  };

  const renderDialogContent = () => {
    switch (type) {
      case 'prescription':
        return (
          <Box>
            <TextField
              fullWidth
              label="Medication"
              value={formData.medication || data?.medication || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, medication: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Dosage"
              value={formData.dosage || data?.dosage || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dosage: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Frequency"
              value={formData.frequency || data?.frequency || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, frequency: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Duration"
              value={formData.duration || data?.duration || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, duration: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Instructions"
              value={formData.instructions || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  instructions: e.target.value,
                }))
              }
              margin="normal"
            />
          </Box>
        );
      case 'referral':
        return (
          <Box>
            <TextField
              fullWidth
              label="Specialty"
              value={formData.specialty || data?.specialty || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, specialty: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Urgency"
              value={formData.urgency || data?.urgency || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, urgency: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason"
              value={formData.reason || data?.reason || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reason: e.target.value }))
              }
              margin="normal"
            />
          </Box>
        );
      case 'carePlan':
        return (
          <Box>
            <TextField
              fullWidth
              label="Plan Title"
              value={formData.title || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              margin="normal"
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Plan Description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              margin="normal"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.followUpRequired || false}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      followUpRequired: e.target.checked,
                    }))
                  }
                />
              }
              label="Follow-up required"
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          {getDialogTitle()}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>{renderDialogContent()}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InterpretationPanel;
