import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  IntegrationInstructions,
  NoteAdd,
  Assignment,
  Timeline,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Link as LinkIcon,
} from '@mui/icons-material';
import {
  useIntegrationRecommendations,
  useBatchIntegration,
  CreateClinicalNoteFromDiagnosticData,
  CreateMTRFromDiagnosticData,
} from '../hooks/useIntegration';

interface DiagnosticIntegrationPanelProps {
  diagnosticRequestId: string;
  diagnosticResultId?: string;
  patientId: string;
  onIntegrationComplete?: () => void;
}

interface IntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (operations: IntegrationOperations) => void;
  recommendations: any;
  isLoading: boolean;
}

interface IntegrationOperations {
  createClinicalNote: boolean;
  createMTR: boolean;
  enrichMTRId?: string;
  noteData?: CreateClinicalNoteFromDiagnosticData['noteData'];
  mtrData?: CreateMTRFromDiagnosticData['mtrData'];
}

const IntegrationDialog: React.FC<IntegrationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  recommendations,
  isLoading,
}) => {
  const [operations, setOperations] = useState<IntegrationOperations>({
    createClinicalNote: recommendations?.shouldCreateClinicalNote || false,
    createMTR: recommendations?.shouldCreateMTR || false,
    enrichMTRId: undefined,
    noteData: {
      type: 'consultation',
      priority: 'medium',
      followUpRequired: false,
      tags: ['diagnostic', 'ai-assisted'],
    },
    mtrData: {
      priority: 'routine',
    },
  });

  const handleOperationChange = (
    field: keyof IntegrationOperations,
    value: any
  ) => {
    setOperations((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNoteDataChange = (field: string, value: any) => {
    setOperations((prev) => ({
      ...prev,
      noteData: {
        ...prev.noteData,
        [field]: value,
      },
    }));
  };

  const handleMTRDataChange = (field: string, value: any) => {
    setOperations((prev) => ({
      ...prev,
      mtrData: {
        ...prev.mtrData,
        [field]: value,
      },
    }));
  };

  const handleConfirm = () => {
    onConfirm(operations);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <IntegrationInstructions />
          Configure Integration Options
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3} mt={2}>
          {/* Clinical Note Options */}
          <Accordion expanded={operations.createClinicalNote}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <FormControlLabel
                control={
                  <Switch
                    checked={operations.createClinicalNote}
                    onChange={(e) =>
                      handleOperationChange(
                        'createClinicalNote',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Create Clinical Note"
                onClick={(e) => e.stopPropagation()}
              />
            </AccordionSummary>
            <AccordionDetails>
              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  label="Note Title"
                  value={operations.noteData?.title || ''}
                  onChange={(e) =>
                    handleNoteDataChange('title', e.target.value)
                  }
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Note Type</InputLabel>
                  <Select
                    value={operations.noteData?.type || 'consultation'}
                    onChange={(e) =>
                      handleNoteDataChange('type', e.target.value)
                    }
                  >
                    <MenuItem value="consultation">Consultation</MenuItem>
                    <MenuItem value="medication_review">
                      Medication Review
                    </MenuItem>
                    <MenuItem value="follow_up">Follow-up</MenuItem>
                    <MenuItem value="adverse_event">Adverse Event</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={operations.noteData?.priority || 'medium'}
                    onChange={(e) =>
                      handleNoteDataChange('priority', e.target.value)
                    }
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={operations.noteData?.followUpRequired || false}
                      onChange={(e) =>
                        handleNoteDataChange(
                          'followUpRequired',
                          e.target.checked
                        )
                      }
                    />
                  }
                  label="Follow-up Required"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* MTR Options */}
          <Accordion expanded={operations.createMTR}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <FormControlLabel
                control={
                  <Switch
                    checked={operations.createMTR}
                    onChange={(e) =>
                      handleOperationChange('createMTR', e.target.checked)
                    }
                  />
                }
                label="Create New MTR"
                onClick={(e) => e.stopPropagation()}
              />
            </AccordionSummary>
            <AccordionDetails>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={operations.mtrData?.priority || 'routine'}
                    onChange={(e) =>
                      handleMTRDataChange('priority', e.target.value)
                    }
                  >
                    <MenuItem value="routine">Routine</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="high_risk">High Risk</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Review Reason"
                  value={operations.mtrData?.reviewReason || ''}
                  onChange={(e) =>
                    handleMTRDataChange('reviewReason', e.target.value)
                  }
                  multiline
                  rows={3}
                  fullWidth
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Existing MTR Enrichment */}
          {recommendations?.existingMTRs?.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">Enrich Existing MTR</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControl fullWidth>
                  <InputLabel>Select MTR to Enrich</InputLabel>
                  <Select
                    value={operations.enrichMTRId || ''}
                    onChange={(e) => {
                      handleOperationChange('enrichMTRId', e.target.value);
                      if (e.target.value) {
                        handleOperationChange('createMTR', false);
                      }
                    }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {recommendations.existingMTRs
                      .filter((mtr: any) => mtr.canEnrich)
                      .map((mtr: any) => (
                        <MenuItem key={mtr.id} value={mtr.id}>
                          {mtr.reviewNumber} - {mtr.status} ({mtr.priority})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Correlations Display */}
          {recommendations?.correlations?.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Found Correlations
              </Typography>
              <List dense>
                {recommendations.correlations.map(
                  (correlation: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <LinkIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={correlation.correlation}
                        secondary={`${correlation.type} - Confidence: ${Math.round(correlation.confidence * 100)}%`}
                      />
                    </ListItem>
                  )
                )}
              </List>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={
            isLoading ||
            (!operations.createClinicalNote &&
              !operations.createMTR &&
              !operations.enrichMTRId)
          }
          startIcon={
            isLoading ? <CircularProgress size={20} /> : <CheckCircle />
          }
        >
          {isLoading ? 'Processing...' : 'Execute Integration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const DiagnosticIntegrationPanel: React.FC<
  DiagnosticIntegrationPanelProps
> = ({
  diagnosticRequestId,
  diagnosticResultId,
  patientId,
  onIntegrationComplete,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    recommendations,
    isLoading: recommendationsLoading,
    crossReference,
    integrationOptions,
  } = useIntegrationRecommendations(diagnosticRequestId, patientId);

  const { executeBatchIntegration, isLoading: integrationLoading } =
    useBatchIntegration();

  const handleIntegrationClick = () => {
    setDialogOpen(true);
  };

  const handleIntegrationConfirm = async (
    operations: IntegrationOperations
  ) => {
    try {
      await executeBatchIntegration(
        diagnosticRequestId,
        diagnosticResultId,
        patientId,
        operations
      );
      setDialogOpen(false);
      onIntegrationComplete?.();
    } catch (error) {
      console.error('Integration failed:', error);
    }
  };

  if (recommendationsLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" p={3}>
            <CircularProgress />
            <Typography variant="body2" ml={2}>
              Analyzing integration options...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <IntegrationInstructions color="primary" />
            <Typography variant="h6">Integration Options</Typography>
          </Box>

          {/* Recommendations */}
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              Recommendations
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
              {recommendations?.shouldCreateClinicalNote && (
                <Chip
                  icon={<NoteAdd />}
                  label="Create Clinical Note"
                  color="primary"
                  variant="outlined"
                />
              )}
              {recommendations?.shouldCreateMTR && (
                <Chip
                  icon={<Assignment />}
                  label="Create MTR"
                  color="secondary"
                  variant="outlined"
                />
              )}
              {recommendations?.shouldEnrichExistingMTR && (
                <Chip
                  icon={<Timeline />}
                  label="Enrich Existing MTR"
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>

            {integrationOptions?.recommendations && (
              <List dense>
                {integrationOptions.recommendations.map(
                  (rec: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Info color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={rec} />
                    </ListItem>
                  )
                )}
              </List>
            )}
          </Box>

          <Divider />

          {/* Existing Records */}
          {(crossReference?.relatedClinicalNotes?.length > 0 ||
            crossReference?.relatedMTRs?.length > 0) && (
            <Box mt={3} mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Related Records
              </Typography>

              {crossReference.relatedMTRs?.length > 0 && (
                <Box mb={2}>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Recent MTRs ({crossReference.relatedMTRs.length})
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {crossReference.relatedMTRs.slice(0, 3).map((mtr: any) => (
                      <Chip
                        key={mtr._id}
                        label={`${mtr.reviewNumber} (${mtr.status})`}
                        size="small"
                        color={
                          mtr.status === 'in_progress' ? 'primary' : 'default'
                        }
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {crossReference.relatedClinicalNotes?.length > 0 && (
                <Box mb={2}>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Recent Clinical Notes (
                    {crossReference.relatedClinicalNotes.length})
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {crossReference.relatedClinicalNotes
                      .slice(0, 3)
                      .map((note: any) => (
                        <Chip
                          key={note._id}
                          label={note.title}
                          size="small"
                          color="default"
                        />
                      ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Correlations */}
          {recommendations?.correlations?.length > 0 && (
            <Box mb={3}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Found {recommendations.correlations.length} correlation(s)
                  with existing records
                </Typography>
              </Alert>
            </Box>
          )}

          <Divider />

          {/* Action Button */}
          <Box mt={3} display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={handleIntegrationClick}
              startIcon={<IntegrationInstructions />}
              disabled={integrationLoading}
            >
              Configure Integration
            </Button>
          </Box>
        </CardContent>
      </Card>

      <IntegrationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleIntegrationConfirm}
        recommendations={recommendations}
        isLoading={integrationLoading}
      />
    </>
  );
};
