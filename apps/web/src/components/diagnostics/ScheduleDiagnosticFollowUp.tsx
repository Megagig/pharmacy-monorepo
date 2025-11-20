import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '../common/NotificationSystem';
import { engagementIntegrationApi } from '../../services/api/engagementIntegrationApi';

interface DiagnosticCase {
  _id?: string;  // Optional for backward compatibility
  id?: string;   // Primary ID field from service
  caseId?: string;
  patientId: {
    _id?: string;
    id?: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
  };
  aiAnalysis?: {
    confidenceScore: number;
    redFlags?: Array<{
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
    differentialDiagnoses?: Array<{
      condition: string;
      probability: number;
      reasoning: string;
      severity: string;
    }>;
  };
  status: string;
  createdAt: string;
}

interface ScheduleDiagnosticFollowUpProps {
  diagnosticCase: DiagnosticCase;
  onFollowUpCreated?: (followUpTask: any) => void;
}

const ScheduleDiagnosticFollowUp: React.FC<ScheduleDiagnosticFollowUpProps> = ({
  diagnosticCase,
  onFollowUpCreated,
}) => {
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [locationId, setLocationId] = useState('');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();

  const createFollowUpMutation = useMutation({
    mutationFn: (data: { assignedTo?: string; locationId?: string }) => {
      // Use id field first (from service), fallback to _id (from API), then caseId
      const caseId = diagnosticCase.id || diagnosticCase._id || diagnosticCase.caseId;
      if (!caseId) {
        throw new Error('Diagnostic case ID is missing');
      }
      return engagementIntegrationApi.createFollowUpFromDiagnostic(caseId, data);
    },
    onSuccess: (response) => {
      showSuccess({
        title: 'Follow-up Scheduled',
        message: 'Follow-up task created successfully from diagnostic case',
      });

      // Invalidate relevant queries - use the correct ID
      const caseId = diagnosticCase.id || diagnosticCase._id || diagnosticCase.caseId;
      queryClient.invalidateQueries({ queryKey: ['followUpTasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['diagnosticEngagementData', caseId] });
      }

      if (onFollowUpCreated) {
        onFollowUpCreated(response.followUpTask);
      }

      setOpen(false);
      setAssignedTo('');
      setLocationId('');
    },
    onError: (error: any) => {
      showError({
        title: 'Failed to Schedule Follow-up',
        message: error.response?.data?.message || 'Failed to create follow-up task',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFollowUpMutation.mutate({
      assignedTo: assignedTo || undefined,
      locationId: locationId || undefined,
    });
  };

  const getPriorityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'immediate':
        return 'error';
      case 'within_24h':
        return 'warning';
      case 'routine':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<ScheduleIcon />}
        onClick={() => setOpen(true)}
        color="primary"
      >
        Schedule Follow-up
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Schedule Diagnostic Follow-up</Typography>
            <Button onClick={() => setOpen(false)} color="inherit" size="small">
              <CloseIcon />
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* Case Information */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Case Information
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Case ID:</strong> {diagnosticCase.id || diagnosticCase.caseId || diagnosticCase._id || 'N/A'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Patient:</strong> {diagnosticCase.patientId.firstName} {diagnosticCase.patientId.lastName}
                  ({diagnosticCase.patientId.age}y, {diagnosticCase.patientId.gender})
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Status:</strong> {diagnosticCase.status}
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(diagnosticCase.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>

            {/* AI Analysis Summary */}
            {diagnosticCase.aiAnalysis && (
              <Box>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  AI Analysis Summary
                </Typography>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Confidence Score:</strong> {
                      diagnosticCase.aiAnalysis?.confidenceScore
                        ? `${Math.round(diagnosticCase.aiAnalysis.confidenceScore * 100)}%`
                        : 'N/A'
                    }
                  </Typography>

                  {diagnosticCase.aiAnalysis.differentialDiagnoses && diagnosticCase.aiAnalysis.differentialDiagnoses.length > 0 && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Top Diagnosis:</strong> {diagnosticCase.aiAnalysis.differentialDiagnoses[0].condition}
                      ({Math.round(diagnosticCase.aiAnalysis.differentialDiagnoses[0].probability * 100)}%)
                    </Typography>
                  )}

                  {diagnosticCase.aiAnalysis.redFlags && diagnosticCase.aiAnalysis.redFlags.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Red Flags:</strong>
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {diagnosticCase.aiAnalysis.redFlags.slice(0, 3).map((flag, index) => (
                          <Chip
                            key={index}
                            label={`${flag.flag} (${flag.severity})`}
                            color={getPriorityColor(flag.severity) as any}
                            size="small"
                          />
                        ))}
                        {diagnosticCase.aiAnalysis.redFlags.length > 3 && (
                          <Chip
                            label={`+${diagnosticCase.aiAnalysis.redFlags.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Box>
                  )}

                  {diagnosticCase.aiAnalysis.referralRecommendation?.recommended && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Referral Recommended:</strong>
                      </Typography>
                      <Chip
                        label={`${diagnosticCase.aiAnalysis.referralRecommendation.specialty} (${diagnosticCase.aiAnalysis.referralRecommendation.urgency})`}
                        color={getUrgencyColor(diagnosticCase.aiAnalysis.referralRecommendation.urgency) as any}
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Follow-up Configuration */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Follow-up Configuration
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  The follow-up priority and due date will be automatically determined based on the AI analysis,
                  confidence score, and red flags identified in this diagnostic case.
                </Typography>
              </Alert>

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Assigned Pharmacist"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Leave empty to assign to yourself"
                  helperText="Optional: Specify a different pharmacist to assign this follow-up to"
                />

                <TextField
                  fullWidth
                  label="Location ID"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  placeholder="Optional location identifier"
                  helperText="Optional: Specify location for multi-location pharmacies"
                />
              </Stack>
            </Box>

            {/* Expected Follow-up Details */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Expected Follow-up Details
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
                <Typography variant="body2" gutterBottom>
                  <AssignmentIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  <strong>Objectives will include:</strong>
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Monitor patient's current condition and symptoms</li>
                  <li>Assess any changes since initial diagnostic assessment</li>
                  {diagnosticCase.aiAnalysis?.redFlags && diagnosticCase.aiAnalysis.redFlags.length > 0 && (
                    <li>Monitor for red flag symptoms and complications</li>
                  )}
                  {diagnosticCase.aiAnalysis?.referralRecommendation?.recommended && (
                    <li>Follow up on specialist referral and recommendations</li>
                  )}
                  <li>Determine next steps and ongoing care plan</li>
                </ul>
              </Box>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={createFollowUpMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createFollowUpMutation.isPending}
            startIcon={createFollowUpMutation.isPending ? <CircularProgress size={20} /> : <ScheduleIcon />}
          >
            {createFollowUpMutation.isPending ? 'Creating...' : 'Schedule Follow-up'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ScheduleDiagnosticFollowUp;