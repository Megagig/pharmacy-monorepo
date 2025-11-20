import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Divider,
  Collapse,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Edit as ModifyIcon,
  Cancel as RejectIcon,
  Visibility as MonitorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface ReviewActionPanelProps {
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
    }>;
    hasContraindication: boolean;
    hasCriticalInteraction: boolean;
  };
  onReviewComplete: (reviewData: {
    action: string;
    reason: string;
    modificationSuggestions?: string;
    monitoringParameters?: string;
    pharmacistNotes?: string;
  }) => Promise<void>;
}

type ReviewAction = 'approve' | 'modify' | 'reject' | 'monitor';

const ReviewActionPanel: React.FC<ReviewActionPanelProps> = ({ 
  interaction, 
  onReviewComplete 
}) => {
  const theme = useTheme();
  const [selectedAction, setSelectedAction] = useState<ReviewAction | ''>('');
  const [reason, setReason] = useState('');
  const [modificationSuggestions, setModificationSuggestions] = useState('');
  const [monitoringParameters, setMonitoringParameters] = useState('');
  const [pharmacistNotes, setPharmacistNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const actionConfig = {
    approve: {
      label: 'Approve Interaction',
      color: 'success.main' as const,
      icon: <ApproveIcon />,
      description: 'Accept the interaction as clinically acceptable',
      requiresReason: true,
    },
    modify: {
      label: 'Modify Treatment',
      color: 'warning.main' as const,
      icon: <ModifyIcon />,
      description: 'Suggest medication or dosage modifications',
      requiresReason: true,
      requiresModifications: true,
    },
    reject: {
      label: 'Reject Combination',
      color: 'error.main' as const,
      icon: <RejectIcon />,
      description: 'Contraindicate this drug combination',
      requiresReason: true,
    },
    monitor: {
      label: 'Monitor Patient',
      color: 'info.main' as const,
      icon: <MonitorIcon />,
      description: 'Continue with enhanced monitoring',
      requiresReason: true,
      requiresMonitoring: true,
    },
  };

  const handleActionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const action = event.target.value as ReviewAction;
    setSelectedAction(action);
    setError(null);

    // Pre-fill reason based on interaction severity and action
    if (action === 'approve') {
      if (interaction.interactions[0]?.severity === 'minor') {
        setReason('Minor interaction with low clinical significance. Benefits outweigh risks.');
      } else {
        setReason('Clinically acceptable interaction with proper patient monitoring.');
      }
    } else if (action === 'reject') {
      if (interaction.hasContraindication) {
        setReason('Absolute contraindication identified. Alternative therapy required.');
      } else {
        setReason('Risk-benefit analysis unfavorable. Alternative medications recommended.');
      }
    } else if (action === 'monitor') {
      setReason('Interaction manageable with enhanced monitoring and patient education.');
      setMonitoringParameters('Monitor for signs of [specific effects]. Check labs every [frequency]. Patient counseling on [symptoms to watch].');
    } else if (action === 'modify') {
      setReason('Interaction can be mitigated through dose adjustment or timing modifications.');
      setModificationSuggestions('Consider: dose reduction, timing separation, alternative medication.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedAction) {
      setError('Please select a review action');
      return;
    }

    const config = actionConfig[selectedAction];
    
    if (config.requiresReason && !reason.trim()) {
      setError('Please provide a reason for your decision');
      return;
    }

    if (config.requiresModifications && !modificationSuggestions.trim()) {
      setError('Please provide modification suggestions');
      return;
    }

    if (config.requiresMonitoring && !monitoringParameters.trim()) {
      setError('Please provide monitoring parameters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reviewData = {
        action: selectedAction,
        reason: reason.trim(),
        ...(modificationSuggestions.trim() && { modificationSuggestions: modificationSuggestions.trim() }),
        ...(monitoringParameters.trim() && { monitoringParameters: monitoringParameters.trim() }),
        ...(pharmacistNotes.trim() && { pharmacistNotes: pharmacistNotes.trim() }),
      };

      await onReviewComplete(reviewData);
    } catch (err: unknown) {
      console.error('Error submitting review:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit review. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAction('');
    setReason('');
    setModificationSuggestions('');
    setMonitoringParameters('');
    setPharmacistNotes('');
    setError(null);
  };

  const isFormValid = () => {
    if (!selectedAction) return false;
    const config = actionConfig[selectedAction];
    
    if (config.requiresReason && !reason.trim()) return false;
    if (config.requiresModifications && !modificationSuggestions.trim()) return false;
    if (config.requiresMonitoring && !monitoringParameters.trim()) return false;
    
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.palette.primary.main,
                }}
              >
                <SaveIcon />
              </Box>
              <Box>
                <Typography variant="h6" component="div">
                  Pharmacist Review
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Complete your clinical assessment
                </Typography>
              </Box>
            </Box>
          }
        />

        <CardContent>
          {/* High Priority Alert */}
          {(interaction.hasContraindication || interaction.hasCriticalInteraction) && (
            <Alert 
              severity="error" 
              icon={<WarningIcon />}
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {interaction.hasContraindication ? 'Contraindication Detected' : 'Critical Interaction'}
              </Typography>
              <Typography variant="body2">
                This interaction requires immediate pharmacist attention. 
                {interaction.hasContraindication && ' Consider alternative therapy.'}
              </Typography>
            </Alert>
          )}

          {/* Review Actions */}
          <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 'medium' }}>
              Select Review Action
            </FormLabel>
            <RadioGroup
              value={selectedAction}
              onChange={handleActionChange}
            >
              {Object.entries(actionConfig).map(([key, config]) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={2} py={1}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: alpha((theme.palette as Record<string, { main: string }>)[config.color.split('.')[0]]?.main || theme.palette.grey[500], 0.2),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: config.color,
                        }}
                      >
                        {config.icon}
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {config.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {config.description}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{
                    border: 1,
                    borderColor: selectedAction === key ? config.color : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    mx: 0,
                    px: 2,
                    py: 1,
                    backgroundColor: selectedAction === key ? alpha((theme.palette as Record<string, { main: string }>)[config.color.split('.')[0]]?.main || theme.palette.grey[500], 0.05) : 'transparent',
                    '&:hover': {
                      backgroundColor: alpha((theme.palette as Record<string, { main: string }>)[config.color.split('.')[0]]?.main || theme.palette.grey[500], 0.1),
                    },
                  }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {/* Reason Field */}
          {selectedAction && actionConfig[selectedAction].requiresReason && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Clinical Reasoning"
              placeholder="Provide your clinical rationale for this decision..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              sx={{ mb: 2 }}
              required
              helperText="Required: Explain your clinical decision-making process"
            />
          )}

          {/* Modification Suggestions */}
          {selectedAction === 'modify' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Modification Suggestions"
              placeholder="Specify dose adjustments, timing changes, or alternative medications..."
              value={modificationSuggestions}
              onChange={(e) => setModificationSuggestions(e.target.value)}
              sx={{ mb: 2 }}
              required
              helperText="Required: Provide specific modification recommendations"
            />
          )}

          {/* Monitoring Parameters */}
          {selectedAction === 'monitor' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Monitoring Parameters"
              placeholder="Specify lab tests, vital signs, symptoms to monitor, and frequency..."
              value={monitoringParameters}
              onChange={(e) => setMonitoringParameters(e.target.value)}
              sx={{ mb: 2 }}
              required
              helperText="Required: Define monitoring requirements and schedule"
            />
          )}

          {/* Advanced Options */}
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={showAdvancedOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              size="small"
              sx={{ mb: 1 }}
            >
              Advanced Options
            </Button>
            
            <Collapse in={showAdvancedOptions}>
              <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Additional Pharmacist Notes"
                  placeholder="Optional: Additional clinical notes, patient counseling points, or follow-up recommendations..."
                  value={pharmacistNotes}
                  onChange={(e) => setPharmacistNotes(e.target.value)}
                  helperText="Optional: Any additional clinical documentation"
                />
              </Box>
            </Collapse>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Action Buttons */}
          <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} /> : <SaveIcon />}
              fullWidth
            >
              {isSubmitting ? 'Submitting Review...' : 'Submit Review'}
            </Button>
            
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={isSubmitting}
              sx={{ minWidth: { xs: 'auto', sm: '120px' } }}
            >
              Reset
            </Button>
          </Box>

          {/* Form Validation Summary */}
          {selectedAction && (
            <Box 
              sx={{ 
                mt: 2, 
                p: 2, 
                backgroundColor: alpha(theme.palette.info.main, 0.05),
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Review Summary
              </Typography>
              <Typography variant="body2">
                Action: <strong>{actionConfig[selectedAction].label}</strong>
              </Typography>
              {reason && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Status: <strong>{isFormValid() ? 'Ready to submit' : 'Form incomplete'}</strong>
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ReviewActionPanel;