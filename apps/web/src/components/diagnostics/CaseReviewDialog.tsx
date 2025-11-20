import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CloseIcon from '@mui/icons-material/Close';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';

interface DiagnosticCase {
  _id: string;
  caseId: string;
  status: string;
  patientId: {
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
  };
  symptoms: {
    subjective: string[];
    objective: string[];
    duration: string;
    severity: string;
    onset: string;
  };
  aiAnalysis: {
    differentialDiagnoses: Array<{
      condition: string;
      probability: number;
      reasoning: string;
      severity: string;
    }>;
    recommendedTests: Array<{
      testName: string;
      priority: string;
      reasoning: string;
    }>;
    therapeuticOptions: Array<{
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
      reasoning: string;
    }>;
    redFlags: Array<{
      flag: string;
      severity: string;
      action: string;
    }>;
    confidenceScore: number;
    referralRecommendation?: {
      recommended: boolean;
      urgency: string;
      specialty: string;
      reason: string;
    };
  };
  createdAt: string;
}

interface CaseReviewDialogProps {
  open: boolean;
  onClose: () => void;
  case: DiagnosticCase | null;
  onMarkFollowUp: (caseId: string, data: { followUpDate: Date; reason: string; notes: string }) => Promise<void>;
  onMarkCompleted: (caseId: string, data: { notes: string; finalRecommendation: string; counselingPoints: string[] }) => Promise<void>;
  onGenerateReferral: (caseId: string, data: { notes: string; physicianInfo: any }) => Promise<void>;
  loading?: boolean;
}

const CaseReviewDialog: React.FC<CaseReviewDialogProps> = ({
  open,
  onClose,
  case: diagnosticCase,
  onMarkFollowUp,
  onMarkCompleted,
  onGenerateReferral,
  loading = false,
}) => {
  const [action, setAction] = useState<'review' | 'follow_up' | 'complete' | 'referral'>('review');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [followUpReason, setFollowUpReason] = useState('');
  const [finalRecommendation, setFinalRecommendation] = useState('');
  const [counselingPoints, setCounselingPoints] = useState('');
  const [physicianInfo, setPhysicianInfo] = useState({
    physicianName: '',
    physicianEmail: '',
    specialty: '',
    institution: '',
  });

  const handleSubmit = async () => {
    if (!diagnosticCase) return;

    try {
      switch (action) {
        case 'follow_up':
          if (!followUpDate || !followUpReason) {
            alert('Please provide follow-up date and reason');
            return;
          }
          await onMarkFollowUp(diagnosticCase.caseId, {
            followUpDate,
            reason: followUpReason,
            notes,
          });
          break;

        case 'complete':
          await onMarkCompleted(diagnosticCase.caseId, {
            notes,
            finalRecommendation,
            counselingPoints: counselingPoints.split('\n').filter(point => point.trim()),
          });
          break;

        case 'referral':
          await onGenerateReferral(diagnosticCase.caseId, {
            notes,
            physicianInfo,
          });
          break;
      }

      // Reset form
      setAction('review');
      setNotes('');
      setFollowUpDate(null);
      setFollowUpReason('');
      setFinalRecommendation('');
      setCounselingPoints('');
      setPhysicianInfo({
        physicianName: '',
        physicianEmail: '',
        specialty: '',
        institution: '',
      });

      onClose();
    } catch (error) {
      console.error('Failed to submit case review:', error);
    }
  };

  if (!diagnosticCase) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Case Review - {diagnosticCase.patientId ? 
                `${diagnosticCase.patientId.firstName} ${diagnosticCase.patientId.lastName}` : 
                'Unknown Patient'
              }
            </Typography>
            <Button onClick={onClose} color="inherit">
              <CloseIcon />
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* Case Information */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Case Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Case ID: {diagnosticCase.caseId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Date: {format(new Date(diagnosticCase.createdAt), 'MMM dd, yyyy HH:mm')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Patient: {diagnosticCase.patientId ? 
                        `${diagnosticCase.patientId.firstName} ${diagnosticCase.patientId.lastName} (${diagnosticCase.patientId.age}y, ${diagnosticCase.patientId.gender})` : 
                        'Unknown Patient'
                      }
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      Symptoms
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Subjective:</strong> {diagnosticCase.symptoms.subjective.join(', ')}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Objective:</strong> {diagnosticCase.symptoms.objective.join(', ')}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Duration:</strong> {diagnosticCase.symptoms.duration}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <strong>Severity:</strong> {diagnosticCase.symptoms.severity}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Onset:</strong> {diagnosticCase.symptoms.onset}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* AI Analysis */}
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        AI Analysis
                      </Typography>
                      <Chip
                        label={`${Math.round(diagnosticCase.aiAnalysis.confidenceScore)}% Confidence`}
                        color="info"
                        size="small"
                      />
                    </Box>

                    <Typography variant="subtitle2" gutterBottom>
                      Top Differential Diagnoses
                    </Typography>
                    <List dense>
                      {diagnosticCase.aiAnalysis.differentialDiagnoses.slice(0, 3).map((diagnosis, index) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemText
                            primary={`${diagnosis.condition} (${Math.round(diagnosis.probability)}%)`}
                            secondary={diagnosis.reasoning}
                          />
                        </ListItem>
                      ))}
                    </List>

                    {diagnosticCase.aiAnalysis.redFlags.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Red Flags
                        </Typography>
                        {diagnosticCase.aiAnalysis.redFlags.map((flag, index) => (
                          <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                            <Typography variant="body2">
                              <strong>{flag.flag}</strong> ({flag.severity})
                            </Typography>
                            <Typography variant="caption">
                              {flag.action}
                            </Typography>
                          </Alert>
                        ))}
                      </>
                    )}

                    {diagnosticCase.aiAnalysis.referralRecommendation?.recommended && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>AI Recommends Referral</strong>
                          </Typography>
                          <Typography variant="caption">
                            Specialty: {diagnosticCase.aiAnalysis.referralRecommendation.specialty}<br />
                            Urgency: {diagnosticCase.aiAnalysis.referralRecommendation.urgency}<br />
                            Reason: {diagnosticCase.aiAnalysis.referralRecommendation.reason}
                          </Typography>
                        </Alert>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>

            {/* Action Selection */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pharmacist Decision
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <Button
                    variant={action === 'follow_up' ? 'contained' : 'outlined'}
                    startIcon={<ScheduleIcon />}
                    onClick={() => setAction('follow_up')}
                    color="warning"
                  >
                    Mark for Follow-up
                  </Button>
                  <Button
                    variant={action === 'complete' ? 'contained' : 'outlined'}
                    startIcon={<CheckCircleIcon />}
                    onClick={() => setAction('complete')}
                    color="success"
                  >
                    Mark as Completed
                  </Button>
                  <Button
                    variant={action === 'referral' ? 'contained' : 'outlined'}
                    startIcon={<LocalHospitalIcon />}
                    onClick={() => setAction('referral')}
                    color="secondary"
                  >
                    Generate Referral
                  </Button>
                </Box>

                {/* Common Notes Field */}
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Pharmacist Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{ mb: 2 }}
                />

                {/* Follow-up Specific Fields */}
                {action === 'follow_up' && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <DatePicker
                        label="Follow-up Date"
                        value={followUpDate}
                        onChange={(date) => setFollowUpDate(date as Date | null)}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <FormControl fullWidth>
                        <InputLabel>Follow-up Reason</InputLabel>
                        <Select
                          value={followUpReason}
                          onChange={(e) => setFollowUpReason(e.target.value)}
                          label="Follow-up Reason"
                        >
                          <MenuItem value="monitor_symptoms">Monitor Symptoms</MenuItem>
                          <MenuItem value="check_medication_response">Check Medication Response</MenuItem>
                          <MenuItem value="review_test_results">Review Test Results</MenuItem>
                          <MenuItem value="assess_improvement">Assess Improvement</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Stack>
                )}

                {/* Completion Specific Fields */}
                {action === 'complete' && (
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Final Recommendation"
                      value={finalRecommendation}
                      onChange={(e) => setFinalRecommendation(e.target.value)}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Counseling Points (one per line)"
                      value={counselingPoints}
                      onChange={(e) => setCounselingPoints(e.target.value)}
                      placeholder="Enter counseling points, one per line"
                    />
                  </Stack>
                )}

                {/* Referral Specific Fields */}
                {action === 'referral' && (
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <TextField
                        fullWidth
                        label="Physician Name"
                        value={physicianInfo.physicianName}
                        onChange={(e) => setPhysicianInfo({ ...physicianInfo, physicianName: e.target.value })}
                      />
                      <TextField
                        fullWidth
                        label="Physician Email"
                        type="email"
                        value={physicianInfo.physicianEmail}
                        onChange={(e) => setPhysicianInfo({ ...physicianInfo, physicianEmail: e.target.value })}
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <FormControl fullWidth>
                        <InputLabel>Specialty</InputLabel>
                        <Select
                          value={physicianInfo.specialty}
                          onChange={(e) => setPhysicianInfo({ ...physicianInfo, specialty: e.target.value })}
                          label="Specialty"
                        >
                          <MenuItem value="general_medicine">General Medicine</MenuItem>
                          <MenuItem value="cardiology">Cardiology</MenuItem>
                          <MenuItem value="endocrinology">Endocrinology</MenuItem>
                          <MenuItem value="gastroenterology">Gastroenterology</MenuItem>
                          <MenuItem value="neurology">Neurology</MenuItem>
                          <MenuItem value="psychiatry">Psychiatry</MenuItem>
                          <MenuItem value="dermatology">Dermatology</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        label="Institution"
                        value={physicianInfo.institution}
                        onChange={(e) => setPhysicianInfo({ ...physicianInfo, institution: e.target.value })}
                      />
                    </Stack>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || action === 'review'}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' :
              action === 'follow_up' ? 'Schedule Follow-up' :
                action === 'complete' ? 'Mark Completed' :
                  action === 'referral' ? 'Generate Referral' :
                    'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CaseReviewDialog;