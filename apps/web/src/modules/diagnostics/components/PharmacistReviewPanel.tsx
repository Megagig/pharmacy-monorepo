import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Stack,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { DiagnosticResult } from '../types';

interface PharmacistReviewPanelProps {
  result: DiagnosticResult;
  onApprove?: () => void;
  onModify?: (modifications: string) => void;
  onReject?: (reason: string) => void;
  loading?: boolean;
  error?: string;
  currentUser?: {
    id: string;
    name: string;
    role: string;
  };
}

interface ReviewDialogState {
  open: boolean;
  type: 'approve' | 'modify' | 'reject' | null;
  text: string;
  confirmationRequired: boolean;
}

const PharmacistReviewPanel: React.FC<PharmacistReviewPanelProps> = ({
  result,
  onApprove,
  onModify,
  onReject,
  loading = false,
  error,
  currentUser,
}) => {
  const [dialogState, setDialogState] = useState<ReviewDialogState>({
    open: false,
    type: null,
    text: '',
    confirmationRequired: false,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
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

  const handleOpenDialog = (type: 'approve' | 'modify' | 'reject') => {
    const requiresConfirmation =
      type === 'approve' &&
      (result.redFlags.some(
        (flag) => flag.severity === 'critical' || flag.severity === 'high'
      ) ||
        result.referralRecommendation?.recommended);

    setDialogState({
      open: true,
      type,
      text: '',
      confirmationRequired: requiresConfirmation,
    });
  };

  const handleCloseDialog = () => {
    setDialogState({
      open: false,
      type: null,
      text: '',
      confirmationRequired: false,
    });
  };

  const handleSubmitReview = () => {
    const { type, text } = dialogState;

    switch (type) {
      case 'approve':
        onApprove?.();
        break;
      case 'modify':
        if (text.trim()) {
          onModify?.(text.trim());
        }
        break;
      case 'reject':
        if (text.trim()) {
          onReject?.(text.trim());
        }
        break;
    }

    handleCloseDialog();
  };

  const getReviewStatusChip = () => {
    if (!result.pharmacistReview) {
      return (
        <Chip
          label="Pending Review"
          color="warning"
          variant="outlined"
          icon={<ScheduleIcon />}
        />
      );
    }

    const { status } = result.pharmacistReview;
    const config = {
      approved: {
        color: 'success' as const,
        icon: CheckCircleIcon,
        label: 'Approved',
      },
      modified: {
        color: 'warning' as const,
        icon: EditIcon,
        label: 'Modified',
      },
      rejected: {
        color: 'error' as const,
        icon: CancelIcon,
        label: 'Rejected',
      },
    };

    const statusConfig = config[status];
    const Icon = statusConfig.icon;

    return (
      <Chip
        label={statusConfig.label}
        color={statusConfig.color}
        variant="filled"
        icon={<Icon />}
      />
    );
  };

  const isReviewed = !!result.pharmacistReview;
  const hasHighRiskFlags = result.redFlags.some(
    (flag) => flag.severity === 'critical' || flag.severity === 'high'
  );
  const hasReferralRecommendation = result.referralRecommendation?.recommended;

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
              <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
              Pharmacist Review
            </Typography>
            {getReviewStatusChip()}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Review Warnings */}
          {!isReviewed && (hasHighRiskFlags || hasReferralRecommendation) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Special Attention Required
              </Typography>
              <Stack spacing={0.5}>
                {hasHighRiskFlags && (
                  <Typography variant="body2">
                    • Critical or high-risk red flags detected
                  </Typography>
                )}
                {hasReferralRecommendation && (
                  <Typography variant="body2">
                    • AI recommends referral to{' '}
                    {result.referralRecommendation?.specialty}
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}
        </Box>

        {/* Review History */}
        {isReviewed && (
          <Box sx={{ mb: 3 }}>
            <Accordion
              expanded={expandedSections.has('history')}
              onChange={() => handleToggleSection('history')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Review History
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Reviewed By
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {result.pharmacistReview.reviewedBy}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Review Date
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {new Date(
                          result.pharmacistReview.reviewedAt
                        ).toLocaleString()}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Decision
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>{getReviewStatusChip()}</Box>
                    </Box>

                    {result.pharmacistReview.modifications && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Modifications Made
                        </Typography>
                        <Alert severity="info" sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            {result.pharmacistReview.modifications}
                          </Typography>
                        </Alert>
                      </Box>
                    )}

                    {result.pharmacistReview.rejectionReason && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Rejection Reason
                        </Typography>
                        <Alert severity="error" sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            {result.pharmacistReview.rejectionReason}
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Review Checklist */}
        {!isReviewed && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Review Checklist
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <Tooltip title="Verify diagnostic accuracy">
                    <InfoIcon color="primary" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText
                  primary="Diagnostic Assessment"
                  secondary="Review differential diagnoses for clinical accuracy and relevance"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Tooltip title="Check medication safety">
                    <InfoIcon color="primary" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText
                  primary="Medication Safety"
                  secondary="Verify drug selections, dosages, and interaction checks"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Tooltip title="Assess red flags">
                    <WarningIcon color="warning" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText
                  primary="Red Flag Assessment"
                  secondary="Evaluate critical findings and recommended actions"
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Tooltip title="Review referral needs">
                    <InfoIcon color="primary" />
                  </Tooltip>
                </ListItemIcon>
                <ListItemText
                  primary="Referral Appropriateness"
                  secondary="Assess need for physician referral and urgency level"
                />
              </ListItem>
            </List>
          </Box>
        )}

        {/* Action Buttons */}
        {!isReviewed && (onApprove || onModify || onReject) && (
          <>
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {onReject && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleOpenDialog('reject')}
                  disabled={loading}
                  startIcon={<CancelIcon />}
                >
                  Reject
                </Button>
              )}

              {onModify && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => handleOpenDialog('modify')}
                  disabled={loading}
                  startIcon={<EditIcon />}
                >
                  Modify
                </Button>
              )}

              {onApprove && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleOpenDialog('approve')}
                  disabled={loading}
                  startIcon={<CheckCircleIcon />}
                >
                  {loading ? 'Processing...' : 'Approve'}
                </Button>
              )}
            </Box>
          </>
        )}

        {/* Current User Info */}
        {currentUser && !isReviewed && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Reviewing as: {currentUser.name} ({currentUser.role})
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Review Dialog */}
      <Dialog
        open={dialogState.open}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogState.type === 'approve' && 'Approve Diagnostic Result'}
          {dialogState.type === 'modify' && 'Modify Diagnostic Result'}
          {dialogState.type === 'reject' && 'Reject Diagnostic Result'}
        </DialogTitle>

        <DialogContent>
          {dialogState.confirmationRequired && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                High-Risk Case Detected
              </Typography>
              <Typography variant="body2">
                This case contains critical findings or referral
                recommendations. Please confirm you have thoroughly reviewed all
                aspects before approving.
              </Typography>
            </Alert>
          )}

          {dialogState.type === 'approve' && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                By approving this diagnostic result, you confirm that:
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="• The diagnostic assessment is clinically appropriate" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Medication recommendations are safe and appropriate" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Red flags have been properly addressed" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Referral recommendations are appropriate" />
                </ListItem>
              </List>
            </Box>
          )}

          {dialogState.type === 'modify' && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Please describe the modifications you are making to the AI
                recommendations:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Modifications"
                placeholder="Describe your modifications to the diagnostic recommendations..."
                value={dialogState.text}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, text: e.target.value }))
                }
                required
                helperText="Be specific about what changes you are making and why"
              />
            </Box>
          )}

          {dialogState.type === 'reject' && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Please provide a reason for rejecting this diagnostic result:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Rejection Reason"
                placeholder="Explain why you are rejecting these recommendations..."
                value={dialogState.text}
                onChange={(e) =>
                  setDialogState((prev) => ({ ...prev, text: e.target.value }))
                }
                required
                helperText="This will help improve future AI recommendations"
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReview}
            variant="contained"
            disabled={
              loading ||
              ((dialogState.type === 'modify' ||
                dialogState.type === 'reject') &&
                !dialogState.text.trim())
            }
            color={
              dialogState.type === 'approve'
                ? 'success'
                : dialogState.type === 'modify'
                  ? 'warning'
                  : 'error'
            }
          >
            {loading
              ? 'Processing...'
              : dialogState.type === 'approve'
                ? 'Approve'
                : dialogState.type === 'modify'
                  ? 'Submit Modifications'
                  : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PharmacistReviewPanel;
