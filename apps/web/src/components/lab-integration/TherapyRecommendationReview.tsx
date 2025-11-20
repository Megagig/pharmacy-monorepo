import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Stack,
  Paper,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useApproveRecommendations } from '../../hooks/useLabIntegration';
import type { TherapyRecommendation, PharmacistReview } from '../../services/labIntegrationService';

interface TherapyRecommendationReviewProps {
  labIntegrationId: string;
  recommendations: TherapyRecommendation[];
  pharmacistReview?: PharmacistReview;
  status: string;
}

const TherapyRecommendationReview: React.FC<TherapyRecommendationReviewProps> = ({
  labIntegrationId,
  recommendations,
  pharmacistReview,
  status,
}) => {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'modified' | 'escalated'>('approved');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalatedTo, setEscalatedTo] = useState('');

  const approveMutation = useApproveRecommendations();

  const handleOpenReviewDialog = () => {
    setReviewDialogOpen(true);
  };

  const handleCloseReviewDialog = () => {
    setReviewDialogOpen(false);
    setDecision('approved');
    setClinicalNotes('');
    setEscalationReason('');
    setEscalatedTo('');
  };

  const handleSubmitReview = async () => {
    // Validate required fields
    if (!clinicalNotes.trim()) {
      toast.error('Clinical notes are required for all review decisions');
      return;
    }

    if (decision === 'escalated' && !escalationReason.trim()) {
      toast.error('Escalation reason is required when escalating to physician');
      return;
    }

    try {
      await approveMutation.mutateAsync({
        id: labIntegrationId,
        data: {
          decision,
          clinicalNotes: clinicalNotes.trim(),
          escalationReason: decision === 'escalated' ? escalationReason.trim() : undefined,
          escalatedTo: decision === 'escalated' ? escalatedTo.trim() : undefined,
        },
      });
      handleCloseReviewDialog();
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const getActionColor = (action?: string) => {
    if (!action) return 'default';
    const colors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
      start: 'success',
      stop: 'error',
      adjust_dose: 'warning',
      monitor: 'info',
      continue: 'default',
    };
    return colors[action] || 'default';
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return 'default';
    const colors: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
      critical: 'error',
      high: 'warning',
      medium: 'info',
      low: 'default',
    };
    return colors[priority] || 'default';
  };

  const getEvidenceLevelColor = (level?: string) => {
    if (!level) return 'default';
    const colors: Record<string, 'success' | 'warning' | 'default'> = {
      high: 'success',
      moderate: 'warning',
      low: 'default',
    };
    return colors[level] || 'default';
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <Alert severity="info">
        No therapy recommendations available. AI interpretation may still be in progress.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Pending Review Call-to-Action */}
      {!pharmacistReview && (status === 'pending_review' || status === 'pending_approval') && (
        <Card 
          variant="outlined" 
          sx={{ 
            border: 2,
            borderColor: 'warning.main',
            bgcolor: 'warning.50',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                <WarningIcon fontSize="large" />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  Review Required
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  AI has generated {recommendations?.length || 0} therapy recommendation{(recommendations?.length || 0) !== 1 ? 's' : ''} that require pharmacist review and approval.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                onClick={handleOpenReviewDialog}
                disabled={approveMutation.isPending}
                startIcon={<CheckCircleIcon />}
                sx={{ minWidth: 160 }}
              >
                Start Review
              </Button>
            </Box>
            
            {/* Quick Stats */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={`${recommendations?.length || 0} Recommendations`}
                color="warning"
                variant="outlined"
              />
              {recommendations?.some(r => r.priority === 'critical') && (
                <Chip
                  label="Critical Priority Items"
                  color="error"
                  icon={<WarningIcon />}
                />
              )}
              {recommendations?.some(r => r.action === 'start') && (
                <Chip
                  label="New Medications"
                  color="info"
                  variant="outlined"
                />
              )}
              {recommendations?.some(r => r.action === 'adjust_dose') && (
                <Chip
                  label="Dose Adjustments"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Review Status */}
      {pharmacistReview && (
        <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {pharmacistReview.decision === 'approved' && <CheckCircleIcon color="success" />}
              {pharmacistReview.decision === 'rejected' && <CancelIcon color="error" />}
              {pharmacistReview.decision === 'escalated' && <LocalHospitalIcon color="warning" />}
              Pharmacist Review
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Decision
                </Typography>
                <Chip
                  label={pharmacistReview.decision.toUpperCase()}
                  color={
                    pharmacistReview.decision === 'approved'
                      ? 'success'
                      : pharmacistReview.decision === 'rejected'
                      ? 'error'
                      : 'warning'
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Reviewed By
                </Typography>
                <Typography variant="body1">
                  {pharmacistReview.reviewedBy || 'Unknown reviewer'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Reviewed At
                </Typography>
                <Typography variant="body1">
                  {pharmacistReview.reviewedAt 
                    ? format(new Date(pharmacistReview.reviewedAt), 'MMM dd, yyyy HH:mm')
                    : 'Date not available'
                  }
                </Typography>
              </Grid>
              {(pharmacistReview.clinicalNotes || (pharmacistReview as any).comments) && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Clinical Notes
                  </Typography>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="body2">
                      {pharmacistReview.clinicalNotes || (pharmacistReview as any).comments || 'No notes available'}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {pharmacistReview.escalationReason && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    <Typography variant="subtitle2" gutterBottom>
                      Escalation Reason
                    </Typography>
                    <Typography variant="body2">
                      {pharmacistReview.escalationReason || 'No reason provided'}
                    </Typography>
                    {pharmacistReview.escalatedTo && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Escalated to: {pharmacistReview.escalatedTo}
                      </Typography>
                    )}
                  </Alert>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Recommendations Table */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Therapy Recommendations</Typography>
            {!pharmacistReview && (status === 'pending_review' || status === 'pending_approval') && (
              <Button
                variant="contained"
                onClick={handleOpenReviewDialog}
                disabled={approveMutation.isPending}
              >
                Review Recommendations
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Dosing</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Evidence</TableCell>
                  <TableCell>Rationale</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations?.map((rec, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {rec.medicationName || 'Unknown medication'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rec.action ? rec.action.replace(/_/g, ' ') : 'Unknown action'}
                        color={getActionColor(rec.action)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        {rec.currentDose && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Current: {rec.currentDose}
                          </Typography>
                        )}
                        {rec.recommendedDose && (
                          <Typography variant="caption" fontWeight="medium" display="block">
                            Recommended: {rec.recommendedDose}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rec.priority || 'unknown'}
                        color={getPriorityColor(rec.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rec.evidenceLevel || 'unknown'}
                        color={getEvidenceLevelColor(rec.evidenceLevel)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {rec.rationale || 'No rationale provided'}
                      </Typography>
                      {rec.targetLabValues && rec.targetLabValues.targetRange && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            icon={<TrendingUpIcon />}
                            label={`Target: ${rec.targetLabValues.targetRange}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onClose={handleCloseReviewDialog} maxWidth="md" fullWidth>
        <DialogTitle>Review Therapy Recommendations</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Decision</InputLabel>
              <Select value={decision} onChange={(e) => setDecision(e.target.value as any)} label="Decision">
                <MenuItem value="approved">Approve</MenuItem>
                <MenuItem value="rejected">Reject</MenuItem>
                <MenuItem value="modified">Modify</MenuItem>
                <MenuItem value="escalated">Escalate to Physician</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Clinical Notes"
              multiline
              rows={4}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              fullWidth
              required
              placeholder="Document your clinical assessment, rationale for decision, and any relevant considerations..."
              helperText={`Required: Include your clinical reasoning, assessment of recommendations, and any modifications or concerns (${clinicalNotes.length} characters)`}
              error={!clinicalNotes.trim() && clinicalNotes.length > 0}
            />

            {decision === 'escalated' && (
              <>
                <TextField
                  label="Escalation Reason"
                  multiline
                  rows={3}
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  fullWidth
                  required
                  placeholder="Explain why this case requires physician consultation..."
                />
                <TextField
                  label="Escalate To (Physician Name/Email)"
                  value={escalatedTo}
                  onChange={(e) => setEscalatedTo(e.target.value)}
                  fullWidth
                  placeholder="Dr. John Smith / john.smith@hospital.com"
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReviewDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitReview}
            variant="contained"
            disabled={
              approveMutation.isPending || 
              !clinicalNotes.trim() || 
              (decision === 'escalated' && !escalationReason)
            }
          >
            Submit Review
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default TherapyRecommendationReview;

